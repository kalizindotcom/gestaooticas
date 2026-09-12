import React from 'react';
import { createPortal } from 'react-dom';
import { Company, Store } from '@/types';

export type ServiceOrderPrintVariant = 'empresa' | 'cliente' | 'laboratorio';

interface ServiceOrderPrintProps {
  os: any;
  company?: Company;
  store?: Store;
  variant?: ServiceOrderPrintVariant;
}

const A4_PRINT_WIDTH = '194mm';
const A4_PRINT_HEIGHT = '281mm';
const PRINT_ACCENT = '#E6451F';
const PRINT_INK = '#1F2937';
const PRINT_MUTED = '#64748B';
const PRINT_LINE = '#E2E8F0';
const PRINT_SOFT = '#F8FAFC';
const PRINT_ACCENT_SOFT = '#FFF1ED';

const text = (value: unknown, fallback = '—') => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  return String(value);
};

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) => numberValue(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const date = (value: unknown, fallback = '—') => {
  if (!value) return fallback;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString('pt-BR');
};

const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro', pix: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito',
  bank_transfer: 'Transferência', boleto: 'Boleto', credit: 'Crediário', installments: 'Parcelado', crediario: 'Crediário',
};

const getPaymentLabel = (value: unknown) => paymentLabels[String(value || '').toLowerCase()] || text(value);

const getOrderId = (os: any) => String(os?.id || '—').slice(0, 8).toUpperCase();

const getPrescription = (os: any) => os?.prescription || null;

const Field = ({ label, value, emphasis = false }: { label: string; value: unknown; emphasis?: boolean }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ color: PRINT_MUTED, fontSize: '8px', fontWeight: 800, letterSpacing: '1.2px', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ color: emphasis ? PRINT_ACCENT : PRINT_INK, fontSize: emphasis ? '13px' : '11px', fontWeight: emphasis ? 900 : 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{text(value)}</div>
  </div>
);

const Card = ({ children, soft = false, accent = false, style = {} }: { children: React.ReactNode; soft?: boolean; accent?: boolean; style?: React.CSSProperties }) => (
  <div style={{ background: accent ? PRINT_ACCENT_SOFT : soft ? PRINT_SOFT : '#FFFFFF', border: `1px solid ${accent ? '#FDB5A4' : PRINT_LINE}`, borderRadius: '10px', padding: '12px 14px', ...style }}>{children}</div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ alignItems: 'center', borderBottom: `1px solid ${PRINT_LINE}`, display: 'flex', gap: '8px', marginBottom: '9px', paddingBottom: '6px' }}>
    <span style={{ background: PRINT_ACCENT, borderRadius: '3px', display: 'inline-block', height: '14px', width: '4px' }} />
    <span style={{ color: PRINT_INK, fontSize: '10px', fontWeight: 900, letterSpacing: '1.4px', textTransform: 'uppercase' }}>{children}</span>
  </div>
);

const Header = ({ os, variant, company, store }: { os: any; variant: ServiceOrderPrintVariant; company: Company; store: Store }) => {
  const title = variant === 'cliente' ? 'COMPROVANTE DO CLIENTE' : variant === 'laboratorio' ? 'FICHA DO LABORATÓRIO' : 'ORDEM DE SERVIÇO';
  const subtitle = variant === 'cliente' ? 'Guarde este comprovante para a retirada.' : variant === 'laboratorio' ? 'Documento técnico para produção e conferência.' : 'Documento operacional da ótica.';
  return <>
    <div style={{ alignItems: 'flex-start', borderBottom: `3px solid ${PRINT_ACCENT}`, display: 'flex', gap: '16px', justifyContent: 'space-between', paddingBottom: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: PRINT_ACCENT, fontSize: '20px', fontWeight: 950, letterSpacing: '-0.5px', lineHeight: 1.05 }}>{title}</div>
        <div style={{ color: PRINT_MUTED, fontSize: '10px', marginTop: '5px' }}>{subtitle}</div>
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          <span style={{ background: PRINT_SOFT, border: `1px solid ${PRINT_LINE}`, borderRadius: '6px', color: PRINT_INK, fontFamily: 'monospace', fontSize: '14px', fontWeight: 900, padding: '4px 9px' }}>Nº {getOrderId(os)}</span>
          <span style={{ color: PRINT_MUTED, fontSize: '9px' }}>Emitido em {date(new Date())}</span>
        </div>
      </div>
      <div style={{ maxWidth: '72mm', textAlign: 'right' }}>
        <div style={{ color: PRINT_INK, fontSize: '14px', fontWeight: 900 }}>{text(company.trade_name || company.name, 'GESTÃO ÓTICAS H2K')}</div>
        {company.cnpj && <div style={{ color: PRINT_MUTED, fontSize: '9px', marginTop: '3px' }}>CNPJ: {company.cnpj}</div>}
        <div style={{ color: PRINT_MUTED, fontSize: '9px', lineHeight: 1.35, marginTop: '2px' }}>{text(store.name, 'Loja não informada')}</div>
        {(store.address || store.phone) && <div style={{ color: PRINT_MUTED, fontSize: '9px', lineHeight: 1.35 }}>{text(store.address)}{store.address && store.phone ? ' • ' : ''}{text(store.phone)}</div>}
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}><span style={{ background: PRINT_ACCENT_SOFT, border: `1px solid #FDB5A4`, borderRadius: '999px', color: PRINT_ACCENT, fontSize: '8px', fontWeight: 900, letterSpacing: '1px', padding: '4px 10px' }}>{variant === 'cliente' ? 'VIA DO CLIENTE' : variant === 'laboratorio' ? 'VIA DO LABORATÓRIO' : 'VIA OPERACIONAL'}</span></div>
  </>;
};

const CustomerCard = ({ os, variant }: { os: any; variant: ServiceOrderPrintVariant }) => (
  <Card style={{ display: 'grid', gridTemplateColumns: variant === 'cliente' ? '1fr 1fr' : '1fr 1fr', gap: '12px', marginTop: '14px' }}>
    <Field label="Cliente" value={os.customerName || os.customer_name} emphasis />
    <Field label="Contato" value={os.customerPhone || os.customer_phone || 'Não informado'} />
    {variant !== 'cliente' && <Field label="CPF / CNPJ" value={os.customerDocument || os.customer_cpf || os.cpf || os.cnpj || 'Não informado'} />}
    <Field label="Abertura" value={date(os.date)} />
  </Card>
);

const TechnicalSection = ({ os, variant }: { os: any; variant: ServiceOrderPrintVariant }) => (
  <div style={{ marginTop: '18px' }}>
    <SectionTitle>{variant === 'laboratorio' ? 'Dados para produção' : 'Resumo do pedido'}</SectionTitle>
    <Card soft>
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1.4fr 1fr 1fr' }}>
        <Field label="Produto / armação" value={os.product || os.productName || 'Armação do cliente'} />
        <Field label="Tipo de serviço" value={os.serviceType} />
        <Field label="Quantidade" value={os.productQuantity ? `${os.productQuantity} unidade(s)` : '1 unidade'} />
        <Field label="Tipo de lente" value={os.lens} />
        <Field label={variant === 'laboratorio' ? 'Laboratório' : 'Prazo de entrega'} value={variant === 'laboratorio' ? (os.lab || os.laboratoryName || 'Não informado') : date(os.deliveryDate || os.estimatedDeadline)} emphasis={variant === 'cliente'} />
        <Field label="Responsável" value={os.technicianName || 'Balcão / não informado'} />
      </div>
      {os.description && <div style={{ borderTop: `1px solid ${PRINT_LINE}`, color: PRINT_INK, fontSize: '10px', lineHeight: 1.5, marginTop: '12px', paddingTop: '10px' }}><span style={{ color: PRINT_MUTED, display: 'block', fontSize: '8px', fontWeight: 800, letterSpacing: '1.2px', marginBottom: '3px', textTransform: 'uppercase' }}>Observações</span>{os.description}</div>}
    </Card>
  </div>
);

const PrescriptionSection = ({ os, variant }: { os: any; variant: ServiceOrderPrintVariant }) => {
  const prescription = getPrescription(os);
  if (!prescription && variant === 'cliente') return null;
  const right = prescription?.rightEye || {};
  const left = prescription?.leftEye || {};
  const cells = (eye: any, key: string) => text(eye?.[key]);
  const measurements = [
    ['D. pupilar', prescription?.pupillaryDistance], ['Diag. maior', prescription?.largestDiagonal], ['Alt. vertical', prescription?.verticalHeight],
    ['Aro / ponte', `${text(prescription?.frameSize)}/${text(prescription?.bridgeSize)}`], ['Aro + ponte', prescription?.frameAndBridge], ['Centro óptico', prescription?.opticalCenterHeight],
  ];
  return <div style={{ marginTop: '18px' }}>
    <SectionTitle>Receita e medidas</SectionTitle>
    {!prescription ? <Card soft><div style={{ color: PRINT_MUTED, fontSize: '10px', textAlign: 'center' }}>Nenhuma receita foi informada nesta O.S.</div></Card> : <>
      <table style={{ border: `1px solid ${PRINT_LINE}`, borderCollapse: 'collapse', fontSize: '10px', tableLayout: 'fixed', width: '100%' }}>
        <thead><tr style={{ background: PRINT_SOFT }}><th style={{ color: PRINT_MUTED, fontSize: '8px', padding: '7px 9px', textAlign: 'left', textTransform: 'uppercase' }}>Olho</th>{['Esférico', 'Cilíndrico', 'Eixo', 'Adição'].map((label) => <th key={label} style={{ color: PRINT_MUTED, fontSize: '8px', padding: '7px 5px', textAlign: 'center', textTransform: 'uppercase' }}>{label}</th>)}</tr></thead>
        <tbody>{[['OD', right], ['OE', left]].map(([eye, values]: [string, any]) => <tr key={eye} style={{ borderTop: `1px solid ${PRINT_LINE}` }}><td style={{ color: PRINT_INK, fontWeight: 900, padding: '7px 9px' }}>{eye} <span style={{ color: PRINT_MUTED, fontSize: '8px', fontWeight: 500 }}>{eye === 'OD' ? '(Direito)' : '(Esquerdo)'}</span></td>{['sph', 'cyl', 'axis', 'add'].map((key) => <td key={key} style={{ color: PRINT_INK, fontFamily: 'monospace', fontWeight: 800, padding: '7px 5px', textAlign: 'center' }}>{cells(values, key)}</td>)}</tr>)}</tbody>
      </table>
      <div style={{ display: 'grid', gap: '6px', gridTemplateColumns: 'repeat(6, 1fr)', marginTop: '8px' }}>{measurements.map(([label, value]) => <div key={label} style={{ background: PRINT_SOFT, border: `1px solid ${PRINT_LINE}`, borderRadius: '6px', padding: '7px 4px', textAlign: 'center' }}><div style={{ color: PRINT_MUTED, fontSize: '7px', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div><div style={{ color: PRINT_INK, fontSize: '10px', fontWeight: 900, marginTop: '2px' }}>{text(value)}</div></div>)}</div>
    </>}
  </div>;
};

const FinancialSection = ({ os }: { os: any }) => {
  const total = numberValue(os.total);
  const paid = numberValue(os.paidAmount ?? os.paid_amount);
  const balance = Math.max(numberValue(os.balance ?? total - paid), 0);
  return <div style={{ marginTop: '18px' }}>
    <SectionTitle>Resumo financeiro</SectionTitle>
    <Card accent style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <Field label="Valor do pedido" value={money(total)} />
      <Field label="Pago / sinal" value={money(paid)} />
      <Field label="Restante" value={money(balance)} emphasis />
      <Field label="Pagamento" value={getPaymentLabel(os.paymentMethod || os.payment_method)} />
      <Field label="Vencimento" value={date(os.dueDate)} />
      <Field label="Status" value={os.financialStatus === 'paid' || balance === 0 ? 'Pago' : paid > 0 ? 'Parcial' : 'Pendente'} />
    </Card>
  </div>;
};

const Instructions = ({ variant, os }: { variant: ServiceOrderPrintVariant; os: any }) => {
  const title = variant === 'cliente' ? 'Orientações para retirada' : variant === 'laboratorio' ? 'Conferência antes da produção' : 'Conferência operacional';
  const content = variant === 'cliente' ? <>Prazo estimado: <strong>{date(os.deliveryDate || os.estimatedDeadline)}</strong>. Apresente este comprovante na retirada e confira o produto no recebimento.</> : variant === 'laboratorio' ? <>Conferir identificação, dioptrias, medidas e alinhamento óptico antes de iniciar a montagem. Em caso de divergência, contatar a ótica.</> : <>Conferir dioptrias, medidas, produto e prazo antes de encaminhar a produção. Registrar qualquer divergência no histórico da O.S.</>;
  return <Card accent style={{ marginTop: '18px' }}><div style={{ color: PRINT_ACCENT, fontSize: '9px', fontWeight: 900, letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' }}>{title}</div><div style={{ color: PRINT_INK, fontSize: '9px', lineHeight: 1.5 }}>{content}</div></Card>;
};

const Signature = ({ label }: { label: string }) => <div style={{ borderTop: `1px solid ${PRINT_LINE}`, color: PRINT_MUTED, fontSize: '8px', fontWeight: 800, letterSpacing: '1px', paddingTop: '7px', textAlign: 'center', textTransform: 'uppercase' }}>{label}</div>;

const Footer = ({ variant, company }: { variant: ServiceOrderPrintVariant; company: Company }) => <div style={{ marginTop: 'auto', paddingTop: '18px' }}><div style={{ display: 'grid', gap: '38px', gridTemplateColumns: '1fr 1fr' }}><Signature label={variant === 'laboratorio' ? 'Responsável pelo laboratório' : 'Assinatura do cliente'} /><Signature label={text(company.trade_name || company.name, 'GESTÃO ÓTICAS H2K')} /></div><div style={{ color: '#CBD5E1', fontSize: '7px', fontWeight: 800, letterSpacing: '3px', marginTop: '12px', textAlign: 'center', textTransform: 'uppercase' }}>GESTÃO ÓTICAS H2K • {new Date().getFullYear()}</div></div>;

const OSPage = ({ os, variant, company: propCompany, store: propStore }: { os: any; variant: ServiceOrderPrintVariant; company?: Company; store?: Store }) => {
  const company = propCompany ?? ({ id: '', name: 'GESTÃO ÓTICAS H2K', trade_name: 'GESTÃO ÓTICAS H2K', cnpj: '' } as Company);
  const store = propStore ?? ({ id: '', name: os?.storeName || 'Loja não informada', address: '', phone: '' } as Store);
  const isClient = variant === 'cliente';
  const isLaboratory = variant === 'laboratorio';
  return <div style={{ background: '#FFFFFF', boxSizing: 'border-box', color: PRINT_INK, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", margin: '0 auto', maxWidth: A4_PRINT_WIDTH, minHeight: A4_PRINT_HEIGHT, overflow: 'hidden', overflowWrap: 'anywhere', padding: '10mm 11mm', width: '100%' }}>
    <Header os={os} variant={variant} company={company} store={store} />
    <CustomerCard os={os} variant={variant} />
    <TechnicalSection os={os} variant={variant} />
    <PrescriptionSection os={os} variant={variant} />
    {!isLaboratory && <FinancialSection os={os} />}
    {isClient && os.paymentNote && <Card soft style={{ color: PRINT_INK, fontSize: '9px', lineHeight: 1.5, marginTop: '12px' }}><strong style={{ color: PRINT_MUTED, display: 'block', fontSize: '8px', letterSpacing: '1px', marginBottom: '3px', textTransform: 'uppercase' }}>Observação do pagamento</strong>{os.paymentNote}</Card>}
    <Instructions variant={variant} os={os} />
    <Footer variant={variant} company={company} />
  </div>;
};

export const ServiceOrderPrint = ({ os, company, store, variant }: ServiceOrderPrintProps) => createPortal(
  <div id="os-print-section" style={{ display: 'none' }}>
    <OSPage os={os} variant={variant || 'empresa'} company={company} store={store} />
  </div>,
  document.body,
);
