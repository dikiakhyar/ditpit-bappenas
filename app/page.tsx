import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function Home() {
  return (
    <Suspense>
      <DashboardShell />
    </Suspense>
  );
}
