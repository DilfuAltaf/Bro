import Link from 'next/link';
import { MessageSquare, HeartHandshake, Search, Lightbulb, GraduationCap, FileText, Briefcase } from 'lucide-react';

export default function LandingPage() {
  const skills = [
    { title: "Support", icon: <HeartHandshake className="w-6 h-6" />, desc: "Emotional support and guidance" },
    { title: "Research", icon: <Search className="w-6 h-6" />, desc: "Deep dive into any topic" },
    { title: "Brainstorm", icon: <Lightbulb className="w-6 h-6" />, desc: "Generate ideas and solutions" },
    { title: "Learning", icon: <GraduationCap className="w-6 h-6" />, desc: "Learn new concepts easily" },
    { title: "Assignment", icon: <Briefcase className="w-6 h-6" />, desc: "Help with your tasks" },
    { title: "Document", icon: <FileText className="w-6 h-6" />, desc: "Review and analyze texts" }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 selection:bg-indigo-500/30">
      <main className="max-w-6xl mx-auto px-6 py-24 flex flex-col items-center justify-center min-h-[80vh] text-center">
        
        {/* Hero Section */}
        <div className="relative mb-12 inline-block">
          <div className="absolute inset-0 bg-indigo-500 blur-[80px] opacity-20 rounded-full"></div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight relative z-10 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
            BroAgent
          </h1>
        </div>
        
        <p className="text-2xl md:text-3xl font-medium mb-6 text-slate-200 max-w-3xl">
          An AI companion you can talk to when you don't know who to talk to.
        </p>
        
        <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl">
          One agent. Multiple capabilities. One continuous conversation.
        </p>
        
        <Link 
          href="/chat"
          className="group relative inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
        >
          <MessageSquare className="w-5 h-5 group-hover:animate-pulse" />
          <span>Start Chatting</span>
        </Link>

        {/* Skills Grid */}
        <div className="mt-32 w-full">
          <h2 className="text-2xl font-bold mb-10 text-slate-300">Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map((skill, idx) => (
              <div key={idx} className="bg-[#1a1a24] border border-[#2e2e3d] p-6 rounded-2xl flex flex-col items-center text-center hover:border-indigo-500/50 transition-colors">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl mb-4">
                  {skill.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{skill.title}</h3>
                <p className="text-slate-400">{skill.desc}</p>
              </div>
            ))}
          </div>
        </div>
        
      </main>
    </div>
  );
}
