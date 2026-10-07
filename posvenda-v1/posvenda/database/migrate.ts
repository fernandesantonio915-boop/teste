import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL não definida [NECESSÁRIO CONFIGURAR]");

async function main() {
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())");
  const done = new Set((await c.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const dir = join(__dirname, "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    await c.query("BEGIN");
    try {
      await c.query(readFileSync(join(dir, f), "utf8"));
      await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await c.query("COMMIT");
      console.log("aplicada:", f);
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  }
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
