# Dinâmica de marketplace — Pronto

> Como os dois lados (empresa e trabalhador) se sustentam mutuamente, o que gera liquidez em cada lado, e o risco estrutural que todo marketplace de transação enfrenta — aplicado à realidade do Pronto.

## Os dois lados

**Oferta**: trabalhadores avulsos, cadastrados com categoria de habilidade, localização (raio de busca), CNH quando relevante, e — se menor de 18 anos — autorização de responsável. Livres pra se candidatar a qualquer vaga compatível, sem obrigação de aceitar nada.

**Demanda**: empresas publicando vagas (escalas) com posição, horário, categoria exigida, benefícios (alimentação/transporte), e requisitos (experiência, CNH, permissão pra menores).

O encontro dos dois lados acontece hoje inteiramente por **candidatura aberta**: a empresa publica, o trabalhador vê e se candidata, a empresa aprova. Não existe (e, por princípio, nunca vai existir) um mecanismo de convite direto que pule essa etapa — ver [`00-vision/principles.md`](../00-vision/principles.md).

## O que gera liquidez de cada lado

**Do lado trabalhador**: quantidade e variedade de vagas publicadas perto dele, dentro do raio de busca que ele mesmo define. Sem vagas suficientes, o trabalhador para de abrir o app — e sem trabalhador engajado, a empresa não acha ninguém quando publica. Por isso o princípio de que o trabalhador "não paga, mas nunca para de receber investimento" ([`00-vision/principles.md`](../00-vision/principles.md#princípios-operacionais)) não é caridade — é pré-condição de liquidez do lado que paga.

**Do lado empresa**: confiança de que vai achar gente boa e disponível quando precisar, e velocidade de resolver isso (ver o "teste do grupo de WhatsApp"). Reputação/avaliação é o mecanismo que sustenta essa confiança — sem ela, contratar por marketplace teria a mesma qualidade de "loteria" que contratar um desconhecido do grupo de WhatsApp.

## O papel da recontratação

Uma parte relevante da demanda real não é "achar alguém novo" — é "chamar de volta quem já trabalhou bem". Isso é legítimo e desejável (é literalmente parte da vantagem descrita em [`business-vision.md`](./business-vision.md): "facilidade de achar bons profissionais com nota"), mas precisa acontecer **dentro** do mecanismo de candidatura aberta, nunca por convite direto.

Isso significa que "recontratação rápida" como direção de produto (ver [`00-vision/vision.md`](../00-vision/vision.md#o-que-nos-diferencia-e-o-que-ainda-estamos-descobrindo)) precisa de soluções que tornem a descoberta mais rápida pro trabalhador já conhecido — por exemplo, ele ficar sabendo mais cedo que uma vaga nova foi publicada por uma empresa com quem já trabalhou — sem nunca virar uma atribuição automática. Qualquer ideia nessa linha deve ser validada com o time jurídico antes de ser construída, pelo mesmo motivo do princípio de convite direto.

## O risco estrutural: vazamento de transação (disintermediation)

Todo marketplace que cobra por transação enfrenta o mesmo risco: depois que os dois lados se encontram através da plataforma, nada tecnicamente impede que a próxima transação (ou todas as seguintes) aconteça por fora, sem pagar a taxa. É o mesmo problema que Uber, Upwork, Thumbtack e praticamente todo marketplace de serviço já enfrentaram.

No caso do Pronto, esse risco é hoje **estrutural, não só comportamental**: o pagamento já acontece inteiramente fora da plataforma por desenho atual do produto (ver [`monetization.md`](./monetization.md)). Isso significa que, no momento em que a taxa de serviço for ligada, o risco de vazamento não vai valer só pra recontratação — vai valer pra qualquer transação, nova ou recorrente, porque hoje não existe nenhum mecanismo que amarre o pagamento ao Pronto.

Duas estratégias possíveis pra mitigar isso, que puxam em direções opostas (ver a mesma tensão registrada em [`00-vision/principles.md`](../00-vision/principles.md)):

- **Fricção**: dificultar tecnicamente a saída do fluxo (ex: esconder contato, dificultar pagamento por fora). Contradiz o princípio de "diferencial é valor acumulado, não prisão".
- **Valor real**: fazer valer a pena continuar pagando pelo Pronto mesmo depois de se conhecerem — proteção contra calote/não comparecimento, comprovante fiscal da intermediação avulsa, avaliação que só conta se o turno foi fechado pela plataforma, resolução de disputa. Coerente com os princípios, mas mais difícil de construir.

A escolha entre essas duas (ou uma combinação) ainda está **em validação** — é provavelmente a decisão de produto mais importante da fase de monetização, porque define o diferencial real que o Pronto ainda está procurando.
