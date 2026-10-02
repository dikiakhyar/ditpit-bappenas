"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LAYERS, type GroupId } from "@/lib/layers";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Map as MlMap } from "maplibre-gl";
import { MAKRO_CATEGORIES, buildMakro, findIndicator, type MakroCategory, type MakroData } from "@/lib/makro";
import { DEFAULT_SYMB, type Symbology } from "@/lib/classify";
import { DEFAULT_BASEMAP, type BasemapId } from "@/lib/basemap";
import { useProfil } from "@/lib/profil/useProfil";
import type { Engine } from "@/lib/profil/engine";
import { useTheme, type Theme } from "@/lib/theme";
import { labelPoints, type LabelPoint } from "@/lib/label-points";
import { JALAN_DEFAULT_WIDTH, JALAN_LAYER_ID, JALAN_URL, type JalanCakupan, type JalanFC } from "@/lib/jalan";
import { parseKawasan, type KawasanData, type KawasanRaw } from "@/lib/kawasan-prioritas";

export type Tab = "layer" | "makro" | "wilayah" | "ekspor";
interface LayerState {
  visible: boolean;
  opacity: number;
}

// FeatureCollection GeoJSON KabKota (tipe longgar agar fleksibel ke data asli)
export interface KabKotaGeo {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: unknown;
  }>;
}

/** Tampilan wilayah yang TIDAK dipilih: "abu" = diredupkan abu-abu, "sembunyi" = hilang total (termasuk garis batas). */
export type FocusMode = "abu" | "sembunyi";

/** Label nama wilayah di peta. */
export type LabelMode = "off" | "kab" | "prov" | "both";
export interface LabelSettings {
  mode: LabelMode;
  size: number; // px, ukuran nama kab/kota (provinsi otomatis sedikit lebih besar)
  color: string; // warna huruf (hex)
  halo: boolean; // garis tepi huruf agar terbaca di atas warna apa pun
}
const PREFS_KEY = "ditpit-peta-prefs-v1";
export const DEFAULT_LABELS: LabelSettings = { mode: "off", size: 12, color: "#1f2937", halo: true };

export interface MakroSel {
  catId: string;
  indId: string;
  year: number | null;
}

/** Pastikan pilihan valid terhadap katalog berdata (kategori/indikator/tahun ada). */
function normalizeSel(sel: MakroSel, catalog: MakroCategory[]): MakroSel {
  const found = findIndicator(sel.indId, catalog);
  const cat = found?.cat ?? catalog.find((c) => c.id === sel.catId) ?? catalog[0];
  if (!cat) return sel;
  const ind = found?.ind ?? cat.indicators[0];
  const ys = ind.years ?? [];
  const year = sel.year != null && ys.includes(sel.year) ? sel.year : ys.length ? ys[ys.length - 1] : null;
  return { catId: cat.id, indId: ind.id, year };
}

interface DashboardCtx {
  theme: Theme;
  toggleTheme: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  layerState: Record<string, LayerState>;
  toggleLayer: (id: string) => void;
  setOpacity: (id: string, v: number) => void;
  setGroupVisible: (group: GroupId, v: boolean) => void;
  activeCount: number;

  // wilayah terpilih (klik peta / ?kode= di URL) → panel Ringkasan & Profil
  selectedKode: string | null;
  setSelectedKode: (k: string | null) => void;
  focusMode: FocusMode;
  setFocusMode: (m: FocusMode) => void;

  // label nama wilayah
  labels: LabelSettings;
  setLabels: (p: Partial<LabelSettings>) => void;
  /** titik label kab/kota + provinsi (dihitung sekali dari batas wilayah) */
  labelGeo: { type: "FeatureCollection"; features: LabelPoint[] } | null;

  // basemap
  basemapId: BasemapId;
  setBasemapId: (id: BasemapId) => void;

  // peta MapLibre aktif (dipakai ekspor PNG)
  mapInstance: MlMap | null;
  setMapInstance: (m: MlMap | null) => void;

  // Data Makro (choropleth KabKota)
  makroOn: boolean;
  setMakroOn: (v: boolean) => void;
  makroOpacity: number;
  setMakroOpacity: (v: number) => void;
  makroSel: MakroSel;
  /** katalog indikator yang BERDATA (tahun menurut ketersediaan di database) */
  makroCatalog: MakroCategory[];
  setMakroCategory: (catId: string) => void;
  setMakroIndicator: (indId: string) => void;
  setMakroYear: (year: number) => void;
  /** simbolisasi choropleth: palet, metode & jumlah kelas, warna/nama kelas kustom, garis batas */
  symb: Symbology;
  setSymb: (p: Partial<Symbology>) => void;

  // data
  kabkota: KabKotaGeo | null;
  /** batas provinsi (dilebur dari kab/kota) */
  provinsi: KabKotaGeo | null;
  makroData: MakroData | null;
  dataStatus: "loading" | "ready" | "error";
  /** mesin database (Google Spreadsheet) */
  engine: Engine | null;
  /** Kawasan Prioritas Provinsi RPJMN 2025–2029 (tab Layer) */
  kawasan: KawasanData | null;
  kawasanStatus: "loading" | "ready" | "error";
  /** Jalan Nasional — dimuat saat layer pertama kali dinyalakan */
  jalan: JalanFC | null;
  jalanStatus: "idle" | "loading" | "ready" | "error";
  jalanWidth: number;
  setJalanWidth: (v: number) => void;
  /** bila kab/kota terpilih: jalan di kab/kota itu saja, atau di seluruh provinsinya */
  jalanCakupan: JalanCakupan;
  setJalanCakupan: (v: JalanCakupan) => void;
}

const Ctx = createContext<DashboardCtx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("layer");
  const [selectedKode, setSelectedKode] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("abu");
  const [labels, setLabelsState] = useState<LabelSettings>(DEFAULT_LABELS);
  const setLabels = (p: Partial<LabelSettings>) => setLabelsState((s) => ({ ...s, ...p }));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<MlMap | null>(null);
  const [layerState, setLayerState] = useState<Record<string, LayerState>>(() =>
    Object.fromEntries(
      LAYERS.map((l) => [
        l.id,
        { visible: l.defaultVisible ?? false, opacity: l.defaultOpacity ?? 1 },
      ])
    )
  );

  // ── basemap ──
  // Default "Peta" (MapTiler) bila kunci tersedia; jika tidak, langsung
  // "Wilayah" offline agar peta tetap tampil tanpa jaringan.
  const [basemapId, setBasemapId] = useState<BasemapId>(DEFAULT_BASEMAP);

  // ── Data Makro ──
  const [makroOn, setMakroOn] = useState(true);
  const [makroOpacity, setMakroOpacity] = useState(0.82);
  const [symb, setSymbState] = useState<Symbology>(DEFAULT_SYMB);
  const setSymb = (p: Partial<Symbology>) => setSymbState((s) => ({ ...s, ...p }));

  // ── pengaturan tampilan diingat di browser ini (simbolisasi, label, mode fokus) ──
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // Sengaja dibaca SETELAH render pertama (bukan di useState) agar HTML server & browser
  // sama (tanpa hydration mismatch); sekali saja saat halaman dibuka.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<{ symb: Partial<Symbology>; labels: Partial<LabelSettings>; focusMode: FocusMode }>;
        if (p.symb) setSymbState((s) => ({ ...s, ...p.symb, border: { ...s.border, ...(p.symb?.border ?? {}) } }));
        if (p.labels) setLabelsState((s) => ({ ...s, ...p.labels }));
        if (p.focusMode === "abu" || p.focusMode === "sembunyi") setFocusMode(p.focusMode);
      }
    } catch {}
    setPrefsLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ symb, labels, focusMode }));
    } catch {}
  }, [prefsLoaded, symb, labels, focusMode]);
  const [rawSel, setMakroSel] = useState<MakroSel>({ catId: MAKRO_CATEGORIES[0].id, indId: MAKRO_CATEGORIES[0].indicators[0].id, year: null });

  // ── data: batas wilayah (TopoJSON statis, ±0,6 MB) + database (Google Spreadsheet) ──
  const [geo, setGeo] = useState<{ kabkota: KabKotaGeo; provinsi: KabKotaGeo } | null>(null);
  const [geoError, setGeoError] = useState(false);
  const { E: engine, error: dbError } = useProfil();
  const kabkota = geo?.kabkota ?? null;
  const provinsi = geo?.provinsi ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch("/data/wilayah.topo.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((t: Topology) => {
        if (cancelled) return;
        const fc = (name: string) => feature(t, t.objects[name] as GeometryCollection) as unknown as KabKotaGeo;
        setGeo({ kabkota: fc("kabkota"), provinsi: fc("provinsi") });
      })
      .catch(() => !cancelled && setGeoError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Kawasan Prioritas RPJMN: spreadsheet via server (cache ±5 menit), cadangan salinan lokal ──
  const [kpRaw, setKpRaw] = useState<KawasanRaw | null>(null);
  const [kpError, setKpError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const get = (url: string) => fetch(url).then((r) => (r.ok ? (r.json() as Promise<KawasanRaw>) : Promise.reject(new Error(String(r.status)))));
    get("/api/kawasan-prioritas")
      .catch(() => get("/data/kawasan-prioritas.json")) // hosting statis / server gagal
      .then((raw) => !cancelled && setKpRaw(raw))
      .catch(() => !cancelled && setKpError(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const kawasan = useMemo(() => {
    if (!kpRaw) return null;
    const d = parseKawasan(kpRaw);
    if (d.unmatched.length) console.warn("[kawasan-prioritas] kab/kota tidak dikenali:", d.unmatched);
    return d;
  }, [kpRaw]);
  const kawasanStatus: "loading" | "ready" | "error" = kawasan ? "ready" : kpError ? "error" : "loading";

  // ── Jalan Nasional: diunduh sekali saat layer pertama kali dinyalakan ──
  const [jalan, setJalan] = useState<JalanFC | null>(null);
  const [jalanStatus, setJalanStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [jalanWidth, setJalanWidth] = useState(JALAN_DEFAULT_WIDTH);
  const [jalanCakupan, setJalanCakupan] = useState<JalanCakupan>("kab");
  const jalanOn = !!layerState[JALAN_LAYER_ID]?.visible;
  // satu unduhan dipakai bersama oleh pra-muat & saat layer dinyalakan
  const jalanReq = useRef<Promise<JalanFC> | null>(null);
  const loadJalan = useCallback(
    () =>
      (jalanReq.current ??= fetch(JALAN_URL)
        .then((r) => (r.ok ? (r.json() as Promise<JalanFC>) : Promise.reject(new Error(String(r.status)))))
        .catch((e) => {
          jalanReq.current = null;
          throw e;
        })),
    []
  );
  useEffect(() => {
    if (!jalanOn || jalanStatus !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJalanStatus("loading");
    loadJalan()
      .then((fc) => {
        setJalan(fc);
        setJalanStatus("ready");
      })
      .catch(() => setJalanStatus("error"));
  }, [jalanOn, jalanStatus, loadJalan]);

  const labelGeo = useMemo(
    () =>
      geo
        ? { type: "FeatureCollection" as const, features: [...labelPoints(geo.provinsi.features, "prov"), ...labelPoints(geo.kabkota.features, "kab")] }
        : null,
    [geo]
  );

  const { makroData, makroCatalog } = useMemo(() => {
    if (!engine || !kabkota) return { makroData: null, makroCatalog: MAKRO_CATEGORIES };
    const codes = kabkota.features.map((f) => String(f.properties?.kode ?? "")).filter(Boolean);
    const { data, catalog } = buildMakro(engine, codes);
    return { makroData: data, makroCatalog: catalog.length ? catalog : MAKRO_CATEGORIES };
  }, [engine, kabkota]);

  const makroSel = useMemo(() => normalizeSel(rawSel, makroCatalog), [rawSel, makroCatalog]);
  const dataStatus: "loading" | "ready" | "error" = geoError || dbError ? "error" : makroData ? "ready" : "loading";

  // Pra-muat data Jalan Nasional (±1,7 MB) diam-diam beberapa detik setelah peta siap, supaya saat
  // layernya dinyalakan garis langsung tampil. Dilewati bila pengguna menyalakan mode hemat data.
  useEffect(() => {
    if (dataStatus !== "ready") return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const t = window.setTimeout(() => void loadJalan().catch(() => {}), 2500);
    return () => window.clearTimeout(t);
  }, [dataStatus, loadJalan]);

  const setMakroCategory = (catId: string) =>
    setMakroSel(() => {
      const cat = makroCatalog.find((c) => c.id === catId) ?? makroCatalog[0];
      const ind = cat.indicators[0];
      const ys = ind.years ?? [];
      return { catId: cat.id, indId: ind.id, year: ys.length ? ys[ys.length - 1] : null };
    });

  const setMakroIndicator = (indId: string) =>
    setMakroSel((s) => {
      const found = findIndicator(indId, makroCatalog);
      if (!found) return s;
      const ys = found.ind.years ?? [];
      const cur = normalizeSel(s, makroCatalog).year;
      return { catId: found.cat.id, indId, year: cur != null && ys.includes(cur) ? cur : ys.length ? ys[ys.length - 1] : null };
    });

  const setMakroYear = (year: number) => setMakroSel((s) => ({ ...normalizeSel(s, makroCatalog), year }));

  const toggleLayer = (id: string) =>
    setLayerState((s) => ({ ...s, [id]: { ...s[id], visible: !s[id].visible } }));

  const setOpacity = (id: string, v: number) =>
    setLayerState((s) => ({ ...s, [id]: { ...s[id], opacity: v } }));

  const setGroupVisible = (group: GroupId, v: boolean) =>
    setLayerState((s) => {
      const next = { ...s };
      LAYERS.filter((l) => l.group === group).forEach((l) => {
        next[l.id] = { ...next[l.id], visible: v };
      });
      return next;
    });

  const activeCount = useMemo(
    () => Object.values(layerState).filter((l) => l.visible).length,
    [layerState]
  );

  const value: DashboardCtx = {
    theme,
    toggleTheme,
    tab,
    setTab,
    sidebarOpen,
    setSidebarOpen,
    layerState,
    toggleLayer,
    setOpacity,
    setGroupVisible,
    activeCount,
    selectedKode,
    setSelectedKode,
    focusMode,
    setFocusMode,
    labels,
    setLabels,
    labelGeo,
    basemapId,
    setBasemapId,
    makroOn,
    setMakroOn,
    makroOpacity,
    setMakroOpacity,
    makroSel,
    makroCatalog,
    setMakroCategory,
    setMakroIndicator,
    setMakroYear,
    symb,
    setSymb,
    kabkota,
    provinsi,
    makroData,
    dataStatus,
    engine,
    kawasan,
    kawasanStatus,
    jalan,
    jalanStatus,
    jalanWidth,
    setJalanWidth,
    jalanCakupan,
    setJalanCakupan,
    mapInstance,
    setMapInstance,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDashboard harus dipakai di dalam DashboardProvider");
  return c;
}
