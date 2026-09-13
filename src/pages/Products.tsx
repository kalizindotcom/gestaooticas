import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  AlertTriangle,
  Package as PackageIcon,
  MoreHorizontal,
  Edit2,
  History,
  Trash2,
  ArrowUpDown,
  Filter,
  Download,
  Upload,
  Box,
  Tags,
  DollarSign,
  ShoppingCart,
  Store as StoreIcon,
  Layers,
  Info,
  Barcode,
  ChevronRight,
  MapPin,
  Eye,
  AlertCircle,
  User,
  Clock,
  ArrowRightLeft,
  ClipboardCheck,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProducts, useProductsPage, useProductMovements, useProductAudits, useProductCategories, useProductBrands, useSales, useLocalMutation, useEmployees } from '@/hooks/useLocalData';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KPICard } from '@/components/shared/KPICard';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { FilterBar } from '@/components/shared/premium/FilterBar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ProductForm } from '@/components/products/ProductForm';
import { toast } from 'sonner';
import { TransferStockModal } from '@/components/products/TransferStockModal';
import { StockMovementModal } from '@/components/products/StockMovementModal';
import { InventoryModal } from '@/components/products/InventoryModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { usePermissions } from '@/contexts/PermissionsContext';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { SalesHistoryPanel } from '@/components/products/SalesHistoryPanel';

export default function Products() {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useProducts();
  const { data: productMovements = [] } = useProductMovements();
  const { data: sales = [] } = useSales();
  const { data: productCategories = [] } = useProductCategories();
  const { data: productBrands = [] } = useProductBrands();
  const { data: employees = [] } = useEmployees();
  const { selectedStoreIds, dateRange, setDateRange, stores, selectedCompanyId } = useGlobalFilter();
  const { hasPermission } = usePermissions();
  const canViewCost = hasPermission('products', 'view_cost');
  const canManageCost = hasPermission('products', 'manage_cost');
  const canViewStock = hasPermission('products', 'view_stock');
  const canManageStock = hasPermission('products', 'manage_stock');
  const productMutation = useLocalMutation('products', [['products', selectedCompanyId]]);
  const productStockMutation = useLocalMutation('product_stock', [['products', selectedCompanyId]]);
  const productImageMutation = useLocalMutation('product_images', [['products', selectedCompanyId]]);
  const categoryMutation = useLocalMutation('product_categories', [['product_categories', selectedCompanyId], ['products', selectedCompanyId]]);
  const brandMutation = useLocalMutation('product_brands', [['product_brands', selectedCompanyId], ['products', selectedCompanyId]]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [localStoreFilter, setLocalStoreFilter] = useState('all');
  const [activeListTab, setActiveListTab] = useState('all');
  const [productPage, setProductPage] = useState(0);
  const PRODUCT_PAGE_SIZE = 30;
  const useServerPage = categoryFilter === 'all' && brandFilter === 'all' && statusFilter === 'all' && activeListTab === 'all' && localStoreFilter === 'all';
  const { data: serverProductsPage, isLoading: isServerPageLoading } = useProductsPage(productPage, PRODUCT_PAGE_SIZE, search);
  const [mainTab, setMainTab] = useState('catalog');
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailView, setDetailView] = useState<'details' | 'history' | 'sales' | 'audit'>('details');
  const { data: productAudits = [] } = useProductAudits(selectedProduct?.id);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isNewBrandModalOpen, setIsNewBrandModalOpen] = useState(false);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'brand' | 'category' | 'product', name: string, id?: string } | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importSkipped, setImportSkipped] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isStockMovementModalOpen, setIsStockMovementModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStoreFilter, setHistoryStoreFilter] = useState('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState('all');
  const [selectedHistorySale, setSelectedHistorySale] = useState<any | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const brandList = useMemo(() => Array.from(new Set([...productBrands.filter((brand: any) => brand.is_active !== false).map((brand: any) => brand.name), ...products.map((p: any) => p.brand)].filter(Boolean))) as string[], [productBrands, products]);
  const categoryList = useMemo(() => Array.from(new Set([...productCategories.filter((category: any) => category.is_active !== false).map((category: any) => category.name), ...products.map((p: any) => p.category)].filter(Boolean))) as string[], [productCategories, products]);

  const categories = categoryList;
  const brands = brandList;

  const getProductStock = (p: any, storeId?: string) => {
    if (!Array.isArray(p.product_stock)) return 0;
    if (storeId) return p.product_stock.find((s: any) => s.store_id === storeId)?.quantity ?? 0;
    return p.product_stock.reduce((acc: number, s: any) => acc + (s.quantity || 0), 0);
  };
  const getProductReserved = (p: any, storeId?: string) => {
    if (!Array.isArray(p.product_stock)) return 0;
    if (storeId) return Number(p.product_stock.find((s: any) => s.store_id === storeId)?.reserved_quantity || 0);
    return p.product_stock.reduce((acc: number, s: any) => acc + Number(s.reserved_quantity || 0), 0);
  };
  const getProductAvailable = (p: any, storeId?: string) => Math.max(getProductStock(p, storeId) - getProductReserved(p, storeId), 0);

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchesSearch = !search ||
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesBrand = brandFilter === 'all' || p.brand === brandFilter;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const effectiveStoreIds = localStoreFilter === 'all' ? selectedStoreIds : [localStoreFilter];
      const totalStock = Array.isArray(p.product_stock)
        ? p.product_stock.filter((s: any) => effectiveStoreIds.includes(s.store_id)).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0)
        : 0;
      const matchesTab =
        activeListTab === 'all' ||
        (activeListTab === 'low_stock' && totalStock > 0 && totalStock <= 5) ||
        (activeListTab === 'out_of_stock' && totalStock === 0);
      return matchesSearch && matchesCategory && matchesBrand && matchesStatus && matchesTab;
    });
  }, [products, search, categoryFilter, brandFilter, statusFilter, activeListTab, selectedStoreIds, localStoreFilter]);

  const productPageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE));
  const safeProductPage = Math.min(productPage, productPageCount - 1);
  const pagedProducts = useMemo(() => filteredProducts.slice(safeProductPage * PRODUCT_PAGE_SIZE, (safeProductPage + 1) * PRODUCT_PAGE_SIZE), [filteredProducts, safeProductPage]);
  const catalogRows = useServerPage ? (serverProductsPage?.rows || []) : pagedProducts;
  const catalogPageCount = useServerPage ? Math.max(1, Math.ceil((serverProductsPage?.total || 0) / PRODUCT_PAGE_SIZE)) : productPageCount;

  const selectedProductImages = useMemo(() => {
    if (!selectedProduct) return [];
    return Array.from(new Set([selectedProduct.image_url, ...(Array.isArray(selectedProduct.product_images) ? selectedProduct.product_images.map((image: any) => image.image_url) : [])].filter(Boolean))) as string[];
  }, [selectedProduct]);

  const selectedProductSales = useMemo(() => {
    if (!selectedProduct) return [];
    return sales.flatMap((sale: any) => (sale.items || [])
      .filter((item: any) => item.productId === selectedProduct.id)
      .map((item: any) => ({ ...item, saleId: sale.id, date: sale.date, customerName: sale.customerName || 'Consumidor não informado', storeName: sale.storeName || '—', status: sale.status, paymentMethod: sale.paymentMethod })));
  }, [sales, selectedProduct]);

  const saleHistoryRows = useMemo(() => sales.flatMap((sale: any) => (sale.items || []).map((item: any, index: number) => {
    const product = products.find((candidate: any) => candidate.id === item.productId);
    const quantity = Number(item.qty || 0);
    const unitPrice = Number(item.price || 0);
    return {
      id: `${sale.id}-${item.productId || item.product || index}`,
      saleId: sale.id,
      dateTime: sale.created_at || sale.date,
      productId: item.productId,
      productName: item.product || product?.name || 'Item manual',
      sku: product?.sku || item.sku || '—',
      barcode: product?.barcode || item.barcode || '—',
      brand: product?.brand || '—',
      category: product?.category || '—',
      imageUrl: product?.image_url || null,
      quantity,
      unitPrice,
      itemTotal: Number(item.total ?? (unitPrice * quantity)),
      saleTotal: Number(sale.total || 0),
      discount: Number(sale.discount || 0),
      customerName: sale.customerName || sale.customer_name || 'Cliente avulso',
      customerDocument: sale.customerDocument || '—',
      storeName: sale.storeName || '—',
      sellerName: sale.sellerName || 'Não informado',
      paymentMethod: sale.paymentMethod || sale.payment_method || '—',
      status: sale.status || 'completed',
      serviceOrderId: sale.service_order_id || null,
      notes: sale.notes || '',
    };
  })).sort((a: any, b: any) => new Date(b.dateTime || 0).getTime() - new Date(a.dateTime || 0).getTime()), [sales, products]);

  const filteredSaleHistoryRows = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return saleHistoryRows.filter((row: any) => {
      const matchesSearch = !query || [row.productName, row.sku, row.barcode, row.customerName, row.storeName, row.sellerName, row.saleId].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStore = historyStoreFilter === 'all' || row.storeName === historyStoreFilter;
      const matchesStatus = historyStatusFilter === 'all' || row.status === historyStatusFilter;
      const matchesPayment = historyPaymentFilter === 'all' || row.paymentMethod === historyPaymentFilter;
      return matchesSearch && matchesStore && matchesStatus && matchesPayment;
    });
  }, [saleHistoryRows, historySearch, historyStoreFilter, historyStatusFilter, historyPaymentFilter]);

  const saleHistorySummary = useMemo(() => ({
    sales: new Set(filteredSaleHistoryRows.map((row: any) => row.saleId)).size,
    units: filteredSaleHistoryRows.reduce((total: number, row: any) => total + row.quantity, 0),
    revenue: filteredSaleHistoryRows.reduce((total: number, row: any) => total + row.itemTotal, 0),
    discounts: Array.from(new Map(filteredSaleHistoryRows.map((row: any) => [row.saleId, row.discount])).values()).reduce<number>((total, value: unknown) => total + Number(value || 0), 0),
  }), [filteredSaleHistoryRows]);

  const copyProductValue = async (label: string, value?: string | null) => {
    const content = String(value || '').trim();
    if (!content) {
      toast.error(`${label} não cadastrado.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error(`Não foi possível copiar o ${label.toLowerCase()}.`);
    }
  };

  const stats = useMemo(() => {
    const totalItems = products.length;
    const activeItems = products.filter((p: any) => p.status === 'active').length;
    let lowStockCount = 0, outOfStockCount = 0, totalValue = 0;
    products.forEach((p: any) => {
      const effectiveStoreIds = localStoreFilter === 'all' ? selectedStoreIds : [localStoreFilter];
      const totalStock = Array.isArray(p.product_stock)
        ? p.product_stock.filter((s: any) => effectiveStoreIds.includes(s.store_id)).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0)
        : 0;
      if (totalStock === 0) outOfStockCount++;
      else if (totalStock <= 5) lowStockCount++;
      totalValue += (p.price || 0) * totalStock;
    });
    return { totalItems, activeItems, lowStockCount, outOfStockCount, totalValue };
  }, [products, selectedStoreIds, localStoreFilter]);

  const handleExport = () => {
    const headers = ['nome', 'sku', 'codigo_barras', 'categoria', 'marca', 'preco_venda', ...(canViewCost ? ['preco_custo'] : []), 'estoque_total', 'status'];
    const rows = filteredProducts.map((product: any) => [
      product.name || '', product.sku || '', product.barcode || '', product.category || '', product.brand || '', product.price || 0,
      ...(canViewCost ? [product.cost || 0] : []), getProductStock(product), product.status || 'active',
    ]);
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `produtos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} produto(s) exportado(s).`);
  };

  const handleImport = () => importInputRef.current?.click();

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedCompanyId) return;
    try {
      const raw = await file.text();
      const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('O arquivo precisa ter cabeçalho e pelo menos um produto.');
      const separator = lines[0].includes(';') ? ';' : ',';
      const parseLine = (line: string) => {
        const values: string[] = []; let current = ''; let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
          const char = line[index];
          if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; continue; }
          if (char === '"') { quoted = !quoted; continue; }
          if (char === separator && !quoted) { values.push(current.trim()); current = ''; continue; }
          current += char;
        }
        values.push(current.trim());
        return values;
      };
      const header = parseLine(lines[0]).map((value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '_'));
      const column = (...names: string[]) => names.map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;
      const get = (values: string[], ...names: string[]) => { const index = column(...names); return index >= 0 ? values[index] || '' : ''; };
      const existingSkus = new Set(products.map((product: any) => String(product.sku || '').trim()).filter(Boolean));
      const existingBarcodes = new Set(products.map((product: any) => String(product.barcode || '').trim()).filter(Boolean));
      const pending: any[] = []; const skipped: string[] = [];
      lines.slice(1).forEach((line, rowIndex) => {
        const values = parseLine(line);
        const name = get(values, 'nome', 'name').trim();
        if (!name) { skipped.push(`linha ${rowIndex + 2}: sem nome`); return; }
        const sku = get(values, 'sku').trim(); const barcode = get(values, 'codigo_barras', 'barcode').trim();
        if (sku && existingSkus.has(sku)) { skipped.push(`linha ${rowIndex + 2}: SKU duplicado`); return; }
        if (barcode && existingBarcodes.has(barcode)) { skipped.push(`linha ${rowIndex + 2}: código de barras duplicado`); return; }
        if (sku) existingSkus.add(sku); if (barcode) existingBarcodes.add(barcode);
        const price = Number(get(values, 'preco_venda', 'preco', 'price').replace(/\./g, '').replace(',', '.')) || 0;
        const cost = Number(get(values, 'preco_custo', 'custo', 'cost').replace(/\./g, '').replace(',', '.')) || 0;
        pending.push({ company_id: selectedCompanyId, name, sku: sku || null, barcode: barcode || null, category: get(values, 'categoria', 'category') || null, brand: get(values, 'marca', 'brand') || null, price, ...(canManageCost ? { cost } : {}), status: 'active' });
      });
      if (pending.length === 0) throw new Error(skipped.length ? `Nenhuma linha válida. ${skipped.slice(0, 3).join('; ')}` : 'Nenhum produto válido encontrado.');
      setImportPreview(pending);
      setImportSkipped(skipped);
    } catch (error: any) {
      toast.error('Não foi possível importar o arquivo: ' + (error?.message || 'formato inválido.'));
    }
  };

  const updateImportRow = (index: number, patch: Record<string, unknown>) => {
    setImportPreview((current) => current?.map((item, rowIndex) => rowIndex === index ? { ...item, ...patch } : item) || null);
  };

  const confirmImport = async () => {
    if (!importPreview?.length) return;
    const existingSkus = new Set(products.map((product: any) => String(product.sku || '').trim()).filter(Boolean));
    const existingBarcodes = new Set(products.map((product: any) => String(product.barcode || '').trim()).filter(Boolean));
    const seenSkus = new Set<string>();
    const seenBarcodes = new Set<string>();
    const invalidRows: string[] = [];
    const normalizedRows = importPreview.map((item: any, index) => {
      const name = String(item.name || '').trim();
      const sku = String(item.sku || '').trim();
      const barcode = String(item.barcode || '').trim();
      const price = Number(item.price || 0);
      if (!name) invalidRows.push(`linha ${index + 1}: sem nome`);
      if (!Number.isFinite(price) || price < 0) invalidRows.push(`linha ${index + 1}: preço inválido`);
      if (sku && (existingSkus.has(sku) || seenSkus.has(sku))) invalidRows.push(`linha ${index + 1}: SKU duplicado`);
      if (barcode && (existingBarcodes.has(barcode) || seenBarcodes.has(barcode))) invalidRows.push(`linha ${index + 1}: código de barras duplicado`);
      if (sku) seenSkus.add(sku);
      if (barcode) seenBarcodes.add(barcode);
      return { ...item, name, sku: sku || null, barcode: barcode || null, price: Number.isFinite(price) ? price : 0, category: String(item.category || '').trim() || null, brand: String(item.brand || '').trim() || null };
    });
    if (invalidRows.length > 0) {
      toast.error(`Corrija a prévia antes de importar: ${invalidRows.slice(0, 2).join('; ')}${invalidRows.length > 2 ? '…' : ''}`);
      return;
    }
    setIsImporting(true);
    try {
      for (const data of normalizedRows) await productMutation.mutateAsync({ action: 'insert', data });
      toast.success(`${normalizedRows.length} produto(s) importado(s).${importSkipped.length ? ` ${importSkipped.length} linha(s) ignorada(s).` : ''}`);
      setImportPreview(null);
      setImportSkipped([]);
    } catch (error: any) {
      toast.error('Importação interrompida: ' + (error?.message || 'não foi possível salvar os produtos.'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleNewProduct = async (data: any) => {
    try {
      setIsSavingProduct(true);
      const inserted = await productMutation.mutateAsync({
        action: 'insert',
        data: {
          company_id: selectedCompanyId,
          name: data.name,
          sku: data.sku || null,
          barcode: data.barcode || null,
          created_by: data.created_by || null,
          category: data.category || null,
          brand: data.brand || null,
          product_type: data.product_type || 'product',
          unit: data.unit || 'un',
          supplier_name: data.supplier_name || null,
          price: parseFloat(data.price) || 0,
          cost: canManageCost ? parseFloat(data.cost) || 0 : undefined,
          min_stock: Math.max(parseInt(data.min_stock || '0', 10) || 0, 0),
          max_stock: data.max_stock ? Math.max(parseInt(data.max_stock, 10) || 0, 0) : null,
          description: data.description || null,
          status: 'active',
          image_url: data.imageUrl || null,
        },
      });
      if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
        await Promise.all(data.imageUrls.map((imageUrl: string, index: number) => productImageMutation.mutateAsync({ action: 'insert', data: { company_id: selectedCompanyId, product_id: inserted.id, image_url: imageUrl, is_primary: index === 0, sort_order: index } })));
      }
      // Insert stock for each store that has quantity > 0
      const stockEntries: Array<{ store_id: string; quantity: number }> = (data.stockByStore || []).filter((entry: { quantity: number }) => entry.quantity > 0);
      if (stockEntries.length > 0) {
        await Promise.all(
          stockEntries.map(entry =>
            productStockMutation.mutateAsync({
              action: 'insert',
              data: {
                product_id: inserted.id,
                store_id: entry.store_id,
                quantity: entry.quantity,
              },
            })
          )
        );
      }
      await queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] || '').startsWith('products') });
      toast.success(`${data.name} adicionado ao catálogo.`);
      setIsNewProductModalOpen(false);
    } catch (e: any) {
      toast.error('Erro ao cadastrar produto: ' + (e?.message || 'tente novamente.'));
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveProduct = async (data: any) => {
    if (!selectedProduct) return;
    try {
      setIsSavingProduct(true);
      await productMutation.mutateAsync({
        action: 'update',
        id: selectedProduct.id,
        data: {
          name: data.name,
          sku: data.sku || null,
          barcode: data.barcode || null,
          created_by: data.created_by || null,
          category: data.category || null,
          brand: data.brand || null,
          product_type: data.product_type || 'product',
          unit: data.unit || 'un',
          supplier_name: data.supplier_name || null,
          price: parseFloat(data.price) || 0,
          ...(canManageCost ? { cost: parseFloat(data.cost) || 0 } : {}),
          min_stock: Math.max(parseInt(data.min_stock || '0', 10) || 0, 0),
          max_stock: data.max_stock ? Math.max(parseInt(data.max_stock, 10) || 0, 0) : null,
          description: data.description || null,
          image_url: data.imageUrl || null,
        },
      });
      const imageUrls: string[] = Array.isArray(data.imageUrls) ? data.imageUrls : [];
      const existingImages: any[] = Array.isArray(selectedProduct.product_images) ? selectedProduct.product_images : [];
      if (imageUrls.length > 0) {
        await Promise.all(imageUrls.map((imageUrl, index) => {
          const current = existingImages[index];
          return productImageMutation.mutateAsync({
            action: current ? 'update' : 'insert',
            id: current?.id,
            data: current ? { image_url: imageUrl, is_primary: index === 0, sort_order: index } : { company_id: selectedCompanyId, product_id: selectedProduct.id, image_url: imageUrl, is_primary: index === 0, sort_order: index },
          });
        }));
      }
      // Upsert stock for each store
      const stockEntries: Array<{ store_id: string; quantity: number }> = data.stockByStore || [];
      if (stockEntries.length > 0) {
        const existing = Array.isArray(selectedProduct.product_stock) ? selectedProduct.product_stock : [];
        await Promise.all(
          stockEntries.map(entry => {
            const has = existing.find((s: any) => s.store_id === entry.store_id);
            return productStockMutation.mutateAsync({
              action: has ? 'update' : 'insert',
              id: has?.id,
              data: has
                ? { quantity: entry.quantity }
                : { product_id: selectedProduct.id, store_id: entry.store_id, quantity: entry.quantity },
            });
          })
        );
      }
      await queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] || '').startsWith('products') });
      toast.success(`${data.name} atualizado com sucesso.`);
      setIsDetailModalOpen(false);
      setIsEditingProduct(false);
    } catch (e: any) {
      toast.error('Erro ao atualizar produto: ' + (e?.message || 'tente novamente.'));
    } finally {
      setIsSavingProduct(false);
    }
  };

  const openProductDetail = (product: any) => {
    setSelectedProduct(product);
    setDetailView('details');
    setSelectedImageIndex(0);
    setIsEditingProduct(false);
    setIsDetailModalOpen(true);
  };

  const openProductHistory = (product: any) => {
    setSelectedProduct(product);
    setDetailView('history');
    setIsEditingProduct(false);
    setIsDetailModalOpen(true);
  };

  const openProductSales = (product: any) => {
    setSelectedProduct(product);
    setDetailView('sales');
    setIsEditingProduct(false);
    setIsDetailModalOpen(true);
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setIsEditingProduct(true);
    setDetailView('details');
    setIsDetailModalOpen(true);
  };

  const handleAddBrand = async (name: string) => {
    const normalized = name.trim();
    if (!normalized || !selectedCompanyId) return;
    try {
      const existing = productBrands.find((brand: any) => brand.name === editingBrand);
      await brandMutation.mutateAsync({ action: existing ? 'update' : 'insert', id: existing?.id, data: { company_id: selectedCompanyId, name: normalized, is_active: true } });
      toast.success(existing ? 'Marca atualizada!' : 'Marca cadastrada!');
      setIsNewBrandModalOpen(false);
      setEditingBrand(null);
    } catch (error: any) {
      toast.error('Não foi possível salvar a marca: ' + (error?.message || 'tente novamente.'));
    }
  };

  const handleAddCategory = async (name: string) => {
    const normalized = name.trim();
    if (!normalized || !selectedCompanyId) return;
    try {
      const existing = productCategories.find((category: any) => category.name === editingCategory);
      await categoryMutation.mutateAsync({ action: existing ? 'update' : 'insert', id: existing?.id, data: { company_id: selectedCompanyId, name: normalized, is_active: true } });
      toast.success(existing ? 'Categoria atualizada!' : 'Categoria cadastrada!');
      setIsNewCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (error: any) {
      toast.error('Não foi possível salvar a categoria: ' + (error?.message || 'tente novamente.'));
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'product') {
        if (!itemToDelete.id) throw new Error('Produto inválido.');
        await productMutation.mutateAsync({ action: 'delete', id: itemToDelete.id });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['product_movements'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['product_audits'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['service_orders'], refetchType: 'all' }),
        ]);
        toast.success('Produto excluído definitivamente.');
      } else {
        const collection = itemToDelete.type === 'brand' ? productBrands : productCategories;
        const existing = collection.find((item: any) => item.name === itemToDelete?.name);
        if (!existing) throw new Error('Registro não encontrado.');
        await (itemToDelete.type === 'brand' ? brandMutation : categoryMutation).mutateAsync({ action: 'update', id: existing.id, data: { is_active: false } });
        toast.success(`${itemToDelete.type === 'brand' ? 'Marca' : 'Categoria'} arquivada.`);
      }
    } catch (error: any) {
      toast.error('Não foi possível excluir: ' + (error?.message || 'tente novamente.'));
    } finally {
      setItemToDelete(null);
    }
  };

  const viewItemsByBrand = (brand: string) => { setBrandFilter(brand); setMainTab('catalog'); };
  const viewItemsByCategory = (category: string) => { setCategoryFilter(category); setMainTab('catalog'); };

  if (isLoading) return <LoadingSpinner message="Carregando produtos..." />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Produtos & Estoque"
        description="Gerenciamento centralizado de catálogo e níveis de estoque por unidade"
      />

      <FinancialInfoTip title="Como usar Produtos">Cadastre o produto uma vez, defina preço e estoque por loja e use o histórico para rastrear vendas, entradas, saídas e transferências. O preço de custo e ações sensíveis aparecem apenas para usuários autorizados.</FinancialInfoTip>

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 inline-flex w-full sm:w-auto overflow-x-auto no-scrollbar">
          <TabsTrigger value="catalog" className="gap-2 px-6">
            <PackageIcon className="h-4 w-4" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="brands" className="gap-2 px-6">
            <Tags className="h-4 w-4" /> Marcas
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2 px-6">
            <Layers className="h-4 w-4" /> Categorias
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 px-6">
            <Clock className="h-4 w-4" /> Histórico Geral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total de Produtos"
              value={stats.totalItems}
              icon={PackageIcon}
            />
            <KPICard 
              title={canViewStock ? "Estoque Baixo" : "Estoque (restrito)"}
              value={canViewStock ? stats.lowStockCount : '—'} 
              icon={AlertTriangle} 
              className={stats.lowStockCount > 0 ? "border-amber-200 bg-amber-50/30" : ""}
              accent="amber"
            />
            <KPICard 
              title={canViewStock ? "Sem Estoque" : "Disponibilidade (restrita)"}
              value={canViewStock ? stats.outOfStockCount : '—'} 
              icon={Box} 
              className={stats.outOfStockCount > 0 ? "border-destructive/20 bg-destructive/5" : ""}
              accent="destructive"
            />
            <KPICard 
              title={canViewStock ? "Valor Total em Estoque" : "Estoque protegido"}
              value={canViewStock ? stats.totalValue : '—'} 
              icon={DollarSign} 
              format="currency"
            />
          </div>

          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onApplyFilters={() => {}}
            onClearFilters={() => {
              setSearch('');
              setCategoryFilter('all');
              setBrandFilter('all');
              setStatusFilter('all');
              setLocalStoreFilter('all');
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
                  <StoreIcon className="h-3 w-3" /> Loja
                </label>
                <Select value={localStoreFilter} onValueChange={setLocalStoreFilter}>
                  <SelectTrigger className="h-10 border-border/60 bg-background/40 rounded-xl hover:border-primary/40 transition-all">
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
                  <PackageIcon className="h-3 w-3" /> Categoria
                </label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-10 border-border/60 bg-background/40 rounded-xl hover:border-primary/40 transition-all">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
                  <Tags className="h-3 w-3" /> Marca
                </label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="h-10 border-border/60 bg-background/40 rounded-xl hover:border-primary/40 transition-all">
                    <SelectValue placeholder="Todas as marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as marcas</SelectItem>
                    {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
                  <Filter className="h-3 w-3" /> Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 border-border/60 bg-background/40 rounded-xl hover:border-primary/40 transition-all">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterBar>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-4">
              <Tabs value={activeListTab} onValueChange={setActiveListTab} className="w-auto">
                <TabsList className="bg-muted/50 p-1 h-9 rounded-lg">
                  <TabsTrigger value="all" className="text-xs px-4 rounded-md">Todos</TabsTrigger>
                  <TabsTrigger value="low_stock" className="text-xs px-4 rounded-md">Estoque Baixo</TabsTrigger>
                  <TabsTrigger value="out_of_stock" className="text-xs px-4 rounded-md">Sem Estoque</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="hidden md:block text-[11px] text-muted-foreground font-medium">
                Exibindo {filteredProducts.length === 0 ? 0 : safeProductPage * PRODUCT_PAGE_SIZE + 1}-{Math.min((safeProductPage + 1) * PRODUCT_PAGE_SIZE, filteredProducts.length)} de {filteredProducts.length} produtos
              </div>
            </div>

            <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <PermissionGate module="products" action="import">
                <Button variant="outline" size="sm" className="flex-1 lg:flex-none gap-2 border-border/60 h-9 rounded-lg" onClick={handleImport}>
                  <Upload className="h-3.5 w-3.5" /> Importar
                </Button>
              </PermissionGate>
              <PermissionGate module="products" action="export">
                <Button variant="outline" size="sm" className="flex-1 lg:flex-none gap-2 border-border/60 h-9 rounded-lg" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> Exportar
                </Button>
              </PermissionGate>
              <PermissionGate module="products" action="manage_stock">
                <Button variant="outline" size="sm" className="flex-1 lg:flex-none gap-2 border-border/60 h-9 rounded-lg" onClick={() => { setSelectedProduct(null); setIsStockMovementModalOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" /> Entrada / Saída
                </Button>
                <Button variant="outline" size="sm" className="flex-1 lg:flex-none gap-2 border-border/60 h-9 rounded-lg" onClick={() => setIsTransferModalOpen(true)}>
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Transferência
                </Button>
                <Button variant="outline" size="sm" className="flex-1 lg:flex-none gap-2 border-border/60 h-9 rounded-lg" onClick={() => setIsInventoryModalOpen(true)}>
                  <ClipboardCheck className="h-3.5 w-3.5" /> Inventário
                </Button>
              </PermissionGate>
              <PermissionGate module="products" action="create">
                <Button size="sm" className="flex-1 lg:flex-none gap-2 bg-primary text-primary-foreground border-0 shadow-md shadow-primary/15 h-9 rounded-lg px-4" onClick={() => setIsNewProductModalOpen(true)}>
                  <Plus className="h-4 w-4" /> Novo Produto
                </Button>
              </PermissionGate>
            </div>
          </div>

          <Card className="premium-shadow border-border/60 overflow-hidden rounded-2xl">
            <CardContent className="p-0">
              <div className="divide-y divide-border/50 md:hidden">
                {filteredProducts.length === 0 ? <div className="px-4 py-14 text-center text-sm text-muted-foreground">Nenhum produto encontrado com os filtros atuais.</div> : catalogRows.map((p: any) => {
                  const effectiveStoreIds = localStoreFilter === 'all' ? selectedStoreIds : [localStoreFilter];
                  const totalStock = Array.isArray(p.product_stock) ? p.product_stock.filter((s: any) => effectiveStoreIds.includes(s.store_id)).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0) : 0;
                  const isOutOfStock = totalStock === 0;
                  return <button key={p.id} type="button" onClick={() => openProductDetail(p)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-muted">{p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <PackageIcon className="h-5 w-5 text-muted-foreground/50" />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{p.name}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.category || 'Sem categoria'} · SKU {p.sku || '—'}</p><p className="mt-1 text-xs font-black text-primary">R$ {(p.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    <div className="shrink-0 text-right"><span className={cn('text-xs font-black', isOutOfStock ? 'text-destructive' : totalStock <= 5 ? 'text-amber-600' : 'text-emerald-600')}>{canViewStock ? totalStock : '—'}</span><p className="text-[9px] uppercase tracking-wider text-muted-foreground">estoque</p><ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground/60" /></div>
                  </button>;
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60 bg-muted/30">
                      <TableHead className="w-[350px] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Produto</TableHead>
                      <TableHead className="min-w-[180px] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoria / Marca</TableHead>
                      <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Preço de Venda</TableHead>
                      {canViewStock && (stores as any[]).filter((s: any) => (localStoreFilter === 'all' ? selectedStoreIds.includes(s.id) : s.id === localStoreFilter)).map((s: any) => (
                        <TableHead key={s.id} className="text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.name.split(' - ')[1] || s.name}</TableHead>
                      ))}
                      {canViewStock && <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Estoque Total</TableHead>}
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Responsável</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6 + (stores as any[]).filter((s: any) => localStoreFilter === 'all' ? selectedStoreIds.includes(s.id) : s.id === localStoreFilter).length}
                          className="h-60 text-center"
                        >
                          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Search className="h-10 w-10 opacity-20" />
                            <p>Nenhum produto encontrado com os filtros selecionados.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      catalogRows.map((p: any) => {
                        const effectiveStoreIds = localStoreFilter === 'all' ? selectedStoreIds : [localStoreFilter];
                        const totalStock = Array.isArray(p.product_stock)
                          ? p.product_stock.filter((s: any) => effectiveStoreIds.includes(s.store_id)).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0)
                          : 0;
                        
                        const isLowStock = totalStock > 0 && totalStock <= 5;
                        const isOutOfStock = totalStock === 0;

                        return (
                          <TableRow 
                            key={p.id} 
                            className="group hover:bg-accent/30 transition-colors border-border/40 cursor-pointer"
                            onClick={() => openProductDetail(p)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-4">
                                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted transition-colors group-hover:border-primary/20">
                                  {p.image_url ? (
                                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <PackageIcon className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary/40 transition-colors" />
                                  )}
                                  {p.image_url && <Button type="button" variant="ghost" aria-label={`Visualizar foto de ${p.name}`} className="absolute inset-0 h-full w-full rounded-none bg-black/45 p-0 text-white opacity-0 transition-opacity hover:bg-black/55 group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); openProductDetail(p); }}><Eye className="h-4 w-4" /></Button>}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground uppercase tracking-tighter">SKU: {p.sku || '—'}</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[180px] align-middle">
                              <div className="flex min-h-[42px] flex-col justify-center gap-1 leading-tight">
                                <Badge variant="secondary" className="w-fit max-w-[170px] truncate text-[10px] py-0 h-4 bg-primary/5 text-primary border-primary/10">{p.category || '—'}</Badge>
                                <span className="max-w-[170px] truncate text-[11px] text-muted-foreground">{p.brand || '—'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-heading font-bold text-sm">R$ {(p.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                              {canViewCost && <div className="text-[10px] text-muted-foreground">Custo: R$ {(p.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                            </TableCell>
                            {canViewStock && (stores as any[]).filter((s: any) => (localStoreFilter === 'all' ? selectedStoreIds.includes(s.id) : s.id === localStoreFilter)).map((s: any) => (
                              <TableCell key={s.id} className="text-center"><div className="flex flex-col items-center"><span className={`text-[13px] font-bold ${getProductAvailable(p, s.id) <= 2 ? 'text-destructive' : 'text-foreground'}`}>{getProductAvailable(p, s.id)}</span>{getProductReserved(p, s.id) > 0 && <span className="text-[9px] text-primary">{getProductReserved(p, s.id)} reserv.</span>}</div></TableCell>
                            ))}
                            {canViewStock && <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className={cn(
                                  "text-sm font-bold",
                                  isOutOfStock ? "text-destructive" : isLowStock ? "text-amber-500" : "text-emerald-600"
                                )}>
                                  {totalStock}
                                </span>
                                {isLowStock && <span className="text-[9px] font-bold uppercase text-amber-500/80 tracking-tighter">Baixo</span>}
                                {isOutOfStock && <span className="text-[9px] font-bold uppercase text-destructive/80 tracking-tighter">Zerado</span>}
                              </div>
                            </TableCell>}
                            <TableCell>
                              {(() => {
                                const emp = employees.find((e: any) => e.id === p.created_by);
                                const name = emp?.name || (p.created_by ? p.created_by.slice(0, 8) : '—');
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <User className="h-2.5 w-2.5 text-primary/60" />
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{name}</span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={p.status} />
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted/80 rounded-lg" onClick={(event) => event.stopPropagation()}>
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl">
                                  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground font-bold px-2 py-1.5">Ações</DropdownMenuLabel>
                                  <PermissionGate module="products" action="edit">
                                    <DropdownMenuItem className="gap-2 text-[13px] cursor-pointer rounded-lg" onClick={(e) => { e.stopPropagation(); handleEditProduct(p); }}>
                                      <Edit2 className="h-3.5 w-3.5" /> Editar Produto
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  <PermissionGate module="products" action="view_stock_history">
                                    <DropdownMenuItem className="gap-2 text-[13px] cursor-pointer rounded-lg" onClick={(e) => { e.stopPropagation(); openProductHistory(p); }}>
                                      <History className="h-3.5 w-3.5" /> Histórico de Estoque
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  <PermissionGate module="products" action="view_sales_history">
                                    <DropdownMenuItem className="gap-2 text-[13px] cursor-pointer rounded-lg" onClick={(e) => { e.stopPropagation(); openProductSales(p); }}>
                                      <ShoppingCart className="h-3.5 w-3.5" /> Ver Vendas
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  <PermissionGate module="products" action="manage_stock">
                                    <DropdownMenuItem className="gap-2 text-[13px] cursor-pointer rounded-lg" onClick={(e) => { e.stopPropagation(); setSelectedProduct(p); setIsStockMovementModalOpen(true); }}>
                                      <Plus className="h-3.5 w-3.5" /> Movimentar estoque
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  <DropdownMenuSeparator className="my-1" />
                                  <PermissionGate module="products" action="delete_permanently">
                                    <DropdownMenuItem className="gap-2 text-[13px] cursor-pointer rounded-lg text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'product', name: p.name, id: p.id }); }}>
                                      <Trash2 className="h-3.5 w-3.5" /> Excluir Produto
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {catalogPageCount > 1 && (
                <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted-foreground">Página {safeProductPage + 1} de {catalogPageCount}{isServerPageLoading ? ' · carregando' : ''}</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" disabled={safeProductPage === 0} onClick={() => setProductPage(Math.max(0, safeProductPage - 1))}>Anterior</Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" disabled={safeProductPage >= catalogPageCount - 1} onClick={() => setProductPage(Math.min(catalogPageCount - 1, safeProductPage + 1))}>Próxima</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands" className="mt-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Tags className="h-5 w-5 text-primary" /> Gerenciamento de Marcas
              </h3>
              <p className="text-sm text-muted-foreground">Total de {brandList.length} marcas cadastradas</p>
            </div>
            <PermissionGate module="products" action="manage_categories">
              <Button size="sm" className="bg-primary text-primary-foreground border-0 shadow-md shadow-primary/15 h-9 rounded-lg px-4 gap-2" onClick={() => { setEditingBrand(null); setIsNewBrandModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Nova Marca
              </Button>
            </PermissionGate>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {brandList.map((brand) => (
              <Card key={brand} className="group hover:border-primary/30 transition-all duration-300 premium-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                      {brand.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{brand}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        {products.filter(p => p.brand === brand).length} Produtos
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-xl p-1">
                      <PermissionGate module="products" action="manage_categories">
                        <DropdownMenuItem 
                          className="gap-2 text-[13px] rounded-lg cursor-pointer"
                          onClick={() => {
                            setEditingBrand(brand);
                            setIsNewBrandModalOpen(true);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                      </PermissionGate>
                      <DropdownMenuItem 
                        className="gap-2 text-[13px] rounded-lg cursor-pointer"
                        onClick={() => viewItemsByBrand(brand)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver Produtos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <PermissionGate module="products" action="manage_categories">
                        <DropdownMenuItem 
                          className="gap-2 text-[13px] rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5"
                          onClick={() => setItemToDelete({ type: 'brand', name: brand })}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
            {brandList.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground">Nenhuma marca cadastrada.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" /> Categorias de Produtos
              </h3>
              <p className="text-sm text-muted-foreground">Total de {categoryList.length} categorias catalogadas</p>
            </div>
            <PermissionGate module="products" action="manage_categories">
              <Button size="sm" className="bg-primary text-primary-foreground border-0 shadow-md shadow-primary/15 h-9 rounded-lg px-4 gap-2" onClick={() => { setEditingCategory(null); setIsNewCategoryModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Nova Categoria
              </Button>
            </PermissionGate>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryList.map((category) => (
              <Card key={category} className="group hover:border-primary/30 transition-all duration-300 premium-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{category}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        {products.filter(p => p.category === category).length} Produtos
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-xl p-1">
                      <PermissionGate module="products" action="manage_categories">
                        <DropdownMenuItem 
                          className="gap-2 text-[13px] rounded-lg cursor-pointer"
                          onClick={() => {
                            setEditingCategory(category);
                            setIsNewCategoryModalOpen(true);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                      </PermissionGate>
                      <DropdownMenuItem 
                        className="gap-2 text-[13px] rounded-lg cursor-pointer"
                        onClick={() => viewItemsByCategory(category)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver Produtos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <PermissionGate module="products" action="manage_categories">
                        <DropdownMenuItem 
                          className="gap-2 text-[13px] rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5"
                          onClick={() => setItemToDelete({ type: 'category', name: category })}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
            {categoryList.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground">Nenhuma categoria cadastrada.</p>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          <SalesHistoryPanel
            rows={filteredSaleHistoryRows}
            summary={saleHistorySummary}
            stores={stores}
            search={historySearch}
            storeFilter={historyStoreFilter}
            statusFilter={historyStatusFilter}
            paymentFilter={historyPaymentFilter}
            onSearchChange={setHistorySearch}
            onStoreChange={setHistoryStoreFilter}
            onStatusChange={setHistoryStatusFilter}
            onPaymentChange={setHistoryPaymentFilter}
            onClear={() => {
              setHistorySearch('');
              setHistoryStoreFilter('all');
              setHistoryStatusFilter('all');
              setHistoryPaymentFilter('all');
            }}
            selectedSale={selectedHistorySale}
            onSelectSale={setSelectedHistorySale}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isNewProductModalOpen} onOpenChange={setIsNewProductModalOpen}>
        <DialogContent className="!flex h-[calc(100dvh-1rem)] max-h-[760px] w-[calc(100%-1rem)] flex-col gap-0 rounded-2xl border-none p-0 shadow-2xl overflow-hidden sm:max-w-[600px]">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background px-5 py-3 border-b border-primary/5">
            <DialogHeader>
              <DialogTitle className="text-lg font-heading font-bold text-primary flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                Cadastrar Novo Produto
              </DialogTitle>
              <DialogDescription className="sr-only">Preencha os dados para cadastrar um novo produto no catálogo.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
            <ProductForm
              onSubmit={handleNewProduct}
              onCancel={() => setIsNewProductModalOpen(false)}
              categories={categoryList}
              brands={brandList}
              stores={stores}
              employees={employees}
              isSubmitting={isSavingProduct || productMutation.isPending}
              onCreateCategory={() => { setEditingCategory(null); setIsNewCategoryModalOpen(true); }}
              onCreateBrand={() => { setEditingBrand(null); setIsNewBrandModalOpen(true); }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className={cn(
          "!flex h-[calc(100dvh-1rem)] max-h-[840px] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border-none p-0 shadow-2xl transition-all duration-300 sm:w-full sm:rounded-[24px]",
          isEditingProduct ? "sm:max-w-[600px]" : "sm:max-w-[800px]"
        )}>
          <DialogHeader className="sr-only"><DialogTitle>Produto</DialogTitle><DialogDescription>Detalhes e edição do produto.</DialogDescription></DialogHeader>
          {selectedProduct && isEditingProduct ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 bg-gradient-to-br from-primary/10 via-background to-background px-5 py-3 border-b border-primary/5">
                <DialogHeader>
                  <DialogTitle className="text-lg font-heading font-bold text-primary flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Edit2 className="h-4 w-4" />
                    </div>
                    Editar Produto
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                <ProductForm
                  initialData={selectedProduct}
                  onSubmit={handleSaveProduct}
                  onCancel={() => setIsEditingProduct(false)}
                  categories={categoryList}
                  brands={brandList}
                  stores={stores}
                  employees={employees}
                  isSubmitting={isSavingProduct || productMutation.isPending}
                  onCreateCategory={() => { setEditingCategory(null); setIsNewCategoryModalOpen(true); }}
                  onCreateBrand={() => { setEditingBrand(null); setIsNewBrandModalOpen(true); }}
                />
              </div>
            </div>
          ) : selectedProduct && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <div className="relative h-32 sm:h-40 w-full shrink-0 overflow-hidden bg-muted">
                {selectedProductImages.length > 0 ? (
                  <img
                    src={selectedProductImages[selectedImageIndex] || selectedProductImages[0]}
                    alt={`${selectedProduct.name} — foto ${selectedImageIndex + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <PackageIcon className="h-16 w-16 text-muted-foreground/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                {selectedProductImages.length > 1 && <div className="absolute right-4 top-4 flex max-w-[48%] gap-1.5 overflow-x-auto rounded-xl bg-black/35 p-1.5 backdrop-blur-sm">
                  {selectedProductImages.map((image: string, index: number) => <button key={`${image}-${index}`} type="button" aria-label={`Selecionar foto ${index + 1}`} onClick={(event) => { event.stopPropagation(); setSelectedImageIndex(index); }} className={cn("h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2 transition", selectedImageIndex === index ? "border-primary" : "border-white/40 opacity-75 hover:opacity-100")}><img src={image} alt={`Miniatura ${index + 1}`} className="h-full w-full object-cover" /></button>)}
                </div>}
                <div className="absolute bottom-4 left-5 right-5">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge className="border-none bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{selectedProduct.category || 'Sem categoria'}</Badge>
                    <StatusBadge status={selectedProduct.status} />
                    <Badge variant="outline" className="border-white/35 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                      {detailView === 'details' ? 'Visão geral' : detailView === 'sales' ? 'Vendas' : detailView === 'audit' ? 'Auditoria' : 'Movimentações'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-heading font-bold leading-tight text-white sm:text-2xl">{selectedProduct.name}</h2>
                      <p className="mt-1 flex items-center gap-2 text-[11px] text-white/75"><span>{selectedProduct.sku ? `SKU ${selectedProduct.sku}` : 'SKU não informado'}</span><span className="text-white/40">•</span><span>{selectedProduct.product_type || 'Produto'}</span></p>
                    </div>
                    <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-sm">{selectedProductImages.length} foto(s)</span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                {detailView === 'details' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2 space-y-5">
                      <section>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                          <Info className="h-4 w-4 text-primary" /> Sobre o Produto
                        </h3>
                        <p className="text-foreground/80 leading-relaxed text-lg italic font-medium">
                          {selectedProduct.description || "Nenhuma descrição detalhada disponível para este produto no momento."}
                        </p>
                      </section>

                      <section className={cn("pt-4", !canViewStock && "hidden")}>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" /> Distribuição de Estoque
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {stores.map(store => {
                            const stockRecord = Array.isArray(selectedProduct.product_stock)
                              ? selectedProduct.product_stock.find((s: any) => s.store_id === store.id)
                              : undefined;
                            const physical = Number(stockRecord?.quantity || 0);
                            const reserved = Number(stockRecord?.reserved_quantity || 0);
                            const available = Math.max(physical - reserved, 0);
                            return (
                              <div key={store.id} className="p-3 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-3 group hover:bg-muted/50 transition-colors">
                                <div className="min-w-0 space-y-0.5">
                                  <p className="truncate text-sm font-bold text-foreground">{store.name.split(' - ')[1] || store.name}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase font-medium">{store.city}, {store.state}</p>
                                  <p className="text-[10px] text-muted-foreground">Físico {physical}{reserved > 0 ? ` · ${reserved} reservado(s)` : ''}</p>
                                </div>
                                <div className={cn(
                                  "flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-2 font-bold text-sm",
                                  available === 0 ? "bg-destructive/10 text-destructive" :
                                  available <= 5 ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                                )}>
                                  {available}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-4">
                      <Card className="border-none bg-primary/5 rounded-3xl overflow-hidden">
                        <CardContent className="p-6 space-y-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/60">Preço de Venda</p>
                            <p className="text-3xl font-heading font-black text-primary">
                              R$ {(selectedProduct.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="h-px bg-primary/10 w-full" />
                          {canViewCost && <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custo</p>
                              <p className="font-bold text-foreground">R$ {(selectedProduct.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Margem</p>
                              <p className="font-bold text-green-600">
                                {selectedProduct.price > 0
                                  ? Math.round(((selectedProduct.price - (selectedProduct.cost || 0)) / selectedProduct.price) * 100)
                                  : 0}%
                              </p>
                            </div>
                          </div>}
                        </CardContent>
                      </Card>

                      <div className="rounded-2xl border border-border/40 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex items-center gap-1.5 font-medium uppercase tracking-tighter text-muted-foreground"><Barcode className="h-3 w-3" /> SKU</span>
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="max-w-[125px] truncate rounded bg-muted px-2 py-0.5 font-mono font-bold text-foreground">{selectedProduct.sku || '—'}</span>
                            <Button type="button" variant="ghost" size="icon" aria-label="Copiar SKU" className="h-6 w-6 shrink-0" onClick={() => copyProductValue('SKU', selectedProduct.sku)}><Copy className="h-3 w-3" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex items-center gap-1.5 font-medium uppercase tracking-tighter text-muted-foreground"><Barcode className="h-3 w-3" /> Código</span>
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="max-w-[125px] truncate rounded bg-muted px-2 py-0.5 font-mono font-bold text-foreground">{selectedProduct.barcode || '—'}</span>
                            <Button type="button" variant="ghost" size="icon" aria-label="Copiar código de barras" className="h-6 w-6 shrink-0" onClick={() => copyProductValue('Código de barras', selectedProduct.barcode)}><Copy className="h-3 w-3" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs">
                          <div><p className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground">Marca</p><p className="mt-0.5 truncate font-bold text-foreground">{selectedProduct.brand || '—'}</p></div>
                          <div><p className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground">Unidade</p><p className="mt-0.5 truncate font-bold text-foreground">{selectedProduct.unit || 'un'}</p></div>
                          <div><p className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground">Fornecedor</p><p className="mt-0.5 truncate font-bold text-foreground">{selectedProduct.supplier_name || '—'}</p></div>
                          <div><p className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground">Reposição</p><p className="mt-0.5 truncate font-bold text-foreground">Mín. {Number(selectedProduct.min_stock || 0)}{selectedProduct.max_stock ? ` · Máx. ${selectedProduct.max_stock}` : ''}</p></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <PermissionGate module="products" action="edit">
                          <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground border-0 shadow-lg shadow-primary/20 font-bold gap-2" onClick={() => setIsEditingProduct(true)}>
                            <Edit2 className="h-4 w-4" /> Editar Produto
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="products" action="manage_stock">
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-10 rounded-xl border-border/60 font-bold gap-1.5" onClick={() => setIsStockMovementModalOpen(true)}>
                              <ArrowRightLeft className="h-3.5 w-3.5" /> Movimentar
                            </Button>
                            <Button variant="outline" className="h-10 rounded-xl border-border/60 font-bold gap-1.5" onClick={() => setIsInventoryModalOpen(true)}>
                              <ClipboardCheck className="h-3.5 w-3.5" /> Inventário
                            </Button>
                          </div>
                        </PermissionGate>
                        <Button 
                          variant="outline" 
                          className="w-full h-12 rounded-2xl border-border/60 font-bold gap-2"
                          onClick={() => setDetailView('history')}
                        >
                          <History className="h-4 w-4" /> Histórico
                        </Button>
                        <PermissionGate module="products" action="view_audit">
                          <Button variant="outline" className="w-full h-12 rounded-2xl border-border/60 font-bold gap-2" onClick={() => setDetailView('audit')}>
                            <Clock className="h-4 w-4" /> Auditoria
                          </Button>
                        </PermissionGate>
                      </div>
                    </div>
                  </div>
                ) : detailView === 'history' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" /> Histórico de Movimentação
                      </h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary gap-1"
                        onClick={() => setDetailView('details')}
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" /> Voltar para detalhes
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-[10px] uppercase font-bold">Data</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold">Tipo</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-center">Qtd</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold">Usuário</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold">Loja</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold">Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productMovements.filter(m => m.productId === selectedProduct.id).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-xs">
                                Nenhuma movimentação registrada para este produto.
                              </TableCell>
                            </TableRow>
                          ) : productMovements
                            .filter(m => m.productId === selectedProduct.id)
                            .map(m => (
                              <TableRow
                                key={m.id}
                                className="text-xs hover:bg-accent/30 transition-colors border-border/40 cursor-pointer"
                                onClick={() => {
                                  setSelectedMovement(m);
                                  setIsMovementModalOpen(true);
                                }}
                              >
                                <TableCell className="whitespace-nowrap text-muted-foreground">{m.date}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] h-4 gap-0.5 capitalize",
                                      m.type === 'in' || m.type === 'addition' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" :
                                      m.type === 'out' || m.type === 'sale' || m.type === 'os' || m.type === 'removal' ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20" :
                                      m.type === 'transfer' ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" :
                                      "bg-primary/5 text-primary border-primary/15"
                                    )}
                                  >
                                    {m.type === 'in' || m.type === 'addition' ? 'Entrada' :
                                     m.type === 'out' ? 'Saída' :
                                     m.type === 'sale' ? 'Venda' :
                                     m.type === 'os' ? 'O.S.' :
                                     m.type === 'transfer' ? 'Transferência' :
                                     m.type === 'removal' ? 'Remoção' : 'Ajuste'}
                                  </Badge>
                                </TableCell>
                                <TableCell className={cn(
                                  "text-center font-bold",
                                  m.quantity > 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                </TableCell>
                                <TableCell className="font-medium">{m.user}</TableCell>
                                <TableCell className="text-muted-foreground">{(m.store || '—').split(' - ')[1] || m.store}</TableCell>
                                <TableCell className="text-muted-foreground italic truncate max-w-[150px]">{m.description}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : detailView === 'audit' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Auditoria do Produto</h3>
                      <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => setDetailView('details')}><ChevronRight className="h-4 w-4 rotate-180" /> Voltar para detalhes</Button>
                    </div>
                    <FinancialInfoTip title="Dica de auditoria">Aqui ficam as alterações de cadastro, preço, custo, status e outros campos sensíveis, sempre associadas ao usuário autenticado.</FinancialInfoTip>
                    <div className="overflow-x-auto rounded-2xl border border-border/40">
                      <Table><TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[10px] uppercase font-bold">Data</TableHead><TableHead className="text-[10px] uppercase font-bold">Ação</TableHead><TableHead className="text-[10px] uppercase font-bold">Campo</TableHead><TableHead className="text-[10px] uppercase font-bold">Antes</TableHead><TableHead className="text-[10px] uppercase font-bold">Depois</TableHead><TableHead className="text-[10px] uppercase font-bold">Responsável</TableHead></TableRow></TableHeader><TableBody>
                        {productAudits.length === 0 ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">Nenhuma alteração auditada para este produto.</TableCell></TableRow> : productAudits.map((audit: any) => <TableRow key={audit.id} className="border-border/40"><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{audit.created_at ? new Date(audit.created_at).toLocaleString('pt-BR') : '—'}</TableCell><TableCell className="text-xs font-semibold">{audit.action === 'created' ? 'Criado' : 'Alterado'}</TableCell><TableCell className="text-xs font-mono">{audit.field_name || 'Cadastro'}</TableCell><TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{audit.old_value || '—'}</TableCell><TableCell className="max-w-[160px] truncate text-xs">{audit.new_value || '—'}</TableCell><TableCell className="text-xs font-medium">{audit.user_name || audit.user_id || 'Sistema'}</TableCell></TableRow>)}
                      </TableBody></Table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Histórico de Vendas</h3>
                      <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => setDetailView('details')}><ChevronRight className="h-4 w-4 rotate-180" /> Voltar para detalhes</Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Card className="border-border/60"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vendas</p><p className="mt-1 text-2xl font-bold text-foreground">{selectedProductSales.length}</p></CardContent></Card>
                      <Card className="border-border/60"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unidades vendidas</p><p className="mt-1 text-2xl font-bold text-primary">{selectedProductSales.reduce((sum: number, sale: any) => sum + Number(sale.qty || 0), 0)}</p></CardContent></Card>
                      <Card className="border-border/60"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receita gerada</p><p className="mt-1 text-2xl font-bold text-emerald-600">R$ {selectedProductSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-border/40">
                      <Table><TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[10px] uppercase font-bold">Data</TableHead><TableHead className="text-[10px] uppercase font-bold">Venda</TableHead><TableHead className="text-[10px] uppercase font-bold">Cliente</TableHead><TableHead className="text-[10px] uppercase font-bold">Loja</TableHead><TableHead className="text-[10px] uppercase font-bold text-center">Qtd.</TableHead><TableHead className="text-[10px] uppercase font-bold text-right">Total</TableHead></TableRow></TableHeader><TableBody>
                        {selectedProductSales.length === 0 ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">Nenhuma venda registrada para este produto.</TableCell></TableRow> : selectedProductSales.map((sale: any) => <TableRow key={`${sale.saleId}-${sale.productId}`} className="border-border/40"><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{sale.date ? new Date(sale.date).toLocaleDateString('pt-BR') : '—'}</TableCell><TableCell className="font-mono text-xs">#{String(sale.saleId).slice(0, 8)}</TableCell><TableCell className="text-sm">{sale.customerName}</TableCell><TableCell className="text-xs text-muted-foreground">{sale.storeName}</TableCell><TableCell className="text-center text-sm font-bold">{sale.qty}</TableCell><TableCell className="text-right text-sm font-bold">R$ {Number(sale.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell></TableRow>)}
                      </TableBody></Table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!importPreview} onOpenChange={(open) => !open && !isImporting && setImportPreview(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary"><Upload className="h-5 w-5" /> Prévia da importação</DialogTitle>
            <DialogDescription>Confira os produtos antes de confirmar a gravação no catálogo.</DialogDescription>
          </DialogHeader>
          <FinancialInfoTip title="Dica de importação">A prévia não altera o banco. Somente ao confirmar os itens válidos serão cadastrados; linhas duplicadas ou sem nome ficam fora da operação.</FinancialInfoTip>
          <div className="rounded-2xl border border-border/60 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-3 text-sm"><span><strong>{importPreview?.length || 0}</strong> produto(s) válido(s)</span>{importSkipped.length > 0 && <span className="text-amber-600"><strong>{importSkipped.length}</strong> linha(s) ignorada(s)</span>}</div>
            <div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead className="min-w-[220px]">Produto</TableHead><TableHead className="min-w-[140px]">SKU</TableHead><TableHead className="min-w-[150px]">Código</TableHead><TableHead className="min-w-[150px]">Categoria</TableHead><TableHead className="min-w-[150px]">Marca</TableHead><TableHead className="min-w-[120px] text-right">Preço</TableHead></TableRow></TableHeader><TableBody>{(importPreview || []).slice(0, 100).map((item: any, index: number) => <TableRow key={`${item.sku || item.name}-${index}`}><TableCell><Input value={item.name || ''} onChange={(event) => updateImportRow(index, { name: event.target.value })} className="h-8 min-w-[210px] rounded-lg text-xs" /></TableCell><TableCell><Input value={item.sku || ''} onChange={(event) => updateImportRow(index, { sku: event.target.value })} className="h-8 min-w-[130px] rounded-lg font-mono text-xs" /></TableCell><TableCell><Input value={item.barcode || ''} onChange={(event) => updateImportRow(index, { barcode: event.target.value })} className="h-8 min-w-[140px] rounded-lg font-mono text-xs" /></TableCell><TableCell><Input value={item.category || ''} onChange={(event) => updateImportRow(index, { category: event.target.value })} className="h-8 min-w-[140px] rounded-lg text-xs" placeholder="Avulsa" /></TableCell><TableCell><Input value={item.brand || ''} onChange={(event) => updateImportRow(index, { brand: event.target.value })} className="h-8 min-w-[140px] rounded-lg text-xs" placeholder="Avulsa" /></TableCell><TableCell><Input type="number" min="0" step="0.01" value={item.price ?? 0} onChange={(event) => updateImportRow(index, { price: event.target.value })} className="h-8 min-w-[110px] rounded-lg text-right text-xs" /></TableCell></TableRow>)}</TableBody></Table></div>
            {(importPreview?.length || 0) > 100 && <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">Mostrando os primeiros 100 itens da prévia.</p>}
          </div>
          {importSkipped.length > 0 && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">{importSkipped.slice(0, 5).join(' · ')}{importSkipped.length > 5 ? ' · …' : ''}</div>}
          <div className="flex gap-2 pt-2"><Button type="button" variant="outline" className="flex-1 rounded-xl" disabled={isImporting} onClick={() => setImportPreview(null)}>Cancelar</Button><Button type="button" className="flex-1 rounded-xl bg-primary text-primary-foreground" disabled={isImporting} onClick={confirmImport}>{isImporting ? 'Importando...' : 'Confirmar importação'}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewBrandModalOpen} onOpenChange={setIsNewBrandModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-primary">
              {editingBrand ? 'Editar Marca' : 'Adicionar Nova Marca'}
            </DialogTitle>
            <DialogDescription className="sr-only">Gerencie marcas de produtos.</DialogDescription>
          </DialogHeader>
          <FinancialInfoTip title="Dica de marca">Marcas estruturam a busca e os relatórios do catálogo. Arquive uma marca apenas quando ela não tiver mais uso; o histórico dos produtos permanece preservado.</FinancialInfoTip>
          <form className="space-y-4 pt-4" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleAddBrand(formData.get('name') as string);
          }}>
            <div className="space-y-2">
              <Label htmlFor="brand-name">Nome da Marca</Label>
              <Input 
                id="brand-name" 
                name="name" 
                placeholder="Ex: Ray-Ban, Oakley..." 
                defaultValue={editingBrand || ''}
                required 
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 rounded-xl" 
                onClick={() => setIsNewBrandModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-primary text-primary-foreground border-0 rounded-xl">
                {editingBrand ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewCategoryModalOpen} onOpenChange={setIsNewCategoryModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-primary">
              {editingCategory ? 'Editar Categoria' : 'Adicionar Nova Categoria'}
            </DialogTitle>
            <DialogDescription className="sr-only">Gerencie categorias de produtos.</DialogDescription>
          </DialogHeader>
          <FinancialInfoTip title="Dica de categoria">Use categorias consistentes para facilitar filtros, estoque mínimo e relatórios. O arquivamento é reversível e não remove produtos existentes.</FinancialInfoTip>
          <form className="space-y-4 pt-4" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleAddCategory(formData.get('name') as string);
          }}>
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome da Categoria</Label>
              <Input 
                id="category-name" 
                name="name" 
                placeholder="Ex: Armações, Lentes..." 
                defaultValue={editingCategory || ''}
                required 
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 rounded-xl" 
                onClick={() => setIsNewCategoryModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-primary text-primary-foreground border-0 rounded-xl">
                {editingCategory ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="rounded-3xl p-6">
          <AlertDialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {itemToDelete?.type === 'product' ? (
                <>Você está prestes a excluir definitivamente o produto <strong>{itemToDelete?.name}</strong>. O vínculo do produto será removido de estoque, fotos, movimentos e auditorias; vendas e O.S. manterão apenas a descrição histórica do item.</>
              ) : (
                <>Você está prestes a arquivar {itemToDelete?.type === 'brand' ? 'a marca' : 'a categoria'} <strong>{itemToDelete?.name}</strong>. Os produtos existentes serão preservados.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-center pt-2">
            <AlertDialogCancel className="flex-1 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-white border-0 rounded-xl"
            >
              {itemToDelete?.type === 'product' ? 'Excluir definitivamente' : 'Confirmar arquivamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-[32px]">
          <DialogHeader className="sr-only"><DialogTitle>Movimentação</DialogTitle><DialogDescription>Detalhes da movimentação de estoque.</DialogDescription></DialogHeader>
          {selectedMovement && (
            <div className="flex flex-col h-full">
              <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 border-b border-primary/5">
                <DialogHeader>
                  <div className="flex items-center gap-4 mb-2">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm",
                      selectedMovement.type === 'in' || selectedMovement.type === 'addition' ? "bg-emerald-500/10 text-emerald-600" :
                      selectedMovement.type === 'out' || selectedMovement.type === 'sale' || selectedMovement.type === 'os' || selectedMovement.type === 'removal' ? "bg-red-500/10 text-red-600" :
                      selectedMovement.type === 'transfer' ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                    )}>
                      {(selectedMovement.type === 'in' || selectedMovement.type === 'addition') && <Plus className="h-6 w-6" />}
                      {(selectedMovement.type === 'out' || selectedMovement.type === 'removal') && <Trash2 className="h-6 w-6" />}
                      {selectedMovement.type === 'sale' && <ShoppingCart className="h-6 w-6" />}
                      {selectedMovement.type === 'os' && <Barcode className="h-6 w-6" />}
                      {selectedMovement.type === 'adjustment' && <ArrowRightLeft className="h-6 w-6" />}
                      {selectedMovement.type === 'transfer' && <ArrowUpDown className="h-6 w-6" />}
                      {selectedMovement.type === 'edit' && <Edit2 className="h-6 w-6" />}
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-heading font-bold text-primary">
                        Detalhes da Movimentação
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground">{selectedMovement.date}</p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Produto</Label>
                    <p className="font-bold text-foreground text-lg">{selectedMovement.productName}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Tipo de Operação</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize font-bold py-1 px-3 rounded-full">
                        {selectedMovement.type === 'in' ? 'Entrada' : 
                         selectedMovement.type === 'out' ? 'Saída' : 
                         selectedMovement.type === 'sale' ? 'Venda' : 
                         selectedMovement.type === 'os' ? 'O.S.' : 
                         selectedMovement.type === 'adjustment' ? 'Ajuste' :
                         selectedMovement.type === 'transfer' ? 'Transferência' :
                         selectedMovement.type === 'reserve' ? 'Reserva' :
                         selectedMovement.type === 'release' ? 'Liberação de reserva' :
                         selectedMovement.type === 'edit' ? 'Edição' :
                         selectedMovement.type === 'removal' ? 'Remoção' : 'Adição'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Responsável</Label>
                    <div className="flex items-center gap-2 font-medium">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {selectedMovement.user && selectedMovement.user !== '—'
                          ? selectedMovement.user.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                          : '?'}
                      </div>
                      {selectedMovement.user}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Unidade / Loja</Label>
                    <p className="font-medium flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {(selectedMovement.store || '—').split(' - ')[1] || selectedMovement.store}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-3xl p-6 border border-border/40">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-4 block text-center">
                      {selectedMovement.reference_type === 'reservation' ? 'Alteração da Reserva' : 'Alteração de Valores'}
                    </Label>
                    <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-center space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Antes</p>
                      <div className="bg-card/60 py-4 px-2 rounded-2xl border border-border/30">
                        <span className="text-xl font-black text-rose-500 line-through opacity-70">
                          {selectedMovement.reference_type === 'reservation' ? (selectedMovement.reservedBefore ?? 0) : (selectedMovement.before ?? "N/A")}
                        </span>
                      </div>
                    </div>

                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-6">
                      <ChevronRight className="h-6 w-6" />
                    </div>

                    <div className="flex-1 text-center space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Depois</p>
                      <div className="bg-primary/5 py-4 px-2 rounded-2xl border border-primary/20 ring-4 ring-primary/5">
                        <span className="text-2xl font-black text-emerald-600">
                          {selectedMovement.reference_type === 'reservation' ? (selectedMovement.reservedAfter ?? 0) : (selectedMovement.after ?? "N/A")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Descrição / Observações
                  </Label>
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 text-sm italic text-muted-foreground leading-relaxed">
                    "{selectedMovement.description || "Nenhuma observação adicional foi registrada para esta movimentação."}"
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border/40 bg-muted/10 flex justify-end">
                <Button 
                  onClick={() => setIsMovementModalOpen(false)}
                  className="rounded-xl px-8 bg-primary text-primary-foreground"
                >
                  Fechar Detalhes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StockMovementModal
        open={isStockMovementModalOpen}
        onOpenChange={setIsStockMovementModalOpen}
        products={products}
        stores={stores}
        defaultProductId={selectedProduct?.id || ''}
        defaultStoreId={localStoreFilter !== 'all' ? localStoreFilter : selectedStoreIds[0] || ''}
      />
      <InventoryModal
        open={isInventoryModalOpen}
        onOpenChange={setIsInventoryModalOpen}
        products={products}
        stores={stores}
        defaultProductId={selectedProduct?.id || ''}
        defaultStoreId={localStoreFilter !== 'all' ? localStoreFilter : selectedStoreIds[0] || ''}
      />
      <TransferStockModal
        open={isTransferModalOpen}
        onOpenChange={setIsTransferModalOpen}
        products={products}
        stores={stores}
      />
    </div>
  );
}
