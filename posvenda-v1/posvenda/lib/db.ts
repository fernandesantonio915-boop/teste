import { Pool, PoolClient } from "pg";

declare global { var __pool: Pool | undefined; }

function pool(): Pool {
  if (!globalThis.__pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida [NECESSÁRIO CONFIGURAR]");
    globalThis.__pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return globalThis.__pool;
}

/**
 * ÚNICA forma de acessar dados de uma empresa.
 * Abre transação, fixa app.company_id (set_config local) e o Postgres aplica RLS em toda query.
 * Mesmo que alguém esqueça um "WHERE company_id", o banco não devolve linhas de outra empresa.
 */
export async function withTenant<T>(companyId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Login: busca usuário por e-mail antes de conhecer a empresa (função SECURITY DEFINER restrita). */
export async function findUserForLogin(email: string) {
  const r = await pool().query("SELECT * FROM auth_find_user($1)", [email]);
  return r.rows[0] as { id: string; company_id: string; name: string; role: Role; password_hash: string; active: boolean } | undefined;
}

export async function closePool() { await globalThis.__pool?.end(); globalThis.__pool = undefined; }

export type Role = "owner" | "admin" | "atendente" | "marketing" | "operador";

export async function audit(db: PoolClient, actorId: string | null, action: string, entity?: string, entityId?: string, meta: object = {}) {
  await db.query(
    "INSERT INTO audit_logs (company_id, actor_id, action, entity, entity_id, meta) VALUES (app_company_id(), $1, $2, $3, $4, $5)",
    [actorId, action, entity ?? null, entityId ?? null, JSON.stringify(meta)]
  );
}
