-- ==============================================================================
-- MIGRAÇÃO DE TABELA DE AVISOS NO SUPABASE: Tb_Avisos
-- Objetivo: Suporte a recibo individual de leitura (lido_por: TEXT[]) e rastreamento
-- ==============================================================================

-- 1. Criação da tabela Tb_Avisos caso ainda não exista
CREATE TABLE IF NOT EXISTS "Tb_Avisos" (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT,
  tipo TEXT DEFAULT 'Aviso',
  prioridade TEXT DEFAULT 'Média',
  destino TEXT DEFAULT 'Todos',
  destinatario_email TEXT DEFAULT 'Todos',
  destinatario_nome TEXT DEFAULT 'Todos os Membros',
  autor TEXT,
  data_criacao TEXT,
  status TEXT DEFAULT 'Aberto',
  lido TEXT DEFAULT 'Não',
  lido_por TEXT[] DEFAULT '{}',
  concluido_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Garantir a coluna lido_por como array de strings/UUIDs caso a tabela já exista
ALTER TABLE "Tb_Avisos"
ADD COLUMN IF NOT EXISTS lido_por TEXT[] DEFAULT '{}';

-- 3. Criar índice GIN para buscas ultra-rápidas em arrays (lido_por)
CREATE INDEX IF NOT EXISTS idx_tb_avisos_lido_por 
ON "Tb_Avisos" USING GIN (lido_por);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE "Tb_Avisos" ENABLE ROW LEVEL SECURITY;

-- 5. Política de Leitura: Usuários autenticados podem ler os avisos
DROP POLICY IF EXISTS "Usuários autenticados podem ler Tb_Avisos" ON "Tb_Avisos";
CREATE POLICY "Usuários autenticados podem ler Tb_Avisos" 
ON "Tb_Avisos" 
FOR SELECT 
TO authenticated 
USING (true);

-- 6. Política de Inserção: Usuários autenticados podem publicar avisos
DROP POLICY IF EXISTS "Usuários autenticados podem inserir Tb_Avisos" ON "Tb_Avisos";
CREATE POLICY "Usuários autenticados podem inserir Tb_Avisos" 
ON "Tb_Avisos" 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 7. Política de Atualização: Usuários autenticados podem marcar como lido ou atualizar
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar Tb_Avisos" ON "Tb_Avisos";
CREATE POLICY "Usuários autenticados podem atualizar Tb_Avisos" 
ON "Tb_Avisos" 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);
