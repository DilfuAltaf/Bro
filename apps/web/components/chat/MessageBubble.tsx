'use client';

import { useState } from 'react';
import { Check, Pencil, RefreshCw, Send, X } from 'lucide-react';
import {
  RichMessage,
  CopyButton,
  isDocumentLike,
  docTitle,
  getFollowUps,
} from './RichMessage';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  model?: string;
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
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] md:max-w-[75%] flex gap-3 flex-row-reverse">
          <div className="flex flex-col gap-1 items-end">
            <div className="px-4 py-3 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap bg-[#16161D] text-[#F5F5F5] rounded-tr-sm">
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

function AiBubble({
  message,
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

  const content = display ?? message.content;
  const document = isDocumentLike(content);
  const title = docTitle(content);
  const followUps = getFollowUps(content, title);

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
    flash('Perubahan tersimpan di tampilan ini');
  };

  const sendRevision = () => {
    if (!onSend || sendingDisabled) return;
    onSend(`Tolong perbaiki dan kembangkan dokumen berikut:\n\n${draft}`);
    setDisplay(draft);
    setEditing(false);
  };

  const canAct = Boolean(onSend) && !sendingDisabled;

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] md:max-w-[75%] w-full flex gap-3 flex-row min-w-0">
        <div className="w-8 h-8 rounded-full bg-[#111116] border border-[#24242D] flex items-center justify-center shrink-0 mt-1">
          <img src="/logo.png" alt="AI" className="w-5 h-5 object-contain" />
        </div>

        <div className="flex flex-col gap-1 items-start min-w-0 flex-1">
          <div
            className={`w-full px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
              document ? 'bg-[#0e0e14] border border-[#24242D]' : 'text-[#F5F5F5]'
            }`}
          >
            {document && (
              <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-[#24242D]">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-[#8B8B98]">Dokumen</div>
                  <div className="font-semibold text-[#F5F5F5] truncate">{title}</div>
                </div>
                <CopyButton text={content} />
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
                    <Check className="w-4 h-4" /> Simpan
                  </button>
                  <button
                    onClick={sendRevision}
                    disabled={!canAct}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> Kirim revisi
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#24242D] text-sm text-[#8B8B98] hover:text-[#F5F5F5]"
                  >
                    <X className="w-4 h-4" /> Batal
                  </button>
                </div>
                <p className="text-xs text-[#8B8B98]">
                  Simpan hanya mengubah tampilan sesi ini. Kirim revisi meminta AI mengembangkan versi baru.
                </p>
              </div>
            ) : (
              <RichMessage content={content} />
            )}

            {!editing && (
              <div className="flex flex-wrap items-center gap-1 pt-2 mt-1 border-t border-[#1d1d26]">
                {!document && <CopyButton text={content} />}
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {onRegenerate && (
                  <button
                    onClick={() => onRegenerate(message.id)}
                    disabled={sendingDisabled}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
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
                Tidak, cukup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
