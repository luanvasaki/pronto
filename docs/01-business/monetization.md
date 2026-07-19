# Monetização — Pronto

> O que existe hoje, o que está planejado, e a diferença estrutural entre os dois — porque essa diferença é o maior risco de execução que o negócio tem no momento.

## Hoje: gratuito, de propósito

O Pronto não cobra nenhuma taxa hoje. Essa é uma decisão deliberada de fase, não uma limitação técnica: o objetivo atual é maximizar cadastro e volume de uso (liquidez dos dois lados, ver [`marketplace.md`](./marketplace.md)) antes de introduzir qualquer cobrança. Cobrar cedo demais, antes de ter volume, arriscaria matar a adoção que ainda está sendo construída.

Tecnicamente, isso já é refletido no sistema de pagamento existente: o acerto financeiro entre empresa e trabalhador acontece **inteiramente fora da plataforma** — o gateway de pagamento no backend é um mock que nunca processa dinheiro de verdade, e o fluxo existente (empresa marca "paguei" → trabalhador confirma "recebi"/"não recebi") é um sistema de honra, não uma transação real. Essa decisão está documentada no próprio código como escolha de produto: dá pra rastrear em que ponto o combinado está, sem custo de compliance/integração de PSP antes de validar o modelo.

## O plano futuro: taxa de serviço por transação

A direção considerada (ainda não implementada, valor ainda não fechado): uma taxa de serviço em torno de **10%**, cobrada da empresa, **por cima** do valor combinado com o trabalhador — ou seja, o trabalhador continua recebendo o valor cheio, e a empresa paga esse valor mais a taxa. Exemplo dado na definição: trabalhador recebe R$150, empresa paga R$165 (R$15 de taxa de serviço).

Pontos importantes dessa escolha:

- É uma taxa **por transação concluída**, não uma assinatura mensal fixa. Isso significa que a receita depende diretamente do volume de turnos fechados através da plataforma — o que torna o risco de vazamento de transação (descrito em [`marketplace.md`](./marketplace.md)) uma ameaça direta à receita, não só um incômodo.
- É cobrada **só do lado empresa**. O trabalhador nunca vê o valor dele reduzido pela taxa — reforça o princípio de que a monetização vem do lado empresa sem sacrificar a experiência do trabalhador ([`00-vision/principles.md`](../00-vision/principles.md#princípios-operacionais)).
- Não há ainda uma data-alvo ou métrica de gatilho definida pra quando essa taxa entra em vigor — depende de "ter bastante fluxo de usuários" primeiro, sem número específico ainda estabelecido.

## O pré-requisito estrutural: pagamento precisa passar pela plataforma

Este é o ponto mais importante deste documento: **a taxa de 10% não tem como ser cobrada de forma confiável enquanto o dinheiro do turno continuar sendo combinado fora da plataforma.** Não é uma questão de "adicionar uma cobrança" ao sistema atual — é uma mudança arquitetural que precisa acontecer antes.

O que isso implica, concretamente:

1. **O fluxo de pagamento atual muda de natureza.** Hoje existe uma máquina de estados de honra (`pending → charged → released → confirmed/disputed`) que existe *porque* a plataforma não processa o dinheiro de verdade — ela só registra o que as duas partes dizem que aconteceu. Quando o pagamento passa a ser processado de verdade pela plataforma, esse "confirma se recebeu" deixa de fazer sentido: a plataforma vai *saber* que pagou, não vai precisar perguntar.
2. **Processar pagamento de terceiros normalmente exige parceria com uma instituição de pagamento licenciada** (o próprio código já cita candidatas conhecidas do mercado brasileiro, como Pagar.me e Iugu) ou o Pronto se tornar uma instituição de pagamento licenciada por conta própria — isso é trabalho regulatório real, com prazo tipicamente mais longo que o desenvolvimento de produto.
3. **Existem questões fiscais em aberto** sobre retenção/declaração de pagamentos feitos a trabalhadores avulsos, que estão sendo conversadas com advogado/contador, sem conclusão fechada ainda.
4. **O sequenciamento entre "pagamento pela plataforma" e "cobrança da taxa" ainda não foi decidido** — pode fazer sentido introduzir o pagamento pela plataforma primeiro, ainda gratuito, pra criar o hábito antes de cobrar (reduzindo o choque da mudança), ou lançar os dois juntos. Essa decisão está deliberadamente em aberto por enquanto.

## Resumo do estado atual

| Aspecto | Hoje | Planejado |
|---|---|---|
| Cobrança de taxa | Nenhuma | ~10% sobre o valor do turno, cobrado da empresa |
| Modelo | — | Por transação, não assinatura |
| Pagamento do turno | Combinado fora da plataforma (sistema de honra) | Processado dentro da plataforma |
| Base regulatória | Não aplicável | Em conversa com advogado/contador, sem definição fechada |
| Gatilho de lançamento | — | "Bastante fluxo de usuários" (sem número definido) |
