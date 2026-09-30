// Wilayah aktif di halaman Profil = ?kode pada alamat browser.
// Dibaca langsung dari window.location (tanpa cache router Next.js) dan
// diubah lewat History API — instan, tanpa memuat ulang halaman.

const EVT = "ditpit:location";

export function readKode(): string | null {
  return new URLSearchParams(window.location.search).get("kode");
}
export function subscribeLocation(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVT, cb);
  };
}
export function notifyLocation() {
  window.dispatchEvent(new Event(EVT));
}
/** Buka wilayah `kode` di halaman Profil yang sedang terbuka.
 *  `keepScroll` = tetap di posisi baca sekarang (dipakai pemilih wilayah yang melekat di atas). */
export function goToRegion(kode: string, opts: { keepScroll?: boolean } = {}) {
  window.history.pushState(null, "", `/profil?kode=${kode}`);
  notifyLocation();
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}

// ── perpindahan dari halaman lain ke Profil ──────────────────────────────
// Router Next.js kadang mengembalikan URL Profil yang pernah dibuka sebelumnya
// (bila halaman Profil pertama kali dibuka langsung lewat alamat). Karena itu
// wilayah tujuan dicatat dulu, lalu dipakai halaman Profil saat tampil.
const PENDING = "pdit-pending";

/** Pindah ke halaman Profil untuk `kode` dari halaman lain (mis. Peta). */
export function openProfil(router: { push: (href: string) => void }, kode: string) {
  try {
    sessionStorage.setItem(PENDING, kode);
  } catch {}
  router.push(`/profil?kode=${kode}`);
}

/** Dipanggil halaman Profil saat tampil: terapkan tujuan yang dicatat (bila ada). */
export function consumePending() {
  let k: string | null = null;
  try {
    k = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
  } catch {}
  if (k && k !== readKode()) {
    window.history.replaceState(null, "", `/profil?kode=${k}`);
    notifyLocation();
  }
}
