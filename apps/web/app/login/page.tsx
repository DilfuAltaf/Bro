'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isLangPicked, normalizePurpose, setLangPicked, setStoredPurpose, syncLangFromServer, useAppLanguage } from '@/lib/i18n';
import AuthShell, { PasswordField, authButtonCls, authInputCls } from '@/components/auth/AuthShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const { tt } = useAppLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      
      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      // Sinkronkan bahasa + purpose dari server, lalu lanjutkan onboarding
      // dari langkah yang belum selesai (bahasa dulu, baru purpose).
      try {
        const meRes = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
        const me = meRes.ok ? await meRes.json().catch(() => null) : null;
        // Adopsi server hanya bila belum pernah milih di browser ini,
        // biar pilihan lokal nggak ketimpa default server.
        syncLangFromServer(me?.user?.language);
        const serverPurpose = normalizePurpose(me?.user?.purpose);
        if (serverPurpose) setStoredPurpose(serverPurpose);
        if (!isLangPicked()) {
          router.push('/choose-language');
          return;
        }
        const onboarded = (() => {
          try { return localStorage.getItem('bro-onboarded'); } catch { return null; }
        })();
        if (!onboarded) {
          // Bahasa sudah kepilih → langsung ke langkah purpose (prefill dari server).
          setLangPicked();
          router.push('/choose-purpose');
          return;
        }
      } catch { /* abaikan — lanjut ke chat */ }
      
      router.push('/chat');
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title={tt('auth.welcome')}
      error={error}
      footer={<>{tt('auth.donthave')} <Link href="/register" className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium">{tt('auth.register')}</Link></>}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm mb-1.5 text-slate-400">{tt('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={authInputCls}
            required
          />
        </div>
        <PasswordField
          label={tt('auth.password')}
          value={password}
          onChange={setPassword}
          placeholder={tt('auth.passwordPh')}
          autoComplete="current-password"
        />

        <button type="submit" disabled={isLoading} className={`${authButtonCls} mt-2`}>
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {tt('auth.loggingIn')}
            </>
          ) : (
            tt('auth.login')
          )}
        </button>
      </form>
    </AuthShell>
  );
}
