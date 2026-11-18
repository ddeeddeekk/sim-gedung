<#
================================================================================
SIM-GEDUNG UNSRI - Sinkronisasi Otomatis Google Apps Script (Clasp)
================================================================================
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  SINKRONISASI KODE KE GOOGLE APPS SCRIPT (CLASP)" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cek Clasp CLI
$claspCmd = (Get-Command clasp.cmd -ErrorAction SilentlyContinue).Source
if (-not $claspCmd) {
    $claspCmd = "clasp.cmd"
}

try {
    & $claspCmd -v | Out-Null
} catch {
    Write-Host "[!] Google Clasp CLI tidak ditemukan atau gagal dijalankan." -ForegroundColor Red
    Write-Host "    Silakan install clasp dengan perintah:" -ForegroundColor Yellow
    Write-Host "    npm.cmd install -g @google/clasp" -ForegroundColor White
    Read-Host "`nTekan ENTER untuk kembali..."
    exit 1
}

# 2. Cek apakah .clasp.json sudah ada
$claspConfigPath = Join-Path $ScriptDir ".clasp.json"
if (-not (Test-Path $claspConfigPath)) {
    Write-Host "[i] File konfigurasi .clasp.json belum ditemukan di proyek ini." -ForegroundColor Yellow
    Write-Host "    Masukkan Script ID dari proyek Google Apps Script Anda." -ForegroundColor White
    Write-Host "    (Script ID didapat dari editor Apps Script: Project Settings > Script ID)" -ForegroundColor Gray
    Write-Host ""
    $scriptId = Read-Host "Masukkan Apps Script ID Anda"
    
    if ([string]::IsNullOrWhiteSpace($scriptId)) {
        Write-Host "[x] Script ID tidak boleh kosong. Dibatalkan." -ForegroundColor Red
        Read-Host "`nTekan ENTER untuk kembali..."
        exit 1
    }

    $claspConfig = @{
        scriptId = $scriptId.Trim()
        rootDir = "."
    } | ConvertTo-Json

    Set-Content -Path $claspConfigPath -Value $claspConfig -Encoding UTF8
    Write-Host "[OK] Berhasil membuat .clasp.json dengan Script ID: $scriptId" -ForegroundColor Green
    Write-Host ""
}

# 3. Tampilkan Menu Pilihan Clasp
Write-Host "Pilih Aksi Clasp:" -ForegroundColor Cyan
Write-Host "  [1] Push Kode Terbaru (Upload Code.gs & index.html ke GAS)" -ForegroundColor White
Write-Host "  [2] Deploy Versi Baru Web App (clasp deploy)" -ForegroundColor White
Write-Host "  [3] Buka Proyek di Browser (clasp open)" -ForegroundColor White
Write-Host "  [4] Login Ulang Akun Google (clasp login)" -ForegroundColor White
Write-Host "  [5] Ganti / Perbarui Script ID (.clasp.json)" -ForegroundColor White
Write-Host "  [0] Batal" -ForegroundColor Gray
Write-Host ""

$pilihan = Read-Host "Pilihan Anda (1-5)"

switch ($pilihan) {
    "1" {
        Write-Host "`n[>>] Mengunggah berkas ke Google Apps Script..." -ForegroundColor Cyan
        & $claspCmd push --force
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n[SUKSES] Berkas berhasil diunggah ke Google Apps Script!" -ForegroundColor Green
        } else {
            Write-Host "`n[GAGAL] Gagal mengunggah kode. Pastikan Anda sudah login via 'clasp login' dan mengaktifkan Google Apps Script API di user settings." -ForegroundColor Red
        }
    }
    "2" {
        $desc = Read-Host "`nMasukkan deskripsi versi deploy (misal: Update v2.1 UI & Fitur Baru)"
        if ([string]::IsNullOrWhiteSpace($desc)) {
            $desc = "Update otomatis via PowerShell " + (Get-Date -Format "yyyy-MM-dd HH:mm")
        }
        Write-Host "[>>] Membuat deployment baru di Apps Script..." -ForegroundColor Cyan
        & $claspCmd deploy --description $desc
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n[SUKSES] Deployment baru berhasil diterbitkan!" -ForegroundColor Green
        }
    }
    "3" {
        Write-Host "`n[>>] Membuka editor Apps Script di browser..." -ForegroundColor Cyan
        & $claspCmd open
    }
    "4" {
        Write-Host "`n[>>] Membuka alur login akun Google di browser..." -ForegroundColor Cyan
        & $claspCmd login
    }
    "5" {
        $scriptId = Read-Host "`nMasukkan Script ID baru"
        if (-not [string]::IsNullOrWhiteSpace($scriptId)) {
            $claspConfig = @{
                scriptId = $scriptId.Trim()
                rootDir = "."
            } | ConvertTo-Json
            Set-Content -Path $claspConfigPath -Value $claspConfig -Encoding UTF8
            Write-Host "[OK] Script ID berhasil diperbarui!" -ForegroundColor Green
        }
    }
    default {
        Write-Host "Dibatalkan." -ForegroundColor Gray
    }
}

Write-Host ""
Read-Host "Tekan ENTER untuk kembali..."
