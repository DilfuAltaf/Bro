'use client';

import Link from 'next/link';
import { MessageSquarePlus, Clock, Settings, LogOut, UserCircle, Pencil, Trash2, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SettingsModal from './SettingsModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Sidebar() {
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();

  const loadHistory = () => {
    fetch(`${API_URL}/conversations`, { credentials: 'include' })
      .then(res => {
        if (res && res.ok) return res.json();
        return [];
      })
      .then(data => setHistory(data))
      .catch(console.error);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await fetch(`${API_URL}/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: editTitle.trim() })
      });
      setHistory(prev => prev.map(c => c.id === id ? { ...c, title: editTitle.trim() } : c));
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_URL}/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setHistory(prev => prev.filter(c => c.id !== id));
      
      // If we are currently on the deleted chat, redirect to /chat
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('conversationId') === id) {
        router.push('/chat');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then(data => {
        setUser(data.user);
        return fetch(`${API_URL}/conversations`, { credentials: 'include' });
      })
      .then(res => {
        if (res && res.ok) return res.json();
        return [];
      })
      .then(data => setHistory(data))
      .catch(() => setUser(null));

    const handleNewConv = () => {
      loadHistory();
    };
    window.addEventListener('conversationCreated', handleNewConv);
    return () => window.removeEventListener('conversationCreated', handleNewConv);
  }, []);

  // Refresh nama user saat profil diubah dari Settings.
  useEffect(() => {
    const refreshUser = () => {
      fetch(`${API_URL}/auth/me`, { credentials: 'include' })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.user) setUser(data.user);
        })
        .catch(() => { /* abaikan */ });
    };
    window.addEventListener('bro-profile-changed', refreshUser);
    return () => window.removeEventListener('bro-profile-changed', refreshUser);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
      setUser(null);
      setHistory([]);
      router.push('/');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className="w-64 bg-[#09090B] border-r border-[#24242D] flex flex-col h-full text-[#F5F5F5]">
      <div className="p-5 border-b border-[#24242D]">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="BroAgent Logo" className="w-8 h-8 object-contain rounded-md" />
          <div className="text-xl font-semibold tracking-tight text-[#F5F5F5]">BroAgent</div>
        </Link>
      </div>
      
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-3">
        <Link 
          href="/chat"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#F5F5F5] hover:bg-[#16161D] transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4 text-[#8B8B98]" />
          <span className="text-sm font-medium">New Chat</span>
        </Link>
        
        {user ? (
          <div className="mt-4 flex flex-col gap-1">
            <h3 className="text-xs font-medium text-[#8B8B98] px-3 py-2 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Recent
            </h3>
            {history.map(conv => (
              <div key={conv.id} className="group relative flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#111116] transition-colors">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-2 w-full" onClick={(e) => e.preventDefault()}>
                    <input 
                      type="text" 
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(conv.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-[#16161D] text-[#F5F5F5] text-sm px-2 py-1 rounded outline-none border border-[#24242D] focus:border-[#8B8B98]"
                      autoFocus
                    />
                    <button onClick={(e) => { e.preventDefault(); handleSaveEdit(conv.id); }} className="text-emerald-500 hover:text-emerald-400">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); setEditingId(null); }} className="text-[#8B8B98] hover:text-[#F5F5F5]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Link href={`/chat?conversationId=${conv.id}`} className="block flex-1 text-sm text-[#8B8B98] hover:text-[#F5F5F5] truncate transition-colors">
                      {conv.title || 'Conversation'}
                    </Link>
                    <div className="hidden group-hover:flex items-center gap-1.5 absolute right-2 bg-[#111116] pl-2">
                      <button onClick={(e) => {
                        e.preventDefault();
                        setEditingId(conv.id);
                        setEditTitle(conv.title || 'Conversation');
                      }} className="text-[#8B8B98] hover:text-[#F5F5F5] transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => {
                        e.preventDefault();
                        handleDelete(conv.id);
                      }} className="text-[#8B8B98] hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 px-3 text-center">
            <p className="text-xs text-[#8B8B98] mb-3">Login to save your conversations</p>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="text-sm bg-[#16161D] hover:bg-[#24242D] text-[#F5F5F5] py-2 rounded-lg transition-colors">Login</Link>
              <Link href="/register" className="text-sm text-[#8B8B98] hover:text-[#F5F5F5] py-1">Register</Link>
            </div>
          </div>
        )}
      </nav>
      
      <div className="p-3 border-t border-[#24242D] space-y-1">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#111116] transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Settings</span>
        </button>
        {user ? (
          <div className="flex items-center justify-between px-3 py-2.5 text-[#8B8B98] hover:bg-[#111116] rounded-lg group">
            <div className="flex items-center gap-3">
              <UserCircle className="w-4 h-4 group-hover:text-[#F5F5F5]" />
              <span className="text-sm font-medium truncate max-w-[100px] group-hover:text-[#F5F5F5]">{user.name || user.email}</span>
            </div>
            <button onClick={handleLogout} className="text-[#8B8B98] hover:text-[#F5F5F5]">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2.5 text-[#8B8B98]">
            <UserCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Guest User</span>
          </div>
        )}
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
