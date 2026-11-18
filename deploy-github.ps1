<#
================================================================================
SIM-GEDUNG UNSRI - Otomatisasi Git & Deploy ke GitHub / GitHub Pages
================================================================================
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   OTOMATISASI DEPLOYMENT KE GITHUB PAGES" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cek Ketersediaan Git
$gitCmd = Get-Command git.exe -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    # Cek lokasi instalasi standar
    $standardPaths = @(
        "C:\Program Files\Git\cmd\git.exe",
        "C:\Program Files (x86)\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    foreach ($p in $standardPaths) {
        if (Test-Path $p) {
            $gitCmd = $p
            break
        }
    }
}

if (-not $gitCmd) {
    Write-Host "[!] Git belum terdeteksi di komputer Anda." -ForegroundColor Red
    Write-Host ""
    Write-Host "Untuk melakukan push otomatis ke GitHub, Anda perlu menginstal Git for Windows." -ForegroundColor Yellow
    Write-Host "1. Download Git resmi di: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "2. Atau jalankan installer setelah download selesai." -ForegroundColor White
    Write-Host ""
    $openDl = Read-Host "Apakah Anda ingin membuka link download Git di browser sekarang? (y/n)"
    if ($openDl -eq 'y' -or $openDl -eq 'Y') {
        Start-Process "https://git-scm.com/download/win"
    }
    Read-Host "`nTekan ENTER untuk kembali..."
    exit 1
}

$gitExec = if ($gitCmd -is [string]) { $gitCmd } else { $gitCmd.Source }

# 2. Cek apakah folder ini sudah menjadi repository Git
$isGitRepo = Test-Path (Join-Path $ScriptDir ".git")
if (-not $isGitRepo) {
    Write-Host "[i] Inisialisasi Git Repository baru..." -ForegroundColor Cyan
    & $gitExec init
    & $gitExec branch -M main
}

# 3. Cek Remote Origin
$remoteOutput = & $gitExec remote -v
if (-not $remoteOutput) {
    Write-Host "[i] Remote repository GitHub belum dihubungkan." -ForegroundColor Yellow
    Write-Host "    Contoh URL: https://github.com/username/sewa-gedung.git" -ForegroundColor Gray
    Write-Host ""
    $repoUrl = Read-Host "Masukkan URL Repository GitHub Anda"
    if ([string]::IsNullOrWhiteSpace($repoUrl)) {
        Write-Host "[x] URL tidak boleh kosong. Dibatalkan." -ForegroundColor Red
        Read-Host "`nTekan ENTER untuk kembali..."
        exit 1
    }
    & $gitExec remote add origin $repoUrl.Trim()
    Write-Host "[OK] Remote origin berhasil ditambahkan!" -ForegroundColor Green
    Write-Host ""
}

# 4. Status Git
Write-Host "--- Status Perubahan Berkas ---" -ForegroundColor Cyan
& $gitExec status -s
Write-Host "-------------------------------" -ForegroundColor Cyan
Write-Host ""

$commitMsg = Read-Host "Masukkan pesan commit (tekan ENTER untuk pesan default otomatis)"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "Update SIM-GEDUNG UNSRI - " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
}

Write-Host "`n[>>] Menambahkan semua berkas ke git (git add .)..." -ForegroundColor Cyan
& $gitExec add .

Write-Host "[>>] Melakukan commit..." -ForegroundColor Cyan
& $gitExec commit -m $commitMsg

Write-Host "[>>] Melakukan Push ke GitHub (branch: main)..." -ForegroundColor Cyan
& $gitExec push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host " [SUKSES] Perubahan berhasil di-push ke GitHub!" -ForegroundColor Green
    Write-Host " Jika menggunakan GitHub Pages, situs Anda akan terupdate otomatis dalam 1-2 menit." -ForegroundColor White
    Write-Host "==================================================" -ForegroundColor Green
} else {
    Write-Host "`n[GAGAL] Terjadi kendala saat push ke GitHub." -ForegroundColor Red
    Write-Host "Tips: Pastikan kredensial GitHub Anda sudah login atau gunakan Personal Access Token (PAT)." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Tekan ENTER untuk kembali..."
