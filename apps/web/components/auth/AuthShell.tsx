'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, setLangPicked, useAppLanguage } from '@/lib/i18n';

export const authInputCls =
  'w-full bg-[#1a1a24] border border-[#2e2e3d] rounded-xl px-4 py-2.5 text-[#F5F5F5] placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition';

export const authButtonCls =
  'w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 text-white font-semibold py-3 rounded-xl transition-all hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2';

function LangSwitcher() {
  const { lang, setLang } = useAppLanguage();
  const [open, setOpen] = useState(false);
  const active = SUPPORTED_LANGUAGES.find((l) => l.code === lang);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a24] border border-[#2e2e3d] hover:border-indigo-500/50 text-xs text-slate-300 transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{active?.flag} {active?.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-2rem)] bg-[#12121a] border border-[#2e2e3d] rounded-xl shadow-xl py-1 z-50 max-h-72 overflow-y-auto">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              type="button"
              key={l.code}
              onClick={() => { setLang(l.code); setLangPicked(); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[#1a1a24] transition-colors text-left ${l.code === lang ? 'text-white bg-[#1a1a24]' : 'text-slate-300'}`}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{l.label}</span>
                <span className="block text-[10px] text-slate-500 truncate">{l.native}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  minLength,
  autoComplete = 'current-password',
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
  required?: boolean;
}) {
  const { tt } = useAppLanguage();
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-sm mb-1.5 text-slate-400">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          autoComplete={autoComplete}
          required={required}
          className={`${authInputCls} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          title={show ? tt('auth.hidePw') : tt('auth.showPw')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-200 rounded-lg transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function AuthShell({
  title,
  error,
  children,
  footer,
}: {
  title: string;
  error?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { tt } = useAppLanguage();

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-slate-100 flex items-center justify-center p-4 sm:p-6 overflow-x-clip selection:bg-indigo-500/30">
      {/* glow ala landing */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[min(640px,120vw)] h-[320px] bg-indigo-600/20 blur-[120px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-48 left-1/2 -translate-x-1/2 w-[min(520px,110vw)] h-[260px] bg-blue-500/10 blur-[120px] rounded-full" />

      <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-10">
        <LangSwitcher />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 sm:gap-3 mb-3">
          <img src="/logo.png" alt="BroAgent Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-2xl shrink-0" />
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight whitespace-nowrap">
            <span className="text-slate-400">Bro</span>
            <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400 text-transparent bg-clip-text">Agent</span>
          </span>
        </Link>
        <p className="text-center text-sm text-slate-400 mb-5 sm:mb-6 px-2">{tt('app.tagline')}</p>

        <div className="bg-[#12121a]/90 backdrop-blur border border-[#2e2e3d] rounded-2xl p-5 sm:p-8 shadow-2xl">
          <h1 className="text-xl sm:text-2xl font-bold text-center mb-5 sm:mb-6">{title}</h1>

          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {children}

          {footer && (
            <p className="mt-6 text-center text-sm text-slate-400">
              {footer}
            </p>
          )}
        </div>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {tt('auth.backHome')}
        </Link>
      </div>
    </div>
  );
}
