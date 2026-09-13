import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, BarChart3, BarChartHorizontal,
  Calendar, CheckCircle2, Clock3, Download, FileBarChart, FileText, Filter, History,
  Package, PieChart, Printer, RefreshCw, Search, ShoppingBag, Store, Target, TrendingDown,
  TrendingUp, User, Users, Wallet, XCircle, Zap, Settings2, Star, GripVertical, Check,
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAppointments, useCustomers, useProducts, useSales, useServiceOrders } from '@/hooks/useLocalData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { getScopedStockRecords, isCancelledSale, isCompletedSale, isRecordInStoreScope } from '@/lib/reportScope';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { ReportModal } from '@/components/reports/ReportModal';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MobileFilterField, MobileFiltersButton, MobileFiltersDialog } from '@/components/shared/MobileFiltersDialog';

const money = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value: number) => Number(value || 0).toLocaleString('pt-BR');
const dateOnly = (value: any) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const safeDate = (value: any) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; };

const REPORTS = [
  ['products-sold', 'Produtos vendidos', 'Itens, quantidades, margem e participação no faturamento', ShoppingBag, 'blue'],
  ['store-sales', 'Vendas por loja', 'Comparativo de faturamento, ticket e participação por unidade', Store, 'violet'],
  ['monthly-revenue', 'Faturamento mensal', 'Evolução por período, metas e comparação entre meses', TrendingUp, 'emerald'],
  ['salesperson-performance', 'Desempenho por vendedor', 'Ranking comercial, volume de vendas e ticket médio', Zap, 'pink'],
  ['inventory-turnover', 'Giro de estoque', 'Produtos parados, giro estimado e necessidade de reposição', Package, 'cyan'],
  ['expired-prescriptions', 'Receitas e prescrições', 'OS com prescrição, validade e acompanhamento clínico', Clock3, 'amber'],
  ['sales-by-period', 'Vendas por período', 'Resumo diário, semanal e mensal das vendas', Calendar, 'orange'],
  ['sales-by-payment', 'Vendas por pagamento', 'Distribuição por método de pagamento e recebimento', Wallet, 'teal'],
  ['customers-ranking', 'Clientes recorrentes', 'Clientes com maior frequência e valor acumulado', Users, 'indigo'],
  ['new-customers', 'Novos clientes', 'Entrada de clientes e evolução da base cadastrada', User, 'sky'],
  ['os-status', 'Status das O.S.', 'Volume por etapa, prazo e situação operacional', Activity, 'purple'],
  ['os-deadlines', 'Prazos de O.S.', 'Ordens atrasadas, próximas do vencimento e entregues', Target, 'rose'],
  ['appointments', 'Agendamentos', 'Agenda, comparecimento e distribuição por profissional', Calendar, 'lime'],
  ['appointment-status', 'Status de agendamentos', 'Confirmados, realizados, cancelados e faltas', CheckCircle2, 'green'],
  ['product-category', 'Vendas por categoria', 'Participação de categorias e marcas no mix vendido', PieChart, 'fuchsia'],
  ['product-brand', 'Vendas por marca', 'Ranking de marcas por faturamento e quantidade', BarChart3, 'slate'],
  ['stock-alerts', 'Alertas de estoque', 'Produtos abaixo do mínimo e sem saldo disponível', AlertTriangle, 'red'],
  ['stock-by-store', 'Estoque por loja', 'Saldo físico, reservado e disponível por unidade', Store, 'blue'],
  ['stock-movements', 'Movimentações de estoque', 'Entradas, saídas, ajustes e reservas auditadas', History, 'amber'],
  ['reserved-stock', 'Reservas ativas', 'Unidades comprometidas e impacto no saldo disponível', Package, 'orange'],
  ['financial-summary', 'Resumo financeiro', 'Receitas estimadas nas vendas e concentração por período', Wallet, 'emerald'],
  ['average-ticket', 'Ticket médio', 'Ticket médio geral, por loja e por vendedor', Target, 'cyan'],
  ['sales-cancellation', 'Cancelamentos', 'Vendas canceladas e impacto no período', XCircle, 'rose'],
  ['os-revenue', 'Receita de O.S.', 'Valor das ordens de serviço e situação de pagamento', FileBarChart, 'violet'],
  ['customer-origin', 'Origem de clientes', 'Distribuição por loja e canal de cadastro', Users, 'indigo'],
  ['operator-activity', 'Atividade operacional', 'Responsáveis por vendas, O.S. e movimentações', History, 'pink'],
  ['targets', 'Metas e realizado', 'Acompanhamento do realizado contra metas gerenciais', Target, 'orange'],
  ['data-quality', 'Qualidade dos dados', 'Registros incompletos, sem preço, SKU ou vínculo', AlertTriangle, 'red'],
  ['executive-dashboard', 'Painel executivo', 'Visão consolidada para decisões rápidas', BarChart3, 'primary'],
  ['audit-export', 'Exportação gerencial', 'Consulta filtrada pronta para CSV e impressão', Download, 'slate'],
] as const;

const REPORT_GROUPS = [
  { id: 'commercial', title: 'Vendas e desempenho', description: 'Faturamento, produtos, lojas, vendedores e pagamentos.', ids: ['products-sold', 'store-sales', 'monthly-revenue', 'salesperson-performance', 'sales-by-period', 'sales-by-payment', 'product-category', 'product-brand', 'average-ticket', 'sales-cancellation'] },
  { id: 'service', title: 'Clientes e atendimento', description: 'Clientes, agenda, receitas e ordens de serviço.', ids: ['expired-prescriptions', 'customers-ranking', 'new-customers', 'os-status', 'os-deadlines', 'appointments', 'appointment-status', 'os-revenue', 'customer-origin'] },
  { id: 'inventory', title: 'Produtos e estoque', description: 'Giro, saldo, reservas, movimentações e qualidade cadastral.', ids: ['inventory-turnover', 'stock-alerts', 'stock-by-store', 'stock-movements', 'reserved-stock', 'data-quality'] },
  { id: 'management', title: 'Gestão e auditoria', description: 'Indicadores consolidados, metas, atividade e exportação.', ids: ['financial-summary', 'operator-activity', 'targets', 'executive-dashboard', 'audit-export'] },
] as const;

const colors = ['#ef5b2a', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#84cc16'];

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return false;
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(';'), ...rows.map(row => headers.map(header => escape(row[header])).join(';'))].join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); return true;
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [period, setPeriod] = useState('year');
  const [storeFilter, setStoreFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [featuredReportIds, setFeaturedReportIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem('reports-featured-v1');
      const parsed = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : ['sales-by-period', 'store-sales', 'products-sold', 'stock-alerts'];
    } catch { return ['sales-by-period', 'store-sales', 'products-sold', 'stock-alerts']; }
  });
  useEffect(() => { window.localStorage.setItem('reports-featured-v1', JSON.stringify(featuredReportIds)); }, [featuredReportIds]);
  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: serviceOrders = [], isLoading: soLoading } = useServiceOrders();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: appointments = [] } = useAppointments();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { selectedStoreIds, stores: globalStores } = useGlobalFilter();
  const selectedStoreIdSet = useMemo(() => new Set(selectedStoreIds.map(String)), [selectedStoreIds]);
  const reportStores = useMemo(() => globalStores
    .filter((store: any) => selectedStoreIdSet.has(String(store.id)))
    .map((store: any) => [store.id, store.name] as [string, string]), [globalStores, selectedStoreIdSet]);
  useEffect(() => {
    if (storeFilter !== 'all' && !selectedStoreIdSet.has(String(storeFilter))) setStoreFilter('all');
  }, [selectedStoreIdSet, storeFilter]);
  const periodStart = useMemo(() => { const d = new Date(); if (period === '7d') d.setDate(d.getDate() - 7); else if (period === '30d') d.setDate(d.getDate() - 30); else if (period === '90d') d.setDate(d.getDate() - 90); else if (period === 'month') d.setDate(1); else if (period === 'year') d.setMonth(0, 1); else return null; d.setHours(0, 0, 0, 0); return d; }, [period]);
  const previousPeriodStart = useMemo(() => { if (!periodStart) return null; const d = new Date(periodStart); if (period === 'month') d.setMonth(d.getMonth() - 1); else if (period === 'year') d.setFullYear(d.getFullYear() - 1); else if (period === '7d') d.setDate(d.getDate() - 7); else if (period === '30d') d.setDate(d.getDate() - 30); else if (period === '90d') d.setDate(d.getDate() - 90); return d; }, [period, periodStart]);
  const inGlobalStoreScope = (storeId: any) => isRecordInStoreScope({ storeId }, selectedStoreIds);
  const inScope = (item: any) => { const date = safeDate(item.created_at || item.createdAt || item.date || item.sale_date || item.scheduled_date); const storeId = item.storeId || item.store_id; return inGlobalStoreScope(storeId) && (!periodStart || (date && date >= periodStart)) && (storeFilter === 'all' || String(storeId) === String(storeFilter)); };
  const inPreviousScope = (item: any) => { const date = safeDate(item.created_at || item.createdAt || item.date || item.sale_date || item.scheduled_date); const storeId = item.storeId || item.store_id; return inGlobalStoreScope(storeId) && (!previousPeriodStart || (date && date >= previousPeriodStart && periodStart && date < periodStart)) && (storeFilter === 'all' || String(storeId) === String(storeFilter)); };
  const scopedSales = useMemo(() => sales.filter(inScope), [sales, periodStart, storeFilter, selectedStoreIdSet]);
  const filteredSales = useMemo(() => scopedSales.filter(isCompletedSale).filter((sale: any) => !search || `${sale.customerName} ${sale.sellerName}`.toLowerCase().includes(search.toLowerCase())), [scopedSales, search]);
  const previousSales = useMemo(() => sales.filter(inPreviousScope).filter(isCompletedSale), [sales, previousPeriodStart, periodStart, storeFilter, selectedStoreIdSet]);
  const cancelledSales = useMemo(() => scopedSales.filter(isCancelledSale), [scopedSales]);
  const filteredOS = useMemo(() => serviceOrders.filter(inScope), [serviceOrders, periodStart, storeFilter, selectedStoreIdSet]);
  const filteredAppointments = useMemo(() => appointments.filter(inScope), [appointments, periodStart, storeFilter, selectedStoreIdSet]);
  const revenue = useMemo(() => filteredSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0), [filteredSales]);
  const previousRevenue = useMemo(() => previousSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0), [previousSales]);
  const averageTicket = filteredSales.length ? revenue / filteredSales.length : 0;
  const previousAverageTicket = previousSales.length ? previousRevenue / previousSales.length : 0;
  const percentChange = (current: number, previous: number) => previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : undefined;
  const soldUnits = filteredSales.reduce((sum: number, sale: any) => sum + (sale.items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.qty || item.quantity || 0), 0), 0);
  const storePerformance = useMemo(() => { const map: Record<string, any> = {}; filteredSales.forEach((sale: any) => { const key = sale.storeName || sale.store_name || 'Sem loja'; if (!map[key]) map[key] = { store: key, revenue: 0, sales: 0 }; map[key].revenue += Number(sale.total || 0); map[key].sales += 1; }); return Object.values(map).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 8); }, [filteredSales]);
  const revenueByMonth = useMemo(() => { const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; const map: Record<string, number> = {}; filteredSales.forEach((sale: any) => { const date = safeDate(sale.created_at || sale.createdAt || sale.date); if (date) map[months[date.getMonth()]] = (map[months[date.getMonth()]] || 0) + Number(sale.total || 0); }); return months.map(month => ({ month, revenue: map[month] || 0 })); }, [filteredSales]);
  const paymentMix = useMemo(() => { const map: Record<string, number> = {}; filteredSales.forEach((sale: any) => { const key = sale.paymentMethod || sale.payment_method || 'Não informado'; map[key] = (map[key] || 0) + Number(sale.total || 0); }); return Object.entries(map).map(([name, value]) => ({ name, value })); }, [filteredSales]);
  const topPayment = useMemo(() => [...paymentMix].sort((a: any, b: any) => Number(b.value) - Number(a.value))[0], [paymentMix]);
  const productById = useMemo(() => new Map<string, any>(products.map((product: any) => [String(product.id), product])), [products]);
  const filteredCustomers = useMemo(() => customers.filter((customer: any) => inGlobalStoreScope(customer.storeId || customer.store_id)), [customers, selectedStoreIdSet]);
  const scopedStockFor = (product: any) => getScopedStockRecords(product, selectedStoreIds);
  const productMix = useMemo(() => { const map: Record<string, any> = {}; filteredSales.forEach((sale: any) => (sale.items || []).forEach((item: any) => { const product = productById.get(String(item.productId)); const key = item.product || product?.name || 'Produto sem nome'; if (!map[key]) map[key] = { name: key, revenue: 0, units: 0, category: product?.category || 'Sem categoria', brand: product?.brand || 'Sem marca' }; map[key].revenue += Number(item.total || item.total_price || 0); map[key].units += Number(item.qty || item.quantity || 0); })); return Object.values(map).sort((a: any, b: any) => b.revenue - a.revenue); }, [filteredSales, productById]);
  const categoryMix = useMemo(() => { const map: Record<string, any> = {}; productMix.forEach((item: any) => { const key = item.category || 'Sem categoria'; if (!map[key]) map[key] = { name: key, revenue: 0, units: 0 }; map[key].revenue += item.revenue; map[key].units += item.units; }); return Object.values(map).sort((a: any, b: any) => b.revenue - a.revenue); }, [productMix]);
  const brandMix = useMemo(() => { const map: Record<string, any> = {}; productMix.forEach((item: any) => { const key = item.brand || 'Sem marca'; if (!map[key]) map[key] = { name: key, revenue: 0, units: 0 }; map[key].revenue += item.revenue; map[key].units += item.units; }); return Object.values(map).sort((a: any, b: any) => b.revenue - a.revenue); }, [productMix]);
  const sellerMix = useMemo(() => { const map: Record<string, any> = {}; filteredSales.forEach((sale: any) => { const key = sale.sellerName || 'Sem vendedor'; if (!map[key]) map[key] = { name: key, revenue: 0, sales: 0 }; map[key].revenue += Number(sale.total || 0); map[key].sales += 1; }); return Object.values(map).sort((a: any, b: any) => b.revenue - a.revenue); }, [filteredSales]);
  const inventoryAlerts = useMemo(() => products.filter((product: any) => { const stocks = scopedStockFor(product); if (!stocks.length) return false; const total = stocks.reduce((sum: number, stock: any) => sum + Number(stock.quantity || 0), 0); return total <= Number(product.minimum_stock || product.min_stock || 0); }), [products, selectedStoreIdSet]);
  const activeTitle = REPORTS.find(report => report[0] === activeReport)?.[1] || '';
  const featuredReports = useMemo(() => REPORTS.filter(report => featuredReportIds.includes(report[0])), [featuredReportIds]);
  const secondaryReports = useMemo(() => REPORTS.filter(report => !featuredReportIds.includes(report[0])), [featuredReportIds]);
  const visibleReportGroups = useMemo(() => REPORT_GROUPS.map(group => ({ ...group, reports: REPORTS.filter(report => group.ids.includes(report[0] as never) && (!reportSearch.trim() || `${report[1]} ${report[2]}`.toLowerCase().includes(reportSearch.trim().toLowerCase()))) })).filter(group => group.reports.length > 0), [reportSearch]);
  const loading = salesLoading || soLoading || customersLoading || productsLoading;

  const genericRows = useMemo(() => {
    const id = activeReport;
    if (id === 'products-sold') return productMix.slice(0, 100).map((row: any) => ({ Produto: row.name, Categoria: row.category, Marca: row.brand, Unidades: row.units, Faturamento: money(row.revenue) }));
    if (id === 'store-sales') return storePerformance.map((row: any) => ({ Loja: row.store, Vendas: row.sales, Faturamento: money(row.revenue), 'Ticket médio': money(row.sales ? row.revenue / row.sales : 0) }));
    if (id === 'salesperson-performance') return sellerMix.slice(0, 100).map((row: any) => ({ Vendedor: row.name, Vendas: row.sales, Faturamento: money(row.revenue), 'Ticket médio': money(row.sales ? row.revenue / row.sales : 0) }));
    if (id === 'sales-by-period' || id === 'monthly-revenue') return revenueByMonth.map(row => ({ Período: row.month, Faturamento: money(row.revenue) }));
    if (id === 'inventory-turnover') return products.filter((product: any) => scopedStockFor(product).length > 0).slice(0, 100).map((product: any) => { const stocks = scopedStockFor(product); const stock = stocks.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0); const reserved = stocks.reduce((sum: number, item: any) => sum + Number(item.reserved_quantity || 0), 0); const sold = productMix.find((item: any) => item.name === product.name)?.units || 0; return { Produto: product.name || 'Sem nome', Vendidos: sold, 'Estoque físico': stock, Reservado: reserved, Disponível: Math.max(stock - reserved, 0), Situação: stock <= Number(product.minimum_stock || product.min_stock || 0) ? 'Repor' : sold > 0 ? 'Com giro' : 'Sem giro no período' }; });
    if (id === 'sales-by-payment') return paymentMix.map(row => ({ Método: row.name, Total: money(row.value), Participação: revenue ? `${((row.value / revenue) * 100).toFixed(1)}%` : '0%' }));
    if (id === 'customers-ranking') { const map: Record<string, any> = {}; filteredSales.forEach((sale: any) => { const key = sale.customerName || 'Cliente avulso'; if (!map[key]) map[key] = { Cliente: key, Vendas: 0, Total: 0 }; map[key].Vendas++; map[key].Total += Number(sale.total || 0); }); return Object.values(map).sort((a: any, b: any) => b.Total - a.Total).slice(0, 50).map((row: any) => ({ ...row, Total: money(row.Total) })); }
    if (id === 'os-status') { const map: Record<string, number> = {}; filteredOS.forEach((os: any) => { const key = os.status || 'Sem status'; map[key] = (map[key] || 0) + 1; }); return Object.entries(map).map(([Status, Quantidade]) => ({ Status, Quantidade })); }
    if (id === 'product-category') return categoryMix.slice(0, 100).map((row: any) => ({ Categoria: row.name, Unidades: row.units, Faturamento: money(row.revenue), Participação: revenue ? `${((row.revenue / revenue) * 100).toFixed(1)}%` : '0%' }));
    if (id === 'product-brand') return brandMix.slice(0, 100).map((row: any) => ({ Marca: row.name, Unidades: row.units, Faturamento: money(row.revenue), Participação: revenue ? `${((row.revenue / revenue) * 100).toFixed(1)}%` : '0%' }));
    if (id === 'average-ticket') return storePerformance.map((row: any) => ({ Loja: row.store, Vendas: row.sales, 'Ticket médio': money(row.sales ? row.revenue / row.sales : 0) }));
    if (id === 'sales-cancellation') return cancelledSales.map((sale: any) => ({ Data: dateOnly(sale.created_at || sale.createdAt || sale.date), Cliente: sale.customerName || 'Cliente avulso', Total: money(sale.total), Motivo: sale.cancellation_reason || sale.reason || 'Não informado' }));
    if (id === 'os-revenue') return filteredOS.map((os: any) => ({ Cliente: os.customerName, Data: dateOnly(os.date || os.created_at), Total: money(os.total), Pago: money(os.paidAmount), Saldo: money(os.balance), Status: os.financialStatus || os.status || '—' }));
    if (id === 'reserved-stock') return products.filter((product: any) => scopedStockFor(product).length > 0).slice(0, 100).flatMap((product: any) => scopedStockFor(product).filter((stock: any) => Number(stock.reserved_quantity || 0) > 0).map((stock: any) => ({ Produto: product.name, Loja: stock.store_name || stock.store_id, Reservado: stock.reserved_quantity || 0, Disponível: Math.max(Number(stock.quantity || 0) - Number(stock.reserved_quantity || 0), 0) })));
    if (id === 'financial-summary') return [{ Período: period === 'all' ? 'Todo o histórico' : period, Faturamento: money(revenue), 'Ticket médio': money(averageTicket), 'Vendas': filteredSales.length, 'O.S.': filteredOS.length }];
    if (id === 'stock-alerts') return inventoryAlerts.slice(0, 100).map((product: any) => ({ Produto: product.name, SKU: product.sku || '—', 'Estoque mínimo': product.minimum_stock || product.min_stock || 0 }));
    if (id === 'stock-by-store') return products.filter((product: any) => scopedStockFor(product).length > 0).slice(0, 100).flatMap((product: any) => scopedStockFor(product).map((stock: any) => ({ Produto: product.name, Loja: stock.store_name || stock.store_id, Físico: stock.quantity || 0, Reservado: stock.reserved_quantity || 0, Disponível: Math.max(Number(stock.quantity || 0) - Number(stock.reserved_quantity || 0), 0) })));
    if (id === 'new-customers') return filteredCustomers.slice(0, 100).map((customer: any) => ({ Cliente: customer.name, Cadastro: dateOnly(customer.created_at), Loja: customer.storeName || customer.store_name || '—' }));
    if (id === 'appointments' || id === 'appointment-status') return filteredAppointments.slice(0, 100).map((appointment: any) => ({ Cliente: appointment.customerName, Data: dateOnly(appointment.date || appointment.scheduled_date), Status: appointment.status || '—', Profissional: appointment.professional || appointment.professional_name || '—' }));
    if (id === 'data-quality') return products.filter((product: any) => scopedStockFor(product).length > 0 && (!product.name || !product.sku || !product.price)).slice(0, 100).map((product: any) => ({ Produto: product.name || 'Sem nome', SKU: product.sku || 'Ausente', Preço: product.price ? money(product.price) : 'Ausente' }));
    return filteredSales.slice(0, 100).map((sale: any) => ({ Data: dateOnly(sale.created_at || sale.createdAt || sale.date), Cliente: sale.customerName || 'Cliente avulso', Loja: sale.storeName || '—', Total: money(sale.total), Vendedor: sale.sellerName || '—' }));
  }, [activeReport, revenueByMonth, paymentMix, productMix, categoryMix, brandMix, sellerMix, revenue, averageTicket, filteredSales, cancelledSales, filteredOS, filteredAppointments, inventoryAlerts, products, filteredCustomers, storePerformance, period, selectedStoreIdSet]);

  const exportActive = () => { if (!activeReport) return; const ok = downloadCsv(`relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.csv`, genericRows as any); if (ok) toast.success('Relatório exportado em CSV.'); else toast.error('Não há dados para exportar com os filtros atuais.'); };
  const renderReportContent = () => {
    if (activeReport === 'expired-prescriptions') { const withPrescription = filteredOS.filter((os: any) => os.prescription?.rightEye?.sph || os.prescription?.leftEye?.sph); return withPrescription.length ? <ReportTable rows={withPrescription.slice(0, 100).map((os: any) => ({ Cliente: os.customerName, 'Data OS': dateOnly(os.date), 'OD Esf': os.prescription?.rightEye?.sph || '—', 'OE Esf': os.prescription?.leftEye?.sph || '—', Status: os.status || '—' }))} /> : <EmptyState icon={Clock3} title="Nenhuma prescrição encontrada" description="Não há ordens com dados de prescrição nos filtros atuais." />; }
    return genericRows.length ? <ReportTable rows={genericRows as any} /> : <EmptyState icon={FileText} title="Nenhum dado encontrado" description="Ajuste os filtros ou registre operações para gerar este relatório." />;
  };

  const renderFeaturedChart = (id: string) => {
    if (id === 'sales-by-period') return <ResponsiveContainer width="100%" height={220}><AreaChart data={revenueByMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => money(value)} /><Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} strokeWidth={3} /></AreaChart></ResponsiveContainer>;
    if (id === 'store-sales') return <ResponsiveContainer width="100%" height={220}><BarChart data={storePerformance.slice(0, 6)} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="store" width={90} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => money(value)} /><Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer>;
    if (id === 'products-sold') return <ResponsiveContainer width="100%" height={220}><BarChart data={productMix.slice(0, 6)} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><Tooltip formatter={(value: number) => money(value)} /><Bar dataKey="revenue" fill="#10b981" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer>;
    if (id === 'sales-by-payment') return <div className="flex h-[220px] items-center gap-5"><ResponsiveContainer width="55%" height={210}><RechartsPie><Pie data={paymentMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3}>{paymentMix.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value: number) => money(value)} /></RechartsPie></ResponsiveContainer><div className="min-w-0 flex-1 space-y-2">{paymentMix.slice(0, 5).map((entry, index) => <div key={entry.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="truncate">{entry.name}</span></span><strong>{revenue ? `${((Number(entry.value) / revenue) * 100).toFixed(0)}%` : '0%'}</strong></div>)}{!paymentMix.length && <p className="text-xs text-muted-foreground">Sem dados.</p>}</div></div>;
    if (id === 'salesperson-performance') return <ResponsiveContainer width="100%" height={220}><BarChart data={sellerMix.slice(0, 6)}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => money(value)} /><Bar dataKey="revenue" fill="#0ea5e9" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer>;
    if (id === 'stock-alerts') return <div className="space-y-2 py-1">{inventoryAlerts.slice(0, 5).map((product: any) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl bg-rose-500/[0.06] px-3 py-2"><span className="min-w-0 truncate text-xs font-semibold">{product.name || 'Produto sem nome'}</span><Badge variant="outline" className="shrink-0 border-rose-500/30 text-[10px] text-rose-600">Reposição</Badge></div>)}{!inventoryAlerts.length && <div className="rounded-xl bg-emerald-500/[0.06] p-4 text-center text-xs text-emerald-700">Nenhum alerta no filtro atual.</div>}</div>;
    return <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 text-center text-xs text-muted-foreground">Este relatório está disponível em formato detalhado. Abra-o para consultar a tabela completa.</div>;
  };

  return (
    <div className="reports-page space-y-5">
      <header className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-primary"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10"><BarChart3 className="h-4 w-4" /></span><span className="text-[10px] font-bold uppercase tracking-[0.22em]">Inteligência operacional</span></div>
          <h1 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">Relatórios e métricas</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">Acompanhe o desempenho da operação, aprofunde análises e exporte informações com os mesmos filtros.</p>
        </div>
        <div className="flex shrink-0 gap-2"><Button variant={showFilters ? 'secondary' : 'outline'} size="sm" className="h-9 gap-2 rounded-lg" onClick={() => setShowFilters(value => !value)}><Filter className="h-3.5 w-3.5" /> {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}</Button><Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg" onClick={() => window.location.reload()}><RefreshCw className="h-3.5 w-3.5" /> Atualizar</Button></div>
      </header>

      <FinancialInfoTip className="px-3 py-2.5" title="Dica de análise">Compare sempre períodos equivalentes e mantenha a mesma seleção de lojas antes de concluir uma tendência. Exportações e impressões respeitam os filtros ativos.</FinancialInfoTip>

      {showFilters && <section className="hidden rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:block">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex shrink-0 items-center gap-2 xl:w-[185px]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Filter className="h-3.5 w-3.5" /></span><div><p className="text-xs font-bold">Filtros do painel</p><p className="text-[10px] text-muted-foreground">Aplicados a toda a página</p></div></div>
          <div className="hidden h-8 w-px bg-border xl:block" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><Button type="button" variant={period === '7d' ? 'default' : 'outline'} size="sm" className="h-8 rounded-lg px-2.5 text-[10px]" onClick={() => setPeriod('7d')}>7 dias</Button><Button type="button" variant={period === '30d' ? 'default' : 'outline'} size="sm" className="h-8 rounded-lg px-2.5 text-[10px]" onClick={() => setPeriod('30d')}>30 dias</Button><Button type="button" variant={period === 'month' ? 'default' : 'outline'} size="sm" className="h-8 rounded-lg px-2.5 text-[10px]" onClick={() => setPeriod('month')}>Este mês</Button><Button type="button" variant={period === 'year' ? 'default' : 'outline'} size="sm" className="h-8 rounded-lg px-2.5 text-[10px]" onClick={() => setPeriod('year')}>Este ano</Button></div>
          <div className="grid min-w-0 flex-[2] gap-2 sm:grid-cols-[150px_170px_minmax(210px,1fr)_auto]"><Select value={period} onValueChange={setPeriod}><SelectTrigger aria-label="Período" className="h-9 rounded-lg bg-background text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7d">Últimos 7 dias</SelectItem><SelectItem value="30d">Últimos 30 dias</SelectItem><SelectItem value="90d">Últimos 90 dias</SelectItem><SelectItem value="month">Este mês</SelectItem><SelectItem value="year">Este ano</SelectItem><SelectItem value="all">Todo o histórico</SelectItem></SelectContent></Select><Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger aria-label="Loja" className="h-9 rounded-lg bg-background text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas selecionadas</SelectItem>{reportStores.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}</SelectContent></Select><div className="relative"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input aria-label="Busca contextual" className="h-9 rounded-lg bg-background pl-9 text-xs" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente ou vendedor..." /></div><Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg px-3 text-xs text-muted-foreground" onClick={() => { setPeriod('year'); setStoreFilter('all'); setSearch(''); }}>Limpar</Button></div>
        </div>
      </section>}

      <div className="flex items-center gap-2 lg:hidden">
        <MobileFiltersButton activeCount={(period !== 'year' ? 1 : 0) + (storeFilter !== 'all' ? 1 : 0) + (search ? 1 : 0)} onClick={() => setMobileFiltersOpen(true)} className="flex-1" />
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl px-3 text-xs" onClick={() => setShowFilters(value => !value)}>{showFilters ? 'Ocultar' : 'Mostrar'} desktop</Button>
      </div>

      <MobileFiltersDialog
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        title="Filtros dos relatórios"
        description="Esses filtros atualizam os indicadores, gráficos e relatórios detalhados."
        activeCount={(period !== 'year' ? 1 : 0) + (storeFilter !== 'all' ? 1 : 0) + (search ? 1 : 0)}
        onClear={() => { setPeriod('year'); setStoreFilter('all'); setSearch(''); }}
      >
        <div className="space-y-4">
          <MobileFilterField label="Período">
            <Select value={period} onValueChange={setPeriod}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7d">Últimos 7 dias</SelectItem><SelectItem value="30d">Últimos 30 dias</SelectItem><SelectItem value="90d">Últimos 90 dias</SelectItem><SelectItem value="month">Este mês</SelectItem><SelectItem value="year">Este ano</SelectItem><SelectItem value="all">Todo o histórico</SelectItem></SelectContent></Select>
          </MobileFilterField>
          <MobileFilterField label="Loja">
            <Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas selecionadas</SelectItem>{reportStores.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}</SelectContent></Select>
          </MobileFilterField>
          <MobileFilterField label="Busca contextual">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Busca contextual" className="h-11 rounded-xl pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente ou vendedor..." /></div>
          </MobileFilterField>
        </div>
      </MobileFiltersDialog>

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Faturamento', value: money(revenue), helper: percentChange(revenue, previousRevenue) === undefined ? 'Sem base anterior' : `${percentChange(revenue, previousRevenue)}% vs. anterior`, Icon: Wallet, tone: 'bg-emerald-500/10 text-emerald-600' },
          { label: 'Vendas', value: number(filteredSales.length), helper: percentChange(filteredSales.length, previousSales.length) === undefined ? 'Sem base anterior' : `${percentChange(filteredSales.length, previousSales.length)}% vs. anterior`, Icon: ShoppingBag, tone: 'bg-blue-500/10 text-blue-600' },
          { label: 'Ticket médio', value: money(averageTicket), helper: 'Valor por venda', Icon: Target, tone: 'bg-amber-500/10 text-amber-600' },
          { label: 'Itens vendidos', value: number(soldUnits), helper: 'Unidades no período', Icon: Package, tone: 'bg-cyan-500/10 text-cyan-600' },
          { label: 'Ordens de serviço', value: number(filteredOS.length), helper: 'O.S. no período', Icon: FileText, tone: 'bg-orange-500/10 text-orange-600' },
          { label: 'Alertas de estoque', value: number(inventoryAlerts.length), helper: 'Precisam de atenção', Icon: AlertTriangle, tone: 'bg-rose-500/10 text-rose-600' },
        ].map(({ label, value, helper, Icon, tone }) => <Card key={label} className="border-border/70 shadow-sm"><CardContent className="p-3.5"><div className="flex items-start justify-between gap-2"><div className={cn('grid h-8 w-8 place-items-center rounded-lg', tone)}><Icon className="h-3.5 w-3.5" /></div><span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span></div><p className="mt-3 truncate text-lg font-black tracking-tight">{value}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{helper}</p></CardContent></Card>)}
      </section>

      {loading ? <LoadingSpinner message="Consolidando dados dos relatórios..." /> : <>
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
          <Card className="overflow-hidden border-border/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 px-4 py-3"><div><CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4 text-emerald-600" /> Evolução do faturamento</CardTitle><p className="mt-0.5 text-[10px] text-muted-foreground">Receita consolidada ao longo do ano</p></div><Badge variant="outline" className="font-normal">{filteredSales.length} vendas</Badge></CardHeader><CardContent className="p-3 pt-4"><ResponsiveContainer width="100%" height={285}><AreaChart data={revenueByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="reportsRevenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.32} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={42} /><Tooltip formatter={(value: number) => money(value)} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 11 }} /><Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#reportsRevenueGradient)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></CardContent></Card>
          <Card className="border-border/70 shadow-sm"><CardHeader className="border-b border-border/60 px-4 py-3"><CardTitle className="flex items-center gap-2 text-sm"><Store className="h-4 w-4 text-primary" /> Desempenho por loja</CardTitle><p className="mt-0.5 text-[10px] text-muted-foreground">Participação no faturamento filtrado</p></CardHeader><CardContent className="space-y-3 p-4">{storePerformance.slice(0, 5).map((row: any, index: number) => { const leader = Number(storePerformance[0]?.revenue || 0); const share = leader > 0 ? (Number(row.revenue || 0) / leader) * 100 : 0; return <button key={row.store} type="button" onClick={() => setActiveReport('store-sales')} className="group block w-full text-left"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-muted text-[9px] font-bold text-muted-foreground">{index + 1}</span><span className="truncate font-semibold group-hover:text-primary">{row.store}</span></span><strong>{money(row.revenue)}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(share, row.revenue ? 4 : 0)}%` }} /></div></button>; })}{storePerformance.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">Nenhuma venda para comparar.</p>}<Button variant="outline" size="sm" className="mt-1 h-8 w-full gap-2 rounded-lg text-xs" onClick={() => setActiveReport('store-sales')}>Ver relatório por loja <ArrowRight className="h-3.5 w-3.5" /></Button></CardContent></Card>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><Star className="h-4 w-4 fill-primary text-primary" /><h2 className="text-sm font-bold">Relatórios em destaque</h2><Badge variant="secondary" className="text-[10px]">{featuredReports.length}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Seus atalhos mais importantes, acompanhados sem sair da página.</p></div><Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg text-xs" onClick={() => setIsConfigOpen(true)}><Settings2 className="h-3.5 w-3.5" /> Organizar destaques</Button></div>
          <div className="grid gap-3 lg:grid-cols-2">{featuredReports.map(([id, title, description, Icon]) => <Card key={id} className="overflow-hidden border-border/70 shadow-sm transition-colors hover:border-primary/40"><CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border/50 px-4 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><CardTitle className="truncate text-sm">{title}</CardTitle><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{description}</p></div></div><Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-md px-2 text-[10px]" onClick={() => setActiveReport(id)}>Abrir <ArrowRight className="ml-1 h-3 w-3" /></Button></CardHeader><CardContent className="p-3">{renderFeaturedChart(id)}</CardContent></Card>)}</div>{featuredReports.length === 0 && <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum relatório destacado. Use <strong>Organizar destaques</strong> para montar seu painel.</CardContent></Card>}
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><FileBarChart className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Biblioteca de relatórios</h2><Badge variant="secondary" className="text-[10px]">{REPORTS.length} disponíveis</Badge></div><p className="mt-1 text-xs text-muted-foreground">Encontre análises por área, sem uma grade interminável de cards iguais.</p></div><div className="relative w-full sm:w-[300px]"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="h-9 rounded-lg bg-card pl-9 text-xs" value={reportSearch} onChange={event => setReportSearch(event.target.value)} placeholder="Localizar relatório..." /></div></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{visibleReportGroups.map(group => <Card key={group.id} className="overflow-hidden border-border/70 shadow-sm"><CardHeader className="border-b border-border/50 px-4 py-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm">{group.title}</CardTitle><Badge variant="outline" className="text-[9px] font-normal">{group.reports.length}</Badge></div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{group.description}</p></CardHeader><CardContent className="divide-y divide-border/50 p-0">{group.reports.map(([id, title, description, Icon]) => <button key={id} type="button" onClick={() => setActiveReport(id)} className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground group-hover:text-primary"><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold group-hover:text-primary">{title}</span><span className="mt-0.5 block truncate text-[9px] text-muted-foreground">{description}</span></span><ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></button>)}</CardContent></Card>)}</div>{visibleReportGroups.length === 0 && <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum relatório corresponde a “{reportSearch}”.</CardContent></Card>}
        </section>
      </>}

      <ReportModal open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)} title={activeTitle} onPrint={() => window.print()} onExport={exportActive}>{activeReport && <div className="space-y-4"><FinancialInfoTip className="py-2" title="Dica do relatório">Os dados seguem os filtros da página. Use Exportar para baixar a tabela atual em CSV ou Imprimir para gerar uma cópia gerencial.</FinancialInfoTip><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[{ label: 'Registros', value: number(genericRows.length), Icon: FileText }, { label: 'Faturamento', value: money(revenue), Icon: Wallet }, { label: 'Vendas', value: number(filteredSales.length), Icon: ShoppingBag }, { label: 'O.S.', value: number(filteredOS.length), Icon: FileBarChart }].map(({ label, value, Icon }) => <div key={label} className="rounded-xl border border-border/60 bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><Icon className="h-3.5 w-3.5 text-primary" /></div><p className="mt-2 truncate text-base font-black">{value}</p></div>)}</div>{renderReportContent()}</div>}</ReportModal>
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}><DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-[620px]"><DialogHeader className="space-y-1"><DialogTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-4 w-4 text-primary" /> Organizar destaques</DialogTitle><DialogDescription className="text-xs">Marque até seis relatórios para acompanhá-los diretamente na página principal.</DialogDescription></DialogHeader><FinancialInfoTip className="py-2" title="Dica de prioridade">Priorize o que sua equipe consulta diariamente. Todos os relatórios continuam disponíveis na biblioteca.</FinancialInfoTip><div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs"><span className="font-semibold">Relatórios selecionados</span><Badge variant={featuredReportIds.length >= 6 ? 'default' : 'secondary'}>{featuredReportIds.length}/6</Badge></div><div className="grid gap-2 sm:grid-cols-2">{REPORTS.map(([id, title, description, Icon]) => { const checked = featuredReportIds.includes(id); const disabled = !checked && featuredReportIds.length >= 6; return <label key={id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', checked ? 'border-primary/40 bg-primary/[0.05]' : 'border-border/60 hover:bg-muted/30', disabled && 'cursor-not-allowed opacity-50')}><input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={checked} disabled={disabled} onChange={() => setFeaturedReportIds(current => checked ? current.filter(reportId => reportId !== id) : [...current, id])} /><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-bold">{title}</span><span className="mt-0.5 block line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{description}</span></span></label>; })}</div><DialogFooter className="flex-row justify-between sm:justify-between"><Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setFeaturedReportIds(['sales-by-period', 'store-sales', 'products-sold', 'stock-alerts'])}>Restaurar padrão</Button><Button type="button" size="sm" className="text-xs" onClick={() => setIsConfigOpen(false)}>Concluir</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function ReportTable({ rows }: { rows: Record<string, any>[] }) {
  const headers = Object.keys(rows[0] || {});
  const [sortKey, setSortKey] = useState(headers[0] || '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const sortedRows = useMemo(() => [...rows].sort((left, right) => { const a = String(left[sortKey] ?? ''); const b = String(right[sortKey] ?? ''); const numericA = Number(a.replace(/[^0-9,-]/g, '').replace(',', '.')); const numericB = Number(b.replace(/[^0-9,-]/g, '').replace(',', '.')); const comparison = Number.isNaN(numericA) || Number.isNaN(numericB) ? a.localeCompare(b, 'pt-BR') : numericA - numericB; return sortDirection === 'asc' ? comparison : -comparison; }), [rows, sortKey, sortDirection]);
  const toggleSort = (key: string) => { if (sortKey === key) setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDirection('desc'); } };
  return <div className="overflow-hidden rounded-xl border border-border/60"><div className="max-h-[55vh] overflow-auto"><Table><TableHeader><TableRow className="bg-muted/40">{headers.map(header => <TableHead key={header} className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider"><button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => toggleSort(header)}>{header}{sortKey === header && <span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</button></TableHead>)}</TableRow></TableHeader><TableBody>{sortedRows.map((row, index) => <TableRow key={index} className="border-border/40">{headers.map(header => <TableCell key={header} className="whitespace-nowrap text-xs">{String(row[header] ?? '—')}</TableCell>)}</TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground"><span>Ordene por qualquer coluna clicando no cabeçalho.</span><span>{rows.length} registro(s)</span></div></div>;
}

