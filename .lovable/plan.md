

# OptiManager — Sistema de Gestão para Óticas

## Visão Geral
Sistema SaaS premium multiempresa/multiloja para gestão completa de óticas, com visual Navy Trust (azul marinho sofisticado), tipografia Sora + Manrope, e UX de altíssimo nível.

## Design System
- **Cores**: Navy Trust (#0f1b3d, #1e3a5f, #3b6fa0, #e8edf3) com variações para estados, alertas e feedback
- **Tipografia**: Sora (headings) + Manrope (body)
- **Tema claro** com estrutura preparada para dark mode
- **Cores dinâmicas** por empresa/loja (cor primária/secundária personalizável)
- Cards com sombra sutil, bordas arredondadas, microinterações, skeletons, empty states premium

## Layout Global
- **Sidebar esquerda** colapsável com ícones elegantes e agrupamento por módulos
- **Topbar fixa** com: seletor global de empresa/loja (multi-select), seletor de período, busca global, notificações, perfil
- **Breadcrumbs** contextuais
- O filtro global afeta todas as páginas automaticamente

## Autenticação & Permissões (Supabase Auth + RLS)
- Tela de login premium com branding
- Recuperação de senha
- Sistema de roles: Admin Master, Admin Empresa, Gerente, Vendedor, Financeiro, Estoquista, Recepção, Custom
- Tabela `user_roles` separada + `permissions` granulares por módulo/ação/empresa/loja
- Matriz visual de permissões na interface de gestão
- RLS policies com isolamento por empresa/loja

## Banco de Dados (Supabase)
Tabelas principais com RLS:
- `companies`, `stores` (com tema visual, logo, cores)
- `users`, `user_roles`, `permissions`, `user_companies`, `user_stores`
- `customers` (com tags, histórico, timeline)
- `appointments` (com status, prioridade, profissional)
- `sales`, `sale_items`
- `products`, `categories`, `stock_movements`
- `financial_entries` (contas a pagar/receber)
- `goals`, `audit_logs`, `settings`
- Seed com dados de exemplo (2 empresas, 4 lojas, clientes, agendamentos)

## Páginas (16 rotas)

### 1. Login & Recuperação de Senha
- Visual premium com gradiente navy, logo centralizado
- Campos com validação elegante

### 2. Dashboard Geral
- Cards KPI animados (agendamentos, vendas, faturamento, ticket médio, novos clientes, conversão)
- Gráficos: evolução por período, ranking de lojas, comparativo, funil operacional
- Próximos agendamentos, alertas operacionais, metas vs realizado
- Responde ao filtro global (empresa/loja/período)

### 3. Agendamentos (módulo principal)
- 4 visualizações: dia, semana, mês, lista
- Calendário visual com cores por status (agendado, confirmado, em atendimento, concluído, cancelado, faltou, reagendado)
- Criação/edição via modal elegante ou painel lateral
- Drag & drop para mover horários
- Filtros por loja, profissional, status, tipo de atendimento
- Busca por cliente, alertas de conflito, indicadores de ocupação
- Timeline do dia com cards visuais

### 4. Clientes
- Tabela moderna + modo cards
- Busca instantânea, filtros avançados (loja, status, tags, período)
- Ficha completa: dados pessoais, histórico de compras, agendamentos, timeline de interações
- Tags, observações, documentos, preferências
- Ações rápidas inline

### 5. Empresas
- CRUD completo com logo upload, cores primária/secundária
- Cards de resumo por empresa com métricas
- Visualização de lojas vinculadas
- Ativar/inativar

### 6. Lojas
- CRUD vinculado à empresa
- Código interno, gerente, horário de funcionamento, metas
- Tema visual individual
- Métricas por loja

### 7. Usuários & Permissões
- Lista de usuários com filtros por empresa/loja/perfil
- Criar/editar com vínculo a empresas e lojas
- Matriz visual de permissões por módulo e ação
- Perfis prontos + customizáveis
- Ativar/inativar, reset de senha

### 8. Financeiro
- Visão geral com cards (recebido, pendente, vencido)
- Contas a receber e a pagar
- Fluxo de caixa visual
- Faturamento por loja/empresa/período
- Metas financeiras

### 9. Vendas
- Lista de vendas com status e filtros
- Nova venda com seleção de produtos
- Métricas: total, ticket médio, conversão por loja/vendedor
- Detalhes da venda em drawer lateral

### 10. Produtos & Estoque
- Cadastro com categorias e marcas
- Estoque por loja com movimentações
- Alertas de estoque baixo
- Produtos mais vendidos

### 11. Relatórios & Métricas
- Central com relatórios pré-configurados
- Filtros por empresa/loja/período
- Gráficos comparativos entre lojas
- Métricas de agendamentos, vendas, financeiro, desempenho

### 12. Central Administrativa
- Painel master com visão global
- Gestão de empresas, lojas, usuários, permissões
- Logs de auditoria
- Controle de módulos e parâmetros globais

### 13. Configurações
- Configurações gerais do sistema
- Preferências por empresa/loja
- Temas e personalização visual

### 14. Perfil do Usuário
- Dados pessoais, foto, senha
- Empresas e lojas vinculadas
- Histórico de atividade

## Componentes Reutilizáveis
- `GlobalFilter` (empresa/loja/período)
- `KPICard`, `ChartCard`, `StatusBadge`
- `DataTable` com busca, filtros, ordenação, paginação
- `QuickActions`, `DetailDrawer`, `FormModal`
- `TimelineView`, `CalendarView`
- `SkeletonLoader`, `EmptyState`
- `PermissionMatrix`

## Fase 1 (Esta implementação)
Foco em estrutura completa com dados mockados:
- Layout global (sidebar + topbar + filtro global)
- Todas as 16 páginas com UI completa
- Design system Navy Trust + Sora/Manrope
- Componentes reutilizáveis
- Navegação e rotas
- Setup inicial Supabase (schema + RLS + seed)
- Autenticação funcional

