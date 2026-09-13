# Runbook operacional — Gestão Óticas

## Objetivo

Este runbook descreve os controles operacionais introduzidos nas Fases 6 a 12. O objetivo é detectar falhas rapidamente, bloquear regressões antes da publicação, manter a persistência íntegra e comprovar que backups, O.S. e documentos fiscais são processados sem efeitos parciais ou transmissão externa indevida.

> **Regra operacional:** o healthcheck público confirma apenas que a API e o banco SQLite estão disponíveis. Métricas detalhadas, estado de backups e o último restore ficam protegidos por autenticação do administrador master.

## Controles implementados

| Controle | Local | Finalidade |
|---|---|---|
| Request ID | `X-Request-ID` em toda resposta | Correlacionar uma requisição com logs e suporte técnico. |
| Log estruturado | `server/observability.ts` | Registrar eventos em JSON sem credenciais, tokens ou cookies. |
| Métricas protegidas | `GET /api/admin/metrics` | Consultar volume, status, duração média, memória do processo e estado de backup. |
| Healthcheck público | `GET /api/health` e `GET /health` | Verificar disponibilidade mínima da aplicação. |
| Smoke de API | `npm run smoke:api` | Validar boot, banco, autenticação, autorização e request ID. |
| Smoke de continuidade | `npm run smoke:continuity` | Exercitar backup, download, inspeção, importação, restore pendente e retomada após restart. |
| Quality Gate | `.github/workflows/quality.yml` | Bloquear merge/publicação quando typecheck crítico ou completo, lint, testes, build ou smoke falhar. |
| Monitoramento externo | `.github/workflows/production-health.yml` | Consultar a URL pública a cada 15 minutos e gerar uma execução falha quando a aplicação estiver indisponível. |
| Lock de persistência | `server/persistenceLock.ts` e `server/db.ts` | Serializar a troca atômica do SQLite, aplicar `fsync` e detectar contenção. |
| Retenção remota | `server/backupService.ts` | Manter limites distintos para backups diários, semanais e mensais no Google Drive. |
| Drill de DR | `.github/workflows/backup-drill.yml` | Executar semanalmente backup, inspeção, importação, restore pendente e retomada em diretório isolado. |
| O.S. transacional | `/api/operations/service-orders` | Gravar O.S., timeline e financeiro juntos, com idempotência por `Idempotency-Key`. |
| Capacidades fiscais | `/api/operations/fiscal/capabilities` | Declarar que somente simulação local está habilitada e que produção/transmissão externa estão bloqueadas. |

## Diagnóstico de uma indisponibilidade

Comece consultando `https://gestaooticas.online/api/health`. Uma resposta HTTP 200 com `ok: true` e `database: "sqlite"` indica que o processo respondeu e concluiu o healthcheck mínimo. Registre o valor do cabeçalho `X-Request-ID` quando o problema estiver associado a uma requisição específica.

Se o healthcheck falhar, consulte a última execução do workflow **Production Health** no GitHub e, em seguida, o estado do container e dos logs no Coolify. Não reinicie o container repetidamente sem verificar os logs, pois isso pode ocultar a causa do erro de boot.

Quando a API estiver disponível, um administrador master pode consultar `GET /api/admin/metrics`. A resposta contém o volume de requisições desde o boot, distribuição por método e status, duração média, memória residente, último tick do scheduler de backup e o último job de backup. O endpoint não deve ser exposto sem autenticação.

## Procedimento de backup

O backup manual deve ser iniciado pela Central de Backup da aplicação ou por `POST /api/admin/backups/run`. O resultado esperado é um job com status `completed`. O status `partial` significa que a cópia local foi concluída, mas o envio externo falhou; nesse caso, o arquivo local continua sendo um ponto de recuperação e o erro do Drive deve ser tratado separadamente.

Antes de importar um arquivo, use a inspeção da Central de Backup. O sistema valida extensão, membros do archive, manifesto, caminhos seguros, hash e integridade SQLite. A importação adiciona o arquivo ao histórico, mas não restaura automaticamente o banco.

## Procedimento de restauração

A restauração exige a confirmação textual `RESTAURAR`. O sistema cria um backup pré-restore, extrai o archive em staging, valida o manifesto e o hash do banco e grava `restore-pending.json`. Somente depois dessa validação o processo é encerrado para reiniciar com o banco restaurado.

Após o restart, confirme três condições: o healthcheck responde HTTP 200; `GET /api/admin/metrics` contém `last_restore_completed`; e o histórico mostra o job como `restored`. O marcador é persistente e a retomada é idempotente. Se o staging, o hash ou o marcador estiverem inconsistentes, o boot deve falhar de forma segura em vez de aplicar um arquivo não validado.

## Gates antes da publicação

Execute localmente, na ordem abaixo:

```bash
npm run typecheck:ci
npm run typecheck
npm run lint:ci
npm test -- --reporter=dot
npm run build
npm run smoke:api
npm run smoke:continuity
```

O `typecheck:ci` cobre o backend crítico utilizado em produção. O `typecheck` cobre o projeto completo e agora é bloqueante. O lint global continua separado do `lint:ci` porque contém dívida histórica fora do escopo destas fases; o gate bloqueante deve permanecer restrito ao conjunto explicitamente validado até que a dívida seja eliminada.

## Persistência e concorrência

O processo de API deve permanecer único para o volume SQLite atual. A persistência exporta o banco para um arquivo temporário com modo restrito, faz `fsync`, troca o arquivo por rename atômico e libera o lock exclusivo. O contador e a última duração podem ser consultados por um administrador master em `GET /api/admin/metrics`, no campo `data.persistence`.

O lock evita dois processos trocando o mesmo arquivo ao mesmo tempo, mas não torna duas cópias independentes do `sql.js` uma arquitetura multiwriter. Não habilite réplicas de escrita ou múltiplos workers no mesmo volume; os gatilhos e o plano de migração estão registrados em [`docs/persistence-adr.md`](persistence-adr.md).

## Retenção e recuperação de desastre

Backups locais são limitados por `max_local_backups`. Quando o Google Drive está conectado, a poda remota classifica arquivos pelos prefixos `daily`, `weekly` e `monthly` e aplica respectivamente `retention_daily`, `retention_weekly` e `retention_monthly`. Falha na poda não remove o arquivo e registra um evento de warning; o job fica `partial` para tornar o problema visível.

O workflow **Backup DR Drill** roda semanalmente em banco e diretório temporários. Ele não lê, baixa ou restaura dados de produção. O drill deve permanecer verde; uma falha bloqueia a confiança operacional no caminho de recuperação e deve ser investigada antes de uma mudança de infraestrutura.

## O.S. e operações compostas

Criações e edições do formulário usam `POST /api/operations/service-orders` e `PATCH /api/operations/service-orders/:id`. O backend valida empresa, loja, cliente, técnico, laboratório, profissional, receita e produto antes da escrita. A transação inclui a O.S., a timeline e o lançamento financeiro vinculado. Repetição da mesma criação com a mesma `Idempotency-Key` devolve a O.S. original sem duplicar efeitos.

Exclusão usa o endpoint dedicado e remove O.S., timeline e lançamentos originados juntos. A falha de uma etapa faz rollback de todas as etapas anteriores. O endpoint genérico continua disponível para compatibilidade administrativa, mas operações compostas devem usar os endpoints dedicados.

## Fiscal: simulação versus transmissão oficial

O módulo fiscal persiste rascunhos, itens, auditoria e eventos. O adapter disponível é `local-simulation`; ele nunca chama SEFAZ, prefeitura ou outro provedor externo. Mesmo que uma configuração seja marcada como `producao`, a transmissão retorna `FISCAL_PRODUCTION_LOCKED`. Cancelamento, correção e inutilização exigem autorização real e permanecem bloqueados enquanto não houver adapter oficial homologado.

O endpoint de capacidades informa `simulation_enabled: true`, `external_transmission_enabled: false` e `production_enabled: false` por loja. Certificados, CSCs, tokens e senhas não devem ser colocados na interface ou no banco de configurações comuns; qualquer futura integração oficial deve passar por revisão própria de credenciais, homologação, idempotência e autorização.

## Resposta a falhas do Quality Gate

Uma falha de typecheck ou lint deve ser corrigida antes do deploy. Uma falha de teste deve ser reproduzida localmente com o arquivo específico. Uma falha de build deve ser investigada antes de qualquer enqueue no Coolify. Uma falha de smoke indica regressão no boot, autenticação, autorização, backup ou continuidade e deve bloquear a publicação.

Falhas do workflow **Production Health** indicam indisponibilidade observada externamente, mas não executam restauração nem alteram dados. O diagnóstico deve ser feito no Coolify e nos logs estruturados da aplicação.

## Limites conhecidos

O healthcheck não testa uma operação autenticada nem uma consulta de negócio. O monitoramento do GitHub informa falha por meio do histórico e das notificações da conta, não substituindo uma política de plantão. O drill de DR valida o caminho de recuperação em ambiente isolado, não a restauração de um backup real de produção. O bundle frontend ainda ultrapassa o limite de aviso de 500 KB do Vite; isso é uma otimização futura e não um erro bloqueante de funcionalidade.

## Referências

[1]: https://docs.github.com/en/actions "GitHub Actions documentation"
[2]: https://expressjs.com/en/guide/using-middleware.html "Express middleware guide"
[3]: https://nodejs.org/api/process.html "Node.js process API"
