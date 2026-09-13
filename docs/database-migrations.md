# Migrações formais do banco

## Objetivo

O Gestão Óticas utiliza SQLite persistido pelo `sql.js`. A partir da Fase 5, alterações incrementais de estrutura devem ser registradas em `server/migrations.ts`, executadas em ordem e armazenadas em `schema_migrations`. O boot da API aplica o schema base, executa as migrações pendentes em transações e persiste o banco somente depois da inicialização completa.

## Estado atual

A versão atual do schema é **21**. A versão **20** representa o baseline legado: ela consolida as alterações que anteriormente eram aplicadas por chamadas dispersas de `ensureColumn` durante o boot. A versão **21** cria o índice operacional de histórico de verificações de integridade.

Bancos existentes que possuem `app_meta.schema_version = 20` são compatibilizados automaticamente. O baseline é aplicado de forma idempotente e passa a ser registrado em `schema_migrations` com seu checksum. Bancos novos executam o baseline e a versão 21 em sequência.

A rota administrativa `GET /api/admin/database/migrations` exibe a versão aplicada, a versão alvo e o histórico de migrações. O acesso é restrito ao administrador master.

## Como criar uma nova migração

Cada nova alteração deve ser adicionada ao final de `migrations` com um número inteiro maior que a versão atual, nome estável e operações determinísticas. Operações de coluna devem usar o formato `kind: 'column'`; SQL adicional deve usar `kind: 'sql'`. Quando uma operação SQL precisar do horário atual, use `bindNow: true` em vez de interpolar o horário no texto.

A migração deve ser compatível com uma segunda execução. O runner verifica o checksum antes de ignorar uma versão já aplicada. Alterar o nome ou as operações de uma migração já aplicada provoca `DATABASE_MIGRATION_CHECKSUM_MISMATCH` e interrompe o boot para evitar drift silencioso.

Toda migração precisa de teste para banco novo, banco já existente e falha intermediária. Alterações de dados devem ser limitadas, auditáveis e acompanhadas de uma estratégia de backup pré-deploy.

## Falha e rollback

Cada migração é executada dentro de uma transação SQLite. Se qualquer operação falhar, o runner executa rollback, não registra a versão em `schema_migrations` e encerra o boot com `DATABASE_MIGRATION_FAILED`. O serviço não deve continuar com um schema parcialmente atualizado.

Não há down-migrations automáticas. Para reverter uma alteração estrutural em produção, o procedimento seguro é:

1. interromper ou impedir novo tráfego durante a intervenção;
2. preservar o backup de inicialização e gerar um backup manual adicional;
3. reverter o código para o commit anterior, caso a migração ainda não tenha sido aplicada;
4. se a migração já tiver sido aplicada, restaurar o banco por meio do fluxo de restore validado, ou criar uma nova migração corretiva compatível;
5. reiniciar a aplicação e conferir `GET /api/admin/database/migrations`, `/api/health` e o verificador de integridade;
6. registrar o incidente, a versão do schema e o hash do backup utilizado.

Nunca remova manualmente linhas de `schema_migrations` nem edite o arquivo SQLite de produção para “forçar” uma versão. A divergência deve ser resolvida por código versionado ou por restore controlado.

## Validação antes de publicar

A validação mínima de uma release que altera o schema é:

```bash
npm run typecheck:ci
npm run lint:ci
npm test
npm run build
npm run smoke:api
```

A suíte de migrações cobre o schema canônico, banco novo, adoção do baseline legado, idempotência, checksum, rollback e rejeição de banco mais novo que a aplicação. O workflow do GitHub Actions executa os gates bloqueantes antes do deploy.

## Observação operacional

O processo atual é de instância única no Coolify e usa volume persistente para `data/`. A aplicação cria um backup de inicialização antes de abrir um banco existente. Isso reduz o risco de uma migração malformada, mas não substitui o backup remoto nem o teste periódico de restauração.
