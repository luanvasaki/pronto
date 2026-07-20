# Arquitetura de frontend — Pronto

> Padrões compartilhados pelos 3 apps (worker, business, admin), todos Next.js App Router. Mapa de telas de cada um em [`06-reference/frontend-routes/`](../06-reference/).

## Um cliente de API por domínio, sem camada de cache

Cada app organiza `src/lib/*-api.ts` — um arquivo por domínio do backend (`jobs-api.ts`, `applications-api.ts`, `shifts-api.ts`, `worker-profile-api.ts`, etc.), cada um só com interfaces TypeScript + funções finas que chamam `apiFetch` de `@shift/shared`. **Não existe React Query, SWR, Redux ou Zustand em nenhum dos 3 apps** — todo state management é `useState`/`useEffect` local por página, com um Context simples por app só pra evitar refetch duplicado do perfil do usuário logado (`WorkerProfileProvider`, `CompanyProfileProvider`).

Isso é uma escolha consciente de simplicidade pro estágio atual do produto, não uma limitação técnica — mas significa que qualquer necessidade futura de cache/sincronização entre telas precisa ser resolvida manualmente, tela por tela.

## Componentes de UI duplicados, não compartilhados

`packages/shared` deliberadamente **nunca contém componentes React** — só lógica (cliente HTTP, validação, formatação, tipos). Isso significa que `Button`, `Input`, `Avatar`, `Logo`, `TermsCheckbox`, `GoogleLoginButton` e outros existem **de forma independente e duplicada** em cada um dos 3 apps. Uma correção de acessibilidade ou de estilo num componente precisa ser replicada manualmente nos outros apps se for relevante pra eles — não há garantia de sincronização.

## Polling em vez de tempo real

Nenhum dos apps usa WebSocket ou server-sent events. Onde é preciso refletir mudança quase em tempo real (sino de notificações, tela "Ao vivo" da operação do dia), a solução é `setInterval` fazendo poll do endpoint a cada 30-60 segundos, com comentário explícito no código reconhecendo que isso é suficiente pro volume atual, não uma limitação a ser escondida.

## PWA instalável, sem cache offline real

Os apps worker e business (e o admin, no mesmo padrão) são instaláveis como PWA — manifest, ícones, banner de instalação nativo no Android/Chrome (`beforeinstallprompt`) e passo a passo manual pro iOS (que não expõe essa API). O service worker registrado, porém, **não implementa nenhuma estratégia de cache** — existe só pra satisfazer o critério técnico de "app instalável" dos navegadores. Fora do escopo atual: qualquer funcionalidade offline de verdade.

## Formulários com validação compartilhada, sem biblioteca de formulário

Onde o mesmo formulário aparece em mais de um lugar (ex: publicar vaga e editar vaga, no app business), a validação é extraída pra um hook compartilhado (`useJobFormValidation`) e os campos em componentes próprios, sem usar uma biblioteca de formulário (React Hook Form, Formik, etc.) — tudo state local + validação manual.

## Diálogo de confirmação inline, repetido

Ações destrutivas ou irreversíveis (aprovar candidato, remover candidato, cancelar vaga, confirmar saída de turno, marcar como pago) usam o mesmo padrão de "confirmação em duas etapas" — um estado local tipo `confirming<X>Id` que troca o botão original por um par "sim/cancelar". Esse padrão é reimplementado em cada tela, não é um componente genérico reutilizável.

## Error tracking no client (Sentry)

Cada app tem `src/lib/sentry.ts` (`initSentry()`) e `src/app/init-sentry.tsx` — um client component montado no `layout.tsx`, no mesmo padrão de `register-service-worker.tsx`, que chama `initSentry()` uma vez no mount. Mesma regra do backend (`apps/backend/src/config/sentry.ts`): sem `NEXT_PUBLIC_SENTRY_DSN` configurada, `Sentry.init`/`captureException` viram no-op — nenhum código precisa checar se está ativo. `src/app/global-error.tsx` captura qualquer exceção de render que escape de todos os error boundaries locais (App Router substitui o layout inteiro nesse caso) e mostra um fallback com botão de recarregar, em vez de deixar a página em branco. Isso não pega falha de **parse** do bundle (ex: JS incompatível com um navegador muito antigo — ver seção de PWA acima) porque nesse caso nenhum JS roda; cobre exceção de runtime, promise rejeitada sem handler, e erro de render React.

Como os três arquivos (`sentry.ts`, `init-sentry.tsx`, `global-error.tsx`) são duplicados por app — mesmo padrão de duplicação do resto do frontend (ver seção acima) — qualquer mudança de comportamento (ex: adicionar tags, sample rate, integrações) precisa ser replicada manualmente nos três.

## Design tokens

Paleta clara/escura via variáveis CSS + Tailwind v4 (`@theme inline`), com convenção explícita de nunca usar cor hexadecimal direto nos componentes — sempre pelos tokens semânticos definidos globalmente.
