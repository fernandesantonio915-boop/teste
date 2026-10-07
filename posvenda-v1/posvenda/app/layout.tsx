import "./globals.css";
export const metadata = { title: "GarantiaOS", description: "Pós-venda, CRM e automação para e-commerce" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
