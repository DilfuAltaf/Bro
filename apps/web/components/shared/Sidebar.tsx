'use client';

import Link from 'next/link';
import { MessageSquarePlus, Clock, Settings, LogOut, UserCircle, Pencil, Trash2, Check, X, TriangleAlert, PanelLeftClose } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import SettingsModal from './SettingsModal';
import { tx, useAppLanguage } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Lebar sidebar desktop (bisa digeser), tersimpan di localStorage.
const SB_MIN_W = 200;
const SB_MAX_W = 420;
const SB_DEFAULT_W = 256;
const SB_WIDTH_KEY = 'bro-sidebar-width';
const SB_COLLAPSED_KEY = 'bro-sidebar-collapsed';

export default function Sidebar() {
  const { lang, tt } = useAppLanguage();
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Target hapus yang menunggu konfirmasi (tidak langsung hapus).
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Drawer di mobile: tertutup default, dibuka via tombol hamburger di header chat.
  const [mobileOpen, setMobileOpen] = useState(false);
  // Collapse (desktop) + lebar geser (desktop). Persist biar nempel.
  const [collapsed, setCollapsed] = useState(false);
  const [sbWidth, setSbWidth] = useState(SB_DEFAULT_W);
  const sbWidthRef = useRef(SB_DEFAULT_W);
  const router = useRouter();
  const pathname = usePathname();

  // Baca preferensi tersimpan (client only).
  useEffect(() => {
    try {
      const w = parseInt(localStorage.getItem(SB_WIDTH_KEY) || '', 10);
      if (Number.isFinite(w)) {
        const clamped = Math.min(SB_MAX_W, Math.max(SB_MIN_W, w));
        setSbWidth(clamped);
        sbWidthRef.current = clamped;
      }
      if (localStorage.getItem(SB_COLLAPSED_KEY) === '1') setCollapsed(true);
    } catch { /* abaikan */ }
  }, []);

  const setCollapsedPersist = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(SB_COLLAPSED_KEY, v ? '1' : '0');
    } catch { /* abaikan */ }
  };

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
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Delete failed');
      setHistory(prev => prev.filter(c => c.id !== id));
      
      // If we are currently on the deleted chat, redirect to /chat
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('conversationId') === id) {
        router.push('/chat');
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // Tutup modal konfirmasi dengan Escape.
  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteTarget(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteTarget]);

  // Toggle hamburger: di layar md+ (laptop) buka/tutup sidebar,
  // di bawah itu (HP / browser dikecilin) buka/tutup drawer.
  const isDesktopWidth = () =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

  // Drawer mobile: dengarkan toggle dari header chat + tutup saat pindah halaman.
  useEffect(() => {
    const onToggle = () => {
      if (isDesktopWidth()) {
        setCollapsed((v) => {
          const next = !v;
          try {
            localStorage.setItem(SB_COLLAPSED_KEY, next ? '1' : '0');
          } catch { /* abaikan */ }
          return next;
        });
      } else {
        setMobileOpen((v) => !v);
      }
    };
    const onClose = () => setMobileOpen(false);
    window.addEventListener('bro-sidebar-toggle', onToggle);
    window.addEventListener('bro-sidebar-close', onClose);
    return () => {
      window.removeEventListener('bro-sidebar-toggle', onToggle);
      window.removeEventListener('bro-sidebar-close', onClose);
    };
  }, []);

  // Geser tepi kanan sidebar buat gede-kecilin (desktop, pointer drag).
  const startResize = (e: React.PointerEvent) => {
    if (!isDesktopWidth()) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = sbWidthRef.current;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(SB_MAX_W, Math.max(SB_MIN_W, startW + ev.clientX - startX));
      sbWidthRef.current = next;
      setSbWidth(next);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(SB_WIDTH_KEY, String(sbWidthRef.current));
      } catch { /* abaikan */ }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const resetWidth = () => {
    sbWidthRef.current = SB_DEFAULT_W;
    setSbWidth(SB_DEFAULT_W);
    try {
      localStorage.setItem(SB_WIDTH_KEY, String(SB_DEFAULT_W));
    } catch { /* abaikan */ }
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Kunci scroll body saat drawer mobile terbuka.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

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
    <>
      {/* Backdrop drawer (mobile saja) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        style={{ '--sb-width': `${sbWidth}px` } as React.CSSProperties}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col h-full text-[#F5F5F5] bg-[#09090B] border-r border-[#24242D] w-72 max-w-[85vw] transition-transform duration-300 ease-out md:static md:relative md:z-auto md:w-[var(--sb-width,16rem)] md:max-w-none md:translate-x-0 md:shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:hidden' : ''}`}
      >
      <div className="p-5 border-b border-[#24242D] flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-3 min-w-0" onClick={() => setMobileOpen(false)}>
          <img src="/logo.png" alt="BroAgent Logo" className="w-8 h-8 object-contain rounded-md shrink-0" />
          <div className="text-xl font-semibold tracking-tight text-[#F5F5F5] truncate">BroAgent</div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D] rounded-lg transition-colors shrink-0"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCollapsedPersist(true)}
          className="hidden md:block p-1.5 text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D] rounded-lg transition-colors shrink-0"
          title="Sembunyikan sidebar"
          aria-label="Hide sidebar"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>
      
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 min-h-0">
        <Link 
          href="/chat"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#F5F5F5] hover:bg-[#16161D] transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4 text-[#8B8B98]" />
          <span className="text-sm font-medium">{tt('chat.newChat')}</span>
        </Link>
        
        {user ? (
          <div className="mt-4 flex flex-col gap-1">
            <h3 className="text-xs font-medium text-[#8B8B98] px-3 py-2 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> {tt('chat.recent')}
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
                    <Link href={`/chat?conversationId=${conv.id}`} onClick={() => setMobileOpen(false)} className="block flex-1 min-w-0 text-sm text-[#8B8B98] hover:text-[#F5F5F5] truncate transition-colors">
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
                        setDeleteTarget({ id: conv.id, title: conv.title || 'Conversation' });
                      }} className="text-[#8B8B98] hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </nav>
      
      <div className="p-3 border-t border-[#24242D] space-y-1">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#111116] transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">{tt('chat.settings')}</span>
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
            <span className="text-sm font-medium">{tt('chat.guest')}</span>
          </div>
        )}
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Modal konfirmasi hapus history */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-4"
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
        >
          <div
            className="w-full max-w-sm bg-[#111116] border border-[#24242D] rounded-2xl shadow-2xl p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <TriangleAlert className="w-4 h-4 text-red-400" />
              </span>
              <h2 className="text-base font-semibold text-[#F5F5F5]">{tt('history.deleteTitle')}</h2>
            </div>
            <p className="text-sm text-[#8B8B98] mb-5">
              {tx(lang, 'history.deleteDesc', { title: deleteTarget.title })}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg border border-[#24242D] text-[#8B8B98] hover:text-[#F5F5F5] hover:border-[#8B8B98] transition-colors disabled:opacity-50"
              >
                {tt('settings.cancel')}
              </button>
              <button
                onClick={() => void handleDelete(deleteTarget.id)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? '...' : tt('history.deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Gagang geser lebar sidebar (laptop saja, double-click = reset) */}
      <div
        onPointerDown={startResize}
        onDoubleClick={resetWidth}
        title="Geser untuk ubah lebar • double-click untuk reset"
        className="hidden md:block absolute top-0 right-[-5px] w-[10px] h-full cursor-ew-resize z-10 group/handle"
        aria-hidden="true"
      >
        <div className="absolute top-0 right-[4px] w-[2px] h-full bg-transparent group-hover/handle:bg-indigo-500/60 transition-colors" />
      </div>
      </aside>
    </>
  );
}
