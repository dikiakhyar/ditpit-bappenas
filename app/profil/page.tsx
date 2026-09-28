import { Suspense } from "react";
import type { Metadata } from "next";
import ProfilView from "@/components/profil/ProfilView";

export const metadata: Metadata = {
  title: "Profil Daerah — DITPIT Bappenas",
  description: "Profil indikator pembangunan provinsi dan kabupaten/kota kawasan timur Indonesia.",
};

export default function ProfilPage() {
  return (
    <Suspense>
      <ProfilView />
    </Suspense>
  );
}
