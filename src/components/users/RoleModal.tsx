import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionMatrix } from './PermissionMatrix';
import { toast } from 'sonner';
import { localApi } from '@/lib/localApi';
import type { AccessControlPermission, AccessControlRole } from '@/hooks/useLocalData';

interface RoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: AccessControlRole | null;
  permissions?: AccessControlPermission[];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível salvar o perfil.';
}

export function RoleModal({ open, onOpenChange, role, permissions = [] }: RoleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const isSystemRole = Boolean(role?.is_system);
  const isAdminMaster = role?.name === 'admin_master';

  useEffect(() => {
    if (!open) return;
    setName(role?.is_system ? (role.description || role.name || '') : (role?.name || ''));
    setDescription(role?.description || '');
    setSelectedPermissions(role?.role_permissions?.map((item) => String(item.permission_id)) || []);
  }, [open, role]);

  const refreshAccessControl = () => {
    queryClient.invalidateQueries({ queryKey: ['access-control'] });
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    queryClient.invalidateQueries({ queryKey: ['permissions'] });
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
  };

  const handleDelete = async () => {
    if (!role || isSystemRole) return;
    if (!window.confirm('Tem certeza que deseja excluir este perfil? Usuários vinculados precisam ser reatribuídos antes.')) return;

    setLoading(true);
    try {
      const result = await localApi.auth.admin.deleteRole(role.id);
      if (result.error) throw new Error(result.error.message);
      toast.success('Perfil excluído', { description: 'O perfil foi removido globalmente.' });
      refreshAccessControl();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao excluir perfil', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Informe o nome do perfil.');
      return;
    }
    if (selectedPermissions.some((permissionId) => !permissions.some((permission) => permission.id === permissionId))) {
      toast.error('Atualize a matriz de permissões e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const result = role
        ? await localApi.auth.admin.updateRole(role.id, {
            name: trimmedName,
            description: description.trim(),
            permission_ids: selectedPermissions,
          })
        : await localApi.auth.admin.createRole({
            name: trimmedName,
            description: description.trim(),
            permission_ids: selectedPermissions,
          });
      if (result.error) throw new Error(result.error.message);

      toast.success(role ? 'Perfil atualizado' : 'Perfil criado', {
        description: 'As permissões foram aplicadas globalmente aos usuários vinculados.',
      });
      refreshAccessControl();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar perfil', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle>{role ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}</DialogTitle>
          <DialogDescription>
            Configure o perfil e suas permissões globais. Todos os usuários vinculados herdarão esta matriz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">{isSystemRole ? 'Nome do perfil' : 'Identificador do perfil'}</Label>
              <Input
                id="role-name"
                name="role-name"
                autoComplete="off"
                placeholder="Ex.: Gerente de Loja"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={loading || isSystemRole}
              />
              {isSystemRole && <p className="text-[11px] text-muted-foreground">Perfis de sistema mantêm seu identificador original.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Descrição</Label>
              <Input
                id="role-description"
                name="role-description"
                autoComplete="off"
                placeholder="Ex.: Acesso operacional à loja"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={loading || isAdminMaster}
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <div>
                <h3 className="text-sm font-semibold">Permissões do perfil</h3>
                <p className="text-[11px] text-muted-foreground">Marque as ações permitidas por módulo.</p>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{selectedPermissions.length} selecionadas</span>
            </div>
            {isAdminMaster && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                O Administrador Master possui acesso irrestrito por regra do sistema; sua matriz é exibida para consulta.
              </div>
            )}
            <PermissionMatrix
              permissions={permissions}
              selectedPermissions={selectedPermissions}
              onChange={setSelectedPermissions}
              disabled={loading || isAdminMaster}
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-3 border-t bg-muted/20 flex items-center justify-between sm:justify-between">
          <div>
            {role && !isSystemRole && (
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 text-xs" onClick={handleDelete} disabled={loading}>
                Excluir Perfil
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button className="h-9 text-xs gradient-navy text-white border-0 shadow-sm" onClick={handleSave} disabled={loading || isAdminMaster}>
              {loading ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
