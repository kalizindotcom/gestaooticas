import React from 'react';
import { createPortal } from 'react-dom';

interface InstallmentPrintProps {
  customerName: string;
  installmentData: {
    id: string;
    carneId: string;
    parcelNumber: number;
    totalParcels: number;
    amount: number;
    paymentDate: string;
    dueDate: string;
    paymentMethod: string;
    paymentNote?: string;
    remainingBalance: number;
  };
}

export const InstallmentPrint = ({ customerName, installmentData }: InstallmentPrintProps) => {
  return createPortal(
    <div id="installment-print-section" style={{ display: 'none' }}>
      <div style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '18mm 20mm',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: '#0f172a',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid hsl(var(--primary))', paddingBottom: '14px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: 'hsl(var(--primary))', letterSpacing: '-0.5px' }}>COMPROVANTE DE PAGAMENTO</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '4px' }}>Recibo de Quitação de Parcela</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>Ótica Visão Premium</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>CNPJ: 12.345.678/0001-00</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Av. Paulista, 1000 - São Paulo, SP • (11) 3456-0001</div>
          </div>
        </div>

        {/* Client Info */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Cliente</div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>{customerName}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Carnê / Referência</div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>#{installmentData.carneId}</div>
          </div>
        </div>

        {/* Details Table */}
        <div style={{ marginBottom: '32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Descrição</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Parcela</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Vencimento</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Valor Pago</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 8px', fontWeight: 700 }}>Pagamento de Parcela - Crediário Próprio</td>
                <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700 }}>{installmentData.parcelNumber}/{installmentData.totalParcels}</td>
                <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700 }}>{installmentData.dueDate}</td>
                <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 900, fontSize: '15px' }}>R$ {installmentData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
          <div style={{ width: '260px', background: '#0f172a', color: 'white', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, opacity: 0.5, marginBottom: '6px' }}>
              <span>Método</span>
              <span>{installmentData.paymentMethod}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, opacity: 0.5, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '8px' }}>
              <span>Data Pagamento</span>
              <span>{installmentData.paymentDate}</span>
            </div>
            {installmentData.paymentNote && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', fontSize: '10px', fontWeight: 700, opacity: 0.75, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '8px' }}><span>Comentário</span><span style={{ maxWidth: '170px', textAlign: 'right', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{installmentData.paymentNote}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 900 }}>
              <span>Saldo:</span>
              <span>R$ {installmentData.remainingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Assinatura do Cliente</div>
                <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>{customerName}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Ótica Visão Premium</div>
                <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>Responsável p/ Recebimento</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '8px', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '4px' }}>
            Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
