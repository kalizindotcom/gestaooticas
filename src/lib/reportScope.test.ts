import { describe, expect, it } from 'vitest';
import {
  filterRecordsByStoreScope,
  getScopedStockRecords,
  getScopedStoreOptions,
  hasSelectedStore,
  isCancelledSale,
  isCompletedSale,
  isRecordInStoreScope,
} from './reportScope';
import type { StoreScopedRecord } from './reportScope';

const STORE_A = 'store-a';
const STORE_B = 'store-b';
const STORE_C = 'store-c';

const sales = [
  { id: 'sale-a', store_id: STORE_A, total: 100 },
  { id: 'sale-b', storeId: STORE_B, total: 200 },
  { id: 'sale-c', store_id: STORE_C, total: 300 },
  { id: 'sale-without-store', total: 999 },
];

const serviceOrders = [
  { id: 'os-a', storeId: STORE_A },
  { id: 'os-b', store_id: STORE_B },
  { id: 'os-c', storeId: STORE_C },
];

const appointments = [
  { id: 'appointment-a', store_id: STORE_A },
  { id: 'appointment-b', storeId: STORE_B },
  { id: 'appointment-c', store_id: STORE_C },
];

const customers = [
  { id: 'customer-a', storeId: STORE_A },
  { id: 'customer-b', store_id: STORE_B },
  { id: 'customer-c', storeId: STORE_C },
];

const products = [
  {
    id: 'product-1',
    product_stock: [
      { store_id: STORE_A, quantity: 10, reserved_quantity: 2 },
      { store_id: STORE_B, quantity: 20, reserved_quantity: 3 },
      { store_id: STORE_C, quantity: 30, reserved_quantity: 4 },
    ],
  },
  {
    id: 'product-2',
    product_stock: [{ storeId: STORE_C, quantity: 99, reserved_quantity: 9 }],
  },
];

const storeOptions = [
  { id: STORE_A, name: 'Loja A' },
  { id: STORE_B, name: 'Loja B' },
  { id: STORE_C, name: 'Loja C' },
];

const reportSources: Array<[string, StoreScopedRecord[]]> = [
  ['vendas', sales],
  ['ordens de serviço', serviceOrders],
  ['agendamentos', appointments],
  ['clientes', customers],
] as const;

describe('escopo global dos Relatórios', () => {
  it('mantém somente a loja única selecionada em todas as fontes operacionais', () => {
    for (const [reportName, records] of reportSources) {
      const scoped = filterRecordsByStoreScope(records, [STORE_A]);
      expect(scoped, reportName).toHaveLength(1);
      expect(scoped[0].storeId || scoped[0].store_id).toBe(STORE_A);
    }

    expect(getScopedStockRecords(products[0], [STORE_A])).toEqual([
      { store_id: STORE_A, quantity: 10, reserved_quantity: 2 },
    ]);
  });

  it('consolida exatamente as múltiplas lojas selecionadas e nunca inclui uma terceira', () => {
    const selected = [STORE_A, STORE_B];

    for (const [reportName, records] of reportSources) {
      const scoped = filterRecordsByStoreScope(records, selected);
      expect(scoped, reportName).toHaveLength(2);
      expect(scoped.every((record) => selected.includes(String(record.storeId || record.store_id)))).toBe(true);
      expect(scoped.some((record) => (record.storeId || record.store_id) === STORE_C)).toBe(false);
    }

    expect(getScopedStockRecords(products[0], selected).map((stock) => stock.store_id)).toEqual([STORE_A, STORE_B]);
    expect(getScopedStockRecords(products[1], selected)).toEqual([]);
    expect(getScopedStoreOptions(storeOptions, selected).map((store) => store.id)).toEqual([STORE_A, STORE_B]);
  });

  it('retorna vazio quando nenhuma loja está selecionada', () => {
    for (const [, records] of reportSources) {
      expect(filterRecordsByStoreScope(records, [])).toEqual([]);
    }

    expect(getScopedStockRecords(products[0], [])).toEqual([]);
    expect(getScopedStoreOptions(storeOptions, [])).toEqual([]);
    expect(hasSelectedStore([])).toBe(false);
    expect(hasSelectedStore([STORE_A])).toBe(true);
  });

  it('separa venda concluída de venda cancelada para manter o faturamento financeiro coerente', () => {
    const scopedSales = filterRecordsByStoreScope([
      { id: 'completed', storeId: STORE_A, status: 'completed', total: 225 },
      { id: 'cancelled', storeId: STORE_A, status: 'cancelled', total: 920052 },
    ], [STORE_A]);

    const completed = scopedSales.filter(isCompletedSale);
    const cancelled = scopedSales.filter(isCancelledSale);

    expect(completed.reduce((sum, sale) => sum + Number(sale.total), 0)).toBe(225);
    expect(cancelled.reduce((sum, sale) => sum + Number(sale.total), 0)).toBe(920052);
    expect(completed).toHaveLength(1);
    expect(cancelled).toHaveLength(1);
  });

  it('rejeita registros sem loja, IDs desconhecidos e variações string/número sem abrir o escopo', () => {
    expect(isRecordInStoreScope({ store_id: STORE_A }, [STORE_A])).toBe(true);
    expect(isRecordInStoreScope({ storeId: STORE_C }, [STORE_A, STORE_B])).toBe(false);
    expect(isRecordInStoreScope({}, [STORE_A])).toBe(false);
    expect(filterRecordsByStoreScope([{ store_id: 10 }, { storeId: '10' }, { store_id: 11 }], [10]).map((record) => record.storeId || record.store_id)).toEqual([10, '10']);
  });
});
