export type ServiceOrderStatus = 'opened' | 'waiting_lab' | 'in_production' | 'ready' | 'delivered' | 'cancelled';

export const SERVICE_ORDER_STATUS_FLOW: Array<{ id: ServiceOrderStatus; label: string; description: string }> = [
  { id: 'opened', label: 'Em preparação', description: 'Conferência inicial, medidas e encaminhamento do serviço.' },
  { id: 'waiting_lab', label: 'Aguardando laboratório', description: 'Aguardando recebimento, confirmação ou retorno do laboratório.' },
  { id: 'in_production', label: 'Em produção', description: 'Serviço em montagem, produção ou execução técnica.' },
  { id: 'ready', label: 'Pronta', description: 'Serviço finalizado e aguardando retirada ou entrega.' },
  { id: 'delivered', label: 'Entregue', description: 'Produto ou serviço entregue ao cliente.' },
];

export const SERVICE_ORDER_STATUS_OPTIONS: Array<{ id: ServiceOrderStatus; label: string; description: string }> = [
  ...SERVICE_ORDER_STATUS_FLOW,
  { id: 'cancelled', label: 'Cancelada', description: 'Ordem encerrada sem conclusão do serviço.' },
];

export const SERVICE_ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_ORDER_STATUS_OPTIONS.map(({ id, label }) => [id, label]),
);

export const SERVICE_ORDER_STATUS_IDS = SERVICE_ORDER_STATUS_OPTIONS.map((status) => status.id);

export function serviceOrderStatusLabel(status?: string | null) {
  return SERVICE_ORDER_STATUS_LABELS[String(status || '')] || String(status || 'Sem status');
}

export function serviceOrderStatusIndex(status?: string | null) {
  return SERVICE_ORDER_STATUS_FLOW.findIndex((item) => item.id === status);
}
