@echo off
rem Jalankan server pengembangan DITPIT (klik dua kali file ini).
title DITPIT Bappenas - npm run dev
cd /d "%~dp0"
echo Memeriksa dependensi (npm install)...
call npm install --no-audit --no-fund
echo Membuka http://localhost:3000 ... (tutup jendela ini untuk menghentikan server)
call npm run dev
pause
