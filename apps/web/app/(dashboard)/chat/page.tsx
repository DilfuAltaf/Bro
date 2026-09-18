'use client';

import { useState, useEffect } from 'react';
import ChatWindow from '@/components/chat/ChatWindow';
import ChatInput from '@/components/chat/ChatInput';
import ModeSwitch from '@/components/shared/ModeSwitch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const USER_ID = 'default-user'; // Mock user

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
};

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    
    try {
      let currentConvId = conversationId;
      
      // Create conversation if none exists
      if (!currentConvId) {
        const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        const convRes = await fetch(`${API_URL}/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: USER_ID, title })
        });
        
        if (!convRes.ok) throw new Error('Failed to create conversation');
        const convData = await convRes.json();
        currentConvId = convData.id;
        setConversationId(convData.id);
      }
      
      // Send message
      const msgRes = await fetch(`${API_URL}/conversations/${currentConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, senderType: 'user' })
      });
      
      if (!msgRes.ok) throw new Error('Failed to send message');
      const responseData = await msgRes.json();
      
      // Add AI reply
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: responseData.assistantMessage?.content || responseData.content || "Sorry, I couldn't generate a response.",
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMsg]);
      
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'An error occurred while communicating with the server.');
      // Optional: remove user message or show error state
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <header className="h-16 border-b border-[#2e2e3d] flex items-center justify-between px-6 shrink-0 bg-[#12121a]">
        <h1 className="font-semibold text-lg text-slate-200">
          {conversationId ? 'Active Conversation' : 'New Conversation'}
        </h1>
        <div className="flex items-center gap-4">
          {error && <span className="text-red-400 text-sm">{error}</span>}
          <ModeSwitch />
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <div className="p-4 border-t border-[#2e2e3d] bg-[#12121a]">
          <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
