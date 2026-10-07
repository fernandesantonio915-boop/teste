# GarantiaOS — V1 (Fase 1 + Fase 2)

Pós-venda + CRM para e-commerce. **Eleva é o primeiro tenant**, não está hardcoded: é só uma linha em `companies`.

## Rodar local
```bash
# 1. Postgres 14+ e os roles (uma vez):   psql -U postgres -f database/setup.sql
# 2. Variáveis:                            cp .env.example .env.local   # preencher
# 3.
npm install
npm run db:migrate          # cria tabelas + RLS
npm run db:seed             # cria a Eleva, usuário dono e os processos padrão (imprime a senha)
npm run dev                 # http://localhost:3000
npm test                    # isolamento entre empresas, auditoria append-only, status, permissões
```
Variáveis: `DATABASE_URL` (role app_user), `MIGRATION_DATABASE_URL` (role app_owner), `AUTH_SECRET` (≥32 chars). Opcional no seed: `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`.

## Como o isolamento funciona
`lib/db.ts → withTenant(companyId, fn)` abre uma transação, fixa `app.company_id` e **o Postgres aplica RLS** em toda query (`company_id = app_company_id()`). Mesmo um `SELECT` sem `WHERE company_id` não devolve dado de outra empresa. A aplicação conecta com um role que não é dono das tabelas (RLS não pode ser contornado). `audit_logs`, `warranty_events` e `return_events` são append-only (sem UPDATE/DELETE para o app).

## O que já funciona (testado)
Login (bcrypt, rate limit, sessão JWT httpOnly) · empresas/usuários/perfis (owner, admin, atendente, marketing, operador) · dashboard com dados reais · garantias (criar, filtrar, timeline, anotações, status controlado) · devoluções (idem) · tarefas "Ação necessária" (criada ao marcar garantia como *Recebido*; Assumir / Marcar como resolvido) · processos padrão de garantia e devolução (visualização) · clientes com visão de pedidos/garantias/devoluções · auditoria de ações.

## O que NÃO existe ainda (sem botão falso: nada disso aparece na interface)
Eventos, motor de automação, e-mail, fila, Yampi, carrinho abandonado, WhatsApp, analytics, billing, master admin (Fases 3 a 10).
Também faltam: upload de fotos/vídeos [NECESSÁRIO CONFIGURAR storage]; criar/editar processos; editar usuário/desativar; "esqueci a senha".

## Limitações conhecidas
- Logout apaga o cookie, mas o JWT não é revogado no servidor (válido até expirar, 7 dias). Resolver com tabela de sessões antes de abrir a outros lojistas.
- Rate limit de login em memória (1 instância). [NECESSÁRIO CONFIGURAR] Redis/Upstash para produção.
- Um usuário pertence a uma única empresa e e-mail é único globalmente.
