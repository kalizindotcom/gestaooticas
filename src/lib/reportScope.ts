export type StoreScopedRecord = {
  storeId?: string | number | null;
  store_id?: string | number | null;
};

export type StockRecord = StoreScopedRecord & {
  quantity?: number | string | null;
  reserved_quantity?: number | string | null;
};

export type StoreOption = {
  id: string | number;
  name?: string | null;
};

export function normalizeStoreId(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return String(value);
}

export function getRecordStoreId(record: StoreScopedRecord): string | null {
  return normalizeStoreId(record.storeId ?? record.store_id);
}

export function createStoreScope(selectedStoreIds: readonly (string | number)[]) {
  return new Set(selectedStoreIds.map(String));
}

export function isRecordInStoreScope(record: StoreScopedRecord, selectedStoreIds: readonly (string | number)[]): boolean {
  const storeId = getRecordStoreId(record);
  return storeId !== null && createStoreScope(selectedStoreIds).has(storeId);
}

export function filterRecordsByStoreScope<T extends StoreScopedRecord>(records: readonly T[], selectedStoreIds: readonly (string | number)[]): T[] {
  if (selectedStoreIds.length === 0) return [];
  const scope = createStoreScope(selectedStoreIds);
  return records.filter((record) => {
    const storeId = getRecordStoreId(record);
    return storeId !== null && scope.has(storeId);
  });
}

export function getScopedStockRecords(product: { product_stock?: readonly StockRecord[] | null }, selectedStoreIds: readonly (string | number)[]): StockRecord[] {
  return filterRecordsByStoreScope(product.product_stock || [], selectedStoreIds);
}

export function getScopedStoreOptions<T extends StoreOption>(stores: readonly T[], selectedStoreIds: readonly (string | number)[]): T[] {
  const scope = createStoreScope(selectedStoreIds);
  return stores.filter((store) => scope.has(String(store.id)));
}

export function hasSelectedStore(selectedStoreIds: readonly (string | number)[]): boolean {
  return selectedStoreIds.length > 0;
}

const CANCELLED_SALE_STATUSES = new Set(['cancelled', 'canceled', 'cancelada', 'cancelado']);

export function isCompletedSale(record: { status?: unknown }): boolean {
  return String(record.status || '').toLowerCase() === 'completed';
}

export function isCancelledSale(record: { status?: unknown }): boolean {
  return CANCELLED_SALE_STATUSES.has(String(record.status || '').toLowerCase());
}
