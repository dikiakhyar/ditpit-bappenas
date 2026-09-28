"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LAYERS, PROVINCES, type GroupId, type Province } from "@/lib/layers";
import { MAKRO_CATEGORIES, findIndicator, type MakroData } from "@/lib/makro";
import { hasMaptiler, type BasemapId } from "@/lib/basemap";
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

export interface MakroSel {
  catId: string;
  indId: string;
  year: number | null;
}

function defaultSel(): MakroSel {
  const cat = MAKRO_CATEGORIES[0];
  const ind = cat.indicators[0];
  return { catId: cat.id, indId: ind.id, year: ind.years ? ind.years[ind.years.length - 1] : null };
}

interface DashboardCtx {
  theme: Theme;
  toggleTheme: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  province: Province;
  setProvince: (p: Province) => void;
  exportTitle: string;
  setExportTitle: (s: string) => void;
  layerState: Record<string, LayerState>;
  toggleLayer: (id: string) => void;
  setOpacity: (id: string, v: number) => void;
  setGroupVisible: (group: GroupId, v: boolean) => void;
  setSubgroupVisible: (group: GroupId, subgroup: string | undefined, v: boolean) => void;
  activeCount: number;

  // wilayah terpilih (klik peta / ?kode= di URL) → panel Ringkasan & Profil
  selectedKode: string | null;
  setSelectedKode: (k: string | null) => void;

  // basemap
  basemapId: BasemapId;
  setBasemapId: (id: BasemapId) => void;

  // Data Makro (choropleth KabKota)
  makroOn: boolean;
  setMakroOn: (v: boolean) => void;
  makroOpacity: number;
  setMakroOpacity: (v: number) => void;
  makroSel: MakroSel;
  setMakroCategory: (catId: string) => void;
  setMakroIndicator: (indId: string) => void;
  setMakroYear: (year: number) => void;

  // data
  kabkota: KabKotaGeo | null;
  makroData: MakroData | null;
  dataStatus: "loading" | "ready" | "error";
}

const Ctx = createContext<DashboardCtx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("layer");
  const [selectedKode, setSelectedKode] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [province, setProvince] = useState<Province>(PROVINCES[0]);
  const [exportTitle, setExportTitle] = useState("");
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
  const [basemapId, setBasemapId] = useState<BasemapId>(
    hasMaptiler ? "voyager" : "wilayah"
  );

  // ── Data Makro ──
  const [makroOn, setMakroOn] = useState(true);
  const [makroOpacity, setMakroOpacity] = useState(0.82);
  const [makroSel, setMakroSel] = useState<MakroSel>(defaultSel);

  const setMakroCategory = (catId: string) =>
    setMakroSel(() => {
      const cat = MAKRO_CATEGORIES.find((c) => c.id === catId) ?? MAKRO_CATEGORIES[0];
      const ind = cat.indicators[0];
      return { catId: cat.id, indId: ind.id, year: ind.years ? ind.years[ind.years.length - 1] : null };
    });

  const setMakroIndicator = (indId: string) =>
    setMakroSel((s) => {
      const found = findIndicator(indId);
      if (!found) return s;
      const { ind } = found;
      const year = ind.years
        ? ind.years.includes(s.year ?? -1)
          ? s.year
          : ind.years[ind.years.length - 1]
        : null;
      return { ...s, indId, year };
    });

  const setMakroYear = (year: number) => setMakroSel((s) => ({ ...s, year }));

  // ── pemuatan data (GeoJSON KabKota + indikator makro) ──
  const [kabkota, setKabkota] = useState<KabKotaGeo | null>(null);
  const [makroData, setMakroData] = useState<MakroData | null>(null);
  const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [g, m] = await Promise.all([
          fetch("/data/kabkota.geojson").then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch("/data/makro.json").then((r) => (r.ok ? r.json() : Promise.reject())),
        ]);
        if (cancelled) return;
        setKabkota(g);
        setMakroData(m);
        setDataStatus("ready");
      } catch {
        if (!cancelled) setDataStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    province,
    setProvince,
    exportTitle,
    setExportTitle,
    layerState,
    toggleLayer,
    setOpacity,
    setGroupVisible,
    setSubgroupVisible,
    activeCount,
    selectedKode,
    setSelectedKode,
    basemapId,
    setBasemapId,
    makroOn,
    setMakroOn,
    makroOpacity,
    setMakroOpacity,
    makroSel,
    setMakroCategory,
    setMakroIndicator,
    setMakroYear,
    kabkota,
    makroData,
    dataStatus,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDashboard harus dipakai di dalam DashboardProvider");
  return c;
}
