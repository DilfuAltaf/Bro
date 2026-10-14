'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearOnboardingFlags, getStoredLang, useAppLanguage } from '@/lib/i18n';
import AuthShell, { PasswordField, authButtonCls, authInputCls } from '@/components/auth/AuthShell';

export default function RegisterPage() {
  const { tt } = useAppLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, language: getStoredLang() }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to register');
      }
      
      // Wajib onboarding ulang dari langkah bahasa (default: English).
      clearOnboardingFlags();
      router.push('/choose-language');
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title={tt('auth.create')}
      error={error}
      footer={<>{tt('auth.already')} <Link href="/login" className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium">{tt('auth.login')}</Link></>}
    >
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm mb-1.5 text-slate-400">{tt('auth.name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={tt('auth.namePh')}
            autoComplete="name"
            className={authInputCls}
            required
          />
        </div>
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
          placeholder={tt('auth.newPasswordPh')}
          minLength={6}
          autoComplete="new-password"
        />

        <button type="submit" disabled={isLoading} className={`${authButtonCls} mt-2`}>
          {isLoading ? tt('auth.registering') : tt('auth.register')}
        </button>
      </form>
    </AuthShell>
  );
}
