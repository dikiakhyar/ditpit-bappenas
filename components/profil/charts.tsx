"use client";

// Grafik SVG ringan untuk Profil Daerah — tanpa pustaka chart (bundle kecil,
// berjalan offline). Semua warna dibaca dari token CSS (--s1 wilayah,
// --s2 provinsi, --natl nasional) sehingga ikut tema terang/gelap.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fmt, fmtAxis, isN, lastIdx, nf, niceTicks, textW, trunc, type Fmt, type Cell } from "@/lib/profil/format";

// ─────────────────────────────── tooltip ───────────────────────────────
type Pt = { clientX: number; clientY: number };
interface TipApi {
  show: (content: ReactNode, e: Pt) => void;
  hide: () => void;
}
const TipCtx = createContext<TipApi>({ show: () => {}, hide: () => {} });
export const useTip = () => useContext(TipCtx);

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ c: ReactNode; x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const show = useCallback((c: ReactNode, e: Pt) => setTip({ c, x: e.clientX, y: e.clientY }), []);
  const hide = useCallback(() => setTip(null), []);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const pad = 14;
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    let x = tip.x + pad, y = tip.y + pad;
    if (x + w > window.innerWidth - 8) x = tip.x - w - pad;
    if (y + h > window.innerHeight - 8) y = tip.y - h - pad;
    setPos({ left: Math.max(8, x), top: Math.max(8, y) });
  }, [tip]);

  useEffect(() => {
    const h = () => setTip(null);
    window.addEventListener("scroll", h, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", h, { capture: true });
  }, []);

  return (
    <TipCtx.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div
          ref={ref}
          role="tooltip"
          className="pointer-events-none fixed z-50 min-w-[130px] max-w-[290px] rounded-md border border-border bg-surface px-2.5 py-2 text-[12px] text-foreground shadow-lg"
          style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
        >
          {tip.c}
        </div>
      )}
    </TipCtx.Provider>
  );
}

export function TipRow({ color, label, value, muted }: { color?: string; label: ReactNode; value: ReactNode; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${muted ? "text-muted" : ""}`}>
      <span className="flex items-center">
        {color && <i className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: color }} />}
        {label}
      </span>
      <b className="tnum">{value}</b>
    </div>
  );
}
export const TipHead = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 font-mono text-[11px] font-semibold text-muted">{children}</div>
);

// ─────────────────────────────── ukuran ───────────────────────────────
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.clientWidth));
    const ro = new ResizeObserver(([e]) => {
      const nw = Math.round(e.contentRect.width);
      setW((p) => (Math.abs(p - nw) >= 2 ? nw : p));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

// ─────────────────────────────── legend ───────────────────────────────
export interface LegendItem {
  name: string;
  color: string;
  kind?: "line" | "dash" | "sq" | "tick";
}
export function Legend({ items, lead }: { items: LegendItem[]; lead?: ReactNode }) {
  return (
    <div className="legend">
      {lead}
      {items.map((it) => (
        <span key={it.name}>
          <i className={it.kind === "line" || !it.kind ? "" : it.kind} style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────── line ───────────────────────────────
export interface LineSeries {
  name: string;
  vals: Cell[];
  color: string;
  main?: boolean;
  dash?: boolean;
}
export function LineChart({ labels, series, f, zero, aria, h = 190 }: { labels: string[]; series: LineSeries[]; f: Fmt; zero?: boolean; aria: string; h?: number }) {
  const [ref, W0] = useWidth<HTMLDivElement>();
  const { show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(240, W0 || 320), H = h, n = labels.length;
  const all = series.flatMap((s) => s.vals.filter(isN));

  if (!all.length) return <p className="py-2 text-[13px] text-muted">Tidak ada data.</p>;

  let lo = Math.min(...all), hi = Math.max(...all);
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  const tk = niceTicks(lo, hi, 4);
  lo = tk[0];
  hi = tk[tk.length - 1];
  const step = tk[1] - tk[0];
  const ff: Fmt = { ...f, _top: Math.max(Math.abs(lo), Math.abs(hi)) * (f.k ?? 1) };
  const yl = tk.map((v) => fmtAxis(v, ff, step));
  const ml = Math.max(28, Math.max(...yl.map((s) => textW(s, 11))) + 10);
  const m = { l: ml, r: 16, t: 12, b: 24 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = (i: number) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => m.t + ((hi - v) / (hi - lo || 1)) * ih;

  const maxLab = Math.max(2, Math.floor(iw / Math.max(46, textW(labels[n - 1] || "", 11) + 14)));
  const every = Math.ceil(n / maxLab);
  const shown: number[] = [];
  for (let i = 0; i < n; i += every) shown.push(i);
  if (shown[shown.length - 1] !== n - 1) {
    if (shown.length > 1) shown.pop();
    shown.push(n - 1);
  }
  const dots = n <= 16;

  const at = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = (e.clientX - r.left) * (W / r.width);
    return Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : (px - m.l) / (iw / (n - 1)))));
  };

  return (
    <div ref={ref} className="viz">
      {W0 > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={aria}>
          <g className="ax">
            {tk.map((v, k) => (
              <g key={k}>
                <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className={v === 0 && lo < 0 ? "base" : undefined} />
                <text x={m.l - 8} y={y(v) + 3.5} textAnchor="end">{yl[k]}</text>
              </g>
            ))}
            {shown.map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                {labels[i]}
              </text>
            ))}
            <line className="base" x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} />
          </g>
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="var(--axis)" strokeWidth={1} />}
          {series
            .slice()
            .reverse()
            .map((se) => {
              let d = "", started = false;
              se.vals.forEach((v, i) => {
                if (!isN(v)) return;
                d += (started ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
                started = true;
              });
              const li = lastIdx(se.vals, isN);
              return (
                <g key={se.name}>
                  <path d={d} fill="none" style={{ stroke: se.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={se.dash ? "4 4" : undefined} />
                  {se.vals.map((v, i) => {
                    if (!isN(v)) return null;
                    const end = i === li;
                    if (!dots && !end && hover !== i) return null;
                    return <circle key={i} cx={x(i)} cy={y(v)} r={end && se.main ? 4.5 : hover === i ? 4.5 : 3.5} style={{ fill: se.color, stroke: "var(--surface)" }} strokeWidth={2} />;
                  })}
                </g>
              );
            })}
          <rect
            x={m.l - 6}
            y={0}
            width={iw + 12}
            height={H}
            fill="transparent"
            onPointerMove={(e) => {
              const i = at(e);
              setHover(i);
              show(
                <>
                  <TipHead>{labels[i]}</TipHead>
                  {series.map((se) => (
                    <TipRow key={se.name} color={se.color} label={se.name} value={fmt(se.vals[i], f)} />
                  ))}
                </>,
                e
              );
            }}
            onPointerLeave={() => {
              setHover(null);
              hide();
            }}
          />
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────── peringkat ───────────────────────────────
export interface RankRow {
  c: string;
  name: string;
  v: number;
  sel: boolean;
}
export function RankChart({ rows, refLine, f, aria }: { rows: RankRow[]; refLine?: { name: string; v: number } | null; f: Fmt; aria: string }) {
  const [ref, W0] = useWidth<HTMLDivElement>();
  const { show, hide } = useTip();
  const W = Math.max(240, W0 || 320), rh = 17, gap = 4, px = 11.5;
  const hasRef = !!refLine && isN(refLine.v);
  const vals = rows.map((r) => r.v).concat(hasRef ? [refLine!.v] : []);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const labW = Math.min(Math.max(90, W * 0.36), 170);
  const valW = Math.max(...rows.map((r) => textW(fmt(r.v, f), 11))) + 10;
  const neg = lo < 0;
  const x0l = labW + (neg ? valW : 0), x1r = W - valW;
  const x = (v: number) => x0l + ((v - lo) / (hi - lo || 1)) * (x1r - x0l);
  const top = hasRef ? 18 : 4;
  const H = top + rows.length * (rh + gap) + 2;

  return (
    <div ref={ref} className="viz">
      {W0 > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={aria}>
          <line x1={x(0)} x2={x(0)} y1={top - 2} y2={H} style={{ stroke: "var(--axis)" }} />
          {rows.map((r, k) => {
            const yy = top + k * (rh + gap);
            const a = Math.min(x(0), x(r.v)), w = Math.max(1.5, Math.abs(x(r.v) - x(0)));
            const vx = r.v >= 0 ? x(r.v) + 5 : x(r.v) - 5;
            return (
              <g
                key={r.c}
                onPointerMove={(e) =>
                  show(
                    <>
                      <TipRow label={r.name} value={fmt(r.v, f)} />
                      {hasRef && <TipRow muted label={refLine!.name} value={fmt(refLine!.v, f)} />}
                    </>,
                    e
                  )
                }
                onPointerLeave={hide}
              >
                <rect className="row-hit" x={0} y={yy - 2} width={W} height={rh + gap} rx={4} />
                <text x={labW - 8} y={yy + rh / 2 + 4} textAnchor="end" className={r.sel ? "lbl-sel" : "lbl-ink2"}>
                  {trunc(r.name, labW - 12, px)}
                </text>
                <rect x={a} y={yy + 2} width={w} height={rh - 4} rx={3} style={{ fill: r.sel ? "var(--s1)" : "var(--bar-muted)" }} pointerEvents="none" />
                <text x={vx} y={yy + rh / 2 + 4} textAnchor={r.v >= 0 ? "start" : "end"} className={r.sel ? "val-sel" : "val-t"} pointerEvents="none">
                  {fmt(r.v, f)}
                </text>
              </g>
            );
          })}
          {hasRef && (
            <g pointerEvents="none">
              <line x1={x(refLine!.v)} x2={x(refLine!.v)} y1={top - 4} y2={H} style={{ stroke: "var(--s2)" }} strokeWidth={1.5} strokeDasharray="3 3" />
              <text x={Math.min(Math.max(x(refLine!.v), labW + 40), W - 40)} y={11} textAnchor="middle" className="val-t" style={{ fill: "var(--s2)", fontWeight: 600 }}>
                {refLine!.name} {fmt(refLine!.v, f)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────── batang berlabel ───────────────────────────
export interface BarRow {
  label: string;
  v: number | null;
  cmp?: number | null;
}
export function BarsChart({ rows, f, per, selName, cmpName, aria }: { rows: BarRow[]; f: Fmt; per?: string; selName: string; cmpName?: string; aria: string }) {
  const [ref, W0] = useWidth<HTMLDivElement>();
  const { show, hide } = useTip();
  const W = Math.max(240, W0 || 320), bh = 12, lh = 17, gap = 10, px = 12;
  const vals = rows.flatMap((r) => [r.v, r.cmp]).filter(isN);
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
  const valW = Math.max(...rows.map((r) => textW(fmt(r.v, f), 11))) + 10;
  const x0 = lo < 0 ? valW : 0, x1 = W - valW;
  const x = (v: number) => x0 + ((v - lo) / (hi - lo || 1)) * (x1 - x0);
  const H = rows.length * (lh + bh + gap);

  return (
    <div ref={ref} className="viz">
      {W0 > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={aria}>
          {rows.map((r, k) => {
            const yy = k * (lh + bh + gap);
            const hasV = isN(r.v), hasC = isN(r.cmp);
            const v = hasV ? (r.v as number) : 0;
            const a = Math.min(x(0), x(v)), w = Math.max(hasV ? 1.5 : 0, Math.abs(x(v) - x(0)));
            const tx = hasV && v < 0 ? x(v) - 5 : Math.max(x(v), hasC ? x(r.cmp as number) + 2 : 0) + 5;
            return (
              <g
                key={r.label + k}
                onPointerMove={(e) =>
                  show(
                    <>
                      {per && <TipHead>{per}</TipHead>}
                      <TipRow color="var(--s1)" label={selName} value={fmt(r.v, f)} />
                      {hasC && <TipRow color="var(--s2)" label={cmpName} value={fmt(r.cmp, f)} />}
                      <div className="mt-1 text-ink-2">{r.label}</div>
                    </>,
                    e
                  )
                }
                onPointerLeave={hide}
              >
                <rect className="row-hit" x={0} y={yy - 2} width={W} height={lh + bh + gap - 2} rx={4} />
                <text x={x0} y={yy + 11} className="lbl-ink" pointerEvents="none">{trunc(r.label, W - valW - 8, px)}</text>
                <rect x={x0} y={yy + lh} width={x1 - x0} height={bh} rx={3} style={{ fill: "var(--surface-3)" }} pointerEvents="none" />
                {hasV && <rect x={a} y={yy + lh} width={w} height={bh} rx={3} style={{ fill: "var(--s1)" }} pointerEvents="none" />}
                {hasC && (
                  <rect x={x(r.cmp as number) - 1.5} y={yy + lh - 3} width={3} height={bh + 6} rx={1.5} style={{ fill: "var(--s2)", stroke: "var(--surface)" }} strokeWidth={1} pointerEvents="none" />
                )}
                <text x={tx} y={yy + lh + bh - 1.5} textAnchor={hasV && v < 0 ? "end" : "start"} className="val-sel" pointerEvents="none">
                  {fmt(r.v, f)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────── sparkline ───────────────────────────────
export function Sparkline({ vals }: { vals: Cell[] }) {
  const W = 92, H = 24;
  const pts = vals.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => isN(p[1]));
  if (pts.length < 2) return null;
  const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
  const n = vals.length;
  const x = (i: number) => 2 + (i * (W - 6)) / (n - 1);
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 7);
  const d = pts.map((p, k) => (k ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join("");
  const l = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={d} fill="none" style={{ stroke: "var(--s1)" }} strokeWidth={1.75} strokeLinejoin="round" />
      <circle cx={x(l[0])} cy={y(l[1])} r={2.8} style={{ fill: "var(--s1)" }} />
    </svg>
  );
}

// ─────────────────────────── batang bertumpuk (100%) ───────────────────────────
export interface StackCat {
  name: string;
  color: string;
  fg: string;
}
export interface StackRow {
  label: string;
  sub?: string;
  parts: (number | null)[];
}
export function StackBars({ rows, cats, counts }: { rows: StackRow[]; cats: StackCat[]; counts?: string }) {
  const { show, hide } = useTip();
  return (
    <div className="flex flex-col gap-3">
      <Legend items={cats.map((c) => ({ name: c.name, color: c.color, kind: "sq" }))} />
      {rows.map((r) => {
        const t = r.parts.reduce<number>((a, b) => a + (isN(b) ? b : 0), 0);
        return (
          <div key={r.label}>
            <div className="mb-1 flex justify-between gap-2 text-[12.5px]">
              <b className="font-semibold">{r.label}</b>
              <span className="tnum text-ink-2">{r.sub}</span>
            </div>
            <div className="stackbar" role="img" aria-label={`${r.label}: ${cats.map((c, i) => `${c.name} ${nf(t ? ((r.parts[i] ?? 0) / t) * 100 : 0, 1)}%`).join(", ")}`}>
              {r.parts.map((v, i) => {
                if (!isN(v) || v <= 0 || !t) return null;
                const p = (v / t) * 100;
                const c = cats[i];
                return (
                  <span
                    key={i}
                    style={{ flex: `${p} 1 0`, background: c.color, color: c.fg }}
                    onPointerMove={(e) => show(<TipRow color={c.color} label={c.name} value={`${nf(p, 1)}%${counts ? ` · ${nf(v, 0)} ${counts}` : ""}`} />, e)}
                    onPointerLeave={hide}
                  >
                    {p >= 9 ? nf(p, 0) + "%" : ""}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
