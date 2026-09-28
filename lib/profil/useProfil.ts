"use client";

import { useEffect, useState } from "react";
import { fetchLatest, loadProfil, refreshProfil, type Engine } from "./engine";

// Penyimpan bersama: semua komponen (peta, panel, profil) memakai satu Engine,
// dan tombol "Perbarui" memperbarui semuanya sekaligus.
let current: Engine | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

// Bila server baru bangun, ia mengirim salinan lokal dulu (source.refreshing) sambil
// membaca spreadsheet. Browser lalu mengecek ulang diam-diam sampai data terbaru siap.
let polling = false;
function pollWhileRefreshing(tries = 12) {
  if (polling || !current?.source?.refreshing) return;
  polling = true;
  const tick = (left: number) =>
    setTimeout(async () => {
      try {
        const e = await fetchLatest();
        if (!e.source?.refreshing || left <= 1) {
          current = e;
          emit();
          polling = false;
          return;
        }
      } catch {}
      if (left > 1) tick(left - 1);
      else polling = false;
    }, 5000);
  tick(tries);
}

function ensureLoaded() {
  if (current) return;
  loadProfil()
    .then((e) => {
      current = e;
      lastError = null;
      emit();
      pollWhileRefreshing();
    })
    .catch((err) => {
      lastError = String(err?.message ?? err);
      emit();
    });
}

/** Baca ulang spreadsheet sekarang (melewati cache ±5 menit). */
export async function refreshDatabase(): Promise<void> {
  const e = await refreshProfil();
  current = e;
  lastError = null;
  emit();
}

/** Data Profil/Makro dari database (Google Spreadsheet, cadangan salinan lokal). */
export function useProfil(enabled = true) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const f = () => force((n) => n + 1);
    listeners.add(f);
    ensureLoaded();
    return () => {
      listeners.delete(f);
    };
  }, [enabled]);
  return { E: enabled ? current : null, error: enabled ? lastError : null };
}
