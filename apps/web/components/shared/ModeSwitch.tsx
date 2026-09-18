'use client';

import { MessageSquare, MicOff } from 'lucide-react';

export default function ModeSwitch() {
  return (
    <div className="flex items-center bg-[#1a1a24] p-1 rounded-lg border border-[#2e2e3d]">
      <div className="px-3 py-1.5 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="w-4 h-4" />
        Text
      </div>
      <div className="px-3 py-1.5 text-slate-500 flex items-center gap-2 text-sm font-medium cursor-not-allowed group relative">
        <MicOff className="w-4 h-4" />
        Voice
        <span className="absolute right-0 top-full mt-2 px-2 py-1 bg-[#2e2e3d] text-xs text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
          Voice coming soon
        </span>
      </div>
    </div>
  );
}
