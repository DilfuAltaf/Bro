import Link from 'next/link';
import { MessageSquare, History, UserCircle } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0a0a0f] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#12121a] border-r border-[#2e2e3d] flex flex-col">
        <div className="p-6 border-b border-[#2e2e3d]">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 text-transparent bg-clip-text block text-center">
            BroAgent
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link 
            href="/chat"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20 transition-colors font-medium"
          >
            <MessageSquare className="w-5 h-5" />
            Chat
          </Link>
          
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 cursor-not-allowed group relative">
            <History className="w-5 h-5" />
            History
            <span className="absolute left-full ml-2 px-2 py-1 bg-[#2e2e3d] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Coming soon
            </span>
          </div>
        </nav>
        
        <div className="p-4 border-t border-[#2e2e3d]">
          <div className="flex items-center gap-3 px-4 py-3 text-slate-400">
            <UserCircle className="w-6 h-6" />
            <span className="text-sm font-medium">Guest User</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
