import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/permissions";
import { createUserAction } from "@/app/actions";
import { Banner } from "@/components/ui";

export default async function Config({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const s = await requireSession("config");
  const { erro, ok } = await searchParams;
  const { company, users } = await withTenant(s.companyId, async (db) => ({
    company: (await db.query("SELECT name FROM companies")).rows[0],
    users: (await db.query("SELECT id,name,email,role,active FROM users ORDER BY created_at")).rows }));
  return (<>
    <div className="top"><div><h1>Configurações</h1><p>Empresa e usuários.</p></div></div>
    <Banner erro={erro} ok={ok} />
    <div className="box"><h3>Empresa</h3><div className="kv"><div><small>Empresa</small>{company.name}</div><div><small>Usuários ativos</small>{users.filter((u) => u.active).length}</div></div></div>
    <div className="section"><div className="head"><h2>Usuários</h2></div><table className="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th></tr></thead><tbody>
      {users.map((u) => <tr key={u.id}><td><b>{u.name}</b></td><td>{u.email}</td><td>{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}</td></tr>)}</tbody></table></div>
    <div className="box" style={{ maxWidth: 560 }}><h3>Adicionar usuário</h3>
      <form action={createUserAction} className="form">
        <div className="field"><label htmlFor="name">Nome</label><input id="name" name="name" className="input" required /></div>
        <div className="two"><div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" required /></div>
          <div className="field"><label htmlFor="role">Perfil</label><select id="role" name="role" className="input"><option value="atendente">Atendente</option><option value="operador">Operador</option><option value="marketing">Marketing</option><option value="admin">Administrador</option></select></div></div>
        <div className="field"><label htmlFor="password">Senha inicial (mín. 10 caracteres)</label><input id="password" name="password" type="password" className="input" minLength={10} required autoComplete="new-password" /></div>
        <button className="btn">Criar usuário</button></form></div></>);
}
