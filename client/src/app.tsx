import { Routes, Route } from "react-router-dom";
import { AdminProvider } from "@/contexts/AdminContext";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import VehicleSearchPage from "@/pages/VehicleSearchPage/VehicleSearchPage";
import ApplicationPage from "@/pages/ApplicationPage/ApplicationPage";
import AdminPage from "@/pages/AdminPage/AdminPage";
import ApprovalHistoryPage from "@/pages/ApprovalHistoryPage/ApprovalHistoryPage";

export default function App() {
  return (
    <AdminProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<VehicleSearchPage />} />
          <Route path="apply" element={<ApplicationPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="approval-history" element={<ApprovalHistoryPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AdminProvider>
  );
}