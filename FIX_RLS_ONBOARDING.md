# 🔧 FIX: RLS Policies para Onboarding

## ❌ Problema
O onboarding está falhando com erro:
```
new row violates row-level security policy for table "companies"
```

## ✅ Solução
Execute o SQL abaixo no Supabase Dashboard para adicionar as políticas RLS que faltam.

---

## 📝 Passos para Executar

1. **Acesse o SQL Editor do Supabase:**
   https://supabase.com/dashboard/project/ujcpvduissqhrpjcdfvy/sql/new

2. **Cole o SQL abaixo no editor**

3. **Clique em "Run" (ou pressione Ctrl+Enter)**

4. **Recarregue a aplicação e tente o onboarding novamente**

---

## 📋 SQL para Executar

```sql
-- =====================================================
-- COMPANIES POLICIES
-- =====================================================

-- Allow authenticated users to insert companies (for onboarding)
CREATE POLICY "Authenticated users can insert companies" ON companies
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users with access to update companies
CREATE POLICY "Users can update their companies" ON companies
  FOR UPDATE
  USING (user_has_access_to_company(id))
  WITH CHECK (user_has_access_to_company(id));

-- Allow admin_master to delete companies
CREATE POLICY "Admin master can delete companies" ON companies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_master'
    )
  );

-- =====================================================
-- STORES POLICIES
-- =====================================================

-- Allow users with company access to insert stores
CREATE POLICY "Users can insert stores in their companies" ON stores
  FOR INSERT
  WITH CHECK (user_has_access_to_company(company_id));

-- Allow users with access to update stores
CREATE POLICY "Users can update their stores" ON stores
  FOR UPDATE
  USING (user_has_access_to_company(company_id))
  WITH CHECK (user_has_access_to_company(company_id));

-- Allow admin_master to delete stores
CREATE POLICY "Admin master can delete stores" ON stores
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_master'
    )
  );

-- =====================================================
-- FIX: Update user_has_access_to_company function
-- =====================================================
-- The function needs to allow access during onboarding when user has no companies yet

CREATE OR REPLACE FUNCTION public.user_has_access_to_company(c_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'admin_master'
      OR c_id = ANY(companies)
      OR companies = '{}' -- Allow if user has no companies yet (onboarding)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🎯 O que isso faz?

1. **Permite INSERT em companies** - Usuários autenticados podem criar empresas (necessário para onboarding)
2. **Permite UPDATE em companies** - Usuários com acesso podem editar suas empresas
3. **Permite DELETE em companies** - Apenas admin_master pode deletar empresas
4. **Mesmas políticas para stores** - Controle de acesso para lojas
5. **Corrige a função `user_has_access_to_company`** - Permite acesso durante onboarding quando o usuário ainda não tem empresas cadastradas (`companies = '{}'`)

---

## ⚠️ Nota Técnica

O Supabase não permite executar SQL administrativo (CREATE POLICY, CREATE FUNCTION) via API REST, mesmo com a service role key. Isso é uma medida de segurança intencional para prevenir execução arbitrária de SQL.

Por isso, essas políticas precisam ser aplicadas manualmente através do Dashboard.
