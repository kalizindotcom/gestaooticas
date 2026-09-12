import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { localApi } from '@/lib/localApi';
import { useAuth } from './AuthContext';

interface DateRange {
  from: Date;
  to: Date;
}

interface Store {
  id: string;
  company_id: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  manager?: string;
  hours?: string;
  status?: 'active' | 'inactive';
  city?: string;
  state?: string;
}

interface Company {
  id: string;
  name: string;
  trade_name?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  status?: 'active' | 'inactive';
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
}

interface GlobalFilterState {
  selectedCompanyId: string | null;
  selectedStoreIds: string[];
  dateRange: DateRange;
  period: string;
  companies: Company[];
  stores: Store[];
  loading: boolean;
  setSelectedCompanyId: (id: string | null) => void;
  setSelectedStoreIds: (ids: string[]) => void;
  setDateRange: (range: DateRange) => void;
  setPeriod: (period: string) => void;
  getFilteredStores: () => Store[];
  selectAllStores: () => void;
  refreshData: () => Promise<void>;
}

const GlobalFilterContext = createContext<GlobalFilterState | undefined>(undefined);

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [period, setPeriod] = useState('month');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // A identidade visual é global e fixa; trocar a empresa altera somente os dados exibidos.

  useEffect(() => {
    if (user) {
      fetchInitialData();
    }
  }, [user]);

  const fetchInitialData = async () => {
    setLoading(true);

    try {
      const { data: cos, error: coErr } = await localApi
        .from('companies')
        .select('*')
        .order('name');
      
      if (!coErr && cos) {
        setCompanies(cos);
        if (cos.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(cos[0].id);
        }
      }

      const { data: sts, error: stErr } = await localApi
        .from('stores')
        .select('*')
        .order('name');
      
      if (!stErr && sts) {
        setStores(sts);
      }
    } catch (err) {
      console.error('Error fetching global filter data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredStores = () => {
    if (!selectedCompanyId) return stores;
    return stores.filter(s => s.company_id === selectedCompanyId);
  };

  const selectAllStores = () => {
    const filtered = getFilteredStores();
    setSelectedStoreIds(filtered.map(s => s.id));
  };

  useEffect(() => {
    if (selectedCompanyId && stores.length > 0) {
      const filtered = stores.filter(s => s.company_id === selectedCompanyId);
      if (filtered.length > 0) {
        // Só atualiza se realmente mudou
        const newStoreIds = filtered.map(s => s.id);
        setSelectedStoreIds(prev => {
          // Compara arrays para evitar updates desnecessários
          if (prev.length !== newStoreIds.length ||
              !prev.every((id, index) => id === newStoreIds[index])) {
            return newStoreIds;
          }
          return prev;
        });
      } else if (selectedStoreIds.length > 0) {
        setSelectedStoreIds([]);
      }
    }
  }, [selectedCompanyId, stores.length]); // Removido stores do array de dependências

  return (
    <GlobalFilterContext.Provider value={{
      selectedCompanyId,
      selectedStoreIds,
      dateRange,
      period,
      companies,
      stores,
      loading,
      setSelectedCompanyId,
      setSelectedStoreIds,
      setDateRange,
      setPeriod,
      getFilteredStores,
      selectAllStores,
      refreshData: fetchInitialData,
    }}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilter() {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) throw new Error('useGlobalFilter must be used within GlobalFilterProvider');
  return ctx;
}
