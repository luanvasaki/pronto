# Achados de UX — varredura inicial (UX/Product Designer)

> Primeira varredura da Skill `ux-designer`, cobrindo os 3 apps (worker, business, admin) contra o sistema de design em `design_handoff_pronto/` e o padrão de mercado atual. Foco em qualidade visual, modernidade e fricção de uso — não lógica de negócio (isso já está em [`known-issues.md`](./known-issues.md)). Este é um documento vivo: ao resolver um item, mova pra um changelog ou remova; ao encontrar um novo, adicione aqui.

## ✅ Resolvido: raio de borda e escala tipográfica padronizados nos 3 apps

Todos os valores arbitrários de `rounded-[Npx]` e `text-[N.px]` em `apps/worker`, `apps/business` **e `apps/admin`** foram normalizados pros tokens já existentes — raio por **papel do elemento** (`sm`=input/chip, `md`=botão, `lg`=card, `xl`=modal/sheet, conforme `design_handoff_pronto/README.md`), tipografia arredondada pro valor mais próximo da escala documentada (11/14/16/19/24/34). `apps/admin` só precisou da normalização de tipografia + 3 ocorrências de `rounded-[11px]` (ícones de menu/sino) que tinham escapado da varredura original de raio. Verificado nos 3 apps: typecheck, lint, suíte de testes completa (222 + 248 + 73 = 343 testes), build de produção limpo. Conferência visual ao vivo (worker + business) sem regressão.

## ✅ Resolvido (parcial): emoji trocados por ícone SVG consistente em worker/business

Trocados por SVG de traço 2px (mesma linguagem visual do resto do sistema): `📲` (banner de instalação → ícone de celular/download), `⬆️` (passo a passo iOS → ícone de compartilhar), `✕` (fechar banner), `🎉` (banner "você foi chamado" → sparkle), `⏰` (lembrete de turno → relógio), `👤` (indicador de trabalhador no calendário do business → ícone de pessoa), e os ícones `✓`/`★` usados como "ícone" nos cards "Por que confiar" e na lista de comparação "Hoje vs. Com Pronto" das duas landing pages. Verificado: typecheck, lint, 470 testes passando (1 teste ajustado em `escala/page.test.tsx` que verificava o emoji literal no texto), build limpo, conferência visual ao vivo das duas landing pages.

**Deixado de fora, de propósito** (não é a mesma classe de problema — são símbolos monocromáticos consistentes entre plataformas, não emoji colorido — e mexer neles é bem mais invasivo, exige reestruturar JSX em vários arquivos): o padrão `★ {nota}` usado em avaliações (pervasivo nos 3 apps, ~15 ocorrências) e o padrão `"Rótulo ✓"` anexado a texto de botão/estado (ex: "Candidatura enviada ✓", "Localização definida ✓" — ~8 ocorrências). Fica como item separado se quiser fechar depois.

## ✅ Resolvido: skeleton loading nos 3 apps

Criado o mesmo trio de componentes (`Skeleton`, `CardSkeleton`, `CardListSkeleton`, usando `animate-pulse` + tokens de raio/cor já existentes) em `components/ui/skeleton.tsx` de cada app, e trocado o `<p>Carregando...</p>` de tela cheia por eles em 15 páginas — 4 no `worker` (candidaturas, vaga/[id], agenda, ganhos), 7 no `business` (trabalhadores, escalas, vagas/[id]/editar, vagas/[id], escala, painel, escala/live-event-view) e 4 no `admin` (dashboard, trabalhadores, empresas, verificações). Painéis/dashboards (`painel` do business, `admin` overview) e a página de edição de vaga ganharam composições específicas (linha de stat + `CardListSkeleton`, ou barras soltas pro formulário) em vez do card genérico, por serem layouts diferentes de lista de card.

**Deixado de fora, de propósito**: os 3 estados de "Carregando categorias..." que aparecem inline dentro de um formulário já renderizado (`worker/perfil`, `worker/cadastro`, `business/vagas/nova`) — texto pequeno dentro de um dropdown, não tela cheia, então skeleton seria over-engineering ali. Os textos de gate de autenticação em `layout.tsx` (`"Confirmando sua sessão..."`, `"Redirecionando..."`, `"Carregando..."`) do worker e do business também ficaram como estão — virar isso num skeleton exigiria montar um esqueleto da casca inteira do app (sidebar/topbar), o que é uma iniciativa maior e separada.

Verificado: typecheck e lint limpos nos 3 apps, suíte de testes completa (222 + 248 + 73 = 343 testes, incluindo o ajuste de `trabalhadores/page.test.tsx` que verificava o texto literal removido), build de produção limpo nos 3 apps. Sem conferência visual ao vivo desta vez — a maioria das páginas alteradas fica atrás de login (diferente das landing pages públicas dos itens 1 e 2), e não há credencial de teste documentada pra abrir sessão sem afetar dados reais.

## ✅ Resolvido: geocodificação automática de endereço na publicação/edição de vaga

**Correção em relação ao achado original**: antes de mexer, reinvestigamos o mecanismo exato. O CEP no formulário de "nova vaga" já preenchia rua/bairro/cidade/UF (ViaCEP) — mas nunca preenchia lat/lng, só o botão "Usar minha localização atual" (GPS do dispositivo) fazia isso, e era **obrigatório** pra publicar, mesmo com CEP completo. A tela de editar vaga era pior: nem tinha CEP, só um campo de texto livre + o mesmo GPS obrigatório. Isso forçava o dono da empresa a estar fisicamente no endereço (ou arriscar um pino errado batendo GPS de qualquer lugar) toda vez que publicava ou editava uma vaga. (A suspeita original de que o endereço em texto livre do cadastro do trabalhador quebrava "vagas perto de você" **não se confirmou**: a busca por proximidade usa `worker_profiles.home_lat/home_lng`, capturados separadamente por GPS na tela `inicio` — o endereço de cadastro é só identidade, e já tem essa distinção explicada no próprio formulário. Nada foi mexido ali.)

Adicionada geocodificação automática de endereço → lat/lng via Nominatim (mesmo provedor já usado pra geocodificação reversa do trabalhador), num novo endpoint `POST /jobs/geocode-address` (`apps/backend/src/modules/jobs/forward-geocode.ts`, `geocode-address.ts`, `geocode-job-address.controller.ts`). No front (`apps/business`), um hook `useAddressGeocoding` (`hooks/use-address-geocoding.ts`) dispara a geocodificação automaticamente assim que o CEP resolve e no blur do campo Número, preenchendo lat/lng sem intervenção manual. O botão "Usar minha localização atual" continua existindo, mas agora é só um **ajuste fino opcional**: uma vez usado, a geocodificação automática para de rodar até o endereço mudar de novo (rua/número/CEP), pra nunca sobrescrever silenciosamente um pino GPS mais preciso. A tela de editar vaga ganhou os mesmos campos estruturados (`AddressFields`, CEP/rua/número/complemento) que a de criar — antes só tinha um texto livre, agora tem paridade.

Verificado: typecheck e lint limpos (backend + business), suíte de testes completa (692 backend + 248 business), build de produção limpo nos dois. Testado à parte contra a API real do Nominatim (fora da suíte de testes) com um endereço real de São Paulo — retornou coordenadas corretas. Sem conferência visual ao vivo do formulário (fica atrás de login + aprovação de verificação da empresa, sem credencial de teste documentada).

## ✅ Resolvido: lightbox/zoom de documento na tela de Verificações do admin

A miniatura de documento/selfie (antes só um `<img>` de no máximo 64px de altura, sem nenhuma interação) agora abre em tela cheia ao clicar — novo componente `ZoomableDocumentImage` (`apps/admin/src/components/ui/zoomable-document-image.tsx`) envolve a miniatura num botão com um ícone de lupa que aparece no hover, e abre `DocumentLightbox` (`document-lightbox.tsx`) por cima da página inteira. No lightbox, clicar na imagem alterna entre "ajustar à tela" (até 90vw/85vh) e "tamanho real" (com scroll) — dá zoom pra examinar detalhes finos (foto vs selfie, dados do documento) sem precisar de uma biblioteca externa de pan/pinch. Fecha pelo X, clicando fora, ou Esc; trava o scroll da página por trás enquanto aberto. Usado nos dois lugares que já mostravam documento nessa tela: documentos de trabalhador e documento de empresa pessoa física.

Essa foi a primeira vez que o produto precisou de um overlay/modal de verdade (o handoff original previa isso pros 3 apps, mas nenhum tinha implementado ainda — ver achado cross-cutting abaixo). Ficou deliberadamente escopado só pra esse caso (documento de KYC), não como um componente de modal genérico reutilizável — se aparecer mais um caso de modal no produto, vale generalizar então, não antes.

Verificado: typecheck e lint limpos, suíte de testes completa do admin (78 testes, incluindo 5 novos pro `ZoomableDocumentImage`: abre no clique, fecha por botão/Esc, alterna zoom), build de produção limpo. Sem conferência visual ao vivo — a tela fica atrás de login de admin, sem credencial de teste documentada.

## ✅ Resolvido: atalho de teclado na tela de Verificações do admin

**Decisão de escopo**: o achado original propunha "ação em lote OU atalho de teclado". Optamos só pelo atalho, não por aprovação em lote — KYC exige olhar cada documento antes de decidir (é literalmente o propósito da tela, reforçado pelo lightbox do item anterior), então uma ação que aprova vários documentos de uma vez sem revisão individual reduziria a qualidade da verificação em troca de velocidade. O atalho de teclado ataca o mesmo problema (deslocar o mouse entre 10 cards, 20 cliques) sem abrir mão da revisão por documento.

Implementado em `apps/admin/src/app/admin/verificacoes/page.tsx`: o primeiro documento pendente fica marcado como "em destaque" (contorno laranja), e `↑`/`↓` (ou `j`/`k`) troca qual documento está em destaque. `A` aprova e `R` rejeita o documento em destaque — chamando exatamente o mesmo fluxo de confirmação em dois passos que os botões já usavam (primeiro toque pede confirmação, segundo executa), então o atalho não é menos seguro que o clique, só remove o deslocamento de mouse entre um card e o outro. `Esc` cancela uma confirmação pendente. Os atalhos são ignorados enquanto o foco está num campo de texto (ex: nome de categoria pendente), pra não capturar digitação. Uma dica de atalhos aparece acima da lista, só quando há documentos pendentes.

Verificado: typecheck e lint limpos, suíte de testes do admin completa (85 testes — 78 anteriores + 7 novos cobrindo destaque automático, navegação com setas, aprovar/rejeitar com confirmação em dois passos via teclado, cancelar com Esc, e o guard de campo de texto), build de produção limpo. Sem conferência visual ao vivo — mesma limitação de login já registrada nos itens anteriores.

## Achado mais importante: os tokens de design existem, mas foram seguidos de forma decrescente ao longo do tempo

O `apps/admin` (construído por último, extraído do business) segue os tokens de cor e raio do handoff **com fidelidade quase perfeita** — zero hex solto fora do CSS de tokens. Já `apps/worker` e `apps/business` (construídos primeiro, e evoluídos por mais tempo) acumularam dezenas de valores arbitrários de raio (`rounded-[20px]`, `rounded-[18px]`, `rounded-[14px]`, `rounded-[13px]`, `rounded-[11px]`) e tipografia (`text-[19px]`, `text-[15.5px]`, `text-[13.5px]`, `text-[12.5px]`, `text-[11.5px]`) que nunca correspondem exatamente aos 4 raios e 7 degraus tipográficos documentados. Isso é o oposto do que se esperaria — o app mais novo é o mais disciplinado. Sinal de que a deriva acontece com o tempo/pressa, não por falta de sistema — o sistema existe e funciona, só não está sendo consultado.

**Ação de maior alavancagem, cross-app**: usar `apps/admin` como referência e padronizar `rounded-sm/md/lg/xl` + a escala tipográfica documentada em `apps/worker` e `apps/business`. Mecânico, baixo risco, alto retorno de manutenibilidade.

## Outros padrões cross-cutting (aparecem em mais de um app)

- **Emoji como elemento de UI, no lugar de ícone SVG de traço 2px** que o resto do sistema usa — `apps/worker` (`📲`, `🎉`, `⏰`, `✕`, `✓` em `install-app-banner.tsx`, `inicio/page.tsx`, `agenda/page.tsx`) e `apps/business` (`👤`, `✓`/`✕`, `★` em `escala/page.tsx`, `vagas/nova/page.tsx`, `rating-form.tsx`). Renderiza diferente por sistema operacional, quebra a identidade visual customizada que o resto do design cuida de manter. Baixo custo de correção, alto ganho de percepção de acabamento.
- **Nenhum skeleton loading em nenhum dos 3 apps** — todo carregamento é texto centralizado ("Carregando..."). É a marca mais fácil de identificar como "datado" hoje, e o app admin reconhece isso explicitamente também. Ganho de percepção de velocidade desproporcional ao esforço.
- **Componentes prontos, não reaproveitados entre apps do mesmo monorepo**: `GrowthChart` existe e é bem feito, mas não é usado no painel do `business` (onde faria mais sentido — dar noção de tendência ao dono do negócio) e existe uma segunda cópia idêntica no `admin`. `StatCard` existe em `business` mas o `admin` recriou manualmente o mesmo padrão visual em vez de reaproveitar. `packages/shared` nunca teve componente React por decisão de arquitetura (ver `03-architecture/frontend-architecture.md`) — isso é aceitável, mas não impede reaproveitar dentro do próprio app, nem impede considerar se algum desses componentes já maduros merece virar exceção compartilhada.
- **Handoff original especifica modais, sheets e sistema de toast** (`design_handoff_pronto/README.md`) — nenhum dos 3 apps implementa isso; ações usam navegação de página cheia + confirmação inline, e feedback é sempre texto na própria tela. Isso é consistente entre os apps (não é uma inconsistência), mas é uma divergência deliberada (ou esquecida) do spec original — vale uma decisão explícita: manter a simplificação atual, ou investir em modal/toast como próximo salto de polimento.
- **Padrão de confirmação em duas etapas calibrado corretamente em todo o produto** (positivo) — ações reversíveis não pedem confirmação extra, ações irreversíveis (aprovar candidato, marcar como pago, aprovar KYC) pedem. Não mexer.

## Achados por app

### `apps/worker`

**Prioridade**: cadastro é uma maratona de 3 telas sem indicador de progresso nem botão voltar (`cadastro/conta` → `cadastro` → `cadastro/documento`) — maior risco de abandono do funil. Endereço é texto livre sem CEP/autocomplete, apesar de alimentar diretamente a busca por proximidade ("vagas perto de você") — um erro de digitação quebra a promessa central do produto silenciosamente. Upload de documento/selfie não mostra prévia da imagem, no momento de maior ansiedade do onboarding (verificação de identidade).

**Pontos fortes**: candidatura e check-in/check-out já são de fato mais rápidos que negociar num grupo de WhatsApp (um toque). Mensagens de erro específicas, não genéricas. Tokens de cor/elevação fiéis ao handoff.

Detalhe completo (arquivo:linha de cada achado) preservado no relatório original da varredura — arquivos revisados: todas as páginas em `apps/worker/src/app/**`, `apps/worker/src/components/**`.

### `apps/business`

**Prioridade**: "Publicar vaga" é uma página longa de ~15 campos, longe de "mais rápido que WhatsApp" — o handoff original previa um modal leve. Tela de candidatos mistura todos os status (pendente/aprovado/concluído) na mesma lista vertical, sem seção/aba — é a tela mais complexa do app e a menos organizada. Endereço tem duas fontes de verdade (CEP digitado + botão separado de geolocalização, este último obrigatório mesmo com CEP completo).

**Pontos fortes**: "Central de ações" do painel é genuinamente boa — agrupa por urgência, link direto por item, estado "tudo em dia" claro. Tela "Ao vivo" é a peça mais forte do produto contra a informalidade (nenhum grupo de WhatsApp mostra quem está atrasado agora, em tempo real). Reuso de vaga anterior como modelo + duplicar semana atacam bem o problema de recorrência.

**Sobre o painel comunicar "o que precisa de mim agora"**: parcialmente. A Central de Ações acerta, mas o resto da página (5 stat cards + resumo do mês + lista completa de confirmadas) dilui o foco — não há separação visual entre "hoje" e "o mês", e o `GrowthChart` já pronto não é usado ali, apesar de ser exatamente o que falta pra dar noção de tendência.

Detalhe completo — arquivos revisados: todas as páginas em `apps/business/src/app/**`, `apps/business/src/components/**`.

### `apps/admin`

**Prioridade**: a tela mais usada no dia a dia (Verificações) é a menos equipada — sem busca, filtro ou paginação, e sem ação em lote (aprovar 10 documentos = 20 cliques). Fotos de documento não têm zoom/lightbox, apesar da própria tela pedir "compare a selfie com o documento". Sem indicação de tempo de espera/prioridade em nenhuma fila.

**Pontos fortes**: tokens de design são os mais fiéis dos 3 apps (ver achado principal acima). Padrão de navegação (sidebar/topbar) é praticamente idêntico ao business. Agrupamento de documentos por trabalhador já resolve bem o problema de comparar selfie+RG do mesmo candidato lado a lado.

**Divergência em relação aos outros 2 apps**: topbar do admin não tem saudação/avatar do usuário logado; sino de notificação é só um link, não um dropdown com lista navegável, como o do business.

Detalhe completo — arquivos revisados: todas as páginas em `apps/admin/src/app/**`, `apps/admin/src/components/**`, comparado com equivalentes de `apps/business`.

## Top 10 do produto inteiro, priorizado

1. ~~Padronizar raio de borda e escala tipográfica em `worker`/`business` pelos tokens já corretos (usar `admin` como referência).~~ **Feito.**
2. ~~Trocar emoji por ícone SVG consistente em `worker` e `business`.~~ **Feito** (parcial — ver nota acima sobre `★`/`"Rótulo ✓"` deixados de fora).
3. ~~Adicionar skeleton loading nos 3 apps, no lugar de texto "Carregando...".~~ **Feito.**
4. ~~Resolver a duplicidade/fragilidade de endereço→geolocalização (CEP não geocodifica automaticamente; editar vaga no business não tem CEP).~~ **Feito** (a parte do cadastro do worker não precisava de correção — ver nota acima).
5. ~~Lightbox/zoom de documento no admin, pra revisão de KYC de verdade.~~ **Feito.**
6. ~~Ação em lote / atalho de teclado na tela de Verificações do admin.~~ **Feito** (só o atalho de teclado — ver nota acima sobre por que a ação em lote foi descartada).
7. Indicador de progresso + botão voltar no cadastro do worker.
8. Segmentar a tela de candidatos do business por status (aba/seção).
9. Reaproveitar `StatCard` no admin e usar `GrowthChart` no painel do business — ganho rápido, código já existe.
10. Elevar a topbar/sino do admin ao mesmo padrão dos outros 2 apps (avatar, saudação, dropdown de notificação).
