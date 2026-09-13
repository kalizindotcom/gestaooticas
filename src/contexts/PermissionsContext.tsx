import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { GlobalPermissions, ModulePermissions } from '../types/permissions';
import { useAuth } from './AuthContext';
import { localApi } from '@/lib/localApi';

interface PermissionsContextType {
  permissions: GlobalPermissions;
  hasPermission: (module: keyof GlobalPermissions, action: keyof ModulePermissions) => boolean;
  role: string;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const EMPTY_PERMISSIONS: GlobalPermissions = {
  dashboard: {}, appointments: {}, customers: {}, products: {}, sales: {},
  service_orders: {}, financial: {}, reports: {}, users: {}, settings: {},
  companies: {}, stores: {}, admin_center: {}, fiscal: {},
};

function buildPermissions(rows: Array<{ module: string; action: string }>): GlobalPermissions {
  const result: GlobalPermissions = {
    dashboard: {}, appointments: {}, customers: {}, products: {}, sales: {},
    service_orders: {}, financial: {}, reports: {}, users: {}, settings: {},
    companies: {}, stores: {}, admin_center: {}, fiscal: {},
  };
  for (const row of rows) {
    if (!(row.module in result)) continue;
    const moduleKey = row.module as keyof GlobalPermissions;
    const actionKey = row.action as keyof ModulePermissions;
    result[moduleKey] = { ...result[moduleKey], [actionKey]: true };
  }
  return result;
}

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<GlobalPermissions>(EMPTY_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions(EMPTY_PERMISSIONS);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          setPermissions(EMPTY_PERMISSIONS);
          setIsLoading(false);
        }
      }, 5000);
      try {
        const { data, error } = await localApi.auth.getPermissions();
        if (cancelled) return;
        if (error) throw new Error(error.message);
        setPermissions(buildPermissions(data || []));
      } catch (error) {
        if (!cancelled) {
          console.error('Não foi possível carregar as permissões locais:', error);
          setPermissions(EMPTY_PERMISSIONS);
        }
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchPermissions();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [user?.id, user?.role, user?.role_id]);

  const hasPermission = (module: keyof GlobalPermissions, action: keyof ModulePermissions) => {
    if (user?.role === 'admin_master') return true;
    return permissions[module]?.[action] === true;
  };

  return (
    <PermissionsContext.Provider value={{ permissions, hasPermission, role: user?.role || 'viewer', isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error('usePermissions must be used within a PermissionsProvider');
  return context;
};
