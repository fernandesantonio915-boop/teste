import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { RETURN_STATUS } from "@/lib/workflow";
import { changeReturnStatusAction } from "@/app/actions";
import { Banner, Status, brl, day, dt } from "@/components/ui";

export default async function Devolucao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const s = await requireSession("devolucoes");
  const { id } = await params; const { erro, ok } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await withTenant(s.companyId, async (db) => {
    const r = (await db.query(`SELECT r.*, c.name cname, c.email cemail, c.phone cphone, o.number onum, o.product FROM returns r JOIN customers c ON c.id=r.customer_id LEFT JOIN orders o ON o.id=r.order_id WHERE r.id=$1`, [id])).rows[0];
    if (!r) return null;
    const ev = (await db.query("SELECT e.*, u.name actor FROM return_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.return_id=$1 ORDER BY e.created_at DESC", [id])).rows;
    return { r, ev };
  });
  if (!d) notFound();
  const { r, ev } = d; const next = RETURN_STATUS[r.status].next;
  return (<>
    <div className="top"><div><h1>Devolução #{r.number}</h1><p>Atualizada em {dt(r.updated_at)}</p></div><Status table={RETURN_STATUS} value={r.status} /></div>
    <Banner erro={erro} ok={ok} />
    <div className="detail"><div>
      <div className="box"><h3>Cliente e pedido</h3><div className="kv">
        <div><small>Cliente</small>{r.cname}</div><div><small>Contato</small>{r.cemail ?? "—"}<br />{r.cphone ?? ""}</div>
        <div><small>Pedido</small>#{r.onum ?? "—"}</div><div><small>Produto</small>{r.product ?? "—"}</div>
        <div><small>Motivo</small>{r.reason}</div><div><small>Reembolso</small>{brl(r.refund_cents)}</div>
        <div><small>Transporte</small>{r.carrier ?? "—"} {r.tracking_code ?? ""}</div><div><small>Recebida em</small>{day(r.received_at)}</div></div></div>
      <div className="box"><h3>Histórico</h3><div className="timeline">{ev.map((e) => (
        <div className="event" key={e.id}><time>{dt(e.created_at)}</time><p><b>{e.message}</b>{e.actor && <><br /><span className="muted">{e.actor}</span></>}</p></div>))}</div></div>
    </div><div><div className="box"><h3>Alterar status</h3>{next.length === 0 ? <p className="muted" style={{ margin: 0 }}>Devolução encerrada.</p> :
      <div className="actions">{next.map((n) => <form key={n} action={changeReturnStatusAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value={n} />
        <button className="btn light sm">{RETURN_STATUS[n].label}</button></form>)}</div>}</div></div></div></>);
}
