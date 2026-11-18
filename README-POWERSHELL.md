# 🚀 Panduan Otomatisasi PowerShell - SIM-GEDUNG UNSRI

Folder ini telah dilengkapi dengan script otomatisasi PowerShell dan launcher batch (`.bat`) agar Anda dapat mengelola proyek ini dengan sekali klik tanpa ribet.

---

## ⚡ Cara Menjalankan Paling Praktis (Sekali Klik)

Anda cukup **klik dua kali (double-click)** pada file `.bat` berikut langsung dari Windows File Explorer:

| File Launcher | Fungsi |
| :--- | :--- |
| **`menu.bat`** | 🎮 **Control Center Utama**: Membuka dashboard interaktif (bisa memilih jalankan server, sync GAS, deploy GitHub, tes API, dll). |
| **`start-dev.bat`** | 🌐 **Jalankan Local Server**: Menjalankan web server lokal di `http://localhost:3000` dan otomatis membuka browser Anda. |
| **`sync-gas.bat`** | ☁️ **Upload ke Apps Script**: Otomatis mengunggah perubahan `Code.gs` dan `index.html` ke Google Apps Script via Clasp. |

---

## 🛠️ Rincian Fitur Skrip PowerShell

### 1. `menu.ps1` (Control Center)
Dashboard interaktif dengan opsi:
- `[1]` Jalankan Server Lokal (Buka Web di Browser)
- `[2]` Sinkronisasi Kode ke Google Apps Script (`clasp push`)
- `[3]` Deploy / Publikasikan Versi Baru Web App GAS (`clasp deploy`)
- `[4]` Commit & Push ke GitHub / GitHub Pages
- `[5]` Tes Status Koneksi API Backend (Pemeriksaan respons GAS URL)
- `[6]` Login / Konfigurasi Akun Google Clasp
- `[0]` Keluar

### 2. `sync-gas.ps1` (Google Apps Script CLI / Clasp)
- Otomatis menggunakan `clasp.cmd` (kompatibel dengan Node.js v26 di Windows).
- Otomatis membuat atau memperbarui file konfigurasi `.clasp.json` dengan Script ID proyek Apps Script Anda.
- Mengunggah berkas `Code.gs` dan `index.html` langsung ke cloud Google Apps Script secara instan.

### 3. `deploy-github.ps1` (Git & GitHub Pages)
- Memeriksa ketersediaan Git di sistem Anda.
- Jika Git belum terpasang, memberikan tautan unduh resmi installer Git for Windows.
- Otomatis melakukan `git init`, set branch `main`, input repository remote origin, `git add .`, commit otomatis dengan timestamp, dan `git push`.

### 4. `start-dev.ps1` (Local Development)
- Menjalankan server HTTP port 3000 tanpa memerlukan library eksternal yang berat.
- Otomatis membuka Google Chrome / browser default Anda ke aplikasi web SIM-GEDUNG UNSRI.
