import Link from "next/link";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { WARRANTY_STATUS } from "@/lib/workflow";
import { Status, Empty, dt } from "@/components/ui";

export default async function Garantias({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const s = await requireSession("garantias");
  const { q = "", status = "" } = await searchParams;
  const rows = await withTenant(s.companyId, async (db) => (await db.query(`
    SELECT w.id,w.number,w.status,w.category,w.updated_at,c.name customer,o.product FROM warranties w
    JOIN customers c ON c.id=w.customer_id LEFT JOIN orders o ON o.id=w.order_id
    WHERE ($1='' OR c.name ILIKE '%'||$1||'%' OR o.number ILIKE '%'||$1||'%' OR o.product ILIKE '%'||$1||'%' OR w.number::text=$1)
      AND ($2='' OR w.status=$2) ORDER BY w.updated_at DESC LIMIT 200`, [q.replace(/[%_]/g, ""), status])).rows);
  return (<>
    <div className="top"><div><h1>Garantias</h1><p>Todos os atendimentos de garantia.</p></div><Link className="btn" href="/garantias/nova">+ Nova garantia</Link></div>
    <form className="toolbar" method="get">
      <input className="search" name="q" defaultValue={q} placeholder="Buscar pedido, cliente ou produto..." aria-label="Buscar" />
      <select className="filter" name="status" defaultValue={status} aria-label="Status"><option value="">Todos os status</option>
        {Object.entries(WARRANTY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <button className="btn light">Filtrar</button>
    </form>
    <div className="section">{rows.length === 0 ? <Empty title={q || status ? "Nenhuma garantia encontrada" : "Nenhuma garantia ainda"}>{q || status ? "Tente outro filtro." : "Crie a primeira para começar o histórico."}</Empty> :
      <table className="table"><thead><tr><th>Nº</th><th>Cliente</th><th>Produto</th><th>Problema</th><th>Status</th><th>Atualizado</th></tr></thead><tbody>
        {rows.map((w) => <tr key={w.id} className="link">
          <td><Link className="row-link" href={`/garantias/${w.id}`}><b>#{w.number}</b></Link></td><td>{w.customer}</td><td>{w.product ?? "—"}</td><td>{w.category}</td>
          <td><Status table={WARRANTY_STATUS} value={w.status} /></td><td className="muted">{dt(w.updated_at)}</td></tr>)}
      </tbody></table>}</div>
  </>);
}
