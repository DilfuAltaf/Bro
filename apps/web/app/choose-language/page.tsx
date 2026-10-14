'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  getStoredLang,
  setLangPicked,
  setStoredLang,
  syncLangFromServer,
  t,
  useAppLanguage,
  type AppLang,
} from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ChooseLanguagePage() {
  const router = useRouter();
  const { lang: uiLang, setLang } = useAppLanguage();
  const [selected, setSelected] = useState<AppLang>('en');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guard race: fetch /auth/me yang lambat tidak boleh menimpa pilihan manual user.
  const interactedRef = useRef(false);

  useEffect(() => {
    const stored = getStoredLang();
    setSelected(stored);
    // Kalau user sudah punya bahasa di server, pakai itu sebagai preselect
    // — kecuali user keburu tap pilihan sendiri.
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (interactedRef.current) return;
        if (data?.user) {
          setSelected(syncLangFromServer(data.user.language));
        }
      })
      .catch(() => { /* guest / offline — pakai stored */ });
  }, []);

  // Live-preview: sekali tap langsung ganti seluruh tulisan (kecuali logo),
  // tanpa perlu buka Settings. Pilihan final dikunci saat Continue.
  const pick = (code: AppLang) => {
    interactedRef.current = true;
    setSelected(code);
    setLang(code);
    setError(null);
  };

  const handleContinue = async () => {
    setSaving(true);
    setError(null);
    setStoredLang(selected);
    // Bahasa kelar → lanjut ke langkah purpose. Onboarding BARU selesai di sana.
    setLangPicked();
    try {
      // Simpan ke server bila sudah login; guest (401) diabaikan.
      await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: selected }),
      }).catch(() => null);
    } finally {
      setSaving(false);
    }
    router.push('/choose-purpose');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-slate-200 p-6">
      <div className="w-full max-w-2xl bg-[#12121a] border border-[#2e2e3d] rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <img src="/logo.png" alt="BroAgent" className="w-10 h-10 object-contain" />
          <h1 className="text-2xl font-bold">{t(uiLang, 'lang.chooseTitle')}</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">{t(uiLang, 'lang.chooseDesc')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = selected === l.code;
            return (
              <button
                key={l.code}
                onClick={() => pick(l.code)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                    : 'border-[#2e2e3d] bg-[#1a1a24] hover:border-indigo-500/50'
                }`}
              >
                <span className="text-3xl">{l.flag}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[#F5F5F5]">{l.label}</span>
                  <span className="block text-sm text-slate-400 truncate">{l.native}</span>
                </span>
                <span
                  className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                    active ? 'bg-indigo-600 border-indigo-600' : 'border-[#3a3a4a]'
                  }`}
                >
                  {active && <Check className="w-4 h-4 text-white" />}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          onClick={() => void handleContinue()}
          disabled={saving}
          className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? t(uiLang, 'lang.saving') : t(uiLang, 'lang.continue')}
        </button>
      </div>
    </div>
  );
}
