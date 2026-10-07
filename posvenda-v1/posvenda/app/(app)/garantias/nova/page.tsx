import { requireSession } from "@/lib/session";
import { createWarrantyAction } from "@/app/actions";
import { WARRANTY_CATEGORIES } from "@/lib/workflow";
import { Banner } from "@/components/ui";

export default async function NovaGarantia({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireSession("garantias");
  const { erro } = await searchParams;
  return (<>
    <div className="top"><div><h1>Nova garantia</h1><p>Registre o cliente, o pedido e o problema relatado.</p></div></div>
    <Banner erro={erro} />
    <form action={createWarrantyAction} className="form" style={{ maxWidth: 820 }}>
      <div className="box"><h3>Cliente</h3><div className="form">
        <div className="field"><label htmlFor="customer_name">Nome</label><input id="customer_name" name="customer_name" className="input" required /></div>
        <div className="two"><div className="field"><label htmlFor="customer_email">E-mail</label><input id="customer_email" name="customer_email" type="email" className="input" /></div>
          <div className="field"><label htmlFor="customer_phone">Telefone</label><input id="customer_phone" name="customer_phone" className="input" /></div></div></div></div>
      <div className="box"><h3>Pedido</h3><div className="form">
        <div className="three"><div className="field"><label htmlFor="order_number">Número do pedido</label><input id="order_number" name="order_number" className="input" required /></div>
          <div className="field"><label htmlFor="order_date">Data da compra</label><input id="order_date" name="order_date" type="date" className="input" /></div>
          <div className="field"><label htmlFor="total">Valor (R$)</label><input id="total" name="total" className="input" placeholder="289,00" inputMode="decimal" /></div></div>
        <div className="two"><div className="field"><label htmlFor="product">Produto</label><input id="product" name="product" className="input" required /></div>
          <div className="field"><label htmlFor="quantity">Quantidade</label><input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="input" /></div></div>
        <div className="two"><div className="field"><label htmlFor="tracking_code">Código de rastreio</label><input id="tracking_code" name="tracking_code" className="input" /></div>
          <div className="field"><label htmlFor="carrier">Transportadora</label><input id="carrier" name="carrier" className="input" /></div></div></div></div>
      <div className="box"><h3>Problema</h3><div className="form">
        <div className="field"><label htmlFor="category">Categoria</label><select id="category" name="category" className="input">{WARRANTY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="description">Descrição</label><textarea id="description" name="description" className="input" required /></div>
        <p className="hint" style={{ margin: 0 }}>Upload de fotos e vídeos entra com o storage (próxima etapa). [NECESSÁRIO CONFIGURAR] bucket e credenciais.</p></div></div>
      <div><button className="btn">Criar garantia</button></div>
    </form></>);
}
