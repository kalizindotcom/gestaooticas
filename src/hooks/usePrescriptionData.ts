import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localApi } from '@/lib/localApi';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';

const todayIso = () => new Date().toISOString().slice(0, 10);

export const emptyPrescriptionEye = () => ({ sph: '', cyl: '', axis: '', add: '' });

export const createPrescriptionForm = (storeId = '', customerId = '') => ({
  customerId,
  storeId,
  professionalId: '',
  issueDate: todayIso(),
  validUntil: '',
  notes: '',
  rightEye: emptyPrescriptionEye(),
  leftEye: emptyPrescriptionEye(),
  pupillaryDistance: '',
  largestDiagonal: '',
  verticalHeight: '',
  frameSize: '',
  bridgeSize: '',
  frameAndBridge: '',
  opticalCenterHeight: '',
  rightEyeFar: '',
  rightEyeNear: '',
  leftEyeFar: '',
  leftEyeNear: '',
});

export const normalizePrescription = (row: any) => ({
  ...row,
  companyId: row.company_id,
  storeId: row.store_id,
  customerId: row.customer_id,
  professionalId: row.professional_id || '',
  professionalName: row.professional_name || 'Não informado',
  issueDate: row.issue_date,
  validUntil: row.valid_until || '',
  status: row.status || 'active',
  notes: row.notes || '',
  rightEye: { sph: row.od_sph || '', cyl: row.od_cyl || '', axis: row.od_axis || '', add: row.od_add || '' },
  leftEye: { sph: row.oe_sph || '', cyl: row.oe_cyl || '', axis: row.oe_axis || '', add: row.oe_add || '' },
  pupillaryDistance: row.pupillary_distance || '',
  largestDiagonal: row.largest_diagonal || '',
  verticalHeight: row.vertical_height || '',
  frameSize: row.frame_size || '',
  bridgeSize: row.bridge_size || '',
  frameAndBridge: row.frame_and_bridge || '',
  opticalCenterHeight: row.optical_center_height || '',
  rightEyeFar: row.od_far || '',
  rightEyeNear: row.od_near || '',
  leftEyeFar: row.oe_far || '',
  leftEyeNear: row.oe_near || '',
});

export function useCustomerPrescriptions(customerId?: string) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();

  return useQuery({
    queryKey: ['customer-prescriptions', customerId, selectedCompanyId, selectedStoreIds],
    enabled: !!customerId && !!selectedCompanyId,
    queryFn: async () => {
      let query = localApi.from('prescriptions').select('*').eq('customer_id', customerId).eq('company_id', selectedCompanyId!);
      if (selectedStoreIds.length > 0) query = query.in('store_id', selectedStoreIds);
      const { data, error } = await query.order('issue_date', { ascending: false });
      if (error) throw error;
      return (data || []).map(normalizePrescription);
    },
  });
}

function invalidatePrescriptionQueries(queryClient: ReturnType<typeof useQueryClient>, customerId?: string) {
  queryClient.invalidateQueries({ queryKey: ['customer-prescriptions', customerId] });
  queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
}

export function useCustomerPrescriptionMutations(customer: any) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useGlobalFilter();

  const save = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: any }) => {
      if (!customer?.id || !selectedCompanyId || !data.storeId || !data.issueDate) throw new Error('Cliente, empresa, loja e data da receita são obrigatórios.');
      const professionalName = data.professionalName || '';
      const payload = {
        company_id: selectedCompanyId,
        store_id: data.storeId,
        customer_id: customer.id,
        professional_id: data.professionalId || null,
        professional_name: professionalName || null,
        issue_date: data.issueDate,
        valid_until: data.validUntil || null,
        status: data.validUntil && data.validUntil < todayIso() ? 'expired' : 'active',
        notes: data.notes?.trim() || null,
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
        updated_at: new Date().toISOString(),
      };
      if (id) {
        const { data: updated, error } = await localApi.from('prescriptions').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return updated;
      }
      const { data: inserted, error } = await localApi.from('prescriptions').insert({ ...payload, created_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      return inserted;
    },
    onSuccess: () => invalidatePrescriptionQueries(queryClient, customer?.id),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localApi.from('prescriptions').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => invalidatePrescriptionQueries(queryClient, customer?.id),
  });

  return { save, remove };
}

export function prescriptionToServiceOrderPatch(prescription: any) {
  return {
    prescriptionId: prescription.id || '',
    prescriptionDate: prescription.issueDate || prescription.issue_date || '',
    prescriptionValidUntil: prescription.validUntil || prescription.valid_until || '',
    prescriptionProfessionalId: prescription.professionalId || prescription.professional_id || '',
    rightEye: prescription.rightEye || { sph: '', cyl: '', axis: '', add: '' },
    leftEye: prescription.leftEye || { sph: '', cyl: '', axis: '', add: '' },
    pupillaryDistance: prescription.pupillaryDistance || prescription.pupillary_distance || '',
    largestDiagonal: prescription.largestDiagonal || prescription.largest_diagonal || '',
    verticalHeight: prescription.verticalHeight || prescription.vertical_height || '',
    frameSize: prescription.frameSize || prescription.frame_size || '',
    bridgeSize: prescription.bridgeSize || prescription.bridge_size || '',
    frameAndBridge: prescription.frameAndBridge || prescription.frame_and_bridge || '',
    opticalCenterHeight: prescription.opticalCenterHeight || prescription.optical_center_height || '',
    rightEyeFar: prescription.rightEyeFar || prescription.od_far || '',
    rightEyeNear: prescription.rightEyeNear || prescription.od_near || '',
    leftEyeFar: prescription.leftEyeFar || prescription.oe_far || '',
    leftEyeNear: prescription.leftEyeNear || prescription.oe_near || '',
  };
}
