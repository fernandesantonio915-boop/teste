import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";

export default async function Processo({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession("processos");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await withTenant(s.companyId, async (db) => {
    const p = (await db.query("SELECT * FROM processes WHERE id=$1", [id])).rows[0];
    if (!p) return null;
    return { p, steps: (await db.query("SELECT * FROM process_steps WHERE process_id=$1 ORDER BY position", [id])).rows };
  });
  if (!d) notFound();
  return (<>
    <div className="top"><div><h1>{d.p.name}</h1><p>{d.steps.length} etapas, na ordem em que devem ser seguidas.</p></div></div>
    <div className="section"><ol className="steps">{d.steps.map((st) => (
      <li key={st.id}><span className="num">{st.position}</span><div><b>{st.title}</b><br /><span className="muted">{st.description}</span>
        {st.checklist.length > 0 && <ul>{st.checklist.map((c: string) => <li key={c} style={{ display: "list-item", padding: 0, border: 0 }}>{c}</li>)}</ul>}</div></li>))}</ol></div></>);
}
