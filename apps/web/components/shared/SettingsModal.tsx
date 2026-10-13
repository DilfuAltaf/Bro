'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, UserCircle, LogOut, Cpu, Check, Gauge, Globe, Mic, MessageSquare,
  Pencil, Copy, KeyRound, Trash2, TriangleAlert,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const PREF_KEYS = {
  model: 'bro-model',
  mode: 'bro-mode',
  sttLang: 'bro-stt-lang',
  avatar: 'bro-avatar-color',
} as const;

export function notifySettingsChanged() {
  window.dispatchEvent(new CustomEvent('bro-settings-changed'));
}

export function notifyProfileChanged() {
  window.dispatchEvent(new CustomEvent('bro-profile-changed'));
}

const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6f4', '#a855f7'];

function formatJoinDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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
  provider: 'gemini' | 'groq';
  description: string;
  available?: boolean;
};

const FALLBACK_LLM_MODELS: LlmModelOption[] = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', provider: 'gemini', description: 'Cepat & hemat kuota' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini', description: 'Lebih pintar untuk reasoning' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (Groq)', provider: 'groq', description: 'Serbaguna & multibahasa' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', provider: 'groq', description: 'Flagship open-weight' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)', provider: 'groq', description: 'Ringan & cepat' },
];

const MODE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'learning', label: 'Learning' },
  { value: 'research', label: 'Research' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'support', label: 'Support' },
  { value: 'assignment', label: 'Assignment' },
];

const STT_LANGS = [
  { value: 'id-ID', label: 'Indonesia' },
  { value: 'en-US', label: 'English (US)' },
];

/** Info kuota jujur: angka Groq dari dokumentasi resmi; Gemini ikut Google AI Studio. */
function quotaText(m: LlmModelOption): string {
  if (m.provider === 'groq') {
    return 'Gratis: 30 req/mnt • 1.000 req/hari • 200 rb token/hari';
  }
  return 'Ikut batas Google AI Studio (cek dashboard)';
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
  const [sttLang, setSttLang] = useState('id-ID');
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
  const [dangerMsg, setDangerMsg] = useState<string | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDefaultModel(readPref(PREF_KEYS.model, FALLBACK_LLM_MODELS[0]!.id));
    setDefaultMode(readPref(PREF_KEYS.mode, 'general'));
    setSttLang(readPref(PREF_KEYS.sttLang, 'id-ID'));
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
      .then((data) => setUser(data?.user || null))
      .catch(() => setUser(null))
      .finally(() => setUserLoaded(true));

    fetch(`${API_URL}/auth/stats`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.conversations === 'number') setStats(data);
        else setStats(null);
      })
      .catch(() => setStats(null));

    fetch(`${API_URL}/gemini/models`, { credentials: 'include' })
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

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* abaikan */ }
    window.location.href = '/';
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameMsg({ ok: false, text: 'Nama tidak boleh kosong.' });
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
      if (!res.ok) throw new Error(data?.message || 'Gagal menyimpan nama.');
      setUser(data.user);
      setEditingName(false);
      setNameMsg({ ok: true, text: 'Nama tersimpan.' });
      notifyProfileChanged();
    } catch (err: any) {
      setNameMsg({ ok: false, text: err.message || 'Gagal menyimpan nama.' });
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
      setPwMsg({ ok: false, text: 'Isi semua kolom password.' });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ ok: false, text: 'Konfirmasi password tidak sama.' });
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
      if (!res.ok) throw new Error(data?.message || 'Gagal mengganti password.');
      setPwMsg({ ok: true, text: 'Password berhasil diganti.' });
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.message || 'Gagal mengganti password.' });
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
      setDangerMsg('Gagal menghapus riwayat. Coba lagi.');
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
      if (!res.ok) throw new Error('Gagal menghapus akun.');
      window.location.href = '/';
    } catch (err: any) {
      setDangerMsg(err.message || 'Gagal menghapus akun.');
      setDangerBusy(false);
      setArmed(null);
    }
  };

  const selectCls =
    'w-full bg-[#09090B] border border-[#24242D] rounded-lg px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#8B8B98]';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#111116] border border-[#24242D] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#24242D] sticky top-0 bg-[#111116]">
          <h2 className="text-base font-semibold text-[#F5F5F5]">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#24242D] rounded-lg transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* ── Profil ─────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-[#8B8B98] mb-2">Profil</h3>
            {!userLoaded ? (
              <p className="text-sm text-[#8B8B98]">Memuat...</p>
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
                          title="Simpan"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingName(false); setNameMsg(null); }}
                          className="p-1.5 text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D] rounded-lg"
                          title="Batal"
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
                          title="Ubah nama"
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
                          title="Salin email"
                        >
                          {copiedEmail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-[#5b5b68] mt-0.5">
                      Bergabung {formatJoinDate(user.createdAt || stats?.memberSince)}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#24242D] text-[#8B8B98] hover:text-[#F5F5F5] hover:border-[#8B8B98] transition-colors shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
                {nameMsg && (
                  <p className={`text-xs ${nameMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{nameMsg.text}</p>
                )}

                {/* Warna avatar */}
                <div>
                  <div className="text-xs text-[#8B8B98] mb-1.5">Warna avatar</div>
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
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-2.5 text-center">
                    <div className="text-lg font-bold text-[#F5F5F5]">{stats ? stats.conversations : '…'}</div>
                    <div className="text-[11px] text-[#8B8B98]">Percakapan</div>
                  </div>
                  <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-2.5 text-center">
                    <div className="text-lg font-bold text-[#F5F5F5]">{stats ? stats.messages : '…'}</div>
                    <div className="text-[11px] text-[#8B8B98]">Pesan</div>
                  </div>
                  <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-2.5 text-center">
                    <div className="text-lg font-bold text-[#F5F5F5]">{activeDays(user.createdAt || stats?.memberSince)}</div>
                    <div className="text-[11px] text-[#8B8B98]">Hari aktif</div>
                  </div>
                </div>

                {/* Ganti password */}
                <div className="bg-[#09090B] border border-[#24242D] rounded-xl p-3">
                  <button
                    onClick={() => { setPwOpen((v) => !v); setPwMsg(null); }}
                    className="w-full flex items-center gap-2 text-sm text-[#c9c9d4] hover:text-[#F5F5F5] transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-[#8B8B98]" />
                    <span className="font-medium">Ganti password</span>
                  </button>
                  {pwOpen && (
                    <div className="mt-2.5 space-y-2">
                      <input
                        type="password"
                        value={pwCurrent}
                        onChange={(e) => setPwCurrent(e.target.value)}
                        placeholder="Password saat ini"
                        className="w-full bg-[#16161D] text-[#F5F5F5] text-sm px-3 py-2 rounded-lg outline-none border border-[#24242D] focus:border-[#8B8B98] placeholder:text-[#5b5b68]"
                      />
                      <input
                        type="password"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        placeholder="Password baru (min. 6 karakter)"
                        className="w-full bg-[#16161D] text-[#F5F5F5] text-sm px-3 py-2 rounded-lg outline-none border border-[#24242D] focus:border-[#8B8B98] placeholder:text-[#5b5b68]"
                      />
                      <input
                        type="password"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        placeholder="Ulangi password baru"
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
                        {savingPw ? 'Menyimpan...' : 'Simpan password'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Danger zone */}
                <div className="border border-red-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-red-400">
                    <TriangleAlert className="w-3.5 h-3.5" /> Zona berbahaya
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
                    {armed === 'convs' ? 'Yakin? Klik lagi untuk hapus SEMUA percakapan' : 'Hapus semua percakapan'}
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
                    {armed === 'account' ? 'Yakin? Klik lagi — akun + data hilang permanen' : 'Hapus akun'}
                  </button>
                  {dangerMsg && <p className="text-xs text-red-400">{dangerMsg}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-[#09090B] border border-[#24242D] rounded-xl p-3">
                <UserCircle className="w-10 h-10 text-[#8B8B98] shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#F5F5F5]">Guest User</div>
                  <div className="text-xs text-[#8B8B98]">Login agar chat tersimpan permanen</div>
                </div>
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#F5F5F5] text-[#09090B] font-medium"
                >
                  Login
                </Link>
              </div>
            )}
          </section>

          {/* ── Preferensi chat ────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-[#8B8B98] mb-2">
              Preferensi chat
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <Cpu className="w-3.5 h-3.5" /> Model default
                </span>
                <select
                  value={models.some((m) => m.id === defaultModel) ? defaultModel : models[0]!.id}
                  onChange={(e) => save(PREF_KEYS.model, e.target.value, setDefaultModel)}
                  className={selectCls}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.available === false}>
                      {m.label} [{m.provider}]{m.available === false ? ' (key belum diisi)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Mode default
                </span>
                <select
                  value={defaultMode}
                  onChange={(e) => save(PREF_KEYS.mode, e.target.value, setDefaultMode)}
                  className={selectCls}
                >
                  {MODE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c9d4] mb-1">
                  <Mic className="w-3.5 h-3.5" /> Bahasa voice-to-text
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
                Preferensi tersimpan di browser ini dan langsung berlaku untuk chat berikutnya.
              </p>
            </div>
          </section>

          {/* ── Kuota & limit ──────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-[#8B8B98] mb-2">
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> Kuota & limit
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        m.provider === 'groq'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-sky-500/15 text-sky-400'
                      }`}>
                        {m.provider}
                      </span>
                      {m.available === false && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-amber-500/15 text-amber-400">
                          key kosong
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8B8B98] mt-1 flex items-center gap-1">
                      <Globe className="w-3 h-3 shrink-0" /> {quotaText(m)}
                    </div>
                  </div>
                  {defaultModel === m.id && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" /> default
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#5b5b68] mt-2">
              Kena limit → BroAgent otomatis pindah ke model lain dan menampilkan logo LIMIT
              di header chat. Label kecil “via …” di bawah balasan menunjukkan model yang dipakai.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
