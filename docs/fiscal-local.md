# Gestão Fiscal local

## Escopo implementado

A Gestão Fiscal usa exclusivamente a API Express local e o SQLite `data/otica-nordestina.sqlite`. A configuração é persistida por empresa e loja. Rascunhos, itens snapshot, eventos, auditoria e prévias de importação XML não dependem de `localStorage`.

Os documentos suportados no domínio são **NF-e**, **NFC-e** e **NFS-e**. O sistema registra a intenção, a origem e os dados necessários para uma futura integração, mas não atribui número oficial, chave de 44 dígitos, protocolo, autorização jurídica, XML fiscal válido, DANFE ou DANFSe durante a etapa local.

## Rotas operacionais

| Rota | Finalidade | Proteção principal |
|---|---|---|
| `GET /api/operations/fiscal/config` | Ler configuração por empresa/loja | `fiscal.view` |
| `PUT /api/operations/fiscal/config` | Salvar configuração fiscal não secreta | `fiscal.configure` |
| `GET /api/operations/fiscal/documents` | Listar documentos no escopo | `fiscal.view` |
| `POST /api/operations/fiscal/documents` | Criar rascunho manual | `fiscal.create` ou `fiscal.create_manual` |
| `PATCH /api/operations/fiscal/documents/:id` | Editar rascunho | `fiscal.edit` |
| `POST /api/operations/fiscal/from-sales/:id` | Preparar NFC-e/NF-e a partir de venda | `fiscal.create` |
| `POST /api/operations/fiscal/from-service-orders/:id` | Preparar NFS-e a partir de O.S. | `fiscal.create` |
| `POST /api/operations/fiscal/documents/:id/transmit` | Executar somente o adapter local | `fiscal.emit` |
| `POST /api/operations/fiscal/documents/:id/resend` | Repetir o registro de simulação/falha | `fiscal.resend` |
| `POST /api/operations/fiscal/documents/:id/events` | Solicitar cancelamento, correção ou inutilização | Permissão individual do evento |
| `GET /api/operations/fiscal/xml-imports` | Consultar importações | `fiscal.import` |
| `POST /api/operations/fiscal/xml-imports/preview` | Criar prévia com hash SHA-256 | `fiscal.import` |
| `POST /api/operations/fiscal/xml-imports/:id/confirm` | Confirmar a prévia | `fiscal.import` |

Todas as rotas exigem sessão JWT local, validam empresa/loja e registram o usuário autenticado, nome, data/hora, empresa e loja em auditoria quando há movimentação.

## Estados e segurança

A máquina de estados permite o caminho `draft → queued → processing → simulation` para o adapter local. Estados finais oficiais, como `authorized`, somente podem ser produzidos por um provider fiscal homologado em uma implementação posterior. A simulação nunca cria autorização, número, chave ou protocolo.

O ambiente `producao` é bloqueado no backend. Provedores informados que ainda não tenham adapter implementado também são recusados; o único provider disponível é `local-simulation`. Certificado A1, token, CSC e senha não são aceitos na tela nem gravados em `localStorage`, logs ou payloads de UI.

A criação a partir de Vendas e O.S. usa chave de idempotência por origem e tipo. Ela copia snapshot do destinatário e dos itens e guarda `origin_table` e `origin_id`, sem repetir lançamento financeiro, reserva, baixa ou movimento de estoque. Cancelar a origem não apaga o documento fiscal.

## Produto e parâmetros tributários

Produtos possuem campos opcionais para NCM, CEST, origem, unidade comercial, unidade tributável, CFOP, CST, CSOSN e observações tributárias. Nenhum valor tributário é inventado. A edição desses campos exige a permissão independente `products.manage_product_tax`, exibida na matriz como **Dados tributários de produtos**.

## Importação XML

A importação atual é uma prévia controlada. O servidor calcula um hash, extrai somente informações básicas disponíveis no XML e grava o registro para análise. A confirmação atual não cria entrada de estoque, lançamento financeiro, documento fiscal de entrada ou cálculo tributário. Essas operações permanecem separadas até definição dos parâmetros contábeis e do fluxo de escrituração.

## Integrações ainda bloqueadas

A transmissão real para SEFAZ ou prefeitura depende de estado, município, regime tributário verdadeiro, provedor escolhido, certificado/credenciais por empresa/loja e autorização de homologação. Focus NFe, Nuvem Fiscal ou outro provedor não estão implementados como adapters. O NotificationCenter já sinaliza rejeições, falhas e pendências sem expor credenciais.

Antes de habilitar produção, deve ser criado um adapter servidor específico, armazenamento seguro de segredos, validação de certificado, fila idempotente, tratamento de retorno assíncrono, contingência oficial, DANFE/DANFSe e testes de homologação com o contador e o provedor escolhido.
