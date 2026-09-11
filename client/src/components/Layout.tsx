import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import DemoBanner from "@/components/DemoBanner";
import { useAdmin } from "@/contexts/AdminContext";
import { AlertTriangle } from "lucide-react";

export function Layout() {
  const { syncMode, testVehicleLicenses } = useAdmin();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DemoBanner />
      <Header />
      <main className="flex-1">
        {syncMode === 'test' && (
          <div className="bg-amber-50 border-b border-amber-200">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-700">
                Test mode — only requests for test vehicles ({testVehicleLicenses.join(', ')}) can be approved. All others will be rejected.
              </span>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
