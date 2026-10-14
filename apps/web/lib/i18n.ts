'use client';

// ── BroAgent i18n — default English, 7 languages ─────────────────────
// en (default), ar, id, ru, zh, ja, ko
// One setting controls BOTH UI language and AI answer language.

export const DEFAULT_LANG = 'en' as const;

export type AppLang = 'en' | 'ar' | 'id' | 'ru' | 'zh' | 'ja' | 'ko';

export const SUPPORTED_LANGUAGES: Array<{
  code: AppLang;
  label: string;
  native: string;
  flag: string;
  dir: 'ltr' | 'rtl';
  stt: string;
}> = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧', dir: 'ltr', stt: 'en-US' },
  { code: 'ar', label: 'Arabic', native: 'العربية', flag: '🇸🇦', dir: 'rtl', stt: 'ar-SA' },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩', dir: 'ltr', stt: 'id-ID' },
  { code: 'ru', label: 'Russian', native: 'Русский', flag: '🇷🇺', dir: 'ltr', stt: 'ru-RU' },
  { code: 'zh', label: 'Chinese', native: '简体中文', flag: '🇨🇳', dir: 'ltr', stt: 'zh-CN' },
  { code: 'ja', label: 'Japanese', native: '日本語', flag: '🇯🇵', dir: 'ltr', stt: 'ja-JP' },
  { code: 'ko', label: 'Korean', native: '한국어', flag: '🇰🇷', dir: 'ltr', stt: 'ko-KR' },
];

export const LANG_STORAGE_KEY = 'bro-lang';

export function normalizeLang(value: unknown): AppLang {
  if (typeof value !== 'string') return DEFAULT_LANG;
  const v = value.trim().toLowerCase();
  const base = v.split(/[-_]/)[0] || '';
  const map: Record<string, AppLang> = {
    en: 'en', english: 'en',
    ar: 'ar', arabic: 'ar', arab: 'ar',
    id: 'id', in: 'id', indonesia: 'id', indonesian: 'id',
    ru: 'ru', russian: 'ru', rusia: 'ru',
    zh: 'zh', cn: 'zh', chinese: 'zh', china: 'zh', mandarin: 'zh',
    ja: 'ja', jp: 'ja', japan: 'ja', japanese: 'ja',
    ko: 'ko', kr: 'ko', korean: 'ko', korea: 'ko',
  };
  return map[v] || map[base] || DEFAULT_LANG;
}

export function isRtl(lang: AppLang): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.dir === 'rtl';
}

export function sttForLang(lang: AppLang): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.stt || 'en-US';
}

export function applyLangToDocument(lang: AppLang) {
  if (typeof document === 'undefined') return;
  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = meta?.dir || 'ltr';
}

export function getStoredLang(): AppLang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    return normalizeLang(localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

export function setStoredLang(lang: AppLang) {
  const code = normalizeLang(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, code);
    // Keep voice-to-text in sync when user hasn't customized it separately.
    try {
      localStorage.setItem('bro-stt-lang', sttForLang(code));
    } catch { /* ignore */ }
  } catch { /* ignore */ }
  applyLangToDocument(code);
  try {
    window.dispatchEvent(new CustomEvent('bro-lang-changed', { detail: code }));
  } catch { /* ignore */ }
  return code;
}

// ── Purpose (what is BroAgent for?) ───────────────────────────────────
// work / study / personal / developer / creator / research

export type AppPurpose = 'work' | 'study' | 'personal' | 'developer' | 'creator' | 'research';

export const SUPPORTED_PURPOSES: Array<{
  code: AppPurpose;
  /** Default chat mode for this purpose. */
  mode: string;
}> = [
  { code: 'work', mode: 'assignment' },
  { code: 'study', mode: 'learning' },
  { code: 'personal', mode: 'general' },
  { code: 'developer', mode: 'general' },
  { code: 'creator', mode: 'brainstorm' },
  { code: 'research', mode: 'research' },
];

export const PURPOSE_STORAGE_KEY = 'bro-purpose';
export const LANG_PICKED_KEY = 'bro-lang-picked';

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

export function purposeDefaultMode(purpose: AppPurpose | null): string {
  return SUPPORTED_PURPOSES.find((p) => p.code === purpose)?.mode || 'general';
}

export function getStoredPurpose(): AppPurpose | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizePurpose(localStorage.getItem(PURPOSE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setStoredPurpose(purpose: AppPurpose | null) {
  try {
    if (purpose) localStorage.setItem(PURPOSE_STORAGE_KEY, purpose);
    else localStorage.removeItem(PURPOSE_STORAGE_KEY);
  } catch { /* ignore */ }
}

export function isLangPicked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LANG_PICKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLangPicked() {
  try {
    localStorage.setItem(LANG_PICKED_KEY, '1');
  } catch { /* ignore */ }
}

/**
 * Adopsi bahasa dari server HANYA bila user belum pernah milih eksplisit
 * di browser ini. Kalau sudah picked, lokal yang menang (server disembuhkan
 * di titik save berikutnya). Ini yang mencegah "balik ke default".
 */
export function syncLangFromServer(serverLang: unknown): AppLang {
  if (isLangPicked()) return getStoredLang();
  const code = normalizeLang(serverLang);
  setStoredLang(code);
  return code;
}

export function clearOnboardingFlags() {
  try {
    localStorage.removeItem(LANG_PICKED_KEY);
    localStorage.removeItem('bro-onboarded');
    localStorage.removeItem(PURPOSE_STORAGE_KEY);
  } catch { /* ignore */ }
}

// ── UI strings ──────────────────────────────────────────────────────
// Keep keys stable; English is the source of truth.

type Dict = Record<string, string>;

const en: Dict = {
  'app.tagline': 'Your Personal AI Assistant',
  'app.description': 'Think, learn, research, create, and get things done with one AI assistant.',
  'app.subtag': 'One assistant. Multiple capabilities. One continuous conversation.',
  'app.start': 'Start Chatting',
  'app.explore': 'Explore Capabilities',
  'app.capabilities': 'Capabilities',
  'skill.support.desc': 'Talk things through and get guidance',
  'skill.research.desc': 'Explore topics and find useful information',
  'skill.brainstorm.desc': 'Generate ideas and explore possibilities',
  'skill.learning.desc': 'Understand new concepts step by step',
  'skill.assignment.desc': 'Break down tasks and work through them',
  'skill.document.desc': 'Review and understand documents',

  'auth.create': 'Create Account',
  'auth.welcome': 'Welcome Back',
  'auth.name': 'Name',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.register': 'Register',
  'auth.login': 'Login',
  'auth.loggingIn': 'Logging in...',
  'auth.registering': 'Creating account...',
  'auth.already': 'Already have an account?',
  'auth.donthave': "Don't have an account?",
  'auth.namePh': 'Your name',
  'auth.passwordPh': 'Your password',
  'auth.newPasswordPh': 'Min. 6 characters',
  'auth.showPw': 'Show password',
  'auth.hidePw': 'Hide password',
  'auth.backHome': 'Back to home',

  'lang.chooseTitle': 'Choose your language',
  'lang.chooseDesc': 'Pick the language for the app and AI answers. You can change it anytime in Settings.',
  'lang.continue': 'Continue',
  'lang.saving': 'Saving...',
  'lang.skip': 'Skip for now',
  'lang.label': 'Language',
  'lang.appAndAi': 'App & AI answer language',

  'purpose.title': 'What will you use BroAgent for?',
  'purpose.desc': 'Pick what fits you best. BroAgent will adjust its style and default mode. You can change this anytime in Settings.',
  'purpose.work': 'Work',
  'purpose.workDesc': 'Tasks, emails, reports, and getting things done',
  'purpose.study': 'Study',
  'purpose.studyDesc': 'Lessons, homework, exams, and understanding concepts',
  'purpose.personal': 'Personal',
  'purpose.personalDesc': 'Daily companion for chatting and everyday help',
  'purpose.developer': 'Developer',
  'purpose.developerDesc': 'Coding, debugging, and building software',
  'purpose.creator': 'Creator',
  'purpose.creatorDesc': 'Content ideas, scripts, hooks, and drafts',
  'purpose.research': 'Research',
  'purpose.researchDesc': 'Deep dives, evidence, and exploring topics',
  'settings.purpose': 'I mainly use BroAgent for',

  'chat.emptyTitle': 'What can I help with?',
  'chat.emptySub': 'Your personal AI assistant for thinking, learning, and creating.',
  'chat.placeholder': 'Type a message...',
  'chat.listening': 'Listening... just speak, it becomes text',
  'chat.recording': 'Recording... click mic again to stop',
  'chat.newChat': 'New Chat',
  'chat.recent': 'Recent',
  'chat.loginToSave': 'Login to save your conversations',
  'chat.online': 'Online',
  'chat.selectModel': 'Choose AI model',
  'chat.guest': 'Guest User',
  'chat.settings': 'Settings',
  'chat.noLimit': 'No, thanks',
  'status.thinking': 'Thinking…',
  'status.searching': 'Searching the web…',
  'status.reading': 'Reading sources…',
  'status.generating': 'Generating response…',
  'sources.title': 'Sources',
  'chat.limitMoved': 'Limit — moved to',
  'chat.limitOut': 'LIMIT — quota exhausted',

  'mode.general': 'General',
  'mode.learning': 'Learning',
  'mode.research': 'Research',
  'mode.brainstorm': 'Brainstorm',
  'mode.support': 'Support',
  'mode.assignment': 'Assignment',

  'settings.title': 'Settings',
  'settings.profile': 'Profile',
  'settings.chatPrefs': 'Chat preferences',
  'settings.modelDefault': 'Default model',
  'settings.modeDefault': 'Default mode',
  'settings.stt': 'Voice-to-text language',
  'settings.close': 'Close',
  'settings.savedInBrowser': 'Preferences are saved in this browser and apply to your next chats.',

  'mode.document': 'Document',

  'chat.loading': 'Loading...',
  'chat.loadFail': 'Failed to load conversation (HTTP {status}). Click again.',
  'chat.loadFailGeneric': 'Failed to load conversation.',
  'chat.modelUnavailable': 'API key not set on server',
  'chat.groqNote': 'Groq needs GROQ_API_KEY in the server .env.',
  'chat.limitOutTitle': 'Model quota exhausted. Try again later, switch models, or check Settings → Quota & limits.',
  'chat.limitFallbackTitle': 'Your chosen model hit a limit, so another model answered automatically.',

  'settings.loading': 'Loading...',
  'settings.avatar': 'Avatar color',
  'settings.joined': 'Joined',
  'settings.conversations': 'Conversations',
  'settings.messages': 'Messages',
  'settings.daysActive': 'Active days',
  'settings.editName': 'Edit name',
  'settings.copyEmail': 'Copy email',
  'settings.nameEmpty': 'Name must not be empty.',
  'settings.nameSaved': 'Name saved.',
  'settings.changePw': 'Change password',
  'settings.currentPw': 'Current password',
  'settings.newPw': 'New password (min. 6 characters)',
  'settings.repeatPw': 'Repeat new password',
  'settings.savePw': 'Save password',
  'settings.pwFillAll': 'Fill in all password fields.',
  'settings.pwMismatch': 'Password confirmation does not match.',
  'settings.pwSaved': 'Password changed.',
  'settings.danger': 'Danger zone',
  'settings.wipe': 'Delete all conversations',
  'settings.wipeConfirm': 'Sure? Click again to delete ALL conversations',
  'settings.delAccount': 'Delete account',
  'settings.delAccountConfirm': 'Sure? Click again — account + data gone permanently',
  'settings.wipeFail': 'Failed to delete history. Try again.',
  'settings.delFail': 'Failed to delete account.',
  'settings.guestTitle': 'Guest User',
  'settings.guestDesc': 'Login so your chats are saved permanently',
  'settings.logout': 'Logout',
  'settings.quota': 'Quota & limits',
  'settings.quotaGroq': 'Free: 30 req/min • 1,000 req/day • 200K tokens/day',
  'settings.quotaGemini': 'Follows Google AI Studio limits (check dashboard)',
  'settings.quotaNote': 'Hit a limit → BroAgent auto-switches to another model and shows a LIMIT badge in the chat header. The small “via …” label under a reply shows which model answered.',
  'settings.keyMissing': 'key missing',
  'settings.defaultBadge': 'default',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',

  'attach.title': 'Attach',
  'attach.photo': 'Photos & Gallery',
  'attach.photoDesc': 'Pick existing photos',
  'attach.camera': 'Camera',
  'attach.cameraDesc': 'Take a photo now',
  'attach.doc': 'Text document',
  'attach.docDesc': '.txt .md .csv .json code',
  'attach.preparing': 'Preparing attachments...',
  'attach.remove': 'Remove attachment',
  'attach.openTitle': 'Attach (photo, camera, document)',
  'mic.titleOn': 'Speak to text',
  'mic.titleOff': 'Voice-to-text not supported in this browser',
  'mic.unsupported': 'This browser does not support voice-to-text. Try Chrome/Edge desktop.',
  'mic.denied': 'Mic permission denied. Click the lock icon in the address bar and allow microphone.',
  'mic.noSpeech': 'No speech heard. Try speaking closer to the mic.',
  'mic.noMic': 'No mic found. Make sure a microphone is connected.',
  'mic.failed': 'Voice-to-text failed. Try again.',
  'mic.startFail': 'Could not start mic. Try again.',

  'attachErr.tooManyImages': 'Max {n} images per message.',
  'attachErr.imageTooBig': '"{name}" is too big (max 10MB).',
  'attachErr.unreadable': '"{name}" could not be read (e.g. iPhone HEIC format). Try JPG/PNG or re-screenshot.',
  'attachErr.textTooBig': '"{name}" is too big for a text file (max 512KB).',
  'attachErr.emptyFile': '"{name}" is empty.',
  'attachErr.readFail': 'Failed to read "{name}".',
  'attachErr.videoNo': 'Video is not supported yet. Send images or text only.',
  'attachErr.officeNo': '"{name}" ({ext}) is not supported yet. Screenshot it as an image or convert to .txt first.',
  'attachErr.formatNo': '"{name}" format is not supported. You can send images (JPG/PNG) or text files.',

  'bubble.document': 'Document',
  'bubble.edit': 'Edit',
  'bubble.regenerate': 'Regenerate',
  'bubble.save': 'Save',
  'bubble.sendRevision': 'Send revision',
  'bubble.cancel': 'Cancel',
  'bubble.saveNote': 'Save only changes this session’s view. Send revision asks the AI to develop a new version.',
  'bubble.savedFlash': 'Changes saved in this view',
  'bubble.revisePrefix': 'Please fix and expand the following document:',

  'copy.label': 'Copy',
  'copy.done': 'Copied',
  'copy.fail': 'Failed',
  'copy.failTitle': 'Copy failed',

  'table.name': 'Table',
  'table.cols': 'columns',
  'table.rows': 'rows',
  'table.empty': '(empty table)',
  'table.copyTsv': 'Copy TSV',
  'code.name': 'code',
  'doc.fallbackTitle': 'AI answer',
};

const id: Dict = {
  'app.tagline': 'Asisten AI Pribadimu',
  'app.description': 'Berpikir, belajar, riset, berkreasi, dan selesaikan banyak hal dengan satu asisten AI.',
  'app.subtag': 'Satu asisten. Banyak kemampuan. Satu percakapan yang nyambung.',
  'app.start': 'Mulai Chat',
  'app.explore': 'Jelajahi Kemampuan',
  'app.capabilities': 'Kemampuan',
  'skill.support.desc': 'Cerita dan dapatkan arahan',
  'skill.research.desc': 'Jelajahi topik dan temukan info berguna',
  'skill.brainstorm.desc': 'Hasilkan ide dan jelajahi kemungkinan',
  'skill.learning.desc': 'Pahami konsep baru langkah demi langkah',
  'skill.assignment.desc': 'Uraikan tugas dan kerjakan bersama',
  'skill.document.desc': 'Tinjau dan pahami dokumen',

  'auth.create': 'Buat Akun',
  'auth.welcome': 'Selamat Datang Kembali',
  'auth.name': 'Nama',
  'auth.email': 'Email',
  'auth.password': 'Kata sandi',
  'auth.register': 'Daftar',
  'auth.login': 'Masuk',
  'auth.loggingIn': 'Masuk...',
  'auth.registering': 'Membuat akun...',
  'auth.already': 'Sudah punya akun?',
  'auth.donthave': 'Belum punya akun?',
  'auth.namePh': 'Nama kamu',
  'auth.passwordPh': 'Kata sandimu',
  'auth.newPasswordPh': 'Min. 6 karakter',
  'auth.showPw': 'Tampilkan password',
  'auth.hidePw': 'Sembunyikan password',
  'auth.backHome': 'Kembali ke beranda',

  'lang.chooseTitle': 'Pilih bahasamu',
  'lang.chooseDesc': 'Pilih bahasa untuk aplikasi dan jawaban AI. Bisa diganti kapan saja di Pengaturan.',
  'lang.continue': 'Lanjutkan',
  'lang.saving': 'Menyimpan...',
  'lang.skip': 'Lewati dulu',
  'lang.label': 'Bahasa',
  'lang.appAndAi': 'Bahasa aplikasi & jawaban AI',

  'purpose.title': 'BroAgent mau dipakai buat apa?',
  'purpose.desc': 'Pilih yang paling cocok. BroAgent akan menyesuaikan gaya dan mode default-nya. Bisa diganti kapan saja di Pengaturan.',
  'purpose.work': 'Kerja',
  'purpose.workDesc': 'Tugas, email, laporan, dan beres-beres kerjaan',
  'purpose.study': 'Pelajar',
  'purpose.studyDesc': 'Pelajaran, PR, ujian, dan memahami konsep',
  'purpose.personal': 'Personal',
  'purpose.personalDesc': 'Teman harian untuk ngobrol dan bantuan sehari-hari',
  'purpose.developer': 'Developer',
  'purpose.developerDesc': 'Ngoding, debugging, dan bikin software',
  'purpose.creator': 'Kreator',
  'purpose.creatorDesc': 'Ide konten, skrip, hook, dan draft',
  'purpose.research': 'Peneliti',
  'purpose.researchDesc': 'Riset mendalam, bukti, dan eksplorasi topik',
  'settings.purpose': 'BroAgent paling sering dipakai untuk',

  'chat.emptyTitle': 'Apa yang bisa saya bantu?',
  'chat.emptySub': 'Asisten AI pribadimu untuk berpikir, belajar, dan berkreasi.',
  'chat.placeholder': 'Ketik pesan...',
  'chat.listening': 'Mendengarkan... ngomong aja, nanti jadi teks',
  'chat.recording': 'Merekam... klik mic lagi untuk berhenti',
  'chat.newChat': 'Chat Baru',
  'chat.recent': 'Terbaru',
  'chat.loginToSave': 'Masuk agar percakapan tersimpan',
  'chat.online': 'Online',
  'chat.selectModel': 'Pilih model AI',
  'chat.guest': 'Pengguna Tamu',
  'chat.settings': 'Pengaturan',
  'chat.noLimit': 'Tidak, cukup',
  'status.thinking': 'Berpikir…',
  'status.searching': 'Mencari di web…',
  'status.reading': 'Membaca sumber…',
  'status.generating': 'Menyusun jawaban…',
  'sources.title': 'Sumber',
  'chat.limitMoved': 'Limit — dipindah ke',
  'chat.limitOut': 'LIMIT — kuota habis',

  'mode.general': 'Umum',
  'mode.learning': 'Belajar',
  'mode.research': 'Riset',
  'mode.brainstorm': 'Brainstorm',
  'mode.support': 'Dukungan',
  'mode.assignment': 'Tugas',

  'settings.title': 'Pengaturan',
  'settings.profile': 'Profil',
  'settings.chatPrefs': 'Preferensi chat',
  'settings.modelDefault': 'Model default',
  'settings.modeDefault': 'Mode default',
  'settings.stt': 'Bahasa voice-to-text',
  'settings.close': 'Tutup',
  'settings.savedInBrowser': 'Preferensi tersimpan di browser ini dan berlaku untuk chat berikutnya.',

  'mode.document': 'Dokumen',

  'chat.loading': 'Memuat...',
  'chat.loadFail': 'Gagal memuat percakapan (HTTP {status}). Coba klik lagi.',
  'chat.loadFailGeneric': 'Gagal memuat percakapan.',
  'chat.modelUnavailable': 'API key belum diisi di server',
  'chat.groqNote': 'Groq butuh GROQ_API_KEY di .env server.',
  'chat.limitOutTitle': 'Kuota model habis. Coba lagi nanti, ganti model, atau cek Pengaturan → Kuota & limit.',
  'chat.limitFallbackTitle': 'Model yang kamu pilih kena limit, jadi otomatis dijawab model lain.',

  'settings.loading': 'Memuat...',
  'settings.avatar': 'Warna avatar',
  'settings.joined': 'Bergabung',
  'settings.conversations': 'Percakapan',
  'settings.messages': 'Pesan',
  'settings.daysActive': 'Hari aktif',
  'settings.editName': 'Ubah nama',
  'settings.copyEmail': 'Salin email',
  'settings.nameEmpty': 'Nama tidak boleh kosong.',
  'settings.nameSaved': 'Nama tersimpan.',
  'settings.changePw': 'Ganti password',
  'settings.currentPw': 'Password saat ini',
  'settings.newPw': 'Password baru (min. 6 karakter)',
  'settings.repeatPw': 'Ulangi password baru',
  'settings.savePw': 'Simpan password',
  'settings.pwFillAll': 'Isi semua kolom password.',
  'settings.pwMismatch': 'Konfirmasi password tidak sama.',
  'settings.pwSaved': 'Password berhasil diganti.',
  'settings.danger': 'Zona berbahaya',
  'settings.wipe': 'Hapus semua percakapan',
  'settings.wipeConfirm': 'Yakin? Klik lagi untuk hapus SEMUA percakapan',
  'settings.delAccount': 'Hapus akun',
  'settings.delAccountConfirm': 'Yakin? Klik lagi — akun + data hilang permanen',
  'settings.wipeFail': 'Gagal menghapus riwayat. Coba lagi.',
  'settings.delFail': 'Gagal menghapus akun.',
  'settings.guestTitle': 'Pengguna Tamu',
  'settings.guestDesc': 'Login agar chat tersimpan permanen',
  'settings.logout': 'Logout',
  'settings.quota': 'Kuota & limit',
  'settings.quotaGroq': 'Gratis: 30 req/mnt • 1.000 req/hari • 200 rb token/hari',
  'settings.quotaGemini': 'Ikut batas Google AI Studio (cek dashboard)',
  'settings.quotaNote': 'Kena limit → BroAgent otomatis pindah ke model lain dan menampilkan logo LIMIT di header chat. Label kecil “via …” di bawah balasan menunjukkan model yang dipakai.',
  'settings.keyMissing': 'key kosong',
  'settings.defaultBadge': 'default',
  'settings.save': 'Simpan',
  'settings.cancel': 'Batal',

  'attach.title': 'Lampirkan',
  'attach.photo': 'Foto & Galeri',
  'attach.photoDesc': 'Pilih foto yang sudah ada',
  'attach.camera': 'Kamera',
  'attach.cameraDesc': 'Ambil foto langsung',
  'attach.doc': 'Dokumen teks',
  'attach.docDesc': '.txt .md .csv .json kode',
  'attach.preparing': 'Menyiapkan lampiran...',
  'attach.remove': 'Hapus lampiran',
  'attach.openTitle': 'Lampirkan (foto, kamera, dokumen)',
  'mic.titleOn': 'Ngomong jadi teks',
  'mic.titleOff': 'Voice-to-text tidak didukung browser ini',
  'mic.unsupported': 'Browser ini tidak mendukung voice-to-text. Coba Chrome/Edge desktop.',
  'mic.denied': 'Izin mic ditolak. Klik ikon gembok di address bar lalu izinkan microphone.',
  'mic.noSpeech': 'Tidak terdengar suara. Coba ngomong lebih dekat ke mic.',
  'mic.noMic': 'Mic tidak ditemukan. Pastikan microphone terpasang.',
  'mic.failed': 'Voice-to-text gagal. Coba lagi.',
  'mic.startFail': 'Gagal menyalakan mic. Coba lagi.',

  'attachErr.tooManyImages': 'Maksimal {n} gambar per pesan.',
  'attachErr.imageTooBig': '"{name}" kebesaran (max 10MB).',
  'attachErr.unreadable': '"{name}" tidak bisa dibaca (mis. format HEIC iPhone). Coba JPG/PNG atau screenshot ulang.',
  'attachErr.textTooBig': '"{name}" kebesaran untuk file teks (max 512KB).',
  'attachErr.emptyFile': '"{name}" kosong.',
  'attachErr.readFail': 'Gagal membaca "{name}".',
  'attachErr.videoNo': 'Video belum didukung. Kirim sebagai gambar atau teks saja.',
  'attachErr.officeNo': '"{name}" ({ext}) belum didukung. Screenshot jadi gambar atau convert ke .txt dulu.',
  'attachErr.formatNo': 'Format "{name}" belum didukung. Bisa kirim gambar (JPG/PNG) atau file teks.',

  'bubble.document': 'Dokumen',
  'bubble.edit': 'Edit',
  'bubble.regenerate': 'Regenerate',
  'bubble.save': 'Simpan',
  'bubble.sendRevision': 'Kirim revisi',
  'bubble.cancel': 'Batal',
  'bubble.saveNote': 'Simpan hanya mengubah tampilan sesi ini. Kirim revisi meminta AI mengembangkan versi baru.',
  'bubble.savedFlash': 'Perubahan tersimpan di tampilan ini',
  'bubble.revisePrefix': 'Tolong perbaiki dan kembangkan dokumen berikut:',

  'copy.label': 'Copy',
  'copy.done': 'Tersalin',
  'copy.fail': 'Gagal',
  'copy.failTitle': 'Gagal menyalin',

  'table.name': 'Tabel',
  'table.cols': 'kolom',
  'table.rows': 'baris',
  'table.empty': '(tabel kosong)',
  'table.copyTsv': 'Copy TSV',
  'code.name': 'code',
  'doc.fallbackTitle': 'Jawaban AI',
};

const ar: Dict = {
  'app.tagline': 'مساعدك الذكي الشخصي',
  'app.description': 'فكّر وتعلّم وابحث وابتكر وأنجز مهامك مع مساعد ذكي واحد.',
  'app.subtag': 'مساعد واحد. قدرات متعددة. محادثة واحدة متواصلة.',
  'app.start': 'ابدأ المحادثة',
  'app.explore': 'استكشف القدرات',
  'app.capabilities': 'القدرات',
  'skill.support.desc': 'تحدث واحصل على التوجيه',
  'skill.research.desc': 'استكشف المواضيع واعثر على معلومات مفيدة',
  'skill.brainstorm.desc': 'ولّد الأفكار واستكشف الاحتمالات',
  'skill.learning.desc': 'افهم المفاهيم الجديدة خطوة بخطوة',
  'skill.assignment.desc': 'قسّم المهام وأنجزها',
  'skill.document.desc': 'راجع المستندات وافهمها',

  'auth.create': 'إنشاء حساب',
  'auth.welcome': 'مرحباً بعودتك',
  'auth.name': 'الاسم',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.register': 'تسجيل',
  'auth.login': 'تسجيل الدخول',
  'auth.loggingIn': 'جارٍ تسجيل الدخول...',
  'auth.registering': 'جارٍ إنشاء الحساب...',
  'auth.already': 'لديك حساب بالفعل؟',
  'auth.donthave': 'ليس لديك حساب؟',
  'auth.namePh': 'اسمك',
  'auth.passwordPh': 'كلمة مرورك',
  'auth.newPasswordPh': '6 أحرف على الأقل',
  'auth.showPw': 'إظهار كلمة المرور',
  'auth.hidePw': 'إخفاء كلمة المرور',
  'auth.backHome': 'عودة للرئيسية',

  'lang.chooseTitle': 'اختر لغتك',
  'lang.chooseDesc': 'اختر لغة التطبيق وإجابات الذكاء الاصطناعي. يمكنك تغييرها لاحقاً من الإعدادات.',
  'lang.continue': 'متابعة',
  'lang.saving': 'جارٍ الحفظ...',
  'lang.skip': 'تخطَّ الآن',
  'lang.label': 'اللغة',
  'lang.appAndAi': 'لغة التطبيق وإجابات الذكاء',

  'purpose.title': 'فيما ستستخدم BroAgent؟',
  'purpose.desc': 'اختر ما يناسبك أكثر. سيكيّف BroAgent أسلوبه ووضعه الافتراضي. يمكنك تغييره لاحقاً من الإعدادات.',
  'purpose.work': 'العمل',
  'purpose.workDesc': 'المهام والبريد والتقارير وإنجاز العمل',
  'purpose.study': 'الدراسة',
  'purpose.studyDesc': 'الدروس والواجبات والامتحانات وفهم المفاهيم',
  'purpose.personal': 'شخصي',
  'purpose.personalDesc': 'رفيق يومي للدردشة والمساعدة اليومية',
  'purpose.developer': 'مطوّر',
  'purpose.developerDesc': 'البرمجة وتصحيح الأخطاء وبناء البرمجيات',
  'purpose.creator': 'صانع محتوى',
  'purpose.creatorDesc': 'أفكار المحتوى والنصوص والخطافات والمسودات',
  'purpose.research': 'البحث',
  'purpose.researchDesc': 'التعمق والأدلة واستكشاف المواضيع',
  'settings.purpose': 'أستخدم BroAgent أساساً لـ',

  'chat.emptyTitle': 'كيف أساعدك؟',
  'chat.emptySub': 'مساعدك الذكي للتفكير والتعلم والإبداع.',
  'chat.placeholder': 'اكتب رسالة...',
  'chat.listening': 'أستمع... تحدث وسيتحول كلامك إلى نص',
  'chat.recording': 'جارٍ التسجيل... انقر الميكروفون مجدداً للإيقاف',
  'chat.newChat': 'محادثة جديدة',
  'chat.recent': 'الأخيرة',
  'chat.loginToSave': 'سجّل الدخول لحفظ محادثاتك',
  'chat.online': 'متصل',
  'chat.selectModel': 'اختر نموذج الذكاء',
  'chat.guest': 'ضيف',
  'chat.settings': 'الإعدادات',
  'chat.noLimit': 'لا، شكراً',
  'status.thinking': 'يفكّر…',
  'status.searching': 'يبحث في الويب…',
  'status.reading': 'يقرأ المصادر…',
  'status.generating': 'يكتب الرد…',
  'sources.title': 'المصادر',
  'chat.limitMoved': 'تم تجاوز الحد — انتقل إلى',
  'chat.limitOut': 'الحد — نفدت الحصة',

  'mode.general': 'عام',
  'mode.learning': 'تعلم',
  'mode.research': 'بحث',
  'mode.brainstorm': 'عصف ذهني',
  'mode.support': 'دعم',
  'mode.assignment': 'مهام',

  'settings.title': 'الإعدادات',
  'settings.profile': 'الملف الشخصي',
  'settings.chatPrefs': 'تفضيلات المحادثة',
  'settings.modelDefault': 'النموذج الافتراضي',
  'settings.modeDefault': 'الوضع الافتراضي',
  'settings.stt': 'لغة تحويل الصوت إلى نص',
  'settings.close': 'إغلاق',
  'settings.savedInBrowser': 'تُحفظ التفضيلات في هذا المتصفح وتُطبق على محادثاتك القادمة.',

  'mode.document': 'مستند',

  'chat.loading': 'جارٍ التحميل...',
  'chat.loadFail': 'تعذر تحميل المحادثة (HTTP {status}). انقر مجدداً.',
  'chat.loadFailGeneric': 'تعذر تحميل المحادثة.',
  'chat.modelUnavailable': 'مفتاح API غير مضبوط في الخادم',
  'chat.groqNote': 'يحتاج Groq إلى GROQ_API_KEY في ملف .env بالخادم.',
  'chat.limitOutTitle': 'نفدت حصة النموذج. حاول لاحقاً أو بدّل النموذج أو راجع الإعدادات ← الحصة والحدود.',
  'chat.limitFallbackTitle': 'النموذج المختار تجاوز الحد، فأجاب نموذج آخر تلقائياً.',

  'settings.loading': 'جارٍ التحميل...',
  'settings.avatar': 'لون الصورة الرمزية',
  'settings.joined': 'انضم',
  'settings.conversations': 'المحادثات',
  'settings.messages': 'الرسائل',
  'settings.daysActive': 'الأيام النشطة',
  'settings.editName': 'تعديل الاسم',
  'settings.copyEmail': 'نسخ البريد',
  'settings.nameEmpty': 'يجب ألا يكون الاسم فارغاً.',
  'settings.nameSaved': 'تم حفظ الاسم.',
  'settings.changePw': 'تغيير كلمة المرور',
  'settings.currentPw': 'كلمة المرور الحالية',
  'settings.newPw': 'كلمة مرور جديدة (6 أحرف على الأقل)',
  'settings.repeatPw': 'كرر كلمة المرور الجديدة',
  'settings.savePw': 'حفظ كلمة المرور',
  'settings.pwFillAll': 'املأ كل حقول كلمة المرور.',
  'settings.pwMismatch': 'تأكيد كلمة المرور غير متطابق.',
  'settings.pwSaved': 'تم تغيير كلمة المرور.',
  'settings.danger': 'منطقة الخطر',
  'settings.wipe': 'حذف كل المحادثات',
  'settings.wipeConfirm': 'متأكد؟ انقر مجدداً لحذف كل المحادثات',
  'settings.delAccount': 'حذف الحساب',
  'settings.delAccountConfirm': 'متأكد؟ انقر مجدداً — سيضيع الحساب والبيانات نهائياً',
  'settings.wipeFail': 'تعذر حذف السجل. حاول مجدداً.',
  'settings.delFail': 'تعذر حذف الحساب.',
  'settings.guestTitle': 'ضيف',
  'settings.guestDesc': 'سجّل الدخول لحفظ محادثاتك نهائياً',
  'settings.logout': 'تسجيل الخروج',
  'settings.quota': 'الحصة والحدود',
  'settings.quotaGroq': 'مجاناً: 30 طلب/دقيقة • 1000 طلب/يوم • 200 ألف رمز/يوم',
  'settings.quotaGemini': 'يتبع حدود Google AI Studio (راجع اللوحة)',
  'settings.quotaNote': 'عند تجاوز الحد ينتقل BroAgent تلقائياً لنموذج آخر ويعرض شارة LIMIT في رأس المحادثة. وسم “via …” الصغير تحت الرد يوضح النموذج المستخدم.',
  'settings.keyMissing': 'المفتاح ناقص',
  'settings.defaultBadge': 'افتراضي',
  'settings.save': 'حفظ',
  'settings.cancel': 'إلغاء',

  'attach.title': 'إرفاق',
  'attach.photo': 'الصور والمعرض',
  'attach.photoDesc': 'اختر صوراً موجودة',
  'attach.camera': 'الكاميرا',
  'attach.cameraDesc': 'التقط صورة الآن',
  'attach.doc': 'مستند نصي',
  'attach.docDesc': '.txt .md .csv .json code',
  'attach.preparing': 'جارٍ تجهيز المرفقات...',
  'attach.remove': 'إزالة المرفق',
  'attach.openTitle': 'إرفاق (صورة، كاميرا، مستند)',
  'mic.titleOn': 'تحدث ليصبح نصاً',
  'mic.titleOff': 'تحويل الصوت لنص غير مدعوم في هذا المتصفح',
  'mic.unsupported': 'هذا المتصفح لا يدعم تحويل الصوت إلى نص. جرّب Chrome/Edge على سطح المكتب.',
  'mic.denied': 'تم رفض إذن الميكروفون. انقر أيقونة القفل في شريط العنوان واسمح بالميكروفون.',
  'mic.noSpeech': 'لم يُسمع صوت. حاول الاقتراب من الميكروفون.',
  'mic.noMic': 'لم يُعثر على ميكروفون. تأكد من توصيله.',
  'mic.failed': 'فشل تحويل الصوت إلى نص. حاول مجدداً.',
  'mic.startFail': 'تعذر تشغيل الميكروفون. حاول مجدداً.',

  'attachErr.tooManyImages': 'الحد الأقصى {n} صور لكل رسالة.',
  'attachErr.imageTooBig': '"{name}" كبير جداً (بحد أقصى 10MB).',
  'attachErr.unreadable': 'تعذرت قراءة "{name}" (مثل صيغة HEIC في iPhone). جرّب JPG/PNG أو أعد لقطة الشاشة.',
  'attachErr.textTooBig': '"{name}" كبير جداً كملف نصي (بحد أقصى 512KB).',
  'attachErr.emptyFile': '"{name}" فارغ.',
  'attachErr.readFail': 'تعذرت قراءة "{name}".',
  'attachErr.videoNo': 'الفيديو غير مدعوم بعد. أرسل صوراً أو نصاً فقط.',
  'attachErr.officeNo': '"{name}" ({ext}) غير مدعوم بعد. حوّله لصورة أو إلى .txt أولاً.',
  'attachErr.formatNo': 'صيغة "{name}" غير مدعومة. يمكنك إرسال صور (JPG/PNG) أو ملفات نصية.',

  'bubble.document': 'مستند',
  'bubble.edit': 'تعديل',
  'bubble.regenerate': 'إعادة توليد',
  'bubble.save': 'حفظ',
  'bubble.sendRevision': 'إرسال المراجعة',
  'bubble.cancel': 'إلغاء',
  'bubble.saveNote': 'الحفظ يغيّر عرض هذه الجلسة فقط. إرسال المراجعة يطلب من الذكاء تطوير نسخة جديدة.',
  'bubble.savedFlash': 'حُفظت التغييرات في هذا العرض',
  'bubble.revisePrefix': 'يرجى تصحيح وتوسيع المستند التالي:',

  'copy.label': 'نسخ',
  'copy.done': 'تم النسخ',
  'copy.fail': 'فشل',
  'copy.failTitle': 'فشل النسخ',

  'table.name': 'جدول',
  'table.cols': 'أعمدة',
  'table.rows': 'صفوف',
  'table.empty': '(جدول فارغ)',
  'table.copyTsv': 'نسخ TSV',
  'code.name': 'code',
  'doc.fallbackTitle': 'إجابة الذكاء',
};

const ru: Dict = {
  'app.tagline': 'Ваш личный ИИ-ассистент',
  'app.description': 'Думайте, учитесь, исследуйте, создавайте и достигайте целей с одним ИИ-ассистентом.',
  'app.subtag': 'Один ассистент. Много возможностей. Один непрерывный диалог.',
  'app.start': 'Начать общение',
  'app.explore': 'Возможности',
  'app.capabilities': 'Возможности',
  'skill.support.desc': 'Обсудите и получите поддержку',
  'skill.research.desc': 'Изучайте темы и находите полезную информацию',
  'skill.brainstorm.desc': 'Генерируйте идеи и изучайте варианты',
  'skill.learning.desc': 'Разбирайтесь в новом шаг за шагом',
  'skill.assignment.desc': 'Разбивайте задачи и выполняйте их',
  'skill.document.desc': 'Анализируйте и понимайте документы',

  'auth.create': 'Создать аккаунт',
  'auth.welcome': 'С возвращением',
  'auth.name': 'Имя',
  'auth.email': 'Email',
  'auth.password': 'Пароль',
  'auth.register': 'Регистрация',
  'auth.login': 'Войти',
  'auth.loggingIn': 'Вход...',
  'auth.registering': 'Создание аккаунта...',
  'auth.already': 'Уже есть аккаунт?',
  'auth.donthave': 'Нет аккаунта?',
  'auth.namePh': 'Ваше имя',
  'auth.passwordPh': 'Ваш пароль',
  'auth.newPasswordPh': 'Мин. 6 символов',
  'auth.showPw': 'Показать пароль',
  'auth.hidePw': 'Скрыть пароль',
  'auth.backHome': 'На главную',

  'lang.chooseTitle': 'Выберите язык',
  'lang.chooseDesc': 'Выберите язык приложения и ответов ИИ. Его можно изменить в настройках.',
  'lang.continue': 'Продолжить',
  'lang.saving': 'Сохранение...',
  'lang.skip': 'Пропустить',
  'lang.label': 'Язык',
  'lang.appAndAi': 'Язык приложения и ответов ИИ',

  'purpose.title': 'Для чего вам BroAgent?',
  'purpose.desc': 'Выберите подходящее. BroAgent подстроит стиль и режим по умолчанию. Можно изменить в настройках.',
  'purpose.work': 'Работа',
  'purpose.workDesc': 'Задачи, письма, отчёты и дела',
  'purpose.study': 'Учёба',
  'purpose.studyDesc': 'Уроки, домашка, экзамены и разбор тем',
  'purpose.personal': 'Личное',
  'purpose.personalDesc': 'Компаньон на каждый день: общение и помощь',
  'purpose.developer': 'Разработчик',
  'purpose.developerDesc': 'Код, отладка и разработка',
  'purpose.creator': 'Креатор',
  'purpose.creatorDesc': 'Идеи контента, сценарии, хуки и черновики',
  'purpose.research': 'Исследования',
  'purpose.researchDesc': 'Глубокий разбор, факты и изучение тем',
  'settings.purpose': 'Я использую BroAgent в основном для',

  'chat.emptyTitle': 'Чем помочь?',
  'chat.emptySub': 'Ваш личный ИИ-ассистент для мышления, учёбы и творчества.',
  'chat.placeholder': 'Введите сообщение...',
  'chat.listening': 'Слушаю... говорите, всё станет текстом',
  'chat.recording': 'Запись... нажмите на микрофон, чтобы остановить',
  'chat.newChat': 'Новый чат',
  'chat.recent': 'Недавние',
  'chat.loginToSave': 'Войдите, чтобы сохранять переписку',
  'chat.online': 'В сети',
  'chat.selectModel': 'Выбрать модель ИИ',
  'chat.guest': 'Гость',
  'chat.settings': 'Настройки',
  'chat.noLimit': 'Нет, спасибо',
  'status.thinking': 'Думаю…',
  'status.searching': 'Ищу в интернете…',
  'status.reading': 'Читаю источники…',
  'status.generating': 'Пишу ответ…',
  'sources.title': 'Источники',
  'chat.limitMoved': 'Лимит — переключено на',
  'chat.limitOut': 'ЛИМИТ — квота исчерпана',

  'mode.general': 'Общий',
  'mode.learning': 'Учёба',
  'mode.research': 'Исследование',
  'mode.brainstorm': 'Идеи',
  'mode.support': 'Поддержка',
  'mode.assignment': 'Задания',

  'settings.title': 'Настройки',
  'settings.profile': 'Профиль',
  'settings.chatPrefs': 'Настройки чата',
  'settings.modelDefault': 'Модель по умолчанию',
  'settings.modeDefault': 'Режим по умолчанию',
  'settings.stt': 'Язык голосового ввода',
  'settings.close': 'Закрыть',
  'settings.savedInBrowser': 'Настройки хранятся в этом браузере и применяются к следующим чатам.',

  'mode.document': 'Документ',

  'chat.loading': 'Загрузка...',
  'chat.loadFail': 'Не удалось загрузить переписку (HTTP {status}). Нажмите ещё раз.',
  'chat.loadFailGeneric': 'Не удалось загрузить переписку.',
  'chat.modelUnavailable': 'API-ключ не задан на сервере',
  'chat.groqNote': 'Для Groq нужен GROQ_API_KEY в .env сервера.',
  'chat.limitOutTitle': 'Квота модели исчерпана. Попробуйте позже, смените модель или проверьте Настройки → Квоты и лимиты.',
  'chat.limitFallbackTitle': 'Выбранная модель упёрлась в лимит, ответила другая модель автоматически.',

  'settings.loading': 'Загрузка...',
  'settings.avatar': 'Цвет аватара',
  'settings.joined': 'С нами с',
  'settings.conversations': 'Переписки',
  'settings.messages': 'Сообщения',
  'settings.daysActive': 'Дней активно',
  'settings.editName': 'Изменить имя',
  'settings.copyEmail': 'Скопировать email',
  'settings.nameEmpty': 'Имя не должно быть пустым.',
  'settings.nameSaved': 'Имя сохранено.',
  'settings.changePw': 'Сменить пароль',
  'settings.currentPw': 'Текущий пароль',
  'settings.newPw': 'Новый пароль (мин. 6 символов)',
  'settings.repeatPw': 'Повторите новый пароль',
  'settings.savePw': 'Сохранить пароль',
  'settings.pwFillAll': 'Заполните все поля пароля.',
  'settings.pwMismatch': 'Подтверждение пароля не совпадает.',
  'settings.pwSaved': 'Пароль изменён.',
  'settings.danger': 'Опасная зона',
  'settings.wipe': 'Удалить все переписки',
  'settings.wipeConfirm': 'Точно? Нажмите ещё раз, чтобы удалить ВСЕ переписки',
  'settings.delAccount': 'Удалить аккаунт',
  'settings.delAccountConfirm': 'Точно? Нажмите ещё раз — аккаунт и данные исчезнут навсегда',
  'settings.wipeFail': 'Не удалось удалить историю. Попробуйте ещё раз.',
  'settings.delFail': 'Не удалось удалить аккаунт.',
  'settings.guestTitle': 'Гость',
  'settings.guestDesc': 'Войдите, чтобы переписка сохранялась навсегда',
  'settings.logout': 'Выйти',
  'settings.quota': 'Квоты и лимиты',
  'settings.quotaGroq': 'Бесплатно: 30 зап/мин • 1000 зап/день • 200 тыс токенов/день',
  'settings.quotaGemini': 'Лимиты Google AI Studio (смотрите дашборд)',
  'settings.quotaNote': 'При лимите BroAgent сам переключается на другую модель и показывает бейдж LIMIT в шапке чата. Метка «via …» под ответом показывает, какая модель ответила.',
  'settings.keyMissing': 'нет ключа',
  'settings.defaultBadge': 'по умолч.',
  'settings.save': 'Сохранить',
  'settings.cancel': 'Отмена',

  'attach.title': 'Прикрепить',
  'attach.photo': 'Фото и галерея',
  'attach.photoDesc': 'Выбрать существующие фото',
  'attach.camera': 'Камера',
  'attach.cameraDesc': 'Снять фото сейчас',
  'attach.doc': 'Текстовый документ',
  'attach.docDesc': '.txt .md .csv .json код',
  'attach.preparing': 'Готовим вложения...',
  'attach.remove': 'Убрать вложение',
  'attach.openTitle': 'Прикрепить (фото, камера, документ)',
  'mic.titleOn': 'Говорите — станет текстом',
  'mic.titleOff': 'Голосовой ввод не поддерживается в этом браузере',
  'mic.unsupported': 'Этот браузер не поддерживает голосовой ввод. Попробуйте Chrome/Edge на компьютере.',
  'mic.denied': 'Доступ к микрофону запрещён. Нажмите на замок в адресной строке и разрешите микрофон.',
  'mic.noSpeech': 'Речь не слышна. Говорите ближе к микрофону.',
  'mic.noMic': 'Микрофон не найден. Проверьте подключение.',
  'mic.failed': 'Голосовой ввод не удался. Попробуйте ещё раз.',
  'mic.startFail': 'Не удалось включить микрофон. Попробуйте ещё раз.',

  'attachErr.tooManyImages': 'Максимум {n} изображений на сообщение.',
  'attachErr.imageTooBig': '«{name}» слишком большой (макс. 10MB).',
  'attachErr.unreadable': '«{name}» не читается (напр. формат HEIC с iPhone). Попробуйте JPG/PNG или сделайте скриншот.',
  'attachErr.textTooBig': '«{name}» слишком большой для текстового файла (макс. 512KB).',
  'attachErr.emptyFile': '«{name}» пуст.',
  'attachErr.readFail': 'Не удалось прочитать «{name}».',
  'attachErr.videoNo': 'Видео пока не поддерживается. Присылайте только изображения или текст.',
  'attachErr.officeNo': '«{name}» ({ext}) пока не поддерживается. Сделайте скриншот или конвертируйте в .txt.',
  'attachErr.formatNo': 'Формат «{name}» не поддерживается. Можно прислать изображения (JPG/PNG) или текстовые файлы.',

  'bubble.document': 'Документ',
  'bubble.edit': 'Изменить',
  'bubble.regenerate': 'Заново',
  'bubble.save': 'Сохранить',
  'bubble.sendRevision': 'Отправить правку',
  'bubble.cancel': 'Отмена',
  'bubble.saveNote': 'Сохранение меняет только вид в этой сессии. Отправка правки просит ИИ развить новую версию.',
  'bubble.savedFlash': 'Изменения сохранены в этом виде',
  'bubble.revisePrefix': 'Пожалуйста, исправь и развей следующий документ:',

  'copy.label': 'Копировать',
  'copy.done': 'Скопировано',
  'copy.fail': 'Ошибка',
  'copy.failTitle': 'Не удалось скопировать',

  'table.name': 'Таблица',
  'table.cols': 'столбца',
  'table.rows': 'строк',
  'table.empty': '(пустая таблица)',
  'table.copyTsv': 'Копировать TSV',
  'code.name': 'code',
  'doc.fallbackTitle': 'Ответ ИИ',
};

const zh: Dict = {
  'app.tagline': '你的个人 AI 助手',
  'app.description': '用一个 AI 助手思考、学习、研究、创作并完成事务。',
  'app.subtag': '一个助手。多种能力。一次连续对话。',
  'app.start': '开始聊天',
  'app.explore': '探索功能',
  'app.capabilities': '功能',
  'skill.support.desc': '倾诉心事并获得指导',
  'skill.research.desc': '探索主题并找到有用信息',
  'skill.brainstorm.desc': '激发想法并探索可能性',
  'skill.learning.desc': '一步一步理解新概念',
  'skill.assignment.desc': '拆解任务并逐一完成',
  'skill.document.desc': '审阅并理解文档',

  'auth.create': '创建账号',
  'auth.welcome': '欢迎回来',
  'auth.name': '姓名',
  'auth.email': '邮箱',
  'auth.password': '密码',
  'auth.register': '注册',
  'auth.login': '登录',
  'auth.loggingIn': '登录中...',
  'auth.registering': '正在创建账号...',
  'auth.already': '已有账号？',
  'auth.donthave': '还没有账号？',
  'auth.namePh': '你的名字',
  'auth.passwordPh': '你的密码',
  'auth.newPasswordPh': '至少 6 位',
  'auth.showPw': '显示密码',
  'auth.hidePw': '隐藏密码',
  'auth.backHome': '返回首页',

  'lang.chooseTitle': '选择你的语言',
  'lang.chooseDesc': '选择应用和 AI 回答的语言，随时可在设置中更改。',
  'lang.continue': '继续',
  'lang.saving': '保存中...',
  'lang.skip': '稍后再说',
  'lang.label': '语言',
  'lang.appAndAi': '应用和 AI 回答语言',

  'purpose.title': '你会用 BroAgent 来做什么？',
  'purpose.desc': '选最符合的一项，BroAgent 会调整风格和默认模式，随时可在设置中更改。',
  'purpose.work': '工作',
  'purpose.workDesc': '任务、邮件、报告和搞定工作',
  'purpose.study': '学习',
  'purpose.studyDesc': '课程、作业、考试和理解概念',
  'purpose.personal': '个人',
  'purpose.personalDesc': '日常聊天和生活帮手',
  'purpose.developer': '开发者',
  'purpose.developerDesc': '写代码、调试和开发软件',
  'purpose.creator': '创作者',
  'purpose.creatorDesc': '内容创意、脚本、钩子和草稿',
  'purpose.research': '研究',
  'purpose.researchDesc': '深度挖掘、证据和探索主题',
  'settings.purpose': '我主要用 BroAgent 来',

  'chat.emptyTitle': '我能帮你做什么？',
  'chat.emptySub': '你的个人 AI 助手，陪你思考、学习和创作。',
  'chat.placeholder': '输入消息...',
  'chat.listening': '正在聆听...直接说，会变成文字',
  'chat.recording': '录音中...再点麦克风停止',
  'chat.newChat': '新对话',
  'chat.recent': '最近',
  'chat.loginToSave': '登录以保存你的对话',
  'chat.online': '在线',
  'chat.selectModel': '选择 AI 模型',
  'chat.guest': '访客',
  'chat.settings': '设置',
  'chat.noLimit': '不用了，谢谢',
  'status.thinking': '思考中…',
  'status.searching': '正在搜索网页…',
  'status.reading': '正在阅读来源…',
  'status.generating': '正在生成回复…',
  'sources.title': '来源',
  'chat.limitMoved': '限流 — 已切换到',
  'chat.limitOut': '限流 — 配额已用完',

  'mode.general': '通用',
  'mode.learning': '学习',
  'mode.research': '研究',
  'mode.brainstorm': '头脑风暴',
  'mode.support': '倾诉',
  'mode.assignment': '作业',

  'settings.title': '设置',
  'settings.profile': '个人资料',
  'settings.chatPrefs': '聊天偏好',
  'settings.modelDefault': '默认模型',
  'settings.modeDefault': '默认模式',
  'settings.stt': '语音转文字语言',
  'settings.close': '关闭',
  'settings.savedInBrowser': '偏好保存在此浏览器中，将应用于下次聊天。',

  'mode.document': '文档',

  'chat.loading': '加载中...',
  'chat.loadFail': '加载对话失败 (HTTP {status})，请再点一次。',
  'chat.loadFailGeneric': '加载对话失败。',
  'chat.modelUnavailable': '服务器未配置 API key',
  'chat.groqNote': 'Groq 需要在服务器 .env 中配置 GROQ_API_KEY。',
  'chat.limitOutTitle': '模型配额已用完，请稍后再试、换模型，或查看设置 → 配额与限制。',
  'chat.limitFallbackTitle': '所选模型触发限流，已自动由其他模型回答。',

  'settings.loading': '加载中...',
  'settings.avatar': '头像颜色',
  'settings.joined': '加入于',
  'settings.conversations': '对话',
  'settings.messages': '消息',
  'settings.daysActive': '活跃天数',
  'settings.editName': '修改名字',
  'settings.copyEmail': '复制邮箱',
  'settings.nameEmpty': '名字不能为空。',
  'settings.nameSaved': '名字已保存。',
  'settings.changePw': '修改密码',
  'settings.currentPw': '当前密码',
  'settings.newPw': '新密码 (至少 6 位)',
  'settings.repeatPw': '重复新密码',
  'settings.savePw': '保存密码',
  'settings.pwFillAll': '请填写所有密码栏。',
  'settings.pwMismatch': '两次输入的新密码不一致。',
  'settings.pwSaved': '密码已修改。',
  'settings.danger': '危险区',
  'settings.wipe': '删除所有对话',
  'settings.wipeConfirm': '确定吗？再点一次删除全部对话',
  'settings.delAccount': '删除账号',
  'settings.delAccountConfirm': '确定吗？再点一次——账号和数据将永久消失',
  'settings.wipeFail': '删除记录失败，请重试。',
  'settings.delFail': '删除账号失败。',
  'settings.guestTitle': '访客',
  'settings.guestDesc': '登录以永久保存聊天',
  'settings.logout': '退出登录',
  'settings.quota': '配额与限制',
  'settings.quotaGroq': '免费：30 次/分钟 • 1000 次/天 • 20 万 token/天',
  'settings.quotaGemini': '遵循 Google AI Studio 限额 (查看控制台)',
  'settings.quotaNote': '触发限流时 BroAgent 会自动切换模型，并在聊天顶部显示 LIMIT 徽标。回复下的小字“via …”表示实际回答的模型。',
  'settings.keyMissing': 'key 缺失',
  'settings.defaultBadge': '默认',
  'settings.save': '保存',
  'settings.cancel': '取消',

  'attach.title': '添加附件',
  'attach.photo': '照片与相册',
  'attach.photoDesc': '选择已有照片',
  'attach.camera': '相机',
  'attach.cameraDesc': '立即拍照',
  'attach.doc': '文本文档',
  'attach.docDesc': '.txt .md .csv .json 代码',
  'attach.preparing': '正在准备附件...',
  'attach.remove': '移除附件',
  'attach.openTitle': '添加附件 (照片、相机、文档)',
  'mic.titleOn': '说话转文字',
  'mic.titleOff': '此浏览器不支持语音转文字',
  'mic.unsupported': '此浏览器不支持语音转文字，请用桌面版 Chrome/Edge。',
  'mic.denied': '麦克风权限被拒绝，点击地址栏的锁形图标并允许麦克风。',
  'mic.noSpeech': '没听到声音，请靠近麦克风说话。',
  'mic.noMic': '未找到麦克风，请确认麦克风已连接。',
  'mic.failed': '语音转文字失败，请重试。',
  'mic.startFail': '无法启动麦克风，请重试。',

  'attachErr.tooManyImages': '每条消息最多 {n} 张图片。',
  'attachErr.imageTooBig': '“{name}”太大 (最大 10MB)。',
  'attachErr.unreadable': '无法读取“{name}”(如 iPhone HEIC 格式)，请用 JPG/PNG 或重新截图。',
  'attachErr.textTooBig': '“{name}”作为文本文件太大 (最大 512KB)。',
  'attachErr.emptyFile': '“{name}”是空的。',
  'attachErr.readFail': '读取“{name}”失败。',
  'attachErr.videoNo': '暂不支持视频，请只发送图片或文字。',
  'attachErr.officeNo': '暂不支持“{name}”({ext})，请截图为图片或先转为 .txt。',
  'attachErr.formatNo': '不支持“{name}”格式，可以发送图片 (JPG/PNG) 或文本文件。',

  'bubble.document': '文档',
  'bubble.edit': '编辑',
  'bubble.regenerate': '重新生成',
  'bubble.save': '保存',
  'bubble.sendRevision': '发送修订',
  'bubble.cancel': '取消',
  'bubble.saveNote': '保存只改变本次会话的显示，发送修订会让 AI 生成新版本。',
  'bubble.savedFlash': '已保存在当前视图',
  'bubble.revisePrefix': '请修正并扩展以下文档：',

  'copy.label': '复制',
  'copy.done': '已复制',
  'copy.fail': '失败',
  'copy.failTitle': '复制失败',

  'table.name': '表格',
  'table.cols': '列',
  'table.rows': '行',
  'table.empty': '(空表格)',
  'table.copyTsv': '复制 TSV',
  'code.name': 'code',
  'doc.fallbackTitle': 'AI 回答',
};

const ja: Dict = {
  'app.tagline': 'あなたのパーソナルAIアシスタント',
  'app.description': 'ひとつのAIアシスタントで考え、学び、調べ、作り、こなしていく。',
  'app.subtag': 'ひとつのアシスタント。多彩な機能。途切れない会話。',
  'app.start': 'チャットを始める',
  'app.explore': '機能を見る',
  'app.capabilities': '機能',
  'skill.support.desc': '話を聞いてもらい、アドバイスをもらう',
  'skill.research.desc': 'トピックを深掘りし、役立つ情報を見つける',
  'skill.brainstorm.desc': 'アイデアを出し、可能性を探る',
  'skill.learning.desc': '新しい概念を一歩ずつ理解する',
  'skill.assignment.desc': 'タスクを分解して進める',
  'skill.document.desc': 'ドキュメントを確認・理解する',

  'auth.create': 'アカウント作成',
  'auth.welcome': 'おかえりなさい',
  'auth.name': '名前',
  'auth.email': 'メール',
  'auth.password': 'パスワード',
  'auth.register': '登録',
  'auth.login': 'ログイン',
  'auth.loggingIn': 'ログイン中...',
  'auth.registering': '作成中...',
  'auth.already': 'すでにアカウントをお持ちですか？',
  'auth.donthave': 'アカウントがありませんか？',
  'auth.namePh': 'あなたの名前',
  'auth.passwordPh': 'パスワード',
  'auth.newPasswordPh': '6文字以上',
  'auth.showPw': 'パスワードを表示',
  'auth.hidePw': 'パスワードを非表示',
  'auth.backHome': 'ホームに戻る',

  'lang.chooseTitle': '言語を選んでください',
  'lang.chooseDesc': 'アプリとAI回答の言語を選んでください。設定からいつでも変更できます。',
  'lang.continue': '続ける',
  'lang.saving': '保存中...',
  'lang.skip': '後で',
  'lang.label': '言語',
  'lang.appAndAi': 'アプリとAI回答の言語',

  'purpose.title': 'BroAgent を何に使いますか?',
  'purpose.desc': '一番合うものを選んでください。スタイルと既定モードを調整します。設定からいつでも変更できます。',
  'purpose.work': '仕事',
  'purpose.workDesc': 'タスク、メール、レポート、仕事の整理',
  'purpose.study': '勉強',
  'purpose.studyDesc': '授業、宿題、試験、概念の理解',
  'purpose.personal': 'パーソナル',
  'purpose.personalDesc': '雑談と日常の手助けをする相棒',
  'purpose.developer': '開発者',
  'purpose.developerDesc': 'コーディング、デバッグ、開発',
  'purpose.creator': 'クリエイター',
  'purpose.creatorDesc': '企画、台本、フック、下書き',
  'purpose.research': '研究',
  'purpose.researchDesc': '深掘り、根拠、トピック探索',
  'settings.purpose': 'BroAgent の主な用途',

  'chat.emptyTitle': '何をお手伝いしますか？',
  'chat.emptySub': '考え、学び、作るためのパーソナルAIアシスタント。',
  'chat.placeholder': 'メッセージを入力...',
  'chat.listening': '聞き取り中...話すだけでテキストになります',
  'chat.recording': '録音中...もう一度マイクを押すと停止',
  'chat.newChat': '新しいチャット',
  'chat.recent': '最近',
  'chat.loginToSave': 'ログインすると会話を保存できます',
  'chat.online': 'オンライン',
  'chat.selectModel': 'AIモデルを選ぶ',
  'chat.guest': 'ゲスト',
  'chat.settings': '設定',
  'chat.noLimit': 'いいえ、結構です',
  'status.thinking': '考え中…',
  'status.searching': 'Webを検索中…',
  'status.reading': '情報源を確認中…',
  'status.generating': '回答を生成中…',
  'sources.title': '情報源',
  'chat.limitMoved': '制限 — 切り替え先:',
  'chat.limitOut': '制限 — 上限に達しました',

  'mode.general': '一般',
  'mode.learning': '学習',
  'mode.research': 'リサーチ',
  'mode.brainstorm': 'ブレスト',
  'mode.support': 'サポート',
  'mode.assignment': '課題',

  'settings.title': '設定',
  'settings.profile': 'プロフィール',
  'settings.chatPrefs': 'チャット設定',
  'settings.modelDefault': 'デフォルトモデル',
  'settings.modeDefault': 'デフォルトモード',
  'settings.stt': '音声入力の言語',
  'settings.close': '閉じる',
  'settings.savedInBrowser': '設定はこのブラウザに保存され、次回以降のチャットに適用されます。',

  'mode.document': 'ドキュメント',

  'chat.loading': '読み込み中...',
  'chat.loadFail': '会話の読み込みに失敗 (HTTP {status})。もう一度クリックしてください。',
  'chat.loadFailGeneric': '会話の読み込みに失敗しました。',
  'chat.modelUnavailable': 'サーバーに API キー未設定',
  'chat.groqNote': 'Groq にはサーバーの .env の GROQ_API_KEY が必要です。',
  'chat.limitOutTitle': 'モデルの上限に達しました。後で再試行、モデル変更、または設定 → 容量と制限を確認してください。',
  'chat.limitFallbackTitle': '選択モデルが制限に達したため、自動的に別モデルが回答しました。',

  'settings.loading': '読み込み中...',
  'settings.avatar': 'アバターの色',
  'settings.joined': '参加日',
  'settings.conversations': '会話',
  'settings.messages': 'メッセージ',
  'settings.daysActive': 'アクティブ日数',
  'settings.editName': '名前を変更',
  'settings.copyEmail': 'メールをコピー',
  'settings.nameEmpty': '名前を空にできません。',
  'settings.nameSaved': '名前を保存しました。',
  'settings.changePw': 'パスワード変更',
  'settings.currentPw': '現在のパスワード',
  'settings.newPw': '新しいパスワード (6文字以上)',
  'settings.repeatPw': '新しいパスワード(確認)',
  'settings.savePw': 'パスワードを保存',
  'settings.pwFillAll': 'すべての欄を入力してください。',
  'settings.pwMismatch': '確認用パスワードが一致しません。',
  'settings.pwSaved': 'パスワードを変更しました。',
  'settings.danger': '危険な操作',
  'settings.wipe': 'すべての会話を削除',
  'settings.wipeConfirm': '本当によろしいですか?もう一度押すと全会話を削除します',
  'settings.delAccount': 'アカウント削除',
  'settings.delAccountConfirm': '本当によろしいですか?もう一度押すとアカウントとデータが完全に消えます',
  'settings.wipeFail': '履歴の削除に失敗しました。もう一度お試しください。',
  'settings.delFail': 'アカウントの削除に失敗しました。',
  'settings.guestTitle': 'ゲスト',
  'settings.guestDesc': 'ログインするとチャットが永久保存されます',
  'settings.logout': 'ログアウト',
  'settings.quota': '容量と制限',
  'settings.quotaGroq': '無料:30リクエスト/分 • 1000/日 • 20万トークン/日',
  'settings.quotaGemini': 'Google AI Studio の制限に準拠 (ダッシュボード参照)',
  'settings.quotaNote': '制限到達時は BroAgent が自動で別モデルに切り替え、チャット上部に LIMIT バッジを表示します。返信下の小さな“via …”が実際に回答したモデルを示します。',
  'settings.keyMissing': 'キー未設定',
  'settings.defaultBadge': '既定',
  'settings.save': '保存',
  'settings.cancel': 'キャンセル',

  'attach.title': '添付',
  'attach.photo': '写真・ギャラリー',
  'attach.photoDesc': '既存の写真を選ぶ',
  'attach.camera': 'カメラ',
  'attach.cameraDesc': '今すぐ撮影',
  'attach.doc': 'テキスト文書',
  'attach.docDesc': '.txt .md .csv .json コード',
  'attach.preparing': '添付を準備中...',
  'attach.remove': '添付を外す',
  'attach.openTitle': '添付 (写真、カメラ、文書)',
  'mic.titleOn': '話してテキスト化',
  'mic.titleOff': 'このブラウザは音声入力に未対応です',
  'mic.unsupported': 'このブラウザは音声入力に未対応です。デスクトップの Chrome/Edge をお試しください。',
  'mic.denied': 'マイクが拒否されました。アドレスバーの鍵アイコンからマイクを許可してください。',
  'mic.noSpeech': '音声が聞き取れません。マイクに近づいて話してください。',
  'mic.noMic': 'マイクが見つかりません。接続を確認してください。',
  'mic.failed': '音声入力に失敗しました。もう一度お試しください。',
  'mic.startFail': 'マイクを起動できません。もう一度お試しください。',

  'attachErr.tooManyImages': '1メッセージは画像 {n} 枚までです。',
  'attachErr.imageTooBig': '「{name}」が大きすぎます (最大 10MB)。',
  'attachErr.unreadable': '「{name}」を読み込めません (iPhone の HEIC 等)。JPG/PNG か撮り直しをお試しください。',
  'attachErr.textTooBig': '「{name}」はテキストとして大きすぎます (最大 512KB)。',
  'attachErr.emptyFile': '「{name}」は空です。',
  'attachErr.readFail': '「{name}」の読み込みに失敗しました。',
  'attachErr.videoNo': '動画は未対応です。画像かテキストでお送りください。',
  'attachErr.officeNo': '「{name}」({ext})は未対応です。画像化するか .txt に変換してください。',
  'attachErr.formatNo': '「{name}」の形式は未対応です。画像 (JPG/PNG) かテキストファイルを送れます。',

  'bubble.document': 'ドキュメント',
  'bubble.edit': '編集',
  'bubble.regenerate': '再生成',
  'bubble.save': '保存',
  'bubble.sendRevision': '修正を送信',
  'bubble.cancel': 'キャンセル',
  'bubble.saveNote': '保存はこのセッションの表示のみ変更します。修正の送信は AI に新版の作成を依頼します。',
  'bubble.savedFlash': 'この表示に保存しました',
  'bubble.revisePrefix': '以下の文書を修正・拡充してください:',

  'copy.label': 'コピー',
  'copy.done': 'コピー済み',
  'copy.fail': '失敗',
  'copy.failTitle': 'コピーに失敗',

  'table.name': 'テーブル',
  'table.cols': '列',
  'table.rows': '行',
  'table.empty': '(空のテーブル)',
  'table.copyTsv': 'TSV をコピー',
  'code.name': 'code',
  'doc.fallbackTitle': 'AI の回答',
};

const ko: Dict = {
  'app.tagline': '당신의 개인 AI 어시스턴트',
  'app.description': '하나의 AI 어시스턴트와 함께 생각하고, 배우고, 연구하고, 만들고, 해내세요.',
  'app.subtag': '하나의 어시스턴트. 다양한 기능. 끊기지 않는 대화.',
  'app.start': '채팅 시작',
  'app.explore': '기능 살펴보기',
  'app.capabilities': '기능',
  'skill.support.desc': '이야기를 나누고 조언 받기',
  'skill.research.desc': '주제를 탐색하고 유용한 정보 찾기',
  'skill.brainstorm.desc': '아이디어를 내고 가능성 탐색',
  'skill.learning.desc': '새 개념을 단계별로 이해',
  'skill.assignment.desc': '작업을 나누고 함께 해결',
  'skill.document.desc': '문서를 검토하고 이해',

  'auth.create': '계정 만들기',
  'auth.welcome': '다시 오신 것을 환영합니다',
  'auth.name': '이름',
  'auth.email': '이메일',
  'auth.password': '비밀번호',
  'auth.register': '가입',
  'auth.login': '로그인',
  'auth.loggingIn': '로그인 중...',
  'auth.registering': '계정 생성 중...',
  'auth.already': '이미 계정이 있나요?',
  'auth.donthave': '계정이 없나요?',
  'auth.namePh': '이름',
  'auth.passwordPh': '비밀번호',
  'auth.newPasswordPh': '6자 이상',
  'auth.showPw': '비밀번호 보기',
  'auth.hidePw': '비밀번호 숨기기',
  'auth.backHome': '홈으로',

  'lang.chooseTitle': '언어를 선택하세요',
  'lang.chooseDesc': '앱과 AI 답변의 언어를 선택하세요. 설정에서 언제든 바꿀 수 있어요.',
  'lang.continue': '계속',
  'lang.saving': '저장 중...',
  'lang.skip': '나중에',
  'lang.label': '언어',
  'lang.appAndAi': '앱 및 AI 답변 언어',

  'purpose.title': 'BroAgent를 무엇에 쓰실 건가요?',
  'purpose.desc': '가장 맞는 항목을 고르세요. 스타일과 기본 모드를 맞춰드립니다. 설정에서 언제든 바꿀 수 있어요.',
  'purpose.work': '업무',
  'purpose.workDesc': '할 일, 이메일, 보고서와 업무 정리',
  'purpose.study': '공부',
  'purpose.studyDesc': '수업, 과제, 시험과 개념 이해',
  'purpose.personal': '개인',
  'purpose.personalDesc': '잡담과 일상을 돕는 파트너',
  'purpose.developer': '개발자',
  'purpose.developerDesc': '코딩, 디버깅과 소프트웨어 개발',
  'purpose.creator': '크리에이터',
  'purpose.creatorDesc': '콘텐츠 아이디어, 스크립트, 후크와 초안',
  'purpose.research': '연구',
  'purpose.researchDesc': '심층 탐색, 근거와 주제 탐구',
  'settings.purpose': 'BroAgent 주 사용 목적',

  'chat.emptyTitle': '무엇을 도와드릴까요?',
  'chat.emptySub': '생각하고, 배우고, 만드는 당신의 개인 AI 어시스턴트.',
  'chat.placeholder': '메시지 입력...',
  'chat.listening': '듣는 중... 말하면 텍스트가 돼요',
  'chat.recording': '녹음 중... 마이크를 다시 누르면 중지',
  'chat.newChat': '새 채팅',
  'chat.recent': '최근',
  'chat.loginToSave': '로그인하면 대화가 저장돼요',
  'chat.online': '온라인',
  'chat.selectModel': 'AI 모델 선택',
  'chat.guest': '게스트',
  'chat.settings': '설정',
  'chat.noLimit': '아니요, 됐어요',
  'status.thinking': '생각 중…',
  'status.searching': '웹 검색 중…',
  'status.reading': '출처 읽는 중…',
  'status.generating': '답변 생성 중…',
  'sources.title': '출처',
  'chat.limitMoved': '제한 — 이동됨:',
  'chat.limitOut': '제한 — 할당량 소진',

  'mode.general': '일반',
  'mode.learning': '학습',
  'mode.research': '리서치',
  'mode.brainstorm': '브레인스토밍',
  'mode.support': '상담',
  'mode.assignment': '과제',

  'settings.title': '설정',
  'settings.profile': '프로필',
  'settings.chatPrefs': '채팅 설정',
  'settings.modelDefault': '기본 모델',
  'settings.modeDefault': '기본 모드',
  'settings.stt': '음성 입력 언어',
  'settings.close': '닫기',
  'settings.savedInBrowser': '설정은 이 브라우저에 저장되며 다음 채팅에 적용돼요.',

  'mode.document': '문서',

  'chat.loading': '불러오는 중...',
  'chat.loadFail': '대화를 불러오지 못했습니다 (HTTP {status}). 다시 클릭하세요.',
  'chat.loadFailGeneric': '대화를 불러오지 못했습니다.',
  'chat.modelUnavailable': '서버에 API 키 미설정',
  'chat.groqNote': 'Groq는 서버 .env의 GROQ_API_KEY가 필요합니다.',
  'chat.limitOutTitle': '모델 한도에 도달했습니다. 나중에 다시 시도하거나 모델을 바꾸거나 설정 → 할당량 및 제한을 확인하세요.',
  'chat.limitFallbackTitle': '선택한 모델이 한도에 걸려 자동으로 다른 모델이 답변했습니다.',

  'settings.loading': '불러오는 중...',
  'settings.avatar': '아바타 색상',
  'settings.joined': '가입일',
  'settings.conversations': '대화',
  'settings.messages': '메시지',
  'settings.daysActive': '활동 일수',
  'settings.editName': '이름 변경',
  'settings.copyEmail': '이메일 복사',
  'settings.nameEmpty': '이름을 비워둘 수 없습니다.',
  'settings.nameSaved': '이름이 저장됐습니다.',
  'settings.changePw': '비밀번호 변경',
  'settings.currentPw': '현재 비밀번호',
  'settings.newPw': '새 비밀번호 (6자 이상)',
  'settings.repeatPw': '새 비밀번호 확인',
  'settings.savePw': '비밀번호 저장',
  'settings.pwFillAll': '모든 칸을 입력하세요.',
  'settings.pwMismatch': '비밀번호 확인이 일치하지 않습니다.',
  'settings.pwSaved': '비밀번호가 변경됐습니다.',
  'settings.danger': '위험 구역',
  'settings.wipe': '모든 대화 삭제',
  'settings.wipeConfirm': '정말요? 다시 누르면 모든 대화가 삭제됩니다',
  'settings.delAccount': '계정 삭제',
  'settings.delAccountConfirm': '정말요? 다시 누르면 계정과 데이터가 영구 삭제됩니다',
  'settings.wipeFail': '기록 삭제 실패. 다시 시도하세요.',
  'settings.delFail': '계정 삭제 실패.',
  'settings.guestTitle': '게스트',
  'settings.guestDesc': '로그인하면 채팅이 영구 저장됩니다',
  'settings.logout': '로그아웃',
  'settings.quota': '할당량 및 제한',
  'settings.quotaGroq': '무료: 30req/분 • 1,000req/일 • 20만 토큰/일',
  'settings.quotaGemini': 'Google AI Studio 한도 적용 (대시보드 참조)',
  'settings.quotaNote': '한도에 걸리면 BroAgent가 자동으로 다른 모델로 바꾸고 채팅 상단에 LIMIT 배지를 표시합니다. 답변 아래 작은 “via …”가 실제 답변 모델을 보여줍니다.',
  'settings.keyMissing': '키 없음',
  'settings.defaultBadge': '기본',
  'settings.save': '저장',
  'settings.cancel': '취소',

  'attach.title': '첨부',
  'attach.photo': '사진 및 갤러리',
  'attach.photoDesc': '기존 사진 선택',
  'attach.camera': '카메라',
  'attach.cameraDesc': '지금 촬영',
  'attach.doc': '텍스트 문서',
  'attach.docDesc': '.txt .md .csv .json 코드',
  'attach.preparing': '첨부 준비 중...',
  'attach.remove': '첨부 제거',
  'attach.openTitle': '첨부 (사진, 카메라, 문서)',
  'mic.titleOn': '말하면 텍스트로',
  'mic.titleOff': '이 브라우저는 음성 입력을 지원하지 않습니다',
  'mic.unsupported': '이 브라우저는 음성 입력을 지원하지 않습니다. 데스크톱 Chrome/Edge를 사용하세요.',
  'mic.denied': '마이크 권한이 거부됐습니다. 주소창 자물쇠 아이콘에서 마이크를 허용하세요.',
  'mic.noSpeech': '음성이 들리지 않습니다. 마이크에 가까이 말하세요.',
  'mic.noMic': '마이크를 찾을 수 없습니다. 연결을 확인하세요.',
  'mic.failed': '음성 입력 실패. 다시 시도하세요.',
  'mic.startFail': '마이크를 켤 수 없습니다. 다시 시도하세요.',

  'attachErr.tooManyImages': '메시지당 이미지는 {n}장까지입니다.',
  'attachErr.imageTooBig': '"{name}"이 너무 큽니다 (최대 10MB).',
  'attachErr.unreadable': '"{name}"을 읽을 수 없습니다(iPhone HEIC 등). JPG/PNG나 다시 캡처해 보세요.',
  'attachErr.textTooBig': '"{name}"은 텍스트 파일로 너무 큽니다 (최대 512KB).',
  'attachErr.emptyFile': '"{name}"이 비어 있습니다.',
  'attachErr.readFail': '"{name}" 읽기 실패.',
  'attachErr.videoNo': '비디오는 아직 미지원입니다. 이미지나 텍스트로 보내세요.',
  'attachErr.officeNo': '"{name}"({ext})은 아직 미지원입니다. 이미지로 캡처하거나 .txt로 변환하세요.',
  'attachErr.formatNo': '"{name}" 형식은 미지원입니다. 이미지(JPG/PNG)나 텍스트 파일을 보낼 수 있습니다.',

  'bubble.document': '문서',
  'bubble.edit': '편집',
  'bubble.regenerate': '다시 생성',
  'bubble.save': '저장',
  'bubble.sendRevision': '수정본 전송',
  'bubble.cancel': '취소',
  'bubble.saveNote': '저장은 이번 세션 보기에만 반영됩니다. 수정본 전송은 AI에게 새 버전 작성을 요청합니다.',
  'bubble.savedFlash': '이 보기에 저장됐습니다',
  'bubble.revisePrefix': '다음 문서를 고치고 확장해줘:',

  'copy.label': '복사',
  'copy.done': '복사됨',
  'copy.fail': '실패',
  'copy.failTitle': '복사 실패',

  'table.name': '표',
  'table.cols': '열',
  'table.rows': '행',
  'table.empty': '(빈 표)',
  'table.copyTsv': 'TSV 복사',
  'code.name': 'code',
  'doc.fallbackTitle': 'AI 답변',
};

const STRINGS: Record<AppLang, Dict> = { en, ar, id, ru, zh, ja, ko };

export function t(lang: AppLang, key: string): string {
  const code = normalizeLang(lang);
  return STRINGS[code]?.[key] ?? en[key] ?? key;
}

/** translate + interpolasi `{name}` sederhana. */
export function tx(lang: AppLang, key: string, vars: Record<string, string | number> = {}): string {
  let s = t(lang, key);
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/** Locale untuk format tanggal per bahasa UI. */
export function localeForLang(lang: AppLang): string {
  switch (normalizeLang(lang)) {
    case 'ar': return 'ar-SA';
    case 'id': return 'id-ID';
    case 'ru': return 'ru-RU';
    case 'zh': return 'zh-CN';
    case 'ja': return 'ja-JP';
    case 'ko': return 'ko-KR';
    default: return 'en-US';
  }
}

/** Judul fallback dokumen di semua bahasa (untuk deteksi "bukan judul asli"). */
export const FALLBACK_DOC_TITLES: ReadonlySet<string> = new Set(
  (Object.keys(STRINGS) as AppLang[]).map((l) => t(l, 'doc.fallbackTitle')),
);

// ── React hook ────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';

export function useAppLanguage(): { lang: AppLang; setLang: (l: AppLang) => AppLang; tt: (key: string) => string } {
  const [lang, setLangState] = useState<AppLang>(() =>
    typeof window !== 'undefined' ? getStoredLang() : DEFAULT_LANG,
  );

  useEffect(() => {
    applyLangToDocument(getStoredLang());
    const onChange = (e: Event) => {
      const code = normalizeLang((e as CustomEvent)?.detail ?? getStoredLang());
      setLangState(code);
    };
    window.addEventListener('bro-lang-changed', onChange);
    return () => window.removeEventListener('bro-lang-changed', onChange);
  }, []);

  const setLang = useCallback((l: AppLang) => {
    const code = setStoredLang(l);
    setLangState(code);
    return code;
  }, []);

  const tt = useCallback((key: string) => t(lang, key), [lang]);

  return { lang, setLang, tt };
}
