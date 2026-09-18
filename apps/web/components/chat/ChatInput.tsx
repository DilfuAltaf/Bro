'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

type Props = {
  onSend: (message: string) => void;
  disabled?: boolean;
};

export default function ChatInput({ onSend, disabled }: Props) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (content.trim() && !disabled) {
      onSend(content);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  return (
    <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-[#1a1a24] border border-[#2e2e3d] p-2 rounded-2xl focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Ketik pesan..."
        disabled={disabled}
        rows={1}
        className="flex-1 max-h-[150px] bg-transparent resize-none outline-none text-slate-200 p-2 placeholder:text-slate-500 custom-scrollbar disabled:opacity-50"
        style={{ minHeight: '40px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !content.trim()}
        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#2e2e3d] disabled:text-slate-500 text-white rounded-xl transition-colors shrink-0 mb-0.5"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}
