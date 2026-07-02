# worker

PWA do trabalhador (Next.js App Router) — instalável direto do navegador, sem loja de app.

## Rodando localmente

```bash
npm install --workspace=apps/worker   # a partir da raiz do monorepo
npm run dev --workspace=apps/worker
```

Abre em `http://localhost:3000` (ou outra porta, se a do backend já estiver ocupada).

## PWA

- `src/app/manifest.ts` gera o `/manifest.webmanifest` (nome, ícones, cor de tema).
- `public/sw.js` é o service worker — hoje só o mínimo pra instalabilidade, sem estratégia de cache.
- Ícones em `public/icons/` são placeholder — a identidade visual real ainda não existe.

Pra testar a instalação: abra no Chrome desktop/Android e procure o ícone de instalar na barra de endereço; no Safari iOS, use "Adicionar à Tela de Início" no menu de compartilhar.

## Lint e build

```bash
npm run lint --workspace=apps/worker
npm run build --workspace=apps/worker
```
