# 🔧 FIX: Adicionar colunas origin_id e origin_table em financial_entries

## ❌ Problema
Ao gerar carnê, ocorre erro:
```
column "origin_id" of relation "financial_entries" does not exist
```

## ✅ Solução
Execute o SQL abaixo no Supabase Dashboard para adicionar as colunas que faltam.

---

## 📝 Passos para Executar

1. **Acesse o SQL Editor do Supabase:**
   https://supabase.com/dashboard/project/ujcpvduissqhrpjcdfvy/sql/new

2. **Cole o SQL abaixo no editor**

3. **Clique em "Run" (ou pressione Ctrl+Enter)**

4. **Tente gerar o carnê novamente**

---

## 📋 SQL para Executar

```sql
-- Add origin tracking columns
ALTER TABLE financial_entries
ADD COLUMN IF NOT EXISTS origin_id UUID,
ADD COLUMN IF NOT EXISTS origin_table TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_financial_entries_origin
ON financial_entries(origin_table, origin_id);

-- Add comment for documentation
COMMENT ON COLUMN financial_entries.origin_id IS 'ID of the source record (sale, service_order, etc)';
COMMENT ON COLUMN financial_entries.origin_table IS 'Source table name (sales, service_orders, etc)';
```

---

## 🎯 O que isso faz?

1. **Adiciona `origin_id`** - Armazena o ID da origem do lançamento financeiro (venda, OS, etc)
2. **Adiciona `origin_table`** - Armazena o nome da tabela de origem ('sales', 'service_orders', etc)
3. **Cria índice** - Melhora performance de consultas que filtram por origem
4. **Adiciona comentários** - Documenta o propósito das colunas

Essas colunas permitem rastrear de onde veio cada lançamento financeiro (carnê de venda, parcela de OS, etc).
