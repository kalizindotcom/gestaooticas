import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localApi } from '@/lib/localApi';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';

const todayIso = () => new Date().toISOString().slice(0, 10);

export const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export const formatDateTime = (value?: string | null) => {
  if (!value) return '-';

  // Datas de negócio (como agendamentos) são armazenadas como YYYY-MM-DD.
  // Criar a data diretamente no fuso local evita que o navegador mostre o dia anterior.
  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(localDate.getTime())) return localDate.toLocaleDateString('pt-BR');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const normalizeSale = (sale: any) => ({
  ...sale,
  customerId: sale.customer_id,
  customerName: sale.customers?.name || sale.customer_name || '',
  storeId: sale.store_id,
  storeName: sale.stores?.name || sale.store_name || '',
  sellerId: sale.seller_id,
  sellerName: sale.employees?.name || sale.seller_name || 'Não informado',
  items: (sale.sale_items || []).map((item: any) => ({
    ...item,
    product: item.product_name,
    qty: Number(item.quantity || 0),
    price: Number(item.unit_price || 0),
    total: Number(item.total_price || 0),
  })),
});

const normalizeServiceOrder = (order: any) => ({
  ...order,
  customerId: order.customer_id,
  customerName: order.customers?.name || order.customer_name || '',
  customerPhone: order.customers?.phone || order.customer_phone || '',
  storeId: order.store_id,
  storeName: order.stores?.name || order.store_name || '',
  technicianId: order.technician_id,
  technicianName: order.employees?.name || order.technician_name || 'Não atribuído',
  serviceType: order.service_type,
  deliveryDate: order.delivery_date,
  estimatedDeadline: order.estimated_deadline,
  dueDate: order.due_date || order.financialEntry?.due_date || '',
  paidAmount: Number(order.paid_amount ?? order.financialEntry?.paid_amount ?? 0),
  balance: Number(order.balance ?? Math.max(Number(order.total || 0) - Number(order.paid_amount ?? order.financialEntry?.paid_amount ?? 0), 0)),
  financialStatus: order.financial_status || order.financialEntry?.status,
  paymentMethod: order.payment_method || order.financialEntry?.payment_method,
  paymentNote: order.payment_note || order.financialEntry?.payment_note || '',
  product: order.product_name || order.product,
  lens: order.lens_name || order.lens,
  labId: order.lab_id || '',
  lab: order.laboratories?.name || order.lab_name || order.lab,
  internalNotes: order.internal_notes || '',
  prescriptionDate: order.prescription_date || '',
  prescriptionValidUntil: order.prescription_valid_until || '',
  prescriptionId: order.prescription_id || '',
  prescriptionProfessionalId: order.prescription_professional_id || '',
  prescription: {
    rightEye: { sph: order.od_sph || '', cyl: order.od_cyl || '', axis: order.od_axis || '', add: order.od_add || '' },
    leftEye: { sph: order.oe_sph || '', cyl: order.oe_cyl || '', axis: order.oe_axis || '', add: order.oe_add || '' },
    pupillaryDistance: order.pupillary_distance || '',
    largestDiagonal: order.largest_diagonal || '',
    verticalHeight: order.vertical_height || '',
    frameSize: order.frame_size || '',
    bridgeSize: order.bridge_size || '',
    frameAndBridge: order.frame_and_bridge || '',
    opticalCenterHeight: order.optical_center_height || '',
    rightEyeFar: order.od_far || '',
    rightEyeNear: order.od_near || '',
    leftEyeFar: order.oe_far || '',
    leftEyeNear: order.oe_near || '',
  },
  timeline: (order.service_order_timeline || []).map((event: any) => ({
    date: event.date,
    action: event.action,
    user: event.user_name,
    userId: event.user_id,
    status: event.status,
  })),
});

const normalizeAppointment = (appointment: any) => ({
  ...appointment,
  customerId: appointment.customer_id,
  customerName: appointment.customers?.name || appointment.customer_name || '',
  customerPhone: appointment.customers?.phone || appointment.phone || '',
  storeId: appointment.store_id,
  storeName: appointment.stores?.name || appointment.store_name || '',
  professionalId: appointment.professional_id,
  professional: appointment.employees?.name || appointment.professional_name || 'Não informado',
});

export function useCustomerSales(customerId?: string) {
  return useQuery({
    queryKey: ['customer-sales', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await localApi
        .from('sales')
        .select('*, sale_items(*), customers(name), stores(name), employees(name)')
        .eq('customer_id', customerId)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map(normalizeSale);
    },
  });
}

export function useCustomerServiceOrders(customerId?: string) {
  return useQuery({
    queryKey: ['customer-service-orders', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await localApi
        .from('service_orders')
        .select('*, service_order_timeline(*), customers(name, phone), stores(name), employees(name), laboratories(name)')
        .eq('customer_id', customerId)
        .order('date', { ascending: false });
      if (error) throw error;

      const orderIds = (data || []).map((order: any) => order.id);
      const entriesRes = orderIds.length
        ? await localApi.from('financial_entries').select('origin_id, payment_method, payment_note, due_date, paid_amount, status').eq('origin_table', 'service_orders').in('origin_id', orderIds)
        : { data: [], error: null };
      if (entriesRes.error) throw entriesRes.error;
      const entryByOrderId = new Map((entriesRes.data || []).map((entry: any) => [entry.origin_id, entry]));
      return (data || []).map((order: any) => normalizeServiceOrder({ ...order, financialEntry: entryByOrderId.get(order.id) }));
    },
  });
}

export function useCustomerAppointments(customerId?: string) {
  return useQuery({
    queryKey: ['customer-appointments', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await localApi
        .from('appointments')
        .select('*, customers(name, phone), stores(name), employees(name)')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })
        .order('time', { ascending: true });
      if (error) throw error;
      return (data || []).map(normalizeAppointment);
    },
  });
}

export function useCustomerFinancials(customerId?: string, customerName?: string) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();

  return useQuery({
    queryKey: ['customer-financials', customerId, customerName, selectedCompanyId, selectedStoreIds],
    enabled: !!customerId && !!selectedCompanyId,
    queryFn: async () => {
      // FIX Bug #2: filtrar sales e service_orders também por company_id (multi-tenant)
      const [salesRes, ordersRes, entriesRes] = await Promise.all([
        localApi
          .from('sales')
          .select('id,total,date,status')
          .eq('customer_id', customerId)
          .eq('company_id', selectedCompanyId),
        localApi
          .from('service_orders')
          .select('id,total,balance,date,status')
          .eq('customer_id', customerId)
          .eq('company_id', selectedCompanyId),
        localApi.from('financial_entries').select('*').eq('company_id', selectedCompanyId),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (entriesRes.error) throw entriesRes.error;

      const saleIds = new Set((salesRes.data || []).map((sale: any) => sale.id));
      const orderIds = new Set((ordersRes.data || []).map((order: any) => order.id));
      const lowerName = (customerName || '').trim().toLowerCase();
      const scopedEntries = (entriesRes.data || []).filter((entry: any) => {
        const matchesStore = selectedStoreIds.length === 0 || selectedStoreIds.includes(entry.store_id);
        const matchesCustomer = !!customerId && String(entry.customer_id || '') === String(customerId);
        const matchesOrigin = (entry.origin_table === 'sales' && saleIds.has(entry.origin_id)) ||
          (entry.origin_table === 'service_orders' && orderIds.has(entry.origin_id));
        const matchesName = lowerName && String(entry.supplier_customer_name || '').trim().toLowerCase() === lowerName;
        return matchesStore && (matchesCustomer || matchesOrigin || matchesName);
      }).map((entry: any) => ({
        ...entry,
        paid_amount: Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0),
        remaining_amount: Math.max(Number(entry.amount || 0) - Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0), 0),
      }));

      const receivables = scopedEntries.filter((entry: any) => entry.type === 'receivable');
      const paidEntries = scopedEntries.filter((entry: any) => entry.status === 'paid' || entry.type === 'in');
      const pendingEntries = receivables.filter((entry: any) => entry.remaining_amount > 0 && (entry.status === 'pending' || entry.status === 'partially_paid' || entry.status === 'overdue'));
      const overdueEntries = pendingEntries.filter((entry: any) => entry.status === 'overdue' || (entry.due_date && entry.due_date < todayIso()));
      const totalSpent = (salesRes.data || [])
        .filter((sale: any) => sale.status !== 'cancelled')
        .reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
      const balanceDue = pendingEntries.reduce((sum: number, entry: any) => sum + Number(entry.remaining_amount || 0), 0);
      const overdueAmount = overdueEntries.reduce((sum: number, entry: any) => sum + Number(entry.remaining_amount || 0), 0);
      const totalPaid = scopedEntries.reduce((sum: number, entry: any) => sum + (entry.type === 'in' ? Number(entry.amount || 0) : Number(entry.paid_amount || 0)), 0);

      return {
        entries: scopedEntries.sort((a: any, b: any) => String(b.due_date || b.created_at).localeCompare(String(a.due_date || a.created_at))),
        receivables,
        pendingEntries,
        overdueEntries,
        totalSpent,
        balanceDue,
        overdueAmount,
        totalPaid,
        creditLimit: 0,
        creditAvailable: 0,
        nextDue: pendingEntries.sort((a: any, b: any) => String(a.due_date || '').localeCompare(String(b.due_date || '')))[0]?.due_date || null,
      };
    },
  });
}

export function useCustomerStats(customer: any) {
  const sales = useCustomerSales(customer?.id);
  const serviceOrders = useCustomerServiceOrders(customer?.id);
  const financials = useCustomerFinancials(customer?.id, customer?.name);

  const openStatuses = new Set(['opened', 'analyzing', 'waiting_approval', 'in_production', 'waiting_lab', 'waiting_part', 'waiting_client', 'ready', 'overdue']);
  const openServiceOrders = (serviceOrders.data || []).filter((order: any) => openStatuses.has(order.status)).length;
  const totalSpent = sales.data?.filter((sale: any) => sale.status !== 'cancelled').reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0) || 0;

  return {
    isLoading: sales.isLoading || serviceOrders.isLoading || financials.isLoading,
    totalPurchases: sales.data?.length || 0,
    totalSpent,
    openServiceOrders,
    balanceDue: financials.data?.balanceDue || 0,
    overdueAmount: financials.data?.overdueAmount || 0,
    creditAvailable: Number(customer?.credit_limit || 0) - (financials.data?.balanceDue || 0),
    financials: financials.data,
  };
}

function invalidateCustomerQueries(queryClient: ReturnType<typeof useQueryClient>, customerId?: string) {
  queryClient.invalidateQueries({ queryKey: ['customer-sales', customerId] });
  queryClient.invalidateQueries({ queryKey: ['customer-service-orders', customerId] });
  queryClient.invalidateQueries({ queryKey: ['customer-appointments', customerId] });
  queryClient.invalidateQueries({ queryKey: ['customer-financials'] });
  queryClient.invalidateQueries({ queryKey: ['customers'] });
  queryClient.invalidateQueries({ queryKey: ['sales'] });
  queryClient.invalidateQueries({ queryKey: ['service_orders'] });
  // A agenda global usa cache persistente e não refaz a busca ao montar.
  // Forçamos a atualização de todas as consultas de agenda, inclusive inativas,
  // para que um agendamento criado na ficha do cliente apareça imediatamente
  // ao navegar para a agenda global.
  queryClient.invalidateQueries({ queryKey: ['appointments'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['products'] });
}

export function useCreateCustomerSale(customer: any) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useGlobalFilter();

  return useMutation({
    mutationFn: async (payload: any) => {
      if (!customer?.id || !selectedCompanyId || !payload.storeId) throw new Error('Cliente, empresa e loja são obrigatórios.');
      if (!payload.items?.length) throw new Error('Adicione pelo menos um produto à venda.');

      const salePayload = {
        company_id: selectedCompanyId,
        store_id: payload.storeId,
        customer_id: customer.id,
        seller_id: payload.sellerId || null,
        date: payload.date ? new Date(`${payload.date}T00:00:00`).toISOString() : new Date().toISOString(),
        due_date: payload.dueDate || todayIso(),
        payment_method: payload.paymentMethod || null,
        installments: payload.installments ? Number(payload.installments) : null,
        notes: payload.notes || null,
        discount: Number(payload.discount || 0),
      };
      const itemsPayload = payload.items.map((item: any) => ({
        product_id: item.id,
        product_name: item.name,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.price || 0),
      }));
      const { data: sale, error: saleError } = await localApi.operations.completeSale(salePayload, itemsPayload);
      if (saleError) throw saleError;
      return sale;
    },
    onSuccess: () => invalidateCustomerQueries(queryClient, customer?.id),
  });
}

export function useCreateOrUpdateCustomerServiceOrder(customer: any) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useGlobalFilter();

  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: any }) => {
      if (!customer?.id || !selectedCompanyId || !data.storeId) throw new Error('Cliente, empresa e loja são obrigatórios.');
      const total = Number(data.total || 0);
      const paidAmount = Math.min(Math.max(Number(data.paidAmount || 0), 0), Math.max(total, 0));
      const balance = Math.max(total - paidAmount, 0);
      const dueDate = data.dueDate || data.deliveryDate || todayIso();
      const orderPayload = {
        company_id: selectedCompanyId,
        store_id: data.storeId,
        customer_id: customer.id,
        technician_id: data.technicianId || null,
        date: data.date || todayIso(),
        delivery_date: data.deliveryDate || null,
        estimated_deadline: data.estimatedDeadline || data.deliveryDate || null,
        prescription_date: data.prescriptionDate || null,
        prescription_valid_until: data.prescriptionValidUntil || null,
        prescription_id: data.prescriptionId || null,
        prescription_professional_id: data.prescriptionProfessionalId || data.technicianId || null,
        total,
        paid_amount: paidAmount,
        balance,
        payment_method: data.paymentMethod || null,
        financial_status: balance <= 0 && total > 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'pending',
        status: data.status || 'opened',
        priority: data.priority || 'medium',
        service_type: data.serviceType || 'montagem',
        description: data.description || null,
        product_id: data.productId || null,
        product_quantity: Math.max(Number(data.productQuantity || 1), 1),
        product_name: data.product || null,
        lens_name: data.lens || null,
        lab_id: data.labId || null,
        internal_notes: data.internalNotes || null,
        od_sph: data.rightEye?.sph || null,
        od_cyl: data.rightEye?.cyl || null,
        od_axis: data.rightEye?.axis || null,
        od_add: data.rightEye?.add || null,
        oe_sph: data.leftEye?.sph || null,
        oe_cyl: data.leftEye?.cyl || null,
        oe_axis: data.leftEye?.axis || null,
        oe_add: data.leftEye?.add || null,
        pupillary_distance: data.pupillaryDistance || null,
        largest_diagonal: data.largestDiagonal || null,
        vertical_height: data.verticalHeight || null,
        frame_size: data.frameSize || null,
        bridge_size: data.bridgeSize || null,
        frame_and_bridge: data.frameAndBridge || null,
        optical_center_height: data.opticalCenterHeight || null,
        od_far: data.rightEyeFar || null,
        od_near: data.rightEyeNear || null,
        oe_far: data.leftEyeFar || null,
        oe_near: data.leftEyeNear || null,
      };

      if (id) {
        const { data: updated, error } = await localApi.from('service_orders').update(orderPayload).eq('id', id).select().single();
        if (error) throw error;

        const { data: linkedEntries, error: linkedEntriesError } = await localApi
          .from('financial_entries')
          .select('*')
          .eq('origin_table', 'service_orders')
          .eq('origin_id', id);
        if (linkedEntriesError) throw linkedEntriesError;

        if (total <= 0) {
          const { error: deleteFinancialError } = await localApi.from('financial_entries').delete().eq('origin_table', 'service_orders').eq('origin_id', id);
          if (deleteFinancialError) throw deleteFinancialError;
        } else {
          const existingEntry = (linkedEntries || [])[0];
          const previousReceived = Math.min(Math.max(Number(data.paidAmount || 0), 0), total);
          const nextStatus = previousReceived >= total ? 'paid' : previousReceived > 0 ? 'partially_paid' : (dueDate < todayIso() ? 'overdue' : 'pending');
          const financialPayload = {
            company_id: selectedCompanyId,
            store_id: data.storeId,
            type: 'receivable',
            description: `O.S. #${String(id).slice(0, 8)} - ${customer.name}`,
            amount: total,
            due_date: dueDate,
            payment_date: previousReceived > 0 ? (existingEntry?.payment_date || new Date().toISOString()) : null,
            paid_amount: previousReceived,
            status: nextStatus,
            category: 'Ordem de Serviço',
            payment_method: data.paymentMethod || null,
            payment_note: data.paymentNote?.trim() || null,
            origin_table: 'service_orders',
            origin_id: id,
            customer_id: customer.id,
            supplier_customer_name: customer.name,
          };
          if (existingEntry?.id) {
            const { error: updateFinancialError } = await localApi.from('financial_entries').update(financialPayload).eq('id', existingEntry.id);
            if (updateFinancialError) throw updateFinancialError;
            const duplicateEntries = (linkedEntries || []).filter((entry: any) => entry.id !== existingEntry.id);
            for (const duplicate of duplicateEntries) {
              const { error: duplicateError } = await localApi.from('financial_entries').delete().eq('id', duplicate.id);
              if (duplicateError) throw duplicateError;
            }
          } else {
            const { error: insertFinancialError } = await localApi.from('financial_entries').insert(financialPayload);
            if (insertFinancialError) throw insertFinancialError;
          }
        }

        const { error: timelineError } = await localApi.from('service_order_timeline').insert({ service_order_id: id, action: 'O.S. atualizada', status: orderPayload.status });
        if (timelineError) throw timelineError;
        return updated;
      }

      const { data: order, error } = await localApi.from('service_orders').insert(orderPayload).select().single();
      if (error) throw error;
      await localApi.from('service_order_timeline').insert({ service_order_id: order.id, action: 'O.S. criada', status: 'opened' });

      if (total > 0) {
        const { error: financialError } = await localApi.from('financial_entries').insert({
          company_id: selectedCompanyId,
          store_id: data.storeId,
          type: 'receivable',
          description: `O.S. #${String(order.id).slice(0, 8)} - ${customer.name}`,
          amount: total,
          due_date: dueDate,
          payment_date: paidAmount > 0 ? new Date().toISOString() : null,
          status: paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partially_paid' : (dueDate < todayIso() ? 'overdue' : 'pending'),
            category: 'Ordem de Serviço',
            payment_method: data.paymentMethod || null,
            paid_amount: paidAmount,
          payment_note: data.paymentNote?.trim() || null,
          origin_table: 'service_orders',
          origin_id: order.id,
          customer_id: customer.id,
          supplier_customer_name: customer.name,
        });
        if (financialError) throw financialError;
      }

      return order;
    },
    onSuccess: () => invalidateCustomerQueries(queryClient, customer?.id),
  });
}

export function useDeleteCustomerServiceOrder(customerId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: financialError } = await localApi.from('financial_entries').delete().eq('origin_table', 'service_orders').eq('origin_id', id);
      if (financialError) throw financialError;
      const { error: timelineError } = await localApi.from('service_order_timeline').delete().eq('service_order_id', id);
      if (timelineError) throw timelineError;
      const { error } = await localApi.from('service_orders').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => invalidateCustomerQueries(queryClient, customerId),
  });
}

export function useCustomerAppointmentMutations(customer: any) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useGlobalFilter();

  const invalidate = () => invalidateCustomerQueries(queryClient, customer?.id);

  const save = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: any }) => {
      if (!customer?.id || !selectedCompanyId || !data.storeId) throw new Error('Cliente, empresa e loja são obrigatórios.');
      const payload = {
        company_id: selectedCompanyId,
        store_id: data.storeId,
        customer_id: customer.id,
        professional_id: data.professionalId || null,
        professional_name: data.professionalName || null,
        date: data.date,
        time: data.time,
        type: data.type,
        status: data.status || 'scheduled',
        priority: data.priority || 'medium',
        notes: data.notes || null,
        origin: 'customer_page',
      };
      if (id) {
        const { data: updated, error } = await localApi.from('appointments').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return updated;
      }
      const { data: inserted, error } = await localApi.from('appointments').insert(payload).select().single();
      if (error) throw error;
      return inserted;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localApi.from('appointments').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

export function useRegisterCustomerPayment(customer: any) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entry, amount, paymentMethod, paymentNote }: { entry: any; amount: number; paymentMethod: string; paymentNote?: string }) => {
      if (!entry?.id) throw new Error('Lançamento financeiro inválido.');
      const receivedNow = Number(amount || 0);
      if (!Number.isFinite(receivedNow) || receivedNow <= 0) throw new Error('Informe um valor válido.');
      const method = paymentMethod || entry.payment_method || 'cash';
      const { data, error } = await localApi.operations.settleFinancialEntry({
        id: entry.id,
        amount: receivedNow,
        payment_date: new Date().toISOString(),
        payment_method: method,
        payment_note: paymentNote?.trim() || entry.payment_note || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateCustomerQueries(queryClient, customer?.id),
  });
}
