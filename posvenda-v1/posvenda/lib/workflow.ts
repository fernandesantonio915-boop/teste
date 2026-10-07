// Máquina de estados: alterações de status são controladas, nunca livres.
export type Tone = "orange" | "blue" | "green" | "gray";

export const WARRANTY_STATUS: Record<string, { label: string; tone: Tone; next: string[] }> = {
  nova:               { label: "Nova",                tone: "blue",   next: ["em_atendimento"] },
  em_atendimento:     { label: "Em atendimento",      tone: "blue",   next: ["aguardando_cliente", "aguardando_envio", "em_analise", "concluido"] },
  aguardando_cliente: { label: "Aguardando cliente",  tone: "blue",   next: ["em_atendimento", "aguardando_envio", "concluido"] },
  aguardando_envio:   { label: "Aguardando envio",    tone: "blue",   next: ["em_transporte", "aguardando_cliente", "concluido"] },
  em_transporte:      { label: "Em transporte",       tone: "blue",   next: ["recebido"] },
  recebido:           { label: "Recebido",            tone: "orange", next: ["em_analise"] },
  em_analise:         { label: "Em análise",          tone: "orange", next: ["aguardando_decisao", "aguardando_cliente"] },
  aguardando_decisao: { label: "Aguardando decisão",  tone: "orange", next: ["solucao_aprovada", "concluido"] },
  solucao_aprovada:   { label: "Solução aprovada",    tone: "green",  next: ["reparo", "troca", "reembolso"] },
  reparo:             { label: "Reparo",              tone: "green",  next: ["concluido"] },
  troca:              { label: "Troca",               tone: "green",  next: ["concluido"] },
  reembolso:          { label: "Reembolso",           tone: "green",  next: ["concluido"] },
  concluido:          { label: "Concluído",           tone: "gray",   next: [] },
};

export const RETURN_STATUS: Record<string, { label: string; tone: Tone; next: string[] }> = {
  solicitada:         { label: "Solicitada",          tone: "blue",   next: ["aprovada", "recusada"] },
  aprovada:           { label: "Aprovada",            tone: "blue",   next: ["aguardando_envio"] },
  aguardando_envio:   { label: "Aguardando envio",    tone: "blue",   next: ["em_transporte"] },
  em_transporte:      { label: "Em transporte",       tone: "blue",   next: ["recebida"] },
  recebida:           { label: "Recebida",            tone: "orange", next: ["em_conferencia"] },
  em_conferencia:     { label: "Em conferência",      tone: "orange", next: ["reembolso_pendente", "concluida"] },
  reembolso_pendente: { label: "Reembolso pendente",  tone: "orange", next: ["reembolsada"] },
  reembolsada:        { label: "Reembolsada",         tone: "green",  next: ["concluida"] },
  concluida:          { label: "Concluída",           tone: "gray",   next: [] },
  recusada:           { label: "Recusada",            tone: "gray",   next: [] },
};

export const WARRANTY_CATEGORIES = ["Não liga", "Tela", "Bluetooth", "Bateria / carregamento", "Pulseira", "Sensores", "Outro"];
export const RETURN_REASONS = ["Arrependimento", "Produto incorreto", "Defeito", "Chegou danificado", "Outro"];

export const canTransition = (table: Record<string, { next: string[] }>, from: string, to: string) => !!table[from]?.next.includes(to);
