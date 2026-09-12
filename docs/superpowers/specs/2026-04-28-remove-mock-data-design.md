# Design: Remoção de Mock Data e Integração com Supabase Real

**Data:** 2026-04-28  
**Autor:** Claude (Opus 4.7)  
**Status:** Aguardando Aprovação

---

## 1. Visão Geral

### Objetivo
Substituir todos os dados mockados (`mockData.ts`) por dados reais do Supabase, permitindo que o sistema funcione com banco de dados vazio e inclua um wizard de onboarding para configuração inicial.

### Problema Atual
- 33 arquivos importam dados de `mockData.ts`
- Usuários veem dados fictícios mesmo após criar registros reais
- Banco de dados Supabase está vazio após login
- Sem fluxo de configuração inicial para novos usuários

### Solução Proposta
1. Substituir imports de mockData pelos hooks do Supabase
2. Adicionar estados de loading, empty e error em todas as páginas
3. Criar wizard de onboarding para primeiro acesso
4. Manter `mockData.ts` apenas para tipos TypeScript

---

## 2. Arquitetura da Solução

### Fluxo de Dados

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Componente │────▶│ Hook Supabase│────▶│ React Query │────▶│  Supabase    │
│   (React)   │◀────│ (useXXX)     │◀────│   (cache)   │◀────│ PostgreSQL   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

### Componentes Principais

1. **Hooks do Supabase** (`src/hooks/useSupabaseData.ts`)
   - Já existentes, precisam de ajustes
   - Responsáveis por fetch, cache e transformação de dados

2. **Wizard de Onboarding** (`src/components/onboarding/OnboardingWizard.tsx`)
   - Novo componente a ser criado
   - Detecta primeiro acesso
   - Guia configuração inicial

3. **Estados de UI** (Loading, Empty, Error)
   - Componentes reutilizáveis
   - Aplicados consistentemente em todas as páginas

---

## 3. Wizard de Onboarding

### Fluxo do Wizard

```
┌──────────────┐
│ Login/Signup │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Verificar se há  │
│ empresa/loja     │
└──────┬───────────┘
       │
       ├─── SIM ──▶ Dashboard Normal
       │
       └─── NÃO ──▶ Wizard de Onboarding
                    │
                    ▼
              ┌─────────────┐
              │  Passo 1:   │
              │  Empresa    │
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │  Passo 2:   │
              │    Loja     │
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │  Passo 3:   │
              │  Concluído  │
              └──────┬──────┘
                     │
                     ▼
              Dashboard Normal
```

### Passos do Wizard

**Passo 1: Cadastro de Empresa**
- Campos obrigatórios: Nome, Nome Fantasia
- Campos opcionais: CNPJ, Email, Telefone, Cidade, Estado
- Cores: Primária e Secundária (com color picker)
- Logo (upload opcional)

**Passo 2: Cadastro de Loja**
- Campos obrigatórios: Nome, Empresa (auto-selecionada)
- Campos opcionais: Código, Endereço, Telefone, Gerente, Horário
- Cidade, Estado

**Passo 3: Conclusão**
- Mensagem de sucesso
- Resumo do que foi configurado
- Botão "Começar a usar"
- Redireciona para Dashboard

### Detecção de Primeiro Acesso

```typescript
// Lógica de detecção
const needsOnboarding = async (userId: string) => {
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .limit(1);
  
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .limit(1);
  
  return companies.length === 0 || stores.length === 0;
};
```

### Componente do Wizard

**Localização:** `src/components/onboarding/OnboardingWizard.tsx`

**Props:**
```typescript
interface OnboardingWizardProps {
  onComplete: () => void;
}
```

**Estado interno:**
```typescript
const [currentStep, setCurrentStep] = useState(1); // 1, 2, 3
const [companyData, setCompanyData] = useState({});
const [storeData, setStoreData] = useState({});
```

**Subcomponentes:**
- `OnboardingStep1Company.tsx` - Formulário de empresa
- `OnboardingStep2Store.tsx` - Formulário de loja
- `OnboardingStep3Complete.tsx` - Tela de conclusão
- `OnboardingProgress.tsx` - Indicador de progresso (bolinhas)

---

## 4. Estratégia de Migração

### Ordem de Migração (Prioridade)

**Fase 1: Infraestrutura (Crítico)**
1. Criar componentes de UI reutilizáveis
   - `LoadingSpinner.tsx`
   - `ErrorMessage.tsx`
   - Melhorar `EmptyState.tsx` existente
2. Criar wizard de onboarding completo
3. Ajustar `App.tsx` para detectar e mostrar wizard

**Fase 2: Módulos Básicos (Alto)**
4. Companies (2 arquivos)
5. Stores (1 arquivo)
6. Customers (3 arquivos)
7. Products (2 arquivos)

**Fase 3: Módulos Transacionais (Médio)**
8. Sales (2 arquivos)
9. Appointments (1 arquivo)
10. Service Orders (2 arquivos)

**Fase 4: Módulos Complexos (Baixo)**
11. Financial (6 arquivos)
12. Reports (4 arquivos)
13. Admin Center (1 arquivo)

**Fase 5: Componentes Auxiliares (Baixo)**
14. Shared components (3 arquivos)
15. Print components (2 arquivos)

### Total de Arquivos a Migrar
- **33 arquivos** que importam mockData
- **4 novos componentes** (wizard + UI states)
- **1 arquivo** de roteamento (`App.tsx`)

---

## 5. Padrão de Implementação

### Antes (com Mock Data)

```typescript
// src/pages/Sales.tsx
import { sales, stores, customers } from '@/data/mockData';

export default function Sales() {
  return (
    <div>
      <Table data={sales} />
    </div>
  );
}
```

### Depois (com Supabase)

```typescript
// src/pages/Sales.tsx
import { useSales } from '@/hooks/useSupabaseData';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';

export default function Sales() {
  const { data: sales = [], isLoading, error } = useSales();
  
  if (isLoading) {
    return <LoadingSpinner message="Carregando vendas..." />;
  }
  
  if (error) {
    return <ErrorMessage 
      title="Erro ao carregar vendas"
      message={error.message}
      retry={() => window.location.reload()}
    />;
  }
  
  if (sales.length === 0) {
    return <EmptyState 
      icon={ShoppingCart}
      title="Nenhuma venda cadastrada"
      description="Comece registrando sua primeira venda"
      action={
        <Button onClick={() => setShowModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Venda
        </Button>
      }
    />;
  }
  
  return (
    <div>
      <Table data={sales} />
    </div>
  );
}
```

---

## 6. Componentes Reutilizáveis

### LoadingSpinner

**Localização:** `src/components/shared/LoadingSpinner.tsx`

**Interface:**
```typescript
interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Uso:**
```typescript
<LoadingSpinner message="Carregando dados..." size="md" />
```

### ErrorMessage

**Localização:** `src/components/shared/ErrorMessage.tsx`

**Interface:**
```typescript
interface ErrorMessageProps {
  title: string;
  message: string;
  retry?: () => void;
}
```

**Uso:**
```typescript
<ErrorMessage 
  title="Erro ao carregar"
  message="Não foi possível conectar ao servidor"
  retry={() => refetch()}
/>
```

### EmptyState (Melhorado)

**Localização:** `src/components/shared/EmptyState.tsx` (já existe)

**Melhorias necessárias:**
- Adicionar prop `icon` (componente Lucide)
- Adicionar prop `action` (botão de ação)
- Melhorar estilos visuais

**Interface atualizada:**
```typescript
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}
```

---

## 7. Tratamento de Relacionamentos

### Problema
Dados mockados têm campos denormalizados:
```typescript
// Mock
{
  id: '1',
  customerId: 'c1',
  customerName: 'João Silva', // ❌ Denormalizado
}
```

### Solução: Joins no Supabase

```typescript
// Hook atualizado
export const useSales = () => {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  
  return useQuery({
    queryKey: ['sales', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`
          *,
          customer:customers(id, name, phone),
          store:stores(id, name),
          seller:profiles(id, name)
        `);
      
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      
      if (selectedStoreIds?.length > 0) {
        query = query.in('store_id', selectedStoreIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map(transformSale);
    }
  });
};

const transformSale = (sale: any) => ({
  id: sale.id,
  companyId: sale.company_id,
  storeId: sale.store_id,
  storeName: sale.store?.name,
  customerId: sale.customer_id,
  customerName: sale.customer?.name,
  sellerId: sale.seller_id,
  sellerName: sale.seller?.name,
  date: sale.date,
  total: sale.total,
  status: sale.status,
  items: sale.items || [],
});
```

### Aplicar em Todos os Hooks

Padrão consistente:
1. Select com joins para relacionamentos
2. Aplicar filtros globais (empresa/loja)
3. Transformar snake_case → camelCase
4. Retornar dados tipados

---

## 8. Transformação de Dados (snake_case ↔ camelCase)

### Problema
- Banco: `customer_name`, `store_id`, `company_id`
- Frontend: `customerName`, `storeId`, `companyId`

### Solução: Transformers Consistentes

**Criar utilitário:**
```typescript
// src/lib/transformers.ts

export const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  
  return obj;
};

export const toSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  
  return obj;
};
```

**Aplicar nos hooks:**
```typescript
export const useCustomers = () => {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*');
      return data.map(toCamelCase); // ✅ Transforma automaticamente
    }
  });
};
```

---

## 9. Gestão de Estados Vazios

### Mensagens por Módulo

**Companies:**
- Título: "Nenhuma empresa cadastrada"
- Descrição: "Cadastre sua primeira empresa para começar a usar o sistema"
- Ação: Botão "Cadastrar Empresa"

**Stores:**
- Título: "Nenhuma loja cadastrada"
- Descrição: "Adicione lojas para organizar suas operações"
- Ação: Botão "Cadastrar Loja"

**Customers:**
- Título: "Nenhum cliente cadastrado"
- Descrição: "Comece adicionando seus clientes"
- Ação: Botão "Novo Cliente"

**Sales:**
- Título: "Nenhuma venda registrada"
- Descrição: "Registre sua primeira venda para começar"
- Ação: Botão "Nova Venda"

**Appointments:**
- Título: "Nenhum agendamento"
- Descrição: "Crie agendamentos para organizar seu atendimento"
- Ação: Botão "Novo Agendamento"

**Products:**
- Título: "Nenhum produto cadastrado"
- Descrição: "Adicione produtos ao seu catálogo"
- Ação: Botão "Cadastrar Produto"

**Service Orders:**
- Título: "Nenhuma ordem de serviço"
- Descrição: "Crie ordens de serviço para acompanhar trabalhos"
- Ação: Botão "Nova OS"

**Financial:**
- Título: "Nenhum lançamento financeiro"
- Descrição: "Registre entradas e saídas para controlar suas finanças"
- Ação: Botão "Novo Lançamento"

**Reports:**
- Título: "Dados insuficientes"
- Descrição: "Cadastre vendas e movimentações para gerar relatórios"
- Ação: Link "Ir para Vendas"

---

## 10. Validação de Dependências

### Ordem de Cadastro Necessária

```
1. Empresa (obrigatória)
   └─▶ 2. Loja (obrigatória, depende de empresa)
        └─▶ 3. Clientes (opcional)
        └─▶ 4. Produtos (opcional)
        └─▶ 5. Usuários (opcional)
             └─▶ 6. Vendas (depende de clientes + produtos)
             └─▶ 7. Agendamentos (depende de clientes)
             └─▶ 8. OS (depende de clientes)
```

### Validações nos Formulários

**Ao tentar criar Venda sem Cliente:**
```typescript
if (customers.length === 0) {
  toast.error('Cadastre um cliente antes de criar uma venda', {
    action: {
      label: 'Cadastrar Cliente',
      onClick: () => navigate('/customers')
    }
  });
  return;
}
```

**Ao tentar criar Loja sem Empresa:**
```typescript
if (companies.length === 0) {
  toast.error('Cadastre uma empresa antes de criar uma loja', {
    action: {
      label: 'Cadastrar Empresa',
      onClick: () => navigate('/companies')
    }
  });
  return;
}
```

### Redirecionamentos Inteligentes

Se usuário tenta acessar página que requer dados não cadastrados:
1. Detectar dependência faltante
2. Mostrar toast explicativo
3. Redirecionar para página de cadastro
4. Após cadastro, voltar para página original

---

## 11. Integração com App.tsx

### Fluxo de Autenticação + Onboarding

```typescript
// src/App.tsx

function ProtectedRoute({ children, module, action }) {
  const { isAuthenticated, loading } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  
  useEffect(() => {
    if (isAuthenticated && !loading) {
      checkOnboardingStatus();
    }
  }, [isAuthenticated, loading]);
  
  const checkOnboardingStatus = async () => {
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .limit(1);
    
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .limit(1);
    
    setNeedsOnboarding(companies.length === 0 || stores.length === 0);
    setCheckingOnboarding(false);
  };
  
  if (loading || checkingOnboarding) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />;
  }
  
  return (
    <GlobalFilterProvider>
      <AppLayout>{children}</AppLayout>
    </GlobalFilterProvider>
  );
}
```

---

## 12. Ajustes nos Hooks Existentes

### Problemas Identificados

1. **Race Condition no GlobalFilter**
   - Hook depende de `selectedCompanyId` mas ele pode ser null inicialmente
   - Solução: Remover `enabled: !!selectedCompanyId`

2. **Falta de Tratamento de Erro**
   - Hooks não tratam erros adequadamente
   - Solução: Adicionar error handling em todos os hooks

3. **Cache Inconsistente**
   - QueryKeys não incluem todos os filtros
   - Solução: Incluir todos os filtros relevantes nas queryKeys

### Exemplo de Hook Corrigido

```typescript
export const useCustomers = () => {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  
  return useQuery({
    queryKey: ['customers', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Aplicar filtros se existirem
      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }
      
      if (selectedStoreIds && selectedStoreIds.length > 0) {
        query = query.in('store_id', selectedStoreIds);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }
      
      return data.map(toCamelCase);
    },
    // Remover enabled: !!selectedCompanyId
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
```

---

## 13. Manutenção do mockData.ts

### O que Manter

**Apenas tipos TypeScript:**
```typescript
// src/data/mockData.ts

export interface Company {
  id: string;
  name: string;
  tradeName: string;
  cnpj: string;
  // ... resto dos campos
}

export interface Store {
  id: string;
  companyId: string;
  name: string;
  // ... resto dos campos
}

// ... outras interfaces
```

### O que Remover

**Todos os dados mockados:**
```typescript
// ❌ REMOVER
export const companies: Company[] = [
  { id: '1', name: 'Empresa 1', ... },
  { id: '2', name: 'Empresa 2', ... },
];

export const stores: Store[] = [...];
export const customers: Customer[] = [...];
// etc.
```

### Alternativa: Mover Tipos

Opcionalmente, mover tipos para arquivo dedicado:
- `src/types/company.ts`
- `src/types/store.ts`
- `src/types/customer.ts`
- etc.

E deletar `mockData.ts` completamente.

---

## 14. Testes e Validação

### Checklist de Validação por Página

Para cada página migrada, validar:

- [ ] Loading state aparece durante fetch
- [ ] Empty state aparece quando não há dados
- [ ] Error state aparece em caso de erro
- [ ] Dados são exibidos corretamente quando existem
- [ ] Filtros globais funcionam (empresa/loja)
- [ ] Formulários de criação funcionam
- [ ] Formulários de edição funcionam
- [ ] Deleção funciona
- [ ] Relacionamentos são exibidos corretamente (nomes, não IDs)

### Teste do Wizard

- [ ] Wizard aparece no primeiro acesso
- [ ] Passo 1 (Empresa) salva corretamente
- [ ] Passo 2 (Loja) salva corretamente
- [ ] Passo 3 (Conclusão) redireciona para dashboard
- [ ] Wizard não aparece em acessos subsequentes
- [ ] Dados criados no wizard aparecem no sistema

### Teste de Integração

- [ ] Criar empresa → Criar loja → Criar cliente → Criar venda (fluxo completo)
- [ ] Filtro global funciona em todas as páginas
- [ ] Permissões continuam funcionando
- [ ] Logout/Login mantém dados

---

## 15. Cronograma Estimado

### Fase 1: Infraestrutura (1 dia)
- Criar componentes LoadingSpinner, ErrorMessage
- Melhorar EmptyState
- Criar wizard de onboarding (4 componentes)
- Integrar wizard no App.tsx

### Fase 2: Módulos Básicos (1 dia)
- Migrar Companies (2 arquivos)
- Migrar Stores (1 arquivo)
- Migrar Customers (3 arquivos)
- Migrar Products (2 arquivos)

### Fase 3: Módulos Transacionais (1 dia)
- Migrar Sales (2 arquivos)
- Migrar Appointments (1 arquivo)
- Migrar Service Orders (2 arquivos)

### Fase 4: Módulos Complexos (1 dia)
- Migrar Financial (6 arquivos)
- Migrar Reports (4 arquivos)
- Migrar Admin Center (1 arquivo)

### Fase 5: Componentes Auxiliares (0.5 dia)
- Migrar Shared components (3 arquivos)
- Migrar Print components (2 arquivos)

### Fase 6: Ajustes e Testes (0.5 dia)
- Corrigir bugs encontrados
- Validar todos os fluxos
- Limpar código não utilizado

**Total Estimado: 5 dias**

---

## 16. Riscos e Mitigações

### Risco 1: Hooks do Supabase com Bugs
**Probabilidade:** Média  
**Impacto:** Alto  
**Mitigação:** Testar cada hook individualmente antes de migrar páginas

### Risco 2: Performance com Banco Vazio
**Probabilidade:** Baixa  
**Impacto:** Baixo  
**Mitigação:** Empty states já resolvem isso

### Risco 3: Usuário Pular Wizard
**Probabilidade:** Baixa  
**Impacto:** Médio  
**Mitigação:** Wizard é obrigatório, não tem botão "Pular"

### Risco 4: Relacionamentos Quebrados
**Probabilidade:** Média  
**Impacto:** Alto  
**Mitigação:** Testar joins do Supabase antes de migrar

### Risco 5: Filtros Globais Não Funcionarem
**Probabilidade:** Baixa  
**Impacto:** Alto  
**Mitigação:** Validar filtros em cada hook migrado

---

## 17. Critérios de Sucesso

### Funcional
- ✅ Nenhum arquivo importa dados de mockData
- ✅ Todos os dados vêm do Supabase
- ✅ Wizard de onboarding funciona no primeiro acesso
- ✅ Sistema funciona com banco vazio
- ✅ Todos os CRUDs funcionam corretamente

### Técnico
- ✅ Sem erros no console
- ✅ Loading states em todas as páginas
- ✅ Empty states em todas as páginas
- ✅ Error handling adequado
- ✅ Transformação snake_case ↔ camelCase consistente

### UX
- ✅ Usuário entende o que fazer quando não há dados
- ✅ Wizard é intuitivo e rápido
- ✅ Mensagens de erro são claras
- ✅ Sistema responde rapidamente (< 2s para carregar dados)

---

## 18. Próximos Passos Após Implementação

1. **Adicionar Seed SQL Opcional**
   - Para ambientes de desenvolvimento/teste
   - Dados de exemplo para demonstrações

2. **Melhorar Performance**
   - Implementar paginação em listas grandes
   - Adicionar infinite scroll onde apropriado

3. **Adicionar Validações de Negócio**
   - Impedir double-booking em agendamentos
   - Validar estoque antes de vender
   - Criar lançamentos financeiros automaticamente

4. **Implementar Notificações**
   - Notificar quando dados são criados/atualizados
   - Sistema de notificações em tempo real (Supabase Realtime)

---

## 19. Conclusão

Esta solução remove completamente a dependência de dados mockados, substituindo-os por integração real com Supabase. O wizard de onboarding garante que novos usuários configurem o sistema corretamente antes de usar, enquanto os estados de UI (loading, empty, error) proporcionam uma experiência consistente e profissional.

A abordagem incremental (5 fases) permite testar e validar cada módulo antes de prosseguir, minimizando riscos. A estimativa de 5 dias é realista considerando a complexidade e o número de arquivos a serem migrados.

**Benefícios:**
- Sistema funcional com dados reais
- Onboarding guiado para novos usuários
- UX consistente em todo o sistema
- Base sólida para futuras melhorias

**Próximo Passo:** Criar plano de implementação detalhado com tasks específicas.
