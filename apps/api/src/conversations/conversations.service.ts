import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import * as crypto from 'crypto';

const THREAD_SELECT = 'id, userId, title, createdAt, updatedAt';
const MESSAGE_SELECT = 'id, conversationId, role, content, createdAt';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private logDbError(context: string, error: any) {
    // Log only safe diagnostic fields. Never log message content, tokens, or secrets.
    this.logger.error(
      `${context} failed: code=${error?.code || 'unknown'} message=${error?.message || error} details=${error?.details || 'n/a'} hint=${error?.hint || 'n/a'}`,
    );
  }

  async findAll(userId?: string) {
    if (!userId) {
      return [];
    }
    const { data, error } = await this.supabaseService.client
      .from('ConversationThread')
      .select(THREAD_SELECT)
      .eq('userId', userId)
      .order('updatedAt', { ascending: false });

    if (error) {
      this.logDbError('findAll conversation threads', error);
      throw new InternalServerErrorException(
        'Unable to retrieve conversations. Please try again later.',
      );
    }
    return data || [];
  }

  async findById(id: string) {
    const { data: thread, error } = await this.supabaseService.client
      .from('ConversationThread')
      .select(THREAD_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logDbError('findById conversation thread', error);
      throw new InternalServerErrorException(
        'Unable to retrieve conversation. Please try again later.',
      );
    }
    if (!thread) {
      throw new NotFoundException('Conversation thread not found');
    }

    const { data: messages, error: messagesError } =
      await this.supabaseService.client
        .from('Message')
        .select(MESSAGE_SELECT)
        .eq('conversationId', id)
        .order('createdAt', { ascending: true });

    if (messagesError) {
      this.logDbError('findById conversation messages', messagesError);
      throw new InternalServerErrorException(
        'Unable to retrieve conversation. Please try again later.',
      );
    }
    return { ...thread, messages: messages || [] };
  }

  async create(data: CreateConversationDto & { userId: string }) {
    // Ensure user exists — auto-create if default user
    const { data: existingUser, error: userError } =
      await this.supabaseService.client
        .from('User')
        .select('id')
        .eq('id', data.userId)
        .maybeSingle();

    if (userError) {
      this.logDbError('create conversation user lookup', userError);
      throw new InternalServerErrorException(
        'Unable to create conversation. Please try again later.',
      );
    }

    if (!existingUser) {
      const { error: createUserError } = await this.supabaseService.client
        .from('User')
        .insert({
          id: data.userId,
          name: 'Guest User',
          email: `${data.userId}@broagent.local`,
        });
      // A concurrent request may have created the same user first; the row
      // exists either way, so a unique violation can be safely ignored.
      if (createUserError && createUserError.code !== '23505') {
        this.logDbError('create conversation shadow user', createUserError);
        throw new InternalServerErrorException(
          'Unable to create conversation. Please try again later.',
        );
      }
    }

    const { data: thread, error } = await this.supabaseService.client
      .from('ConversationThread')
      .insert({
        id: crypto.randomUUID(),
        userId: data.userId,
        ...(data.title ? { title: data.title } : {}),
      })
      .select(THREAD_SELECT)
      .single();

    if (error) {
      this.logDbError('create conversation thread', error);
      throw new InternalServerErrorException(
        'Unable to create conversation. Please try again later.',
      );
    }
    return thread;
  }

  async update(id: string, data: UpdateConversationDto) {
    // Verify the thread exists first to preserve NotFound behavior.
    await this.findById(id);

    const updatePayload: any = {};
    if (data.title !== undefined) updatePayload.title = data.title;

    if (Object.keys(updatePayload).length === 0) {
      const { messages: _ignored, ...thread } = await this.findById(id);
      void _ignored;
      return thread;
    }

    const { data: updated, error } = await this.supabaseService.client
      .from('ConversationThread')
      .update(updatePayload)
      .eq('id', id)
      .select(THREAD_SELECT)
      .single();

    if (error) {
      this.logDbError('update conversation thread', error);
      throw new InternalServerErrorException(
        'Unable to update conversation. Please try again later.',
      );
    }
    return updated;
  }

  async delete(id: string) {
    // Verify the thread exists first to preserve NotFound behavior.
    await this.findById(id);

    const { data: deleted, error } = await this.supabaseService.client
      .from('ConversationThread')
      .delete()
      .eq('id', id)
      .select(THREAD_SELECT)
      .single();

    if (error) {
      this.logDbError('delete conversation thread', error);
      throw new InternalServerErrorException(
        'Unable to delete conversation. Please try again later.',
      );
    }
    return deleted;
  }
}
