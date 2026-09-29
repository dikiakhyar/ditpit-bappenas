"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LAYERS, type GroupId } from "@/lib/layers";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Map as MlMap } from "maplibre-gl";
import { MAKRO_CATEGORIES, buildMakro, findIndicator, type MakroCategory, type MakroData, type PaletteChoice } from "@/lib/makro";
import { DEFAULT_BASEMAP, type BasemapId } from "@/lib/basemap";
import { useProfil } from "@/lib/profil/useProfil";
import type { Engine } from "@/lib/profil/engine";
import { useTheme, type Theme } from "@/lib/theme";

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
  setSubgroupVisible: (group: GroupId, subgroup: string | undefined, v: boolean) => void;
  activeCount: number;

  // wilayah terpilih (klik peta / ?kode= di URL) → panel Ringkasan & Profil
  selectedKode: string | null;
  setSelectedKode: (k: string | null) => void;
  focusMode: FocusMode;
  setFocusMode: (m: FocusMode) => void;

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
  /** palet warna pilihan pengguna ("auto" = sesuai konteks indikator) */
  makroPalette: PaletteChoice;
  setMakroPalette: (p: PaletteChoice) => void;
  /** balik urutan warna (terang ↔ pekat) */
  makroReverse: boolean;
  setMakroReverse: (v: boolean) => void;

  // data
  kabkota: KabKotaGeo | null;
  /** batas provinsi (dilebur dari kab/kota) */
  provinsi: KabKotaGeo | null;
  makroData: MakroData | null;
  dataStatus: "loading" | "ready" | "error";
  /** mesin database (Google Spreadsheet) */
  engine: Engine | null;
}

const Ctx = createContext<DashboardCtx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("layer");
  const [selectedKode, setSelectedKode] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("abu");
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
  const [makroPalette, setMakroPalette] = useState<PaletteChoice>("auto");
  const [makroReverse, setMakroReverse] = useState(false);
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

  const { makroData, makroCatalog } = useMemo(() => {
    if (!engine || !kabkota) return { makroData: null, makroCatalog: MAKRO_CATEGORIES };
    const codes = kabkota.features.map((f) => String(f.properties?.kode ?? "")).filter(Boolean);
    const { data, catalog } = buildMakro(engine, codes);
    return { makroData: data, makroCatalog: catalog.length ? catalog : MAKRO_CATEGORIES };
  }, [engine, kabkota]);

  const makroSel = useMemo(() => normalizeSel(rawSel, makroCatalog), [rawSel, makroCatalog]);
  const dataStatus: "loading" | "ready" | "error" = geoError || dbError ? "error" : makroData ? "ready" : "loading";

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

  const setSubgroupVisible = (
    group: GroupId,
    subgroup: string | undefined,
    v: boolean
  ) =>
    setLayerState((s) => {
      const next = { ...s };
      LAYERS.filter((l) => l.group === group && l.subgroup === subgroup).forEach((l) => {
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
    setSubgroupVisible,
    activeCount,
    selectedKode,
    setSelectedKode,
    focusMode,
    setFocusMode,
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
    makroPalette,
    setMakroPalette,
    makroReverse,
    setMakroReverse,
    kabkota,
    provinsi,
    makroData,
    dataStatus,
    engine,
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
