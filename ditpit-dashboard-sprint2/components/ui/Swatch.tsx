import type { LayerDef } from "@/lib/layers";

// Swatch SVG kecil yang menggambarkan layer sesuai geometrinya:
// area = kotak terisi (atau outline / arsir), line = garis (solid/dash/dot),
// point = simbol. Dipakai di panel layer & legenda peta agar konsisten.
export function Swatch({ layer, size = 16 }: { layer: LayerDef; size?: number }) {
  const c = layer.color;
  const s = size;
  const mid = s / 2;

  if (layer.geometry === "area") {
    if (layer.outline) {
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <rect x={1.5} y={1.5} width={s - 3} height={s - 3} rx={2} fill="none" stroke={c} strokeWidth={2} />
        </svg>
      );
    }
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
        {layer.hatch && (
          <defs>
            <pattern id={`h-${layer.id}`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={4} height={4} fill={c} opacity={0.35} />
              <line x1={0} y1={0} x2={0} y2={4} stroke={c} strokeWidth={1.6} />
            </pattern>
          </defs>
        )}
        <rect x={1} y={1} width={s - 2} height={s - 2} rx={2} fill={layer.hatch ? `url(#h-${layer.id})` : c} stroke={c} strokeWidth={layer.hatch ? 1.2 : 0} />
      </svg>
    );
  }

  if (layer.geometry === "line") {
    const dash = layer.dash === "dashed" ? "5 3" : layer.dash === "dotted" ? "1.5 3" : undefined;
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
        <line x1={1} y1={mid} x2={s - 1} y2={mid} stroke={c} strokeWidth={Math.min(layer.weight ?? 2, 3.5)} strokeDasharray={dash} strokeLinecap="round" />
      </svg>
    );
  }

  // point
  const r = Math.min((layer.size ?? 10) / 2, mid - 1.5);
  const sym = layer.symbol ?? "circle";
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      {sym === "circle" && <circle cx={mid} cy={mid} r={r} fill={c} stroke="#fff" strokeWidth={1.2} />}
      {sym === "square" && <rect x={mid - r} y={mid - r} width={r * 2} height={r * 2} rx={1} fill={c} stroke="#fff" strokeWidth={1.2} />}
      {sym === "diamond" && <path d={`M${mid} ${mid - r}L${mid + r} ${mid}L${mid} ${mid + r}L${mid - r} ${mid}Z`} fill={c} stroke="#fff" strokeWidth={1.2} />}
      {sym === "triangle" && <path d={`M${mid} ${mid - r}L${mid + r} ${mid + r}L${mid - r} ${mid + r}Z`} fill={c} stroke="#fff" strokeWidth={1.2} />}
      {sym === "cross" && (
        <g stroke={c} strokeWidth={r * 0.9} strokeLinecap="round">
          <line x1={mid - r} y1={mid} x2={mid + r} y2={mid} />
          <line x1={mid} y1={mid - r} x2={mid} y2={mid + r} />
        </g>
      )}
    </svg>
  );
}
