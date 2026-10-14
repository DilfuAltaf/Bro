'use client';

import Link from 'next/link';
import { MessageSquare, HeartHandshake, Search, Lightbulb, GraduationCap, FileText, Briefcase, Globe } from 'lucide-react';
import { useState } from 'react';
import { SUPPORTED_LANGUAGES, setLangPicked, useAppLanguage } from '@/lib/i18n';

export default function LandingPage() {
  const { lang, setLang, tt } = useAppLanguage();
  const [langOpen, setLangOpen] = useState(false);

  const skills = [
    { title: tt('mode.support'), mode: "support", icon: <HeartHandshake className="w-6 h-6" />, desc: tt('skill.support.desc') },
    { title: tt('mode.research'), mode: "research", icon: <Search className="w-6 h-6" />, desc: tt('skill.research.desc') },
    { title: tt('mode.brainstorm'), mode: "brainstorm", icon: <Lightbulb className="w-6 h-6" />, desc: tt('skill.brainstorm.desc') },
    { title: tt('mode.learning'), mode: "learning", icon: <GraduationCap className="w-6 h-6" />, desc: tt('skill.learning.desc') },
    { title: tt('mode.assignment'), mode: "assignment", icon: <Briefcase className="w-6 h-6" />, desc: tt('skill.assignment.desc') },
    { title: tt('mode.document'), mode: "document", icon: <FileText className="w-6 h-6" />, desc: tt('skill.document.desc') }
  ];

  const active = SUPPORTED_LANGUAGES.find((l) => l.code === lang);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 selection:bg-indigo-500/30">
      {/* Language switcher */}
      <header className="max-w-6xl mx-auto px-6 pt-6 flex justify-end">
        <div className="relative">
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1a24] border border-[#2e2e3d] hover:border-indigo-500/50 text-sm transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>{active?.flag} {active?.label}</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#12121a] border border-[#2e2e3d] rounded-xl shadow-xl py-1 z-50 max-h-80 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setLangPicked(); setLangOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1a1a24] transition-colors text-left ${l.code === lang ? 'text-white bg-[#1a1a24]' : 'text-slate-300'}`}
                >
                  <span className="text-xl">{l.flag}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{l.label}</span>
                    <span className="block text-xs text-slate-500">{l.native}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 flex flex-col items-center justify-center min-h-[80vh] text-center">
        
        {/* Hero Section */}
        <div className="relative mb-12 flex items-center justify-center gap-6">
          <div className="absolute inset-0 bg-blue-500 blur-[100px] opacity-20 rounded-full"></div>
          <img src="/logo.png" alt="BroAgent Logo" className="w-20 h-20 md:w-28 md:h-28 relative z-10 object-contain drop-shadow-2xl" />
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight relative z-10">
            <span className="text-slate-400">Bro</span>
            <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400 text-transparent bg-clip-text">Agent</span>
          </h1>
        </div>
        
        <p className="text-2xl md:text-4xl font-semibold mb-6 text-slate-200 max-w-3xl">
          {tt('app.tagline')}
        </p>
        
        <p className="text-lg md:text-xl text-slate-300 mb-4 max-w-2xl">
          {tt('app.description')}
        </p>
        
        <p className="text-md md:text-lg text-slate-400 mb-12 max-w-3xl">
          {tt('app.subtag')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link 
            href="/chat"
            className="group relative inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
          >
            <MessageSquare className="w-5 h-5 group-hover:animate-pulse" />
            <span>{tt('app.start')}</span>
          </Link>
          <a
            href="#capabilities"
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105"
          >
            {tt('app.explore')}
          </a>
        </div>

        {/* Skills Grid */}
        <div id="capabilities" className="mt-32 w-full">
          <h2 className="text-2xl font-bold mb-10 text-slate-300">{tt('app.capabilities')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map((skill, idx) => (
              <Link 
                href={`/chat?mode=${skill.mode}`}
                key={idx} 
                className="group block bg-[#1a1a24] border border-[#2e2e3d] p-6 rounded-2xl flex flex-col items-center text-center hover:border-indigo-500/50 hover:bg-[#20202a] transition-all cursor-pointer"
              >
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  {skill.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-indigo-400 transition-colors">{skill.title}</h3>
                <p className="text-slate-400">{skill.desc}</p>
              </Link>
            ))}
          </div>
        </div>
        
      </main>
    </div>
  );
}
