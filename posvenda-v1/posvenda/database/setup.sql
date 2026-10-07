-- Rodar UMA vez como superusuário do Postgres, antes de `npm run db:migrate`.
-- app_owner: dono do schema, usado só por migrations/seed.
-- app_user : usado pela aplicação; NÃO é dono das tabelas, então o RLS sempre vale para ele.
CREATE ROLE app_owner LOGIN PASSWORD 'TROQUE_ISTO' CREATEDB;
CREATE ROLE app_user  LOGIN PASSWORD 'TROQUE_ISTO' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE posvenda OWNER app_owner;
