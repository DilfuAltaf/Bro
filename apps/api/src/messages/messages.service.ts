import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { GeminiService, GeminiMemoryItem, GeminiSource, truncateForLlm } from '../gemini/gemini.service';
import * as crypto from 'crypto';

// Diet konteks agar kuota LLM gratis awet: 1 turn "hi" tidak perlu membawa
// 10 pesan + 20 memori. Tanpa ini, satu request gampang tembus ribuan token
// dan langsung kena rate-limit per menit (mis. Groq 8K token/menit).
const HISTORY_MESSAGE_LIMIT = 4;
const HISTORY_CHARS_PER_MESSAGE = 1500;
const MEMORY_LIMIT = 3;
const MEMORY_CHARS_PER_ITEM = 300;

// Batas lampiran gambar per pesan (hemat kuota + jaga ukuran request).
const MAX_IMAGE_ATTACHMENTS = 4;
const MAX_IMAGE_CHARS = 2_500_000;

export type MessageStreamEvent =
  | { type: 'token'; value: string }
  | { type: 'sources'; sources: GeminiSource[] }
  | { type: 'done'; messageId: string; createdAt: string; intent: string; model?: string }
  | { type: 'error'; message: string };

const VALID_INTENTS = ['research', 'support', 'learning', 'assignment', 'brainstorm', 'general'];

const MESSAGE_SELECT = 'id, conversationId, role, content, createdAt';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
    private readonly geminiService: GeminiService,
  ) {}

  private logDbError(context: string, error: any) {
    // Log only safe diagnostic fields. Never log message content, tokens, or secrets.
    this.logger.error(
      `${context} failed: code=${error?.code || 'unknown'} message=${error?.message || error} details=${error?.details || 'n/a'} hint=${error?.hint || 'n/a'}`,
    );
  }

  private throwDbError(context: string, error: any, message: string): never {
    this.logDbError(context, error);
    throw new InternalServerErrorException(message);
  }

  private async requireConversation(conversationId: string) {
    const { data: conversation, error } = await this.supabaseService.client
      .from('ConversationThread')
      .select('id, userId')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) {
      this.throwDbError(
        'conversation lookup',
        error,
        'Unable to retrieve conversation. Please try again later.',
      );
    }
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async createMessage(conversationId: string, role: string, content: string) {
    const { data: message, error } = await this.supabaseService.client
      .from('Message')
      .insert({
        id: crypto.randomUUID(),
        conversationId,
        role,
        content,
      })
      .select(MESSAGE_SELECT)
      .single();

    if (error) {
      this.throwDbError(
        'create message',
        error,
        'Unable to save message. Please try again later.',
      );
    }
    return message;
  }

  private async recordWorkflowRun(conversationId: string, intent: string) {
    const { error } = await this.supabaseService.client
      .from('WorkflowRun')
      .insert({
        id: crypto.randomUUID(),
        conversationId,
        intent,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

    if (error) {
      this.throwDbError(
        'record workflow run',
        error,
        'Unable to save message. Please try again later.',
      );
    }
  }

  async getMessages(conversationId: string) {
    await this.requireConversation(conversationId);

    const { data, error } = await this.supabaseService.client
      .from('Message')
      .select(MESSAGE_SELECT)
      .eq('conversationId', conversationId)
      .order('createdAt', { ascending: true });

    if (error) {
      this.throwDbError(
        'get messages',
        error,
        'Unable to retrieve messages. Please try again later.',
      );
    }
    return data || [];
  }

  async sendMessage(conversationId: string, content: string, mode?: string, model?: string, images?: string[]) {
    const conversation = await this.requireConversation(conversationId);

    const cleanImages = this.sanitizeImages(images);
    this.logger.log(`[Chat] request received (mode=${mode} model=${model || 'default'} images=${cleanImages.length})`);

    const history = await this.buildHistory(conversationId, content, cleanImages);
    const memories = await this.loadMemories(conversation.userId);

    const userMessage = await this.createMessage(conversationId, 'user', content);

    const safetyCheck = this.safetyService.checkSafety(content);
    if (safetyCheck.isCrisis) {
      this.logger.log('[Chat] safety check triggered short-circuit');
      const assistantMessage = await this.createMessage(
        conversationId,
        'assistant',
        safetyCheck.response || 'Maaf, saya di sini untuk membantu.',
      );
      return { userMessage, assistantMessage, intent: 'support' };
    }

    let aiReply = 'Maaf, saya tidak dapat merespons saat ini.';
    let intent = 'general';
    let replyModel: string | undefined;

    try {
      const result = await this.geminiService.chat(history, memories, mode, model);
      aiReply = result.response || aiReply;
      intent = result.intent || intent;
      replyModel = result.model;
      if (result.sources.length > 0) {
        aiReply += GeminiService.formatSources(result.sources);
      }
    } catch (error: any) {
      this.logger.error('Gemini error:', error.message);
      aiReply = error.message;
    }

    const assistantMessage = await this.createMessage(conversationId, 'assistant', aiReply);

    await this.recordWorkflowRun(conversationId, intent);

    return { userMessage, assistantMessage, intent, model: replyModel };
  }

  /**
   * Streaming turn. Yields token deltas as they arrive, then persists the full
   * assistant reply and emits a `done` event. One LLM request per turn.
   */
  async *streamMessage(
    conversationId: string,
    content: string,
    mode?: string,
    model?: string,
    images?: string[],
  ): AsyncGenerator<MessageStreamEvent> {
    const conversation = await this.requireConversation(conversationId);

    const cleanImages = this.sanitizeImages(images);
    this.logger.log(`[Chat] stream request (mode=${mode} model=${model || 'default'} images=${cleanImages.length})`);

    const history = await this.buildHistory(conversationId, content, cleanImages);
    const memories = await this.loadMemories(conversation.userId);

    await this.createMessage(conversationId, 'user', content);

    const safetyCheck = this.safetyService.checkSafety(content);
    if (safetyCheck.isCrisis) {
      this.logger.log('[Chat] safety check triggered short-circuit');
      const response = safetyCheck.response || 'Maaf, saya di sini untuk membantu.';
      yield { type: 'token', value: response };
      const assistantMessage = await this.createMessage(conversationId, 'assistant', response);
      yield {
        type: 'done',
        messageId: assistantMessage.id,
        createdAt: new Date(assistantMessage.createdAt).toISOString(),
        intent: 'support',
      };
      return;
    }

    const intent = this.normalizeIntent(mode);

    // Diisi service LLM dengan ID model yang benar-benar menjawab
    // (bisa beda dari yang diminta saat terjadi fallback).
    const actualModel: { modelId?: string } = {};

    let full = '';
    try {
      for await (const delta of this.geminiService.streamChat(history, memories, mode, model, actualModel)) {
        full += delta;
        yield { type: 'token', value: delta };
      }
    } catch (error: any) {
      this.logger.error('Gemini stream error:', error?.message);
      const message = error?.message || 'Terjadi kesalahan saat menghubungi AI.';
      if (!full) {
        full = message;
        yield { type: 'token', value: message };
      }
    }

    const assistantMessage = await this.createMessage(
      conversationId,
      'assistant',
      full || 'Maaf, saya tidak dapat merespons saat ini.',
    );

    await this.recordWorkflowRun(conversationId, intent);

    yield {
      type: 'done',
      messageId: assistantMessage.id,
      createdAt: new Date(assistantMessage.createdAt).toISOString(),
      intent,
      model: actualModel.modelId,
    };
  }

  async syncMessage(conversationId: string, role: string, content: string) {
    await this.requireConversation(conversationId);

    return this.createMessage(conversationId, role, content);
  }

  private async buildHistory(
    conversationId: string,
    content: string,
    images: string[] = [],
  ): Promise<Array<{ role: string; content: any }>> {
    const { data: recentMessages, error } = await this.supabaseService.client
      .from('Message')
      .select('role, content')
      .eq('conversationId', conversationId)
      .order('createdAt', { ascending: false })
      .limit(HISTORY_MESSAGE_LIMIT);

    if (error) {
      this.throwDbError(
        'build chat history',
        error,
        'Unable to retrieve messages. Please try again later.',
      );
    }
    const history: Array<{ role: string; content: any }> = [...(recentMessages || [])]
      .reverse()
      .map((m) => ({ role: m.role, content: truncateForLlm(m.content || '', HISTORY_CHARS_PER_MESSAGE) }));
    // Pesan user saat ini dikirim utuh — yang dipangkas hanya riwayat lama.
    // Kalau ada gambar, pakai format multimodal (teks + image_url) ala OpenAI.
    if (images.length > 0) {
      history.push({
        role: 'user',
        content: [
          ...(content ? [{ type: 'text', text: content }] : []),
          ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      });
    } else {
      history.push({ role: 'user', content });
    }
    return history;
  }

  /**
   * Saring lampiran gambar: hanya data-URL gambar, dibatasi jumlah + ukuran
   * agar request tidak jebol dan kuota tidak bocor.
   */
  private sanitizeImages(images?: string[]): string[] {
    if (!Array.isArray(images)) return [];
    return images
      .filter((u): u is string => typeof u === 'string' && u.startsWith('data:image/'))
      .map((u) => (u.length > MAX_IMAGE_CHARS ? '' : u))
      .filter((u) => u.length > 0)
      .slice(0, MAX_IMAGE_ATTACHMENTS);
  }

  private async loadMemories(userId: string): Promise<GeminiMemoryItem[]> {
    const { data: memories, error } = await this.supabaseService.client
      .from('Memory')
      .select('type, content')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .limit(MEMORY_LIMIT);

    if (error) {
      this.throwDbError(
        'load memories',
        error,
        'Unable to retrieve memories. Please try again later.',
      );
    }
    return (memories || []).map((m) => ({
      type: m.type,
      content: truncateForLlm(m.content, MEMORY_CHARS_PER_ITEM),
    }));
  }

  private normalizeIntent(mode?: string): string {
    return mode && VALID_INTENTS.includes(mode) ? mode : 'general';
  }
}
