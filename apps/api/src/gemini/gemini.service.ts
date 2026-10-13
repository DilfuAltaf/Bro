import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface GeminiMemoryItem {
  type: string;
  content: string;
}

export interface GeminiSource {
  title: string;
  url: string;
  content?: string;
}

export interface GeminiChatResult {
  response: string;
  intent: string;
  sources: GeminiSource[];
  /** ID model yang benar-benar menjawab (bisa beda dari yang diminta saat fallback). */
  model: string;
}

export interface GeminiHealth {
  reachable: boolean;
  baseUrl: string;
  model: string;
  error?: string;
}

/**
 * Google's OpenAI-compatible surface. The OpenAI SDK appends `/chat/completions`
 * to this base, so the effective URL is `.../v1beta/openai/chat/completions`.
 */
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_AGENT_URL = 'http://localhost:8000';

/** Groq's OpenAI-compatible surface: `.../openai/v1/chat/completions`. */
const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

/** Max berapa kali pindah model dalam satu turn (biar nggak kelamaan). */
const MAX_MODEL_FALLBACKS = 2;
/** Batas tunggu Retry-After agar satu chat tidak menggantung terlalu lama. */
const MAX_RETRY_AFTER_MS = 10_000;

/**
 * Diet konteks agar kuota LLM gratis awet (mis. Groq cuma 8K token/menit):
 * kirim seperlunya, bukan sebanyak-banyaknya.
 */
export const RESEARCH_SOURCE_LIMIT = 2;
export const RESEARCH_CHARS_PER_SOURCE = 600;

/** Potong teks panjang dengan penanda agar AI tahu konteksnya tidak utuh. */
export function truncateForLlm(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';
  return `${text.slice(0, maxChars).trimEnd()}\n...[dipotong agar hemat kuota]`;
}

/** True kalau ada pesan multimodal berisi gambar (format OpenAI image_url). */
function hasImageParts(messages: Array<{ role: string; content?: any }>): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((p: any) => p && p.type === 'image_url'),
  );
}

/** Ambil teks dari content string maupun multimodal (gabung part teks). */
function textOf(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p && p.type === 'text' && typeof p.text === 'string')
      .map((p: any) => p.text)
      .join('\n');
  }
  return '';
}

export type LlmProvider = 'gemini' | 'groq';

export interface LlmModelOption {
  id: string;
  label: string;
  provider: LlmProvider;
  description: string;
}

/**
 * Katalog model yang bisa dipilih user dari frontend.
 * ID model Groq mengikuti https://console.groq.com/docs/models.
 */
export const LLM_MODEL_CATALOG: LlmModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    provider: 'gemini',
    description: 'Cepat & hemat kuota, cocok untuk chat harian',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Lebih pintar untuk reasoning & dokumen',
  },
  {
    id: 'qwen/qwen3.8-27b',
    label: 'Qwen 3.8 27B (Groq)',
    provider: 'groq',
    description: 'Serbaguna & multibahasa via Groq',
  },
  {
    id: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B (Groq)',
    provider: 'groq',
    description: 'Open-weight flagship, bisa reasoning + code',
  },
  {
    id: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B (Groq)',
    provider: 'groq',
    description: 'Ringan & cepat (~1000 tps) via Groq',
  },
];

const PERSONA =
  'Anda adalah BroAgent, asisten AI yang ramah dan membantu untuk kaum pelajar Indonesia. ' +
  'Karakter jawaban: natural, hangat, membantu, jelas, tidak terlalu formal, tidak terlalu panjang, ' +
  'mengikuti bahasa yang dipakai user, dan tidak selalu memakai format bullet jika tidak diperlukan.';

const OUTPUT_FORMATTING =
  'Format jawaban memakai Markdown (GitHub Flavored) yang bersih karena jawaban dirender ' +
  'menjadi dokumen terstruktur: gunakan tabel Markdown asli (baris header + baris pemisah ' +
  '`| --- |` dengan jumlah kolom yang konsisten di semua baris) untuk data tabular, blok kode ' +
  'berpagar dengan nama bahasa (mis. ```ts, ```py) untuk kode, heading `#`/`##` untuk dokumen ' +
  'panjang, list `-` atau `1.` untuk daftar dan langkah, serta link `[teks](url)` hanya untuk ' +
  'URL http(s) yang valid. Jangan memakai HTML mentah. ' +
  'Data tabular WAJIB memakai tabel Markdown berpipa (bukan tabel ber-tab/spasi), dan rumus ' +
  'matematika WAJIB memakai LaTeX di dalam `$...$` (contoh `$\\frac{1}{2}$`, `$\\sqrt{2}$`, ' +
  '`$0^\\circ$`, `$\\sin x$`).';

export const VALID_INTENTS = new Set([
  'research',
  'support',
  'learning',
  'assignment',
  'brainstorm',
  'general',
]);

export const VALID_MODES = new Set([
  'general',
  'learning',
  'research',
  'brainstorm',
  'support',
  'assignment',
  'document',
]);

export type Mode =
  | 'general'
  | 'learning'
  | 'research'
  | 'brainstorm'
  | 'support'
  | 'assignment'
  | 'document';

export const MODE_INSTRUCTIONS: Record<Mode, string> = {
  general: `[MODE: GENERAL]
You are a conversational, flexible, and helpful personal AI assistant.
- Answer general questions, assist with coding, planning, and problem-solving.
- Keep responses natural, concise, and do not force a specific format.
- If the user is just chatting casually, respond naturally in kind.`,

  learning: `[MODE: LEARNING]
You are acting as a patient personal tutor.
- Prioritize understanding over simply giving the final answer.
- Explain from the basics if the user seems unfamiliar with the concept.
- Break difficult concepts into smaller parts.
- Use simple examples and analogies.
- Increase complexity gradually and check the user's understanding when relevant.
- Do not make explanations unnecessarily long without a good reason.`,

  research: `[MODE: RESEARCH]
You are assisting with research and investigation.
- Understand the research question, break it into subtopics, compare information, synthesize findings, explain evidence, distinguish facts from interpretation, and note any uncertainties.
- If real research sources are provided in the context, use them carefully.
- DO NOT invent citations or sources.
- If no sources are provided, explain based on your existing knowledge but DO NOT pretend that web research happened.`,

  brainstorm: `[MODE: BRAINSTORM]
You are a thinking partner.
- Generate ideas, explore possibilities, compare options, develop ideas, and identify trade-offs.
- Help the user choose based on their needs.
- Do not force a single solution too quickly, and do not always provide overly long lists. Adapt the number of ideas to the context.`,

  support: `[MODE: SUPPORT]
You are providing empathetic support.
- Acknowledge the user's situation and respond with empathy, patience, and without judgment.
- Keep it natural, not too formal, and avoid lecturing.
- Help the user identify practical and realistic next steps.
- Keep responses relatively brief and supportive.`,

  assignment: `[MODE: ASSIGNMENT]
You are helping the user work through a task or assignment.
- Understand the task, help break it down, explain required concepts, provide hints, help outline, review the user's work, and provide examples.
- Do not automatically take over and complete the entire assignment for the user unless they ask for something highly specific (like explaining a single question).
- Guide them to arrive at the answer.`,

  document: `[MODE: DOCUMENT]
You are assisting with document analysis.
- Summarize, explain, extract information, analyze, compare sections, and answer questions based ONLY on the provided document context.
- DO NOT invent document content.
- If no document context is provided, clearly inform the user that a document or text is needed. Do not pretend you have read a file.`,
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly openai: OpenAI;
  private readonly groq: OpenAI;
  private readonly baseUrl: string;
  private readonly agentUrl: string;
  private readonly apiKey: string;
  private readonly groqBaseUrl: string;
  private readonly groqApiKey: string;
  readonly model: string;
  readonly groqModel: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('GEMINI_BASE_URL') || DEFAULT_BASE_URL
    ).replace(/\/+$/, '');
    this.apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim() || '';
    this.model = this.config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;
    this.agentUrl = (
      this.config.get<string>('AI_AGENT_URL') || DEFAULT_AGENT_URL
    ).replace(/\/+$/, '');
    this.groqBaseUrl = (
      this.config.get<string>('GROQ_BASE_URL') || DEFAULT_GROQ_BASE_URL
    ).replace(/\/+$/, '');
    this.groqApiKey = this.config.get<string>('GROQ_API_KEY')?.trim() || '';
    this.groqModel =
      this.config.get<string>('GROQ_MODEL')?.trim() || DEFAULT_GROQ_MODEL;

    if (!this.apiKey) {
      this.logger.error('GEMINI_API_KEY is empty. Chat requests will fail.');
    }
    if (!this.groqApiKey) {
      this.logger.warn('GROQ_API_KEY is empty. Groq models will be unavailable.');
    }

    this.openai = new OpenAI({
      baseURL: this.baseUrl,
      apiKey: this.apiKey || 'gemini-api-key-not-configured',
      timeout: Number(this.config.get<string>('GEMINI_TIMEOUT_MS') || 120_000),
      // Tanpa retry otomatis SDK: 429 ditangani manual (pindah model + backoff)
      // agar tidak membakar kuota diam-diam.
      maxRetries: 0,
    });

    this.groq = new OpenAI({
      baseURL: this.groqBaseUrl,
      apiKey: this.groqApiKey || 'groq-api-key-not-configured',
      timeout: Number(this.config.get<string>('GROQ_TIMEOUT_MS') || 120_000),
      maxRetries: 0,
    });

    this.logger.log(`Gemini client ready (base=${this.baseUrl}, model=${this.model})`);
    this.logger.log(`Groq client ready (base=${this.groqBaseUrl}, model=${this.groqModel})`);
  }

  /** Daftar model untuk dropdown frontend, lengkap dengan status ketersediaan key. */
  listModels(): Array<LlmModelOption & { available: boolean }> {
    return LLM_MODEL_CATALOG.map((m) => ({
      ...m,
      available: m.provider === 'gemini' ? Boolean(this.apiKey) : Boolean(this.groqApiKey),
    }));
  }

  /** Tentukan provider + nama model dari ID yang dikirim frontend. */
  resolveModel(requested?: string): { provider: LlmProvider; model: string } {    const fallback: { provider: LlmProvider; model: string } =
      this.apiKey
        ? { provider: 'gemini', model: this.model }
        : { provider: 'groq', model: this.groqModel };
    if (!requested || typeof requested !== 'string') return fallback;
    const found = LLM_MODEL_CATALOG.find((m) => m.id === requested.trim());
    if (found) return { provider: found.provider, model: found.id };
    // Izinkan custom model ID: anggap Groq jika diawali prefix Groq yang dikenal.
    const trimmed = requested.trim();
    if (/^(llama|qwen|openai\/|mixtral|gemma|deepseek)/i.test(trimmed)) {
      return { provider: 'groq', model: trimmed };
    }
    if (/^gemini/i.test(trimmed)) {
      return { provider: 'gemini', model: trimmed };
    }
    return fallback;
  }

  /** True untuk error kuota/rate-limit/sibuk — layak dicoba ke model lain. */
  private static isCapacityError(error: any): boolean {
    const status = error?.status;
    if (status === 429 || status === 503) return true;
    const raw = typeof error?.message === 'string' ? error.message : String(error);
    return /quota|RESOURCE_EXHAUSTED|rate_limit|rate limit|overloaded|UNAVAILABLE/i.test(raw);
  }

  /**
   * Urutan model pengganti saat model utama kena limit: model Groq lain dulu,
   * terakhir Gemini — kecuali `onlyProvider` diisi (mis. vision → sesama Gemini).
   * Hanya model yang API key-nya tersedia di server.
   */
  private fallbackChain(failedModel: string, onlyProvider?: LlmProvider): string[] {
    const failed = (failedModel || '').trim();
    return LLM_MODEL_CATALOG.filter(
      (m) =>
        m.id !== failed &&
        (!onlyProvider || m.provider === onlyProvider) &&
        (m.provider === 'gemini' ? Boolean(this.apiKey) : Boolean(this.groqApiKey)),
    )
      .sort((a, b) => (a.provider === b.provider ? 0 : a.provider === 'groq' ? -1 : 1))
      .slice(0, MAX_MODEL_FALLBACKS)
      .map((m) => m.id);
  }

  /** Baca header Retry-After dari provider (detik) — dibatasi agar tidak gantung. */
  private static retryAfterMs(error: any): number {
    const raw = error?.headers?.['retry-after'] ?? error?.headers?.['Retry-After'];
    const secs = Number(raw);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(secs * 1000, MAX_RETRY_AFTER_MS);
    }
    return 1500;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Catat pemakaian token per turn (tanpa isi pesan) agar bakar kuota terpantau. */
  private logUsage(provider: LlmProvider, model: string, usage: any): void {
    if (!usage) return;
    const prompt = usage.prompt_tokens ?? '?';
    const completion = usage.completion_tokens ?? '?';
    const total = usage.total_tokens ?? '?';
    this.logger.log(`[LLM usage] ${provider}/${model} prompt=${prompt} completion=${completion} total=${total}`);
  }

  /** Pesan akhir saat semua model habis / error non-kuota. */
  private exhaustedMessage(error: any, didFallback: boolean, provider: LlmProvider): string {
    if (didFallback && GeminiService.isCapacityError(error)) {
      return 'Semua model AI sedang limit. Tunggu sebentar lalu coba lagi, atau coba besok.';
    }
    return GeminiService.friendlyError(error, provider);
  }

  async checkHealth(): Promise<GeminiHealth & { groq?: GeminiHealth; models?: Array<LlmModelOption & { available: boolean }> }> {
    const health: GeminiHealth & { groq?: GeminiHealth; models?: Array<LlmModelOption & { available: boolean }> } = {
      reachable: false,
      baseUrl: this.baseUrl,
      model: this.model,
    };

    if (!this.apiKey) {
      health.error = 'GEMINI_API_KEY is not configured';
    } else {
      try {
        const res = await fetch(`${this.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
          health.error = `Gemini /models returned HTTP ${res.status}`;
        } else {
          health.reachable = true;
        }
      } catch (error) {
        health.error = `Gemini unreachable: ${GeminiService.describe(error)}`;
      }
    }

    // Groq health (tidak menggagalkan health utama jika Groq belum dikonfigurasi)
    const groqHealth: GeminiHealth = {
      reachable: false,
      baseUrl: this.groqBaseUrl,
      model: this.groqModel,
    };
    if (!this.groqApiKey) {
      groqHealth.error = 'GROQ_API_KEY is not configured';
    } else {
      try {
        const res = await fetch(`${this.groqBaseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.groqApiKey}` },
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
          groqHealth.error = `Groq /models returned HTTP ${res.status}`;
        } else {
          groqHealth.reachable = true;
        }
      } catch (error) {
        groqHealth.error = `Groq unreachable: ${GeminiService.describe(error)}`;
      }
    }
    health.groq = groqHealth;
    health.models = this.listModels();
    return health;
  }

  /** Single non-streaming turn. Used by the voice worker and the REST fallback. */
  async chat(
    messages: Array<{ role: string; content?: any }>,
    memories: GeminiMemoryItem[] = [],
    mode?: string,
    requestedModel?: string,
  ): Promise<GeminiChatResult> {
    const validatedMode = this.normalizeMode(mode);
    // Model Groq saat ini text-only — kalau ada gambar, paksa ke Gemini (vision).
    const wantsVision = hasImageParts(messages);
    const first = wantsVision
      ? { provider: 'gemini' as LlmProvider, model: this.model }
      : this.resolveModel(requestedModel);
    if (wantsVision) {
      this.logger.log(`[LLM] lampiran gambar terdeteksi, pakai ${this.model} (vision)`);
    }
    const attempts = [
      first.model,
      ...this.fallbackChain(first.model, wantsVision ? first.provider : undefined),
    ];
    const history = this.cleanHistory(messages);
    if (history.length === 0) {
      throw new Error('Cannot call Gemini with an empty message list.');
    }

    const sources = await this.maybeResearch(validatedMode, history);
    const systemPrompt = this.buildSystemPrompt(memories, sources, validatedMode);

    let lastError: any = null;
    let lastProvider: LlmProvider = first.provider;
    for (let i = 0; i < attempts.length; i += 1) {
      const { provider, model } = this.resolveModel(attempts[i]);
      lastProvider = provider;
      const client = provider === 'groq' ? this.groq : this.openai;
      try {
        this.assertProviderKey(provider);
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          stream: false,
        });
        this.logUsage(provider, model, (completion as any)?.usage);
        const content = completion.choices[0]?.message?.content?.trim();
        return {
          response: content || 'Maaf, saya tidak dapat merespons saat ini.',
          intent: validatedMode,
          sources,
          model,
        };
      } catch (error) {
        lastError = error;
        if (GeminiService.isCapacityError(error) && i < attempts.length - 1) {
          this.logger.warn(`[LLM] ${model} kena limit, pindah ke ${attempts[i + 1]}`);
          await GeminiService.sleep(GeminiService.retryAfterMs(error));
          continue;
        }
        break;
      }
    }
    throw new Error(this.exhaustedMessage(lastError, attempts.length > 1, lastProvider));
  }

  /**
   * Streaming turn: yields assistant text deltas as they arrive. One LLM call
   * only — the former "planner" round-trip has been removed for latency.
   * Kena limit (429/503) sebelum token pertama keluar → otomatis pindah model.
   * `actual` diisi ID model yang benar-benar menjawab (untuk label di UI).
   */
  async *streamChat(
    messages: Array<{ role: string; content?: any }>,
    memories: GeminiMemoryItem[] = [],
    mode?: string,
    requestedModel?: string,
    actual?: { modelId?: string },
  ): AsyncGenerator<string> {
    const validatedMode = this.normalizeMode(mode);
    // Model Groq saat ini text-only — kalau ada gambar, paksa ke Gemini (vision).
    const wantsVision = hasImageParts(messages);
    const first = wantsVision
      ? { provider: 'gemini' as LlmProvider, model: this.model }
      : this.resolveModel(requestedModel);
    if (wantsVision) {
      this.logger.log(`[LLM] lampiran gambar terdeteksi, pakai ${this.model} (vision)`);
    }
    const attempts = [
      first.model,
      ...this.fallbackChain(first.model, wantsVision ? first.provider : undefined),
    ];
    const history = this.cleanHistory(messages);
    if (history.length === 0) {
      throw new Error('Cannot call Gemini with an empty message list.');
    }

    const sources = await this.maybeResearch(validatedMode, history);
    const systemPrompt = this.buildSystemPrompt(memories, sources, validatedMode);

    let lastError: any = null;
    let lastProvider: LlmProvider = first.provider;
    for (let i = 0; i < attempts.length; i += 1) {
      const { provider, model } = this.resolveModel(attempts[i]);
      lastProvider = provider;
      const client = provider === 'groq' ? this.groq : this.openai;
      if (actual) actual.modelId = model;

      let stream;
      try {
        this.assertProviderKey(provider);
        stream = await client.chat.completions.create({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          stream: true,
          stream_options: { include_usage: true },
        });
      } catch (error) {
        lastError = error;
        if (GeminiService.isCapacityError(error) && i < attempts.length - 1) {
          this.logger.warn(`[LLM] ${model} kena limit, pindah ke ${attempts[i + 1]}`);
          await GeminiService.sleep(GeminiService.retryAfterMs(error));
          continue;
        }
        break;
      }

      // Stream tersambung. Error di tengah jalan TIDAK di-fallback agar teks
      // yang sudah terkirim tidak duplikat — langsung dilempar.
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
          const usage = (chunk as any)?.usage;
          if (usage) this.logUsage(provider, model, usage);
        }
      } catch (error) {
        throw new Error(GeminiService.friendlyError(error, provider));
      }
      return;
    }
    throw new Error(this.exhaustedMessage(lastError, attempts.length > 1, lastProvider));
  }

  private assertProviderKey(provider: LlmProvider): void {
    if (provider === 'groq' && !this.groqApiKey) {
      throw new Error(
        'Model Groq dipilih tapi GROQ_API_KEY belum diisi. Isi GROQ_API_KEY di file .env atau pilih model Gemini.',
      );
    }
    if (provider === 'gemini' && !this.apiKey) {
      throw new Error(
        'Model Gemini dipilih tapi GEMINI_API_KEY belum diisi. Periksa GEMINI_API_KEY.',
      );
    }
  }

  /** Web research via the Python agent's real search adapter. Never fakes sources. */
  async searchWeb(query: string): Promise<GeminiSource[]> {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    try {
      const res = await fetch(`${this.agentUrl}/agent/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`research adapter returned HTTP ${res.status}`);

      const payload = (await res.json()) as { results?: GeminiSource[] };
      return (payload.results ?? []).filter(
        (s): s is GeminiSource => Boolean(s && s.url),
      );
    } catch (error) {
      this.logger.error(`Web search failed: ${GeminiService.describe(error)}`);
      return [];
    }
  }

  static formatSources(sources: GeminiSource[]): string {
    if (sources.length === 0) return '';
    let text = '\n\n**Sumber:**\n';
    sources.forEach((s, i) => {
      text += `${i + 1}. [${s.title}](${s.url})\n`;
    });
    return text;
  }

  private async maybeResearch(
    mode: Mode,
    history: Array<{ role: string; content?: any }>,
  ): Promise<GeminiSource[]> {
    if (mode !== 'research') return [];
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const query = textOf(lastUser?.content).trim();
    if (!query) return [];
    const results = await this.searchWeb(query);
    // Batasi jumlah + panjang sumber: isi penuh hasil search bisa ribuan token.
    return results.slice(0, RESEARCH_SOURCE_LIMIT).map((s) => ({
      ...s,
      content: s.content ? truncateForLlm(s.content, RESEARCH_CHARS_PER_SOURCE) : s.content,
    }));
  }

  private normalizeMode(mode?: string): Mode {
    return mode && VALID_MODES.has(mode) ? (mode as Mode) : 'general';
  }

  private cleanHistory(
    messages: Array<{ role: string; content?: any }>,
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: any }> {
    return messages
      .map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content ?? '',
      }))
      // Pertahankan part gambar multimodal; buang pesan kosong (string/array).
      .filter((m) =>
        Array.isArray(m.content) ? m.content.length > 0 : m.content.length > 0,
      );
  }

  private buildSystemPrompt(
    memories: GeminiMemoryItem[],
    sources: GeminiSource[],
    validatedMode: Mode,
  ): string {
    let prompt = PERSONA;
    prompt += `\n\n${MODE_INSTRUCTIONS[validatedMode]}`;
    prompt += `\n\n${OUTPUT_FORMATTING}`;

    if (memories.length > 0) {
      prompt += '\n\nMemori user (gunakan untuk personalisasi, jangan dibocorkan):\n';
      for (const memory of memories) {
        prompt += `- ${(memory.type || 'note').toUpperCase()}: ${memory.content}\n`;
      }
    }

    if (sources.length > 0) {
      prompt +=
        '\n\nRiset web — hasil pencarian nyata yang sudah dijalankan untuk pesan ini. ' +
        'Jawab HANYA berdasarkan bahan ini, jangan mengarang fakta atau sumber tambahan, ' +
        'dan tunjukkan kutipan dengan nomor [1], [2], dan seterusnya:\n\n';
      sources.forEach((source, index) => {
        prompt += `[${index + 1}] ${source.title} — ${source.url}\n${
          source.content ?? ''
        }\n\n`;
      });
    } else {
      prompt +=
        '\n\nJawab dari pengetahuanmu. Jangan mengarang fakta, statistik, atau tautan sumber.';
    }

    return prompt.trim();
  }

  private static describe(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /** Translate upstream API failures into short, user-facing Indonesian messages. */
  private static friendlyError(error: any, provider: LlmProvider = 'gemini'): string {
    const status = error?.status;
    const raw = typeof error?.message === 'string' ? error.message : String(error);
    const name = provider === 'groq' ? 'Groq' : 'Gemini';

    if (status === 429 || /quota|RESOURCE_EXHAUSTED|rate_limit|rate limit/i.test(raw)) {
      return provider === 'groq'
        ? 'Kuota/rate-limit Groq habis. Tunggu sebentar lalu coba lagi, atau ganti ke model Gemini.'
        : 'Kuota AI harian sudah habis. Coba lagi nanti atau aktifkan billing di Google AI Studio.';
    }
    if (status === 401 || status === 403 || /api key|UNAUTHENTICATED|invalid authentication|invalid_api_key/i.test(raw)) {
      return provider === 'groq'
        ? 'Konfigurasi API key Groq bermasalah. Periksa GROQ_API_KEY di file .env.'
        : 'Konfigurasi API key Gemini bermasalah. Periksa GEMINI_API_KEY.';
    }
    if (status === 404 || /model_not_found|does not exist|not found/i.test(raw)) {
      return `Model tidak ditemukan di ${name}. Pilih model lain dari daftar.`;
    }
    if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(raw)) {
      return 'Model AI sedang sibuk. Coba lagi sebentar lagi.';
    }
    return `Gagal menghubungi AI ${name} (${status ?? 'error'}). Coba lagi sebentar lagi.`;
  }
}
