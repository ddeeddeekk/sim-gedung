<#
================================================================================
SIM-GEDUNG UNSRI - Control Center (CLI PowerShell Dashboard)
================================================================================
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Show-Header {
    Clear-Host
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "           SIM-GEDUNG UNSRI - POWERSHELL CONTROL CENTER         " -ForegroundColor Yellow
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host " Direktori Proyek : $ScriptDir" -ForegroundColor Gray
    Write-Host " Node.js          : $(node -v)" -ForegroundColor Gray
    Write-Host " Clasp CLI        : $(clasp.cmd -v 2>$null)" -ForegroundColor Gray
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
}

while ($true) {
    Show-Header
    Write-Host "  [1] Jalankan Server Lokal (Buka Web di Browser)" -ForegroundColor White
    Write-Host "  [2] Sinkronisasi Kode ke Google Apps Script (clasp push)" -ForegroundColor White
    Write-Host "  [3] Deploy / Publikasikan Versi Baru Web App GAS" -ForegroundColor White
    Write-Host "  [4] Commit & Push ke GitHub / GitHub Pages" -ForegroundColor White
    Write-Host "  [5] Tes Status Koneksi API Backend (GAS URL)" -ForegroundColor White
    Write-Host "  [6] Login / Konfigurasi Akun Google Clasp" -ForegroundColor White
    Write-Host "  [0] Keluar" -ForegroundColor DarkGray
    Write-Host ""

    $pilihan = Read-Host "Pilih menu (0-6)"

    switch ($pilihan) {
        "1" {
            & (Join-Path $ScriptDir "start-dev.ps1")
        }
        "2" {
            & (Join-Path $ScriptDir "sync-gas.ps1")
        }
        "3" {
            Write-Host "`n[>>] Membuat deployment baru di Apps Script..." -ForegroundColor Cyan
            $desc = Read-Host "Deskripsi rilis (contoh: Rilis v2.0 Production)"
            if ([string]::IsNullOrWhiteSpace($desc)) {
                $desc = "Update otomatis via PowerShell " + (Get-Date -Format "yyyy-MM-dd HH:mm")
            }
            clasp.cmd deploy --description $desc
            Read-Host "`nTekan ENTER untuk kembali ke menu..."
        }
        "4" {
            & (Join-Path $ScriptDir "deploy-github.ps1")
        }
        "5" {
            Write-Host "`n[>>] Menguji respon dari endpoint backend Google Apps Script..." -ForegroundColor Cyan
            try {
                $apiUrl = "https://script.google.com/macros/s/AKfycbybkXclNKOFMIjy2MqvnjwhgB3-TbE3c21QT7pCLYXlXXnaYkFPuBhhpjryZniMw4kvwQ/exec?action=getInitialData"
                $resp = Invoke-RestMethod -Uri $apiUrl -Method Get -TimeoutSec 15
                Write-Host "[OK] Backend GAS merespon dengan sukses!" -ForegroundColor Green
                Write-Host "     Data Gedung terbaca : $(@($resp.gedung).Count) item" -ForegroundColor White
                Write-Host "     Data Booking terbaca: $(@($resp.booking).Count) item" -ForegroundColor White
            } catch {
                Write-Host "[!] Gagal menghubungi API atau URL Web App memerlukan deployment baru." -ForegroundColor Red
                Write-Host "    Pesan error: $($_.Exception.Message)" -ForegroundColor Yellow
            }
            Read-Host "`nTekan ENTER untuk kembali ke menu..."
        }
        "6" {
            Write-Host "`n[>>] Membuka login Clasp..." -ForegroundColor Cyan
            clasp.cmd login
            Read-Host "`nTekan ENTER untuk kembali ke menu..."
        }
        "0" {
            Write-Host "`nSampai jumpa!" -ForegroundColor Green
            exit 0
        }
        default {
            Write-Host "`nPilihan tidak valid. Silakan pilih 0-6." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
}
