import React from 'react';
import { createPortal } from 'react-dom';
import { Company, Store } from '@/types';

interface SalePrintProps {
  sale: any;
  company?: Company;
  store?: Store;
  customer?: any;
  products?: any[];
  customerCpf?: string;
  customerDocument?: string;
  customerDocumentLabel?: string;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return { date: '—', time: '—' };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: String(value), time: '—' };
  return {
    date: parsed.toLocaleDateString('pt-BR'),
    time: parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
};

const formatDate = (value?: string | null) => formatDateTime(value).date;
const currency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const paymentLabel = (value?: string) => ({
  credit: 'Cartão de crédito',
  debit: 'Cartão de débito',
  cash: 'Dinheiro',
  pix: 'PIX',
  check: 'Cheque',
  transfer: 'Transferência',
}[String(value || '').toLowerCase()] || value || 'Não informado');
const statusLabel = (value?: string) => ({
  completed: 'Concluída',
  paid: 'Concluída',
  pending: 'Pendente',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
}[String(value || '').toLowerCase()] || value || 'Não informado');
const safe = (value: unknown, fallback = 'Não informado') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

function InfoBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 11px', background: accent ? '#fff7ed' : '#f8fafc', minHeight: '46px' }}>
    <div style={{ fontSize: '8px', fontWeight: 800, color: accent ? '#c2410c' : '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere' }}>{value}</div>
  </div>;
}

const SaleContent = ({ sale, company, store, customer, products = [], customerCpf, customerDocument, customerDocumentLabel }: SalePrintProps) => {
  const documentValue = customerDocument ?? sale.customerDocument ?? customer?.cpf ?? customer?.cnpj ?? customerCpf;
  const documentLabel = customerDocumentLabel ?? sale.customerDocumentLabel ?? (sale.customerCnpj || customer?.cnpj ? 'CNPJ' : 'CPF');
  const items = Array.isArray(sale.items) ? sale.items : [];
  const enrichedItems = items.map((item: any) => {
    const product = products.find((candidate: any) => candidate.id === item.productId);
    const quantity = Number(item.qty || 0);
    const unitPrice = Number(item.price || 0);
    return {
      ...item,
      product,
      quantity,
      unitPrice,
      lineTotal: Number(item.total ?? item.total_price ?? (quantity * unitPrice)),
    };
  });
  const subtotal = enrichedItems.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
  const discount = Number(sale.discount || 0);
  const total = Number(sale.total ?? Math.max(0, subtotal - discount));
  const dateTime = formatDateTime(sale.created_at || sale.date);
  const installments = Number(sale.installments || 1);
  const installmentValue = installments > 1 ? total / installments : total;
  const totalUnits = enrichedItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const saleType = sale.manual ? 'Venda manual' : enrichedItems.some((item: any) => item.productId) ? 'Venda de catálogo' : 'Venda comercial';
  const customerName = sale.customerName || customer?.name || 'Cliente avulso';
  const customerPhone = sale.customerPhone || sale.customer_phone || customer?.phone || customer?.whatsapp;
  const customerEmail = sale.customerEmail || sale.customer_email || customer?.email;
  const storeName = sale.storeName || store?.name || 'Loja não informada';
  const storeAddress = [store?.address, store?.city, store?.state].filter(Boolean).join(' · ');

  return <div style={{ width: '210mm', minHeight: '297mm', padding: '12mm 14mm', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", color: '#0f172a', background: '#fff', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #ea580c', paddingBottom: '11px', marginBottom: '14px', gap: '20px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '22px', fontWeight: 900, color: '#ea580c', letterSpacing: '-0.4px' }}>COMPROVANTE DE VENDA</div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
          <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 800, background: '#f1f5f9', padding: '4px 8px', borderRadius: '5px' }}>#{safe(sale.id, 'SEM ID').toUpperCase()}</span>
          <span style={{ fontSize: '9px', color: '#64748b' }}>{dateTime.date} · {dateTime.time}</span>
          <span style={{ fontSize: '9px', fontWeight: 800, color: sale.status === 'cancelled' || sale.status === 'canceled' ? '#b91c1c' : '#047857' }}>{statusLabel(sale.status)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', maxWidth: '46%' }}>
        <div style={{ fontSize: '14px', fontWeight: 800 }}>{safe(company?.trade_name || company?.name, 'GESTÃO ÓTICAS H2K')}</div>
        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>CNPJ: {safe(company?.cnpj)}</div>
        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{safe(storeName)}</div>
        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Telefone: {safe(store?.phone || (store as any)?.whatsapp)}</div>
        <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{safe(storeAddress, 'Endereço não informado')}</div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '10px', marginBottom: '12px' }}>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '11px', background: '#f8fafc' }}>
        <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '7px' }}>Cliente / destinatário</div>
        <div style={{ fontSize: '13px', fontWeight: 800 }}>{customerName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', marginTop: '8px' }}>
          <InfoBox label={documentLabel} value={safe(documentValue)} />
          <InfoBox label="Telefone" value={safe(customerPhone)} />
          <InfoBox label="E-mail" value={safe(customerEmail)} />
          <InfoBox label="Tipo de cliente" value={sale.customerMode === 'walk_in' || !sale.customerId ? 'Avulso' : 'Cadastrado'} />
        </div>
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '11px', background: '#f8fafc' }}>
        <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '7px' }}>Identificação da operação</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
          <InfoBox label="Vendedor" value={safe(sale.sellerName)} />
          <InfoBox label="Tipo de venda" value={saleType} />
          <InfoBox label="Loja" value={safe(storeName)} />
          <InfoBox label="O.S. vinculada" value={safe(sale.service_order_id || sale.serviceOrderId)} />
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '7px', marginBottom: '14px' }}>
      <InfoBox label="Data da venda" value={dateTime.date} />
      <InfoBox label="Hora da venda" value={dateTime.time} />
      <InfoBox label="Pagamento" value={paymentLabel(sale.paymentMethod || sale.payment_method)} accent />
      <InfoBox label="Unidades" value={`${totalUnits} unidade(s)`} />
      <InfoBox label="Desconto" value={discount > 0 ? currency(discount) : 'Sem desconto'} />
      <InfoBox label="Parcelamento" value={installments > 1 ? `${installments}x de ${currency(installmentValue)}` : 'À vista'} />
      <InfoBox label="ID do cliente" value={safe(sale.customerId || sale.customer_id)} />
      <InfoBox label="ID do vendedor" value={safe(sale.sellerId || sale.seller_id)} />
    </div>

    <div style={{ flexGrow: 1, marginBottom: '14px' }}>
      <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', borderBottom: '2px solid #f1f5f9', paddingBottom: '6px', marginBottom: '7px' }}>Produtos e itens da venda</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', tableLayout: 'fixed' }}>
        <thead><tr style={{ borderBottom: '2px solid #cbd5e1' }}>
          <th style={{ width: '27%', padding: '7px 5px', textAlign: 'left', fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>Produto</th>
          <th style={{ width: '14%', padding: '7px 5px', textAlign: 'left', fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>SKU / código</th>
          <th style={{ width: '18%', padding: '7px 5px', textAlign: 'left', fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>Marca / categoria</th>
          <th style={{ width: '9%', padding: '7px 5px', textAlign: 'center', fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>Qtd.</th>
          <th style={{ width: '14%', padding: '7px 5px', textAlign: 'right', fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>Unitário</th>
          <th style={{ width: '18%', padding: '7px 5px', textAlign: 'right', fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>Subtotal</th>
        </tr></thead>
        <tbody>{enrichedItems.length === 0 ? <tr><td colSpan={6} style={{ padding: '18px 5px', color: '#64748b', textAlign: 'center' }}>Venda sem produtos cadastrados</td></tr> : enrichedItems.map((item: any, index: number) => <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
          <td style={{ padding: '8px 5px', fontWeight: 800, overflowWrap: 'anywhere' }}>{safe(item.product || item.product_name, 'Item manual')}</td>
          <td style={{ padding: '8px 5px', color: '#475569', fontFamily: 'monospace', fontSize: '8px', overflowWrap: 'anywhere' }}>{safe(item.product?.sku || item.sku, '—')}<br />{safe(item.product?.barcode || item.barcode, '—')}</td>
          <td style={{ padding: '8px 5px', color: '#475569', overflowWrap: 'anywhere' }}>{safe(item.product?.brand || item.brand, '—')}<br />{safe(item.product?.category || item.category, '—')}</td>
          <td style={{ padding: '8px 5px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
          <td style={{ padding: '8px 5px', textAlign: 'right', color: '#475569' }}>{currency(item.unitPrice)}</td>
          <td style={{ padding: '8px 5px', textAlign: 'right', fontWeight: 800 }}>{currency(item.lineTotal)}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 255px', gap: '12px', alignItems: 'end', marginTop: 'auto' }}>
      <div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', minHeight: '58px', marginBottom: '10px' }}>
          <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Observações da venda</div>
          <div style={{ fontSize: '9px', color: '#475569', lineHeight: 1.4 }}>{safe(sale.notes, 'Nenhuma observação interna registrada.')}</div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', minHeight: '42px' }}>
          <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Observação do pagamento</div>
          <div style={{ fontSize: '9px', color: '#475569', lineHeight: 1.4 }}>{safe(sale.payment_note || sale.paymentNote, 'Nenhuma observação de pagamento registrada.')}</div>
        </div>
      </div>
      <div style={{ background: '#0f172a', color: '#fff', borderRadius: '10px', padding: '13px 15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#cbd5e1', marginBottom: '5px' }}><span>Subtotal:</span><span>{currency(subtotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#cbd5e1', paddingBottom: '7px', marginBottom: '7px', borderBottom: '1px solid #334155' }}><span>Descontos:</span><span>− {currency(discount)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 900 }}><span>TOTAL:</span><span>{currency(total)}</span></div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '35px', marginTop: '19px' }}>
      <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}><div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Assinatura do cliente</div><div style={{ fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>{customerName}</div></div></div>
      <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}><div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Responsável pela venda</div><div style={{ fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>{safe(sale.sellerName)}</div></div></div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '14px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '7px', color: '#94a3b8' }}><span>Documento gerado pelo sistema Gestão Óticas H2K</span><span>{dateTime.date} · {dateTime.time}</span></div>
  </div>;
};

export const SalePrint = ({ sale, company, store, customer, products, customerCpf, customerDocument, customerDocumentLabel }: SalePrintProps) => createPortal(
  <div id="print-sale-section" style={{ display: 'none' }}>
    <SaleContent sale={sale} company={company} store={store} customer={customer} products={products} customerCpf={customerCpf} customerDocument={customerDocument} customerDocumentLabel={customerDocumentLabel} />
  </div>,
  document.body,
);
