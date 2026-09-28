import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salinan lokal database ikut dibundel ke fungsi server /api/database
  // (dipakai bila Google Spreadsheet tak terjangkau).
  outputFileTracingIncludes: {
    "/api/database": ["./public/data/profil.json"],
  },
};

export default nextConfig;
