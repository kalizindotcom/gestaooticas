import { describe, expect, it } from 'vitest';
import { analyzeDataIntegrity } from '../../server/dataIntegrity';

describe('data integrity checks', () => {
  it('accepts a coherent operational graph', () => {
    const report = analyzeDataIntegrity({
      companies: [{ id: 'company-1' }],
      stores: [{ id: 'store-1', company_id: 'company-1' }],
      customers: [{ id: 'customer-1', company_id: 'company-1', store_id: 'store-1' }],
      sales: [{ id: 'sale-1', company_id: 'company-1', store_id: 'store-1', customer_id: 'customer-1' }],
      products: [{ id: 'product-1', company_id: 'company-1' }],
      product_stock: [{ id: 'stock-1', product_id: 'product-1', company_id: 'company-1', store_id: 'store-1', quantity: 10, reserved_quantity: 2 }],
      sale_items: [{ id: 'item-1', sale_id: 'sale-1', product_id: 'product-1' }],
      fiscal_documents: [{ id: 'fiscal-1', company_id: 'company-1', store_id: 'store-1', idempotency_key: 'fiscal-key-1' }],
    }, '2026-01-01T00:00:00.000Z');

    expect(report.ok).toBe(true);
    expect(report.counts.issues).toBe(0);
    expect(report.checked_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('finds missing and mismatched references without mutating data', () => {
    const data = {
      companies: [{ id: 'company-1' }],
      stores: [{ id: 'store-1', company_id: 'company-other' }],
      customers: [{ id: 'customer-1', company_id: 'company-1', store_id: 'store-1' }],
      sales: [{ id: 'sale-1', company_id: 'company-1', store_id: 'store-1', customer_id: 'customer-missing' }],
      product_stock: [{ id: 'stock-1', product_id: 'product-missing', company_id: 'company-1', store_id: 'store-1', quantity: -2, reserved_quantity: 3 }],
      fiscal_documents: [
        { id: 'fiscal-1', company_id: 'company-1', store_id: 'store-1', idempotency_key: 'duplicate' },
        { id: 'fiscal-2', company_id: 'company-1', store_id: 'store-1', idempotency_key: 'duplicate' },
      ],
    };
    const snapshot = JSON.stringify(data);
    const report = analyzeDataIntegrity(data);

    expect(report.ok).toBe(false);
    expect(report.counts.critical).toBeGreaterThan(0);
    expect(report.issues.some((issue) => issue.code === 'missing_customer')).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'company_store_mismatch')).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'duplicate_idempotency_key')).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'negative_stock')).toBe(true);
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it('reports a reserved quantity greater than stock as a warning', () => {
    const report = analyzeDataIntegrity({
      companies: [{ id: 'company-1' }],
      stores: [{ id: 'store-1', company_id: 'company-1' }],
      products: [{ id: 'product-1', company_id: 'company-1' }],
      product_stock: [{ id: 'stock-1', product_id: 'product-1', company_id: 'company-1', store_id: 'store-1', quantity: 1, reserved_quantity: 2 }],
    });

    expect(report.ok).toBe(true);
    expect(report.counts.warning).toBe(1);
    expect(report.issues[0]?.code).toBe('reserved_exceeds_stock');
  });
});
