"use client";

import { DashboardProvider } from "@/lib/dashboard-context";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import MapContainer from "./MapContainer";

function Layout() {
  return (
    <div
      className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground"
      style={{ height: "100vh" }}
    >
      <TopBar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <MapContainer />
      </div>
    </div>
  );
}

export default function DashboardShell() {
  return (
    <DashboardProvider>
      <Layout />
    </DashboardProvider>
  );
}
