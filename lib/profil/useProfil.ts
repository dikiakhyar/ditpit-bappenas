"use client";

import { useEffect, useState } from "react";
import { loadProfil, type Engine } from "./engine";

/** Muat data profil (±2,7 MB, sekali per sesi) saat komponen dipasang. */
export function useProfil(enabled = true) {
  const [E, setE] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadProfil()
      .then((e) => alive && setE(e))
      .catch((err) => alive && setError(String(err?.message ?? err)));
    return () => {
      alive = false;
    };
  }, [enabled]);

  return { E, error };
}
