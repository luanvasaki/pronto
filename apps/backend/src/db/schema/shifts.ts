import {
  doublePrecision,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { applications } from './applications';
import { jobs } from './jobs';
import { workerProfiles } from './worker-profiles';

export const shiftStatusEnum = pgEnum('shift_status', [
  'scheduled',
  'checked_in',
  'checked_out',
  'completed',
  'no_show',
  'cancelled',
]);

/**
 * Nasce de uma application aprovada — não existe tabela de convite
 * separada no MVP (ver comentário na explicação da tarefa). job_id e
 * worker_id são denormalizados de application_id só pra leitura
 * rápida ("meus shifts"), não são uma segunda fonte de verdade.
 */
export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workerProfiles.userId),
    status: shiftStatusEnum('status').notNull().default('scheduled'),
    // Cópia do valor da vaga no momento da aprovação. Imutável por
    // convenção (nenhum endpoint expõe edição) — ver nota na tarefa.
    payAmountSnapshot: numeric('pay_amount_snapshot', { precision: 10, scale: 2 }).notNull(),
    checkInAt: timestamp('check_in_at', { withTimezone: true }),
    checkInLat: doublePrecision('check_in_lat'),
    checkInLng: doublePrecision('check_in_lng'),
    // Nulo = empresa ainda não confirmou que o trabalhador chegou —
    // alimenta o alerta "Fulano fez check-in" no sino da empresa (mesmo
    // padrão de applications.workerSeenAt, ver get-notifications.ts) e
    // vira um carimbo de confirmação de verdade (ver confirm-check-in.ts).
    // Não trava o check-out: as duas confirmações são independentes.
    checkInConfirmedAt: timestamp('check_in_confirmed_at', { withTimezone: true }),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    checkOutLat: doublePrecision('check_out_lat'),
    checkOutLng: doublePrecision('check_out_lng'),
    // Nulo = empresa ainda não confirmou a saída — enquanto isso o turno
    // fica em 'checked_out', não 'completed' (ver confirm-check-out.ts).
    // É a confirmação do check-out que dispara a cobrança do turno.
    checkOutConfirmedAt: timestamp('check_out_confirmed_at', { withTimezone: true }),
    // Preenchido quando a empresa opta por não avaliar esse turno — some
    // o formulário de avaliação sem exigir uma nota. Não impede avaliar
    // depois (só é lido quando `ratings.company` ainda está vazio).
    companyRatingSkippedAt: timestamp('company_rating_skipped_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    applicationUnique: uniqueIndex('shifts_application_id_unique').on(table.applicationId),
  }),
);
