// Cria a Eleva como PRIMEIRO TENANT (não hardcoded no sistema) + usuário dono + processos padrão.
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const url = process.env.MIGRATION_DATABASE_URL!;
const email = process.env.SEED_OWNER_EMAIL ?? "antonio@elevacases.com";
const password = process.env.SEED_OWNER_PASSWORD ?? randomBytes(9).toString("base64url");

const GARANTIA = [
  ["Identificar o pedido", "Localizar o pedido pelo número, e-mail ou CPF do cliente.", ["Pedido localizado", "Dados do cliente conferidos"]],
  ["Conferir data da compra", "Verificar se a compra está dentro do prazo de garantia.", ["Data da compra conferida", "Prazo de garantia validado"]],
  ["Identificar produto", "Confirmar modelo e variação do produto comprado.", ["Modelo confirmado"]],
  ["Entender o problema", "Ouvir o cliente e classificar a categoria do problema.", ["Categoria definida"]],
  ["Solicitar fotos e vídeos", "Pedir evidências do defeito antes de qualquer envio.", ["Vídeo do problema recebido", "Fotos do produto recebidas"]],
  ["Diagnóstico inicial", "Tentar resolver remotamente (reset, carregador, cabo) antes de pedir envio.", ["Reset testado", "Carregamento testado", "Cabo testado"]],
  ["Registrar diagnóstico", "Anotar o resultado do diagnóstico na garantia.", ["Diagnóstico registrado"]],
  ["Definir ação", "Decidir: resolvido remotamente, reparo, troca ou reembolso.", ["Ação definida"]],
  ["Solicitar envio, se necessário", "Orientar a postagem e informar o endereço de recebimento.", ["Instruções de envio enviadas"]],
  ["Acompanhar transporte", "Acompanhar o rastreio até a chegada.", ["Código de rastreio registrado"]],
  ["Registrar recebimento", "Dar entrada do produto e avisar a operação.", ["Entrada registrada"]],
  ["Fazer análise", "Realizar análise física do produto.", ["Produto liga", "Carregamento testado", "Sem dano físico", "Problema reproduzido"]],
  ["Definir solução", "Aprovar reparo, troca ou reembolso.", ["Solução aprovada"]],
  ["Comunicar o cliente", "Informar a decisão e os próximos passos.", ["Cliente informado"]],
  ["Encerrar processo", "Confirmar entrega da solução e concluir.", ["Solução entregue", "Garantia concluída"]],
] as const;

const DEVOLUCAO = [
  ["Registrar solicitação", "Anotar pedido, produto e motivo da devolução.", ["Pedido localizado", "Motivo registrado"]],
  ["Validar elegibilidade", "Conferir prazo legal de arrependimento (7 dias) e condição do produto.", ["Prazo conferido"]],
  ["Aprovar e orientar envio", "Aprovar e enviar instruções de postagem.", ["Aprovação registrada", "Instruções enviadas"]],
  ["Acompanhar transporte", "Acompanhar rastreio da devolução.", ["Rastreio registrado"]],
  ["Conferir produto recebido", "Verificar itens, estado e embalagem.", ["Itens conferidos", "Estado registrado"]],
  ["Reembolsar", "Solicitar o reembolso e informar o cliente.", ["Reembolso solicitado", "Cliente informado"]],
  ["Encerrar", "Concluir a devolução.", ["Devolução concluída"]],
] as const;

async function main() {
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("BEGIN");
  const ex = await c.query("SELECT id FROM companies WHERE slug='eleva'");
  if (ex.rowCount) { console.log("Eleva já existe. Nada a fazer."); await c.query("ROLLBACK"); return c.end(); }
  const co = (await c.query("INSERT INTO companies (name, slug) VALUES ('Eleva','eleva') RETURNING id")).rows[0].id;
  await c.query("INSERT INTO users (company_id,name,email,password_hash,role) VALUES ($1,'Antonio',$2,$3,'owner')", [co, email, await bcrypt.hash(password, 12)]);
  for (const [name, kind, steps] of [["Garantia · Produto com problema", "garantia", GARANTIA], ["Devolução · Arrependimento", "devolucao", DEVOLUCAO]] as const) {
    const p = (await c.query("INSERT INTO processes (company_id,name,kind) VALUES ($1,$2,$3) RETURNING id", [co, name, kind])).rows[0].id;
    for (let i = 0; i < steps.length; i++) {
      const [t, d, ck] = steps[i];
      await c.query("INSERT INTO process_steps (company_id,process_id,position,title,description,checklist) VALUES ($1,$2,$3,$4,$5,$6)", [co, p, i + 1, t, d, JSON.stringify(ck)]);
    }
  }
  await c.query("COMMIT");
  console.log(`Eleva criada.\n  login: ${email}\n  senha: ${password}  (troque após o primeiro acesso)`);
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
