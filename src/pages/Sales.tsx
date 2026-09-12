import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Banknote, Calendar, Check, ChevronDown, CreditCard, FileCheck, FileText, Filter, LayoutGrid, List, Loader2, Minus, Package, Pencil, Plus, Printer, Receipt, RefreshCw, Search, ShoppingCart, Smartphone, Store, Tag, Trash2, User, UserPlus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SalePrint } from '@/components/sales/SalePrint';
import { CustomerSelector } from '@/components/shared/CustomerSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useCustomers, useEmployees, useProducts, useSales, useServiceOrders } from '@/hooks/useLocalData';
import { localApi } from '@/lib/localApi';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const PAYMENT_METHODS: Record<string, { label: string; short: string; icon: typeof CreditCard }> = {
  credit: { label: 'Cartão de crédito', short: 'Crédito', icon: CreditCard },
  debit: { label: 'Cartão de débito', short: 'Débito', icon: CreditCard },
  cash: { label: 'Dinheiro', short: 'Dinheiro', icon: Banknote },
  pix: { label: 'PIX', short: 'PIX', icon: Smartphone },
  check: { label: 'Cheque', short: 'Cheque', icon: FileCheck },
  transfer: { label: 'Transferência', short: 'Transferência', icon: Receipt },
};

const HIGH_VALUE_SALE_LIMIT = 10000;

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluída',
  pending: 'Pendente',
  cancelled: 'Cancelada',
};

type ViewMode = 'table' | 'cards';
type SaleStep = 1 | 2 | 3;

type NewSale = {
  customerMode: 'registered' | 'walk_in';
  customerId: string;
  guestName: string;
  sellerId: string;
  storeId: string;
  date: string;
  paymentMethod: string;
  paymentNote: string;
  dueDate: string;
  installments: string;
  discountType: 'none' | 'percent' | 'value';
  discountAmount: string;
  linkedOsId: string;
  notes: string;
};

type SaleItem = {
  id: string;
  name: string;
  sku?: string;
  price: number;
  qty: number;
  manual?: boolean;
};

const createManualItemId = () => `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const localDateIso = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatBusinessDate = (value?: string | null) => {
  if (!value) return '—';
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pt-BR');
};

const currency = (value: unknown) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const saleStatusLabel = (status?: string | null) => STATUS_LABELS[String(status || '')] || String(status || 'Sem status');

const createBlankSale = (storeId: string, sellerId: string): NewSale => ({
  customerMode: 'registered',
  customerId: '',
  guestName: '',
  sellerId,
  storeId,
  date: localDateIso(),
  paymentMethod: 'credit',
  paymentNote: '',
  dueDate: localDateIso(),
  installments: '1',
  discountType: 'none',
  discountAmount: '',
  linkedOsId: '',
  notes: '',
});

export default function Sales() {
  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: employees = [] } = useEmployees();
  const { data: serviceOrders = [] } = useServiceOrders();
  const { selectedCompanyId, selectedStoreIds, stores, companies } = useGlobalFilter();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const isLoading = salesLoading || customersLoading || productsLoading;
  const availableStores = useMemo(() => stores.filter((store: any) => selectedStoreIds.length === 0 || selectedStoreIds.includes(store.id)), [stores, selectedStoreIds]);
  const sellers = useMemo(() => employees.filter((employee: any) => employee.status !== 'inactive'), [employees]);
  const defaultSellerId = sellers.find((seller: any) => seller.id === user?.id)?.id || sellers[0]?.id || '';

  const [searchValue, setSearchValue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSeller, setFilterSeller] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStore, setFilterStore] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 'cards' : 'table');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [selectedCustomerPreview, setSelectedCustomerPreview] = useState<any>(null);
  const [financialEntry, setFinancialEntry] = useState<any>(null);
  const [isPreparingFiscal, setIsPreparingFiscal] = useState(false);

  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [saleStep, setSaleStep] = useState<SaleStep>(1);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [newSale, setNewSale] = useState<NewSale>(() => createBlankSale('', ''));
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('all');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false);
  const [highValueConfirmOpen, setHighValueConfirmOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', whatsapp: '', cpf: '' });
  const [manualMode, setManualMode] = useState(false);
  const [manualItem, setManualItem] = useState({ description: '', reference: '', qty: '1', price: '' });

  const canCreate = hasPermission('sales', 'create');
  const canCancel = hasPermission('sales', 'edit');
  const canPrint = hasPermission('sales', 'print') || hasPermission('sales', 'view');
  const canChangeSeller = user?.role === 'admin' || user?.role === 'admin_master' || hasPermission('sales', 'edit');
  const canDiscount = hasPermission('sales', 'edit') || user?.role === 'admin' || user?.role === 'admin_master';
  const canViewFinancial = hasPermission('financial', 'view');
  const selectedCustomer = newSale.customerMode === 'registered' ? customers.find((customer: any) => customer.id === newSale.customerId) : undefined;
  const customerOrders = useMemo(() => newSale.customerMode === 'registered' && newSale.customerId ? serviceOrders.filter((order: any) => order.customerId === newSale.customerId) : [], [serviceOrders, newSale.customerMode, newSale.customerId]);

  const prepareFiscalDocument = async (type: 'NF-e' | 'NFC-e' = 'NFC-e') => {
    if (!selectedSale) return;
    if (!hasPermission('fiscal', 'create')) {
      toast.error('Você não possui permissão para preparar documento fiscal.');
      return;
    }
    setIsPreparingFiscal(true);
    const result = await localApi.fiscal.createFromSale(String(selectedSale.id), type);
    setIsPreparingFiscal(false);
    if (result.error || !result.data) {
      toast.error(result.error?.message || 'Não foi possível preparar o documento fiscal.');
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['fiscal-documents'] });
    toast.success('Rascunho fiscal criado e vinculado à venda. Estoque e Financeiro não foram duplicados.');
  };

  const subtotal = useMemo(() => saleItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0), [saleItems]);
  const discountValue = useMemo(() => {
    if (!canDiscount || newSale.discountType === 'none' || !newSale.discountAmount) return 0;
    const amount = Number(String(newSale.discountAmount).replace(',', '.')) || 0;
    if (newSale.discountType === 'percent') return Math.min(subtotal, Math.max(0, subtotal * (amount / 100)));
    return Math.min(subtotal, Math.max(0, amount));
  }, [canDiscount, newSale.discountType, newSale.discountAmount, subtotal]);
  const total = Math.max(0, subtotal - discountValue);

  const filteredSales = useMemo(() => {
    const search = searchValue.trim().toLowerCase();
    return sales.filter((sale: any) => {
      const paymentMethod = String(sale.payment_method || sale.paymentMethod || '');
      const saleDate = String(sale.date || '').slice(0, 10);
      const searchable = [sale.id, sale.customerName, sale.customerNickname, sale.customerDocument, sale.sellerName, sale.storeName, paymentMethod, PAYMENT_METHODS[paymentMethod]?.label].filter(Boolean).join(' ').toLowerCase();
      return (filterStore === 'all' || sale.storeId === filterStore)
        && (filterSeller === 'all' || sale.sellerId === filterSeller)
        && (filterStatus === 'all' || sale.status === filterStatus)
        && (filterPayment === 'all' || paymentMethod === filterPayment)
        && (!search || searchable.includes(search))
        && (!dateFrom || saleDate >= dateFrom)
        && (!dateTo || saleDate <= dateTo);
    });
  }, [sales, searchValue, filterStore, filterSeller, filterStatus, filterPayment, dateFrom, dateTo]);

  const sortedSales = useMemo(() => [...filteredSales].sort((first: any, second: any) => {
    if (sortBy === 'value_desc') return Number(second.total || 0) - Number(first.total || 0);
    if (sortBy === 'value_asc') return Number(first.total || 0) - Number(second.total || 0);
    if (sortBy === 'customer') return String(first.customerName || '').localeCompare(String(second.customerName || ''), 'pt-BR');
    if (sortBy === 'status') return saleStatusLabel(first.status).localeCompare(saleStatusLabel(second.status), 'pt-BR');
    return String(second.date || '').localeCompare(String(first.date || ''));
  }), [filteredSales, sortBy]);

  const stats = useMemo(() => {
    const completed = filteredSales.filter((sale: any) => sale.status === 'completed');
    const revenue = completed.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
    const discounts = filteredSales.reduce((sum: number, sale: any) => sum + Number(sale.discount || 0), 0);
    const itemCount = filteredSales.reduce((sum: number, sale: any) => sum + (sale.items || []).reduce((items: number, item: any) => items + Number(item.qty || 0), 0), 0);
    return {
      sales: filteredSales.length,
      revenue,
      average: completed.length ? revenue / completed.length : 0,
      discounts,
      itemCount,
      pending: filteredSales.filter((sale: any) => sale.status === 'pending').length,
    };
  }, [filteredSales]);

  const categories = useMemo(() => Array.from(new Set(products.map((product: any) => product.category).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')), [products]);
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product: any) => {
      const searchable = [product.name, product.brand, product.sku, product.barcode].filter(Boolean).join(' ').toLowerCase();
      return (productCategory === 'all' || product.category === productCategory) && (!query || searchable.includes(query));
    });
  }, [products, productSearch, productCategory]);

  useEffect(() => {
    let active = true;
    const loadFinancialEntry = async () => {
      setFinancialEntry(null);
      if (!selectedSale || !canViewFinancial) return;
      const result = await localApi.from('financial_entries').select('*').eq('origin_table', 'sales').eq('origin_id', selectedSale.id).maybeSingle();
      if (active && !result.error) setFinancialEntry(result.data);
    };
    void loadFinancialEntry();
    return () => { active = false; };
  }, [selectedSale, canViewFinancial]);

  const resetSaleDraft = () => {
    setSaleItems([]);
    setSaleStep(1);
    setProductSearch('');
    setProductCategory('all');
    setManualMode(false);
    setManualItem({ description: '', reference: '', qty: '1', price: '' });
    setNewSale(createBlankSale(selectedStoreIds[0] || availableStores[0]?.id || '', defaultSellerId));
  };

  const openNewSale = () => {
    resetSaleDraft();
    setIsNewSaleOpen(true);
  };

  const discardSaleDraft = () => {
    setIsNewSaleOpen(false);
    setDiscardDraftOpen(false);
    resetSaleDraft();
  };

  const refreshSales = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'all' }),
    ]);
    toast.success('Dados de vendas atualizados.');
  };

  const clearFilters = () => {
    setSearchValue('');
    setDateFrom('');
    setDateTo('');
    setFilterSeller('all');
    setFilterStatus('all');
    setFilterStore('all');
    setFilterPayment('all');
  };

  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const today = new Date();
    const todayValue = localDateIso(today);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    if (preset === 'today') {
      setDateFrom(todayValue);
      setDateTo(todayValue);
      return;
    }
    if (preset === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      setDateFrom(localDateIso(start));
      setDateTo(todayValue);
      return;
    }
    setDateFrom(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`);
    setDateTo(todayValue);
  };

  const productStockForStore = (product: any, storeId = newSale.storeId) => {
    const stock = Array.isArray(product?.product_stock) ? product.product_stock.find((item: any) => item.store_id === storeId) : null;
    const physical = Number(stock?.quantity || 0);
    const reserved = Number(stock?.reserved_quantity || 0);
    return Math.max(0, physical - reserved);
  };

  const addProduct = (product: any) => {
    const available = productStockForStore(product);
    const existing = saleItems.find((item) => item.id === product.id);
    if (available <= 0) {
      toast.error('Este produto não possui estoque disponível nesta loja.');
      return;
    }
    if (existing && existing.qty >= available) {
      toast.error(`Limite de estoque atingido: ${available} unidade(s).`);
      return;
    }
    setSaleItems((previous) => existing
      ? previous.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      : [...previous, { id: product.id, name: product.name, sku: product.sku, price: Number(product.price || 0), qty: 1 }]);
    toast.success(`${product.name} adicionado à venda.`);
  };

  const updateItemQuantity = (itemId: string, value: number) => {
    const currentItem = saleItems.find((item) => item.id === itemId);
    if (currentItem?.manual) {
      setSaleItems((previous) => previous.map((item) => item.id === itemId ? { ...item, qty: Math.max(1, Math.floor(value || 1)) } : item));
      return;
    }
    const product = products.find((candidate: any) => candidate.id === itemId);
    const available = productStockForStore(product);
    const quantity = Math.min(available, Math.max(1, Math.floor(value || 1)));
    if (available <= 0) return;
    setSaleItems((previous) => previous.map((item) => item.id === itemId ? { ...item, qty: quantity } : item));
  };

  const addManualItem = () => {
    const description = manualItem.description.trim();
    const quantity = Number(manualItem.qty);
    const price = Number(manualItem.price.replace(',', '.'));
    if (!description) {
      toast.error('Informe a descrição do item manual.');
      return false;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade inteira maior que zero.');
      return false;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Informe um preço manual válido.');
      return false;
    }
    setSaleItems((previous) => [...previous, { id: createManualItemId(), name: description, sku: manualItem.reference.trim() || undefined, price, qty: quantity, manual: true }]);
    setManualItem({ description: '', reference: '', qty: '1', price: '' });
    toast.success('Item manual adicionado à venda.');
    return true;
  };

  const handleCreateCustomer = async () => {
    if (!selectedCompanyId || !newSale.storeId || !newCustomer.name.trim()) {
      toast.error('Informe nome, empresa e loja do cliente.');
      return;
    }
    try {
      setIsCreatingCustomer(true);
      const result = await localApi.from('customers').insert({
        company_id: selectedCompanyId,
        store_id: newSale.storeId,
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || null,
        whatsapp: newCustomer.whatsapp.trim() || null,
        cpf: newCustomer.cpf.trim() || null,
        status: 'active',
      }).select('*').single();
      if (result.error || !result.data) throw result.error || new Error('Cliente não foi criado.');
      await queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'all' });
      setNewSale((previous) => ({ ...previous, customerId: result.data.id }));
      setNewCustomer({ name: '', phone: '', whatsapp: '', cpf: '' });
      setQuickCustomerOpen(false);
      toast.success('Cliente cadastrado e selecionado na venda.');
    } catch (error: any) {
      toast.error(`Não foi possível cadastrar o cliente: ${error?.message || 'tente novamente.'}`);
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const validateStep = (step: SaleStep) => {
    if (step === 1) {
      if (newSale.customerMode === 'registered' && !newSale.customerId) {
        toast.error('Selecione um cliente cadastrado ou escolha Cliente avulso.');
        return false;
      }
      if (newSale.customerMode === 'walk_in' && !newSale.guestName.trim()) {
        toast.error('Informe o nome do cliente avulso para continuar.');
        return false;
      }
      if (!newSale.storeId) {
        toast.error('Selecione a loja da venda.');
        return false;
      }
      if (!newSale.date) {
        toast.error('Informe a data da venda.');
        return false;
      }
    }
    if (step === 2) {
      if (saleItems.length === 0) {
        if (manualMode && (manualItem.description.trim() || manualItem.reference.trim() || manualItem.price.trim())) {
          return addManualItem();
        }
        toast.error(manualMode ? 'Preencha o item manual ou adicione um produto do catálogo.' : 'Adicione pelo menos um produto.');
        return false;
      }
      if (saleItems.some((item) => !item.manual && productStockForStore(products.find((product: any) => product.id === item.id)) < item.qty)) {
        toast.error('Revise as quantidades: existe item acima do estoque disponível.');
        return false;
      }
    }
    if (step === 3) {
      const discountAmount = newSale.discountAmount.trim() ? Number(newSale.discountAmount.replace(',', '.')) : 0;
      if (!newSale.paymentMethod || !PAYMENT_METHODS[newSale.paymentMethod]) {
        toast.error('Selecione a forma de pagamento.');
        return false;
      }
      if (newSale.discountType !== 'none' && (!Number.isFinite(discountAmount) || discountAmount < 0)) {
        toast.error('Informe um desconto válido.');
        return false;
      }
      if (newSale.discountType === 'percent' && discountAmount > 100) {
        toast.error('O desconto percentual não pode ultrapassar 100%.');
        return false;
      }
      if (newSale.discountType === 'value' && discountAmount > subtotal) {
        toast.error('O desconto não pode ser maior que o subtotal.');
        return false;
      }
      if (newSale.paymentMethod === 'credit') {
        const installments = Number(newSale.installments);
        if (!Number.isInteger(installments) || installments < 1 || installments > 12) {
          toast.error('Selecione um parcelamento válido.');
          return false;
        }
        if (!newSale.dueDate) {
          toast.error('Informe o vencimento do pagamento.');
          return false;
        }
      }
    }
    return true;
  };

  const goToNextStep = () => {
    if (!validateStep(saleStep)) return;
    setSaleStep((previous) => Math.min(3, previous + 1) as SaleStep);
  };

  const goToPreviousStep = () => setSaleStep((previous) => Math.max(1, previous - 1) as SaleStep);

  const handleSubmitSale = async (confirmedHighValue = false) => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !selectedCompanyId) return;
    if (total > HIGH_VALUE_SALE_LIMIT && !confirmedHighValue) {
      setHighValueConfirmOpen(true);
      return;
    }
    try {
      setIsSubmittingSale(true);
      const result = await localApi.operations.completeSale(
        {
          company_id: selectedCompanyId,
          store_id: newSale.storeId,
          customer_id: newSale.customerMode === 'registered' ? newSale.customerId : null,
          guest_name: newSale.customerMode === 'walk_in' ? newSale.guestName.trim() : null,
          seller_id: newSale.sellerId && newSale.sellerId !== 'none' ? newSale.sellerId : null,
          date: newSale.date,
          due_date: newSale.paymentMethod === 'credit' ? newSale.dueDate || newSale.date : newSale.date,
          discount: discountValue,
          payment_method: newSale.paymentMethod,
          payment_note: newSale.paymentNote.trim() || null,
          installments: newSale.paymentMethod === 'credit' ? Number(newSale.installments) : null,
          service_order_id: newSale.linkedOsId && newSale.linkedOsId !== 'none' ? newSale.linkedOsId : null,
          notes: newSale.notes.trim() || null,
          confirm_high_value: confirmedHighValue,
        },
        saleItems.map((item) => ({ product_id: item.manual ? null : item.id, product_name: item.name, quantity: item.qty, unit_price: item.price, manual: Boolean(item.manual) })),
      );
      if (result.error || !result.data) throw result.error || new Error('Venda não foi concluída.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['service_orders'], refetchType: 'all' }),
      ]);
      toast.success(newSale.customerMode === 'walk_in' ? 'Venda avulsa registrada e financeiro sincronizado.' : 'Venda registrada, estoque atualizado e financeiro sincronizado.');
      setIsNewSaleOpen(false);
      resetSaleDraft();
      setHighValueConfirmOpen(false);
    } catch (error: any) {
      toast.error(`Erro ao registrar venda: ${error?.message || 'verifique o estoque e tente novamente.'}`);
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const handleCancelSale = async (saleId: string) => {
    try {
      const result = await localApi.operations.cancelSale(saleId);
      if (result.error) throw result.error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'all' }),
      ]);
      toast.success('Venda cancelada e estoque restaurado.');
      setSelectedSale(null);
    } catch (error: any) {
      toast.error(`Erro ao cancelar venda: ${error?.message || 'tente novamente.'}`);
    } finally {
      setConfirmCancelId(null);
    }
  };

  const printSale = () => {
    const element = document.getElementById('print-sale-section');
    if (element) element.style.display = 'block';
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => { if (element) element.style.display = 'none'; }, 500);
    }, 50);
  };

  if (isLoading) return <LoadingSpinner message="Carregando vendas..." />;

  return (
    <div className="space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in duration-300 sm:space-y-6">
      <PageHeader
        title="Vendas"
        description="Controle comercial, estoque, recebimentos e relacionamento em um único fluxo."
        actions={(
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button variant="outline" onClick={() => void refreshSales()} className="h-10 w-full gap-2 border-border/70 bg-card sm:w-auto">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <PermissionGate module="sales" action="create">
              <Button onClick={openNewSale} className="h-10 w-full gap-2 shadow-sm sm:w-auto">
                <Plus className="h-4 w-4" /> Nova venda
              </Button>
            </PermissionGate>
          </div>
        )}
      />

      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <CardContent className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShoppingCart className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Visão comercial</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">Os indicadores acompanham os filtros aplicados e o escopo global.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/60 p-1 sm:flex sm:flex-wrap sm:items-center">
            {[
              ['today', 'Hoje'],
              ['week', '7 dias'],
              ['month', 'Este mês'],
              ['all', 'Todo período'],
            ].map(([value, label]) => (
              <Button key={value} variant="ghost" size="sm" onClick={() => setDatePreset(value as any)} className={cn('h-9 w-full rounded-lg px-2 text-[11px] sm:h-8 sm:w-auto sm:px-3 sm:text-xs', value === 'all' && !dateFrom && !dateTo ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')}>
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Vendas" value={String(stats.sales)} helper="no filtro" icon={ShoppingCart} />
        <MetricCard label="Faturamento" value={currency(stats.revenue)} helper="vendas concluídas" icon={Banknote} accent />
        <MetricCard label="Ticket médio" value={currency(stats.average)} helper="por venda concluída" icon={Tag} />
        <MetricCard label="Itens vendidos" value={String(stats.itemCount)} helper="unidades" icon={Package} />
        <MetricCard label="Descontos" value={currency(stats.discounts)} helper="concedidos" icon={Tag} />
        <MetricCard label="Pendentes" value={String(stats.pending)} helper="aguardando" icon={Receipt} />
      </div>

      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader className="gap-3 border-b border-border/60 p-3 pb-3 sm:gap-4 sm:p-4 sm:pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base">Histórico de vendas</CardTitle>
              <CardDescription className="text-[11px] leading-relaxed sm:text-sm">Pesquise, filtre e abra qualquer venda para conferir os detalhes.</CardDescription>
            </div>
            <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 sm:flex sm:w-auto">
              <Button variant="ghost" size="sm" onClick={() => setViewMode('table')} className={cn('h-9 w-full gap-1.5 px-2 text-[11px] sm:h-8 sm:w-auto sm:px-3 sm:text-xs', viewMode === 'table' && 'bg-card text-primary shadow-sm')}><List className="h-3.5 w-3.5" /> Tabela</Button>
              <Button variant="ghost" size="sm" onClick={() => setViewMode('cards')} className={cn('h-8 gap-1.5 px-3 text-xs', viewMode === 'cards' && 'bg-card text-primary shadow-sm')}><LayoutGrid className="h-3.5 w-3.5" /> Cards</Button>
            </div>
          </div>
          <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_150px_150px_150px_150px_150px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Buscar venda ou cliente..." className="h-10 pl-9" />
            </div>
            <Select value={filterStore} onValueChange={setFilterStore}><SelectTrigger className="h-10"><SelectValue placeholder="Loja" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{availableStores.map((store: any) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select>
            <Select value={filterSeller} onValueChange={setFilterSeller}><SelectTrigger className="h-10"><SelectValue placeholder="Vendedor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os vendedores</SelectItem>{sellers.map((seller: any) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}</SelectContent></Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-10"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}><SelectTrigger className="h-10"><SelectValue placeholder="Pagamento" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os pagamentos</SelectItem>{Object.entries(PAYMENT_METHODS).map(([value, method]) => <SelectItem key={value} value={value}>{method.label}</SelectItem>)}</SelectContent></Select>
            <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="h-10"><SelectValue placeholder="Ordenar" /></SelectTrigger><SelectContent><SelectItem value="date_desc">Mais recentes</SelectItem><SelectItem value="value_desc">Maior valor</SelectItem><SelectItem value="value_asc">Menor valor</SelectItem><SelectItem value="customer">Cliente</SelectItem><SelectItem value="status">Status</SelectItem></SelectContent></Select>
            <Button variant="outline" onClick={clearFilters} className="h-10 gap-2 border-border/70"><Filter className="h-3.5 w-3.5" /> Limpar</Button>
          </div>
          <div className="grid grid-cols-2 items-center gap-2 text-xs text-muted-foreground sm:flex sm:flex-wrap">
            <span className="col-span-2 font-semibold text-foreground sm:col-span-1">Período:</span>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 w-full min-w-0 sm:h-9 sm:w-[140px]" aria-label="Data inicial" />
            <span className="text-center sm:text-left">até</span>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 w-full sm:h-9 sm:w-[140px]" aria-label="Data final" />
            <span className="col-span-2 text-[11px] sm:ml-auto sm:col-span-1">{sortedSales.length} registro(s) encontrado(s)</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedSales.length === 0 ? (
            <EmptyState icon={sortedSales.length === 0 && sales.length === 0 ? ShoppingCart : Search} title={sales.length === 0 ? 'Nenhuma venda registrada' : 'Nenhuma venda encontrada'} description={sales.length === 0 ? 'Registre a primeira venda para começar.' : 'Ajuste os filtros ou limpe a busca para visualizar os registros.'} action={canCreate ? <Button onClick={openNewSale} className="gap-2"><Plus className="h-4 w-4" /> Nova venda</Button> : undefined} />
          ) : viewMode === 'table' ? (
            <>
            <div className="divide-y divide-border/50 md:hidden">
              {sortedSales.map((sale: any) => (
                <button key={sale.id} type="button" onClick={() => setSelectedSale(sale)} className="flex w-full min-w-0 flex-col gap-3 p-4 text-left transition-colors active:bg-primary/5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-primary">#{String(sale.id).slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 truncate text-sm font-bold text-foreground">{sale.customerName || 'Cliente não informado'}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Calendar className="h-3 w-3 shrink-0" /> {formatBusinessDate(sale.date)}</p>
                    </div>
                    <StatusBadge status={sale.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs min-[380px]:grid-cols-4">
                    <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Loja</p><p className="truncate font-semibold text-foreground">{sale.storeName || '—'}</p></div>
                    <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Itens</p><p className="font-semibold text-foreground">{(sale.items || []).reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0)} un</p></div>
                    <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pagamento</p><p className="truncate font-semibold text-foreground">{PAYMENT_METHODS[sale.paymentMethod || sale.payment_method]?.short || sale.paymentMethod || sale.payment_method || '—'}</p></div>
                    <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p><p className="font-bold text-primary">{currency(sale.total)}</p></div>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader><TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30"><TableHead className="pl-5">Venda / data</TableHead><TableHead>Cliente</TableHead><TableHead>Loja</TableHead><TableHead>Itens</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="pr-5">Status</TableHead></TableRow></TableHeader>
                <TableBody>{sortedSales.map((sale: any) => <TableRow key={sale.id} onClick={() => setSelectedSale(sale)} className="cursor-pointer border-border/50 transition-colors hover:bg-primary/[0.04]">
                  <TableCell className="py-4 pl-5"><div className="flex flex-col gap-1"><span className="font-mono text-xs font-bold text-primary">#{String(sale.id).slice(0, 8).toUpperCase()}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" /> {formatBusinessDate(sale.date)}</span></div></TableCell>
                  <TableCell><div className="flex min-w-[160px] flex-col gap-1"><span className="font-semibold text-foreground">{sale.customerName || 'Cliente não informado'}</span>{sale.customerDocument && <span className="text-[11px] text-muted-foreground">{sale.customerDocumentLabel}: {sale.customerDocument}</span>}</div></TableCell>
                  <TableCell><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Store className="h-3.5 w-3.5" /> {sale.storeName || '—'}</span></TableCell>
                  <TableCell><Badge variant="outline" className="rounded-full">{(sale.items || []).reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0)} un</Badge></TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{PAYMENT_METHODS[sale.paymentMethod || sale.payment_method]?.short || sale.paymentMethod || sale.payment_method || '—'}</span></TableCell>
                  <TableCell className="text-right font-bold text-foreground">{currency(sale.total)}</TableCell>
                  <TableCell className="pr-5"><StatusBadge status={sale.status} /></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
            </>
          ) : (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{sortedSales.map((sale: any) => <button key={sale.id} type="button" onClick={() => setSelectedSale(sale)} className="rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-primary">#{String(sale.id).slice(0, 8).toUpperCase()}</p><p className="mt-1 text-sm font-bold text-foreground">{sale.customerName || 'Cliente não informado'}</p></div><StatusBadge status={sale.status} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs"><div><p className="text-muted-foreground">Data</p><p className="font-semibold text-foreground">{formatBusinessDate(sale.date)}</p></div><div><p className="text-muted-foreground">Total</p><p className="font-bold text-primary">{currency(sale.total)}</p></div><div><p className="text-muted-foreground">Itens</p><p className="font-semibold text-foreground">{(sale.items || []).reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0)} unidade(s)</p></div><div><p className="text-muted-foreground">Pagamento</p><p className="font-semibold text-foreground">{PAYMENT_METHODS[sale.paymentMethod || sale.payment_method]?.short || '—'}</p></div></div>
            </button>)}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isNewSaleOpen} onOpenChange={(open) => {
        if (open) {
          setIsNewSaleOpen(true);
          return;
        }
        if (saleItems.length > 0 || newSale.customerId || newSale.guestName || newSale.notes || newSale.paymentNote) {
          setDiscardDraftOpen(true);
          return;
        }
        discardSaleDraft();
      }}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-background p-0 shadow-2xl sm:h-[min(94vh,900px)] sm:w-full">
          <DialogHeader className="shrink-0 border-b border-border/70 bg-card px-4 py-3 sm:px-7 sm:py-4">
            <div className="flex items-start justify-between gap-4"><div><DialogTitle className="flex items-center gap-2 text-lg"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShoppingCart className="h-4 w-4" /></span> Nova venda</DialogTitle><DialogDescription className="mt-1">Conferência guiada com estoque, cliente, pagamento e referências.</DialogDescription></div><div className="hidden items-center gap-2 text-right sm:flex"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total da venda</p><p className="text-lg font-black text-primary">{currency(total)}</p></div></div>
            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2">{([['1', 'Contexto', 'Cliente e loja'], ['2', 'Produtos', `${saleItems.length} item(s)`], ['3', 'Revisão', 'Pagamento e total']] as const).map(([step, title, helper]) => <button key={step} type="button" onClick={() => { const target = Number(step) as SaleStep; if (target < saleStep || (target === 2 && validateStep(1)) || (target === 3 && validateStep(1) && validateStep(2))) setSaleStep(target); }} className={cn('rounded-xl border px-2 py-2 text-left transition-colors sm:px-3', saleStep === Number(step) ? 'border-primary/40 bg-primary/10' : 'border-border/60 bg-muted/20 hover:border-primary/30')}><div className="flex items-center gap-2"><span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', saleStep === Number(step) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{step}</span><span className={cn('text-xs font-bold', saleStep === Number(step) ? 'text-primary' : 'text-foreground')}>{title}</span></div><p className="mt-1 hidden pl-8 text-[10px] text-muted-foreground sm:block">{helper}</p></button>)}</div>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1"><div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:space-y-6 sm:p-7">
            {saleStep === 1 && <div className="space-y-6">
              <SectionHeading icon={User} title="Quem está comprando?" description="Escolha um cliente cadastrado ou registre uma compra avulsa sem criar cadastro." />
              <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setNewSale((previous) => ({ ...previous, customerMode: 'registered', guestName: '', linkedOsId: '' }))} className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors', newSale.customerMode === 'registered' ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/70 bg-card hover:border-primary/30')}><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', newSale.customerMode === 'registered' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><User className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-foreground">Cliente cadastrado</span><span className="mt-1 block text-xs text-muted-foreground">Vincula a venda ao cadastro, O.S. e histórico do cliente.</span></span></button><button type="button" onClick={() => setNewSale((previous) => ({ ...previous, customerMode: 'walk_in', customerId: '', linkedOsId: '' }))} className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors', newSale.customerMode === 'walk_in' ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/70 bg-card hover:border-primary/30')}><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', newSale.customerMode === 'walk_in' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><UserPlus className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-foreground">Cliente avulso</span><span className="mt-1 block text-xs text-muted-foreground">Compra rápida sem criar cadastro no sistema.</span></span></button></div>{newSale.customerMode === 'registered' ? <><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div className="space-y-2"><Label>Cliente <span className="text-destructive">*</span></Label><CustomerSelector customers={customers as any} value={newSale.customerId} onValueChange={(value) => setNewSale((previous) => ({ ...previous, customerId: value, linkedOsId: '' }))} placeholder="Buscar por nome, CPF, telefone ou WhatsApp" className="min-h-11 rounded-xl bg-background" /></div>{hasPermission('customers', 'create') && <Button type="button" variant="outline" onClick={() => setQuickCustomerOpen(true)} className="h-11 gap-2 border-primary/30 text-primary hover:bg-primary/5"><UserPlus className="h-4 w-4" /> Novo cliente</Button>}</div>{selectedCustomer && <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-foreground">{selectedCustomer.name}</p><p className="mt-1 text-xs text-muted-foreground">{selectedCustomer.customerDocumentLabel || (selectedCustomer.cpf ? 'CPF' : 'Documento')}: {selectedCustomer.customerDocument || selectedCustomer.cpf || selectedCustomer.cnpj || 'Não informado'} · {selectedCustomer.phone || selectedCustomer.whatsapp || 'Contato não informado'}</p></div><Badge className="bg-primary/10 text-primary hover:bg-primary/10">Cliente selecionado</Badge></div></div>}</> : <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4"><Field label="Nome do cliente avulso" required><Input value={newSale.guestName} onChange={(event) => setNewSale((previous) => ({ ...previous, guestName: event.target.value }))} placeholder="Ex.: Cliente balcão" maxLength={160} autoFocus /><p className="mt-2 text-[11px] text-muted-foreground">Esse nome aparecerá na venda, no comprovante e no lançamento financeiro, mas nenhum cadastro de cliente será criado.</p></Field></div>}</div>
              <div className="grid gap-4 md:grid-cols-2"><Field label="Vendedor" required><Select value={newSale.sellerId || 'none'} onValueChange={(value) => setNewSale((previous) => ({ ...previous, sellerId: value === 'none' ? '' : value }))} disabled={!canChangeSeller}><SelectTrigger className="h-11"><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger><SelectContent><SelectItem value="none">Não informado</SelectItem>{sellers.map((seller: any) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}</SelectContent></Select>{!canChangeSeller && <p className="text-[11px] text-muted-foreground">O vendedor segue o usuário da sessão.</p>}</Field><Field label="Loja" required><Select value={newSale.storeId} onValueChange={(value) => setNewSale((previous) => ({ ...previous, storeId: value }))}><SelectTrigger className="h-11"><SelectValue placeholder="Selecione a loja" /></SelectTrigger><SelectContent>{availableStores.map((store: any) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Data da venda" required><Input type="date" value={newSale.date} onChange={(event) => setNewSale((previous) => ({ ...previous, date: event.target.value }))} className="h-11" /></Field><Field label="Ordem de serviço vinculada"><Select value={newSale.linkedOsId || 'none'} onValueChange={(value) => setNewSale((previous) => ({ ...previous, linkedOsId: value === 'none' ? '' : value }))} disabled={newSale.customerMode !== 'registered' || !newSale.customerId || customerOrders.length === 0}><SelectTrigger className="h-11"><SelectValue placeholder="Nenhuma O.S. vinculada" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma O.S.</SelectItem>{customerOrders.map((order: any) => <SelectItem key={order.id} value={order.id}>O.S. #{String(order.id).slice(0, 8).toUpperCase()} · {order.description || order.serviceType || 'Serviço'} · {order.status}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground">{newSale.customerMode === 'walk_in' ? 'Cliente avulso não possui O.S. vinculada.' : newSale.customerId ? `${customerOrders.length} O.S. disponível(is)` : 'Selecione o cliente primeiro.'}</p></Field></div>
              <InfoPanel icon={Store} title="Escopo da venda" text={newSale.customerMode === 'walk_in' ? 'Empresa, loja, nome do cliente avulso, produtos, estoque e Financeiro permanecem vinculados à mesma venda global. Nenhum cadastro de cliente será criado.' : 'Empresa, loja, cliente e referências permanecem vinculados ao mesmo registro global usado por Clientes, Financeiro, Produtos e O.S.'} />
            </div>}

            {saleStep === 2 && <div className="space-y-6">
              <SectionHeading icon={Package} title="Monte a venda" description="Adicione produtos do estoque ou lance um item avulso com informações manuais." />
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-foreground">{selectedCustomer?.name || (newSale.customerMode === 'walk_in' ? newSale.guestName : 'Cliente não informado')}</p><p className="text-xs text-muted-foreground">{availableStores.find((store: any) => store.id === newSale.storeId)?.name || 'Loja não selecionada'} · {saleItems.length} item(ns) no carrinho</p></div><Button type="button" onClick={() => setIsProductModalOpen(true)} className="h-10 gap-2"><Plus className="h-4 w-4" /> Adicionar produto</Button></div>
              <label htmlFor="manual-sale-toggle" className={cn('flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between', manualMode ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/70 bg-card hover:border-primary/30')}><div className="flex items-start gap-3"><Checkbox id="manual-sale-toggle" checked={manualMode} onCheckedChange={(checked) => setManualMode(checked === true)} className="mt-0.5" /><div><p className="text-sm font-bold text-foreground">Fazer venda manual</p><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Use para serviços, acessórios avulsos ou itens que ainda não estão cadastrados. O lançamento entra na venda e no financeiro, mas não altera o estoque.</p></div></div><Badge variant="outline" className={cn('w-fit shrink-0 rounded-full', manualMode ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground')}>{manualMode ? 'Modo manual ativo' : 'Sem estoque'}</Badge></label>
              {manualMode && <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Pencil className="h-4 w-4" /></div><div><p className="text-sm font-bold text-foreground">Adicionar item manual</p><p className="text-xs text-muted-foreground">Descreva o item exatamente como deve aparecer no comprovante e no histórico. Ao clicar em Continuar, um item preenchido é incluído automaticamente.</p></div></div><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-[minmax(0,1fr)_180px_130px_170px_auto]"><Field label="Descrição" required><Input value={manualItem.description} onChange={(event) => setManualItem((previous) => ({ ...previous, description: event.target.value }))} placeholder="Ex.: Ajuste de armação" maxLength={160} /></Field><Field label="Referência"><Input value={manualItem.reference} onChange={(event) => setManualItem((previous) => ({ ...previous, reference: event.target.value }))} placeholder="Opcional" maxLength={60} /></Field><Field label="Quantidade" required><Input type="number" min={1} step={1} value={manualItem.qty} onChange={(event) => setManualItem((previous) => ({ ...previous, qty: event.target.value }))} /></Field><Field label="Preço unitário" required><Input inputMode="decimal" value={manualItem.price} onChange={(event) => setManualItem((previous) => ({ ...previous, price: event.target.value }))} placeholder="R$ 0,00" /></Field><Button type="button" onClick={addManualItem} className="h-10 gap-2 self-end"><Plus className="h-4 w-4" /> Adicionar</Button></div></div>}
              {saleItems.length === 0 ? <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 bg-muted/10 px-5 text-center"><Package className="mb-3 h-10 w-10 text-muted-foreground/40" /><p className="text-sm font-bold text-foreground">Seu carrinho está vazio</p><p className="mt-1 max-w-sm text-xs text-muted-foreground">Abra o catálogo para consultar preço, SKU, categoria e saldo da loja{manualMode ? ' ou adicione um item manual acima' : ''}.</p><Button type="button" variant="link" onClick={() => setIsProductModalOpen(true)} className="mt-2 text-primary">Abrir catálogo</Button></div> : <div className="space-y-3">{saleItems.map((item) => { const product = item.manual ? null : products.find((candidate: any) => candidate.id === item.id); const stock = item.manual ? null : productStockForStore(product); return <div key={item.id} className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center', item.manual ? 'border-primary/25 bg-primary/[0.03]' : 'border-border/70 bg-card')}><div className="flex min-w-0 flex-1 items-center gap-3"><div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.manual ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{item.manual ? <Pencil className="h-4 w-4" /> : <Package className="h-4 w-4" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-foreground">{item.name}</p>{item.manual && <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-[10px] text-primary">Manual</Badge>}</div><p className="mt-0.5 text-[11px] text-muted-foreground">{item.sku ? `Referência ${item.sku}` : item.manual ? 'Item avulso · não movimenta estoque' : 'SKU não informado'}{!item.manual && ` · Estoque disponível: ${stock}`}</p></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="flex items-center rounded-xl border border-border/70 bg-muted/30 p-1"><Button type="button" variant="ghost" size="icon" onClick={() => updateItemQuantity(item.id, item.qty - 1)} disabled={item.qty <= 1} className="h-7 w-7"><Minus className="h-3 w-3" /></Button><Input type="number" min={1} max={item.manual ? undefined : stock || undefined} value={item.qty} onChange={(event) => updateItemQuantity(item.id, Number(event.target.value))} className="h-7 w-12 border-0 bg-transparent p-0 text-center text-xs font-bold focus-visible:ring-0" /><Button type="button" variant="ghost" size="icon" onClick={() => updateItemQuantity(item.id, item.qty + 1)} disabled={!item.manual && item.qty >= Number(stock || 0)} className="h-7 w-7"><Plus className="h-3 w-3" /></Button></div><div className="min-w-[100px] text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subtotal</p><p className="text-sm font-bold text-primary">{currency(item.price * item.qty)}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setSaleItems((previous) => previous.filter((candidate) => candidate.id !== item.id))} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button></div></div> })}</div>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><SummaryTile label="Subtotal" value={currency(subtotal)} /><SummaryTile label="Produtos" value={`${saleItems.length} tipo(s)`} /><SummaryTile label="Unidades" value={String(saleItems.reduce((sum, item) => sum + item.qty, 0))} /></div>
            </div>}

            {saleStep === 3 && <div className="space-y-6">
              <SectionHeading icon={Receipt} title="Pagamento e revisão" description="Revise os valores antes de concluir. A confirmação gera venda, movimento de estoque e lançamento financeiro em transação." />
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5"><div><Label>Forma de pagamento</Label><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(PAYMENT_METHODS).map(([value, method]) => { const Icon = method.icon; return <button key={value} type="button" onClick={() => setNewSale((previous) => ({ ...previous, paymentMethod: value, installments: value === 'credit' ? previous.installments : '1' }))} className={cn('flex min-h-[72px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors', newSale.paymentMethod === value ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40')}><Icon className="h-4 w-4" /><span className="text-xs font-bold">{method.label}</span></button> })}</div></div>
                  {newSale.paymentMethod === 'credit' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Parcelamento"><Select value={newSale.installments} onValueChange={(value) => setNewSale((previous) => ({ ...previous, installments: value }))}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, index) => index + 1).map((count) => <SelectItem key={count} value={String(count)}>{count === 1 ? `À vista · ${currency(total)}` : `${count}x de ${currency(total / count)}`}</SelectItem>)}</SelectContent></Select></Field><Field label="Vencimento"><Input type="date" value={newSale.dueDate} onChange={(event) => setNewSale((previous) => ({ ...previous, dueDate: event.target.value }))} className="h-11" /></Field></div>}
                  <div className="grid gap-4 sm:grid-cols-2"><Field label="Desconto"><Select value={newSale.discountType} onValueChange={(value) => setNewSale((previous) => ({ ...previous, discountType: value as NewSale['discountType'], discountAmount: '' }))} disabled={!canDiscount}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem desconto</SelectItem><SelectItem value="percent">Percentual (%)</SelectItem><SelectItem value="value">Valor fixo (R$)</SelectItem></SelectContent></Select>{!canDiscount && <p className="text-[11px] text-muted-foreground">Sua permissão não permite conceder descontos.</p>}</Field>{newSale.discountType !== 'none' && <Field label={newSale.discountType === 'percent' ? 'Percentual' : 'Valor do desconto'}><div className="relative"><Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={newSale.discountAmount} onChange={(event) => setNewSale((previous) => ({ ...previous, discountAmount: event.target.value }))} className="h-11 pl-9" placeholder={newSale.discountType === 'percent' ? 'Ex.: 10' : 'Ex.: 50,00'} disabled={!canDiscount} /></div></Field>}</div>
                  <Field label="Observação do pagamento"><Textarea value={newSale.paymentNote} onChange={(event) => setNewSale((previous) => ({ ...previous, paymentNote: event.target.value }))} placeholder="Ex.: entrada recebida no PIX, prazo combinado..." className="min-h-[76px] resize-none" /></Field><Field label="Observações internas"><Textarea value={newSale.notes} onChange={(event) => setNewSale((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Detalhes adicionais da venda..." className="min-h-[76px] resize-none" /></Field>
                </div>
                <div className="space-y-4"><Card className="border-primary/20 bg-primary/[0.04] shadow-none"><CardHeader className="pb-3"><CardTitle className="text-sm">Conferência</CardTitle><CardDescription>O que será registrado globalmente.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><ReviewRow label="Cliente" value={selectedCustomer?.name || (newSale.customerMode === 'walk_in' ? `${newSale.guestName} · Avulso` : '—')} /><ReviewRow label="Loja" value={availableStores.find((store: any) => store.id === newSale.storeId)?.name || '—'} /><ReviewRow label="Produtos" value={`${saleItems.reduce((sum, item) => sum + item.qty, 0)} unidade(s)`} /><Separator /><ReviewRow label="Subtotal" value={currency(subtotal)} /><ReviewRow label="Desconto" value={discountValue ? `− ${currency(discountValue)}` : currency(0)} tone={discountValue ? 'success' : undefined} /><div className="flex items-end justify-between gap-3 pt-2"><span className="font-bold text-foreground">Total líquido</span><span className="text-2xl font-black text-primary">{currency(total)}</span></div>{newSale.paymentMethod === 'credit' && <p className="rounded-lg bg-card p-2 text-xs text-muted-foreground">{newSale.installments}x de <strong className="text-foreground">{currency(total / Number(newSale.installments || 1))}</strong></p>}</CardContent></Card><InfoPanel icon={Check} title="Validação final" text="O estoque será validado novamente no servidor. Em caso de erro, nada será parcialmente salvo." /></div>
              </div>
            </div>}
          </div></ScrollArea>
          <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4"><Button type="button" variant="ghost" onClick={() => setDiscardDraftOpen(true)} className="gap-2 text-muted-foreground"><X className="h-4 w-4" /> Cancelar</Button><div className="flex w-full items-center justify-between gap-2 sm:w-auto"><div className="mr-auto sm:hidden"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p><p className="font-black text-primary">{currency(total)}</p></div>{saleStep > 1 && <Button type="button" variant="outline" onClick={goToPreviousStep} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>}{saleStep < 3 ? <Button type="button" onClick={goToNextStep} className="gap-2">Continuar <ArrowRight className="h-4 w-4" /></Button> : <Button type="button" onClick={() => void handleSubmitSale()} disabled={isSubmittingSale} className="gap-2">{isSubmittingSale ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {isSubmittingSale ? 'Registrando...' : 'Concluir venda'}</Button>}</div></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProductModalOpen} onOpenChange={(open) => { setIsProductModalOpen(open); if (!open) { setProductSearch(''); setProductCategory('all'); } }}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-background p-0 shadow-2xl sm:h-[min(88vh,760px)] sm:w-full"><DialogHeader className="shrink-0 border-b border-border/70 bg-card px-5 py-4 sm:px-6"><DialogTitle className="flex items-center gap-2 text-base"><Package className="h-5 w-5 text-primary" /> Catálogo da loja</DialogTitle><DialogDescription>Consulte estoque e adicione produtos sem perder o carrinho da venda.</DialogDescription></DialogHeader><div className="grid shrink-0 gap-3 border-b border-border/60 bg-muted/20 p-4 md:grid-cols-[1fr_180px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nome, marca, SKU ou código de barras..." className="h-10 pl-9" /></div><Select value={productCategory} onValueChange={setProductCategory}><SelectTrigger className="h-10"><SelectValue placeholder="Categorias" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map((category) => <SelectItem key={String(category)} value={String(category)}>{String(category)}</SelectItem>)}</SelectContent></Select></div><ScrollArea className="min-h-0 flex-1"><div className="grid gap-3 p-4 sm:grid-cols-2">{filteredProducts.length === 0 ? <div className="col-span-full flex min-h-[240px] flex-col items-center justify-center text-center text-muted-foreground"><Package className="mb-3 h-9 w-9 opacity-30" /><p className="text-sm font-semibold">Nenhum produto encontrado</p><p className="mt-1 text-xs">Tente outro termo ou categoria.</p></div> : filteredProducts.map((product: any) => { const stock = productStockForStore(product); const already = saleItems.find((item) => item.id === product.id); return <button type="button" key={product.id} onClick={() => addProduct(product)} className={cn('group rounded-2xl border p-4 text-left transition-all', stock > 0 ? 'border-border/70 bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md' : 'cursor-not-allowed border-border/50 bg-muted/30 opacity-65')}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">{product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{product.name}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{product.brand || 'Marca não informada'}{product.category ? ` · ${product.category}` : ''}</p></div></div>{already && <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10">{already.qty} no carrinho</Badge>}</div><div className="mt-4 flex items-end justify-between border-t border-border/60 pt-3"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estoque na loja</p><p className={cn('text-sm font-bold', stock > 0 ? 'text-foreground' : 'text-destructive')}>{stock} unidade(s)</p></div><p className="text-base font-black text-primary">{currency(product.price)}</p></div></button> })}</div></ScrollArea><DialogFooter className="shrink-0 border-t border-border/70 bg-card p-4"><Button variant="outline" onClick={() => setIsProductModalOpen(false)} className="w-full sm:w-auto">Fechar catálogo</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}><DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl border-border/80 bg-background p-0"><DialogHeader className="border-b border-border/70 bg-card px-5 py-4"><DialogTitle className="flex items-center gap-2 text-base"><UserPlus className="h-5 w-5 text-primary" /> Cadastro rápido de cliente</DialogTitle><DialogDescription>O cliente será criado na empresa e loja selecionadas e retornará automaticamente para esta venda.</DialogDescription></DialogHeader><div className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Nome completo" required><Input value={newCustomer.name} onChange={(event) => setNewCustomer((previous) => ({ ...previous, name: event.target.value }))} placeholder="Nome do cliente" autoFocus /></Field></div><Field label="CPF"><Input value={newCustomer.cpf} onChange={(event) => setNewCustomer((previous) => ({ ...previous, cpf: event.target.value }))} placeholder="000.000.000-00" /></Field><Field label="Telefone"><Input value={newCustomer.phone} onChange={(event) => setNewCustomer((previous) => ({ ...previous, phone: event.target.value }))} placeholder="(00) 00000-0000" /></Field><Field label="WhatsApp"><Input value={newCustomer.whatsapp} onChange={(event) => setNewCustomer((previous) => ({ ...previous, whatsapp: event.target.value }))} placeholder="(00) 00000-0000" /></Field><div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground"><p className="font-semibold text-foreground">Vínculo atual</p><p className="mt-1">{availableStores.find((store: any) => store.id === newSale.storeId)?.name || 'Selecione uma loja na etapa 1'}</p></div></div><DialogFooter className="border-t border-border/70 bg-card px-5 py-4"><Button variant="ghost" onClick={() => setQuickCustomerOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreateCustomer()} disabled={isCreatingCustomer} className="gap-2">{isCreatingCustomer && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar cliente</Button></DialogFooter></DialogContent></Dialog>

      {selectedSale && <><SalePrint sale={selectedSale} company={companies.find((company: any) => company.id === selectedSale.companyId) || companies.find((company: any) => company.id === selectedCompanyId)} store={stores.find((store: any) => store.id === selectedSale.storeId)} customer={customers.find((customer: any) => customer.id === (selectedSale.customerId || selectedSale.customer_id))} products={products} customerCpf={selectedSale.customerCpf} customerDocument={selectedSale.customerDocument} customerDocumentLabel={selectedSale.customerDocumentLabel} /><Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}><DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-background p-0 sm:h-[min(90vh,820px)] sm:w-full"><DialogHeader className="shrink-0 border-b border-border/70 bg-card px-5 py-4 sm:px-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><DialogTitle className="text-lg">Venda #{String(selectedSale.id).slice(0, 8).toUpperCase()}</DialogTitle><DialogDescription>Registro comercial de {formatBusinessDate(selectedSale.date)} · {selectedSale.customerName || 'Cliente não informado'}</DialogDescription></div><StatusBadge status={selectedSale.status} /></div></DialogHeader><ScrollArea className="min-h-0 flex-1"><div className="space-y-5 p-4 sm:space-y-6 sm:p-7"><div className="grid gap-3 sm:grid-cols-3"><SummaryTile label="Valor líquido" value={currency(selectedSale.total)} accent /><SummaryTile label="Pagamento" value={PAYMENT_METHODS[selectedSale.paymentMethod || selectedSale.payment_method]?.label || 'Não informado'} /><SummaryTile label="Unidades" value={String((selectedSale.items || []).reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0))} /></div><div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-card p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4"><DetailInfo label="Cliente" value={selectedSale.customerName || '—'} icon={User} onClick={() => { const customer = customers.find((candidate: any) => candidate.id === selectedSale.customerId); if (customer) setSelectedCustomerPreview(customer); }} clickable={Boolean(customers.find((candidate: any) => candidate.id === selectedSale.customerId))} /><DetailInfo label="Vendedor" value={selectedSale.sellerName || '—'} icon={User} /><DetailInfo label="Loja" value={selectedSale.storeName || '—'} icon={Store} /><DetailInfo label="Data" value={formatBusinessDate(selectedSale.date)} icon={Calendar} /></div><SectionHeading icon={Package} title="Itens da venda" description="Produtos registrados e valores praticados." /><div className="space-y-2 md:hidden">{(selectedSale.items || []).map((item: any, index: number) => <div key={`${item.productId || item.product || 'item'}-mobile-${index}`} className="rounded-2xl border border-border/70 bg-card p-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{item.product || 'Produto'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.productId ? `ID ${String(item.productId).slice(0, 8).toUpperCase()}` : 'Sem identificação'}</p></div><p className="shrink-0 text-sm font-black text-primary">{currency(Number(item.qty || 0) * Number(item.price || 0))}</p></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-2 text-[11px]"><div><p className="text-muted-foreground">Qtd.</p><p className="font-semibold text-foreground">{item.qty}</p></div><div><p className="text-muted-foreground">Unitário</p><p className="font-semibold text-foreground">{currency(item.price)}</p></div><div className="text-right"><p className="text-muted-foreground">Subtotal</p><p className="font-bold text-primary">{currency(Number(item.qty || 0) * Number(item.price || 0))}</p></div></div></div>)}</div><div className="hidden overflow-x-auto rounded-2xl border border-border/70 md:block"><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Produto</TableHead><TableHead className="text-center">Qtd.</TableHead><TableHead className="text-right">Unitário</TableHead><TableHead className="pr-4 text-right">Subtotal</TableHead></TableRow></TableHeader><TableBody>{(selectedSale.items || []).map((item: any, index: number) => <TableRow key={`${item.productId || item.product || 'item'}-${index}`}><TableCell><p className="font-semibold text-foreground">{item.product || 'Produto'}</p><p className="text-[11px] text-muted-foreground">{item.productId ? `ID ${String(item.productId).slice(0, 8).toUpperCase()}` : 'Sem identificação'}</p></TableCell><TableCell className="text-center">{item.qty}</TableCell><TableCell className="text-right">{currency(item.price)}</TableCell><TableCell className="pr-4 text-right font-bold text-primary">{currency(Number(item.qty || 0) * Number(item.price || 0))}</TableCell></TableRow>)}</TableBody></Table></div><div className="ml-auto max-w-sm space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-4"><ReviewRow label="Subtotal" value={currency(Number(selectedSale.total || 0) + Number(selectedSale.discount || 0))} /><ReviewRow label="Desconto" value={`− ${currency(selectedSale.discount)}`} tone="success" /><Separator /><ReviewRow label="Total líquido" value={currency(selectedSale.total)} strong /></div>{(selectedSale.notes || financialEntry) && <div className="grid gap-4 md:grid-cols-2"><InfoPanel icon={FileText} title="Observações" text={selectedSale.notes || 'Sem observações internas.'} />{financialEntry && <InfoPanel icon={Receipt} title="Financeiro vinculado" text={`${financialEntry.status === 'paid' ? 'Recebido' : 'Lançamento pendente'} · Vencimento: ${formatBusinessDate(financialEntry.due_date)}${financialEntry.payment_note ? ` · ${financialEntry.payment_note}` : ''}`} />}</div>}</div></ScrollArea><DialogFooter className="shrink-0 flex-col gap-3 border-t border-border/70 bg-card p-3 sm:flex-row sm:flex-wrap sm:justify-between sm:px-7 sm:py-4"><Button variant="ghost" onClick={() => setSelectedSale(null)} className="w-full sm:w-auto">Fechar</Button><div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">{hasPermission('fiscal', 'create') && selectedSale.status !== 'cancelled' && <Button variant="outline" onClick={() => void prepareFiscalDocument('NFC-e')} disabled={isPreparingFiscal} className="gap-2"><FileCheck className="h-4 w-4" />{isPreparingFiscal ? 'Preparando...' : 'Preparar NFC-e'}</Button>}{canPrint && <Button variant="outline" onClick={printSale} className="gap-2"><Printer className="h-4 w-4" /> Imprimir comprovante</Button>}{canCancel && selectedSale.status !== 'cancelled' && <Button variant="outline" onClick={() => setConfirmCancelId(selectedSale.id)} className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /> Cancelar venda</Button>}</div></DialogFooter></DialogContent></Dialog></>}

      <Dialog open={!!selectedCustomerPreview} onOpenChange={(open) => !open && setSelectedCustomerPreview(null)}><DialogContent className="max-w-md border-border/80 bg-background p-0"><DialogHeader className="border-b border-border/70 bg-card px-5 py-4"><DialogTitle>Resumo do cliente</DialogTitle><DialogDescription>Dados vinculados ao registro comercial.</DialogDescription></DialogHeader>{selectedCustomerPreview && <div className="space-y-4 p-5"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-bold text-primary">{String(selectedCustomerPreview.name || 'C').slice(0, 2).toUpperCase()}</div><div><p className="font-bold text-foreground">{selectedCustomerPreview.name}</p><p className="text-xs text-muted-foreground">{selectedCustomerPreview.customerDocument || selectedCustomerPreview.cpf || selectedCustomerPreview.cnpj || 'Documento não informado'}</p></div></div><div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm"><DetailInfo label="Telefone" value={selectedCustomerPreview.phone || 'Não informado'} icon={User} /><DetailInfo label="WhatsApp" value={selectedCustomerPreview.whatsapp || 'Não informado'} icon={Smartphone} /><DetailInfo label="E-mail" value={selectedCustomerPreview.email || 'Não informado'} icon={FileText} /></div></div>}<DialogFooter className="border-t border-border/70 bg-card px-5 py-4"><Button onClick={() => setSelectedCustomerPreview(null)}>Fechar</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={highValueConfirmOpen} onOpenChange={setHighValueConfirmOpen}>
        <AlertDialogContent className="border-primary/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" /> Confirmar valor alto</AlertDialogTitle>
            <AlertDialogDescription>O total desta venda é de <strong className="text-foreground">{currency(total)}</strong>. Confirme que esse valor está correto antes de registrar. Essa proteção existe para evitar lançamentos acidentais que afetem o Financeiro e o estoque.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-sm"><p className="font-bold text-foreground">{newSale.customerMode === 'walk_in' ? `${newSale.guestName} · Cliente avulso` : selectedCustomer?.name || 'Cliente não informado'}</p><p className="mt-1 text-muted-foreground">{saleItems.reduce((sum, item) => sum + item.qty, 0)} unidade(s) · {newSale.paymentMethod ? PAYMENT_METHODS[newSale.paymentMethod]?.label : 'Pagamento não informado'}</p></div>
          <AlertDialogFooter><AlertDialogCancel>Revisar venda</AlertDialogCancel><AlertDialogAction onClick={() => void handleSubmitSale(true)} disabled={isSubmittingSale} className="bg-primary text-primary-foreground hover:bg-primary/90">Confirmar e registrar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmCancelId} onOpenChange={(open) => !open && setConfirmCancelId(null)}>
        <AlertDialogContent className="border-border/80">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Cancelar venda?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A venda será marcada como cancelada, o estoque será restaurado e o lançamento financeiro será atualizado.</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmCancelId && (() => {
            const sale = sales.find((candidate: any) => candidate.id === confirmCancelId);
            return sale ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm"><p className="font-bold text-foreground">Venda #{String(sale.id).slice(0, 8).toUpperCase()}</p><p className="mt-1 text-muted-foreground">{sale.customerName || 'Cliente não informado'} · {formatBusinessDate(sale.date)}</p><p className="mt-2 font-bold text-destructive">{currency(sale.total)}</p></div> : null;
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Manter venda</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleCancelSale(confirmCancelId!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sim, cancelar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discardDraftOpen} onOpenChange={setDiscardDraftOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Descartar venda em andamento?</AlertDialogTitle><AlertDialogDescription>Os produtos e informações preenchidos serão removidos da memória deste formulário. Nenhum dado foi gravado ainda.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar preenchendo</AlertDialogCancel><AlertDialogAction onClick={discardSaleDraft} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Descartar rascunho</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

function MetricCard({ label, value, helper, icon: Icon, accent = false }: { label: string; value: string; helper: string; icon: any; accent?: boolean }) {
  return <Card className="min-w-0 border-border/70 bg-card shadow-sm"><CardContent className="flex min-h-[96px] flex-col justify-between gap-2 p-3 sm:min-h-[108px] sm:p-4"><div className="flex min-w-0 items-center justify-between gap-2"><div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', accent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}><Icon className="h-4 w-4" /></div><span className="min-w-0 truncate text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px]">{label}</span></div><div><p className={cn('truncate text-base font-black sm:text-lg', accent ? 'text-primary' : 'text-foreground')}>{value}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{helper}</p></div></CardContent></Card>;
}

function SectionHeading({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return <div className="flex min-w-0 items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0"><h3 className="text-sm font-bold text-foreground">{title}</h3><p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{description}</p></div></div>;
}

function InfoPanel({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><div><p className="text-xs font-bold text-foreground">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div></div>;
}

function SummaryTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={cn('mt-1 text-sm font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p></div>;
}

function ReviewRow({ label, value, tone, strong = false }: { label: string; value: string; tone?: 'success'; strong?: boolean }) {
  return <div className={cn('flex items-center justify-between gap-4 text-sm', strong && 'text-base font-bold')}><span className="text-muted-foreground">{label}</span><span className={cn('text-right', tone === 'success' ? 'font-semibold text-emerald-600' : strong ? 'font-black text-primary' : 'font-semibold text-foreground')}>{value}</span></div>;
}

function DetailInfo({ label, value, icon: Icon, onClick, clickable = false }: { label: string; value: string; icon: any; onClick?: () => void; clickable?: boolean }) {
  const content = <><Icon className="h-3.5 w-3.5 text-primary" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={cn('truncate text-sm font-semibold text-foreground', clickable && 'text-primary')}>{value}</p></div></>;
  return clickable ? <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-2 rounded-lg text-left hover:opacity-80">{content}</button> : <div className="flex min-w-0 items-center gap-2">{content}</div>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}{required && <span className="ml-1 text-destructive">*</span>}</Label>{children}</div>;
}
