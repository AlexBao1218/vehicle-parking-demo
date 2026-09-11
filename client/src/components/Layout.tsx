import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import DemoBanner from "@/components/DemoBanner";

export function Layout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DemoBanner />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
