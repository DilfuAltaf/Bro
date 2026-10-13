'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Plus, Loader2, X, Image as ImageIcon, Camera, FileText, File as FileIcon, Mic, MicOff } from 'lucide-react';
import {
  OutgoingAttachment,
  prepareFiles,
  prettyBytes,
} from '@/lib/attachments';

// Web Speech API belum ada di lib.dom TS, deklarasikan seperlunya.
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

type Props = {
  onSend: (message: string, attachments?: OutgoingAttachment[]) => void;
  disabled?: boolean;
  /** Kode bahasa STT (mis. 'id-ID'). Diatur dari Settings. */
  lang?: string;
};

type PreparedAttachment = OutgoingAttachment & { id: string };

export default function ChatInput({ onSend, disabled, lang }: Props) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Teks yang sudah ada sebelum mulai ngomong — hasil transkrip ditempel di belakangnya.
  const baseTextRef = useRef('');
  const isListeningRef = useRef(false);

  // Cek dukungan STT hanya di client (SSR tidak punya window).
  useEffect(() => {
    setSttSupported(getSpeechRecognitionCtor() !== null);
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* abaikan */
      }
      recognitionRef.current = null;
    };
  }, []);

  // Tutup menu lampiran saat klik di luar.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setIsAttachOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if ((content.trim() || attachments.length > 0) && !disabled && !isPreparing) {
      // Kalau user kirim saat masih ngomong, hentikan dulu biar transkrip tidak kepotong.
      try {
        recognitionRef.current?.stop();
      } catch {
        /* abaikan */
      }
      onSend(
        content,
        attachments.map(({ id: _drop, ...rest }) => rest),
      );
      setContent('');
      setAttachments([]);
      setAttachError(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* abaikan */
    }
  };

  const toggleListening = () => {
    if (disabled) return;
    // Klik saat merekam = berhenti.
    if (isListeningRef.current) {
      stopListening();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSttError('Browser ini tidak mendukung voice-to-text. Coba Chrome/Edge desktop.');
      return;
    }

    setSttError(null);
    baseTextRef.current = content;
    const recognition = new Ctor();
    recognition.lang = lang || 'id-ID';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript || '';
        if (event.results[i]?.isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }
      // Final transcript diakumulasi ke base agar tidak duplikat saat event berikutnya.
      if (finalChunk) {
        const sep = baseTextRef.current && !baseTextRef.current.endsWith(' ') ? ' ' : '';
        baseTextRef.current = `${baseTextRef.current}${sep}${finalChunk.trim()} `;
      }
      const sep = baseTextRef.current && interim && !baseTextRef.current.endsWith(' ') ? ' ' : '';
      setContent(`${baseTextRef.current}${sep}${interim}`);
      // Tunggu state ke-commit sebelum resize.
      requestAnimationFrame(resizeTextarea);
    };

    recognition.onerror = (event: any) => {
      const code = event?.error || 'unknown';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setSttError('Izin mic ditolak. Klik ikon gembok di address bar lalu izinkan microphone.');
      } else if (code === 'no-speech') {
        setSttError('Tidak terdengar suara. Coba ngomong lebih dekat ke mic.');
      } else if (code === 'audio-capture') {
        setSttError('Mic tidak ditemukan. Pastikan microphone terpasang.');
      } else if (code !== 'aborted') {
        setSttError('Voice-to-text gagal. Coba lagi.');
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
      resizeTextarea();
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      setIsListening(true);
    } catch {
      setSttError('Gagal menyalakan mic. Coba lagi.');
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
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleFilesChosen = async (list: FileList | null) => {
    setIsAttachOpen(false);
    if (!list || list.length === 0) return;
    setIsPreparing(true);
    setAttachError(null);
    try {
      const imageCount = attachments.filter((a) => a.kind === 'image').length;
      const { attachments: fresh, error } = await prepareFiles(list, imageCount);
      if (fresh.length > 0) {
        const stamped: PreparedAttachment[] = fresh.map((a, i) => ({
          ...a,
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        }));
        setAttachments((prev) => [...prev, ...stamped]);
      }
      if (error) setAttachError(error);
    } finally {
      setIsPreparing(false);
      // Reset semua input agar file yang sama bisa dipilih lagi.
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="max-w-3xl mx-auto relative flex flex-col bg-[#111116] border border-[#24242D] p-3 rounded-2xl focus-within:border-[#8B8B98] transition-colors shadow-sm">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2">
          {attachments.map((att) => (
            <div key={att.id} className="relative group">
              {att.kind === 'image' ? (
                <div className="relative">
                  <img src={att.dataUrl} alt={att.name} className="h-14 w-14 object-cover rounded-lg border border-[#24242D]" />
                  <span className="absolute bottom-0.5 left-0.5 text-[9px] px-1 rounded bg-black/70 text-white font-mono">
                    {prettyBytes(att.dataUrl)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 h-14 pl-2 pr-2.5 bg-[#16161D] border border-[#24242D] rounded-lg max-w-[200px]">
                  <FileIcon className="w-5 h-5 text-[#8B8B98] shrink-0" />
                  <span className="text-xs text-[#F5F5F5] truncate">{att.name}</span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(att.id)}
                title="Hapus lampiran"
                className="absolute -top-1.5 -right-1.5 bg-[#24242D] hover:bg-[#383842] rounded-full p-0.5 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={isListening ? 'Mendengarkan... ngomong aja, nanti jadi teks' : 'Type a message...'}
        disabled={disabled}
        rows={1}
        className="w-full max-h-[200px] bg-transparent resize-none outline-none text-[#F5F5F5] px-2 py-1 placeholder:text-[#8B8B98] custom-scrollbar disabled:opacity-50"
        style={{ minHeight: '44px' }}
      />

      {(isListening || sttError || attachError || isPreparing) && (
        <div className="flex items-center gap-2 px-2 pt-1">
          {isListening && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Merekam... klik mic lagi untuk berhenti
            </span>
          )}
          {sttError && !isListening && (
            <span className="text-xs text-amber-400">{sttError}</span>
          )}
          {attachError && (
            <span className="text-xs text-amber-400">{attachError}</span>
          )}
          {isPreparing && (
            <span className="flex items-center gap-1.5 text-xs text-[#8B8B98]">
              <Loader2 className="w-3 h-3 animate-spin" /> Menyiapkan lampiran...
            </span>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1">
          <div className="relative" ref={attachMenuRef}>
            <button
              onClick={() => setIsAttachOpen((v) => !v)}
              className="p-2 text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D] rounded-lg transition-colors"
              disabled={disabled}
              title="Lampirkan (foto, kamera, dokumen)"
            >
              <Plus className="w-5 h-5" />
            </button>
            {isAttachOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-60 bg-[#16161D] border border-[#24242D] rounded-xl shadow-xl py-1.5 z-50">
                <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#8B8B98]">
                  Lampirkan
                </div>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#c9c9d4] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors text-left"
                >
                  <ImageIcon className="w-4 h-4 shrink-0 text-[#8B8B98]" />
                  <span>
                    <span className="block font-medium">Foto & Galeri</span>
                    <span className="block text-xs text-[#8B8B98]">Pilih foto yang sudah ada</span>
                  </span>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#c9c9d4] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors text-left"
                >
                  <Camera className="w-4 h-4 shrink-0 text-[#8B8B98]" />
                  <span>
                    <span className="block font-medium">Kamera</span>
                    <span className="block text-xs text-[#8B8B98]">Ambil foto langsung</span>
                  </span>
                </button>
                <button
                  onClick={() => docInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#c9c9d4] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors text-left"
                >
                  <FileText className="w-4 h-4 shrink-0 text-[#8B8B98]" />
                  <span>
                    <span className="block font-medium">Dokumen teks</span>
                    <span className="block text-xs text-[#8B8B98]">.txt .md .csv .json kode</span>
                  </span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={toggleListening}
            disabled={disabled || (!sttSupported && !isListening)}
            title={sttSupported ? 'Ngomong jadi teks (Bahasa Indonesia)' : 'Voice-to-text tidak didukung browser ini'}
            className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
              isListening
                ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 animate-pulse'
                : 'text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#16161D]'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        {/* Galeri: tanpa capture agar di HP buka galeri (izin ditanya OS bila perlu) */}
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          ref={galleryInputRef}
          onChange={(e) => void handleFilesChosen(e.target.files)}
        />
        {/* Kamera: capture agar di HP langsung buka kamera */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={cameraInputRef}
          onChange={(e) => void handleFilesChosen(e.target.files)}
        />
        <input
          type="file"
          multiple
          accept=".txt,.md,.markdown,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.php,.html,.css,.xml,.yml,.yaml,.toml,.ini,.log,.sql,.sh,text/*"
          className="hidden"
          ref={docInputRef}
          onChange={(e) => void handleFilesChosen(e.target.files)}
        />
        
        <button
          onClick={handleSend}
          disabled={disabled || isPreparing || (!content.trim() && attachments.length === 0)}
          className="p-2 bg-[#F5F5F5] text-[#09090B] disabled:bg-[#16161D] disabled:text-[#8B8B98] rounded-lg transition-colors flex items-center justify-center"
        >
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
