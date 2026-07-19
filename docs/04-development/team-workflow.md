# Equipe permanente e fluxo de colaboração — Pronto

> As 7 especialidades que operam neste projeto, como colaboram, e a hierarquia de interrupção. Cada uma existe como uma Skill de verdade em `.claude/skills/`. Este documento é a referência mestra — se uma Skill e este documento divergirem, este documento vence (e a Skill deve ser corrigida na mesma tarefa, via Sincronizador de Documentação).

## Por que não é uma esteira linear

Um organograma clássico (CEO→PM→UX→Backend→Frontend→QA) pressupõe que cada papel só começa depois que o anterior termina. Aqui, Backend e Frontend trabalham **em paralelo** na mesma feature — só precisam bater no contrato entre os dois (rota/payload), não numa ordem fixa. Forçar sequência onde não existe dependência real só cria espera artificial. O princípio central de todo esse desenho é: **peso de processo proporcional ao risco, e todo gate caro acontece antes de construir, nunca depois** — é isso que minimiza retrabalho.

## As 7 especialidades, em prioridade

1. **Guardião da Visão e do Modelo de Negócio** — gate estratégico. Protege `00-vision/` e `01-business/`.
2. **Security Engineer** — cross-cutting, entra em qualquer fluxo que toque autenticação, dado de KYC/menor de idade, ou (futuro) pagamento real.
3. **Product Manager** — traduz uma ideia aprovada em princípio num escopo concreto (v1, critério de pronto, casos de borda).
4. **UX/Product Designer** — define como a tela/fluxo deve parecer e se comportar; faz varredura periódica das telas existentes.
5. **Engenheiro de Domínio Backend** — schema, migration, concorrência, testes de backend.
6. **Guardião de Consistência Frontend** — impede que worker/business/admin divirjam em lógica/comportamento compartilhado.
7. **Sincronizador de Documentação** — mantém `docs/` fiel à realidade, sempre por último.

Detalhe completo de cada uma (objetivo, quando usar/não usar, documentos, decisões autônomas, gatilhos de aprovação obrigatória) está no próprio arquivo da Skill, em `.claude/skills/<nome>/SKILL.md`.

## Fluxo A — mudança de produto/negócio (feature nova, mudança de fluxo de contratação, qualquer coisa estratégica)

```
Pedido chega
     │
     ▼
Guardião da Visão ──reprova──▶ para aqui (ou escala pro usuário decidir)
     │ aprova o escopo (o quê, e por quê)
     ▼
Product Manager (define a v1: o que exatamente, critério de pronto, o que fica fora)
     ▼
UX/Product Designer (define como deve parecer e se comportar)
     │ cria token/padrão de marca novo? ──▶ aprovação obrigatória do usuário
     ▼
┌───────────────────────────────────────────────────────────┐
│ Engenheiro de Domínio Backend ◀──contrato de API──▶ Guardião de Consistência Frontend │
│              ▲                                              │
│              └── Security Engineer (se tocar auth/dado sensível) ┘
└───────────────────────────────────────────────────────────┘
     │
     ▼
UX/Product Designer revisa fidelidade visual do que foi implementado
     │
     ▼
Sincronizador de Documentação (registra o que foi decidido e construído)
```

## Fluxo B — manutenção técnica pura (bugfix, refactor, dívida técnica sem mudança de regra de negócio)

```
Pedido chega
     │
     ▼
Engenheiro de Domínio Backend e/ou Guardião de Consistência Frontend (direto, sem Guardião da Visão/PM)
     │
     │ UX entra só se a correção também mexer em interface
     │ Security Engineer entra em paralelo se tocar auth/dado sensível
     ▼
Sincronizador de Documentação
```

## Quem lidera, revisa, aprova, executa

- **Lidera**: Guardião da Visão, só no Fluxo A. No Fluxo B, ninguém lidera formalmente — não há risco de negócio a proteger.
- **Revisa**: antes de construir (Guardião da Visão revisa intenção; Product Manager revisa escopo; UX revisa proposta visual); depois de construir (UX revisa fidelidade visual; Sincronizador revisa se a documentação ainda bate com a realidade). Entre Backend e Frontend, cada um revisa só o contrato que toca o outro, nunca a implementação interna.
- **Aprova**: qualquer item na lista de "aprovação obrigatória" de qualquer Skill é sempre aprovado **pelo usuário**, nunca por outra Skill. Nenhuma Skill aprova a escalação de outra.
- **Executa**: Engenheiro de Domínio Backend e Guardião de Consistência Frontend constroem; UX/Product Designer e Product Manager especificam mas não escrevem código de produção.

## Hierarquia de interrupção

1. **Guardião da Visão** — para qualquer coisa, a qualquer momento, por violação de princípio. Ninguém sobrepõe, exceto o usuário.
2. **Security Engineer** — para qualquer coisa, a qualquer momento, por vulnerabilidade real encontrada.
3. **Engenheiro de Domínio Backend** — para por risco de perda/corrupção de dado (migration destrutiva, ação contra banco fora do ambiente local).
4. **Product Manager** — não interrompe trabalho em andamento; devolve a especificação pro Guardião da Visão antes de liberar pra construção, se achar conflito.
5. **UX/Product Designer** — consultivo: pausa antes da construção começar se o padrão proposto não estiver bom o suficiente; não trava um build já em andamento.
6. **Guardião de Consistência Frontend** — consultivo, mesma lógica do UX: sinaliza, não bloqueia.
7. **Sincronizador de Documentação** — nenhuma autoridade de interrupção; só recusa editar `00-vision/`/`01-business/` sozinho.

## Papéis considerados e descartados (com razão)

- **CEO** — é o usuário; automatizar isso é risco, não ganho.
- **Auditoria completa** — ritual periódico (repetir a varredura de engenharia reversa a cada trimestre ou quando a documentação parecer desatualizada), não uma especialidade permanente.
- **QA/Test dedicado** — já coberto pelas skills genéricas `verify`/`run` do ambiente; o ganho real foi garantir que `02-product/user-journey.md` seja a referência que elas consultam, não criar uma skill nova.
