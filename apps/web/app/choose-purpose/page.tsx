'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Check,
  Code,
  GraduationCap,
  HeartHandshake,
  Microscope,
  Sparkles,
} from 'lucide-react';
import {
  SUPPORTED_PURPOSES,
  getStoredPurpose,
  normalizePurpose,
  purposeDefaultMode,
  setStoredPurpose,
  t,
  useAppLanguage,
  type AppPurpose,
} from '@/lib/i18n';
import { PREF_KEYS } from '@/components/shared/SettingsModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PURPOSE_ICONS: Record<AppPurpose, typeof Briefcase> = {
  work: Briefcase,
  study: GraduationCap,
  personal: HeartHandshake,
  developer: Code,
  creator: Sparkles,
  research: Microscope,
};

export default function ChoosePurposePage() {
  const router = useRouter();
  const { lang: uiLang } = useAppLanguage();
  const [selected, setSelected] = useState<AppPurpose | null>(null);
  const [saving, setSaving] = useState(false);
  // Guard race: fetch lambat tidak boleh menimpa pilihan manual user.
  const pickedRef = useRef(false);

  useEffect(() => {
    const stored = getStoredPurpose();
    if (stored) {
      setSelected(stored);
      return;
    }
    // Prefill dari server bila sudah pernah memilih (login di device baru).
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (pickedRef.current) return;
        const serverPurpose = normalizePurpose(data?.user?.purpose);
        if (serverPurpose) {
          setSelected(serverPurpose);
          setStoredPurpose(serverPurpose);
        }
      })
      .catch(() => { /* guest / offline */ });
  }, []);

  const handleContinue = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setStoredPurpose(selected);
    try {
      // Mode default chat langsung ikut purpose (bisa diganti kapan saja).
      localStorage.setItem(PREF_KEYS.mode, purposeDefaultMode(selected));
    } catch { /* ignore */ }
    try {
      localStorage.setItem('bro-onboarded', '1');
    } catch { /* ignore */ }
    try {
      // Simpan ke server bila sudah login; guest (401) diabaikan.
      await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ purpose: selected }),
      }).catch(() => null);
    } finally {
      setSaving(false);
    }
    router.push('/chat');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-slate-200 p-6">
      <div className="w-full max-w-2xl bg-[#12121a] border border-[#2e2e3d] rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <img src="/logo.png" alt="BroAgent" className="w-10 h-10 object-contain" />
          <h1 className="text-2xl font-bold">{t(uiLang, 'purpose.title')}</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">{t(uiLang, 'purpose.desc')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPORTED_PURPOSES.map((p) => {
            const Icon = PURPOSE_ICONS[p.code];
            const active = selected === p.code;
            return (
              <button
                key={p.code}
                onClick={() => { pickedRef.current = true; setSelected(p.code); }}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                    : 'border-[#2e2e3d] bg-[#1a1a24] hover:border-indigo-500/50'
                }`}
              >
                <span
                  className={`p-2.5 rounded-lg shrink-0 ${
                    active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-[#24242e] text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[#F5F5F5]">{t(uiLang, `purpose.${p.code}`)}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">{t(uiLang, `purpose.${p.code}Desc`)}</span>
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

        <button
          onClick={() => void handleContinue()}
          disabled={!selected || saving}
          className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? t(uiLang, 'lang.saving') : t(uiLang, 'lang.continue')}
        </button>
      </div>
    </div>
  );
}
