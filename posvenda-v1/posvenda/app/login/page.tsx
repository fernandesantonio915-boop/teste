import { loginAction } from "@/app/actions";
import { Banner } from "@/components/ui";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <div className="login"><div className="box">
      <div className="brand" style={{ padding: 0, marginBottom: 20 }}>Garantia<span>OS</span></div>
      <h1>Entrar</h1><p className="muted" style={{ marginTop: 0 }}>Acesse o ambiente da sua empresa.</p>
      <Banner erro={erro} />
      <form action={loginAction} className="form">
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" required autoComplete="username" /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" name="password" type="password" className="input" required autoComplete="current-password" /></div>
        <button className="btn full">Entrar</button>
      </form>
    </div></div>
  );
}
