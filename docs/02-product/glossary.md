# Glossário — Pronto

> Vocabulário de domínio, com a diferença entre como cada app **chama** o conceito e como ele existe no **código**. Essa diferença importa: o app da empresa fala "escala", o backend guarda "job" — quem for ler código ou documentação técnica precisa saber que são a mesma coisa.

## Conceitos centrais

**Vaga / Escala** — uma oportunidade de trabalho publicada por uma empresa: categoria, data/horário, número de posições, valor, benefícios, exigências. No app da empresa é chamada de "escala" (ex: "Publicar escala"); no app do trabalhador aparece como "vaga". No código e no banco, a tabela é `jobs`. Uma vaga pode ter várias posições (`positionsTotal`) — cada posição preenchida gera uma candidatura aprovada e, depois, um turno.

**Candidatura (application)** — o pedido de um trabalhador pra ocupar uma posição de uma vaga. Estados: `pending` (aguardando decisão da empresa) → `approved` ou `rejected` (decisão final, exceto pelo caso abaixo) ou `withdrawn` (o próprio trabalhador desistiu, só enquanto ainda `pending`). Uma candidatura `approved` que a empresa desfizer depois vira `rejected` de novo, mas com um campo separado (`removedAt`) marcando que foi removida, não rejeitada de primeira — a UI mostra isso como "Removido", distinto de uma rejeição comum.

**Turno (shift)** — nasce automaticamente no exato momento em que uma candidatura é aprovada. Representa o compromisso real de um trabalhador específico pra uma instância da vaga, com o valor combinado **congelado** naquele momento (mudanças futuras no valor da vaga não afetam turnos já criados). Estados: `scheduled` → `checked_in` → `checked_out` → `completed`, mais os desvios `no_show` (existe no sistema mas nunca é escrito na prática hoje) e `cancelled`.

**Check-in / Check-out** — ações do trabalhador marcando chegada e saída do turno. **Não usam geolocalização** (removida numa revisão recente do produto, depois de o GPS causar bloqueios incorretos — "estar em outra rua"). Em vez disso, cada uma é confirmada separadamente pela empresa (`checkInConfirmedAt`, `checkOutConfirmedAt`); as duas confirmações são independentes uma da outra. É a confirmação do **check-out** que fecha o turno como `completed` e dispara a cobrança combinada.

**Bico** — o termo usado pra descrever a natureza do trabalho: avulso, não recorrente por obrigação, o trabalhador se candidata quando e onde quiser. Ver [`00-vision/vision.md`](../00-vision/vision.md).

**Intermediação avulsa / sem vínculo empregatício** — a moldura jurídica sob a qual o produto inteiro é desenhado: o Pronto aproxima as partes, mas nunca assume o papel de empregador nem cria vínculo entre empresa e trabalhador. Sustenta, por exemplo, o princípio de nunca haver convite direto no app (ver [`00-vision/principles.md`](../00-vision/principles.md)).

**KYC** — processo de verificação de identidade do trabalhador (documento de identidade, selfie, CNH quando aplicável, documento do responsável quando menor de idade). Estado (`kycStatus`: `pending`/`approved`/`rejected`) bloqueia candidatura enquanto não `approved`.

**Verificação da empresa** — o mesmo conceito do lado empresa (`verificationStatus`): pendente até um admin aprovar CNPJ/CPF (e documento, no caso de pessoa física). Bloqueia publicar vaga enquanto pendente.

**Categoria de habilidade (skill category)** — a função que o trabalhador exerce (garçom, cozinha, bar, etc.). Lista moderada: qualquer usuário pode criar uma nova categoria "na hora" durante cadastro ou publicação de vaga, ela já fica usável, mas entra numa fila de revisão do admin (pode ser renomeada ou rejeitada depois).

**Menor de idade / Responsável** — trabalhador de 16-17 anos precisa de dados e autorização de um responsável legal pra se cadastrar; abaixo de 16, cadastro é bloqueado sem exceção. Vagas podem opcionalmente permitir menores (`minorsAllowed`).

**Avaliação (rating)** — nota de 1 a 5 por categoria, nos dois sentidos (empresa avalia trabalhador, trabalhador avalia empresa), só depois que o turno está `completed`. É **às cegas**: a nota de um lado só fica visível pro outro depois que ambos avaliaram, ou depois de 7 dias do check-out — o que vier primeiro.

**Pagamento combinado** — hoje, o acerto financeiro do turno acontece **fora da plataforma** (dinheiro combinado direto entre empresa e trabalhador). O sistema só rastreia em que ponto esse combinado está: empresa marca como paga (`released`), trabalhador confirma se recebeu (`confirmed`) ou contesta (`disputed`). Ver [`01-business/monetization.md`](../01-business/monetization.md) pro plano de isso mudar.

**Sino de notificações** — no app da empresa, alerta candidaturas pendentes, check-ins/check-outs ainda não confirmados, e avaliações pendentes. Abrir o sino não confirma nada sozinho — a confirmação de verdade acontece nos botões da tela da vaga.

**Ao vivo** — visão em tempo real dos turnos do dia (aguardando / atrasado / chegou / concluído), calculada a cada consulta, nunca guardada — é a "central de operação do turno" descrita na visão do produto.
