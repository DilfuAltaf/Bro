'use client';

import { useState } from 'react';
import { Check, Globe, Pencil, RefreshCw, Send, X } from 'lucide-react';
import {
  RichMessage,
  CopyButton,
  isDocumentLike,
  docTitle,
  getFollowUps,
} from './RichMessage';
import { useAppLanguage } from '@/lib/i18n';
import type { AiStatus, ChatSource } from '@/app/(dashboard)/chat/page';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  model?: string;
  status?: AiStatus | null;
  sources?: ChatSource[];
};

type Props = {
  message: Message;
  onSend?: (text: string) => void;
  onRegenerate?: (aiMessageId: string) => void;
  showFollowUps?: boolean;
  sendingDisabled?: boolean;
};

export default function MessageBubble({
  message,
  onSend,
  onRegenerate,
  showFollowUps,
  sendingDisabled,
}: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex w-full justify-end min-w-0">
        <div className="max-w-[92%] sm:max-w-[85%] md:max-w-[75%] flex gap-3 flex-row-reverse min-w-0">
          <div className="flex flex-col gap-1 items-end min-w-0">
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] bg-[#16161D] text-[#F5F5F5] rounded-tr-sm min-w-0">
              {message.content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AiBubble
      message={message}
      onSend={onSend}
      onRegenerate={onRegenerate}
      showFollowUps={showFollowUps}
      sendingDisabled={sendingDisabled}
    />
  );
}

/** Domain dari URL (fallback: URL mentah bila parsing gagal). */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

function isSafeHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Section Sources kompak — hanya dari sumber web RIIL (event `done`).
 * Tidak pernah mengarang judul/URL; URL non-http(s) dan duplikat dibuang.
 */
function SourcesList({ sources }: { sources: ChatSource[] }) {
  const { tt } = useAppLanguage();
  const seen = new Set<string>();
  const clean = (sources || []).filter((s) => {
    if (!s || !isSafeHttpUrl(s.url)) return false;
    const key = s.url.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (clean.length === 0) return null;

  return (
    <div className="mt-2 w-full min-w-0 rounded-xl border border-[#24242D] bg-[#0e0e14] px-3 py-2">
      <div className="flex items-center gap-1.5 pb-1.5">
        <Globe className="w-3.5 h-3.5 text-[#8B8B98]" />
        <span className="text-[11px] uppercase tracking-wide text-[#8B8B98]">
          {tt('sources.title')} • {clean.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {clean.map((s) => {
          const domain = domainOf(s.url);
          return (
            <a
              key={s.url}
              href={s.url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-[#16161D] transition-colors min-w-0"
            >
              <span className="w-6 h-6 rounded-md bg-indigo-500/15 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                {domain.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-[#8B8B98] truncate">{domain}</span>
                <span className="block text-[13px] text-[#e5e5ea] truncate">
                  {(s.title || '').trim() || domain}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function AiBubble({  message,
  onSend,
  onRegenerate,
  showFollowUps,
  sendingDisabled,
}: {
  message: Message;
  onSend?: (text: string) => void;
  onRegenerate?: (aiMessageId: string) => void;
  showFollowUps?: boolean;
  sendingDisabled?: boolean;
}) {
  const [display, setDisplay] = useState<string | null>(null); // local edit override
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [followUpsOpen, setFollowUpsOpen] = useState(true);
  const { tt, lang } = useAppLanguage();

  const content = display ?? message.content;
  const document = isDocumentLike(content);
  const title = docTitle(content, lang);
  const followUps = getFollowUps(content, title, lang);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const startEdit = () => {
    setDraft(content);
    setEditing(true);
  };

  const saveEdit = () => {
    setDisplay(draft);
    setEditing(false);
    flash(tt('bubble.savedFlash'));
  };

  const sendRevision = () => {
    if (!onSend || sendingDisabled) return;
    onSend(`${tt('bubble.revisePrefix')}\n\n${draft}`);
    setDisplay(draft);
    setEditing(false);
  };

  const canAct = Boolean(onSend) && !sendingDisabled;
  const hasContent = content.trim().length > 0;
  const statusText = tt(`status.${message.status || 'thinking'}`);

  // Thinking/streaming: satu logo + status aktivitas, TANPA aksi dan TANPA divider.
  if (!hasContent && !editing) {
    return (
      <div className="flex w-full justify-start min-w-0">
        <div className="w-full flex gap-2.5 sm:gap-3 flex-row min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#111116] border border-[#24242D] flex items-center justify-center shrink-0 mt-1">
            <img src="/logo.png" alt="AI" className="w-5 h-5 object-contain" />
          </div>
          <div className="flex items-center gap-2.5 min-h-[2.5rem] py-2 min-w-0" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            <span className="text-sm text-[#8B8B98] truncate">{statusText}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start min-w-0">
      <div className="w-full max-w-[calc(100%-0px)] sm:max-w-[95%] md:max-w-[75%] flex gap-2.5 sm:gap-3 flex-row min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#111116] border border-[#24242D] flex items-center justify-center shrink-0 mt-1">
          <img src="/logo.png" alt="AI" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
        </div>

        <div className="flex flex-col gap-1 items-start min-w-0 flex-1">
          <div
            className={`w-full min-w-0 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-sm sm:text-[15px] leading-relaxed break-words ${
              document ? 'bg-[#0e0e14] border border-[#24242D]' : 'text-[#F5F5F5]'
            }`}
          >
            {document && (
              <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-[#24242D]">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-[#8B8B98]">{tt('bubble.document')}</div>
                  <div className="font-semibold text-[#F5F5F5] truncate">{title}</div>
                </div>
                <CopyButton text={content} lang={lang} />
              </div>
            )}

            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={Math.min(20, Math.max(6, draft.split('\n').length + 2))}
                  className="w-full bg-[#09090B] border border-[#24242D] rounded-lg p-3 text-sm text-[#F5F5F5] outline-none focus:border-[#8B8B98] font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={saveEdit}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F5F5F5] text-[#09090B] text-sm font-medium"
                  >
                    <Check className="w-4 h-4" /> {tt('bubble.save')}
                  </button>
                  <button
                    onClick={sendRevision}
                    disabled={!canAct}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> {tt('bubble.sendRevision')}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#24242D] text-sm text-[#8B8B98] hover:text-[#F5F5F5]"
                  >
                    <X className="w-4 h-4" /> {tt('bubble.cancel')}
                  </button>
                </div>
                <p className="text-xs text-[#8B8B98]">
                  {tt('bubble.saveNote')}
                </p>
              </div>
            ) : (
              <RichMessage content={content} lang={lang} />
            )}

            {!editing && hasContent && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                {!document && <CopyButton text={content} lang={lang} />}
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> {tt('bubble.edit')}
                </button>
                {onRegenerate && (
                  <button
                    onClick={() => onRegenerate(message.id)}
                    disabled={sendingDisabled}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> {tt('bubble.regenerate')}
                  </button>
                )}
                {notice && <span className="text-xs text-emerald-400 ml-1">{notice}</span>}
              </div>
            )}
            {message.model && (
              <div className="pt-1">
                <span className="text-[10px] text-[#5b5b68] font-mono">via {message.model}</span>
              </div>
            )}
            {hasContent && message.sources && message.sources.length > 0 && (
              <SourcesList sources={message.sources} />
            )}
          </div>

          {showFollowUps && onSend && followUpsOpen && followUps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {followUps.map((f) => (
                <button
                  key={f.id}
                  disabled={sendingDisabled}
                  onClick={() => {
                    if (sendingDisabled) return;
                    onSend(f.prompt);
                  }}
                  className="px-2.5 py-1 rounded-full text-xs border border-[#24242D] bg-[#111116] text-[#b9b9c4] hover:text-[#F5F5F5] hover:border-[#8B8B98] transition-colors disabled:opacity-50"
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => setFollowUpsOpen(false)}
                className="px-2.5 py-1 rounded-full text-xs text-[#8B8B98] hover:text-[#F5F5F5] transition-colors"
              >
                {tt('chat.noLimit')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
