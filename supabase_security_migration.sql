-- ==============================================================================
-- MIGRAÇÃO DE SEGURANÇA SUPABASE: Tb_Users & auth.users
-- Objetivo: Vincular perfis públicos ao Supabase Auth e eliminar senhas em texto puro
-- ==============================================================================

-- 1. Adicionar a coluna auth_id na tabela pública Tb_Users conectada ao auth.users
ALTER TABLE "Tb_Users" 
ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Criar índice de busca para máxima performance em consultas por auth_id
CREATE INDEX IF NOT EXISTS idx_tb_users_auth_id 
ON "Tb_Users"(auth_id);

-- 3. Garantir unicidade: Cada conta no Supabase Auth deve ter no máximo 1 perfil em Tb_Users
ALTER TABLE "Tb_Users"
DROP CONSTRAINT IF EXISTS tb_users_auth_id_unique;

ALTER TABLE "Tb_Users"
ADD CONSTRAINT tb_users_auth_id_unique UNIQUE (auth_id);

-- 4. [IMPORTANTE] EXECUTE O SCRIPT DE MIGRAÇÃO EM MASSA (migrateUsersToAuth.ts) 
--    ANTES DO PASSO ABAIXO, PARA GARANTIR QUE AS SENHAS ATUAIS SEJAM MIGRADAS
--    PARA O SUPABASE AUTH ANTES DE SEREM EXCLUÍDAS DEFINITIVAMENTE DA TABELA PÚBLICA.

-- 5. DELEÇÃO DA COLUNA 'senha' (Eliminação de risco crítico de segurança)
ALTER TABLE "Tb_Users" 
DROP COLUMN IF EXISTS senha;

-- 6. Configuração recomendada de Row Level Security (RLS)
ALTER TABLE "Tb_Users" ENABLE ROW LEVEL SECURITY;

-- Política 1: Usuários autenticados podem ler os perfis de usuários (para matrizes e permissões)
DROP POLICY IF EXISTS "Usuários autenticados podem ler Tb_Users" ON "Tb_Users";
CREATE POLICY "Usuários autenticados podem ler Tb_Users" 
ON "Tb_Users" 
FOR SELECT 
TO authenticated 
USING (true);

-- Política 2: Cada usuário pode atualizar seu próprio perfil público
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON "Tb_Users";
CREATE POLICY "Usuários podem atualizar próprio perfil" 
ON "Tb_Users" 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- Política 3: Administradores e processo de criação podem inserir novos operadores
DROP POLICY IF EXISTS "Inserção de perfil Tb_Users" ON "Tb_Users";
CREATE POLICY "Inserção de perfil Tb_Users" 
ON "Tb_Users" 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = auth_id OR auth.uid() IS NOT NULL);
