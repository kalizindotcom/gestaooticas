# ADR — Persistência e concorrência

## Status

Aceito para a operação atual de processo único no Coolify. Reavaliação obrigatória quando qualquer gatilho de escala for atingido.

## Decisão

O Gestão Óticas permanece temporariamente com `sql.js` carregado em memória e arquivo SQLite persistido por troca atômica. Toda persistência passa por lock exclusivo de arquivo, gravação em arquivo temporário com permissões restritas, `fsync` do arquivo e tentativa de `fsync` do diretório. O lock possui timeout, remoção controlada de arquivo obsoleto e erro operacional explícito quando a contenção excede o limite.

A aplicação deve operar com um único processo de API por volume de dados. O lock protege a troca física do arquivo e evita dois processos gravando o mesmo arquivo simultaneamente, mas não transforma duas instâncias com cópias independentes de `sql.js` em uma arquitetura multiwriter. Não é permitido habilitar réplicas de escrita ou múltiplos workers com o mesmo volume sem concluir a migração para um banco server-side.

## Consequências

A estratégia reduz o risco de arquivo parcialmente gravado e melhora a observabilidade de latência, volume de escritas e timeouts de lock. Ela não elimina o custo de exportar o banco inteiro nem resolve conflitos lógicos entre processos com memórias divergentes. A rota administrativa de métricas informa o modo de persistência e os contadores para facilitar a operação.

## Gatilhos de migração para PostgreSQL

A migração deve ser priorizada se ocorrer qualquer um dos seguintes eventos: necessidade de duas instâncias de API com escrita; fila persistente de jobs que dependa de concorrência; crescimento do banco que torne a exportação completa lenta para o RTO definido; picos de escrita que produzam contenção recorrente; indisponibilidade que exija failover; ou necessidade de relatórios concorrentes sem bloquear operações.

## Procedimento operacional

Antes de qualquer alteração de processo, confirmar que o Coolify mantém apenas uma instância de escrita, que o volume de dados está persistente e que os smoke tests de API e continuidade passam. Em caso de timeout de lock, não remover o arquivo manualmente de imediato: verificar se existe outro processo ativo, consultar logs pelo `request_id`, preservar o banco e somente remover um lock comprovadamente obsoleto conforme o runbook.

## Verificação

O comportamento é coberto por `src/lib/persistenceLock.test.ts`. O endpoint `GET /api/admin/metrics`, acessível somente ao administrador master, expõe `data.persistence` sem revelar caminhos locais ou conteúdo do banco.

## Referências

[1]: https://www.sqlite.org/wal.html "SQLite Write-Ahead Logging"
[2]: https://www.sqlite.org/lockingv3.html "SQLite File Locking And Concurrency"
