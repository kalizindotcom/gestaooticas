# 🔧 REVISÃO COMPLETA DO SCHEMA - Correções Necessárias

## 📊 Análise Completa Realizada

Foi feita uma auditoria completa de **144 arquivos** do projeto, comparando todas as operações de banco de dados com o schema do Supabase.

---

## ❌ PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. **financial_entries** - 5 COLUNAS FALTANDO (CRÍTICO)

**Impacto:** Gerar carnês, registrar pagamentos, criar lançamentos financeiros **FALHAM**

**Colunas faltando:**
- `payment_method` (TEXT) - Método de pagamento (dinheiro, cartão, PIX, etc)
- `origin_table` (TEXT) - Tabela de origem (sales, service_orders, etc)
- `origin_id` (UUID) - ID do registro de origem
- `supplier_customer_name` (TEXT) - Nome do fornecedor/cliente
- `payment_date` (TIMESTAMP) - Data do pagamento efetivo

**Usado em:**
- `src/components/customers/CreditTab.tsx:89-93`
- `src/hooks/useCustomerData.ts:289-292, 376-379`

---

### 2. **financial_entries** - CONSTRAINT INCORRETO (CRÍTICO)

**Problema:** O CHECK constraint só permite `'receivable'` e `'payable'`, mas o código usa `'in'` e `'out'`

**Impacto:** Vendas com pagamento à vista **FALHAM**

**Usado em:** `src/hooks/useCustomerData.ts:282`

---

### 3. **service_orders** - 1 COLUNA FALTANDO (MÉDIO)

**Impacto:** Ordens de serviço com laboratório **PERDEM A REFERÊNCIA**

**Coluna faltando:**
- `lab_id` (UUID) - ID do laboratório

**Usado em:** `src/hooks/useCustomerData.ts:332`

**Nota:** A tabela tem `lab_name` (TEXT), mas o código tenta usar `lab_id` (UUID)

---

### 4. **SISTEMA DE PERMISSÕES NÃO APLICADO** (ALTO)

**Impacto:** Gestão de usuários e permissões **NÃO FUNCIONA**

**Tabelas faltando:**
- `roles` - Perfis de acesso
- `permissions` - Permissões do sistema
- `role_permissions` - Relação perfil-permissão
- `user_permissions` - Permissões customizadas por usuário

**Status:** ✅ Migration já existe: `supabase/migrations/20260428_users_permissions_system.sql`

**Coluna faltando em profiles:**
- `role_id` (UUID) - Referência ao perfil do usuário

---

### 5. **POLÍTICAS RLS FALTANDO** (MÉDIO)

**Impacto:** Operações de INSERT/UPDATE/DELETE podem falhar

**Tabelas sem políticas completas:**
- `financial_entries` - falta INSERT, UPDATE, DELETE
- `service_orders` - falta INSERT, UPDATE, DELETE

---

## ✅ SOLUÇÃO CONSOLIDADA

Criei uma migration única que corrige **TODOS OS PROBLEMAS**:

📄 **Arquivo:** `supabase/migrations/20260428_complete_schema_fixes.sql`

---

## 📋 COMO APLICAR AS CORREÇÕES

### Opção 1: Executar Tudo de Uma Vez (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/ujcpvduissqhrpjcdfvy/sql/new

2. Abra o arquivo: `supabase/migrations/20260428_complete_schema_fixes.sql`

3. Copie **TODO O CONTEÚDO** e cole no SQL Editor

4. Clique em **"Run"**

5. Aguarde a mensagem de sucesso

---

### Opção 2: Executar em Etapas

Se preferir aplicar uma correção por vez:

#### Etapa 1: Corrigir financial_entries (CRÍTICO)
```sql
ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS origin_table TEXT,
  ADD COLUMN IF NOT EXISTS origin_id UUID,
  ADD COLUMN IF NOT EXISTS supplier_customer_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_financial_entries_origin
  ON financial_entries(origin_table, origin_id);

ALTER TABLE financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_type_check;

ALTER TABLE financial_entries
  ADD CONSTRAINT financial_entries_type_check
  CHECK (type IN ('receivable', 'payable', 'in', 'out'));
```

#### Etapa 2: Corrigir service_orders
```sql
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS lab_id UUID;

CREATE INDEX IF NOT EXISTS idx_service_orders_lab_id
  ON service_orders(lab_id);
```

#### Etapa 3: Aplicar Sistema de Permissões
```sql
-- Copie e execute TODO o conteúdo de:
-- supabase/migrations/20260428_users_permissions_system.sql
```

#### Etapa 4: Adicionar Políticas RLS
```sql
-- Copie e execute a seção "VERIFY: Ensure RLS policies" de:
-- supabase/migrations/20260428_complete_schema_fixes.sql
```

---

## 🎯 O QUE SERÁ CORRIGIDO

### ✅ Após aplicar as correções:

1. **Carnês funcionarão** - Todas as colunas necessárias estarão presentes
2. **Pagamentos à vista funcionarão** - Constraint aceita tipos 'in' e 'out'
3. **Ordens de serviço com lab** - Poderão armazenar lab_id
4. **Sistema de permissões** - Gestão completa de usuários e acessos
5. **Políticas RLS completas** - INSERT/UPDATE/DELETE protegidos

---

## 📊 TABELAS VERIFICADAS E OK

Estas tabelas foram auditadas e **NÃO TÊM PROBLEMAS**:

- ✅ **sales** - Todas as colunas presentes
- ✅ **sale_items** - Todas as colunas presentes
- ✅ **appointments** - Todas as colunas presentes
- ✅ **service_order_timeline** - Todas as colunas presentes
- ✅ **customers** - Schema correto
- ✅ **products** - Schema correto
- ✅ **product_stock** - Schema correto
- ✅ **product_movements** - Schema correto
- ✅ **companies** - Schema correto (políticas RLS já corrigidas)
- ✅ **stores** - Schema correto (políticas RLS já corrigidas)
- ✅ **profiles** - Apenas falta role_id (será adicionado)

---

## ⚠️ IMPORTANTE

**Execute as correções AGORA** para evitar:
- ❌ Erros ao gerar carnês
- ❌ Falhas ao registrar pagamentos
- ❌ Perda de dados de laboratórios em OS
- ❌ Sistema de permissões não funcional
- ❌ Erros de RLS em operações críticas

---

## 🔍 VERIFICAÇÃO PÓS-APLICAÇÃO

Após executar a migration, você verá mensagens como:

```
✓ All financial_entries columns present
✓ service_orders.lab_id column present
```

Se aparecer alguma mensagem de "Missing columns", execute novamente a seção correspondente.

---

## 📞 PRÓXIMOS PASSOS

1. ✅ Execute a migration completa
2. ✅ Teste gerar um carnê
3. ✅ Teste criar uma OS com laboratório
4. ✅ Teste o sistema de permissões de usuários
5. ✅ Faça commit das migrations

---

**Arquivo principal:** `supabase/migrations/20260428_complete_schema_fixes.sql`

**Documentação adicional:**
- `FIX_RLS_ONBOARDING.md` - Correção de onboarding (já aplicado)
- `FIX_FINANCIAL_ENTRIES_ORIGIN.md` - Correção parcial (substituído pela migration completa)
