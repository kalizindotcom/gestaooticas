import React from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { GlobalPermissions, ModulePermissions } from '@/types/permissions';

interface PermissionGateProps {
  children: React.ReactNode;
  module: keyof GlobalPermissions;
  action?: keyof ModulePermissions;
  fallback?: React.ReactNode;
}

export function PermissionGate({ 
  children, 
  module, 
  action = 'view', 
  fallback = null 
}: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) return null;

  if (hasPermission(module, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
