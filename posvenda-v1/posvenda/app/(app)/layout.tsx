import Link from "next/link";
import { requireSession } from "@/lib/session";
import { can, ROLE_LABEL, type Module } from "@/lib/permissions";
import { logoutAction } from "@/app/actions";
import { NavLink } from "@/components/nav-link";

const NAV: { group: string; items: { href: string; label: string; icon: string; m: Module }[] }[] = [
  { group: "Operação", items: [{ href: "/", label: "Visão geral", icon: "⌂", m: "dashboard" }] },
  { group: "Pós-venda", items: [
    { href: "/garantias", label: "Garantias", icon: "▣", m: "garantias" },
    { href: "/devolucoes", label: "Devoluções", icon: "↩", m: "devolucoes" },
    { href: "/processos", label: "Processos", icon: "✓", m: "processos" } ] },
  { group: "CRM", items: [{ href: "/clientes", label: "Clientes", icon: "☺", m: "clientes" }] },
  { group: "Conta", items: [{ href: "/configuracoes", label: "Configurações", icon: "⚙", m: "config" }] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return (
    <div className="app">
      <aside className="side">
        <Link href="/" className="brand">Garantia<span>OS</span></Link>
        <nav className="nav">
          {NAV.map((g) => { const items = g.items.filter((i) => can(s.role, i.m)); return items.length ? (
            <div key={g.group}><small>{g.group}</small>{items.map((i) => <NavLink key={i.href} {...i} />)}</div>) : null; })}
        </nav>
        <div className="me"><b>{s.name}</b>{ROLE_LABEL[s.role]}
          <form action={logoutAction}><button>Sair</button></form></div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
