'use client';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
};

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  const timeString = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div 
          className={`px-5 py-3.5 rounded-2xl text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap shadow-sm
            ${isUser 
              ? 'bg-indigo-600 rounded-tr-sm text-white' 
              : 'bg-[#1a1a24] border border-[#2e2e3d] rounded-tl-sm'
            }
          `}
        >
          {message.content}
        </div>
        <span className="text-xs text-slate-500 px-1">{timeString}</span>
      </div>
    </div>
  );
}
