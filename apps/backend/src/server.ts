import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`[shift-backend] rodando em http://localhost:${env.port}`);
});
