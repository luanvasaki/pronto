// Em produção o ambiente injeta as variáveis diretamente (sem .env);
// aqui isso é um no-op silencioso caso o arquivo não exista.
import 'dotenv/config';

import { createApp } from './app';
import { env } from './config/env';
import { initSentry } from './config/sentry';

// Antes de criar o app — se der erro na própria montagem das rotas, já
// tem tracking ativo (quando SENTRY_DSN estiver configurada).
initSentry();

const app = createApp();

app.listen(env.port, () => {
  console.log(`[shift-backend] rodando em http://localhost:${env.port}`);
});
