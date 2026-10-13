'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { Loader2, GraduationCap, Microscope, Lightbulb, FileText } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
};

type Props = {
  messages: Message[];
  isLoading: boolean;
  onModeSelect?: (mode: string) => void;
  onSendMessage?: (text: string) => void;
  onRegenerateMessage?: (aiMessageId: string) => void;
};

export default function ChatWindow({ messages, isLoading, onModeSelect, onSendMessage, onRegenerateMessage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="mb-6 flex flex-col items-center justify-center">
            <img src="/logo.png" alt="AI" className="w-16 h-16 object-contain mb-4" />
            <h2 className="text-3xl font-semibold text-[#F5F5F5] mb-2">What can I help with?</h2>
            <p className="text-sm text-[#8B8B98] mb-8">Your personal AI assistant for thinking, learning, and creating.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
          <button onClick={() => onModeSelect?.('learning')} className="flex flex-col items-start p-4 bg-[#111116] border border-[#24242D] rounded-xl hover:bg-[#16161D] transition-colors group">
            <GraduationCap className="w-5 h-5 text-[#8B8B98] group-hover:text-[#F5F5F5] mb-2" />
            <span className="text-sm font-medium text-[#F5F5F5]">Learning</span>
            <span className="text-xs text-[#8B8B98] mt-1 text-left">Explain concepts clearly and test my knowledge</span>
          </button>
          
          <button onClick={() => onModeSelect?.('research')} className="flex flex-col items-start p-4 bg-[#111116] border border-[#24242D] rounded-xl hover:bg-[#16161D] transition-colors group">
            <Microscope className="w-5 h-5 text-[#8B8B98] group-hover:text-[#F5F5F5] mb-2" />
            <span className="text-sm font-medium text-[#F5F5F5]">Research</span>
            <span className="text-xs text-[#8B8B98] mt-1 text-left">Deep dive into topics and gather information</span>
          </button>

          <button onClick={() => onModeSelect?.('brainstorm')} className="flex flex-col items-start p-4 bg-[#111116] border border-[#24242D] rounded-xl hover:bg-[#16161D] transition-colors group">
            <Lightbulb className="w-5 h-5 text-[#8B8B98] group-hover:text-[#F5F5F5] mb-2" />
            <span className="text-sm font-medium text-[#F5F5F5]">Brainstorm</span>
            <span className="text-xs text-[#8B8B98] mt-1 text-left">Generate ideas and creative solutions</span>
          </button>

          <button onClick={() => onModeSelect?.('assignment')} className="flex flex-col items-start p-4 bg-[#111116] border border-[#24242D] rounded-xl hover:bg-[#16161D] transition-colors group">
            <FileText className="w-5 h-5 text-[#8B8B98] group-hover:text-[#F5F5F5] mb-2" />
            <span className="text-sm font-medium text-[#F5F5F5]">Assignment</span>
            <span className="text-xs text-[#8B8B98] mt-1 text-left">Help me complete my tasks and homework</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {(() => {
          let lastAiId: string | null = null;
          for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
            if (messages[idx]!.role === 'ai' && messages[idx]!.content) {
              lastAiId = messages[idx]!.id;
              break;
            }
          }
          return messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSend={onSendMessage}
              onRegenerate={onRegenerateMessage}
              showFollowUps={msg.role === 'ai' && msg.id === lastAiId}
              sendingDisabled={isLoading}
            />
          ));
        })()}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#111116] border border-[#24242D] flex items-center justify-center shrink-0">
                 <img src="/logo.png" alt="AI" className="w-5 h-5 object-contain" />
              </div>
              <div className="px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#8B8B98] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-[#8B8B98] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-[#8B8B98] rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
