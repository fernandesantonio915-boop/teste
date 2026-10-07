import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { withTenant, closePool, audit } from "../lib/db";
import { canTransition, WARRANTY_STATUS, RETURN_STATUS } from "../lib/workflow";
import { can } from "../lib/permissions";

const owner = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
let A = "", B = "";

before(async () => {
  await owner.connect();
  const mk = async (slug: string) => (await owner.query("INSERT INTO companies (name,slug) VALUES ($1,$1) RETURNING id", [slug + "-" + Date.now()])).rows[0].id as string;
  A = await mk("loja-a"); B = await mk("loja-b");
  await owner.query("INSERT INTO customers (company_id,name,email) VALUES ($1,'Cliente A','a@x.com'),($2,'Cliente B','b@x.com')", [A, B]);
});
after(async () => {
  await owner.query("DELETE FROM companies WHERE id IN ($1,$2)", [A, B]);
  await owner.end(); await closePool();
});

test("empresa A só enxerga os próprios clientes", async () => {
  const rows = await withTenant(A, async (db) => (await db.query("SELECT name FROM customers")).rows);
  assert.deepEqual(rows.map((r) => r.name), ["Cliente A"]);
});

test("SELECT com filtro explícito da outra empresa não devolve nada", async () => {
  const n = await withTenant(A, async (db) => (await db.query("SELECT 1 FROM customers WHERE company_id=$1", [B])).rowCount);
  assert.equal(n, 0);
});

test("sem tenant definido, nenhuma linha é visível", async () => {
  const { Pool } = await import("pg");
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  assert.equal((await p.query("SELECT 1 FROM customers")).rowCount, 0);
  await p.end();
});

test("A não consegue inserir dado em nome de B", async () => {
  await assert.rejects(withTenant(A, (db) => db.query("INSERT INTO customers (company_id,name) VALUES ($1,'invasor')", [B])), /row-level security/);
});

test("A não consegue alterar nem apagar dado de B", async () => {
  const r = await withTenant(A, async (db) => ({
    u: (await db.query("UPDATE customers SET name='hack' WHERE company_id=$1", [B])).rowCount,
    d: (await db.query("DELETE FROM customers WHERE company_id=$1", [B])).rowCount,
  }));
  assert.deepEqual(r, { u: 0, d: 0 });
  const still = (await owner.query("SELECT name FROM customers WHERE company_id=$1", [B])).rows[0].name;
  assert.equal(still, "Cliente B");
});

test("numeração sequencial é independente por empresa", async () => {
  const a1 = await withTenant(A, async (db) => (await db.query("SELECT next_seq('warranty') n")).rows[0].n);
  const a2 = await withTenant(A, async (db) => (await db.query("SELECT next_seq('warranty') n")).rows[0].n);
  const b1 = await withTenant(B, async (db) => (await db.query("SELECT next_seq('warranty') n")).rows[0].n);
  assert.deepEqual([a1, a2, b1], [1, 2, 1]);
});

test("auditoria é append-only para a aplicação", async () => {
  await withTenant(A, (db) => audit(db, null, "teste.criado"));
  await assert.rejects(withTenant(A, (db) => db.query("UPDATE audit_logs SET action='x'")), /permission denied/);
  await assert.rejects(withTenant(A, (db) => db.query("DELETE FROM audit_logs")), /permission denied/);
});

test("transições de status são controladas", () => {
  assert.ok(canTransition(WARRANTY_STATUS, "nova", "em_atendimento"));
  assert.ok(!canTransition(WARRANTY_STATUS, "nova", "concluido"));
  assert.ok(!canTransition(WARRANTY_STATUS, "concluido", "nova"));
  assert.ok(canTransition(RETURN_STATUS, "solicitada", "aprovada"));
  assert.ok(!canTransition(RETURN_STATUS, "solicitada", "reembolsada"));
});

test("permissões por papel", () => {
  assert.ok(can("owner", "config"));
  assert.ok(!can("atendente", "config"));
  assert.ok(!can("marketing", "garantias"));
  assert.ok(can("operador", "devolucoes"));
});
