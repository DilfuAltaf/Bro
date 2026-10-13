/**
 * Lampiran chat ala ChatGPT: gambar (galeri/kamera, via vision) + file teks
 * (disisipkan sebagai teks). Semua diproses di client sebelum dikirim.
 */

export type OutgoingAttachment =
  | { kind: 'image'; name: string; dataUrl: string }
  | { kind: 'text'; name: string; text: string };

export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_DOCS_PER_MESSAGE = 3;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB per gambar asli
const MAX_TEXT_BYTES = 512 * 1024; // 512KB per file teks
const COMPRESSED_MAX_DIM = 1568; // sisi terpanjang setelah kompresi

const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'js', 'jsx', 'ts', 'tsx',
  'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php',
  'html', 'css', 'scss', 'xml', 'yml', 'yaml', 'toml', 'ini', 'log', 'sql', 'sh',
]);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** File teks = MIME text/*, JSON, atau ekstensi kode/teks yang dikenal. */
export function isTextFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/json') return true;
  return TEXT_EXTS.has(extOf(file.name));
}

/**
 * Kompresi gambar via canvas (max 1568px, JPEG 85%) agar base64 kecil
 * (umumnya 200–500KB). Throw kalau format tidak bisa dibaca (mis. HEIC).
 */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, COMPRESSED_MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas tidak didukung browser ini.');
    // JPEG tidak kenal transparan — beri background putih.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    bitmap.close();
  }
}

export type PreparedBatch = {
  attachments: OutgoingAttachment[];
  /** Pesan error pertama (Indonesia) kalau ada file yang ditolak. */
  error?: string;
};

/**
 * Ubah File mentah jadi lampiran siap kirim. File yang tidak didukung
 * (PDF/Word/video/dll) ditolak dengan pesan yang jelas — bukan diam-diam.
 */
export async function prepareFiles(
  files: FileList | File[],
  alreadyImages: number,
): Promise<PreparedBatch> {
  const list = Array.from(files);
  const attachments: OutgoingAttachment[] = [];
  let error: string | undefined;
  let imageCount = alreadyImages;

  for (const file of list) {
    if (file.type.startsWith('image/')) {
      if (imageCount >= MAX_IMAGES_PER_MESSAGE) {
        error = error || `Maksimal ${MAX_IMAGES_PER_MESSAGE} gambar per pesan.`;
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        error = error || `"${file.name}" kebesaran (max 10MB).`;
        continue;
      }
      try {
        const dataUrl = await compressImage(file);
        attachments.push({ kind: 'image', name: file.name || 'gambar', dataUrl });
        imageCount += 1;
      } catch {
        error =
          error ||
          `"${file.name}" tidak bisa dibaca (mis. format HEIC iPhone). Coba JPG/PNG atau screenshot ulang.`;
      }
    } else if (isTextFile(file)) {
      if (file.size > MAX_TEXT_BYTES) {
        error = error || `"${file.name}" kebesaran untuk file teks (max 512KB).`;
        continue;
      }
      try {
        const text = await file.text();
        if (!text.trim()) {
          error = error || `"${file.name}" kosong.`;
          continue;
        }
        attachments.push({ kind: 'text', name: file.name || 'dokumen', text });
      } catch {
        error = error || `Gagal membaca "${file.name}".`;
      }
    } else if (file.type.startsWith('video/')) {
      error = error || 'Video belum didukung. Kirim sebagai gambar atau teks saja.';
    } else {
      const ext = extOf(file.name);
      error =
        error ||
        (ext === 'pdf' || ext.startsWith('doc') || ext.startsWith('ppt') || ext.startsWith('xls')
          ? `"${file.name}" (${ext.toUpperCase()}) belum didukung. Screenshot jadi gambar atau convert ke .txt dulu.`
          : `Format "${file.name}" belum didukung. Bisa kirim gambar (JPG/PNG) atau file teks.`);
    }
  }

  return { attachments, error };
}

/** Estimasi ukuran lampiran untuk label (KB/MB). */
export function prettyBytes(dataUrl: string): string {
  const bytes = Math.round((dataUrl.length * 3) / 4);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
