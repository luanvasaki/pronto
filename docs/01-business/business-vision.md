# Visão de negócio — Pronto

> Este documento traduz [`00-vision/vision.md`](../00-vision/vision.md) em estratégia concreta: quem é o cliente, o que é o modelo de negócio hoje, e como o Pronto se posiciona contra a alternativa real (a informalidade). Onde a visão responde "por que existimos", este documento responde "pra quem, e como isso vira negócio".

## Quem é o cliente

**Lado empresa** (quem contrata): segmentos de negócio que precisam de mão de obra avulsa em picos de demanda — bar, restaurante, buffet, hotel, casa de eventos, casa noturna, e outros segmentos correlatos. Esse recorte já existe no produto hoje (é literalmente uma lista fixa de opções no cadastro da empresa), o que confirma que o Pronto já nasceu mirando esse nicho específico, não "qualquer empresa que precise de gente".

**Lado trabalhador**: quem faz bico — trabalho avulso, sem vínculo, tipicamente em funções operacionais desses mesmos segmentos (garçom, cozinha, bar, limpeza, segurança, etc., organizadas em categorias de habilidade dentro do produto).

O ponto comum entre os dois lados: **o dia de pico não é o dia normal**. Empresas desses segmentos têm demanda extremamente variável (evento grande num fim de semana, feriado, alta temporada) e não faz sentido manter quadro fixo pra cobrir isso — daí a necessidade estrutural de mão de obra avulsa, e daí o motivo do Pronto existir.

## Posicionamento

**O Pronto não compete com outro aplicativo. Compete com o grupo de WhatsApp que hoje organiza essa operação.**

Isso é uma escolha deliberada de onde investir energia competitiva. Não estamos otimizando pra "ser melhor que o app concorrente X" — estamos otimizando pra "ser melhor que resolver isso na marra, por mensagem, sem histórico, sem controle, sem segurança". Isso muda completamente o que conta como vantagem competitiva: velocidade de publicar, facilidade de achar gente boa (com nota, com histórico), visão operacional do turno, e (no futuro) segurança no pagamento — não features "de app", features que resolvem o problema real de quem hoje sofre com a informalidade.

**Em validação**: uma busca inicial não encontrou concorrente direto fazendo exatamente essa combinação (marketplace de bico avulso + taxa por transação sobre o valor pago ao trabalhador) nesse nicho específico no Brasil. Isso é tratado como sinal de oportunidade genuína, mas com uma ressalva registrada: ausência de concorrente pode também significar que outros já tentaram esse modelo exato e migraram pra outro (ex: assinatura fixa em vez de taxa por transação) por causa do problema de vazamento de transação descrito em [`marketplace.md`](./marketplace.md). Vale validar isso com mais profundidade antes de assumir que é só espaço em branco.

## O modelo de negócio, em uma frase

Marketplace de dois lados, hoje sem cobrança nenhuma (fase de tração/cadastro), com direção futura de cobrar uma taxa de serviço da empresa — por cima do valor pago ao trabalhador, por transação concluída, não por assinatura. Detalhe completo em [`monetization.md`](./monetization.md).

## O que isso implica pra prioridade de produto

Se o cliente-chave (empresa) está nesses segmentos específicos, e se o concorrente real é a informalidade, então a régua de qualquer feature nova deveria ser: **isso ajuda um bar/buffet/casa de eventos a resolver um pico de demanda mais rápido e com mais segurança do que resolveria puxando o grupo de WhatsApp da equipe de confiança?** Se a resposta não for um "sim" claro, a feature provavelmente está fora do foco descrito aqui — mesmo que pareça uma boa ideia em abstrato.
