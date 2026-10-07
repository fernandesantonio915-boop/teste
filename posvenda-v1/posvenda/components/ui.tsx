import type { Tone } from "@/lib/workflow";

export function Status({ table, value }: { table: Record<string, { label: string; tone: Tone }>; value: string }) {
  const s = table[value];
  return <span className={`tag ${s?.tone ?? "gray"}`}>{s?.label ?? value}</span>;
}
export function Banner({ erro, ok }: { erro?: string; ok?: string }) {
  if (erro) return <div className="banner err" role="alert">{erro}</div>;
  if (ok) return <div className="banner ok" role="status">{ok}</div>;
  return null;
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}
export const brl = (cents: number | null) => cents == null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dt = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const day = (d: Date | string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
