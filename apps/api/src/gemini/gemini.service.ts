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

export interface GeminiStreamHooks {
  /** Dipanggil tepat saat fase pencarian/reading benar-benar terjadi (research mode). */
  onPhase?: (phase: 'searching' | 'reading') => void;
  /** Diisi daftar sumber web riil yang dipakai turn ini (untuk event `done`). */
  sources?: GeminiSource[];
}

/** URL http(s) valid saja yang boleh diteruskan ke frontend sebagai sumber. */
function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Normalisasi URL untuk deduplikasi (lowercase + tanpa trailing slash). */
function normalizeUrl(value: string): string {
  const t = value.trim();
  try {
    const u = new URL(t);
    u.hash = '';
    const s = u.toString().replace(/\/$/, '');
    return s.toLowerCase();
  } catch {
    return t.toLowerCase();
  }
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

/** OpenRouter's OpenAI-compatible surface: `.../api/v1/chat/completions`. */
const DEFAULT_OR_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OR_MODEL = 'moonshotai/kimi-k2.7-code';

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

/** Host dari URL (fallback judul bila adapter tidak memberi title). */
function hostOf(value: string): string {
  try {
    return new URL(value.trim()).hostname.replace(/^www\./, '') || value.trim();
  } catch {
    return value.trim();
  }
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

export type LlmProvider = 'gemini' | 'groq' | 'openrouter';

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
  {
    id: 'moonshotai/kimi-k2.7-code',
    label: 'Kimi K2.7 Code (OR)',
    provider: 'openrouter',
    description: 'Agentic coding flagship, great for long tasks',
  },
  {
    id: 'qwen/qwen3-coder-plus',
    label: 'Qwen3 Coder Plus (OR)',
    provider: 'openrouter',
    description: 'Strong coder, 1M context via OpenRouter',
  },
  {
    id: 'deepseek/deepseek-chat',
    label: 'DeepSeek Chat (OR)',
    provider: 'openrouter',
    description: 'Cheap & smart all-rounder',
  },
  {
    id: 'x-ai/grok-code-fast-1',
    label: 'Grok Code Fast (OR)',
    provider: 'openrouter',
    description: 'Very fast & cheap for code',
  },
  {
    id: 'anthropic/claude-sonnet-5',
    label: 'Claude Sonnet 5 (OR)',
    provider: 'openrouter',
    description: 'Best coding quality (paid, pricey)',
  },
];

const PERSONA =
  'You are BroAgent, a friendly and helpful personal AI assistant. ' +
  'Answer style: natural, warm, helpful, clear, not overly formal, not overly long, ' +
  'and do not always use bullet formatting when it is not needed.';

export const DEFAULT_LANGUAGE = 'en';

/** Bahasa yang didukung BroAgent (UI + jawaban AI). Default: English. */
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'id', 'ru', 'zh', 'ja', 'ko'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  ar: 'Arabic (العربية)',
  id: 'Indonesian (Bahasa Indonesia)',
  ru: 'Russian (Русский)',
  zh: 'Chinese Simplified (简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
};

/** Normalisasi kode bahasa apa pun menjadi salah satu yang didukung (fallback: en). */
export function normalizeLanguage(value: unknown): AppLanguage {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE as AppLanguage;
  const v = value.trim().toLowerCase();
  // Terima varian umum: en-US -> en, zh-CN -> zh, id-ID -> id, dll.
  const base = v.split(/[-_]/)[0];
  const map: Record<string, AppLanguage> = {
    en: 'en',
    english: 'en',
    ar: 'ar',
    arabic: 'ar',
    arab: 'ar',
    id: 'id',
    in: 'id',
    indonesia: 'id',
    indonesian: 'id',
    ru: 'ru',
    russian: 'ru',
    rusia: 'ru',
    zh: 'zh',
    cn: 'zh',
    chinese: 'zh',
    china: 'zh',
    mandarin: 'zh',
    ja: 'ja',
    jp: 'ja',
    japan: 'ja',
    japanese: 'ja',
    ko: 'ko',
    kr: 'ko',
    korean: 'ko',
    korea: 'ko',
  };
  return map[v] || map[base || ''] || (DEFAULT_LANGUAGE as AppLanguage);
}

const PREFERRED_LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  ar: 'Modern Standard Arabic',
  id: 'Bahasa Indonesia',
  ru: 'Russian',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  ko: 'Korean',
};

/** Untuk apa user memakai BroAgent (dipilih saat onboarding, bisa diubah di Settings). */
export const SUPPORTED_PURPOSES = [
  'work',
  'study',
  'personal',
  'developer',
  'creator',
  'research',
] as const;
export type AppPurpose = (typeof SUPPORTED_PURPOSES)[number];

/** Normalisasi input apa pun menjadi purpose valid, atau null (netral) bila tak dikenal. */
export function normalizePurpose(value: unknown): AppPurpose | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  const map: Record<string, AppPurpose> = {
    work: 'work', kerja: 'work', pekerjaan: 'work', career: 'work', karier: 'work', karir: 'work',
    business: 'work', bisnis: 'work', job: 'work',
    study: 'study', pelajar: 'study', student: 'study', belajar: 'study',
    sekolah: 'study', school: 'study', kuliah: 'study', college: 'study',
    personal: 'personal', pribadi: 'personal', daily: 'personal', harian: 'personal',
    casual: 'personal', santai: 'personal',
    developer: 'developer', dev: 'developer',
    programmer: 'developer', ngoding: 'developer', coding: 'developer',
    creator: 'creator', kreator: 'creator', konten: 'creator', content: 'creator',
    influencer: 'creator',
    research: 'research', peneliti: 'research', riset: 'research',
    researcher: 'research',
  };
  return map[v] || null;
}

/** Mode chat default per purpose (dipakai saat pesan tanpa mode eksplisit). */
const PURPOSE_DEFAULT_MODES: Record<AppPurpose, Mode> = {
  work: 'assignment',
  study: 'learning',
  personal: 'general',
  developer: 'general',
  creator: 'brainstorm',
  research: 'research',
};

export function purposeDefaultMode(purpose: AppPurpose | null): Mode {
  return (purpose && PURPOSE_DEFAULT_MODES[purpose]) || 'general';
}

/** Lapisan gaya persona per purpose (selalu dalam English agar semua model paham). */
const PURPOSE_STYLES: Record<AppPurpose, string> = {
  work: 'The user mainly uses BroAgent for WORK: be concise, professional, and structured. Prioritize actionable next steps and skip small talk.',
  study: 'The user mainly uses BroAgent for STUDYING: act like a patient tutor. Explain step by step from the basics, use simple examples and analogies, and check understanding when relevant.',
  personal: 'The user mainly uses BroAgent for PERSONAL daily use: be warm, casual, and friendly, like a helpful everyday companion.',
  developer: 'The user mainly uses BroAgent for SOFTWARE DEVELOPMENT: be code-first. Give runnable code examples, mention the language/version when relevant, and keep a concise technical tone.',
  creator: 'The user mainly uses BroAgent for CONTENT CREATION: be idea-rich. Offer angles, hooks, and platform-appropriate variants, and help refine drafts.',
  research: 'The user mainly uses BroAgent for RESEARCH: be evidence-focused. Distinguish facts from interpretation, note uncertainties, and never invent sources.',
};

export function purposeStyle(purpose: AppPurpose | null): string | null {
  return (purpose && PURPOSE_STYLES[purpose]) || null;
}

/**
 * Bahasa pilihan user = DEFAULT. Tapi kalau pesan terakhir user jelas-jelas
 * ditulis dalam bahasa lain (mis. UI Jepang tapi prompt bahasa Inggris),
 * AI WAJIB ngikutin bahasa prompt tersebut — jawab seluruhnya dalam bahasa itu.
 * Hanya pindah bahasa kalau pilihan user ambigu/tidak jelas → tetap default.
 */
function languageInstruction(lang: AppLanguage): string {
  const pref = PREFERRED_LANGUAGE_NAMES[lang];
  return (
    `The user's preferred language is ${pref}. Respond in ${pref} by default. ` +
    `IMPORTANT: if the user's latest message is clearly written in a different language, ` +
    `mirror THAT language instead and answer entirely in it ` +
    `(for example, a message written in English gets a fully English answer even when the preferred language is ${pref}; ` +
    `a message written in Japanese gets a fully Japanese answer). ` +
    `Only switch languages when the user's choice is unambiguous; otherwise stay in ${pref}. ` +
    `Never mix two languages in one answer unless the user explicitly asks for it.`
  );
}

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

/** Deskripsi katalog model per bahasa UI (default English). */
const MODEL_DESCRIPTIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    'gemini-3.5-flash-lite': 'Fast & quota-friendly, great for daily chat',
    'gemini-2.5-flash': 'Smarter for reasoning & documents',
    'qwen/qwen3.8-27b': 'Versatile & multilingual via Groq',
    'openai/gpt-oss-120b': 'Flagship open-weight, reasoning + code',
    'openai/gpt-oss-20b': 'Light & fast (~1000 tps) via Groq',
    'moonshotai/kimi-k2.7-code': 'Agentic coding flagship, great for long tasks',
    'qwen/qwen3-coder-plus': 'Strong coder, 1M context via OpenRouter',
    'deepseek/deepseek-chat': 'Cheap & smart all-rounder',
    'x-ai/grok-code-fast-1': 'Very fast & cheap for code',
    'anthropic/claude-sonnet-5': 'Best coding quality (paid, pricey)',
  },
  id: {
    'gemini-3.5-flash-lite': 'Cepat & hemat kuota, cocok untuk chat harian',
    'gemini-2.5-flash': 'Lebih pintar untuk reasoning & dokumen',
    'qwen/qwen3.8-27b': 'Serbaguna & multibahasa via Groq',
    'openai/gpt-oss-120b': 'Open-weight flagship, bisa reasoning + code',
    'openai/gpt-oss-20b': 'Ringan & cepat (~1000 tps) via Groq',
    'moonshotai/kimi-k2.7-code': 'Coding agentic flagship, cocok tugas panjang',
    'qwen/qwen3-coder-plus': 'Coder kuat, konteks 1M via OpenRouter',
    'deepseek/deepseek-chat': 'Murah & pintar serbaguna',
    'x-ai/grok-code-fast-1': 'Sangat cepat & murah untuk kode',
    'anthropic/claude-sonnet-5': 'Kualitas coding terbaik (berbayar, mahal)',
  },
  ar: {
    'gemini-3.5-flash-lite': 'سريع وموفّر للحصة، مناسب للدردشة اليومية',
    'gemini-2.5-flash': 'أذكى للاستدلال والمستندات',
    'qwen/qwen3.8-27b': 'متعدد الاستخدامات ومتعدد اللغات عبر Groq',
    'openai/gpt-oss-120b': 'الأقوى مفتوح الأوزان، استدلال + برمجة',
    'openai/gpt-oss-20b': 'خفيف وسريع (~1000 رمز/ث) عبر Groq',
    'moonshotai/kimi-k2.7-code': 'رائدة البرمجة الوكيلية، ممتازة للمهام الطويلة',
    'qwen/qwen3-coder-plus': 'مبرمج قوي، سياق مليون عبر OpenRouter',
    'deepseek/deepseek-chat': 'رخيص وذكي متعدد الاستخدامات',
    'x-ai/grok-code-fast-1': 'سريع جداً ورخيص للبرمجة',
    'anthropic/claude-sonnet-5': 'أفضل جودة برمجة (مدفوع)',
  },
  ru: {
    'gemini-3.5-flash-lite': 'Быстрая и экономная, для ежедневного чата',
    'gemini-2.5-flash': 'Умнее для рассуждений и документов',
    'qwen/qwen3.8-27b': 'Универсальная и многоязычная via Groq',
    'openai/gpt-oss-120b': 'Флагман open-weight: рассуждения + код',
    'openai/gpt-oss-20b': 'Лёгкая и быстрая (~1000 ток/с) via Groq',
    'moonshotai/kimi-k2.7-code': 'Флагман агентного кодинга, для длинных задач',
    'qwen/qwen3-coder-plus': 'Сильный кодер, контекст 1M via OpenRouter',
    'deepseek/deepseek-chat': 'Дешёвый и умный универсал',
    'x-ai/grok-code-fast-1': 'Очень быстрый и дешёвый для кода',
    'anthropic/claude-sonnet-5': 'Лучшее качество кода (платно)',
  },
  zh: {
    'gemini-3.5-flash-lite': '快速省配额，适合日常聊天',
    'gemini-2.5-flash': '推理和文档更聪明',
    'qwen/qwen3.8-27b': '多功能多语言 (Groq)',
    'openai/gpt-oss-120b': '旗舰开源权重，推理 + 代码',
    'openai/gpt-oss-20b': '轻量快速 (~1000 tps, Groq)',
    'moonshotai/kimi-k2.7-code': 'Agentic 编程旗舰，适合长任务',
    'qwen/qwen3-coder-plus': '强力代码模型，1M 上下文',
    'deepseek/deepseek-chat': '便宜好用的全能模型',
    'x-ai/grok-code-fast-1': '写代码又快又便宜',
    'anthropic/claude-sonnet-5': '代码质量最佳 (付费较贵)',
  },
  ja: {
    'gemini-3.5-flash-lite': '高速・省 quota、日常チャットに最適',
    'gemini-2.5-flash': '推論・文書に強い',
    'qwen/qwen3.8-27b': '多機能・多言語 (Groq)',
    'openai/gpt-oss-120b': '旗艦オープンウェイト、推論 + コード',
    'openai/gpt-oss-20b': '軽量・高速 (~1000 tps, Groq)',
    'moonshotai/kimi-k2.7-code': 'エージェント型コーディングの旗艦、長期タスクに強い',
    'qwen/qwen3-coder-plus': '強力なコーダー、1Mコンテキスト',
    'deepseek/deepseek-chat': '安くて賢い万能モデル',
    'x-ai/grok-code-fast-1': '高速・格安なコード生成',
    'anthropic/claude-sonnet-5': '最高のコード品質 (有料)',
  },
  ko: {
    'gemini-3.5-flash-lite': '빠르고 할당량 절약, 일상 채팅에 최적',
    'gemini-2.5-flash': '추론과 문서에 더 스마트',
    'qwen/qwen3.8-27b': '다재다능·다국어 (Groq)',
    'openai/gpt-oss-120b': '플래그십 오픈 웨이트, 추론 + 코드',
    'openai/gpt-oss-20b': '가볍고 빠름 (~1000 tps, Groq)',
    'moonshotai/kimi-k2.7-code': '에이전트 코딩 플래그십, 긴 작업에 강함',
    'qwen/qwen3-coder-plus': '강력한 코더, 1M 컨텍스트',
    'deepseek/deepseek-chat': '싸고 똑똑한 만능 모델',
    'x-ai/grok-code-fast-1': '빠르고 저렴한 코드 생성',
    'anthropic/claude-sonnet-5': '최고 코드 품질 (유료)',
  },
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly openai: OpenAI;
  private readonly groq: OpenAI;
  private readonly openrouter: OpenAI;
  private readonly baseUrl: string;
  private readonly agentUrl: string;
  private readonly apiKey: string;
  private readonly groqBaseUrl: string;
  private readonly groqApiKey: string;
  private readonly orBaseUrl: string;
  private readonly orApiKey: string;
  readonly model: string;
  readonly groqModel: string;
  readonly orModel: string;

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
    this.orBaseUrl = (
      this.config.get<string>('OPENROUTER_BASE_URL') || DEFAULT_OR_BASE_URL
    ).replace(/\/+$/, '');
    this.orApiKey = this.config.get<string>('OPENROUTER_API_KEY')?.trim() || '';
    this.orModel =
      this.config.get<string>('OPENROUTER_MODEL')?.trim() || DEFAULT_OR_MODEL;

    if (!this.apiKey) {
      this.logger.error('GEMINI_API_KEY is empty. Chat requests will fail.');
    }
    if (!this.groqApiKey) {
      this.logger.warn('GROQ_API_KEY is empty. Groq models will be unavailable.');
    }
    if (!this.orApiKey) {
      this.logger.warn('OPENROUTER_API_KEY is empty. OpenRouter models will be unavailable.');
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

    this.openrouter = new OpenAI({
      baseURL: this.orBaseUrl,
      apiKey: this.orApiKey || 'openrouter-api-key-not-configured',
      timeout: Number(this.config.get<string>('OPENROUTER_TIMEOUT_MS') || 120_000),
      maxRetries: 0,
      defaultHeaders: {
        'HTTP-Referer': 'https://broagent.app',
        'X-Title': 'BroAgent',
      },
    });

    this.logger.log(`Gemini client ready (base=${this.baseUrl}, model=${this.model})`);
    this.logger.log(`Groq client ready (base=${this.groqBaseUrl}, model=${this.groqModel})`);
    this.logger.log(`OpenRouter client ready (base=${this.orBaseUrl}, model=${this.orModel})`);
  }

  /** True kalau provider punya API key di server. */
  private hasProviderKey(provider: LlmProvider): boolean {
    if (provider === 'groq') return Boolean(this.groqApiKey);
    if (provider === 'openrouter') return Boolean(this.orApiKey);
    return Boolean(this.apiKey);
  }

  /** HTTP client OpenAI-compatible per provider. */
  private clientFor(provider: LlmProvider): OpenAI {
    if (provider === 'groq') return this.groq;
    if (provider === 'openrouter') return this.openrouter;
    return this.openai;
  }

  /** Daftar model untuk dropdown frontend, lengkap dengan status ketersediaan key. */
  listModels(lang?: string): Array<LlmModelOption & { available: boolean }> {
    const L = normalizeLanguage(lang);
    const desc = MODEL_DESCRIPTIONS[L] || MODEL_DESCRIPTIONS.en!;
    return LLM_MODEL_CATALOG.map((m) => ({
      ...m,
      description: desc[m.id] || m.description,
      available: this.hasProviderKey(m.provider),
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
    const trimmed = requested.trim();
    // Keluarga model yang jelas milik OpenRouter (tidak ada di Groq).
    if (/^(moonshotai\/|x-ai\/|anthropic\/|z-ai\/)/i.test(trimmed) && this.orApiKey) {
      return { provider: 'openrouter', model: trimmed };
    }
    // Izinkan custom model ID: anggap Groq jika diawali prefix Groq yang dikenal.
    if (/^(llama|qwen|openai\/|mixtral|gemma|deepseek)/i.test(trimmed)) {
      return { provider: 'groq', model: trimmed };
    }
    if (/^gemini/i.test(trimmed)) {
      return { provider: 'gemini', model: trimmed };
    }
    // ID gaya "org/model" lainnya → OpenRouter bila key tersedia.
    if (trimmed.includes('/') && this.orApiKey) {
      return { provider: 'openrouter', model: trimmed };
    }
    return fallback;
  }

  /** True untuk error kuota/rate-limit/sibuk/kredit — layak dicoba ke model lain. */
  private static isCapacityError(error: any): boolean {
    const status = error?.status;
    if (status === 429 || status === 503 || status === 402) return true;
    const raw = typeof error?.message === 'string' ? error.message : String(error);
    return /quota|insufficient_credit|RESOURCE_EXHAUSTED|rate_limit|rate limit|overloaded|UNAVAILABLE/i.test(raw);
  }

  /**
   * Urutan model pengganti saat model utama kena limit: Groq dulu (gratis),
   * lalu OpenRouter, terakhir Gemini — kecuali `onlyProvider` diisi
   * (mis. vision → sesama Gemini). Hanya model yang API key-nya tersedia.
   */
  private static readonly PROVIDER_FALLBACK_ORDER: Record<LlmProvider, number> = {
    groq: 0,
    openrouter: 1,
    gemini: 2,
  };

  private fallbackChain(failedModel: string, onlyProvider?: LlmProvider): string[] {
    const failed = (failedModel || '').trim();
    const order = GeminiService.PROVIDER_FALLBACK_ORDER;
    return LLM_MODEL_CATALOG.filter(
      (m) =>
        m.id !== failed &&
        (!onlyProvider || m.provider === onlyProvider) &&
        this.hasProviderKey(m.provider),
    )
      .sort((a, b) => order[a.provider] - order[b.provider])
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
      return 'All AI models are currently rate-limited. Please wait a moment and try again.';
    }
    return GeminiService.friendlyError(error, provider);
  }

  async checkHealth(): Promise<GeminiHealth & { groq?: GeminiHealth; openrouter?: GeminiHealth; models?: Array<LlmModelOption & { available: boolean }> }> {
    const health: GeminiHealth & { groq?: GeminiHealth; openrouter?: GeminiHealth; models?: Array<LlmModelOption & { available: boolean }> } = {
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

    // OpenRouter health (tidak menggagalkan health utama jika belum dikonfigurasi)
    const orHealth: GeminiHealth = {
      reachable: false,
      baseUrl: this.orBaseUrl,
      model: this.orModel,
    };
    if (!this.orApiKey) {
      orHealth.error = 'OPENROUTER_API_KEY is not configured';
    } else {
      try {
        const res = await fetch(`${this.orBaseUrl}/models`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
          orHealth.error = `OpenRouter /models returned HTTP ${res.status}`;
        } else {
          orHealth.reachable = true;
        }
      } catch (error) {
        orHealth.error = `OpenRouter unreachable: ${GeminiService.describe(error)}`;
      }
    }
    health.openrouter = orHealth;
    health.models = this.listModels();
    return health;
  }

  /** Single non-streaming turn. Used by the voice worker and the REST fallback. */
  async chat(
    messages: Array<{ role: string; content?: any }>,
    memories: GeminiMemoryItem[] = [],
    mode?: string,
    requestedModel?: string,
    language?: string,
    purpose?: string | null,
  ): Promise<GeminiChatResult> {
    const validatedPurpose = normalizePurpose(purpose);
    const validatedMode = this.normalizeMode(mode, validatedPurpose);
    const validatedLang = normalizeLanguage(language);
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
    const systemPrompt = this.buildSystemPrompt(memories, sources, validatedMode, validatedLang, validatedPurpose);

    let lastError: any = null;
    let lastProvider: LlmProvider = first.provider;
    for (let i = 0; i < attempts.length; i += 1) {
      const { provider, model } = this.resolveModel(attempts[i]);
      lastProvider = provider;
      const client = this.clientFor(provider);
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
          response: content || 'Sorry, I cannot respond right now.',
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
    language?: string,
    purpose?: string | null,
    hooks?: GeminiStreamHooks,
  ): AsyncGenerator<string> {
    const validatedPurpose = normalizePurpose(purpose);
    const validatedMode = this.normalizeMode(mode, validatedPurpose);
    const validatedLang = normalizeLanguage(language);
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

    const sources = await this.maybeResearch(validatedMode, history, hooks?.onPhase);
    if (hooks) hooks.sources = sources;
    const systemPrompt = this.buildSystemPrompt(memories, sources, validatedMode, validatedLang, validatedPurpose);

    let lastError: any = null;
    let lastProvider: LlmProvider = first.provider;
    for (let i = 0; i < attempts.length; i += 1) {
      const { provider, model } = this.resolveModel(attempts[i]);
      lastProvider = provider;
      const client = this.clientFor(provider);
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
        'A Groq model was selected but GROQ_API_KEY is missing. Add GROQ_API_KEY to .env or choose another model.',
      );
    }
    if (provider === 'openrouter' && !this.orApiKey) {
      throw new Error(
        'An OpenRouter model was selected but OPENROUTER_API_KEY is missing. Add OPENROUTER_API_KEY to .env or choose another model.',
      );
    }
    if (provider === 'gemini' && !this.apiKey) {
      throw new Error(
        'A Gemini model was selected but GEMINI_API_KEY is missing. Check GEMINI_API_KEY.',
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
      const seen = new Set<string>();
      const clean: GeminiSource[] = [];
      for (const s of payload.results ?? []) {
        if (!s || !isHttpUrl(s.url)) continue;
        const key = normalizeUrl(s.url);
        if (seen.has(key)) continue;
        seen.add(key);
        clean.push({ title: (s.title || '').trim() || hostOf(s.url), url: s.url.trim(), content: s.content });
      }
      return clean;
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
    onPhase?: (phase: 'searching' | 'reading') => void,
  ): Promise<GeminiSource[]> {
    if (mode !== 'research') return [];
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const query = textOf(lastUser?.content).trim();
    if (!query) return [];
    // Fase pencarian web riil dimulai — hanya di sini status "searching" boleh diklaim.
    onPhase?.('searching');
    const results = await this.searchWeb(query);
    if (results.length > 0) onPhase?.('reading');
    // Batasi jumlah + panjang sumber: isi penuh hasil search bisa ribuan token.
    return results.slice(0, RESEARCH_SOURCE_LIMIT).map((s) => ({
      ...s,
      content: s.content ? truncateForLlm(s.content, RESEARCH_CHARS_PER_SOURCE) : s.content,
    }));
  }

  private normalizeMode(mode?: string, purpose?: AppPurpose | null): Mode {
    if (mode && VALID_MODES.has(mode)) return mode as Mode;
    if (purpose) return purposeDefaultMode(purpose);
    return 'general';
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
    language: AppLanguage = 'en',
    purpose: AppPurpose | null = null,
  ): string {
    let prompt = PERSONA;
    prompt += `\n\n[LANGUAGE: ${LANGUAGE_NAMES[language]}]\n${languageInstruction(language)} Keep this rule for the entire answer unless the user explicitly asks for another language.`;
    const style = purposeStyle(purpose);
    if (style) prompt += `\n\n[USER PURPOSE]\n${style}`;
    prompt += `\n\n${MODE_INSTRUCTIONS[validatedMode]}`;
    prompt += `\n\n${OUTPUT_FORMATTING}`;

    if (memories.length > 0) {
      prompt += '\n\nUser memories (use for personalization, do not leak them):\n';
      for (const memory of memories) {
        prompt += `- ${(memory.type || 'note').toUpperCase()}: ${memory.content}\n`;
      }
    }

    if (sources.length > 0) {
      prompt +=
        '\n\nWeb research — real search results already run for this message. ' +
        'Answer ONLY from this material, do not invent facts or extra sources, ' +
        'and cite with numbers [1], [2], etc.:\n\n';
      sources.forEach((source, index) => {
        prompt += `[${index + 1}] ${source.title} — ${source.url}\n${
          source.content ?? ''
        }\n\n`;
      });
    } else {
      prompt +=
        '\n\nAnswer from your knowledge. Do not invent facts, statistics, or source links.';
    }

    return prompt.trim();
  }

  private static describe(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /** Translate upstream API failures into short, user-facing English messages (default language). */
  private static friendlyError(error: any, provider: LlmProvider = 'gemini'): string {
    const status = error?.status;
    const raw = typeof error?.message === 'string' ? error.message : String(error);
    const name = provider === 'groq' ? 'Groq' : provider === 'openrouter' ? 'OpenRouter' : 'Gemini';

    if (status === 402 || /insufficient_credit|insufficient credits|credit.*exhausted/i.test(raw)) {
      return 'OpenRouter credit is empty. Top up credit at openrouter.ai/credits or switch to a free model.';
    }
    if (status === 429 || /quota|RESOURCE_EXHAUSTED|rate_limit|rate limit/i.test(raw)) {
      if (provider === 'groq') {
        return 'Groq quota/rate-limit exceeded. Wait a moment and try again, or switch to another model.';
      }
      if (provider === 'openrouter') {
        return 'OpenRouter rate-limit exceeded. Wait a moment and try again, or switch to another model.';
      }
      return 'Daily AI quota exceeded. Try again later or enable billing in Google AI Studio.';
    }
    if (status === 401 || status === 403 || /api key|UNAUTHENTICATED|invalid authentication|invalid_api_key/i.test(raw)) {
      if (provider === 'groq') {
        return 'Groq API key misconfigured. Check GROQ_API_KEY in the .env file.';
      }
      if (provider === 'openrouter') {
        return 'OpenRouter API key misconfigured. Check OPENROUTER_API_KEY in the .env file.';
      }
      return 'Gemini API key misconfigured. Check GEMINI_API_KEY.';
    }
    if (status === 404 || /model_not_found|does not exist|not found/i.test(raw)) {
      return `Model not found on ${name}. Please choose another model from the list.`;
    }
    if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(raw)) {
      return 'The AI model is busy. Please try again in a moment.';
    }
    return `Failed to reach ${name} AI (${status ?? 'error'}). Please try again in a moment.`;
  }
}
