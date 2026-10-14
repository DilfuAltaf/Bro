'use client';

import { useEffect } from 'react';
import { applyLangToDocument, getStoredLang } from '@/lib/i18n';

export default function LanguageInit() {
  useEffect(() => {
    applyLangToDocument(getStoredLang());
  }, []);
  return null;
}
