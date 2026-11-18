<#
================================================================================
SIM-GEDUNG UNSRI - Menjalankan Server Lokal & Membuka Aplikasi di Browser
================================================================================
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$Port = 3000
$Url = "http://localhost:$Port"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     SIM-GEDUNG UNSRI - LOCAL DEV SERVER" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Membuka aplikasi di: $Url" -ForegroundColor Green
Write-Host " Tekan Ctrl + C di terminal ini untuk mematikan server." -ForegroundColor Gray
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Jalankan browser otomatis
Start-Process $Url

# Server HTTP mini bawaan Node.js tanpa dependensi eksternal
$serverJs = @"
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = $Port;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('Server aktif di http://localhost:' + PORT);
});
"@

$tempServerPath = Join-Path $ScriptDir ".local-server.js"
Set-Content -Path $tempServerPath -Value $serverJs -Encoding UTF8

try {
    node $tempServerPath
} finally {
    if (Test-Path $tempServerPath) {
        Remove-Item $tempServerPath -Force
    }
}
