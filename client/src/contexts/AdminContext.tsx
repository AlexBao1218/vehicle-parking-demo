import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ApiResponse, AdminCheckResponse } from '@shared/api.interface';

interface AdminContextValue {
  isAdmin: boolean;
  loading: boolean;
  viewAsUser: boolean;
  toggleViewAsUser: () => void;
  syncMode: 'test' | 'production';
  testVehicleLicenses: string[];
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  loading: true,
  viewAsUser: false,
  toggleViewAsUser: () => {},
  syncMode: 'test',
  testVehicleLicenses: [],
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewAsUser, setViewAsUser] = useState(false);
  const [syncMode, setSyncMode] = useState<'test' | 'production'>('test');
  const [testVehicleLicenses, setTestVehicleLicenses] = useState<string[]>([]);

  const toggleViewAsUser = useCallback(() => {
    setViewAsUser((prev) => !prev);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosForBackend.get<ApiResponse<AdminCheckResponse>>('/api/auth/admin-check');
        if (!cancelled) {
          setIsAdmin(res.data.data?.isAdmin ?? false);
          setSyncMode(res.data.data?.syncMode ?? 'test');
          setTestVehicleLicenses(res.data.data?.testVehicleLicenses ?? []);
        }
      } catch (err) {
        logger.error('Admin check failed:', String(err));
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, loading, viewAsUser, toggleViewAsUser, syncMode, testVehicleLicenses }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  return useContext(AdminContext);
}