/**
 * Único ponto de leitura de variáveis de ambiente do backend.
 * Nenhum outro arquivo deve ler `process.env` diretamente — assim,
 * quando uma variável nova for necessária, este é o único lugar que muda.
 */

function readPort(): number {
  const raw = process.env.PORT ?? '3000';
  const parsed = Number(raw);

  if (Number.isNaN(parsed)) {
    throw new Error(`PORT inválida: "${raw}" não é um número.`);
  }

  return parsed;
}

function readDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    throw new Error('DATABASE_URL não definida. Veja apps/backend/.env.example.');
  }

  return raw;
}

function readJwtSecret(): string {
  const raw = process.env.JWT_SECRET;

  if (!raw) {
    throw new Error('JWT_SECRET não definida. Veja apps/backend/.env.example.');
  }

  return raw;
}

function readCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;

  if (!raw) {
    throw new Error('CORS_ORIGINS não definida. Veja apps/backend/.env.example.');
  }

  return raw.split(',').map((origin) => origin.trim());
}

export const env = {
  port: readPort(),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: readDatabaseUrl(),
  jwtSecret: readJwtSecret(),
  corsOrigins: readCorsOrigins(),
  // Sem token, createFileStorage() cai pra disco local — só é obrigatória
  // quando quisermos de fato usar o Vercel Blob (ver file-storage.ts).
  // São dois tokens porque são dois stores diferentes na Vercel: um
  // `public` (foto de perfil, logo) e um `private` (documento de KYC) —
  // o Blob rejeita gravar com access que não bate com o tipo do store.
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN,
  blobDocumentsToken: process.env.BLOB_DOCUMENTS_TOKEN,
  // Sem essas duas, createEmailSender() cai pro ConsoleEmailSender (loga o
  // link em vez de mandar e-mail) — obrigatórias em produção, ver
  // create-email-sender.ts.
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'Pronto <onboarding@resend.dev>',
  // Sem isso, createGoogleTokenVerifier() cai pra fora do ar em produção —
  // ver create-google-token-verifier.ts.
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  // Opcional em qualquer ambiente — sem isso, initSentry() não faz nada e
  // erro 500 continua só no console.error de sempre (ver config/sentry.ts).
  // Diferente de Resend/Google, não trava o boot em produção: rastreio de
  // erro é importante, mas sua ausência não é um risco de segurança/perda
  // de dado como os outros dois.
  sentryDsn: process.env.SENTRY_DSN,
  // Par VAPID do Web Push — opcionais como o Sentry: sem eles,
  // sendPushToUser() vira no-op (ver push/send-push-notification.ts).
  // Notificação é um complemento, não um caminho crítico do produto.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT,
};
