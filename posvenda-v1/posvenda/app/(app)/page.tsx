import Link from "next/link";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { can } from "@/lib/permissions";
import { taskAction } from "@/app/actions";
import { Empty, dt } from "@/components/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ negado?: string }> }) {
  const s = await requireSession("dashboard");
  const { negado } = await searchParams;
  const d = await withTenant(s.companyId, async (db) => {
    const w = (await db.query(`SELECT
        count(*) FILTER (WHERE status <> 'concluido') open,
        count(*) FILTER (WHERE status = 'aguardando_cliente') waiting_customer,
        count(*) FILTER (WHERE status = 'concluido' AND updated_at >= date_trunc('month', now())) done_month,
        count(*) FILTER (WHERE status <> 'concluido' AND created_at >= now() - interval '7 days') new_week FROM warranties`)).rows[0];
    const r = (await db.query("SELECT count(*) FILTER (WHERE status NOT IN ('concluida','recusada')) open FROM returns")).rows[0];
    const tasks = (await db.query(`SELECT t.id,t.title,t.body,t.status,t.ref_type,t.ref_id, u.name assignee FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to
        WHERE t.status <> 'done' AND (t.assigned_role IS NULL OR t.assigned_role = $1 OR $1 IN ('owner','admin')) ORDER BY t.created_at DESC LIMIT 8`, [s.role])).rows;
    const recent = (await db.query(`(SELECT e.created_at, e.message, 'Garantia #'||w.number label, '/garantias/'||w.id href, u.name actor FROM warranty_events e JOIN warranties w ON w.id=e.warranty_id LEFT JOIN users u ON u.id=e.actor_id)
        UNION ALL (SELECT e.created_at, e.message, 'Devolução #'||r.number, '/devolucoes/'||r.id, u.name FROM return_events e JOIN returns r ON r.id=e.return_id LEFT JOIN users u ON u.id=e.actor_id)
        ORDER BY created_at DESC LIMIT 8`)).rows;
    return { w, r, tasks, recent };
  });
  return (<>
    <div className="top"><div><h1>Visão geral</h1><p>Controle o pós-venda em um só lugar.</p></div></div>
    {negado && <div className="banner err" role="alert">Seu perfil não tem acesso a essa área.</div>}
    <div className="cards">
      <div className="card"><label>Garantias abertas</label><strong>{d.w.open}</strong><span className="hint">{d.w.new_week} criadas nos últimos 7 dias</span></div>
      <div className="card"><label>Devoluções abertas</label><strong>{d.r.open}</strong><span className="hint">em andamento</span></div>
      <div className="card"><label>Aguardando cliente</label><strong>{d.w.waiting_customer}</strong><span className="hint">garantias</span></div>
      <div className="card"><label>Garantias concluídas no mês</label><strong>{d.w.done_month}</strong><span className="hint">mês atual</span></div>
    </div>
    <div className="section"><div className="head"><h2>Ações necessárias</h2></div>
      {d.tasks.length === 0 ? <Empty title="Nada pendente">Quando um produto for recebido ou algo precisar de você, aparece aqui.</Empty> :
      <table className="table"><thead><tr><th>O que precisa ser feito</th><th>Responsável</th><th></th></tr></thead><tbody>
        {d.tasks.map((t) => (<tr key={t.id}>
          <td><b>{t.title}</b><br /><span className="muted">{t.body}</span></td>
          <td>{t.assignee ?? <span className="muted">Sem responsável</span>}</td>
          <td><div className="actions" style={{ justifyContent: "flex-end" }}>
            {t.ref_id && <Link className="btn light sm" href={`/${t.ref_type === "return" ? "devolucoes" : "garantias"}/${t.ref_id}`}>Abrir</Link>}
            {t.status === "open" && <form action={taskAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="claim" /><button className="btn light sm">Assumir</button></form>}
            <form action={taskAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="done" /><button className="btn sm">Marcar como resolvido</button></form>
          </div></td></tr>))}
      </tbody></table>}
    </div>
    <div className="section"><div className="head"><h2>Atividade recente</h2></div>
      {d.recent.length === 0 ? <Empty title="Sem atividade ainda">{can(s.role, "garantias") ? <Link className="btn" href="/garantias/nova">Criar a primeira garantia</Link> : null}</Empty> :
      <table className="table"><tbody>{d.recent.map((e, i) => (<tr key={i}>
        <td className="muted" style={{ width: 130 }}>{dt(e.created_at)}</td>
        <td><Link href={e.href}><b>{e.label}</b></Link><br /><span className="muted">{e.message}{e.actor ? ` · ${e.actor}` : ""}</span></td></tr>))}</tbody></table>}
    </div>
  </>);
}
