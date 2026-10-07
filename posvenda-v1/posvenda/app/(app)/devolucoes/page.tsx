import Link from "next/link";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { RETURN_STATUS } from "@/lib/workflow";
import { Status, Empty, brl } from "@/components/ui";

export default async function Devolucoes({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const s = await requireSession("devolucoes");
  const { q = "", status = "" } = await searchParams;
  const rows = await withTenant(s.companyId, async (db) => (await db.query(`
    SELECT r.id,r.number,r.status,r.reason,r.carrier,r.refund_cents,c.name customer,o.number onum FROM returns r
    JOIN customers c ON c.id=r.customer_id LEFT JOIN orders o ON o.id=r.order_id
    WHERE ($1='' OR c.name ILIKE '%'||$1||'%' OR o.number ILIKE '%'||$1||'%' OR r.number::text=$1) AND ($2='' OR r.status=$2)
    ORDER BY r.updated_at DESC LIMIT 200`, [q.replace(/[%_]/g, ""), status])).rows);
  return (<>
    <div className="top"><div><h1>Devoluções</h1><p>Acompanhe cada devolução até a conclusão.</p></div><Link className="btn" href="/devolucoes/nova">+ Nova devolução</Link></div>
    <form className="toolbar" method="get">
      <input className="search" name="q" defaultValue={q} placeholder="Buscar pedido ou cliente..." aria-label="Buscar" />
      <select className="filter" name="status" defaultValue={status} aria-label="Status"><option value="">Todos os status</option>
        {Object.entries(RETURN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <button className="btn light">Filtrar</button>
    </form>
    <div className="section">{rows.length === 0 ? <Empty title={q || status ? "Nenhuma devolução encontrada" : "Nenhuma devolução ainda"}>{q || status ? "Tente outro filtro." : "Registre a primeira para acompanhar até o reembolso."}</Empty> :
      <table className="table"><thead><tr><th>Nº</th><th>Pedido</th><th>Cliente</th><th>Motivo</th><th>Reembolso</th><th>Status</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id} className="link"><td><Link className="row-link" href={`/devolucoes/${r.id}`}><b>#{r.number}</b></Link></td><td>#{r.onum ?? "—"}</td><td>{r.customer}</td>
          <td>{r.reason}</td><td>{brl(r.refund_cents)}</td><td><Status table={RETURN_STATUS} value={r.status} /></td></tr>)}
      </tbody></table>}</div></>);
}
