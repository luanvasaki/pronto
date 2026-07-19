# Princípios — Pronto

> Complementa [`vision.md`](./vision.md). Onde a visão explica *por que* o Pronto existe, este documento define *como* decidimos, e onde estão as linhas que não cruzamos — mesmo sob pressão de crescimento, receita ou pedido de cliente.

Cada princípio abaixo carrega o motivo por trás dele. Isso é proposital: um princípio sem motivo vira dogma cego, difícil de reavaliar quando o contexto muda. Um princípio com motivo pode ser questionado de novo no futuro, com inteligência, se a premissa que o sustenta deixar de ser verdade.

## Princípios operacionais

**1. O teste do grupo de WhatsApp.**
Se uma funcionalidade não é claramente mais rápida ou mais confiável do que resolver a mesma coisa mandando mensagem num grupo, ela está otimizando pro problema errado. O concorrente real não é outro app — é a informalidade. Toda feature nova deveria passar nesse teste antes de qualquer outro.

**2. Central de operação do turno, nunca RH de quadro fixo.**
Investimos pesado em dashboard, central de ações, visão em tempo real de quem confirmou/atrasou — isso é o que faz a empresa abrir o app todo dia, e é bem-vindo. O que não construímos é gestão de quadro de funcionários permanente (folha, contrato, escala fixa recorrente do mesmo time). A diferença não é "ter dashboard ou não" — é se a ferramenta ajuda a operar os turnos que passam *pelo* Pronto, ou se ela substitui a necessidade de continuar usando o Pronto pra achar gente.

**3. O trabalhador não paga, mas nunca para de receber investimento.**
A monetização vem do lado empresa. Isso não significa que o roadmap deve migrar inteiro pra lá: o trabalhador é a oferta que sustenta todo o valor do lado que paga. Um marketplace de dois lados morre quando um lado atrofia — se não há trabalhador bom e disponível, não há motivo pra empresa voltar. Investir em experiência do trabalhador é investir na receita do lado empresa, de forma indireta mas real.

**4. Diferencial é valor acumulado, não prisão.**
Uma empresa que quiser sair do Pronto pode exportar os dados dela. Não vamos criar dependência artificial, dado trancado, ou fricção deliberada pra dificultar a saída. Se o produto for bom o suficiente, ninguém vai precisar ser impedido de sair — vai preferir ficar. Isso é mais difícil de construir do que lock-in, e é a régua certa mesmo assim.

## O que nunca vamos fazer

**Nunca vamos oferecer, dentro do app, um mecanismo que atribua ou convide um trabalhador específico a uma vaga, pulando o fluxo público de candidatura.**

A empresa pode conhecer alguém, gostar do trabalho dessa pessoa, e continuar contratando ela sempre — isso é ótimo, e é inevitável (acontece no próprio local de trabalho, por fora do produto, e não tentamos impedir). O que nunca existirá é um botão dentro do Pronto que faça essa designação diretamente, sem a pessoa ativamente se candidatar de novo.

*Motivo*: um recurso do tipo "convide Fulano direto" cria um padrão sistemático e documentado de designação recorrente da mesma pessoa pela mesma empresa — exatamente o tipo de evidência que caracterizaria vínculo empregatício numa disputa trabalhista. A mesma recontratação, quando acontece porque a pessoa viu a vaga aberta e se candidatou por vontade própria, é uma série de bicos independentes, não uma alocação. É essa forma jurídica que sustenta o modelo de intermediação avulsa inteiro.

*Nível de confiança*: alto, mas em validação contínua com o time jurídico — se o entendimento sobre caracterização de vínculo mudar, este princípio deve ser revisitado com a mesma seriedade, não descartado por conveniência.

**Nunca vamos virar um sistema de RH completo** (folha de pagamento, contrato formal, gestão de quadro fixo permanente).

*Motivo*: se a empresa passa a reutilizar sempre a mesma equipe fechada, gerida inteiramente dentro do Pronto sem precisar descobrir gente nova, ela para de precisar do mecanismo de marketplace — que é o motivo do produto existir e, no modelo de monetização por transação, a fonte de receita.

**Nunca vamos prender dados do usuário como estratégia de retenção.**

Exportação de dados sempre disponível pra quem quiser sair. Ver princípio 4.

**Nunca vamos criar fricção artificial pra impedir contato entre empresa e trabalhador fora da plataforma.**

Tentar bloquear troca de contato depois que as duas partes já se conheceram no turno é hostil ao usuário e, na prática, inútil — é contato físico, não hackeável por regra de produto.

## O que nunca vamos sacrificar

- **A liberdade do trabalhador de escolher quando e onde trabalhar.** O bico nunca vira obrigação, escala fixa, ou vínculo — mesmo que isso simplifique alguma feature do lado empresa.
- **A legalidade do modelo de intermediação avulsa**, mesmo quando isso significa abrir mão de uma feature que pareceria óbvia e conveniente (como convite direto).
- **A reputação como sinal justo dos dois lados** — avaliação às cegas até que ambos avaliem (ou o prazo de revelação vença), pra nenhum lado calibrar a nota baseado na do outro.

## Desafio estrutural pendente — não é princípio, é um risco em aberto

O pagamento hoje acontece inteiramente fora da plataforma. A monetização planejada (taxa por transação) só se sustenta quando o pagamento passar a acontecer *dentro* do Pronto — isso é pré-requisito estrutural, não item de roadmap qualquer. Ver [`vision.md`](./vision.md#um-desafio-estrutural-ainda-sem-solução) para o detalhe. Este documento não resolve isso; só registra que nenhum princípio acima substitui a necessidade de resolver essa questão antes de ligar qualquer cobrança.
