import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { WARRANTY_STATUS } from "@/lib/workflow";
import { changeWarrantyStatusAction, addWarrantyNoteAction } from "@/app/actions";
import { Banner, Status, brl, day, dt } from "@/components/ui";

export default async function Garantia({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const s = await requireSession("garantias");
  const { id } = await params; const { erro, ok } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await withTenant(s.companyId, async (db) => {
    const w = (await db.query(`SELECT w.*, c.name cname, c.email cemail, c.phone cphone, o.number onum, o.ordered_at, o.product, o.quantity, o.total_cents, o.tracking_code, o.carrier, u.name assignee
      FROM warranties w JOIN customers c ON c.id=w.customer_id LEFT JOIN orders o ON o.id=w.order_id LEFT JOIN users u ON u.id=w.assigned_to WHERE w.id=$1`, [id])).rows[0];
    if (!w) return null;
    const ev = (await db.query("SELECT e.*, u.name actor FROM warranty_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.warranty_id=$1 ORDER BY e.created_at DESC", [id])).rows;
    return { w, ev };
  });
  if (!d) notFound();
  const { w, ev } = d; const next = WARRANTY_STATUS[w.status].next;
  return (<>
    <div className="top"><div><h1>Garantia #{w.number}</h1><p>Atualizada em {dt(w.updated_at)}</p></div><Status table={WARRANTY_STATUS} value={w.status} /></div>
    <Banner erro={erro} ok={ok} />
    <div className="detail"><div>
      <div className="box"><h3>Cliente e pedido</h3><div className="kv">
        <div><small>Cliente</small>{w.cname}</div><div><small>Contato</small>{w.cemail ?? "—"}<br />{w.cphone ?? ""}</div>
        <div><small>Pedido</small>#{w.onum ?? "—"} · {day(w.ordered_at)}</div><div><small>Produto</small>{w.product ?? "—"} · {w.quantity}x · {brl(w.total_cents)}</div>
        <div><small>Rastreio</small>{w.tracking_code ?? "—"} {w.carrier ? `(${w.carrier})` : ""}</div><div><small>Responsável</small>{w.assignee ?? "—"}</div></div></div>
      <div className="box"><h3>Problema relatado</h3><p style={{ whiteSpace: "pre-wrap" }}>{w.description}</p><span className="tag blue">{w.category}</span></div>
      <div className="box"><h3>Histórico</h3><div className="timeline">{ev.map((e) => (
        <div className="event" key={e.id}><time>{dt(e.created_at)}</time><p><b>{e.message}</b>{e.actor && <><br /><span className="muted">{e.actor}</span></>}</p></div>))}</div></div>
    </div><div>
      <div className="box"><h3>Alterar status</h3>{next.length === 0 ? <p className="muted" style={{ margin: 0 }}>Garantia concluída.</p> :
        <div className="actions">{next.map((n) => <form key={n} action={changeWarrantyStatusAction}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="to" value={n} />
          <button className="btn light sm">{WARRANTY_STATUS[n].label}</button></form>)}</div>}</div>
      <div className="box"><h3>Registrar anotação</h3><form action={addWarrantyNoteAction} className="form"><input type="hidden" name="id" value={w.id} />
        <textarea name="message" className="input" required aria-label="Anotação" placeholder="Ex.: diagnóstico, contato com o cliente, resultado da análise" /><button className="btn full">Registrar</button></form></div>
    </div></div></>);
}
