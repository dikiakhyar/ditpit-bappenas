// Isi legenda choropleth Data Makro — dipakai bersama oleh legenda di layar
// dan legenda pada PNG ekspor, supaya keduanya selalu sama.

import type { Baked } from "@/lib/choropleth";
import { NODATA_SOLID, formatValue, legendClasses } from "@/lib/makro";
import type { LegendClass } from "@/lib/export-map";

export interface MakroLegend {
  title: string;
  sub: string;
  classes: LegendClass[];
}

export function makroLegend(b: Baked, year: number | null, totalFeatures: number): MakroLegend {
  const { ind, numeric, scale, min, max, count } = b;
  const title = `${ind.label}${year ? ` · ${year}` : ""}`;
  const parts: string[] = [];
  if (ind.unit) parts.push(ind.unit);
  if (numeric) parts.push(`kelas kuantil · ${count} kab/kota`);
  const classes: LegendClass[] = numeric
    ? legendClasses(scale, min, max).map((k) => ({
        color: k.color,
        label: k.from === k.to ? formatValue(k.from, ind.format) : `${formatValue(k.from, ind.format)} – ${formatValue(k.to, ind.format)}`,
      }))
    : (ind.classes ?? []).filter((c) => b.present?.has(c.value) ?? true).map((c) => ({ color: c.color, label: c.value }));
  if (count < totalFeatures) classes.push({ color: NODATA_SOLID, label: "Tidak ada data" });
  return { title, sub: parts.join(" · "), classes };
}
