'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ChatWindow from '@/components/chat/ChatWindow';
import ChatInput from '@/components/chat/ChatInput';
import { MAX_DOCS_PER_MESSAGE, MAX_IMAGES_PER_MESSAGE, OutgoingAttachment } from '@/lib/attachments';
import { ChevronDown, GraduationCap, Microscope, Lightbulb, FileText, LifeBuoy, Zap, Cpu, Check, OctagonAlert, ArrowRightLeft } from 'lucide-react';
import { PREF_KEYS } from '@/components/shared/SettingsModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  /** ID model yang benar-benar menjawab (untuk label "via ..."). */
  model?: string;
};

const AVAILABLE_MODES = [
  { value: 'general', label: 'General', icon: Zap },
  { value: 'learning', label: 'Learning', icon: GraduationCap },
  { value: 'research', label: 'Research', icon: Microscope },
  { value: 'brainstorm', label: 'Brainstorm', icon: Lightbulb },
  { value: 'support', label: 'Support', icon: LifeBuoy },
  { value: 'assignment', label: 'Assignment', icon: FileText },
];

type LlmModelOption = {
  id: string;
  label: string;
  provider: 'gemini' | 'groq';
  description: string;
  available?: boolean;
};

const FALLBACK_LLM_MODELS: LlmModelOption[] = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', provider: 'gemini', description: 'Cepat & hemat kuota' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini', description: 'Lebih pintar untuk reasoning' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (Groq)', provider: 'groq', description: 'Serbaguna & multibahasa' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', provider: 'groq', description: 'Flagship open-weight' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)', provider: 'groq', description: 'Ringan & cepat' },
];

/** Nama pendek model untuk label (buang prefix provider seperti "openai/"). */
function shortModelName(id: string): string {
  const slash = id.lastIndexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

/** True kalau pesan error menandakan kuota/rate-limit habis. */
function isLimitError(text: string): boolean {
  return /limit|kuota|429|habis|semua model/i.test(text);
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const initialConvId = searchParams.get('conversationId');
  const initialMode = searchParams.get('mode');
  
  const [conversationId, setConversationId] = useState<string | null>(initialConvId);
  const [mode, setMode] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return initialMode || localStorage.getItem(PREF_KEYS.mode);
    }
    return initialMode;
  });
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [llmModels, setLlmModels] = useState<LlmModelOption[]>(FALLBACK_LLM_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return searchParams.get('model') || localStorage.getItem('bro-model') || FALLBACK_LLM_MODELS[0]!.id;
    }
    return FALLBACK_LLM_MODELS[0]!.id;
  });
  const [isModelOpen, setIsModelOpen] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Logo limit: muncul saat kuota habis / terjadi pindah model otomatis.
  const [limitBadge, setLimitBadge] = useState<{ kind: 'limit' | 'fallback'; text: string } | null>(null);
  const [sttLang, setSttLang] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PREF_KEYS.sttLang) || 'id-ID';
    }
    return 'id-ID';
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  // Guard anti double-send: state isLoading belum tentu ter-update saat
  // Enter ditekan 2x cepat (closure basi) — ref selalu terkini.
  const sendingRef = useRef(false);
  // ID conversation yang sedang di-stream. Dipakai agar effect load-percakapan
  // tidak menimpa placeholder AI yang masih menerima token.
  const streamConvIdRef = useRef<string | null>(null);
  // Mirror state conversationId untuk perbandingan di dalam callback async.
  const conversationIdRef = useRef<string | null>(initialConvId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModeOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ambil katalog model dari backend (status available mengikuti API key server).
  useEffect(() => {
    fetch(`${API_URL}/gemini/models`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLlmModels(data);
          // Kalau model tersimpan tidak ada di katalog, fallback ke model pertama yang available.
          setSelectedModel((prev) => {
            if (data.some((m: LlmModelOption) => m.id === prev)) return prev;
            const firstAvailable = data.find((m: LlmModelOption) => m.available !== false);
            return (firstAvailable || data[0]).id;
          });
        }
      })
      .catch(() => { /* pakai fallback statis */ });
  }, []);

  // Terapkan preferensi dari Settings modal secara live (tanpa reload).
  useEffect(() => {
    function applyPrefs() {
      try {
        const savedModel = localStorage.getItem(PREF_KEYS.model);
        if (savedModel) setSelectedModel(savedModel);
        const savedMode = localStorage.getItem(PREF_KEYS.mode);
        if (savedMode) setMode(savedMode);
        const savedLang = localStorage.getItem(PREF_KEYS.sttLang);
        if (savedLang) setSttLang(savedLang);
      } catch { /* abaikan */ }
    }
    window.addEventListener('bro-settings-changed', applyPrefs);
    return () => window.removeEventListener('bro-settings-changed', applyPrefs);
  }, []);

  useEffect(() => {
    if (!initialConvId) {
      setConversationId(null);
      conversationIdRef.current = null;
      setMessages([]);
      return;
    }
    const requestedId = initialConvId;
    setConversationId(requestedId);
    conversationIdRef.current = requestedId;
    // Jangan fetch saat stream untuk conversation ini sedang jalan: hasil fetch
    // (yang belum berisi balasan AI) akan menghapus placeholder AI + token
    // yang sudah diterima. State lokal sudah benar, tidak perlu ditimpa.
    if (streamConvIdRef.current === requestedId) {
      return;
    }
    fetch(`${API_URL}/conversations/${requestedId}/messages`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Gagal memuat percakapan (HTTP ${res.status}). Coba klik lagi.`);
        }
        return res.json();
      })
      .then(data => {
        // Abaikan respons basi kalau user sudah pindah ke conversation lain.
        if (conversationIdRef.current !== requestedId) return;
        if (Array.isArray(data)) {
          const formatted = data.map((m: any) => ({
            id: m.id,
            role: (m.role === 'assistant' ? 'ai' : 'user') as 'user' | 'ai',
            content: m.content,
            timestamp: m.createdAt,
          }));
          setMessages(formatted);
          setError(null);
        }
      })
      .catch(err => {
        console.error('Failed to load messages:', err);
        // Tampilkan ke user — sebelumnya error ini cuma masuk console (tak terlihat).
        if (conversationIdRef.current === requestedId) {
          setError(err.message || 'Gagal memuat percakapan.');
        }
      });
  }, [initialConvId]);

  const updateMode = (newMode: string) => {
    setMode(newMode);
    setIsModeOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', newMode);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const updateModel = (newModel: string) => {
    setSelectedModel(newModel);
    setIsModelOpen(false);
    try {
      localStorage.setItem('bro-model', newModel);
    } catch { /* abaikan */ }
    const params = new URLSearchParams(searchParams.toString());
    params.set('model', newModel);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const activeModeObj = AVAILABLE_MODES.find(m => m.value === (mode || 'general')) || AVAILABLE_MODES[0]!;
  const ActiveIcon = activeModeObj.icon;
  const activeModelObj = llmModels.find(m => m.id === selectedModel) || llmModels[0]!;

  const DOC_CHARS_PER_FILE = 2500;

  const handleSendMessage = async (content: string, attachments?: OutgoingAttachment[]) => {
    const images = (attachments || [])
      .filter((a) => a.kind === 'image')
      .slice(0, MAX_IMAGES_PER_MESSAGE);
    const docs = (attachments || [])
      .filter((a) => a.kind === 'text')
      .slice(0, MAX_DOCS_PER_MESSAGE);

    // Dokumen teks disisipkan ke pesan (dipotong agar hemat kuota).
    let fullContent = content;
    for (const d of docs) {
      const t =
        d.text.length > DOC_CHARS_PER_FILE
          ? `${d.text.slice(0, DOC_CHARS_PER_FILE).trimEnd()}\n...[dipotong]`
          : d.text;
      fullContent += `\n\n[Lampiran: ${d.name}]\n${t}`;
    }
    if (images.length > 0) {
      const names = images.map((i) => i.name).join(', ');
      fullContent += `\n[📷 ${images.length} gambar terlampir: ${names}]`;
    }

    if ((!fullContent.trim() && images.length === 0) || isLoading || sendingRef.current) return;
    
    sendingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLimitBadge(null);
    const requestedModel = selectedModel;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: fullContent,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);

    let aiContent = '';
    let aiId = '';

    try {
      let currentConvId = conversationId;
      
      if (!currentConvId) {
        const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        const payload: any = { title };
        if (mode) payload.mode = mode;
        const convRes = await fetch(`${API_URL}/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        
        if (!convRes.ok) throw new Error('Failed to create conversation');
        const convData = await convRes.json();
        currentConvId = convData.id;
        setConversationId(convData.id);
        conversationIdRef.current = convData.id;
        
        window.dispatchEvent(new CustomEvent('conversationCreated'));
        
        const params = new URLSearchParams(searchParams.toString());
        params.set('conversationId', convData.id);
        router.replace(`${pathname}?${params.toString()}`);
      }

      // Tandai stream berjalan agar effect load tidak menimpa state.
      // Dibersihkan di finally.
      streamConvIdRef.current = currentConvId;
      
      const msgPayload: any = { content: fullContent };
      if (mode) msgPayload.mode = mode;
      if (requestedModel) msgPayload.model = requestedModel;
      if (images.length > 0) msgPayload.images = images.map((i) => i.dataUrl);

      aiId = 'ai-' + Date.now();
      setMessages(prev => [...prev, {
        id: aiId,
        role: 'ai',
        content: '',
        timestamp: new Date().toISOString()
      }]);

      const msgRes = await fetch(`${API_URL}/conversations/${currentConvId}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(msgPayload)
      });

      if (!msgRes.ok || !msgRes.body) throw new Error('Failed to send message');

      const reader = msgRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const raw of events) {
          const line = raw.split('\n').find(l => l.startsWith('data:'));
          if (!line) continue;
          let event: any;
          try {
            event = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (event.type === 'token') {
            aiContent += event.value;
            setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, content: aiContent } : m)));
          } else if (event.type === 'done') {
            const usedModel = (event.model as string | undefined) || undefined;
            setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, timestamp: event.createdAt || m.timestamp, model: usedModel } : m)));
            // Model yang menjawab beda dari yang diminta = auto-fallback karena limit.
            if (usedModel && usedModel !== requestedModel) {
              setLimitBadge({
                kind: 'fallback',
                text: `Limit — dipindah ke ${shortModelName(usedModel)}`,
              });
            }
            streamDone = true;
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Stream error');
          }
        }
      }

    } catch (err: any) {
      console.error('Chat error:', err);
      if (!aiContent && aiId) {
        setMessages(prev => prev.filter(m => m.id !== aiId));
      }
      const msg = err.message || 'An error occurred while communicating with the server.';
      setError(msg);
      if (isLimitError(msg)) {
        setLimitBadge({ kind: 'limit', text: 'LIMIT — kuota habis' });
      }
    } finally {
      streamConvIdRef.current = null;
      sendingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleRegenerate = (aiMessageId: string) => {
    if (isLoading) return;
    const idx = messages.findIndex((m) => m.id === aiMessageId);
    for (let i = (idx === -1 ? messages.length : idx) - 1; i >= 0; i -= 1) {
      const prev = messages[i]!;
      if (prev.role === 'user' && prev.content.trim()) {
        void handleSendMessage(prev.content);
        return;
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090B]">
      <header className="h-14 border-b border-[#24242D] flex items-center justify-between px-6 shrink-0 bg-[#09090B] gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsModeOpen(!isModeOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[#111116] transition-colors border border-transparent hover:border-[#24242D]"
            >
              <ActiveIcon className="w-4 h-4 text-[#8B8B98]" />
              <span className="text-sm font-medium text-[#F5F5F5]">{activeModeObj.label}</span>
              <ChevronDown className="w-4 h-4 text-[#8B8B98]" />
            </button>

            {isModeOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#111116] border border-[#24242D] rounded-lg shadow-xl py-1 z-50">
                {AVAILABLE_MODES.map(m => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      onClick={() => updateMode(m.value)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D] transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-[#8B8B98] font-medium">Online</span>
          </div>

          <div className="flex items-center gap-2 relative" ref={modelDropdownRef}>
            <button
              onClick={() => setIsModelOpen(!isModelOpen)}
              title={activeModelObj?.description || activeModelObj?.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#111116] border border-[#24242D] hover:border-[#8B8B98] transition-colors max-w-[220px]"
            >
              <Cpu className="w-4 h-4 text-[#8B8B98] shrink-0" />
              <span className="text-sm font-medium text-[#F5F5F5] truncate">{activeModelObj?.label || selectedModel}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide shrink-0 ${
                activeModelObj?.provider === 'groq' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'
              }`}>
                {activeModelObj?.provider || 'llm'}
              </span>
              <ChevronDown className="w-4 h-4 text-[#8B8B98] shrink-0" />
            </button>

            {isModelOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#111116] border border-[#24242D] rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-[#8B8B98]">Pilih model AI</div>
                {llmModels.map((m) => {
                  const unavailable = m.available === false;
                  const active = m.id === selectedModel;
                  return (
                    <button
                      key={m.id}
                      disabled={unavailable}
                      onClick={() => updateModel(m.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2 text-sm transition-colors text-left ${
                        unavailable
                          ? 'opacity-40 cursor-not-allowed text-[#8B8B98]'
                          : active
                            ? 'bg-[#16161D] text-[#F5F5F5]'
                            : 'text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D]'
                      }`}
                    >
                      <Cpu className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-medium truncate">{m.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </span>
                        <span className="block text-xs text-[#8B8B98] truncate">{m.description}</span>
                        <span className="block text-[11px] text-[#5b5b68] font-mono truncate">{m.id}</span>
                        {unavailable && (
                          <span className="block text-[11px] text-amber-400">API key belum diisi di server</span>
                        )}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase shrink-0 ${
                        m.provider === 'groq' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'
                      }`}>
                        {m.provider}
                      </span>
                    </button>
                  );
                })}
                <div className="px-3 py-2 text-[11px] text-[#5b5b68] border-t border-[#24242D]">
                  Groq butuh <span className="font-mono">GROQ_API_KEY</span> di .env server.
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {limitBadge && (
            <span
              title={limitBadge.kind === 'limit'
                ? 'Kuota model habis. Coba lagi nanti, ganti model, atau cek Settings → Kuota & limit.'
                : 'Model yang kamu pilih kena limit, jadi otomatis dijawab model lain.'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
                limitBadge.kind === 'limit'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                  : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
              }`}
            >
              {limitBadge.kind === 'limit'
                ? <OctagonAlert className="w-3.5 h-3.5" />
                : <ArrowRightLeft className="w-3.5 h-3.5" />}
              {limitBadge.text}
            </span>
          )}
          {error && <span className="text-red-400 text-sm hidden md:inline max-w-[300px] truncate" title={error}>{error}</span>}
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onModeSelect={updateMode}
          onSendMessage={(text) => void handleSendMessage(text)}
          onRegenerateMessage={handleRegenerate}
        />
        <div className="p-4 bg-[#09090B]">
          <ChatInput onSend={handleSendMessage} disabled={isLoading} lang={sttLang} />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="bg-[#09090B] h-full flex items-center justify-center text-[#8B8B98]">Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
