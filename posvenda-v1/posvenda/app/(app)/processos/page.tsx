import Link from "next/link";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { Empty } from "@/components/ui";

export default async function Processos() {
  const s = await requireSession("processos");
  const rows = await withTenant(s.companyId, async (db) => (await db.query(
    "SELECT p.id,p.name,p.kind,count(ps.id)::int steps FROM processes p LEFT JOIN process_steps ps ON ps.process_id=p.id GROUP BY p.id ORDER BY p.created_at")).rows);
  return (<>
    <div className="top"><div><h1>Processos</h1><p>O passo a passo que orienta a equipe.</p></div></div>
    {rows.length === 0 ? <div className="section"><Empty title="Nenhum processo cadastrado" /></div> :
    <div className="processes">{rows.map((p) => <Link key={p.id} href={`/processos/${p.id}`} className="process"><h3>{p.name}</h3><p>{p.steps} etapas</p></Link>)}</div>}
    <p className="hint" style={{ marginTop: 18 }}>Criar e editar processos entra na próxima etapa (hoje são os processos padrão da empresa).</p></>);
}
