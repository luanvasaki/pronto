import { sql } from 'drizzle-orm';
import { Request, Response } from 'express';
import { db } from '../../db/client';

/**
 * Confirma que o processo está de pé E que o banco responde — usado
 * por load balancer e monitoramento. Sem a checagem do banco, um
 * monitor de uptime nesse endpoint reportaria "tudo bem" mesmo com o
 * Postgres inacessível (processo Node de pé não significa app
 * funcional).
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  try {
    await db.execute(sql`select 1`);
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
}
