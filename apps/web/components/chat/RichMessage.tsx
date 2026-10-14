'use client';

import { useState, type ReactNode } from 'react';
import katex from 'katex';
import { Check, Copy } from 'lucide-react';
import { FALLBACK_DOC_TITLES, normalizeLang, t, type AppLang } from '@/lib/i18n';

// ── Safe Markdown subset renderer ─────────────────────────────
// Parses headings, GFM tables, fenced code, lists, quotes, LaTeX math,
// and inline formatting into React elements. No raw AI HTML is ever
// rendered: KaTeX generates its own markup from parsed math (HTML
// passthrough stays disabled), and anything unparsable falls back to
// plain text (including mid-stream partial output).

export type Align = 'left' | 'center' | 'right';

export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; lang: string; code: string; closed: boolean }
  | { kind: 'table'; header: string[]; align: Align[]; rows: string[][] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

export type FollowUp = { id: string; label: string; prompt: string };

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label, lang }: { text: string; label?: string; lang?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const L = normalizeLang(lang);

  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? 'ok' : 'fail');
    window.setTimeout(() => setState('idle'), 1800);
  };

  return (
    <button
      onClick={onClick}
      title={state === 'fail' ? t(L, 'copy.failTitle') : (label ?? t(L, 'copy.label'))}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#8B8B98] hover:text-[#F5F5F5] hover:bg-[#24242D] transition-colors"
    >
      {state === 'ok' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {state === 'ok' ? t(L, 'copy.done') : state === 'fail' ? t(L, 'copy.fail') : (label ?? t(L, 'copy.label'))}
    </button>
  );
}

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return (
    cells.length > 0 &&
    cells.every((c) => /^:?-{1,}:?$/.test(c))
  );
}

function parseAlign(cell: string): Align {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

export function parseMarkdown(src: string): Block[] {
  const lines = (src || '').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Fenced code block
    const fence = trimmed.match(/^```(\S*)\s*$/);
    if (fence) {
      const lang = (fence[1] || '').trim();
      const codeLines: string[] = [];
      i += 1;
      let closed = false;
      while (i < lines.length) {
        if (lines[i]!.trim().startsWith('```')) {
          closed = true;
          i += 1;
          break;
        }
        codeLines.push(lines[i]!);
        i += 1;
      }
      blocks.push({ kind: 'code', lang, code: codeLines.join('\n'), closed });
      continue;
    }

    // GFM table: header row + separator row + body rows
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1]!)
    ) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]!).map(parseAlign);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().includes('|') && lines[i]!.trim() !== '') {
        const row = splitRow(lines[i]!);
        // Normalize ragged rows to header width
        while (row.length < header.length) row.push('');
        rows.push(row.slice(0, header.length));
        i += 1;
      }
      const align: Align[] = header.map((_, idx) => aligns[idx] || 'left');
      blocks.push({ kind: 'table', header, align, rows });
      continue;
    }

    // Heading (## .. ### max 3, deeper treated as paragraph)
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^(\*\*\*|---|___)\s*$/.test(trimmed)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: quoteLines.join('\n') });
      continue;
    }

    // List (consecutive bullets / numbered items)
    const listStart = trimmed.match(/^([-*+]\s+|\d+[.)]\s+)/);
    if (listStart) {
      const ordered = /^\d/.test(listStart[1]!);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.trim().match(/^([-*+]\s+|\d+[.)]\s+)(.*)$/);
        if (!m) break;
        items.push(m[2]!.trim());
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    // Blank line: separator only
    if (trimmed === '') {
      i += 1;
      continue;
    }

    // Paragraph: gather consecutive plain lines
    const para: string[] = [line.trim()];
    i += 1;
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.trim().startsWith('```') &&
      !lines[i]!.trim().match(/^#{1,3}\s+/) &&
      !lines[i]!.trim().match(/^([-*+]\s+|\d+[.)]\s+)/) &&
      !lines[i]!.trim().startsWith('>') &&
      !/^(\*\*\*|---|___)\s*$/.test(lines[i]!.trim())
    ) {
      // Stop before a potential table header (needs lookahead for separator row)
      if (
        lines[i]!.includes('|') &&
        i + 1 < lines.length &&
        isSeparatorRow(lines[i + 1]!)
      ) {
        break;
      }
      para.push(lines[i]!.trim());
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: para.join(' ') });
  }

  return blocks;
}

// ── LaTeX math (KaTeX) ─────────────────────────────────────────
// Math segments are extracted BEFORE bold/italic/code/links so `$...$`
// content is never mangled by other formatters. Unclosed delimiters
// (common mid-stream) and KaTeX parse failures fall back to literal
// text instead of breaking the layout.

const MATH_SRC = '\\$\\$([\\s\\S]+?)\\$\\$|\\\\\\[([\\s\\S]+?)\\\\\\]|\\\\\\(([\\s\\S]+?)\\\\\\)|\\$([^$\\n]+?)\\$';
const ESCAPED_DOLLAR = '\u0000';

type MathSeg =
  | { math: true; tex: string; display: boolean }
  | { math: false; text: string };

function splitMath(text: string): MathSeg[] {
  const segs: MathSeg[] = [];
  const src = text.replace(/\\\$/g, ESCAPED_DOLLAR);
  const restore = (t: string) => t.split(ESCAPED_DOLLAR).join('$');
  const re = new RegExp(MATH_SRC, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) segs.push({ math: false, text: restore(src.slice(last, m.index)) });
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (!tex) {
      segs.push({ math: false, text: restore(m[0]) });
    } else {
      segs.push({ math: true, tex, display });
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) segs.push({ math: false, text: restore(src.slice(last)) });
  return segs;
}

function MathSpan({ tex, display }: { tex: string; display: boolean }) {
  let html: string | null = null;
  try {
    html = katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: false });
  } catch {
    html = null;
  }
  if (html === null) {
    return (
      <code className="px-1 py-0.5 rounded bg-[#1a1a22] text-[#e8b4f0] text-[13px] font-mono">
        {display ? `$$${tex}$$` : `$${tex}$`}
      </code>
    );
  }
  if (display) {
    return (
      <span
        className="block overflow-x-auto py-1 text-center [&>.katex-display]:my-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Inline formatting (math first, then bold, italic, code, links) ──────────────

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let k = 0;
  for (const seg of splitMath(text)) {
    if (seg.math) {
      out.push(<MathSpan key={`${keyPrefix}-m${k++}`} tex={seg.tex} display={seg.display} />);
    } else {
      for (const node of renderInlinePlain(seg.text, `${keyPrefix}-s${k}`)) {
        out.push(node);
      }
      k += 1;
    }
  }
  return out;
}

function renderInlinePlain(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // code | link | bold | italic
  const re = /(`[^`]+`)|\[([^\]]+)\]\((https?:[^)\s]+)\)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  const pushText = (t: string) => {
    if (t) out.push(<span key={`${keyPrefix}-t${k++}`}>{t}</span>);
  };

  while ((m = re.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) {
      out.push(
        <code
          key={`${keyPrefix}-c${k++}`}
          className="px-1 py-0.5 rounded bg-[#1a1a22] text-[#e8b4f0] text-[13px] font-mono"
        >
          {m[1].slice(1, -1)}
        </code>,
      );
    } else if (m[2] && m[3]) {
      out.push(
        <a
          key={`${keyPrefix}-a${k++}`}
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
        >
          {m[2]}
        </a>,
      );
    } else if (m[4]) {
      out.push(
        <strong key={`${keyPrefix}-b${k++}`} className="font-semibold text-[#F5F5F5]">
          {m[4].slice(2, -2)}
        </strong>,
      );
    } else if (m[5]) {
      out.push(
        <em key={`${keyPrefix}-i${k++}`} className="text-[#e5e5ea]">
          {m[5].slice(1, -1)}
        </em>,
      );
    }
  }
  pushText(text.slice(last));
  return out;
}

// ── Block renderers ────────────────────────────────────────────

function tableToTsv(header: string[], rows: string[][]): string {
  const lines = [header.join('\t')];
  for (const r of rows) lines.push(r.join('\t'));
  return lines.join('\n');
}

function CodeBlock({ codeLang, code, uiLang }: { codeLang: string; code: string; uiLang: AppLang }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[#24242D] bg-[#0d0d12]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111116] border-b border-[#24242D]">
        <span className="text-xs text-[#8B8B98] font-mono">{codeLang || t(uiLang, 'code.name')}</span>
        <CopyButton text={code} lang={uiLang} />
      </div>
      <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed font-mono text-[#e5e5ea] whitespace-pre">
        {code || ' '}
      </pre>
    </div>
  );
}

const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function TableBlock({ header, align, rows, uiLang }: { header: string[]; align: Align[]; rows: string[][]; uiLang: AppLang }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[#24242D]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111116] border-b border-[#24242D]">
        <span className="text-xs text-[#8B8B98]">
          {t(uiLang, 'table.name')} • {header.length} {t(uiLang, 'table.cols')} • {rows.length} {t(uiLang, 'table.rows')}
        </span>
        <CopyButton text={tableToTsv(header, rows)} label={t(uiLang, 'table.copyTsv')} lang={uiLang} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[320px]">
          <thead>
            <tr className="bg-[#111116]">
              {header.map((h, idx) => (
                <th
                  key={idx}
                  className={`px-3 py-2 font-semibold text-[#F5F5F5] border-b border-[#24242D] whitespace-nowrap ${ALIGN_CLASS[align[idx] || 'left']}`}
                >
                  {h || ' '}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={header.length} className="px-3 py-3 text-center text-[#8B8B98] text-[13px]">
                  {t(uiLang, 'table.empty')}
                </td>
              </tr>
            )}
            {rows.map((row, r) => (
              <tr key={r} className="odd:bg-[#0e0e14] even:bg-[#111116]">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`px-3 py-2 text-[#e5e5ea] border-b border-[#1d1d26] align-top ${ALIGN_CLASS[align[c] || 'left']}`}
                  >
                    {cell ? renderInline(cell, `t${r}-${c}`) : <span className="text-[#55555f]">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RichMessage({ content, lang }: { content: string; lang?: string }) {
  if (!content) return null;
  const uiLang = normalizeLang(lang);
  const blocks = parseMarkdown(content);

  return (
    <div className="flex flex-col gap-2.5 w-full min-w-0">
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case 'heading':
            return b.level === 1 ? (
              <h2 key={idx} className="text-lg font-bold text-[#F5F5F5] mt-1">
                {renderInline(b.text, `h${idx}`)}
              </h2>
            ) : b.level === 2 ? (
              <h3 key={idx} className="text-[16px] font-semibold text-[#F5F5F5] mt-1">
                {renderInline(b.text, `h${idx}`)}
              </h3>
            ) : (
              <h4 key={idx} className="text-[15px] font-semibold text-[#e5e5ea] mt-1">
                {renderInline(b.text, `h${idx}`)}
              </h4>
            );
          case 'code':
            return <CodeBlock key={idx} codeLang={b.lang} code={b.code} uiLang={uiLang} />;
          case 'table':
            return <TableBlock key={idx} header={b.header} align={b.align} rows={b.rows} uiLang={uiLang} />;
          case 'list':
            return b.ordered ? (
              <ol key={idx} className="list-decimal pl-5 space-y-1 text-[#e5e5ea]">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `l${idx}-${j}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={idx} className="list-disc pl-5 space-y-1 text-[#e5e5ea]">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `l${idx}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'quote':
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-indigo-500/60 pl-3 text-[#b9b9c4] italic whitespace-pre-wrap"
              >
                {renderInline(b.text, `q${idx}`)}
              </blockquote>
            );
          case 'hr':
            return <hr key={idx} className="border-[#24242D] my-1" />;
          case 'paragraph':
          default:
            return (
              <p key={idx} className="whitespace-pre-wrap text-[#e5e5ea]">
                {renderInline(b.text, `p${idx}`)}
              </p>
            );
        }
      })}
    </div>
  );
}

// ── Document detection + follow-up suggestions ─────────────────

export function isDocumentLike(content: string): boolean {
  if (!content) return false;
  if (content.length > 600) return true;
  const blocks = parseMarkdown(content);
  let rich = 0;
  for (const b of blocks) {
    if (b.kind === 'heading' || b.kind === 'table' || b.kind === 'code') rich += 2;
    else if (b.kind === 'list') rich += 1;
  }
  return rich >= 2;
}

export function docTitle(content: string, lang?: string): string {
  const blocks = parseMarkdown(content);
  for (const b of blocks) {
    if (b.kind === 'heading' && b.text) return b.text.slice(0, 60);
  }
  const first = (content || '').split('\n').map((l) => l.trim()).find((l) => l.length > 0) || '';
  const fallback = t(normalizeLang(lang), 'doc.fallbackTitle');
  return first.length > 60 ? first.slice(0, 60) + '…' : first || fallback;
}

export function hasTable(content: string): boolean {
  return parseMarkdown(content).some((b) => b.kind === 'table');
}

export function hasCode(content: string): boolean {
  return parseMarkdown(content).some((b) => b.kind === 'code');
}

export function getFollowUps(content: string, title: string, lang: string = 'en'): FollowUp[] {
  const ref = title && !FALLBACK_DOC_TITLES.has(title) ? ` "${title}"` : '';
  const L = ((lang || 'en').split(/[-_]/)[0] || 'en').toLowerCase();
  if (hasTable(content)) {
    switch (L) {
      case 'ar': return [
        { id: 'tbl-explain', label: 'اشرح الجدول', prompt: `اشرح الجدول في إجابتك الأخيرة${ref} بلغة بسيطة.` },
        { id: 'tbl-addcol', label: 'أضف عموداً', prompt: `أضف عموداً مناسباً إلى الجدول في إجابتك الأخيرة${ref} واعرض الجدول الجديد كاملاً.` },
        { id: 'tbl-sum', label: 'لخّص', prompt: `لخّص الجدول في إجابتك الأخيرة${ref}.` },
      ];
      case 'id': return [
        { id: 'tbl-explain', label: 'Jelaskan tabel', prompt: `Jelaskan tabel pada jawaban terakhirmu${ref} dengan bahasa sederhana.` },
        { id: 'tbl-addcol', label: 'Tambah kolom', prompt: `Tambahkan satu kolom yang relevan ke tabel pada jawaban terakhirmu${ref}, tampilkan tabel lengkap yang baru.` },
        { id: 'tbl-sum', label: 'Buat ringkasan', prompt: `Buatkan ringkasan dari tabel pada jawaban terakhirmu${ref}.` },
      ];
      case 'ru': return [
        { id: 'tbl-explain', label: 'Объясни таблицу', prompt: `Объясни таблицу из твоего последнего ответа${ref} простыми словами.` },
        { id: 'tbl-addcol', label: 'Добавить столбец', prompt: `Добавь уместный столбец в таблицу из последнего ответа${ref} и покажи новую таблицу целиком.` },
        { id: 'tbl-sum', label: 'Сводка', prompt: `Сделай краткую сводку таблицы из последнего ответа${ref}.` },
      ];
      case 'zh': return [
        { id: 'tbl-explain', label: '解释表格', prompt: `请用通俗的语言解释你上一次回答中的表格${ref}。` },
        { id: 'tbl-addcol', label: '加一列', prompt: `请给上一次回答中的表格${ref}加一列相关内容，并展示完整新表格。` },
        { id: 'tbl-sum', label: '总结', prompt: `请总结上一次回答中的表格${ref}。` },
      ];
      case 'ja': return [
        { id: 'tbl-explain', label: '表を解説', prompt: `直前の回答の表${ref}をやさしく解説してください。` },
        { id: 'tbl-addcol', label: '列を追加', prompt: `直前の回答の表${ref}に関連する列を1つ追加し、新しい表全体を表示してください。` },
        { id: 'tbl-sum', label: '要約', prompt: `直前の回答の表${ref}を要約してください。` },
      ];
      case 'ko': return [
        { id: 'tbl-explain', label: '표 설명', prompt: `방금 답변의 표${ref}를 쉬운 말로 설명해줘.` },
        { id: 'tbl-addcol', label: '열 추가', prompt: `방금 답변의 표${ref}에 관련 열을 하나 추가하고 새 표 전체를 보여줘.` },
        { id: 'tbl-sum', label: '요약', prompt: `방금 답변의 표${ref}를 요약해줘.` },
      ];
      default: return [
        { id: 'tbl-explain', label: 'Explain table', prompt: `Explain the table in your last answer${ref} in simple terms.` },
        { id: 'tbl-addcol', label: 'Add column', prompt: `Add one relevant column to the table in your last answer${ref} and show the full new table.` },
        { id: 'tbl-sum', label: 'Summarize', prompt: `Summarize the table in your last answer${ref}.` },
      ];
    }
  }
  if (hasCode(content)) {
    switch (L) {
      case 'ar': return [
        { id: 'code-explain', label: 'اشرح الكود', prompt: `اشرح الكود في إجابتك الأخيرة${ref} سطراً بسطر بلغة بسيطة.` },
        { id: 'code-comment', label: 'أضف تعليقات', prompt: `أعد كتابة الكود في إجابتك الأخيرة${ref} مع تعليقات شرح داخل نفس كتلة الكود.` },
      ];
      case 'id': return [
        { id: 'code-explain', label: 'Jelaskan kode', prompt: `Jelaskan kode pada jawaban terakhirmu${ref} baris per baris dengan bahasa sederhana.` },
        { id: 'code-comment', label: 'Tambah komentar', prompt: `Tulis ulang kode pada jawaban terakhirmu${ref} dengan komentar penjelasan, dalam blok kode yang sama.` },
      ];
      case 'ru': return [
        { id: 'code-explain', label: 'Объясни код', prompt: `Объясни код из последнего ответа${ref} построчно простыми словами.` },
        { id: 'code-comment', label: 'Добавить комментарии', prompt: `Перепиши код из последнего ответа${ref} с поясняющими комментариями в том же блоке кода.` },
      ];
      case 'zh': return [
        { id: 'code-explain', label: '解释代码', prompt: `请逐行用通俗语言解释上一次回答中的代码${ref}。` },
        { id: 'code-comment', label: '加注释', prompt: `请重写上一次回答中的代码${ref}，加上说明注释，保持同一代码块。` },
      ];
      case 'ja': return [
        { id: 'code-explain', label: 'コードを解説', prompt: `直前の回答のコード${ref}を1行ずつやさしく解説してください。` },
        { id: 'code-comment', label: 'コメント追加', prompt: `直前の回答のコード${ref}を説明コメント付きで同じコードブロックに書き直してください。` },
      ];
      case 'ko': return [
        { id: 'code-explain', label: '코드 설명', prompt: `방금 답변의 코드${ref}를 한 줄씩 쉽게 설명해줘.` },
        { id: 'code-comment', label: '주석 추가', prompt: `방금 답변의 코드${ref}를 설명 주석과 함께 같은 코드 블록으로 다시 써줘.` },
      ];
      default: return [
        { id: 'code-explain', label: 'Explain code', prompt: `Explain the code in your last answer${ref} line by line in simple terms.` },
        { id: 'code-comment', label: 'Add comments', prompt: `Rewrite the code in your last answer${ref} with explanatory comments, in the same code block.` },
      ];
    }
  }
  if (isDocumentLike(content)) {
    switch (L) {
      case 'ar': return [
        { id: 'doc-sum', label: 'لخّص', prompt: `لخّص إجابتك الأخيرة${ref}.` },
        { id: 'doc-expand', label: 'وسّع', prompt: `وسّع شرح إجابتك الأخيرة${ref} بمزيد من التفاصيل.` },
        { id: 'doc-grammar', label: 'حسّن الصياغة', prompt: `حسّن صياغة إجابتك الأخيرة${ref} دون تغيير المحتوى.` },
      ];
      case 'id': return [
        { id: 'doc-sum', label: 'Buat ringkasan', prompt: `Buatkan ringkasan dari jawaban terakhirmu${ref}.` },
        { id: 'doc-expand', label: 'Kembangkan', prompt: `Kembangkan pembahasan jawaban terakhirmu${ref} dengan lebih detail.` },
        { id: 'doc-grammar', label: 'Perbaiki tata bahasa', prompt: `Perbaiki tata bahasa jawaban terakhirmu${ref} tanpa mengubah isinya.` },
      ];
      case 'ru': return [
        { id: 'doc-sum', label: 'Сводка', prompt: `Сделай краткую сводку последнего ответа${ref}.` },
        { id: 'doc-expand', label: 'Подробнее', prompt: `Раскрой подробнее последний ответ${ref}.` },
        { id: 'doc-grammar', label: 'Исправь стиль', prompt: `Исправь стиль последнего ответа${ref}, не меняя смысл.` },
      ];
      case 'zh': return [
        { id: 'doc-sum', label: '总结', prompt: `请总结你上一次的回答${ref}。` },
        { id: 'doc-expand', label: '展开', prompt: `请更详细地展开上一次的回答${ref}。` },
        { id: 'doc-grammar', label: '润色', prompt: `请润色上一次回答${ref}的语言，不改变内容。` },
      ];
      case 'ja': return [
        { id: 'doc-sum', label: '要約', prompt: `直前の回答${ref}を要約してください。` },
        { id: 'doc-expand', label: '詳しく', prompt: `直前の回答${ref}をさらに詳しく展開してください。` },
        { id: 'doc-grammar', label: '校正', prompt: `直前の回答${ref}の文法を内容を変えずに直してください。` },
      ];
      case 'ko': return [
        { id: 'doc-sum', label: '요약', prompt: `방금 답변${ref}을 요약해줘.` },
        { id: 'doc-expand', label: '자세히', prompt: `방금 답변${ref}을 더 자세히 풀어줘.` },
        { id: 'doc-grammar', label: '다듬기', prompt: `방금 답변${ref}의 문장을 내용 그대로 다듬어줘.` },
      ];
      default: return [
        { id: 'doc-sum', label: 'Summarize', prompt: `Summarize your last answer${ref}.` },
        { id: 'doc-expand', label: 'Expand', prompt: `Expand your last answer${ref} with more detail.` },
        { id: 'doc-grammar', label: 'Fix grammar', prompt: `Fix the grammar of your last answer${ref} without changing its content.` },
      ];
    }
  }
  switch (L) {
    case 'ar': return [{ id: 'gen-detail', label: 'اشرح بتفصيل', prompt: `اشرح إجابتك الأخيرة${ref} بمزيد من التفاصيل والأمثلة.` }];
    case 'id': return [{ id: 'gen-detail', label: 'Jelaskan lebih detail', prompt: `Jelaskan jawaban terakhirmu${ref} dengan lebih detail dan contoh.` }];
    case 'ru': return [{ id: 'gen-detail', label: 'Подробнее', prompt: `Объясни последний ответ${ref} подробнее, с примерами.` }];
    case 'zh': return [{ id: 'gen-detail', label: '详细解释', prompt: `请更详细地解释上一次的回答${ref}，并举例。` }];
    case 'ja': return [{ id: 'gen-detail', label: '詳しく', prompt: `直前の回答${ref}を例を交えて詳しく説明してください。` }];
    case 'ko': return [{ id: 'gen-detail', label: '자세히', prompt: `방금 답변${ref}을 예시와 함께 더 자세히 설명해줘.` }];
    default: return [{ id: 'gen-detail', label: 'More detail', prompt: `Explain your last answer${ref} in more detail with examples.` }];
  }
}
