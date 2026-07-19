# Visão — Pronto

> Este documento nasceu de uma discussão real entre fundador e produto, não de um template. Onde ainda estamos validando uma tese, isso está marcado explicitamente como **em validação** — este não é um documento estático, é o ponto de partida que orienta toda decisão futura.

## A pergunta que este documento responde

Toda decisão de produto, daqui pra frente, deveria conseguir responder: **isso aproxima ou afasta da visão descrita aqui?**

Se uma feature parece boa mas não tem resposta clara pra essa pergunta, o problema não é a feature — é que a visão ainda não está afiada o suficiente naquele ponto. Volte e refine antes de construir.

## Missão

Ser o **sistema operacional da mão de obra temporária avulsa** no Brasil — o lugar onde encontrar, contratar, operar e reter bons profissionais de bico é naturalmente mais rápido, mais seguro e mais organizado do que fazer isso por fora.

Não "um marketplace pra achar trabalhador". Um marketplace termina o trabalho dele no match. O Pronto continua depois do match: durante o turno (quem confirmou chegada, quem está atrasado, visão em tempo real), depois do turno (avaliação dos dois lados, histórico de confiabilidade), e na operação do dia a dia de quem precisa preencher várias escalas ao mesmo tempo.

## O problema real

Hoje, quem contrata mão de obra avulsa — bares, buffets, casas de eventos, hotéis — resolve isso por **grupo de WhatsApp**. Sem histórico confiável de quem já trabalhou bem. Sem controle real de quem confirmou presença. Sem proteção quando alguém falta ou quando o combinado não é cumprido. Sem visibilidade de quem está disponível além do círculo pessoal de contatos.

É um processo que depende inteiramente de memória, sorte e boa vontade — e é exatamente por isso que o **concorrente real do Pronto não é outro aplicativo. É essa informalidade.**

Isso muda o teste de qualquer decisão de produto: a pergunta certa nunca é "os outros apps do setor fazem isso?" — é **"isso é mais rápido e mais confiável do que mandar mensagem no grupo?"**. Se a resposta for não, a feature está otimizando pro problema errado.

## Por que "mais vantajoso que contratar por fora", e não "substituir a contratação direta"

O Pronto não quer impedir que empresa e trabalhador se conheçam e continuem trabalhando juntos por conta própria depois — isso é físico, acontece no local de trabalho, e tentar impedir seria hostil e inútil. O objetivo é diferente: **fazer com que continuar fechando através do Pronto seja naturalmente melhor do que ir pro combinado informal**, através de cinco frentes concretas:

1. **Facilidade de publicar a vaga** — criar uma escala deve ser mais rápido que escrever uma mensagem explicando a vaga pro grupo.
2. **Facilidade de achar gente** — busca por proximidade, categoria e disponibilidade, sem depender de quem está online no grupo certo na hora certa.
3. **Facilidade de achar gente *boa*** — reputação e avaliação visíveis, uma vantagem que o WhatsApp não tem e não pode ter.
4. **Facilidade de pagamento** *(direção futura, ainda não implementada — ver desafio estrutural abaixo)* — o acerto financeiro acontecendo dentro da plataforma, com segurança pros dois lados.
5. **Facilidade de administração** — para quem tem várias escalas abertas ao mesmo tempo, uma central de operação (quem confirmou, cobertura das próximas horas, quem está atrasado) que substitui a bagunça de acompanhar tudo por mensagem.

## O que isso significa pra cada lado

**Para a empresa**: o Pronto é a **central de operação dos turnos abertos através da plataforma** — não um sistema de RH pra quadro de funcionários fixo. A empresa deve abrir o app todo dia não porque está gerenciando uma equipe permanente, mas porque é ali que ela acompanha a operação de hoje: quem chegou, quem confirmou, o que falta resolver.

**Para o trabalhador**: o Pronto existe pro bico — trabalho avulso, sem vínculo, sem obrigação de recorrência. Liberdade total de escolher quando e onde trabalhar é o valor central, não um efeito colateral. O trabalhador não é o lado que gera receita direta hoje, mas é a **oferta que sustenta o valor de tudo o resto** — sem trabalhadores bons e disponíveis, não existe motivo pra empresa voltar todo dia.

## O que nos diferencia (e o que ainda estamos descobrindo)

Não queremos que o diferencial seja prender o usuário. Se uma empresa quiser sair do Pronto, ela pode exportar os dados dela — o diferencial deve ser o **valor acumulado** de ficar (rede de gente confiável, praticidade, histórico), nunca o custo artificial de sair.

**Em validação**: ainda estamos descobrindo qual é exatamente esse valor acumulado defensável. Uma hipótese descartada explicitamente: virar uma ferramenta completa de gestão de RH (folha, contrato, escala fixa permanente) — isso eliminaria a necessidade de a empresa continuar descobrindo gente nova através do marketplace, o que vai contra o próprio motivo do Pronto existir. A direção que faz mais sentido até agora é investir em tornar a *recontratação* de gente já conhecida mais rápida e organizada dentro da plataforma, sem nunca pular o mecanismo de candidatura aberta (ver princípios).

## Um desafio estrutural ainda sem solução

A monetização planejada é uma taxa de serviço (hoje pensada em torno de 10%) cobrada da empresa, por cima do valor pago ao trabalhador, por transação — não uma assinatura. Hoje a plataforma não cobra nada, de propósito, pra priorizar tração e volume de cadastros.

Isso expõe um risco estrutural real: **hoje o pagamento acontece inteiramente fora da plataforma**, combinado direto entre empresa e trabalhador. Sem o pagamento passar pelo Pronto, não existe mecanismo que sustente a cobrança da taxa — nem para gente nova, nem para recontratação. Mover o pagamento pra dentro da plataforma é, portanto, um pré-requisito estrutural pra monetização fazer sentido, não um detalhe de implementação — e traz consigo questões regulatórias (instituição de pagamento licenciada, retenção fiscal sobre pagamento a avulsos) que já estão em conversa com advogado/contador, mas sem conclusão fechada ainda.

Ver [`principles.md`](./principles.md) pros princípios operacionais e as linhas que nunca vamos cruzar.
