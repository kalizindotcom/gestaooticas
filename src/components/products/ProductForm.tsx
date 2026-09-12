import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Barcode, Scan, Package, Tag, DollarSign, Box,
  Image as ImageIcon, X, FileText, Store as StoreIcon, User, Lock, Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { FinancialInfoTip } from "@/components/financial/FinancialInfoTip";
import { toast } from 'sonner';

interface StoreRef { id: string; name: string; }
interface EmployeeRef { id: string; name: string; }

interface ProductFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  categories?: string[];
  brands?: string[];
  stores?: StoreRef[];
  employees?: EmployeeRef[];
  onCreateCategory?: () => void;
  onCreateBrand?: () => void;
  isSubmitting?: boolean;
}

export function ProductForm({
  onSubmit, onCancel, initialData,
  categories = [], brands = [], stores = [], employees = [],
  onCreateCategory, onCreateBrand, isSubmitting = false,
}: ProductFormProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewCost = hasPermission('products', 'view_cost');
  const canManageCost = hasPermission('products', 'manage_cost');
  const canManageStock = hasPermission('products', 'manage_stock');
  const canManageProductTax = hasPermission('products', 'manage_product_tax');
  const canChangeResponsible =
    user?.role === "admin_master" || user?.role === "admin";

  const [imagePreviews, setImagePreviews] = useState<string[]>(() => Array.from(new Set([
    initialData?.image_url,
    ...(Array.isArray(initialData?.product_images) ? initialData.product_images.map((image: any) => image.image_url) : []),
  ].filter(Boolean))));
  const [responsibleId, setResponsibleId] = useState<string>(
    initialData?.created_by || user?.id || ""
  );
  const [categoryMode, setCategoryMode] = useState<'list' | 'custom'>(() => initialData?.category && !categories.includes(initialData.category) ? 'custom' : 'list');
  const [brandMode, setBrandMode] = useState<'list' | 'custom'>(() => initialData?.brand && !brands.includes(initialData.brand) ? 'custom' : 'list');
  const [storeStock, setStoreStock] = useState<Record<string, string>>(() => {
    if (!initialData) return {};
    const init: Record<string, string> = {};
    if (Array.isArray(initialData.product_stock)) {
      initialData.product_stock.forEach((s: any) => {
        init[s.store_id] = String(s.quantity ?? 0);
      });
    }
    return init;
  });

  const form = useForm({
    defaultValues: {
      name: initialData?.name || "",
      sku: initialData?.sku || "",
      barcode: initialData?.barcode || "",
      category: initialData?.category || "",
      brand: initialData?.brand || "",
      product_type: initialData?.product_type || "product",
      unit: initialData?.unit || "un",
      ncm: initialData?.ncm || "",
      cest: initialData?.cest || "",
      tax_origin: initialData?.tax_origin || "",
      commercial_unit: initialData?.commercial_unit || "UN",
      taxable_unit: initialData?.taxable_unit || "UN",
      default_cfop: initialData?.default_cfop || "",
      default_cst: initialData?.default_cst || "",
      default_csosn: initialData?.default_csosn || "",
      tax_notes: initialData?.tax_notes || "",
      supplier_name: initialData?.supplier_name || "",
      price: initialData?.price?.toString() || "",
      cost: canViewCost ? initialData?.cost?.toString() || "" : "",
      min_stock: initialData?.min_stock?.toString() || "0",
      max_stock: initialData?.max_stock?.toString() || "",
      description: initialData?.description || "",
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6);
    if (files.length === 0) return;
    Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))).then((previews) => setImagePreviews((current) => Array.from(new Set([...current, ...previews])).slice(0, 6)));
    e.target.value = '';
  };

  const handleStoreStockChange = (storeId: string, value: string) => {
    setStoreStock(prev => ({ ...prev, [storeId]: value }));
  };

  const generateReference = () => {
    const productName = String(form.getValues('name') || '').trim();
    if (!productName) {
      toast.error('Informe o nome do produto antes de gerar a referência.');
      return;
    }
    const stopWords = new Set(['com', 'sem', 'para', 'por', 'dos', 'das', 'e', 'de', 'do', 'da']);
    const words = productName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(word => !stopWords.has(word.toLowerCase()));
    const prefix = (words.length ? words : ['PRODUTO']).slice(0, 3).join('-').slice(0, 24);
    const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    form.setValue('sku', `${prefix}-${randomSuffix}`, { shouldDirty: true, shouldValidate: true });
    toast.success('Referência gerada a partir do nome do produto.');
  };

  const handleSubmit = (data: any) => {
    const name = String(data.name || '').trim();
    const price = Number(data.price || 0);
    const cost = Number(data.cost || 0);
    const minimum = Number(data.min_stock || 0);
    const maximum = data.max_stock === '' || data.max_stock === null || data.max_stock === undefined ? null : Number(data.max_stock);
    if (!name) { toast.error('Informe o nome do produto.'); return; }
    if (!Number.isFinite(price) || price < 0) { toast.error('Informe um preço de venda válido.'); return; }
    if (canManageCost && (!Number.isFinite(cost) || cost < 0)) { toast.error('Informe um preço de custo válido.'); return; }
    if (!Number.isInteger(minimum) || minimum < 0) { toast.error('O estoque mínimo deve ser um número inteiro não negativo.'); return; }
    if (maximum !== null && (!Number.isInteger(maximum) || maximum < minimum)) { toast.error('O estoque máximo deve ser maior ou igual ao estoque mínimo.'); return; }
    try {
      const stockByStore = stores.map(s => {
        const raw = storeStock[s.id] === undefined || storeStock[s.id] === '' ? 0 : Number(storeStock[s.id]);
        if (!Number.isInteger(raw) || raw < 0) throw new Error(`Estoque inválido para ${s.name}.`);
        return { store_id: s.id, quantity: raw };
      });
      const payload: any = { ...data, name, price, ...(canManageCost ? { cost } : {}), min_stock: minimum, max_stock: maximum, imageUrl: imagePreviews[0] || null, imageUrls: imagePreviews, stockByStore: canManageStock ? stockByStore : [], created_by: responsibleId || user?.id };
      if (!canManageProductTax) ['ncm', 'cest', 'tax_origin', 'commercial_unit', 'taxable_unit', 'default_cfop', 'default_cst', 'default_csosn', 'tax_notes'].forEach((key) => delete payload[key]);
      onSubmit(payload);
    } catch (error: any) {
      toast.error(error?.message || 'Revise os estoques informados.');
    }
  };

  const responsibleName = (() => {
    if (!responsibleId) return user?.name || "Usuario atual";
    const emp = employees.find(e => e.id === responsibleId);
    if (emp) return emp.name;
    if (responsibleId === user?.id) return user?.name || "Usuario atual";
    return user?.name || "Usuario atual";
  })();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FinancialInfoTip title="Dica de cadastro">Use SKU ou código de barras únicos para facilitar a busca em Vendas e O.S. Defina o estoque por loja e o mínimo de reposição; o preço de custo fica protegido por permissão.</FinancialInfoTip>

        {/* Imagem */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-28 w-28 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-border overflow-hidden group">
            {imagePreviews.length > 0 ? (
              <>
                <img src={imagePreviews[0]} alt="Pré-visualização do produto" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">{imagePreviews.length} foto{imagePreviews.length === 1 ? '' : 's'}</span>
                <button onClick={() => setImagePreviews((current) => current.slice(1))} type="button" aria-label="Remover foto principal" className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
                <ImageIcon className="h-7 w-7 text-muted-foreground/50 mb-1" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Adicionar fotos</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
              </label>
            )}
          </div>
        </div>
        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 text-xs font-semibold text-primary hover:underline">
          <ImageIcon className="h-3.5 w-3.5" /> Adicionar ou substituir fotos
          <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Package className="h-3.5 w-3.5" /> Nome do Produto
              </FormLabel>
              <FormControl><Input placeholder="Ex: Armacao Ray-Ban RB3025" className="h-11 rounded-xl" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="barcode" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Barcode className="h-3.5 w-3.5" /> Codigo de Barras
              </FormLabel>
              <div className="relative">
                <FormControl><Input placeholder="000000000000" className="h-11 rounded-xl pr-10" {...field} /></FormControl>
                <Button type="button" variant="ghost" size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-primary hover:bg-primary/5 rounded-lg"
                  aria-label="Gerar código de barras"
                  onClick={() => field.onChange(String(Date.now()).slice(-12))}>
                  <Scan className="h-5 w-5" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="sku" render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-2">
                <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" /> SKU / Referencia
                </FormLabel>
                <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg px-2 text-[10px] font-bold uppercase tracking-wide text-primary" onClick={generateReference}>
                  <Sparkles className="mr-1 h-3 w-3" /> Gerar referência
                </Button>
              </div>
              <FormControl><Input placeholder="REF-123" className="h-11 rounded-xl" {...field} /></FormControl>
              <p className="text-[11px] text-muted-foreground">Usa as principais palavras do nome e adiciona um sufixo único. Você pode editar antes de salvar.</p>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Categoria</FormLabel>
              <Select
                value={categoryMode === 'custom' ? '__custom_category__' : (field.value || '')}
                onValueChange={value => {
                  if (value === '__create_category__') { onCreateCategory?.(); return; }
                  if (value === '__custom_category__') { setCategoryMode('custom'); field.onChange(''); return; }
                  setCategoryMode('list'); field.onChange(value);
                }}
              >
                <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione ou cadastre" /></SelectTrigger></FormControl>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__custom_category__">Usar categoria avulsa</SelectItem>
                  <SelectItem value="__create_category__">+ Cadastrar nova categoria</SelectItem>
                </SelectContent>
              </Select>
              {categoryMode === 'custom' && <Input value={field.value || ''} onChange={event => field.onChange(event.target.value)} placeholder="Digite a categoria avulsa" className="mt-2 h-10 rounded-xl" autoFocus />}
              {categories.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma categoria cadastrada. Cadastre uma agora ou informe uma categoria avulsa.</p>}
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="brand" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Marca</FormLabel>
              <Select
                value={brandMode === 'custom' ? '__custom_brand__' : (field.value || '')}
                onValueChange={value => {
                  if (value === '__create_brand__') { onCreateBrand?.(); return; }
                  if (value === '__custom_brand__') { setBrandMode('custom'); field.onChange(''); return; }
                  setBrandMode('list'); field.onChange(value);
                }}
              >
                <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione ou cadastre" /></SelectTrigger></FormControl>
                <SelectContent>
                  {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  <SelectItem value="__custom_brand__">Usar marca avulsa</SelectItem>
                  <SelectItem value="__create_brand__">+ Cadastrar nova marca</SelectItem>
                </SelectContent>
              </Select>
              {brandMode === 'custom' && <Input value={field.value || ''} onChange={event => field.onChange(event.target.value)} placeholder="Digite a marca avulsa" className="mt-2 h-10 rounded-xl" autoFocus />}
              {brands.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma marca cadastrada. Cadastre uma agora ou informe uma marca avulsa.</p>}
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="product_type" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Tipo de item</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="product">Produto</SelectItem>
                  <SelectItem value="frame">Armação</SelectItem>
                  <SelectItem value="lens">Lente</SelectItem>
                  <SelectItem value="accessory">Acessório</SelectItem>
                  <SelectItem value="service">Serviço</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="unit" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Unidade</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="un">Unidade</SelectItem>
                  <SelectItem value="par">Par</SelectItem>
                  <SelectItem value="cx">Caixa</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {canManageProductTax ? <div className="md:col-span-2 space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
            <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-primary" /><div><p className="text-[12px] font-bold uppercase tracking-wide text-foreground">Dados tributários</p><p className="text-[11px] text-muted-foreground">Preencha somente com os parâmetros oficiais da empresa e do contador. Campos vazios permanecem sem classificação.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="ncm" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">NCM</FormLabel><FormControl><Input placeholder="Informado pelo contador" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="cest" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">CEST</FormLabel><FormControl><Input placeholder="Quando aplicável" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="tax_origin" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Origem da mercadoria</FormLabel><FormControl><Input placeholder="Parâmetro oficial" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="commercial_unit" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Unidade comercial</FormLabel><FormControl><Input placeholder="UN" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="taxable_unit" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Unidade tributável</FormLabel><FormControl><Input placeholder="UN" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="default_cfop" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">CFOP padrão</FormLabel><FormControl><Input placeholder="Informado pelo contador" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="default_cst" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">CST padrão</FormLabel><FormControl><Input placeholder="Quando aplicável" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="default_csosn" render={({ field }) => <FormItem><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">CSOSN padrão</FormLabel><FormControl><Input placeholder="Quando aplicável" className="h-10 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="tax_notes" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Observações tributárias</FormLabel><FormControl><Textarea placeholder="Anotações do contador ou regra específica da operação" className="min-h-[64px] rounded-xl resize-none" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
          </div> : <div className="md:col-span-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"><Lock className="mr-2 inline h-3.5 w-3.5" />Dados tributários protegidos por permissão específica.</div>}

          <FormField control={form.control} name="supplier_name" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Fornecedor</FormLabel>
              <FormControl><Input placeholder="Nome do fornecedor (opcional)" className="h-11 rounded-xl" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="price" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" /> Preco de Venda
              </FormLabel>
              <FormControl><Input type="number" min="0" step="0.01" placeholder="0,00" className="h-11 rounded-xl" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {canViewCost && canManageCost && (
            <FormField control={form.control} name="cost" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5" /> Preço de custo
                </FormLabel>
                <FormControl><Input type="number" min="0" step="0.01" placeholder="0,00" className="h-11 rounded-xl" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}

          <FormField control={form.control} name="min_stock" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Estoque mínimo</FormLabel>
              <FormControl><Input type="number" min="0" step="1" placeholder="0" className="h-11 rounded-xl" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="max_stock" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground">Estoque máximo</FormLabel>
              <FormControl><Input type="number" min="0" step="1" placeholder="Opcional" className="h-11 rounded-xl" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel className="text-[12px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Descricao do Produto
              </FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva detalhes do produto, material, garantias..." className="min-h-[80px] rounded-xl resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Responsavel */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              Responsavel pelo Cadastro
            </span>
            {!canChangeResponsible && <Lock className="h-3 w-3 text-muted-foreground/50 ml-auto" />}
          </div>
          {canChangeResponsible && employees.length > 0 ? (
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger className="h-11 rounded-xl border-border/60">
                <SelectValue placeholder="Selecione o responsavel" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}{e.id === user?.id ? " (voce)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-11 rounded-xl border border-border/40 bg-muted/30 px-3 flex items-center gap-2 cursor-not-allowed">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-3 w-3 text-primary/60" />
              </div>
              <span className="text-sm font-medium text-foreground flex-1">{responsibleName}</span>
              <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground px-1">
            {canChangeResponsible
              ? "Como administrador, voce pode alterar o responsavel pelo cadastro."
              : "O responsavel e definido automaticamente e nao pode ser alterado."}
          </p>
        </div>

        {/* Estoque por Loja */}
        {canManageStock ? <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Box className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Estoque Inicial por Loja</span>
          </div>
          {stores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground"><StoreIcon className="h-4 w-4 shrink-0" />Nenhuma loja cadastrada. Cadastre lojas nas configurações para definir estoque por unidade.</div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {stores.map((store, idx) => (
                <div key={store.id} className={`flex items-center justify-between px-4 py-3 gap-4 ${idx % 2 === 0 ? "bg-muted/10" : "bg-background"}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0"><div className="h-7 w-7 rounded-lg bg-primary/5 flex items-center justify-center shrink-0"><StoreIcon className="h-3.5 w-3.5 text-primary/60" /></div><span className="text-sm font-medium text-foreground truncate">{store.name.split(" - ")[1] || store.name}</span></div>
                  <div className="flex items-center gap-2 shrink-0"><span className="text-[11px] text-muted-foreground font-medium">Qtd:</span><Input type="number" min="0" placeholder="0" value={storeStock[store.id] || ""} onChange={e => handleStoreStockChange(store.id, e.target.value)} className="h-8 w-20 rounded-lg text-center text-sm border-border/60" /></div>
                </div>
              ))}
            </div>
          )}
        </div> : <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">O estoque inicial é gerenciado por usuários com permissão de estoque.</div>}

        <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t bg-background/95 pt-3 backdrop-blur-sm">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="h-11 px-6 rounded-xl">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-11 px-8 rounded-xl bg-primary text-primary-foreground border-0 shadow-lg shadow-primary/20 font-bold">
            {isSubmitting ? 'Salvando...' : 'Salvar Produto'}
          </Button>
        </div>
      </form>
    </Form>
  );
}