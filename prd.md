# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# BroAgent — Smart Response & Interactive Conversation

**Product:** BroAgent — AI Personal Education Agent  
**Feature:** Smart Response Renderer & Interactive Conversation  
**Version:** 1.0  
**Status:** Proposed  
**Priority:** High

---

## 1. Product Overview

### 1.1 Background

BroAgent merupakan AI Personal Education Agent yang dirancang untuk membantu pengguna melalui satu percakapan dengan berbagai kemampuan.

Saat ini, pengembangan difokuskan pada peningkatan kualitas output dan pengalaman percakapan. Jawaban AI tidak cukup hanya ditampilkan sebagai teks biasa. BroAgent perlu mampu menyajikan hasil dalam format yang sesuai dengan permintaan pengguna, menyediakan tindakan yang relevan, serta menawarkan langkah lanjutan yang dapat dipilih secara langsung.

### 1.2 Product Vision

Mengubah BroAgent dari chatbot berbasis teks menjadi AI assistant dengan output terstruktur, workspace interaktif, dan percakapan yang kontekstual.

### 1.3 Core Principle

**One conversation. Multiple output formats. Seamless follow-up.**

Pengguna dapat meminta berbagai jenis pekerjaan dalam satu percakapan, menerima hasil dalam format yang sesuai, dan mengembangkannya tanpa harus mengulang konteks dari awal.

### 1.4 Goals

1. Menampilkan dokumen yang rapi dan mudah disalin.
2. Menyajikan tabel dengan struktur yang benar.
3. Menampilkan output terstruktur berdasarkan jenis permintaan.
4. Menyediakan tombol aksi yang benar-benar berfungsi.
5. Memberikan saran lanjutan yang relevan dengan hasil sebelumnya.
6. Mempertahankan konteks percakapan ketika pengguna mengedit atau mengembangkan hasil.
7. Mempertahankan arsitektur dan fitur BroAgent yang sudah ada.

### 1.5 Non-Goals

Versi ini tidak berfokus pada:

- Membuat model AI baru.
- Mengganti keseluruhan AI engine atau integrasi AI provider.
- Membangun ulang autentikasi dan database.
- Mengembangkan sistem kolaborasi dokumen real-time.
- Mengimplementasikan seluruh fitur ekspor dokumen sekaligus.
- Mengubah keseluruhan desain aplikasi di luar kebutuhan fitur ini.

---

## 2. Target Users

### Primary Users

Pengguna yang membutuhkan bantuan untuk menghasilkan output siap pakai melalui percakapan AI.

### Use Cases

- Pelajar membuat artikel, rangkuman, laporan, dan jadwal belajar.
- Developer menghasilkan dokumentasi dan tabel teknis.
- Pengguna membuat rencana, checklist, dan daftar tugas.
- Pengguna mengembangkan hasil AI sebelumnya melalui instruksi lanjutan.

---

## 3. Feature Requirements

### F01 — Smart Response Renderer

**Priority: P0**

Sistem harus mampu menampilkan respons AI berdasarkan tipe kontennya.

Jenis renderer awal:

- `text`: jawaban percakapan biasa.
- `document`: artikel, surat, laporan, dan konten panjang.
- `table`: data dalam format tabel.
- `list`: daftar dan checklist.
- `steps`: panduan atau instruksi berurutan.
- `code`: kode program dengan syntax highlighting.
- `follow_up`: pilihan tindakan lanjutan.

Sistem tidak boleh menganggap setiap respons sebagai dokumen. Pemilihan renderer harus berdasarkan struktur data respons yang valid.

Jika tipe output tidak tersedia atau tidak valid, sistem harus menampilkan fallback berupa teks biasa.

### F02 — Document Output

**Priority: P0**

Ketika pengguna meminta artikel, laporan, surat, atau dokumen lainnya, BroAgent menampilkan hasil dalam blok dokumen terpisah dari pesan percakapan biasa.

Struktur dokumen dapat meliputi:

- Judul.
- Subjudul.
- Paragraf.
- Heading bertingkat.
- Bullet list dan numbered list.
- Tabel jika diperlukan.
- Penutup atau kesimpulan.

Actions:

1. **Copy:** menyalin isi dokumen ke clipboard.
2. **Edit:** memungkinkan pengguna mengubah konten dokumen.
3. **Save:** menyimpan perubahan selama sesi atau menggunakan mekanisme penyimpanan aplikasi yang sudah tersedia.
4. **Regenerate:** meminta AI menghasilkan versi baru.
5. **Continue editing:** mengirim instruksi untuk mengembangkan dokumen sebelumnya.

Acceptance criteria:

- Dokumen ditampilkan secara terpisah dari bubble chat biasa.
- Struktur heading dan paragraf tetap terbaca.
- Tombol Copy menyalin konten dokumen, bukan seluruh riwayat chat.
- Pengguna dapat mengedit konten tanpa kehilangan isi aslinya secara tidak sengaja.
- Regenerate menghasilkan versi baru tanpa otomatis menimpa dokumen yang sedang diedit.
- Jika clipboard gagal diakses, aplikasi menampilkan notifikasi kegagalan.

### F03 — Structured Table Output

**Priority: P0**

BroAgent harus dapat menyajikan data dalam bentuk tabel yang benar-benar terstruktur.

Komponen tabel meliputi:

- Header kolom.
- Baris data.
- Alignment yang konsisten.
- Horizontal scrolling pada layar kecil.
- Copy table.
- Edit table.
- Regenerate atau modify table.

Contoh permintaan:

"Buat tabel jadwal belajar selama seminggu."

Output harus menampilkan kolom seperti hari, waktu, mata pelajaran, dan aktivitas.

Acceptance criteria:

- Data dirender sebagai tabel, bukan teks dengan pemisah manual.
- Jumlah kolom setiap baris sesuai dengan struktur data.
- Tabel tetap dapat dibaca di desktop dan perangkat mobile.
- Copy table menyalin data dalam format yang dapat ditempel ke spreadsheet.
- Tabel kosong atau data tidak valid ditangani dengan aman.

### F04 — Interactive Follow-up Actions

**Priority: P0**

Setelah menyelesaikan permintaan, BroAgent dapat menawarkan beberapa tindakan lanjutan yang relevan.

Contoh setelah membuat artikel:

- Buat ringkasan.
- Terjemahkan ke bahasa Inggris.
- Kembangkan pembahasan.
- Perbaiki tata bahasa.
- Tidak, cukup.

Contoh setelah membuat tabel:

- Tambah kolom.
- Ubah format.
- Tambahkan penjelasan.
- Tidak, cukup.

Follow-up harus ditampilkan sebagai tombol atau pilihan interaktif di bawah respons terkait.

Behavior:

- Memilih tindakan akan mengirim instruksi ke sistem percakapan.
- Instruksi harus menyertakan referensi ke respons atau dokumen terkait.
- BroAgent harus mempertahankan konteks yang diperlukan.
- Pilihan "Tidak, cukup" menutup atau menyelesaikan tawaran tanpa memulai generasi baru.
- Pilihan "Lainnya" membuka input untuk instruksi bebas.

Acceptance criteria:

- Tombol yang ditampilkan benar-benar berfungsi.
- Pemilihan opsi tidak mengirim pesan ganda.
- Pengguna dapat mengirim instruksi sendiri.
- Follow-up tidak selalu diwajibkan pada setiap jawaban.
- Saran harus relevan dengan jenis output dan konteks percakapan.

### F05 — Contextual Conversation Continuity

**Priority: P0**

BroAgent harus memahami hubungan antara permintaan terbaru dengan hasil sebelumnya.

Contoh alur:

1. Pengguna meminta artikel tentang kecerdasan buatan.
2. BroAgent menghasilkan dokumen.
3. Pengguna memilih "Buat ringkasan".
4. BroAgent menghasilkan ringkasan berdasarkan artikel tersebut.
5. Pengguna meminta "Ubah ke bahasa Inggris".
6. BroAgent menerjemahkan hasil yang relevan tanpa meminta pengguna mengirim ulang artikel.

Sistem perlu membedakan:

- Melanjutkan dokumen sebelumnya.
- Mengubah dokumen sebelumnya.
- Membuat output baru.
- Mengajukan pertanyaan baru yang tidak terkait.

Acceptance criteria:

- Follow-up menggunakan konteks yang tepat.
- Hasil sebelumnya tidak hilang hanya karena muncul respons baru.
- Referensi dokumen tidak tertukar dengan dokumen lain di percakapan yang sama.
- Jika konteks tidak cukup jelas, BroAgent meminta klarifikasi.

### F06 — Additional Structured Outputs

**Priority: P1**

Setelah fitur P0 stabil, renderer dikembangkan untuk:

- Checklist interaktif.
- Step-by-step guide.
- Ringkasan terstruktur.
- Code block dengan syntax highlighting dan tombol Copy.
- Rencana belajar.
- Data comparison.
- Template dokumen.

Setiap tipe output harus menggunakan komponen renderer yang sesuai dan memiliki fallback jika data tidak valid.

### F07 — User Experience States

**Priority: P0**

Seluruh komponen harus memiliki state yang jelas:

- Idle.
- Generating.
- Success.
- Error.
- Editing.
- Saving.
- Copy success.
- Copy failure.

Loading indicator harus muncul ketika AI sedang menghasilkan respons. Aplikasi tidak boleh menampilkan status berhasil sebelum operasi terkait benar-benar berhasil.

---

## 4. User Interface Requirements

### 4.1 Design Principles

- Minimalis, modern, dan konsisten dengan UI BroAgent saat ini.
- Output dokumen memiliki hierarki visual yang jelas.
- Tombol aksi tidak memenuhi seluruh area respons.
- Konten tetap menjadi fokus utama.
- Follow-up actions muncul secara kontekstual.
- Tampilan respons nyaman digunakan pada desktop maupun mobile.

### 4.2 Suggested Document Card

Struktur:

1. Header dokumen.
2. Judul dokumen.
3. Area isi.
4. Toolbar tindakan.
5. Follow-up suggestions.

Toolbar dapat menampilkan Copy, Edit, dan Regenerate. Fitur tambahan dapat diletakkan dalam menu tindakan agar antarmuka tetap bersih.

### 4.3 Suggested Table Card

Struktur:

1. Judul tabel.
2. Area tabel.
3. Toolbar Copy dan Edit.
4. Follow-up suggestions.

### 4.4 Conversation Flow

Urutan yang disarankan:

1. Pesan pengguna.
2. Respons atau output AI.
3. Actions yang tersedia.
4. Saran lanjutan jika relevan.
5. Input pesan berikutnya.

---

## 5. Technical Requirements

### 5.1 Existing Architecture

Pengembangan harus menyesuaikan arsitektur BroAgent yang sudah ada:

- Frontend: Next.js 15 + TypeScript.
- Backend: NestJS.
- AI services: integrasi Google Gemini yang sudah berjalan, sesuai implementasi saat ini.
- Database: Supabase (Postgres) sebagai satu-satunya database.

Jangan mengganti teknologi atau membuat layanan baru tanpa kebutuhan yang jelas.

### 5.2 Response Contract

Sistem sebaiknya menggunakan kontrak respons terstruktur agar frontend dapat menentukan renderer dengan pasti.

Contoh konseptual:

```ts
type ResponseBlock =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "document";
      title: string;
      content: string;
      format: "markdown";
    }
  | {
      type: "table";
      title?: string;
      columns: string[];
      rows: string[][];
    }
  | {
      type: "list";
      title?: string;
      items: string[];
    };

type FollowUpAction = {
  id: string;
  label: string;
  prompt: string;
};

type AgentResponse = {
  version: 1;
  blocks: ResponseBlock[];
  followUps?: FollowUpAction[];
};
```

Kontrak di atas merupakan rancangan awal, bukan asumsi bahwa seluruh backend sudah mendukung format tersebut.

Implementasi harus memeriksa struktur kode yang ada dan menentukan cara mengintegrasikannya tanpa merusak format respons lama.

### 5.3 Rendering Strategy

- Gunakan renderer berdasarkan `type`.
- Pisahkan komponen setiap format agar mudah dipelihara.
- Validasi data sebelum dirender.
- Jangan merender HTML mentah dari respons AI tanpa sanitasi.
- Gunakan parser Markdown yang aman jika diperlukan.
- Gunakan fallback untuk respons lama atau respons yang tidak sesuai skema.
- Hindari membuat renderer berdasarkan tebakan dari kata-kata respons jika data terstruktur tersedia.

### 5.4 Action Handling

Setiap action harus memiliki handler yang sesuai.

Contoh:

- Copy → clipboard API.
- Edit → membuka mode edit.
- Save → memperbarui state atau penyimpanan yang tersedia.
- Regenerate → mengirim ulang permintaan generasi.
- Follow-up → mengirim prompt dengan konteks respons sebelumnya.

Setiap action harus menangani loading, kegagalan, dan pencegahan request duplikat.

### 5.5 Persistence

Jika database sudah memiliki model pesan dan percakapan, evaluasi apakah metadata output perlu disimpan bersama pesan atau pada model terpisah.

Persyaratan:

- Riwayat percakapan tetap dapat ditampilkan.
- Output terstruktur dapat dipulihkan ketika percakapan dibuka kembali.
- Perubahan dokumen tidak boleh diam-diam mengubah pesan lama tanpa aturan yang jelas.
- Perubahan skema database harus dilakukan hanya jika benar-benar dibutuhkan.

---

## 6. Functional Acceptance Criteria

Versi pertama dianggap memenuhi kebutuhan utama apabila:

1. Permintaan artikel menghasilkan document block.
2. Permintaan tabel menghasilkan tabel terstruktur.
3. Pengguna dapat menyalin konten dokumen dan tabel.
4. Pengguna dapat mengedit dokumen tanpa kehilangan konten.
5. Pengguna dapat meminta regenerasi output.
6. BroAgent menawarkan follow-up yang relevan jika diperlukan.
7. Tombol follow-up benar-benar melanjutkan percakapan.
8. Konteks output sebelumnya tetap tersedia untuk modifikasi.
9. Respons teks biasa tetap berfungsi.
10. Tampilan tidak rusak pada desktop maupun mobile.
11. Error dan loading state ditampilkan dengan benar.
12. Fitur chat lama tetap berjalan.

---

## 7. Implementation Roadmap

### Phase 0 — Codebase Audit

- Periksa komponen chat Next.js.
- Periksa alur respons dari NestJS dan AI engine.
- Identifikasi format pesan yang digunakan.
- Periksa penyimpanan pesan dan riwayat percakapan.
- Tentukan integrasi minimal tanpa merombak arsitektur.

**Deliverable:** peta alur respons dan rencana perubahan file.

### Phase 1 — Response Renderer Foundation

- Definisikan kontrak respons.
- Buat renderer utama.
- Tambahkan text dan document block.
- Tambahkan fallback untuk respons lama.
- Uji integrasi dengan chat yang sudah ada.

**Deliverable:** respons teks dan dokumen dapat dirender secara konsisten.

### Phase 2 — Document Actions

- Tambahkan Copy.
- Tambahkan Edit.
- Tambahkan Save sesuai dukungan penyimpanan.
- Tambahkan Regenerate.
- Tambahkan state dan error handling.

**Deliverable:** dokumen dapat digunakan dan dikembangkan oleh pengguna.

### Phase 3 — Structured Tables

- Implementasikan table renderer.
- Tambahkan Copy table.
- Tambahkan edit dan modifikasi tabel.
- Pastikan responsive behavior.

**Deliverable:** output tabel yang terstruktur dan siap digunakan.

### Phase 4 — Follow-up Interaction

- Definisikan struktur follow-up action.
- Buat tombol pilihan dinamis.
- Implementasikan aksi "Ya", "Tidak", dan "Lainnya" sesuai konteks.
- Integrasikan dengan alur percakapan.
- Pastikan konteks output tetap benar.

**Deliverable:** percakapan dapat berlanjut melalui pilihan interaktif.

### Phase 5 — Persistence & Polish

- Pulihkan output terstruktur dari riwayat chat.
- Sempurnakan UI.
- Uji loading, error, dan duplicate request.
- Jalankan regression test.

**Deliverable:** fitur stabil dan siap digunakan.

---

## 8. Testing Strategy

### Functional Tests

- Respons artikel.
- Respons tabel.
- Respons teks biasa.
- Copy dan Edit.
- Regenerate.
- Follow-up action.
- Konteks percakapan.

### Edge Cases

- Respons AI kosong.
- JSON tidak valid.
- Kolom tabel tidak konsisten.
- Clipboard tidak tersedia.
- Pengguna mengklik tombol beberapa kali.
- Respons AI gagal di tengah generasi.
- Percakapan memiliki beberapa dokumen.
- Dokumen diedit sebelum regenerate.
- Pengguna membuka kembali riwayat chat.

### Regression Tests

Pastikan autentikasi, pengiriman pesan, streaming jika tersedia, dan riwayat percakapan tetap berfungsi.

---

## 9. Success Metrics

Target awal untuk evaluasi internal:

- 100% test case utama untuk document dan table renderer lulus.
- Tidak ada regresi pada alur chat utama.
- Semua action yang ditampilkan dapat dijalankan.
- Follow-up menggunakan konteks yang sesuai dalam seluruh skenario pengujian yang ditentukan.
- Tidak ada kerusakan layout pada ukuran layar yang diuji.

Metrik penggunaan tambahan:

- Rasio penggunaan tombol Copy.
- Rasio pemilihan follow-up.
- Rasio keberhasilan regenerate.
- Frekuensi error rendering.
- Tingkat keberhasilan pemulihan output dari riwayat.

---

## 10. Final Product Definition

BroAgent Smart Response & Interactive Conversation adalah lapisan pengalaman pengguna yang mengubah jawaban AI menjadi output yang sesuai dengan kebutuhan pengguna.

Sistem menggabungkan renderer respons, tindakan langsung pada output, dan follow-up yang kontekstual dalam satu percakapan.

Prioritas implementasi adalah memastikan fondasi renderer, document output, table output, dan interaksi follow-up berfungsi dengan baik sebelum memperluas jenis output lainnya.

**Prinsip implementasi:** pertahankan sistem yang sudah ada, audit sebelum mengubah, bangun bertahap, dan uji setiap fase sebelum melanjutkan ke fase berikutnya.