# Roadmap — Pronto

> Direção estratégica em andamento, decisões deliberadamente adiadas, e lacunas encontradas na auditoria do código que são, na verdade, decisões de produto pendentes — não bugs. Detalhe técnico granular (arquivo:linha) fica em [`05-operations/known-issues.md`](../05-operations/known-issues.md); aqui é o "o quê" e o "por quê" de cada item.

## Em andamento / próxima fronteira estratégica

**Pagamento passando pela plataforma.** Pré-requisito estrutural pra qualquer cobrança de taxa fazer sentido. Ver [`monetization.md`](./monetization.md). Sem data definida — depende de definição regulatória (instituição de pagamento, questão fiscal) ainda em conversa com advogado/contador.

**O diferencial defensável ainda sendo descoberto.** A hipótese de virar ferramenta de gestão de RH completa foi descartada (ver [`00-vision/principles.md`](../00-vision/principles.md)). A direção atual é investir em tornar a recontratação de gente já conhecida mais rápida dentro do fluxo de candidatura aberta — sem nunca virar convite direto. Nenhuma feature concreta dessa linha foi decidida ainda; qualquer uma precisa passar por validação jurídica antes de ir pra produto, pelo mesmo motivo do princípio de convite direto.

**Escolha entre fricção e valor real contra vazamento de transação.** Ver [`marketplace.md`](./marketplace.md#o-risco-estrutural-vazamento-de-transação-disintermediation). Provavelmente a decisão mais importante da fase de monetização — ainda em aberto.

## Lacunas que são decisões de produto pendentes, não bugs

Estes itens foram confirmados na auditoria de código como **implementados parcialmente por decisão consciente**, com o comentário explícito no próprio código reconhecendo a lacuna — precisam de uma decisão de produto, não de um conserto técnico:

- **Faltas (`no_show`) nunca são registradas de verdade.** O status existe no sistema, mas nada o escreve — não há job/cron marcando falta automaticamente. Isso significa que toda métrica de "confiabilidade"/"comparecimento" do trabalhador hoje nunca desconta falta real. Decisão pendente: vale a pena implementar detecção real de falta (ex: turno que passou do horário de início sem check-in), ou isso é aceitável dado que o produto já mostra atraso em tempo real na tela "Ao vivo"?
- **Disputa de pagamento (`disputed`) não tem fluxo de resolução.** Quando o trabalhador contesta "não recebi", não existe próximo passo modelado no sistema. Torna-se mais urgente resolver isso quando o pagamento passar a ser real (ver `monetization.md`) — hoje, sem dinheiro real em jogo, é uma lacuna tolerável; deixa de ser quando há dinheiro de verdade.

## Perguntas em aberto que vieram da auditoria técnica

- Existe um plano pra reintroduzir `no_show` como status real, ou ele deveria simplesmente sair do enum já que o produto resolve isso ao vivo (tela "Ao vivo") em vez de persistir?
- Por que o repositório/pacote interno se chama `shift` enquanto o produto é "Pronto" em todo lugar — houve rebranding no meio do caminho que vale registrar?

