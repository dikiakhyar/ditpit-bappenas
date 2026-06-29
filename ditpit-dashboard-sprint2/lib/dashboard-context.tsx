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

type Theme = "light" | "dark";
export type Tab = "layer" | "statistik" | "ekspor";
interface LayerState {
  visible: boolean;
  opacity: number;
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
}

const Ctx = createContext<DashboardCtx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [tab, setTab] = useState<Tab>("layer");
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

  // tema awal mengikuti preferensi sistem
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(mq.matches ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDashboard harus dipakai di dalam DashboardProvider");
  return c;
}
