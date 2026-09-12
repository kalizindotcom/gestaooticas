# Contexto Completo do Projeto - Gestão óticas h2k | Sertão ótica & Nordestina

## 📋 Visão Geral

**Nome do Projeto:** Gestão óticas h2k para Sertão ótica & Nordestina  
**Tipo:** Aplicação Web SPA (Single Page Application)  
**Status:** Em desenvolvimento  
**Arquivos TypeScript:** 135+ arquivos

## 🛠️ Stack Tecnológica

### Frontend
- **Framework:** React 18.3.1 com TypeScript 5.8.3
- **Build Tool:** Vite 5.4.19
- **Roteamento:** React Router DOM 6.30.1
- **Gerenciamento de Estado:** React Query (TanStack Query) 5.83.0
- **Formulários:** React Hook Form 7.61.1 + Zod 3.25.76
- **UI Components:** Radix UI (componentes acessíveis)
- **Estilização:** Tailwind CSS 3.4.17 + tailwindcss-animate
- **Ícones:** Lucide React 0.462.0
- **Gráficos:** Recharts 2.15.4
- **Notificações:** Sonner 1.7.4
- **Datas:** date-fns 3.6.0

### Backend & Infraestrutura
- **BaaS:** Supabase 2.103.0
- **Autenticação:** Supabase Auth
- **Banco de Dados:** PostgreSQL (via Supabase)
- **URL Supabase:** https://ujcpvduissqhrpjcdfvy.supabase.co

### Ferramentas de Desenvolvimento
- **Testes:** Vitest 3.2.4 + Testing Library
- **Linting:** ESLint 9.32.0
- **Package Manager:** npm/bun (bun.lockb presente)

## 🏗️ Arquitetura do Projeto

### Estrutura de Diretórios

```
OTICA_NORDESTINA/
├── public/                    # Arquivos estáticos
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
├── src/
│   ├── components/           # Componentes React
│   │   ├── companies/       # Gestão de empresas
│   │   ├── customers/       # Gestão de clientes
│   │   ├── financial/       # Módulo financeiro
│   │   ├── layout/          # Layout da aplicação
│   │   ├── products/        # Gestão de produtos
│   │   ├── reports/         # Relatórios
│   │   ├── sales/           # Vendas
│   │   ├── shared/          # Componentes compartilhados
│   │   ├── stores/          # Gestão de lojas
│   │   ├── ui/              # Componentes UI base (shadcn/ui)
│   │   └── users/           # Gestão de usuários
│   ├── contexts/            # Contextos React
│   │   ├── AuthContext.tsx
│   │   ├── GlobalFilterContext.tsx
│   │   └── PermissionsContext.tsx
│   ├── hooks/               # Custom hooks
│   │   ├── use-toast.ts
│   │   ├── useCompanies.ts
│   │   └── useSupabaseData.ts
│   ├── lib/                 # Bibliotecas e utilitários
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── pages/               # Páginas da aplicação
│   │   ├── AdminCenter.tsx
│   │   ├── Appointments.tsx
│   │   ├── Companies.tsx
│   │   ├── Customers.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Financial.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── Login.tsx
│   │   ├── NotFound.tsx
│   │   ├── Products.tsx
│   │   ├── Profile.tsx
│   │   ├── Reports.tsx
│   │   ├── Sales.tsx
│   │   ├── ServiceOrders.tsx
│   │   ├── Settings.tsx
│   │   ├── Stores.tsx
│   │   └── Users.tsx
│   ├── types/               # Definições TypeScript
│   │   └── permissions.ts
│   ├── data/                # Dados mock
│   │   └── mockData.ts
│   ├── App.tsx              # Componente raiz
│   └── App.css              # Estilos globais
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## 🎯 Funcionalidades Principais

### 1. **Dashboard**
- KPIs em tempo real (vendas, receita, ticket médio)
- Gráficos de desempenho
- Insights com IA (geração de análises inteligentes)
- Visão geral de agendamentos e clientes

### 2. **Gestão de Clientes**
- CRUD completo de clientes
- Histórico de compras e serviços
- Gestão de crédito
- Anexos e documentos
- Agendamentos vinculados
- Ordens de serviço (OS)
- Status financeiro
- Impressão de carnês/parcelas

### 3. **Agendamentos**
- Calendário de agendamentos
- Status: agendado, confirmado, em atendimento, concluído, cancelado
- Vinculação com clientes
- Gestão de horários

### 4. **Vendas**
- Registro de vendas
- Vinculação com clientes e produtos
- Impressão de comprovantes
- Histórico de transações

### 5. **Ordens de Serviço (OS)**
- Criação e gestão de OS
- Acompanhamento de status
- Impressão de OS
- Vinculação com clientes

### 6. **Produtos**
- Cadastro de produtos
- Controle de estoque
- Transferência entre lojas
- Categorização

### 7. **Financeiro**
- **Contas a Pagar:** Gestão de despesas
- **Contas a Receber:** Gestão de receitas
- **Caixa:** Controle de entradas e saídas
- **DRE (Demonstrativo de Resultados):** Relatório financeiro
- Lançamentos de entrada/saída
- Exportação de dados

### 8. **Relatórios**
- Produtos vendidos
- Receita mensal
- Desempenho de vendedores
- Vendas por loja
- Giro de estoque
- Receitas prescritas vencidas
- Exportação de relatórios

### 9. **Gestão de Empresas**
- Multi-empresa (suporte a múltiplas empresas)
- CRUD de empresas
- Vinculação de usuários a empresas

### 10. **Gestão de Lojas**
- Multi-loja (suporte a múltiplas lojas)
- CRUD de lojas
- Transferência de estoque entre lojas

### 11. **Usuários e Permissões**
- Sistema de autenticação (Supabase Auth)
- Gestão de usuários
- Sistema de roles (funções):
  - **Admin:** Acesso total
  - **Manager:** Acesso gerencial (sem deletar financeiro)
  - **Operator:** Acesso operacional (vendas, atendimento)
  - **Viewer:** Apenas visualização
- Matriz de permissões granular por módulo
- Permissões por ação: view, create, edit, delete, export, print, generate_insights, manage_roles

### 12. **Centro Administrativo**
- Configurações avançadas
- Gestão de roles personalizadas
- Administração do sistema

### 13. **Configurações**
- Preferências do usuário
- Configurações do sistema
- Personalização

### 14. **Perfil**
- Dados do usuário
- Avatar
- Informações pessoais

## 🔐 Sistema de Autenticação e Permissões

### Autenticação
- Login com email/senha via Supabase Auth
- Recuperação de senha
- Sessões persistentes
- Proteção de rotas

### Estrutura de Permissões

```typescript
// Módulos do sistema
- dashboard
- appointments
- customers
- products
- sales
- service_orders
- financial
- reports
- users
- settings
- companies
- stores
- admin_center

// Ações disponíveis por módulo
- view: Visualizar
- create: Criar
- edit: Editar
- delete: Deletar
- export: Exportar dados
- print: Imprimir
- generate_insights: Gerar insights com IA
- manage_roles: Gerenciar funções
```

### Roles Padrão

**Admin:**
- Acesso total a todos os módulos
- Todas as ações habilitadas

**Manager:**
- Acesso a operações e relatórios
- Não pode deletar registros financeiros
- Não pode gerenciar usuários ou configurações

**Operator:**
- Foco em atendimento e vendas
- Sem acesso a financeiro, relatórios ou administração
- Pode criar e editar agendamentos, clientes, vendas e OS

**Viewer:**
- Apenas visualização
- Pode imprimir alguns documentos
- Sem acesso a áreas administrativas

## 🗄️ Estrutura de Dados (Supabase)

### Tabelas Principais

1. **profiles** - Perfis de usuários
   - id, name, email, role, role_id, avatar
   - companies[] (array de empresas)
   - stores[] (array de lojas)

2. **appointments** - Agendamentos
   - Status, data/hora, cliente vinculado

3. **customers** - Clientes
   - Dados pessoais, histórico, crédito

4. **sales** - Vendas
   - Total, itens, cliente, data

5. **service_orders** - Ordens de Serviço
   - Status, descrição, cliente

6. **products** - Produtos
   - Nome, preço, estoque, categoria

7. **companies** - Empresas
   - Dados da empresa

8. **stores** - Lojas
   - Dados da loja, empresa vinculada

9. **financial_entries** - Lançamentos financeiros
   - Tipo (entrada/saída), valor, categoria

## 🎨 Design System

### Componentes UI (shadcn/ui)
- Accordion, Alert, Avatar, Badge, Button
- Calendar, Card, Carousel, Chart, Checkbox
- Dialog, Drawer, Dropdown, Form, Input
- Label, Menubar, Navigation, Pagination
- Popover, Progress, Radio, Select, Separator
- Sheet, Sidebar, Skeleton, Slider, Switch
- Table, Tabs, Textarea, Toast, Tooltip
- E mais...

### Componentes Compartilhados
- **KPICard:** Cards de indicadores
- **PageHeader:** Cabeçalho de páginas
- **StatusBadge:** Badges de status
- **EmptyState:** Estado vazio
- **CustomerSelector:** Seletor de clientes
- **PermissionGate:** Controle de acesso por permissão
- **FilterBar:** Barra de filtros
- **PeriodPicker:** Seletor de período
- **DetailModal:** Modal de detalhes

### Tema
- Tailwind CSS com tema customizado
- Suporte a dark mode (next-themes)
- Design responsivo
- Acessibilidade (Radix UI)

## 🔄 Fluxo de Dados

### React Query
- Cache automático de dados
- Refetch em background
- Otimização de requisições
- Hooks customizados:
  - `useAppointments()`
  - `useSales()`
  - `useCustomers()`
  - `useCompanies()`
  - `useSupabaseData()`

### Contextos Globais
1. **AuthContext:** Autenticação e usuário logado
2. **PermissionsContext:** Permissões do usuário
3. **GlobalFilterContext:** Filtros globais (empresa, loja, período)

## 📱 Recursos Especiais

### Impressão
- Comprovantes de venda
- Ordens de serviço
- Carnês de parcelas
- Relatórios

### Exportação
- Dados financeiros
- Relatórios
- Listas de clientes

### IA/Insights
- Geração de insights no dashboard
- Análise de dados com IA (OpenAI integrado)

### Multi-tenancy
- Suporte a múltiplas empresas
- Suporte a múltiplas lojas
- Filtros globais por empresa/loja

## 🚀 Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run build:dev    # Build de desenvolvimento
npm run preview      # Preview do build
npm run lint         # Linting
npm run test         # Testes (Vitest)
npm run test:watch   # Testes em modo watch
```

## 🔧 Configurações

### Vite
- Plugin React SWC para performance
- Aliases configurados (@/ para src/)
- Build otimizado

### TypeScript
- Strict mode habilitado
- Tipos completos para todas as entidades
- Inferência de tipos

### ESLint
- Configuração moderna (ESLint 9)
- Plugins React Hooks e React Refresh
- Regras customizadas

## 📊 Métricas do Projeto

- **Total de arquivos TS/TSX:** 135+
- **Páginas principais:** 18
- **Componentes UI:** 40+
- **Componentes de negócio:** 50+
- **Contextos:** 3
- **Hooks customizados:** 3+
- **Módulos principais:** 13

## 🎯 Objetivos do Sistema

1. **Gestão Completa:** Sistema all-in-one para óticas
2. **Multi-empresa/Multi-loja:** Escalabilidade
3. **Controle de Acesso:** Segurança granular
4. **Experiência do Usuário:** Interface moderna e intuitiva
5. **Mobilidade:** Design responsivo
6. **Insights Inteligentes:** IA para análise de dados
7. **Integração:** Dados centralizados no Supabase

## 🔮 Tecnologias Futuras/Planejadas

- Integração com OpenAI (já presente no package.json)
- Mais relatórios e dashboards
- Notificações em tempo real
- App mobile (React Native?)
- Integração com sistemas externos

## 📝 Notas Importantes

1. **Supabase:** Backend completo gerenciado
2. **Permissões:** Sistema robusto e granular
3. **TypeScript:** Tipagem forte em todo o projeto
4. **Componentes:** Reutilização máxima
5. **Performance:** React Query + Vite para otimização
6. **Acessibilidade:** Radix UI garante componentes acessíveis
7. **Manutenibilidade:** Código organizado e modular

---

**Última atualização:** 28/04/2026  
**Versão:** 0.0.0 (em desenvolvimento)
