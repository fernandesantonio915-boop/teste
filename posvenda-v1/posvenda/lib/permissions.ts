import type { Role } from "./db";

export type Module = "dashboard" | "garantias" | "devolucoes" | "processos" | "clientes" | "config";

const ACCESS: Record<Role, Module[]> = {
  owner: ["dashboard", "garantias", "devolucoes", "processos", "clientes", "config"],
  admin: ["dashboard", "garantias", "devolucoes", "processos", "clientes", "config"],
  atendente: ["dashboard", "garantias", "devolucoes", "processos", "clientes"],
  operador: ["dashboard", "garantias", "devolucoes", "processos"],
  marketing: ["dashboard", "clientes"], // CRM/automações/analytics entram nas fases 3+
};

export const can = (role: Role, m: Module) => ACCESS[role]?.includes(m) ?? false;
export const ROLE_LABEL: Record<Role, string> = { owner: "Dono", admin: "Administrador", atendente: "Atendente", marketing: "Marketing", operador: "Operador" };
