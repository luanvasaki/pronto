# Handoff: Pronto — marketplace de profissionais temporários

## Overview
**Pronto** é um marketplace de contratação de profissionais temporários sob demanda (turnos agendados) para restaurantes, bares, buffets, hotéis e eventos. Dois públicos: **empresas** (publicam turnos, escolhem candidatos) e **trabalhadores** (aceitam turnos, fazem check-in/out, recebem). Este pacote contém a marca, o design system e os protótipos de todas as telas.

Tagline: **"Faltou gente? Pronto."** · domínio: pronto.work

## About the Design Files
Os arquivos `.dc.html` deste pacote são **referências de design criadas em HTML** — protótipos que mostram o visual e o comportamento pretendidos, **não código de produção para copiar direto**. A tarefa é **recriar estes designs no ambiente do seu codebase** (React, Vue, React Native, SwiftUI, etc.), usando os padrões e a biblioteca de componentes que já existirem no projeto. Se ainda não houver um ambiente, escolha o framework mais adequado e implemente os designs nele.

Para abrir os protótipos: abra qualquer arquivo `.dc.html` num navegador (eles carregam `support.js`, `ios-frame.jsx` e `browser-window.jsx` que já vêm neste pacote). Fontes vêm do Google Fonts.

## Fidelity
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos e interações são finais. Recreie a UI fielmente usando as bibliotecas/padrões do codebase. Os dados (nomes, valores, estabelecimentos de Sorocaba) são ilustrativos — substitua por dados reais.

## Design Tokens

### Cores (11 tokens semânticos · claro / escuro)
Dark mode é **quente** (near-black amarronzado), não cinza — para casar com a marca.

| Token | Uso | Claro | Escuro |
|---|---|---|---|
| `primary` | botão principal, links, foco | `#F5531E` | `#FF6B3D` |
| `secondary` | ação secundária | `#1A1712` | `#F0ECE2` |
| `accent` | destaque pontual (ember) | `#C2410C` | `#FF8A4C` |
| `success` | confirmação, avaliação, "disponível" | `#17A860` | `#35C489` |
| `warning` | pendente, atenção, "aguardando" | `#E0900F` | `#F5B93D` |
| `danger` | erro, cancelamento | `#C0392B` | `#F07567` |
| `background` | fundo da página | `#F7F4EE` | `#14120D` |
| `surface` | cards, inputs | `#FFFFFF` | `#201C16` |
| `border` | bordas, divisórias | `#E4DED2` | `#322D24` |
| `text` | texto principal | `#1A1712` | `#F2EEE5` |
| `text-secondary` | texto de apoio | `#7A7264` | `#A79E8C` |

### Tipografia
- **Títulos / números grandes:** Bricolage Grotesque — pesos 600, 700, 800. (substitui Plus Jakarta Sans)
- **Corpo / UI / botões:** Hanken Grotesk — pesos 400, 500, 600, 700. (substitui Inter)
- **OTP:** JetBrains Mono — 500, 600 (mantido).
- **Valores em R$:** recomendado Hanken Grotesk com `font-variant-numeric: tabular-nums` (ou manter JetBrains Mono).
- Google Fonts: `Bricolage+Grotesque:wght@600;700;800` · `Hanken+Grotesk:wght@400;500;600;700` · `JetBrains+Mono:wght@500;600`

Escala tipográfica: Display 800 (48–92px) · H1 700/34 · H2 700/24 · H3 700/19 · Corpo 400/16 · Pequeno 500/14 · Micro 600/11 caps (letter-spacing 0.16em).

### Raios de borda
`sm 8px` (input, chip) · `md 12px` (botão) · `lg 16px` (card) · `xl 24px` (modal/sheet) · `full 999px` (pill, avatar).

### Espaçamento
Escala base 4px: 4, 8, 12, 16, 20, 24, 32, 48, 64.

### Elevação (sombras)
- sm (card): `0 4px 14px rgba(26,23,18,0.05)`
- md (botão primário): `0 8px 20px rgba(245,83,30,0.28)`
- lg (modal): `0 24px 60px rgba(0,0,0,0.35)`

## Logo & Ícone
Símbolo = um **anel** (o "o" de pr◯nto), na cor `primary`. **Não** é um ponto — a escolha é intencional para diferenciar do varejista "Ponto". Arquivos em `assets/`:
- `pronto-icon.svg` + `pronto-icon-192.png` / `-512.png` / `-180.png` — ícone de app/PWA (quadrado laranja `#F5531E`, anel branco, raio 22%).
- `pronto-symbol-orange.svg` / `pronto-symbol-white.svg` — só o anel.
- `pronto-wordmark-light.svg` / `pronto-wordmark-dark.svg` — logotipo completo.
- Wordmark em CSS: `pr` + anel + `nto` em Bricolage Grotesque 800, `letter-spacing:-0.03em`; anel = `border:0.16em solid #F5531E; border-radius:50%; width/height:0.58em`, alinhado à base.

## Screens / Views

### App do trabalhador (mobile, 402×874) — `App Trabalhador - Pronto.dc.html`
Tab bar de 4 abas: Turnos, Agenda, Ganhos, Perfil. Logo (anel) fixo no topo.
- **Turnos (busca de vagas):** saudação + avatar; **toggle de disponibilidade** (verde = online); filtros em chips (Todos/Hoje/Amanhã/Fim de semana); lista de cards de turno (função, local, ★nota, R$, dia/hora, distância, botão "Aceitar turno"). Card tocável abre a folha de detalhe.
- **Detalhe do turno (bottom sheet):** função, R$ (recebe + R$/h), quando, mapa (placeholder com pin), traje, o que levar, botão "Aceitar em 1 toque".
- **Agenda:** turnos confirmados com cabeçalho de data (fundo escuro) + endereço.
- **Ganhos:** saldo disponível (card escuro), "Sacar via Pix", semana/mês, histórico.
- **Perfil:** avatar, nota, selo verificado (success), stats (pontualidade/aceite/turnos), funções (chips), avaliações.

### App — fluxos restantes (mobile) — `App Fluxos - Pronto.dc.html`
- **Login / código (OTP):** logo, "Confirme seu número", 5 campos OTP (JetBrains Mono; 1 ativo com borda `primary`), timer de reenvio, botão "Confirmar".
- **Cadastro / perfil:** "Como você vai usar o Pronto?" — 2 cards selecionáveis (Quero trabalhar [selecionado, borda primary + check] / Preciso de reforço), campo Nome, botão "Continuar".
- **Avaliação:** "Turno concluído", avatar do profissional, "Como foi a Ana?", **5 estrelas clicáveis** (primary), chips de qualidade selecionáveis (Pontual/Rápida/Caprichosa/Educada), textarea, botão "Enviar avaliação".
- **Check-in / check-out:** turno do dia; **timeline de 3 passos** (Check-in → Em andamento → Check-out) que evolui; confirmação de localização (success); botão que avança Fazer check-in → Fazer check-out → ✓ Turno concluído.

### Painel da empresa (desktop, 1280×820) — `Painel Empresa - Pronto.dc.html`
Sidebar escura (logo + nav: Início/Turnos/Escala/Profissionais + card da conta). Topbar (título + sino + botão "Publicar turno").
- **Início:** 4 stat cards (turnos abertos, preenchidos, gasto, avaliação); lista "Precisam de gente" (turno + nº candidatos + "Ver candidatos"); turnos confirmados.
- **Publicar turno (modal):** função, data, vagas, início/fim; **estimativa de preço ao vivo** (profissional recebe + taxa 15% = você paga); "Publicar e receber candidatos".
- **Candidatos (modal):** lista de candidatos (avatar, ★nota, turnos, distância) + botão "Aprovar" (success). Preenche vaga a vaga.
- **Turnos:** todos com badge de status (Aberto/Preenchido). **Escala:** grade semanal Seg–Dom. **Profissionais:** cards da rede com "Convidar".

### Landing page (web responsiva) — `Landing - Pronto.dc.html`
Nav sticky · Hero ("Faltou gente? Pronto." + CTA duplo + card de app ao vivo) · trust bar · Problema→Solução · Como funciona (3 passos) · Segmentos · Para profissionais (seção escura) · Confiança (3 pilares: verificado/avaliação/preço transparente) · Depoimentos · Preço (conta aberta) · FAQ (`<details>`) · CTA final · footer.

## Interactions & Behavior
- **Transições:** entrada de tela `translateY(14px)→0` + fade, ~.4s ease. Bottom sheet: `translateY(100%)→0`, .32s cubic-bezier(.2,.8,.2,1). Modais: fade+scale(.98→1), .3s. Toast: sobe + fade, .3s, auto-some em ~2.8s.
- **App trabalhador:** toggle de disponibilidade (verde↔cinza, knob desliza); filtros filtram a lista; aceitar turno → toast + move para Agenda; "Aceitar em 1 toque" disponível no card e no detalhe.
- **Painel:** publicar recalcula a estimativa a cada mudança de campo; aprovar candidato incrementa `filled` e fecha o turno só quando `filled >= qty` (turno de N vagas exige N aprovações).
- **Avaliação:** clicar estrela define nota 1–5; chips alternam selecionado.
- **Check-in/out:** botão avança a máquina de estados (0→1→2); timeline e horários refletem o passo.
- **FAQ landing:** `<details>/<summary>`, o "+" gira 45° quando aberto.

## State Management
- **App trabalhador:** `tab`, `available` (bool), `filter`, `openId` (detalhe), `accepted` (ids), `toast`.
- **App fluxos:** `rating` (0–5), `tags` (map bool), `step` (0/1/2 do check-in).
- **Painel:** `nav`, `publishOpen`, `form {role,date,start,end,qty}`, `candId` (modal de candidatos), `shifts[]` (com `candidates`/`hired`/`filled`/`status`), `toast`. Estimativa: `base[role] × horas × qty` + 15% de taxa.

## Assets
Em `assets/` — logo/ícone em SVG e PNG (ver seção Logo). Sem fotos/stock: avatares são **iniciais** em círculos coloridos; mapas são placeholders de grid com pin. Ícones são SVG inline de traço 2px (bolt, calendário, carteira, pessoa, pin, check).

## Files
Protótipos (referência de design) neste pacote:
- `App Trabalhador - Pronto.dc.html` — app do trabalhador (4 abas + detalhe)
- `App Fluxos - Pronto.dc.html` — login/OTP, cadastro, avaliação, check-in/out
- `Painel Empresa - Pronto.dc.html` — dashboard da empresa
- `Landing - Pronto.dc.html` — landing page
- `Design System - Pronto.dc.html` — tokens e componentes (referência visual)
- `Handoff - Especificacao.dc.html` — esta especificação em formato visual
- Runtime necessário para abrir os protótipos: `support.js`, `ios-frame.jsx`, `browser-window.jsx`
