import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, Search, UserPlus, Phone, Mail, Percent, CalendarDays, Settings2, Lock, Loader2, MoreVertical, Trash2, UserCog, AlertTriangle, Stethoscope, FlaskConical, Building2, MapPin, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useProfiles, useEmployees, useLocalMutation, useRoles, usePermissions, useSeedPermissions, useProfessionals, useLaboratories } from '@/hooks/useLocalData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionMatrix } from '@/components/users/PermissionMatrix';
import { RoleModal } from '@/components/users/RoleModal';
import { localApi } from '@/lib/localApi';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

const roleBadgeColors: Record<string, string> = {
  admin_master: 'bg-amber-50 text-amber-700 border-amber-200/60',
  admin: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
  manager: 'bg-blue-50 text-blue-700 border-blue-200/60',
  seller: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  financial: 'bg-purple-50 text-purple-700 border-purple-200/60',
  receptionist: 'bg-pink-50 text-pink-700 border-pink-200/60',
  optometrist: 'bg-cyan-50 text-cyan-700 border-cyan-200/60',
  technician: 'bg-orange-50 text-orange-700 border-orange-200/60',
  user: 'bg-slate-50 text-slate-700 border-slate-200/60',
};

const ROLE_LABELS: Record<string, string> = {
  admin_master: 'Administrador Master',
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
  optometrist: 'Optometrista',
  technician: 'Técnico',
  receptionist: 'Recepcionista',
  financial: 'Financeiro',
  user: 'Usuário Comum',
};

const getRoleLabel = (role: string, rolesData: any[]) => {
  const r = rolesData?.find(rd => rd.name === role);
  if (r?.description) return r.description;
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase());
};

// Validate CPF
const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned.charAt(i)) * (10 - i);
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned.charAt(i)) * (11 - i);
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;

  return true;
};

// Format CPF
const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
};

export default function Users() {
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [permissionMatrixOpen, setPermissionMatrixOpen] = useState(false);
  const [customUserPermissions, setCustomUserPermissions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'user' | 'employee' | 'professional' | 'laboratory', id: string, name: string } | null>(null);

  const { data: usersData, isLoading: loadingUsers } = useProfiles();
  const { data: employeesData, isLoading: loadingEmployees } = useEmployees();
  const { data: rolesData, isLoading: loadingRoles } = useRoles();
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissions();
  const { data: professionalsData = [], isLoading: loadingProfessionals } = useProfessionals();
  const { data: laboratoriesData = [], isLoading: loadingLaboratories } = useLaboratories();
  const { companies, stores, selectedCompanyId } = useGlobalFilter();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const seedPermissionsMutation = useSeedPermissions();

  const employeeMutation = useLocalMutation('employees', [['employees']]);
  const professionalMutation = useLocalMutation('professionals', [['professionals']]);
  const laboratoryMutation = useLocalMutation('laboratories', [['laboratories']]);

  // Professional modal state
  const [professionalModalOpen, setProfessionalModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<any>(null);
  const [professionalSearch, setProfessionalSearch] = useState('');
  const [newProfessionalData, setNewProfessionalData] = useState({
    name: '', email: '', phone: '', cpf: '', specialty: '',
    council_type: '', council_number: '', council_state: '',
    hire_date: '', status: 'active' as 'active' | 'inactive',
    available_days: [] as string[], notes: '', store_id: '',
  });

  // Laboratory modal state
  const [laboratoryModalOpen, setLaboratoryModalOpen] = useState(false);
  const [editingLaboratory, setEditingLaboratory] = useState<any>(null);
  const [laboratorySearch, setLaboratorySearch] = useState('');
  const [newLaboratoryData, setNewLaboratoryData] = useState({
    name: '', trade_name: '', cnpj: '', email: '', phone: '', whatsapp: '',
    contact_name: '', address: '', city: '', state: '', zip_code: '',
    services: [] as string[], delivery_days: 7,
    status: 'active' as 'active' | 'inactive', notes: '',
  });

  const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const LAB_SERVICES = ['Lentes de Grau', 'Lentes de Contato', 'Armacoes', 'Manutencao', 'Exames', 'Montagem'];
  const SPECIALTIES = ['Optometrista', 'Oftalmologista', 'Tecnico em Optica', 'Vendedor', 'Atendente', 'Gerente', 'Outro'];
  const COUNCIL_TYPES = ['CRO', 'CRM', 'CFO', 'CBO', 'Outro'];

  const handleSaveProfessional = async () => {
    if (!newProfessionalData.name || !newProfessionalData.specialty) {
      toast({ title: 'Erro', description: 'Nome e especialidade sao obrigatorios.', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...newProfessionalData, company_id: selectedCompanyId };
      if (editingProfessional) {
        await professionalMutation.mutateAsync({ action: 'update', id: editingProfessional.id, data: payload });
        toast({ title: 'Profissional atualizado.' });
      } else {
        await professionalMutation.mutateAsync({ action: 'insert', data: payload });
        toast({ title: 'Profissional cadastrado.' });
      }
      setProfessionalModalOpen(false);
      setEditingProfessional(null);
      setNewProfessionalData({ name: '', email: '', phone: '', cpf: '', specialty: '', council_type: '', council_number: '', council_state: '', hire_date: '', status: 'active', available_days: [], notes: '', store_id: '' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleEditProfessional = (p: any) => {
    setEditingProfessional(p);
    setNewProfessionalData({
      name: p.name || '', email: p.email || '', phone: p.phone || '', cpf: p.cpf || '',
      specialty: p.specialty || '', council_type: p.council_type || '',
      council_number: p.council_number || '', council_state: p.council_state || '',
      hire_date: p.hire_date || '', status: p.status || 'active',
      available_days: p.available_days || [], notes: p.notes || '', store_id: p.store_id || '',
    });
    setProfessionalModalOpen(true);
  };

  const handleSaveLaboratory = async () => {
    if (!newLaboratoryData.name) {
      toast({ title: 'Erro', description: 'Nome do laboratorio e obrigatorio.', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...newLaboratoryData, company_id: selectedCompanyId };
      if (editingLaboratory) {
        await laboratoryMutation.mutateAsync({ action: 'update', id: editingLaboratory.id, data: payload });
        toast({ title: 'Laboratorio atualizado.' });
      } else {
        await laboratoryMutation.mutateAsync({ action: 'insert', data: payload });
        toast({ title: 'Laboratorio cadastrado.' });
      }
      setLaboratoryModalOpen(false);
      setEditingLaboratory(null);
      setNewLaboratoryData({ name: '', trade_name: '', cnpj: '', email: '', phone: '', whatsapp: '', contact_name: '', address: '', city: '', state: '', zip_code: '', services: [], delivery_days: 7, status: 'active', notes: '' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleEditLaboratory = (lab: any) => {
    setEditingLaboratory(lab);
    setNewLaboratoryData({
      name: lab.name || '', trade_name: lab.trade_name || '', cnpj: lab.cnpj || '',
      email: lab.email || '', phone: lab.phone || '', whatsapp: lab.whatsapp || '',
      contact_name: lab.contact_name || '', address: lab.address || '',
      city: lab.city || '', state: lab.state || '', zip_code: lab.zip_code || '',
      services: lab.services || [], delivery_days: lab.delivery_days || 7,
      status: lab.status || 'active', notes: lab.notes || '',
    });
    setLaboratoryModalOpen(true);
  };

  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'seller' as string,
    role_id: '',
    companies: [] as string[],
    stores: [] as string[],
    status: 'active' as 'active' | 'inactive',
  });

  const [newEmployeeData, setNewEmployeeData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    hire_date: '',
    role: 'seller' as any,
    commission: 0,
    company_id: '',
    store_id: '',
    status: 'active' as any,
  });

  const handleCreateEmployee = async () => {
    try {
      if (!newEmployeeData.name || !newEmployeeData.company_id || !newEmployeeData.store_id) {
        toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
        return;
      }

      // Validate CPF if provided
      if (newEmployeeData.cpf && !validateCPF(newEmployeeData.cpf)) {
        toast({ title: 'Erro', description: 'CPF inválido.', variant: 'destructive' });
        return;
      }

      // Validate commission
      if (newEmployeeData.commission < 0 || newEmployeeData.commission > 100) {
        toast({ title: 'Erro', description: 'Comissão deve estar entre 0% e 100%.', variant: 'destructive' });
        return;
      }

      // Check for duplicate CPF
      if (newEmployeeData.cpf) {
        const { data: existingEmployee } = await localApi
          .from('employees')
          .select('id')
          .eq('cpf', newEmployeeData.cpf.replace(/\D/g, ''))
          .neq('id', editingEmployee?.id || '')
          .maybeSingle();

        if (existingEmployee) {
          toast({ title: 'Erro', description: 'Já existe um funcionário com este CPF.', variant: 'destructive' });
          return;
        }
      }

      const dataToSave = {
        ...newEmployeeData,
        cpf: newEmployeeData.cpf ? newEmployeeData.cpf.replace(/\D/g, '') : null,
      };

      if (editingEmployee) {
        await employeeMutation.mutateAsync({ action: 'update', id: editingEmployee.id, data: dataToSave });
        toast({ title: 'Sucesso', description: 'Funcionário atualizado.' });
      } else {
        await employeeMutation.mutateAsync({ action: 'insert', data: dataToSave });
        toast({ title: 'Sucesso', description: 'Funcionário cadastrado.' });
      }

      setEmployeeModalOpen(false);
      setEditingEmployee(null);
      setNewEmployeeData({ name: '', email: '', phone: '', cpf: '', hire_date: '', role: 'seller', commission: 0, company_id: '', store_id: '', status: 'active' });
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditEmployee = (emp: any) => {
    setEditingEmployee(emp);
    setNewEmployeeData({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      cpf: emp.cpf ? formatCPF(emp.cpf) : '',
      hire_date: emp.hire_date || '',
      role: emp.role || 'seller',
      commission: emp.commission || 0,
      company_id: emp.company_id || '',
      store_id: emp.store_id || '',
      status: emp.status || 'active',
    });
    setEmployeeModalOpen(true);
  };

  const handleEditUser = async (user: any) => {
    setEditingUser(user);

    // Find the role in rolesData by ID or Name to ensure the Select shows the correct value
    const currentRole = rolesData?.find(r => r.id === user.role_id || r.name === user.role);

    setNewUserData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'seller',
      role_id: currentRole?.id || user.role_id || '',
      companies: user.companies || [],
      stores: user.stores || [],
      status: user.status || 'active',
    });

    try {
      const { data, error } = await localApi.auth.admin.getUserPermissions(user.id);
      if (error) throw error;
      setCustomUserPermissions(data || []);
    } catch (e) {
      console.warn('Error fetching user permissions:', e);
      setCustomUserPermissions([]);
    }

    setUserModalOpen(true);
  };

  const handleCreateUser = async () => {
    setIsSavingUser(true);
    try {
      if (!newUserData.name || !newUserData.email) {
        toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUserData.email)) {
        toast({ title: 'Erro', description: 'E-mail inválido.', variant: 'destructive' });
        return;
      }

      // Check for duplicate email (only when creating or changing email)
      if (!editingUser || editingUser.email !== newUserData.email) {
        const { data: existingUser } = await localApi
          .from('profiles')
          .select('id')
          .eq('email', newUserData.email)
          .maybeSingle();

        if (existingUser) {
          toast({ title: 'Erro', description: 'Já existe um usuário com este e-mail.', variant: 'destructive' });
          return;
        }
      }

      const dataToProcess = { ...newUserData, permissions: customUserPermissions };

      if (editingUser) {
        const { error } = await localApi.auth.admin.updateUser(editingUser.id, dataToProcess);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['profiles'] });
        toast({ title: 'Usuário atualizado' });
      } else {
        if (!newUserData.password) {
          toast({ title: 'Erro', description: 'Uma senha é obrigatória para novos usuários.', variant: 'destructive' });
          return;
        }

        if (newUserData.password.length < 6) {
          toast({ title: 'Erro', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
          return;
        }

        const { error } = await localApi.auth.admin.createUser(dataToProcess);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['profiles'] });
        toast({ title: 'Usuário cadastrado' });
      }

      setUserModalOpen(false);
      setEditingUser(null);
      const sellerRole = rolesData?.find(r => r.name === 'seller');
      setNewUserData({ name: '', email: '', password: '', role: 'seller', role_id: sellerRole?.id || '', companies: [], stores: [], status: 'active' });
      setCustomUserPermissions([]);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = (user: any) => {
    setItemToDelete({ type: 'user', id: user.id, name: user.name || user.email });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteEmployee = (employee: any) => {
    setItemToDelete({ type: 'employee', id: employee.id, name: employee.name });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'user') {
        setIsDeletingUser(true);
        const { error } = await localApi.auth.admin.deleteUser(itemToDelete.id);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['profiles'] });
        toast({ title: 'Usuario excluido', description: 'O usuario foi removido com sucesso.' });
      } else if (itemToDelete.type === 'professional') {
        await professionalMutation.mutateAsync({ action: 'delete', id: itemToDelete.id });
        toast({ title: 'Profissional excluido.' });
      } else if (itemToDelete.type === 'laboratory') {
        await laboratoryMutation.mutateAsync({ action: 'delete', id: itemToDelete.id });
        toast({ title: 'Laboratorio excluido.' });
      } else {
        await employeeMutation.mutateAsync({ action: 'delete', id: itemToDelete.id });
        toast({ title: 'Funcionario excluido', description: 'O funcionario foi removido com sucesso.' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeletingUser(false);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  if (loadingUsers || loadingEmployees) return <div className="flex h-[400px] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const filteredUsers = (usersData || []).filter(u => 
    (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const filteredEmployees = (employeesData || []).filter(emp => 
    (emp.name?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
     emp.email?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
     emp.cpf?.includes(employeeSearchTerm))
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Usuários & Equipe"
        description="Gerencie acessos, permissões e equipe do sistema"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => {
              setNewEmployeeData({ name: '', email: '', phone: '', cpf: '', hire_date: '', role: 'seller', commission: 0, company_id: '', store_id: '', status: 'active' });
              setEditingEmployee(null);
              setEmployeeModalOpen(true);
            }}>
              <UserPlus className="h-4 w-4" />Novo Funcionário
            </Button>
            <Button size="sm" className="gap-2 gradient-navy text-white border-0 shadow-md shadow-primary/15" onClick={() => {
              setEditingUser(null);
              const sellerRole = rolesData?.find(r => r.name === 'seller');
              setNewUserData({ name: '', email: '', password: '', role: 'seller', role_id: sellerRole?.id || '', companies: [], stores: [], status: 'active' });
              setCustomUserPermissions([]);
              setUserModalOpen(true);
            }}>
              <Plus className="h-4 w-4" />Novo Usuário
            </Button>
          </div>
        }
      />

      <FinancialInfoTip className="px-3 py-2.5" title="Dica de acessos">Use perfis para centralizar permissões e personalize apenas as exceções necessárias por usuário. Revise empresa e loja antes de salvar um acesso.</FinancialInfoTip>

      <Tabs defaultValue="users">
        <TabsList className="h-10 p-1">
          <TabsTrigger value="users" className="text-xs gap-1.5 px-4 rounded-lg">Usuarios do Sistema</TabsTrigger>
          <TabsTrigger value="employees" className="text-xs gap-1.5 px-4 rounded-lg">Funcionarios / Vendedores</TabsTrigger>
          <TabsTrigger value="professionals" className="text-xs gap-1.5 px-4 rounded-lg"><Stethoscope className="h-3.5 w-3.5" />Profissionais</TabsTrigger>
          <TabsTrigger value="establishments" className="text-xs gap-1.5 px-4 rounded-lg"><FlaskConical className="h-3.5 w-3.5" />Estabelecimentos</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1.5 px-4 rounded-lg">Perfis de Acesso</TabsTrigger>
          <TabsTrigger value="permissions" className="text-xs gap-1.5 px-4 rounded-lg">Matriz Global</TabsTrigger>
        </TabsList>

        {/* === USERS TAB === */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuário..." className="pl-9 h-9 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground italic">* Contas de login para acesso ao sistema.</p>
          </div>

          <Card className="premium-shadow border-border/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/60">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Usuário</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perfil</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lojas</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Último acesso</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id} className="cursor-pointer hover:bg-accent/30 transition-colors border-border/40" onClick={() => handleEditUser(u)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl gradient-navy-light flex items-center justify-center text-white text-[10px] font-bold">
                            {(u.name || u.email || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold">{u.name || 'Sem nome'}</p>
                            <p className="text-[11px] text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] font-semibold border rounded-full px-2.5 ${roleBadgeColors[u.role] || 'bg-muted text-muted-foreground border-border'}`}>
                          {getRoleLabel(u.role, rolesData || [])}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] rounded-full px-2">{u.role === 'admin_master' ? 'Todas' : `${u.stores?.length || 0} loja${(u.stores?.length || 0) !== 1 ? 's' : ''}`}</Badge>
                      </TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.last_access ? new Date(u.last_access).toLocaleDateString() : 'Nunca'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditUser(u)}><UserCog className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(u)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === EMPLOYEES TAB === */}
        <TabsContent value="employees" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar funcionário..." className="pl-9 h-9 text-sm" value={employeeSearchTerm} onChange={(e) => setEmployeeSearchTerm(e.target.value)} />
            </div>
          </div>

          <Card className="premium-shadow border-border/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/60">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Funcionário</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cargo</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comissão</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map(emp => (
                    <TableRow key={emp.id} className="cursor-pointer hover:bg-accent/30 transition-colors border-border/40" onClick={() => handleEditEmployee(emp)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl gradient-navy-light flex items-center justify-center text-white text-[10px] font-bold">
                            {emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold">{emp.name}</p>
                            <p className="text-[11px] text-muted-foreground">{emp.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] font-semibold border rounded-full px-2.5 ${roleBadgeColors[emp.role] || 'bg-muted text-muted-foreground border-border'}`}>
                          {getRoleLabel(emp.role, rolesData || [])}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{emp.commission > 0 ? `${emp.commission}%` : '—'}</TableCell>
                      <TableCell><StatusBadge status={emp.status} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditEmployee(emp)}><UserCog className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteEmployee(emp)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PROFESSIONALS TAB === */}
        <TabsContent value="professionals" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar profissional..." className="pl-9 h-9 text-sm" value={professionalSearch} onChange={e => setProfessionalSearch(e.target.value)} />
            </div>
            <Button size="sm" className="gap-2 gradient-navy text-white border-0 shadow-md shadow-primary/15" onClick={() => { setEditingProfessional(null); setNewProfessionalData({ name: '', email: '', phone: '', cpf: '', specialty: '', council_type: '', council_number: '', council_state: '', hire_date: '', status: 'active', available_days: [], notes: '', store_id: '' }); setProfessionalModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo Profissional
            </Button>
          </div>

          {loadingProfessionals ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {professionalsData.filter((p: any) => p.name?.toLowerCase().includes(professionalSearch.toLowerCase()) || p.specialty?.toLowerCase().includes(professionalSearch.toLowerCase())).map((p: any) => (
                <Card key={p.id} className="premium-shadow border-border/60 hover:border-primary/40 transition-all cursor-pointer" onClick={() => handleEditProfessional(p)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl gradient-navy-light flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                          {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight">{p.name}</p>
                          <Badge className="mt-0.5 text-[9px] px-2 py-0 bg-cyan-50 text-cyan-700 border-cyan-200/60 border rounded-full">{p.specialty}</Badge>
                        </div>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="space-y-1.5 text-[11px] text-muted-foreground">
                      {p.council_type && p.council_number && (
                        <div className="flex items-center gap-1.5"><Shield className="h-3 w-3" />{p.council_type} {p.council_number}{p.council_state ? `/${p.council_state}` : ''}</div>
                      )}
                      {p.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{p.phone}</div>}
                      {p.available_days?.length > 0 && (
                        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{p.available_days.join(', ')}</div>
                      )}
                    </div>
                    <div className="flex justify-end mt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); handleEditProfessional(p); }}><UserCog className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); setItemToDelete({ type: 'professional', id: p.id, name: p.name }); setDeleteConfirmOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {professionalsData.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Stethoscope className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Nenhum profissional cadastrado.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* === ESTABLISHMENTS TAB === */}
        <TabsContent value="establishments" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar laboratorio..." className="pl-9 h-9 text-sm" value={laboratorySearch} onChange={e => setLaboratorySearch(e.target.value)} />
            </div>
            <Button size="sm" className="gap-2 gradient-navy text-white border-0 shadow-md shadow-primary/15" onClick={() => { setEditingLaboratory(null); setNewLaboratoryData({ name: '', trade_name: '', cnpj: '', email: '', phone: '', whatsapp: '', contact_name: '', address: '', city: '', state: '', zip_code: '', services: [], delivery_days: 7, status: 'active', notes: '' }); setLaboratoryModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo Laboratorio
            </Button>
          </div>

          {loadingLaboratories ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {laboratoriesData.filter((l: any) => l.name?.toLowerCase().includes(laboratorySearch.toLowerCase()) || l.city?.toLowerCase().includes(laboratorySearch.toLowerCase())).map((lab: any) => (
                <Card key={lab.id} className="premium-shadow border-border/60 hover:border-primary/40 transition-all cursor-pointer" onClick={() => handleEditLaboratory(lab)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
                          <FlaskConical className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight">{lab.name}</p>
                          {lab.trade_name && <p className="text-[10px] text-muted-foreground">{lab.trade_name}</p>}
                        </div>
                      </div>
                      <StatusBadge status={lab.status} />
                    </div>
                    <div className="space-y-1.5 text-[11px] text-muted-foreground">
                      {lab.contact_name && <div className="flex items-center gap-1.5"><UserCog className="h-3 w-3" />{lab.contact_name}</div>}
                      {lab.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{lab.phone}</div>}
                      {(lab.city || lab.state) && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[lab.city, lab.state].filter(Boolean).join(', ')}</div>}
                      {lab.delivery_days && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />Prazo: {lab.delivery_days} dias</div>}
                    </div>
                    {lab.services?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {lab.services.slice(0, 3).map((s: string) => (
                          <Badge key={s} variant="secondary" className="text-[9px] px-1.5 py-0">{s}</Badge>
                        ))}
                        {lab.services.length > 3 && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">+{lab.services.length - 3}</Badge>}
                      </div>
                    )}
                    <div className="flex justify-end mt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); handleEditLaboratory(lab); }}><UserCog className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); setItemToDelete({ type: 'laboratory', id: lab.id, name: lab.name }); setDeleteConfirmOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {laboratoriesData.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Building2 className="h-8 w-8 opacity-20" />
                  <p className="text-sm">Nenhum estabelecimento cadastrado.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* === ROLES TAB === */}
        <TabsContent value="roles" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Gerencie os perfis de acesso padrão do sistema.</p>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingRole(null); setRoleModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo Perfil
            </Button>
          </div>
          {loadingRoles ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Carregando perfis globais...</div>
          ) : rolesData && rolesData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rolesData.map(role => (
                <Card key={role.id} className="premium-shadow hover:border-primary/40 transition-all cursor-pointer" onClick={() => { setEditingRole(role); setRoleModalOpen(true); }}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-3">
                      <CardTitle className="text-sm font-bold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />{getRoleLabel(role.name, rolesData || [])}</CardTitle>
                      <Badge variant={role.is_system ? 'secondary' : 'outline'} className="text-[9px] uppercase shrink-0">{role.is_system ? 'Sistema' : 'Personalizado'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{role.description || 'Sem descrição.'}</p>
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex flex-col gap-0.5 text-[10px] font-medium text-muted-foreground">
                        <span>{role.role_permissions?.length || 0} permissões globais</span>
                        <span>{role.assigned_user_count || 0} usuários vinculados</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]">Editar</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum perfil de acesso cadastrado.</div>
          )}
        </TabsContent>

        {/* === PERMISSIONS TAB === */}
        <TabsContent value="permissions" className="mt-6">
          <Card className="premium-shadow border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold font-heading">Matriz Global de Permissões</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Visualize as permissões globais do sistema.</p>
                </div>
                {currentUser?.role === 'admin_master' && (
                  <Button size="sm" variant="outline" className="h-8 text-[10px] gap-2" onClick={async () => {
                    try {
                      await seedPermissionsMutation.mutateAsync();
                      toast({ title: 'Sincronizado' });
                    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
                  }}>
                    <Lock className="h-3 w-3" />Sincronizar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <PermissionMatrix permissions={permissionsData || []} selectedPermissions={permissionsData?.map(p => p.id) || []} onChange={() => {}} disabled />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RoleModal open={roleModalOpen} onOpenChange={setRoleModalOpen} role={editingRole} permissions={permissionsData || []} />

      {/* PROFESSIONAL MODAL */}
      <Dialog open={professionalModalOpen} onOpenChange={setProfessionalModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfessional ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
            <DialogDescription>Profissionais podem ser vinculados a agendamentos e ordens de servico.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label className="text-xs font-semibold">Nome completo *</Label>
                <Input value={newProfessionalData.name} onChange={e => setNewProfessionalData(p => ({ ...p, name: e.target.value }))} placeholder="Nome do profissional" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Especialidade *</Label>
                <Select value={newProfessionalData.specialty} onValueChange={v => setNewProfessionalData(p => ({ ...p, specialty: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Unidade</Label>
                <Select value={newProfessionalData.store_id} onValueChange={v => setNewProfessionalData(p => ({ ...p, store_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name.includes(' - ') ? s.name.split(' - ')[1] : s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Conselho</Label>
                <Select value={newProfessionalData.council_type} onValueChange={v => setNewProfessionalData(p => ({ ...p, council_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>{COUNCIL_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Numero do Conselho</Label>
                <div className="flex gap-1">
                  <Input value={newProfessionalData.council_number} onChange={e => setNewProfessionalData(p => ({ ...p, council_number: e.target.value }))} placeholder="00000" className="flex-1" />
                  <Input value={newProfessionalData.council_state} onChange={e => setNewProfessionalData(p => ({ ...p, council_state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" className="w-14" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Telefone</Label>
                <Input value={newProfessionalData.phone} onChange={e => setNewProfessionalData(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">E-mail</Label>
                <Input type="email" value={newProfessionalData.email} onChange={e => setNewProfessionalData(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Data de Admissao</Label>
                <Input type="date" value={newProfessionalData.hire_date} onChange={e => setNewProfessionalData(p => ({ ...p, hire_date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={newProfessionalData.status} onValueChange={v => setNewProfessionalData(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Dias disponiveis</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map(d => (
                  <button key={d} type="button"
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${newProfessionalData.available_days.includes(d) ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary/40'}`}
                    onClick={() => setNewProfessionalData(p => ({ ...p, available_days: p.available_days.includes(d) ? p.available_days.filter(x => x !== d) : [...p.available_days, d] }))}
                  >{d}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Observacoes</Label>
              <Textarea value={newProfessionalData.notes} onChange={e => setNewProfessionalData(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfessionalModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProfessional} disabled={professionalMutation.isPending}>
              {professionalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProfessional ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LABORATORY MODAL */}
      <Dialog open={laboratoryModalOpen} onOpenChange={setLaboratoryModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLaboratory ? 'Editar Laboratorio' : 'Novo Laboratorio'}</DialogTitle>
            <DialogDescription>Laboratorios recebem OS de lentes e exames dos pacientes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label className="text-xs font-semibold">Razao Social *</Label>
                <Input value={newLaboratoryData.name} onChange={e => setNewLaboratoryData(p => ({ ...p, name: e.target.value }))} placeholder="Nome do laboratorio" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Nome Fantasia</Label>
                <Input value={newLaboratoryData.trade_name} onChange={e => setNewLaboratoryData(p => ({ ...p, trade_name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">CNPJ</Label>
                <Input value={newLaboratoryData.cnpj} onChange={e => setNewLaboratoryData(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Contato</Label>
                <Input value={newLaboratoryData.contact_name} onChange={e => setNewLaboratoryData(p => ({ ...p, contact_name: e.target.value }))} placeholder="Nome do responsavel" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Telefone</Label>
                <Input value={newLaboratoryData.phone} onChange={e => setNewLaboratoryData(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">WhatsApp</Label>
                <Input value={newLaboratoryData.whatsapp} onChange={e => setNewLaboratoryData(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">E-mail</Label>
                <Input type="email" value={newLaboratoryData.email} onChange={e => setNewLaboratoryData(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Prazo de entrega (dias)</Label>
                <Input type="number" min={1} max={60} value={newLaboratoryData.delivery_days} onChange={e => setNewLaboratoryData(p => ({ ...p, delivery_days: parseInt(e.target.value) || 7 }))} />
              </div>
              <div className="col-span-2 grid gap-2">
                <Label className="text-xs font-semibold">Endereco</Label>
                <Input value={newLaboratoryData.address} onChange={e => setNewLaboratoryData(p => ({ ...p, address: e.target.value }))} placeholder="Rua, numero, bairro" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Cidade</Label>
                <Input value={newLaboratoryData.city} onChange={e => setNewLaboratoryData(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Estado</Label>
                <Input value={newLaboratoryData.state} onChange={e => setNewLaboratoryData(p => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={newLaboratoryData.status} onValueChange={v => setNewLaboratoryData(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Servicos oferecidos</Label>
              <div className="flex flex-wrap gap-2">
                {LAB_SERVICES.map(s => (
                  <button key={s} type="button"
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${newLaboratoryData.services.includes(s) ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary/40'}`}
                    onClick={() => setNewLaboratoryData(p => ({ ...p, services: p.services.includes(s) ? p.services.filter(x => x !== s) : [...p.services, s] }))}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Observacoes</Label>
              <Textarea value={newLaboratoryData.notes} onChange={e => setNewLaboratoryData(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaboratoryModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLaboratory} disabled={laboratoryMutation.isPending}>
              {laboratoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingLaboratory ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* USER MODAL */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>Defina os dados de acesso, o papel e o escopo operacional deste usuário.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Nome completo</Label>
              <Input id="new-user-name" name="new-user-name" autoComplete="off" value={newUserData.name} onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">E-mail (Login)</Label>
              <Input id="new-user-email" name="new-user-email" type="email" autoComplete="new-username" value={newUserData.email} onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })} disabled={!!editingUser} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Senha {editingUser && '(deixe em branco para manter)'}</Label>
              <Input id="new-user-password" name="new-user-password" type="password" autoComplete="new-password" value={newUserData.password} onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })} placeholder={editingUser ? 'Digite para alterar' : 'Mínimo 6 caracteres'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Perfil</Label>
                <Select onValueChange={(v) => {
                  const r = rolesData?.find(rd => rd.id === v);
                  setNewUserData({ ...newUserData, role_id: v, role: (r?.name || 'seller') as any });
                }} value={newUserData.role_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{rolesData?.map(r => <SelectItem key={r.id} value={r.id}>{r.description || r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Status</Label>
                <Select onValueChange={(v) => setNewUserData({ ...newUserData, status: v as any })} value={newUserData.status}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Empresas & Lojas</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-3">
                {companies.map(c => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={newUserData.companies.includes(c.id)} onCheckedChange={(checked) => {
                        setNewUserData((previous) => {
                          const nextCompanies = checked
                            ? [...previous.companies, c.id]
                            : previous.companies.filter(id => id !== c.id);
                          const companyStoreIds = stores.filter(s => s.company_id === c.id).map(s => s.id);
                          const nextStores = checked
                            ? previous.stores
                            : previous.stores.filter(id => !companyStoreIds.includes(id));
                          return { ...previous, companies: nextCompanies, stores: nextStores };
                        });
                      }} />
                      <Label className="text-xs font-bold">{c.trade_name || c.name}</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      {stores.filter(s => s.company_id === c.id).map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Checkbox checked={newUserData.stores.includes(s.id)} onCheckedChange={(checked) => {
                            setNewUserData((previous) => ({
                              ...previous,
                              stores: checked
                                ? [...previous.stores, s.id]
                                : previous.stores.filter(id => id !== s.id),
                              companies: checked && !previous.companies.includes(s.company_id)
                                ? [...previous.companies, s.company_id]
                                : previous.companies,
                            }));
                          }} />
                          <Label className="text-[11px] truncate">{s.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="outline" className="w-full text-xs" onClick={() => setPermissionMatrixOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Permissões Específicas</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserModalOpen(false)}>Cancelar</Button>
            <Button className="gradient-navy text-white" onClick={handleCreateUser} disabled={isSavingUser}>
              {isSavingUser ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EMPLOYEE MODAL */}
      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingEmployee ? 'Editar' : 'Novo'} Funcionário</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label className="text-xs font-semibold">Nome completo</Label><Input value={newEmployeeData.name} onChange={(e) => setNewEmployeeData({ ...newEmployeeData, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label className="text-xs font-semibold">E-mail</Label><Input type="email" value={newEmployeeData.email} onChange={(e) => setNewEmployeeData({ ...newEmployeeData, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label className="text-xs font-semibold">Telefone</Label><Input value={newEmployeeData.phone} onChange={(e) => setNewEmployeeData({ ...newEmployeeData, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label className="text-xs font-semibold">CPF</Label><Input value={newEmployeeData.cpf} onChange={(e) => setNewEmployeeData({ ...newEmployeeData, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} /></div>
              <div className="grid gap-2"><Label className="text-xs font-semibold">Data de Admissão</Label><Input type="date" value={newEmployeeData.hire_date} onChange={(e) => setNewEmployeeData({ ...newEmployeeData, hire_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label className="text-xs font-semibold">Cargo</Label>
                <Select onValueChange={(v) => setNewEmployeeData({ ...newEmployeeData, role: v })} value={newEmployeeData.role}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{rolesData?.map(r => <SelectItem key={r.id} value={r.name}>{r.description || r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label className="text-xs font-semibold">Status</Label>
                <Select onValueChange={(v) => setNewEmployeeData({ ...newEmployeeData, status: v })} value={newEmployeeData.status}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem><SelectItem value="vacation">Férias</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label className="text-xs font-semibold">Empresa</Label>
                <Select onValueChange={(v) => setNewEmployeeData({ ...newEmployeeData, company_id: v, store_id: '' })} value={newEmployeeData.company_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label className="text-xs font-semibold">Loja</Label>
                <Select onValueChange={(v) => setNewEmployeeData({ ...newEmployeeData, store_id: v })} value={newEmployeeData.store_id} disabled={!newEmployeeData.company_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{stores.filter(s => s.company_id === newEmployeeData.company_id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label className="text-xs font-semibold">Comissão (%)</Label><Input type="number" min="0" max="100" step="0.01" value={newEmployeeData.commission} onChange={(e) => setNewEmployeeData({ ...newEmployeeData, commission: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeModalOpen(false)}>Cancelar</Button>
            <Button className="gradient-navy text-white" onClick={handleCreateEmployee} disabled={employeeMutation.isPending}>
              {employeeMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionMatrixOpen} onOpenChange={setPermissionMatrixOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2"><DialogTitle>Permissões Específicas: {newUserData.name}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-3">
            <p className="text-xs text-muted-foreground">Estas permissões são exceções individuais e serão somadas às permissões herdadas do perfil.</p>
            <div className="flex justify-end text-[11px] font-medium text-muted-foreground">{newUserData.role === 'admin_master' ? (permissionsData?.length || 0) : customUserPermissions.length} selecionadas</div>
            <PermissionMatrix permissions={permissionsData} selectedPermissions={newUserData.role === 'admin_master' ? permissionsData?.map(p => p.id) || [] : customUserPermissions} onChange={setCustomUserPermissions} disabled={newUserData.role === 'admin_master'} />
          </div>
          <DialogFooter className="p-6 pt-2 border-t"><Button onClick={() => setPermissionMatrixOpen(false)}>Concluído</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {itemToDelete?.type === 'user' ? 'o usuário' : 'o funcionário'} <strong>{itemToDelete?.name}</strong>?
              <br />
              <span className="text-destructive font-medium">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {(isDeletingUser || employeeMutation.isPending) ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
