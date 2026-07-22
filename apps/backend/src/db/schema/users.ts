import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Login é email + senha, ou Google (`googleId`) — `passwordHash` fica
 * nulo pra contas só-Google. `phone`/`phoneVerifiedAt` existem pra uma
 * fase futura de confirmação por celular; hoje nada os popula.
 *
 * `email` fica nullable no banco (não `.notNull()`) de propósito: é
 * obrigatório sempre que a aplicação cria um usuário de verdade
 * (register/login/google-login exigem e preenchem), mas várias fixtures
 * de teste de outros domínios inserem usuário só com `phone` — forçar
 * NOT NULL aqui quebraria todas elas por uma garantia que a aplicação
 * já dá sozinha.
 */
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'banned']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    passwordHash: varchar('password_hash', { length: 255 }),
    googleId: varchar('google_id', { length: 255 }),
    // Preenchido uma vez, na criação da conta via Google — nunca
    // atualizado depois (se a foto do Google mudar, não seguimos).
    // Usado como sugestão de foto de perfil do trabalhador.
    googlePhotoUrl: varchar('google_photo_url', { length: 500 }),
    // Aceite da tela cheia de /cadastro/termos (não mais no registro —
    // ver accept-terms.ts e modules/consent-documents).
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
    // Qual versão de consent_documents (type 'platform_terms') foi
    // aceita — nulo pras contas criadas antes desse campo existir, já
    // que não dá pra saber retroativamente qual versão elas viram.
    termsVersion: varchar('terms_version', { length: 20 }),
    // IP e user-agent no momento do aceite — evidência técnica exigida
    // pelo próprio Termo de Uso (seção "Evidência do aceite, governança
    // de versões e canais"), pra provar numa disputa que o usuário teve
    // acesso ao conteúdo e clicou aceitar. Nulo pras contas anteriores a
    // esse campo existir, mesma razão do termsVersion acima.
    termsIpAddress: varchar('terms_ip_address', { length: 64 }),
    termsUserAgent: text('terms_user_agent'),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    status: userStatusEnum('status').notNull().default('active'),
    // Sem self-serve pra virar admin — só concedido via update direto
    // no banco (ver README de operações). É deliberadamente rígido:
    // aprovar KYC e verificação de empresa é ação sensível.
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneUnique: uniqueIndex('users_phone_unique').on(table.phone),
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
    googleIdUnique: uniqueIndex('users_google_id_unique').on(table.googleId),
  }),
);
