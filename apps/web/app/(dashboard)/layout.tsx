import { MessageSquare, History, UserCircle } from 'lucide-react';
import Sidebar from '@/components/shared/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh bg-[#0a0a0f] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col min-w-0 min-h-0">
        {children}
      </main>
    </div>
  );
}
