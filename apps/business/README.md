# business

PWA da empresa + painel administrativo (Next.js App Router) — instalável direto do navegador, sem loja de app.

## Rodando localmente

```bash
npm install --workspace=apps/business   # a partir da raiz do monorepo
npm run dev --workspace=apps/business
```

Abre em `http://localhost:3200` (porta fixa — precisa bater com `CORS_ORIGINS` do backend).

## PWA

- `src/app/manifest.ts` gera o `/manifest.webmanifest` (nome, ícones, cor de tema).
- `public/sw.js` é o service worker — hoje só o mínimo pra instalabilidade, sem estratégia de cache.
- Ícones em `public/icons/` são placeholder — a identidade visual real ainda não existe.

## Lint e build

```bash
npm run lint --workspace=apps/business
npm run build --workspace=apps/business
```
