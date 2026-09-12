# Gestão óticas h2k | Sertão ótica & Nordestina

Sistema de gestão para óticas com clientes, vendas, ordens de serviço, estoque, financeiro, permissões e relatórios.

## Arquitetura local

A aplicação roda como uma SPA React/Vite consumindo uma API Express local. A persistência é feita em um arquivo SQLite compatível com migração para uma VPS, e os anexos são salvos no diretório `uploads/`. O frontend não acessa mais nenhum serviço Supabase.

| Componente | Desenvolvimento local | Produção/VPS |
| --- | --- | --- |
| Frontend | Vite em `http://localhost:8080` | Arquivos estáticos em `dist/` |
| API | Express em `http://localhost:3001` | Express atrás de proxy reverso |
| Banco | `data/otica-nordestina.sqlite` | Mesmo arquivo ou volume persistente |
| Anexos | `uploads/` | Volume persistente da VPS |

## Primeira execução

No terminal, dentro desta pasta, instale as dependências e inicie os dois processos com um único comando:

```bash
npm install
npm run dev:local
```

Abra [http://localhost:8080](http://localhost:8080). O banco é criado automaticamente na primeira inicialização.

O ambiente local cria um administrador inicial para facilitar o primeiro acesso quando o banco ainda está vazio. O e-mail padrão é `admin@admin.com`; a senha deve ser definida por `LOCAL_ADMIN_PASSWORD` no arquivo `.env` e não é registrada na documentação. Esses valores podem ser trocados em `.env` por `LOCAL_ADMIN_EMAIL` e `LOCAL_ADMIN_PASSWORD`.

## Comandos úteis

```bash
npm run dev:local  # API + frontend
npm run dev:api    # somente a API local
npm run dev        # somente o frontend Vite
npm run build      # build do frontend
npm run start      # API Express usando a configuração do ambiente
npm run lint       # validação ESLint
npm test           # testes automatizados
```

A API expõe `GET /api/health` para diagnóstico. A tela **Configurações > Status de Conexão** usa esse backend para verificar a disponibilidade do SQLite. As vendas são fechadas por operação transacional: o registro da venda, seus itens, a baixa de estoque, o movimento de estoque e o lançamento financeiro são confirmados juntos; o cancelamento restaura o estoque e cancela o lançamento originado pela venda.

## Dados e reset local

O arquivo `data/otica-nordestina.sqlite` contém os dados do sistema, a pasta `uploads/` contém os anexos dos clientes e `data/backups/` armazena cópias do SQLite. Esses diretórios são ignorados pelo Git. A API cria uma cópia de segurança antes da inicialização e conserva as dez mais recentes. O administrador master também pode gerar um backup pelo endpoint autenticado `POST /api/admin/backup`. Para começar de novo em um ambiente de desenvolvimento, pare os processos e remova `data/` e `uploads/`; na próxima execução o esquema e o administrador inicial serão recriados.

## Configuração de ambiente

Copie `.env.example` para `.env` quando necessário. `VITE_API_URL` pode permanecer vazio: em desenvolvimento o frontend usa `http://localhost:3001/api`, e em produção usa `/api` no mesmo domínio. Na VPS, defina uma chave longa em `LOCAL_AUTH_SECRET`, configure `PORT` e mantenha `data/`, `data/backups/` e `uploads/` em volumes persistentes. O reset de senha local usa token de uso único com validade de uma hora; em produção, conecte a entrega desse token a um provedor SMTP ou serviço de e-mail antes de expor a funcionalidade publicamente.

## Preparação para VPS

O servidor escuta em `0.0.0.0` e já separa a API da camada visual. Para publicar, faça o build do frontend, mantenha o processo Node ativo com `npm run start`, configure um proxy reverso para encaminhar o domínio à porta definida em `PORT` e faça backup periódico de `data/otica-nordestina.sqlite` e `uploads/`. Para crescimento multiusuário maior, a camada de persistência pode ser trocada por PostgreSQL sem alterar os componentes React, pois o frontend conversa apenas com a API local.
# gestaooticas
"# gestaooticas" 
