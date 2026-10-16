'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  X, UserCircle, LogOut, Cpu, Check, Gauge, Globe, Mic, MessageSquare,
  Pencil, Copy, KeyRound, Trash2, TriangleAlert, Languages, Target,
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_PURPOSES,
  getStoredLang,
  getStoredPurpose,
  isLangPicked,
  localeForLang,
  normalizeLang,
  normalizePurpose,
  purposeDefaultMode,
  setLangPicked,
  setStoredLang,
  setStoredPurpose,
  sttForLang,
  syncLangFromServer,
  t as tr,
  type AppLang,
  type AppPurpose,
} from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const PREF_KEYS = {
  model: 'bro-model',
  mode: 'bro-mode',
  sttLang: 'bro-stt-lang',
  avatar: 'bro-avatar-color',
  lang: 'bro-lang',
} as const;

export function notifySettingsChanged() {
  window.dispatchEvent(new CustomEvent('bro-settings-changed'));
}

export function notifyProfileChanged() {
  window.dispatchEvent(new CustomEvent('bro-profile-changed'));
}

const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6f4', '#a855f7'];

function formatJoinDate(iso: string | null | undefined, lang: AppLang = 'en'): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString(localeForLang(lang), { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

function activeDays(iso: string | null | undefined): number {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 1;
  return Math.max(1, Math.ceil(diff / 86_400_000));
}

type LlmModelOption = {
  id: string;
  label: string;
  provider: 'gemini' | 'groq' | 'openrouter';
  description: string;
  available?: boolean;
};

/** Warna badge per provider. */
function providerBadge(provider: string): string {
  if (provider === 'groq') return 'bg-emerald-500/15 text-emerald-400';
  if (provider === 'openrouter') return 'bg-violet-500/15 text-violet-400';
  return 'bg-sky-500/15 text-sky-400';
}

const FALLBACK_LLM_MODELS: LlmModelOption[] = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', provider: 'gemini', description: 'Fast & quota-friendly' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini', description: 'Smarter for reasoning' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (Groq)', provider: 'groq', description: 'Versatile & multilingual' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', provider: 'groq', description: 'Flagship open-weight' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)', provider: 'groq', description: 'Light & fast' },
  { id: 'moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code (OR)', provider: 'openrouter', description: 'Agentic coding flagship' },
  { id: 'qwen/qwen3-coder-plus', label: 'Qwen3 Coder Plus (OR)', provider: 'openrouter', description: 'Strong coder, 1M context' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat (OR)', provider: 'openrouter', description: 'Cheap & smart all-rounder' },
  { id: 'x-ai/grok-code-fast-1', label: 'Grok Code Fast (OR)', provider: 'openrouter', description: 'Very fast & cheap for code' },
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 (OR)', provider: 'openrouter', description: 'Best coding quality (paid)' },
];

const MODE_OPTIONS = [
  { value: 'general', labelKey: 'mode.general' },
  { value: 'learning', labelKey: 'mode.learning' },
  { value: 'research', labelKey: 'mode.research' },
  { value: 'brainstorm', labelKey: 'mode.brainstorm' },
  { value: 'support', labelKey: 'mode.support' },
  { value: 'assignment', labelKey: 'mode.assignment' },
];

const STT_LANGS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'ar-SA', label: 'Arabic (العربية)' },
  { value: 'id-ID', label: 'Indonesia' },
  { value: 'ru-RU', label: 'Russian (Русский)' },
  { value: 'zh-CN', label: 'Chinese (简体中文)' },
  { value: 'ja-JP', label: 'Japanese (日本語)' },
  { value: 'ko-KR', label: 'Korean (한국어)' },
];

/** Info kuota jujur: Groq gratis; OpenRouter ikut kredit; Gemini ikut Google AI Studio. */
function quotaText(m: LlmModelOption, lang: AppLang = 'en'): string {
  if (m.provider === 'groq') {
    return tr(lang, 'settings.quotaGroq');
  }
  if (m.provider === 'openrouter') {
    return tr(lang, 'settings.quotaOpenRouter');
  }
  return tr(lang, 'settings.quotaGemini');
}

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsModal({ open, onClose }: Props) {
  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [models, setModels] = useState<LlmModelOption[]>(FALLBACK_LLM_MODELS);
  const [defaultModel, setDefaultModel] = useState(FALLBACK_LLM_MODELS[0]!.id);
  const [defaultMode, setDefaultMode] = useState('general');
  const [sttLang, setSttLang] = useState('en-US');
  const [uiLang, setUiLang] = useState<AppLang>('en');
  const [purpose, setPurpose] = useState<AppPurpose | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]!);
  // Edit nama
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  // Stats
  const [stats, setStats] = useState<{ memberSince: string | null; conversations: number; messages: number } | null>(null);
  // Ganti password
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);
    // Danger zone (konfirmasi dua langkah)
  const [armed, setArmed] = useState<'convs' | 'account' | null>(null);
  // Guard race: fetch /auth/me yang lambat tidak boleh menimpa pilihan
  // yang baru saja diubah user di dalam modal ini.
  const langTouchedRef = useRef(false);
  const purposeTouchedRef = useRef(false);  const [dangerMsg, setDangerMsg] = useState<string | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    langTouchedRef.current = false;
    purposeTouchedRef.current = false;
    setDefaultModel(readPref(PREF_KEYS.model, FALLBACK_LLM_MODELS[0]!.id));
    setDefaultMode(readPref(PREF_KEYS.mode, 'general'));
    const storedLang = getStoredLang();
    setUiLang(storedLang);
    setSttLang(readPref(PREF_KEYS.sttLang, sttForLang(storedLang)));
    setPurpose(getStoredPurpose());
    setAvatarColor(readPref(PREF_KEYS.avatar, AVATAR_COLORS[0]!));
    setUserLoaded(false);
    setEditingName(false);
    setNameMsg(null);
    setPwOpen(false);
    setPwMsg(null);
    setArmed(null);
    setDangerMsg(null);

    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data?.user || null);
        // Sinkronkan server -> lokal, tapi jangan timpa yang baru diubah user.
        if (data?.user?.language && !langTouchedRef.current && !isLangPicked()) {
          setUiLang(syncLangFromServer(data.user.language));
        }
        const serverPurpose = normalizePurpose(data?.user?.purpose);
        if (serverPurpose && !purposeTouchedRef.current) {
          setPurpose(serverPurpose);
          setStoredPurpose(serverPurpose);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setUserLoaded(true));

    fetch(`${API_URL}/auth/stats`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.conversations === 'number') setStats(data);
        else setStats(null);
      })
      .catch(() => setStats(null));

    fetch(`${API_URL}/gemini/models?lang=${getStoredLang()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setModels(data);
      })
      .catch(() => { /* pakai fallback */ });

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = (key: string, value: string, apply: (v: string) => void) => {
    try {
      localStorage.setItem(key, value);
    } catch { /* abaikan */ }
    apply(value);
    notifySettingsChanged();
  };

  const saveLanguage = async (code: AppLang) => {
    const normalized = normalizeLang(code);
    langTouchedRef.current = true;
    setUiLang(normalized);
    setStoredLang(normalized);
    setLangPicked();
    // Ikutkan STT agar voice-to-text langsung cocok dengan bahasa pilihan.
    setSttLang(sttForLang(normalized));
    notifySettingsChanged();
    // Deskripsi model ikut bahasa baru saat itu juga.
    fetch(`${API_URL}/gemini/models?lang=${normalized}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setModels(data);
      })
      .catch(() => { /* pakai yang ada */ });
    try {
      await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: normalized }),
      });
    } catch { /* guest / offline — bahasa tetap tersimpan lokal */ }
  };

  const savePurpose = async (code: AppPurpose) => {
    const normalized = normalizePurpose(code);
    if (!normalized) return;
    purposeTouchedRef.current = true;
    setPurpose(normalized);
    setStoredPurpose(normalized);
    // Mode default chat ikut purpose (tetap bisa diganti manual di bawah).
    save(PREF_KEYS.mode, purposeDefaultMode(normalized), setDefaultMode);
    notifySettingsChanged();
    try {
      await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ purpose: normalized }),
      });
    } catch { /* guest / offline — purpose tetap tersimpan lokal */ }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* abaikan */ }
    window.location.href = '/';
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameMsg({ ok: false, text: tr(uiLang, 'settings.nameEmpty') });
      return;
    }
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || tr(uiLang, 'settings.nameEmpty'));
      setUser(data.user);
      setEditingName(false);
      setNameMsg({ ok: true, text: tr(uiLang, 'settings.nameSaved') });
      notifyProfileChanged();
    } catch (err: any) {
      setNameMsg({ ok: false, text: err.message || tr(uiLang, 'settings.nameEmpty') });
    } finally {
      setSavingName(false);
    }
  };

  const copyEmail = async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch { /* clipboard tidak tersedia */ }
  };

  const savePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      setPwMsg({ ok: false, text: tr(uiLang, 'settings.pwFillAll') });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ ok: false, text: tr(uiLang, 'settings.pwMismatch') });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Error');
      setPwMsg({ ok: true, text: tr(uiLang, 'settings.pwSaved') });
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.message || 'Error' });
    } finally {
      setSavingPw(false);
    }
  };

  const pickAvatar = (color: string) => {
    setAvatarColor(color);
    try {
      localStorage.setItem(PREF_KEYS.avatar, color);
    } catch { /* abaikan */ }
    notifyProfileChanged();
  };

  const wipeConversations = async () => {
    if (armed !== 'convs') {
      setArmed('convs');
      setDangerMsg(null);
      return;
    }
    setDangerBusy(true);
    setDangerMsg(null);
    try {
      const listRes = await fetch(`${API_URL}/conversations`, { credentials: 'include' });
      const list = listRes.ok ? await listRes.json().catch(() => []) : [];
      const ids: string[] = Array.isArray(list) ? list.map((c: any) => c.id).filter(Boolean) : [];
      for (const id of ids) {
        await fetch(`${API_URL}/conversations/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
      }
      window.location.href = '/chat';
    } catch {
      setDangerMsg(tr(uiLang, 'settings.wipeFail'));
      setDangerBusy(false);
      setArmed(null);
    }
  };

  const removeAccount = async () => {
    if (armed !== 'account') {
      setArmed('account');
      setDangerMsg(null);
      return;
    }
    setDangerBusy(true);
    try {
      const res = await fetch(`${API_URL}/auth/me`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(tr(uiLang, 'settings.delFail'));
      window.location.href = '/';
    } catch (err: any) {
      setDangerMsg(err.message || tr(uiLang, 'settings.delFail'));
      setDangerBusy(false);
      setArmed(null);
    }
  };

  const selectCls =
    'w-full bg-[#09090B] border border-[#24242D] rounded-lg px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#8B8B98]';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92dvh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#111116] border border-[#24242D] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-[#24242D] sticky top-0 bg-[#111116] z-10">
          <h2 className="text-base font-semibold text-[#F5F5F5]">{tr(uiLang, 'settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#24242D] rounded-lg transition-colors"
            title={tr(uiLang, 'settings.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-6">
          {/* ── Profil ─────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-[#8B8B98] mb-2">{tr(uiLang, 'settings.profile')}</h3>
            {!userLoaded ? (
              <p className="text-sm text-[#8B8B98]">{tr(uiLang, 'settings.loading')}</p>
            ) : user ? (
              <div className="space-y-3">
                {/* Identitas + avatar */}
                <div className="flex items-center gap-3 bg-[#09090B] border border-[#24242D] rounded-xl p-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                    style={{ backgroundColor: `${avatarColor}26`, color: avatarColor }}
                  >
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void saveName(); }}
                          maxLength={50}
                          autoFocus
                          className="flex-1 min-w-0 bg-[#16161D] text-[#F5F5F5] text-sm px-2 py-1.5 rounded-lg outline-none border border-[#24242D] focus:border-[#8B8B98]"
                        />
                        <button
                          onClick={() => void saveName()}
                          disabled={savingName}
                          className="p-1.5 text-emerald-400 hover:bg-[#16161D] rounded-lg disabled:opacity-50"
                          title={tr(uiLang, 'settings.save')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingName(false); setNameMsg(null); }}
                          className="p-1.5 text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D] rounded-lg"
                          title={tr(uiLang, 'settings.cancel')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[#F5F5F5] truncate">
                          {user.name || 'User'}
                        </span>
                        <button
                          onClick={() => { setNameDraft(user.name || ''); setEditingName(true); setNameMsg(null); }}
                          className="p-1 text-[#8B8B98] hover:text-[#F5F5F5] rounded transition-colors shrink-0"
                          title={tr(uiLang, 'settings.editName')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-[#8B8B98] truncate">{user.email || ''}</span>
                      {user.email && (
                        <button
                          onClick={() => void copyEmail()}
                          className="p-0.5 text-[#8B8B98] hover:text-[#F5F5F5] rounded shrink-0"
                          title={tr(uiLang, 'settings.copyEmail')}
                        >
                          {copiedEmail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-[#5b5b68] mt-0.5">
                      {tr(uiLang, 'settings.joined')} {formatJoinDate(user.createdAt || stats?.memberSince, uiLang)}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#24242D] text-[#8B8B98] hover:text-[#F5F5F5] hover:border-[#8B8B98] transition-colors shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.logout')}
                  </button>
                </div>
                {nameMsg && (
                  <p className={`text-xs ${nameMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{nameMsg.text}</p>
                )}

                {/* Warna avatar */}
                <div>
                  <div className="text-xs text-[#8B8B98] mb-1.5">{tr(uiLang, 'settings.avatar')}</div>
                  <div className="flex items-center gap-2">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => pickAvatar(c)}
                        title={c}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${avatarColor === c ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Statistik */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-2 sm:p-2.5 text-center min-w-0">
                    <div className="text-base sm:text-lg font-bold text-[#F5F5F5] truncate">{stats ? stats.conversations : '…'}</div>
                    <div className="text-[10px] sm:text-[11px] text-[#8B8B98] leading-tight">{tr(uiLang, 'settings.conversations')}</div>
                  </div>
                  <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-2 sm:p-2.5 text-center min-w-0">
                    <div className="text-base sm:text-lg font-bold text-[#F5F5F5] truncate">{stats ? stats.messages : '…'}</div>
                    <div className="text-[10px] sm:text-[11px] text-[#8B8B98] leading-tight">{tr(uiLang, 'settings.messages')}</div>
                  </div>
                  <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-2 sm:p-2.5 text-center min-w-0">
                    <div className="text-base sm:text-lg font-bold text-[#F5F5F5] truncate">{activeDays(user.createdAt || stats?.memberSince)}</div>
                    <div className="text-[10px] sm:text-[11px] text-[#8B8B98] leading-tight">{tr(uiLang, 'settings.daysActive')}</div>
                  </div>
                </div>

                {/* Ganti password */}
                <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-3">
                  <button
                    onClick={() => { setPwOpen((v) => !v); setPwMsg(null); }}
                    className="w-full flex items-center gap-2 text-sm text-[#c9c9d4] hover:text-[#F5F5F5] transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-[#8B8B98]" />
                    <span className="font-medium">{tr(uiLang, 'settings.changePw')}</span>
                  </button>
                  {pwOpen && (
                    <div className="mt-2.5 space-y-2">
                      <input
                        type="password"
                        value={pwCurrent}
                        onChange={(e) => setPwCurrent(e.target.value)}
                        placeholder={tr(uiLang, 'settings.currentPw')}
                        className="w-full bg-[#16161D] text-[#F5F5F5] text-sm px-3 py-2 rounded-lg outline-none border border-[#24242D] focus:border-[#8B8B98] placeholder:text-[#5b5b68]"
                      />
                      <input
                        type="password"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        placeholder={tr(uiLang, 'settings.newPw')}
                        className="w-full bg-[#16161D] text-[#F5F5F5] text-sm px-3 py-2 rounded-lg outline-none border border-[#24242D] focus:border-[#8B8B98] placeholder:text-[#5b5b68]"
                      />
                      <input
                        type="password"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        placeholder={tr(uiLang, 'settings.repeatPw')}
                        className="w-full bg-[#16161D] text-[#F5F5F5] text-sm px-3 py-2 rounded-lg outline-none border border-[#24242D] focus:border-[#8B8B98] placeholder:text-[#5b5b68]"
                      />
                      {pwMsg && (
                        <p className={`text-xs ${pwMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{pwMsg.text}</p>
                      )}
                      <button
                        onClick={() => void savePassword()}
                        disabled={savingPw}
                        className="px-4 py-2 text-sm rounded-lg bg-[#F5F5F5] text-[#09090B] font-medium disabled:opacity-50"
                      >
                        {savingPw ? tr(uiLang, 'lang.saving') : tr(uiLang, 'settings.savePw')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Danger zone */}
                <div className="border border-red-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-red-400">
                    <TriangleAlert className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.danger')}
                  </div>
                  <button
                    onClick={() => void wipeConversations()}
                    disabled={dangerBusy}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                      armed === 'convs'
                        ? 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'border-[#24242D] text-[#8B8B98] hover:text-red-300 hover:border-red-500/40'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {armed === 'convs' ? tr(uiLang, 'settings.wipeConfirm') : tr(uiLang, 'settings.wipe')}
                  </button>
                  <button
                    onClick={() => void removeAccount()}
                    disabled={dangerBusy}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                      armed === 'account'
                        ? 'bg-red-600/30 border-red-500 text-red-200'
                        : 'border-[#24242D] text-[#8B8B98] hover:text-red-300 hover:border-red-500/40'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {armed === 'account' ? tr(uiLang, 'settings.delAccountConfirm') : tr(uiLang, 'settings.delAccount')}
                  </button>
                  {dangerMsg && <p className="text-xs text-red-400">{dangerMsg}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-[#09090B] border border-[#24242D] rounded-xl p-3">
                <UserCircle className="w-10 h-10 text-[#8B8B98] shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#F5F5F5]">{tr(uiLang, 'settings.guestTitle')}</div>
                  <div className="text-xs text-[#8B8B98]">{tr(uiLang, 'settings.guestDesc')}</div>
                </div>
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#F5F5F5] text-[#09090B] font-medium"
                >
                  {tr(uiLang, 'auth.login')}
                </Link>
              </div>
            )}
          </section>

          {/* ── Preferensi chat ────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-[#8B8B98] mb-2">
              {tr(uiLang, 'settings.chatPrefs')}
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <Languages className="w-3.5 h-3.5" /> {tr(uiLang, 'lang.appAndAi')}
                </span>
                <select
                  value={uiLang}
                  onChange={(e) => void saveLanguage(normalizeLang(e.target.value))}
                  className={selectCls}
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.label} — {l.native}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <Target className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.purpose')}
                </span>
                <select
                  value={purpose || ''}
                  onChange={(e) => {
                    const next = normalizePurpose(e.target.value);
                    if (next) void savePurpose(next);
                  }}
                  className={selectCls}
                >
                  {/* Netral untuk user lama yang belum memilih */}
                  {!purpose && <option value="" disabled>—</option>}
                  {SUPPORTED_PURPOSES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {tr(uiLang, `purpose.${p.code}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <Cpu className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.modelDefault')}
                </span>
                <select
                  value={models.some((m) => m.id === defaultModel) ? defaultModel : models[0]!.id}
                  onChange={(e) => save(PREF_KEYS.model, e.target.value, setDefaultModel)}
                  className={selectCls}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.available === false}>
                      {m.label} [{m.provider}]{m.available === false ? ` (${tr(uiLang, 'chat.modelUnavailable')})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <MessageSquare className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.modeDefault')}
                </span>
                <select
                  value={defaultMode}
                  onChange={(e) => save(PREF_KEYS.mode, e.target.value, setDefaultMode)}
                  className={selectCls}
                >
                  {MODE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{tr(uiLang, m.labelKey)}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <Mic className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.stt')}
                </span>
                <select
                  value={sttLang}
                  onChange={(e) => save(PREF_KEYS.sttLang, e.target.value, setSttLang)}
                  className={selectCls}
                >
                  {STT_LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] text-[#5b5b68]">
                {tr(uiLang, 'settings.savedInBrowser')}
              </p>
            </div>
          </section>

          {/* ── Kuota & limit ──────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-[#8B8B98] mb-2">
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.quota')}
              </span>
            </h3>
            <div className="space-y-2">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-3 bg-[#09090B] border border-[#24242D] rounded-xl p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#F5F5F5]">{m.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${providerBadge(m.provider)}`}>
                        {m.provider}
                      </span>
                      {m.available === false && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-amber-500/15 text-amber-400">
                          {tr(uiLang, 'settings.keyMissing')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8B8B98] mt-1 flex items-center gap-1">
                      <Globe className="w-3 h-3 shrink-0" /> {quotaText(m, uiLang)}
                    </div>
                  </div>
                  {defaultModel === m.id && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" /> {tr(uiLang, 'settings.defaultBadge')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#5b5b68] mt-2">
              {tr(uiLang, 'settings.quotaNote')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
