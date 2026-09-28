@echo off
rem Jalankan server pengembangan DITPIT (klik dua kali file ini).
title DITPIT Bappenas - npm run dev
cd /d "%~dp0"
if not exist node_modules (
  echo node_modules belum ada, menjalankan npm install...
  call npm install
)
echo Membuka http://localhost:3000 ... (tutup jendela ini untuk menghentikan server)
call npm run dev
pause
