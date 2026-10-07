-- FASE 1/2: núcleo multi-tenant. Todo dado de empresa carrega company_id e é protegido por RLS.

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','atendente','marketing','operador')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE INDEX users_company_idx ON users (company_id);

-- Contador por empresa (número amigável de garantia/devolução: #1, #2...)
CREATE TABLE company_counters (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, name)
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_company_email_uq ON customers (company_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX customers_company_idx ON customers (company_id);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  number text NOT NULL,
  ordered_at date,
  product text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_cents integer CHECK (total_cents >= 0),
  tracking_code text,
  carrier text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);

CREATE TABLE warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number integer NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_id uuid REFERENCES orders(id),
  status text NOT NULL DEFAULT 'nova' CHECK (status IN (
    'nova','em_atendimento','aguardando_cliente','aguardando_envio','em_transporte',
    'recebido','em_analise','aguardando_decisao','solucao_aprovada','reparo','troca','reembolso','concluido')),
  category text NOT NULL,
  description text NOT NULL,
  assigned_to uuid REFERENCES users(id),
  next_action text,
  due_at date,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX warranties_company_status_idx ON warranties (company_id, status);

CREATE TABLE warranty_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warranty_id uuid NOT NULL REFERENCES warranties(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warranty_events_idx ON warranty_events (warranty_id, created_at DESC);

CREATE TABLE returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number integer NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_id uuid REFERENCES orders(id),
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN (
    'solicitada','aprovada','aguardando_envio','em_transporte','recebida',
    'em_conferencia','reembolso_pendente','reembolsada','concluida','recusada')),
  reason text NOT NULL,
  carrier text,
  tracking_code text,
  shipped_at date,
  received_at date,
  inspection_notes text,
  refund_cents integer CHECK (refund_cents >= 0),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX returns_company_status_idx ON returns (company_id, status);

CREATE TABLE return_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('garantia','devolucao','geral')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE process_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  position integer NOT NULL,
  title text NOT NULL,
  description text,
  checklist jsonb NOT NULL DEFAULT '[]',
  required_docs jsonb NOT NULL DEFAULT '[]',
  responsible_role text,
  notes text,
  UNIQUE (process_id, position)
);

-- Tarefas internas ("Ação necessária"): substitui perguntas no WhatsApp
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  ref_type text CHECK (ref_type IN ('warranty','return')),
  ref_id uuid,
  assigned_role text,
  assigned_to uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','done')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX tasks_company_status_idx ON tasks (company_id, status);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_idx ON audit_logs (company_id, created_at DESC);

-- ============ ISOLAMENTO POR EMPRESA (RLS) ============
CREATE FUNCTION app_company_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.company_id', true), '')::uuid $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','company_counters','customers','orders','warranties','warranty_events',
    'returns','return_events','processes','process_steps','tasks','audit_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id())', t);
  END LOOP;
END $$;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON companies USING (id = app_company_id()) WITH CHECK (id = app_company_id());

-- Próximo número sequencial por empresa (atômico)
CREATE FUNCTION next_seq(p_name text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v integer;
BEGIN
  INSERT INTO company_counters (company_id, name, value) VALUES (app_company_id(), p_name, 1)
  ON CONFLICT (company_id, name) DO UPDATE SET value = company_counters.value + 1
  RETURNING value INTO v;
  RETURN v;
END $$;

-- Login precisa achar o usuário ANTES de saber a empresa: única porta que atravessa o RLS.
CREATE FUNCTION auth_find_user(p_email text)
RETURNS TABLE (id uuid, company_id uuid, name text, role text, password_hash text, active boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ SELECT u.id, u.company_id, u.name, u.role, u.password_hash, u.active FROM users u WHERE lower(u.email) = lower(p_email) $$;
REVOKE ALL ON FUNCTION auth_find_user(text) FROM PUBLIC;

-- ============ PERMISSÕES DO ROLE DA APLICAÇÃO ============
GRANT SELECT, INSERT, UPDATE, DELETE ON users, company_counters, customers, orders, warranties, returns,
  processes, process_steps, tasks TO app_user;
GRANT SELECT ON companies TO app_user;
GRANT SELECT, INSERT ON warranty_events, return_events, audit_logs TO app_user;  -- histórico e auditoria são append-only
GRANT USAGE ON SEQUENCE audit_logs_id_seq TO app_user;
GRANT EXECUTE ON FUNCTION auth_find_user(text), next_seq(text), app_company_id() TO app_user;
