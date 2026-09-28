"use client";

import { useEffect, useState } from "react";
import { loadProfil, refreshProfil, type Engine } from "./engine";

// Penyimpan bersama: semua komponen (peta, panel, profil) memakai satu Engine,
// dan tombol "Perbarui" memperbarui semuanya sekaligus.
let current: Engine | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

function ensureLoaded() {
  if (current) return;
  loadProfil()
    .then((e) => {
      current = e;
      lastError = null;
      emit();
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
