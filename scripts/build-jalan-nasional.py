"""Bangun public/data/jalan-nasional.geojson dari data-sumber/JalanNasionalPIT.gpkg.

Jalankan ulang bila GPKG diperbarui:
    pip install geopandas pyogrio shapely
    node -e "const {feature}=require('topojson-client');const t=require('./public/data/wilayah.topo.json');require('fs').writeFileSync('kab.tmp.geojson',JSON.stringify(feature(t,t.objects.kabkota)))"
    python scripts/build-jalan-nasional.py kab.tmp.geojson

Langkah:
1. Tiap ruas dipotong menurut batas kab/kota PETA (wilayah.topo.json), agar tampilan & statistik
   per kab/kota cocok dengan poligon yang terlihat.
2. Potongan kecil di luar poligon (garis pantai yang disederhanakan) dimasukkan ke kab/kota terdekat.
3. km per potongan = panjang RESMI ruas (kolom `panjang`) x porsi panjang geometrinya,
   sehingga jumlah per wilayah = jumlah panjang resmi.
4. Geometri disederhanakan (~15 m) & koordinat dibulatkan 5 desimal untuk web.
"""

import json
import sys

import geopandas as gpd
from shapely import force_2d
from shapely.ops import linemerge, unary_union

GPKG = "data-sumber/JalanNasionalPIT.gpkg"
OUT = "public/data/jalan-nasional.geojson"
# proyeksi sama-luas berpusat di wilayah timur — panjang dalam meter cukup akurat
CEA = "+proj=cea +lon_0=128 +lat_ts=-3 +datum=WGS84 +units=m"


def main(kab_path: str) -> None:
    kab = gpd.read_file(kab_path)[["kode", "geometry"]].set_crs(4326, allow_override=True)
    j = gpd.read_file(GPKG)
    j["geometry"] = force_2d(j.geometry)
    j = j.to_crs(4326)

    pieces = gpd.overlay(j[["kd_ruas", "geometry"]], kab, how="intersection", keep_geom_type=True)
    rows = [dict(kd=r.kd_ruas, kode=r.kode, geom=r.geometry) for r in pieces.itertuples()]

    kab_union = unary_union(kab.geometry.values)
    kab_m = kab.to_crs(CEA)
    for r in j.itertuples():
        left = r.geometry.difference(kab_union)
        for part in getattr(left, "geoms", [left]):
            if part.is_empty or part.length == 0:
                continue
            pm = gpd.GeoSeries([part], crs=4326).to_crs(CEA).iloc[0]
            rows.append(dict(kd=r.kd_ruas, kode=kab.kode.iloc[int(kab_m.distance(pm).values.argmin())], geom=part))

    g = gpd.GeoDataFrame(rows, geometry="geom", crs=4326).dissolve(by=["kd", "kode"], as_index=False)
    g["lm"] = g.to_crs(CEA).length
    total = g.groupby("kd")["lm"].transform("sum")
    g = g.join(j.set_index("kd_ruas")[["nm_ruas", "fungsi", "panjang"]], on="kd")
    g["km"] = g["panjang"] * g["lm"] / total
    g["geom"] = g.geometry.simplify(0.00015, preserve_topology=True)

    feats = []
    for r in g.itertuples():
        geom = linemerge(r.geom) if r.geom.geom_type == "MultiLineString" else r.geom
        lines = [[[round(x, 5), round(y, 5)] for x, y in ls.coords] for ls in getattr(geom, "geoms", [geom]) if ls.geom_type == "LineString"]
        lines = [ln for ln in lines if len(ln) >= 2]
        if not lines:
            continue
        geo = {"type": "LineString", "coordinates": lines[0]} if len(lines) == 1 else {"type": "MultiLineString", "coordinates": lines}
        feats.append({
            "type": "Feature",
            "properties": {"r": str(r.kd), "n": " ".join(str(r.nm_ruas).split()), "f": r.fungsi, "pj": round(float(r.panjang), 3), "k": r.kode, "km": round(float(r.km), 3)},
            "geometry": geo,
        })

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{len(feats)} fitur, {sum(x['properties']['km'] for x in feats):.1f} km -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "kab.tmp.geojson")
