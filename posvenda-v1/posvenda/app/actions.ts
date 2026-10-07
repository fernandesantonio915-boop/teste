"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { withTenant, findUserForLogin, audit, type Role } from "@/lib/db";
import { createSession, destroySession, requireSession } from "@/lib/session";
import { canTransition, WARRANTY_STATUS, RETURN_STATUS } from "@/lib/workflow";
import { tooMany } from "@/lib/ratelimit";

const DUMMY = bcrypt.hashSync("nao-existe", 12); // iguala o tempo de resposta quando o e-mail não existe
const back = (path: string, kind: "erro" | "ok", msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
const money = (s?: string) => { if (!s?.trim()) return null; const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
// Mensagem amigável do 1º erro do zod; inclui o campo quando a mensagem é genérica
const firstError = (e: z.ZodError) => { const i = e.issues[0]; return i.message.startsWith("Invalid input") ? `Campo obrigatório ou inválido: ${i.path.join(".")}` : i.message; };
const opt = (s?: string | null) => (s?.trim() ? s.trim() : null);

// ---------- AUTH ----------
export async function loginAction(fd: FormData) {
  const p = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return back("/login", "erro", "Informe e-mail e senha válidos.");
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (tooMany(`login:${ip}:${p.data.email.toLowerCase()}`)) return back("/login", "erro", "Muitas tentativas. Aguarde alguns minutos.");
  const u = await findUserForLogin(p.data.email);
  const ok = await bcrypt.compare(p.data.password, u?.password_hash ?? DUMMY);
  if (!u || !ok || !u.active) return back("/login", "erro", "E-mail ou senha incorretos.");
  await withTenant(u.company_id, (db) => audit(db, u.id, "auth.login", "user", u.id));
  await createSession({ userId: u.id, companyId: u.company_id, name: u.name, role: u.role });
  redirect("/");
}
export async function logoutAction() { await destroySession(); redirect("/login"); }

// ---------- GARANTIAS ----------
const warrantySchema = z.object({
  customer_name: z.string().min(2, "Informe o nome do cliente."), customer_email: z.string().email("E-mail inválido.").or(z.literal("")),
  customer_phone: z.string().optional(), order_number: z.string().min(1, "Informe o número do pedido."),
  order_date: z.string().optional(), product: z.string().min(1, "Informe o produto."), quantity: z.coerce.number().int().min(1).default(1),
  total: z.string().optional(), tracking_code: z.string().optional(), carrier: z.string().optional(),
  category: z.string().min(1), description: z.string().min(5, "Descreva o problema."),
});

export async function createWarrantyAction(fd: FormData) {
  const s = await requireSession("garantias");
  const p = warrantySchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return back("/garantias/nova", "erro", firstError(p.error));
  const d = p.data; const total = money(d.total);
  if (Number.isNaN(total)) return back("/garantias/nova", "erro", "Valor do pedido inválido.");

  const id = await withTenant(s.companyId, async (db) => {
    const email = opt(d.customer_email);
    const cust = email
      ? (await db.query(`INSERT INTO customers (company_id,name,email,phone) VALUES (app_company_id(),$1,$2,$3)
          ON CONFLICT (company_id, lower(email)) WHERE email IS NOT NULL DO UPDATE SET name=EXCLUDED.name, phone=COALESCE(EXCLUDED.phone, customers.phone) RETURNING id`, [d.customer_name, email, opt(d.customer_phone)])).rows[0].id
      : (await db.query("INSERT INTO customers (company_id,name,phone) VALUES (app_company_id(),$1,$2) RETURNING id", [d.customer_name, opt(d.customer_phone)])).rows[0].id;
    const order = (await db.query(`INSERT INTO orders (company_id,customer_id,number,ordered_at,product,quantity,total_cents,tracking_code,carrier)
        VALUES (app_company_id(),$1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (company_id, number) DO UPDATE SET product=EXCLUDED.product RETURNING id`,
      [cust, d.order_number.replace(/^#/, ""), opt(d.order_date), d.product, d.quantity, total, opt(d.tracking_code), opt(d.carrier)])).rows[0].id;
    const n = (await db.query("SELECT next_seq('warranty') n")).rows[0].n;
    const w = (await db.query(`INSERT INTO warranties (company_id,number,customer_id,order_id,category,description,created_by,assigned_to,next_action)
        VALUES (app_company_id(),$1,$2,$3,$4,$5,$6,$6,'Iniciar atendimento') RETURNING id`, [n, cust, order, d.category, d.description, s.userId])).rows[0].id;
    await db.query("INSERT INTO warranty_events (company_id,warranty_id,actor_id,type,message) VALUES (app_company_id(),$1,$2,'created','Garantia criada.')", [w, s.userId]);
    await audit(db, s.userId, "warranty.created", "warranty", w, { number: n });
    return w as string;
  });
  redirect(`/garantias/${id}?ok=${encodeURIComponent("Garantia criada.")}`);
}

export async function changeWarrantyStatusAction(fd: FormData) {
  const s = await requireSession("garantias");
  const id = String(fd.get("id")), to = String(fd.get("to"));
  const res = await withTenant(s.companyId, async (db) => {
    const w = (await db.query("SELECT number,status FROM warranties WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!w) return "Garantia não encontrada.";
    if (!canTransition(WARRANTY_STATUS, w.status, to)) return `Não é possível ir de "${WARRANTY_STATUS[w.status].label}" para "${WARRANTY_STATUS[to]?.label ?? to}".`;
    await db.query("UPDATE warranties SET status=$2, updated_at=now() WHERE id=$1", [id, to]);
    await db.query("INSERT INTO warranty_events (company_id,warranty_id,actor_id,type,message) VALUES (app_company_id(),$1,$2,'status',$3)",
      [id, s.userId, `Status alterado: ${WARRANTY_STATUS[w.status].label} → ${WARRANTY_STATUS[to].label}.`]);
    await audit(db, s.userId, "warranty.status_changed", "warranty", id, { from: w.status, to });
    if (to === "recebido")
      await db.query(`INSERT INTO tasks (company_id,title,body,ref_type,ref_id,assigned_role,created_by)
        VALUES (app_company_id(),$1,'Produto recebido. Fazer a análise física e registrar a decisão.','warranty',$2,'operador',$3)`, [`Produto da garantia #${w.number} recebido`, id, s.userId]);
    return null;
  });
  back(`/garantias/${id}`, res ? "erro" : "ok", res ?? "Status atualizado.");
}

export async function addWarrantyNoteAction(fd: FormData) {
  const s = await requireSession("garantias");
  const id = String(fd.get("id")), msg = String(fd.get("message") ?? "").trim();
  if (msg.length < 2) return back(`/garantias/${id}`, "erro", "Escreva a anotação.");
  await withTenant(s.companyId, async (db) => {
    await db.query("INSERT INTO warranty_events (company_id,warranty_id,actor_id,type,message) SELECT app_company_id(),id,$2,'note',$3 FROM warranties WHERE id=$1", [id, s.userId, msg]);
    await db.query("UPDATE warranties SET updated_at=now() WHERE id=$1", [id]);
    await audit(db, s.userId, "warranty.note_added", "warranty", id);
  });
  back(`/garantias/${id}`, "ok", "Anotação registrada.");
}

// ---------- DEVOLUÇÕES ----------
const returnSchema = z.object({
  customer_name: z.string().min(2, "Informe o nome do cliente."), customer_email: z.string().email("E-mail inválido.").or(z.literal("")),
  customer_phone: z.string().optional(), order_number: z.string().min(1, "Informe o número do pedido."), product: z.string().optional(),
  reason: z.string().min(1), carrier: z.string().optional(), refund: z.string().optional(),
});
export async function createReturnAction(fd: FormData) {
  const s = await requireSession("devolucoes");
  const p = returnSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return back("/devolucoes/nova", "erro", firstError(p.error));
  const d = p.data; const refund = money(d.refund);
  if (Number.isNaN(refund)) return back("/devolucoes/nova", "erro", "Valor inválido.");
  const id = await withTenant(s.companyId, async (db) => {
    const email = opt(d.customer_email);
    const cust = email
      ? (await db.query(`INSERT INTO customers (company_id,name,email,phone) VALUES (app_company_id(),$1,$2,$3)
          ON CONFLICT (company_id, lower(email)) WHERE email IS NOT NULL DO UPDATE SET name=EXCLUDED.name RETURNING id`, [d.customer_name, email, opt(d.customer_phone)])).rows[0].id
      : (await db.query("INSERT INTO customers (company_id,name,phone) VALUES (app_company_id(),$1,$2) RETURNING id", [d.customer_name, opt(d.customer_phone)])).rows[0].id;
    const num = d.order_number.replace(/^#/, "");
    const order = (await db.query(`INSERT INTO orders (company_id,customer_id,number,product) VALUES (app_company_id(),$1,$2,$3)
        ON CONFLICT (company_id, number) DO UPDATE SET number=EXCLUDED.number RETURNING id`, [cust, num, opt(d.product)])).rows[0].id;
    const n = (await db.query("SELECT next_seq('return') n")).rows[0].n;
    const r = (await db.query(`INSERT INTO returns (company_id,number,customer_id,order_id,reason,carrier,refund_cents,created_by)
        VALUES (app_company_id(),$1,$2,$3,$4,$5,$6,$7) RETURNING id`, [n, cust, order, d.reason, opt(d.carrier), refund, s.userId])).rows[0].id;
    await db.query("INSERT INTO return_events (company_id,return_id,actor_id,type,message) VALUES (app_company_id(),$1,$2,'created','Devolução solicitada.')", [r, s.userId]);
    await audit(db, s.userId, "return.created", "return", r, { number: n });
    return r as string;
  });
  redirect(`/devolucoes/${id}?ok=${encodeURIComponent("Devolução registrada.")}`);
}

export async function changeReturnStatusAction(fd: FormData) {
  const s = await requireSession("devolucoes");
  const id = String(fd.get("id")), to = String(fd.get("to"));
  const res = await withTenant(s.companyId, async (db) => {
    const r = (await db.query("SELECT status FROM returns WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!r) return "Devolução não encontrada.";
    if (!canTransition(RETURN_STATUS, r.status, to)) return "Transição de status não permitida.";
    await db.query("UPDATE returns SET status=$2, updated_at=now(), received_at = CASE WHEN $2='recebida' THEN current_date ELSE received_at END WHERE id=$1", [id, to]);
    await db.query("INSERT INTO return_events (company_id,return_id,actor_id,type,message) VALUES (app_company_id(),$1,$2,'status',$3)",
      [id, s.userId, `Status alterado: ${RETURN_STATUS[r.status].label} → ${RETURN_STATUS[to].label}.`]);
    await audit(db, s.userId, "return.status_changed", "return", id, { from: r.status, to });
    return null;
  });
  back(`/devolucoes/${id}`, res ? "erro" : "ok", res ?? "Status atualizado.");
}

// ---------- TAREFAS ("ação necessária") ----------
export async function taskAction(fd: FormData) {
  const s = await requireSession();
  const id = String(fd.get("id")), op = String(fd.get("op"));
  await withTenant(s.companyId, async (db) => {
    if (op === "claim") await db.query("UPDATE tasks SET status='claimed', assigned_to=$2 WHERE id=$1 AND status='open'", [id, s.userId]);
    if (op === "done") await db.query("UPDATE tasks SET status='done', resolved_at=now(), assigned_to=COALESCE(assigned_to,$2) WHERE id=$1 AND status<>'done'", [id, s.userId]);
    await audit(db, s.userId, `task.${op}`, "task", id);
  });
  redirect("/");
}

// ---------- USUÁRIOS ----------
const userSchema = z.object({ name: z.string().min(2), email: z.string().email("E-mail inválido."), role: z.enum(["admin", "atendente", "marketing", "operador"]), password: z.string().min(10, "A senha precisa ter ao menos 10 caracteres.") });
export async function createUserAction(fd: FormData) {
  const s = await requireSession("config");
  const p = userSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return back("/configuracoes", "erro", firstError(p.error));
  const hash = await bcrypt.hash(p.data.password, 12);
  try {
    await withTenant(s.companyId, async (db) => {
      const u = (await db.query("INSERT INTO users (company_id,name,email,password_hash,role) VALUES (app_company_id(),$1,$2,$3,$4) RETURNING id", [p.data.name, p.data.email, hash, p.data.role as Role])).rows[0].id;
      await audit(db, s.userId, "user.created", "user", u, { role: p.data.role });
    });
  } catch (e: any) { if (e.code === "23505") return back("/configuracoes", "erro", "Já existe um usuário com esse e-mail."); throw e; }
  back("/configuracoes", "ok", "Usuário criado.");
}
