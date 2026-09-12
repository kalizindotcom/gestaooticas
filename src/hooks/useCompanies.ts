import { useState, useEffect } from 'react';
import { localApi } from '@/lib/localApi';
import { toast } from 'sonner';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { COMPANY_PALETTE } from '@/lib/branding';

export interface Company {
  id: string;
  name: string;
  tradeName: string;
  cnpj: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: 'active' | 'inactive';
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
  created_at?: string;
}

export function useCompanies() {
  const [loading, setLoading] = useState(false);
  const { companies: companiesList, refreshData } = useGlobalFilter();

  const mapToCamelCase = (dbCompany: any): Company => ({
    id: dbCompany.id,
    name: dbCompany.name,
    tradeName: dbCompany.trade_name || '',
    cnpj: dbCompany.cnpj || '',
    email: dbCompany.email || '',
    phone: dbCompany.phone || '',
    city: dbCompany.city || '',
    state: dbCompany.state || '',
    status: dbCompany.status || 'active',
    ...COMPANY_PALETTE,
    logo: dbCompany.logo_url || '',
    created_at: dbCompany.created_at,
  });

  const mapToSnakeCase = (company: Partial<Company>) => ({
    name: company.name,
    trade_name: company.tradeName,
    cnpj: company.cnpj,
    email: company.email,
    phone: company.phone,
    city: company.city,
    state: company.state,
    status: company.status,
    primary_color: COMPANY_PALETTE.primaryColor,
    secondary_color: COMPANY_PALETTE.secondaryColor,
    logo_url: company.logo,
  });

  const saveCompany = async (company: Partial<Company> & { id?: string }) => {
    setLoading(true);
    try {
      const data = mapToSnakeCase(company);
      
      const isNew = !company.id;
      
      if (!isNew) {
        const { error } = await localApi
          .from('companies')
          .update(data)
          .eq('id', company.id);
        
        if (error) throw error;
      } else {
        const { error } = await localApi
          .from('companies')
          .insert([data]);
        
        if (error) throw error;
      }
      
      await refreshData();
      return true;
    } catch (error: any) {
      console.error('Error saving company:', error);
      let errorMessage = error.message;
      if (error.code === '23505') {
        errorMessage = 'Este CNPJ já está cadastrado em outra empresa.';
      } else if (error.code === '42501') {
        errorMessage = 'Você não tem permissão para realizar esta operação (RLS).';
      }
      toast.error('Erro ao salvar empresa: ' + errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteCompany = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await localApi
        .from('companies')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await refreshData();
      return true;
    } catch (error: any) {
      console.error('Error deleting company:', error);
      toast.error('Erro ao excluir empresa: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setLoading(true);
    try {
      const { error } = await localApi
        .from('companies')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      await refreshData();
      return true;
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const mappedCompanies = (companiesList || []).map(mapToCamelCase);

  return {
    companies: mappedCompanies,
    loading,
    saveCompany,
    deleteCompany,
    toggleStatus,
    refreshCompanies: refreshData,
  };
}
