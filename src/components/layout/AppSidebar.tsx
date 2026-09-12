import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Building2, Store, Shield,
  DollarSign, ShoppingCart, Package, BarChart3, Settings, User,
  Crown, Sparkles, ClipboardList, FileCheck2, LucideIcon, ChevronRight
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { GlobalPermissions } from '@/types/permissions';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/shared/BrandMark';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  module: keyof GlobalPermissions | 'profile' | 'admin';
}

const mainNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { title: 'Agendamentos', url: '/appointments', icon: Calendar, module: 'appointments' },
  { title: 'Clientes', url: '/customers', icon: Users, module: 'customers' },
  { title: 'Vendas', url: '/sales', icon: ShoppingCart, module: 'sales' },
  { title: 'O.S.', url: '/service-orders', icon: ClipboardList, module: 'service_orders' },
];

const managementNav: NavItem[] = [
  { title: 'Empresas', url: '/companies', icon: Building2, module: 'companies' },
  { title: 'Lojas', url: '/stores', icon: Store, module: 'stores' },
  { title: 'Usuários', url: '/users', icon: Shield, module: 'users' },
];

const operationsNav: NavItem[] = [
  { title: 'Financeiro', url: '/financial', icon: DollarSign, module: 'financial' },
  { title: 'Gestão Fiscal', url: '/fiscal', icon: FileCheck2, module: 'fiscal' },
  { title: 'Produtos', url: '/products', icon: Package, module: 'products' },
  { title: 'Relatórios', url: '/reports', icon: BarChart3, module: 'reports' },
];

const systemNav: NavItem[] = [
  { title: 'Central Admin', url: '/admin', icon: Crown, module: 'admin' },
  { title: 'Configurações', url: '/settings', icon: Settings, module: 'settings' },
  { title: 'Meu Perfil', url: '/profile', icon: User, module: 'profile' },
];

function NavGroup({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  const location = useLocation();
  const { hasPermission, role } = usePermissions();

  const filteredItems = items.filter(item => {
    if (item.module === 'profile') return true;
    if (item.module === 'admin') return role === 'admin' || role === 'admin_master';
    return hasPermission(item.module as keyof GlobalPermissions, 'view');
  });

  if (filteredItems.length === 0) return null;

  return (
    <SidebarGroup className="px-2">
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2 px-3 text-sidebar-foreground/40 animate-fade-in">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = location.pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                  <NavLink
                    to={item.url}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-300 overflow-hidden',
                      isActive
                        ? 'bg-gradient-to-r from-sidebar-primary/15 to-sidebar-primary/5 text-sidebar-primary font-bold shadow-sm shadow-sidebar-primary/10'
                        : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                    )}
                    activeClassName=""
                  >
                    {/* active indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-purple-500 animate-scale-in" />
                    )}
                    <item.icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-all duration-300',
                        isActive && 'scale-110 drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]'
                      )}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    {!collapsed && <span className="flex-1">{item.title}</span>}
                    {!collapsed && isActive && (
                      <ChevronRight className="h-3.5 w-3.5 opacity-60 animate-fade-in" />
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user } = useAuth();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/40 bg-sidebar/60 backdrop-blur-xl"
    >
      {/* Halo discreto da identidade, sem utilizar a logo de referência */}
      <div
        className="pointer-events-none absolute left-1/2 top-10 -z-10 h-28 w-28 -translate-x-1/2 rounded-full bg-primary/20 opacity-70 blur-3xl"
      />

      <SidebarHeader className={cn('relative border-b border-sidebar-border/50 py-3', collapsed ? 'px-2' : 'px-3')}>
        <div className={cn(
          'flex items-center rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/35 shadow-lg shadow-black/10 transition-colors',
          collapsed ? 'justify-center p-1.5' : 'gap-3 px-3 py-2.5',
        )}>
            <div className="relative h-9 w-9 shrink-0">
              <div className="absolute -inset-1 rounded-xl bg-primary/25 blur-md" />
              <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-primary/20 bg-sidebar shadow-md shadow-primary/20">
                <BrandMark variant="icon" className="h-full w-full p-0.5" alt="Símbolo do cacto" priority />
              </div>
            </div>
          {!collapsed && (
            <div className="min-w-0 animate-fade-in">
              <p className="font-heading text-[13px] font-extrabold leading-tight tracking-tight text-sidebar-foreground">
                GESTÃO ÓTICAS <span className="text-primary">H2K</span>
              </p>
              <p className="mt-1 truncate text-[9px] font-semibold leading-none tracking-[0.12em] text-sidebar-foreground/65">
                Sertão ótica & Nordestina
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4 space-y-3 custom-scrollbar overflow-y-auto">
        <NavGroup label="Principal" items={mainNav} collapsed={collapsed} />
        <NavGroup label="Gestão" items={managementNav} collapsed={collapsed} />
        <NavGroup label="Operações" items={operationsNav} collapsed={collapsed} />
        <NavGroup label="Sistema" items={systemNav} collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/40">
        {!collapsed && user && (
          <div className="relative group">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-3 p-2.5 rounded-xl hover:bg-sidebar-accent/60 transition-colors cursor-pointer">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-purple-600 blur-sm opacity-50" />
                <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-purple-600 grid place-items-center text-white text-[11px] font-bold shadow-md">
                  {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </div>
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-sidebar-foreground truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-sidebar-foreground/45 truncate">
                  {user.email}
                </span>
              </div>
              <Sparkles className="h-3.5 w-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}