import { requireSession } from "@/lib/session";
import { createReturnAction } from "@/app/actions";
import { RETURN_REASONS } from "@/lib/workflow";
import { Banner } from "@/components/ui";

export default async function NovaDevolucao({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireSession("devolucoes");
  const { erro } = await searchParams;
  return (<>
    <div className="top"><div><h1>Nova devolução</h1><p>Registre a solicitação do cliente.</p></div></div>
    <Banner erro={erro} />
    <form action={createReturnAction} className="form" style={{ maxWidth: 820 }}>
      <div className="box"><h3>Cliente</h3><div className="form">
        <div className="field"><label htmlFor="customer_name">Nome</label><input id="customer_name" name="customer_name" className="input" required /></div>
        <div className="two"><div className="field"><label htmlFor="customer_email">E-mail</label><input id="customer_email" name="customer_email" type="email" className="input" /></div>
          <div className="field"><label htmlFor="customer_phone">Telefone</label><input id="customer_phone" name="customer_phone" className="input" /></div></div></div></div>
      <div className="box"><h3>Pedido e devolução</h3><div className="form">
        <div className="two"><div className="field"><label htmlFor="order_number">Número do pedido</label><input id="order_number" name="order_number" className="input" required /></div>
          <div className="field"><label htmlFor="product">Produto</label><input id="product" name="product" className="input" /></div></div>
        <div className="three"><div className="field"><label htmlFor="reason">Motivo</label><select id="reason" name="reason" className="input">{RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="field"><label htmlFor="carrier">Transportadora</label><input id="carrier" name="carrier" className="input" /></div>
          <div className="field"><label htmlFor="refund">Valor a reembolsar (R$)</label><input id="refund" name="refund" className="input" inputMode="decimal" /></div></div></div></div>
      <div><button className="btn">Registrar devolução</button></div>
    </form></>);
}
