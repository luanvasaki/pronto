# shift

Marketplace de contratação de freelancers sob demanda — conecta empresas (bares, restaurantes, buffets, eventos, hotéis) que precisam de staff temporário em poucas horas com trabalhadores disponíveis.

## Estrutura

```
apps/
  backend/    API (Node.js + TypeScript)
  worker/     PWA do trabalhador (Next.js) — instalável via navegador, sem loja de app
  business/   PWA da empresa + painel admin (Next.js) — também instalável via navegador
packages/
  shared/     Tipos TypeScript compartilhados entre os três apps acima
```

Nenhum dos dois frontends é um app nativo (React Native/Expo) — ambos são PWAs para evitar custo e fila de revisão de loja de app nesta fase.

## Status

Em desenvolvimento inicial seguindo o roadmap de 90 dias (fase 1: fundação e modelagem).
