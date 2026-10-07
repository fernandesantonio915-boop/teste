import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { Empty, brl } from "@/components/ui";

export default async function Clientes() {
  const s = await requireSession("clientes");
  const rows = await withTenant(s.companyId, async (db) => (await db.query(`
    SELECT c.id,c.name,c.email,c.phone,
      (SELECT count(*)::int FROM orders o WHERE o.customer_id=c.id) orders,
      (SELECT coalesce(sum(total_cents),0)::int FROM orders o WHERE o.customer_id=c.id) ltv,
      (SELECT count(*)::int FROM warranties w WHERE w.customer_id=c.id) warranties,
      (SELECT count(*)::int FROM returns r WHERE r.customer_id=c.id) returns
    FROM customers c ORDER BY c.created_at DESC LIMIT 200`)).rows);
  return (<>
    <div className="top"><div><h1>Clientes</h1><p>Visão do cliente com pedidos, garantias e devoluções no mesmo lugar.</p></div></div>
    <div className="section">{rows.length === 0 ? <Empty title="Nenhum cliente ainda">Clientes aparecem aqui quando você cria garantias ou devoluções (e, depois, pela integração com a Yampi).</Empty> :
      <table className="table"><thead><tr><th>Cliente</th><th>Contato</th><th>Pedidos</th><th>Valor comprado</th><th>Garantias</th><th>Devoluções</th></tr></thead><tbody>
        {rows.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td>{c.email ?? "—"}<br /><span className="muted">{c.phone ?? ""}</span></td><td>{c.orders}</td><td>{c.ltv ? brl(c.ltv) : "—"}</td><td>{c.warranties}</td><td>{c.returns}</td></tr>)}
      </tbody></table>}</div></>);
}
