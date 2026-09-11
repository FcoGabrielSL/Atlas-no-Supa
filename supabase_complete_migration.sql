-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA ATLAS BACKBONE BRISANET: GOOGLE SHEETS -> SUPABASE (POSTGRESQL)
-- Schema Completo com Relacionamentos, Chaves Estrangeiras (ON DELETE CASCADE),
-- Travas de Unicidade, Índices de Alta Performance e Row Level Security (RLS)
-- ==============================================================================

-- Habilita extensão para geração de UUIDs se ainda não habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA DE USUÁRIOS: Tb_Users
-- ID numérico sequencial (BIGSERIAL) para relacionamento com destinatários e leituras
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Users" (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  sobrenome TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  data_nascimento TEXT DEFAULT '',
  data_insercao TIMESTAMPTZ DEFAULT NOW(),
  nivel TEXT DEFAULT 'Assistente',
  role TEXT DEFAULT 'Operador',
  permissoes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_users_email ON "Tb_Users"(email);
CREATE INDEX IF NOT EXISTS idx_tb_users_auth_id ON "Tb_Users"(auth_id);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE AVISOS E PARTICULARIDADES: Tb_Avisos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Avisos" (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT DEFAULT '',
  tipo TEXT DEFAULT 'Aviso',
  prioridade TEXT DEFAULT 'Média',
  destino TEXT DEFAULT 'Todos',
  destinatario_nome TEXT DEFAULT 'Todos os Membros',
  destinatario_email TEXT DEFAULT 'Todos',
  destinatario_id TEXT,
  autor TEXT DEFAULT 'Sistema',
  autor_email TEXT,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'Aberto',
  lido TEXT DEFAULT 'Não',
  lido_por TEXT[] DEFAULT '{}',
  concluido_por TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_avisos_status ON "Tb_Avisos"(status);
CREATE INDEX IF NOT EXISTS idx_tb_avisos_destino ON "Tb_Avisos"(destino);
CREATE INDEX IF NOT EXISTS idx_tb_avisos_lido_por ON "Tb_Avisos" USING GIN (lido_por);

-- ------------------------------------------------------------------------------
-- 3. TABELA FILHA: Tb_Comentarios (Relacionada a Tb_Avisos via id_aviso)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Comentarios" (
  id BIGSERIAL PRIMARY KEY,
  id_aviso TEXT NOT NULL REFERENCES "Tb_Avisos"(id) ON DELETE CASCADE,
  autor TEXT NOT NULL,
  data TIMESTAMPTZ DEFAULT NOW(),
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_comentarios_aviso ON "Tb_Comentarios"(id_aviso);

-- ------------------------------------------------------------------------------
-- 4. TABELA FILHA: Tb_Destinacoes (Recibo de Leitura e Confirmação Individual)
-- Relacionamento com Tb_Avisos e Tb_Users (com id_user numérico)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Destinacoes" (
  id BIGSERIAL PRIMARY KEY,
  id_aviso TEXT NOT NULL REFERENCES "Tb_Avisos"(id) ON DELETE CASCADE,
  id_user BIGINT NOT NULL REFERENCES "Tb_Users"(id) ON DELETE CASCADE,
  lido BOOLEAN DEFAULT false,
  concluido BOOLEAN DEFAULT false,
  data_leitura TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trava de segurança mandatória (impede múltiplos registros para o mesmo usuário no mesmo aviso)
ALTER TABLE "Tb_Destinacoes" 
DROP CONSTRAINT IF EXISTS tb_destinacoes_aviso_user_key;

ALTER TABLE "Tb_Destinacoes" 
ADD CONSTRAINT tb_destinacoes_aviso_user_key UNIQUE (id_aviso, id_user);

CREATE INDEX IF NOT EXISTS idx_tb_destinacoes_aviso ON "Tb_Destinacoes"(id_aviso);
CREATE INDEX IF NOT EXISTS idx_tb_destinacoes_user ON "Tb_Destinacoes"(id_user);

-- ------------------------------------------------------------------------------
-- 5. TABELA DE ENTRONCAMENTOS: Tb_Entroncamentos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Entroncamentos" (
  id TEXT PRIMARY KEY,
  oper_id TEXT,
  trecho_a TEXT NOT NULL DEFAULT '',
  trecho_b TEXT NOT NULL DEFAULT '',
  trecho_c TEXT DEFAULT '',
  trecho_d TEXT DEFAULT '',
  localizacao TEXT DEFAULT '',
  tipo TEXT DEFAULT 'CAIXA',
  provedor TEXT DEFAULT '',
  acoes TEXT DEFAULT '',
  status TEXT DEFAULT 'Pendente',
  responsavel TEXT DEFAULT '',
  prazo TEXT DEFAULT '',
  data_backup TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  data TEXT DEFAULT '',
  data_conclusao TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_entroncamentos_status ON "Tb_Entroncamentos"(status);
CREATE INDEX IF NOT EXISTS idx_tb_entroncamentos_trecho_a ON "Tb_Entroncamentos"(trecho_a);
CREATE INDEX IF NOT EXISTS idx_tb_entroncamentos_trecho_b ON "Tb_Entroncamentos"(trecho_b);

-- ------------------------------------------------------------------------------
-- 6. TABELA FILHA: Tb_Entroncamentos_Historico (Histórico/Timeline de Entroncamentos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Entroncamentos_Historico" (
  id BIGSERIAL PRIMARY KEY,
  id_entroncamento TEXT NOT NULL REFERENCES "Tb_Entroncamentos"(id) ON DELETE CASCADE,
  autor TEXT DEFAULT '',
  data TIMESTAMPTZ DEFAULT NOW(),
  acao TEXT DEFAULT '',
  detalhes TEXT DEFAULT '',
  status_anterior TEXT,
  status_novo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_entroncamentos_hist_parent ON "Tb_Entroncamentos_Historico"(id_entroncamento);

-- ------------------------------------------------------------------------------
-- 7. TABELA DE CAMADA ÓPTICA: Tb_CamadaOptica
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_CamadaOptica" (
  id TEXT PRIMARY KEY,
  trecho TEXT NOT NULL,
  status TEXT DEFAULT 'Pendente',
  informacao TEXT DEFAULT '',
  historico TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  prazo TEXT DEFAULT '',
  data_backup TEXT DEFAULT '',
  data TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  cronograma_cobrancas TEXT DEFAULT '',
  localizacao TEXT DEFAULT '',
  data_conclusao TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_camada_optica_trecho ON "Tb_CamadaOptica"(trecho);
CREATE INDEX IF NOT EXISTS idx_tb_camada_optica_status ON "Tb_CamadaOptica"(status);

-- ------------------------------------------------------------------------------
-- 8. TABELA FILHA: Tb_CamadaOptica_Historico (Timeline de Camada Óptica)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_CamadaOptica_Historico" (
  id BIGSERIAL PRIMARY KEY,
  id_camada_optica TEXT NOT NULL REFERENCES "Tb_CamadaOptica"(id) ON DELETE CASCADE,
  autor TEXT DEFAULT '',
  data TIMESTAMPTZ DEFAULT NOW(),
  acao TEXT DEFAULT '',
  detalhes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_camada_hist_parent ON "Tb_CamadaOptica_Historico"(id_camada_optica);

-- ------------------------------------------------------------------------------
-- 9. TABELA DE OTDR: Tb_Otdr
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Otdr" (
  id TEXT PRIMARY KEY,
  trecho TEXT NOT NULL,
  onde_tem TEXT DEFAULT '',
  onde_precisa TEXT DEFAULT '',
  tamanho_km TEXT DEFAULT '',
  status TEXT DEFAULT 'Pendente',
  observacao TEXT DEFAULT '',
  planejamento TEXT DEFAULT '',
  data_abertura TEXT DEFAULT '',
  data_estimada TEXT DEFAULT '',
  data_conclusao TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_otdr_trecho ON "Tb_Otdr"(trecho);
CREATE INDEX IF NOT EXISTS idx_tb_otdr_status ON "Tb_Otdr"(status);

-- ------------------------------------------------------------------------------
-- 10. TABELA DE ATENUAÇÕES: Tb_Atenuacoes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Atenuacoes" (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'ABERTO',
  tipo_chamados TEXT DEFAULT 'TRECHO',
  id_imoc TEXT DEFAULT '',
  sla TEXT DEFAULT 'Médio',
  complexidade TEXT DEFAULT 'MÉDIO',
  data_abertura TEXT DEFAULT '',
  data_conclusao TEXT DEFAULT '',
  rede TEXT DEFAULT '',
  trecho TEXT DEFAULT '',
  percas TEXT DEFAULT '0',
  detalhamento TEXT DEFAULT '',
  pioras TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_atenuacoes_imoc ON "Tb_Atenuacoes"(id_imoc);
CREATE INDEX IF NOT EXISTS idx_tb_atenuacoes_status ON "Tb_Atenuacoes"(status);

-- ------------------------------------------------------------------------------
-- 11. TABELA DE TESTES DE CAMPO: Tb_TestesCampo
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_TestesCampo" (
  id TEXT PRIMARY KEY,
  abertura TEXT DEFAULT '',
  trechos_para_realizar_testes TEXT DEFAULT '',
  localidade TEXT DEFAULT '',
  concluido TEXT DEFAULT 'Não',
  sla TEXT DEFAULT 'Médio',
  data_prevista TEXT DEFAULT '',
  observacao TEXT DEFAULT '',
  local_trecho TEXT DEFAULT '',
  status TEXT DEFAULT 'Pendente',
  tipo_teste TEXT DEFAULT '',
  tecnico TEXT DEFAULT '',
  data_teste TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_testes_status ON "Tb_TestesCampo"(status);

-- ------------------------------------------------------------------------------
-- 12. TABELA DE BYPASS: Tb_Bypass
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Bypass" (
  id TEXT PRIMARY KEY,
  dispositivo_trecho TEXT DEFAULT '',
  trechos TEXT DEFAULT '',
  ponto_km TEXT DEFAULT '',
  observacao TEXT DEFAULT '',
  local_inicial TEXT DEFAULT '',
  trechos_rota_desvio TEXT DEFAULT 'AMBOS',
  status TEXT DEFAULT 'Ativo',
  motivo_bypass TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  data_inicio TEXT DEFAULT '',
  previsao_normalizacao TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_bypass_status ON "Tb_Bypass"(status);

-- ------------------------------------------------------------------------------
-- 13. TABELA DE TROCA DE CABO: Tb_TrocaCabo
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_TrocaCabo" (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Pendente',
  data TEXT DEFAULT '',
  trecho TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  site_a TEXT DEFAULT '',
  abordagem_a TEXT DEFAULT '',
  qt_caixas_a TEXT DEFAULT '',
  site_b TEXT DEFAULT '',
  abordagem_b TEXT DEFAULT '',
  qt_caixas_b TEXT DEFAULT '',
  conclusao TEXT DEFAULT '',
  data_conclusao TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_troca_cabo_trecho ON "Tb_TrocaCabo"(trecho);
CREATE INDEX IF NOT EXISTS idx_tb_troca_cabo_status ON "Tb_TrocaCabo"(status);

-- ------------------------------------------------------------------------------
-- 14. TABELA DE ATUAÇÕES: Tb_Atuacoes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_Atuacoes" (
  id TEXT PRIMARY KEY,
  trecho TEXT DEFAULT '',
  tipo_atuacao TEXT DEFAULT '',
  tecnico TEXT DEFAULT '',
  status TEXT DEFAULT 'EM ANDAMENTO',
  data TEXT DEFAULT '',
  detalhes TEXT DEFAULT '',
  coordenadas_recebidas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_atuacoes_trecho ON "Tb_Atuacoes"(trecho);

-- ------------------------------------------------------------------------------
-- 15. TABELA DE RELATÓRIO MENSAL: Tb_RelatorioMensal
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_RelatorioMensal" (
  id TEXT PRIMARY KEY,
  mes TEXT NOT NULL,
  total_incidentes TEXT DEFAULT '0',
  sla_mensal TEXT DEFAULT '',
  ganhos_acumulados TEXT DEFAULT '',
  destaques_tecnicos TEXT DEFAULT '',
  principais_eventos TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 16. TABELA DE CONTROLE DE INCIDENTES / ANOTAÇÕES: Tb_ControleIncidentes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tb_ControleIncidentes" (
  id TEXT PRIMARY KEY,
  dados JSONB DEFAULT '{}',
  anotacoes TEXT DEFAULT '',
  data_atualizacao TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
-- Permite leitura e escrita para conexões autenticadas e anônimas configuradas
-- ==============================================================================
DO $$
DECLARE
  tab text;
  tables text[] := ARRAY[
    'Tb_Users', 
    'Tb_Avisos', 
    'Tb_Comentarios', 
    'Tb_Destinacoes', 
    'Tb_Entroncamentos', 
    'Tb_Entroncamentos_Historico',
    'Tb_CamadaOptica',
    'Tb_CamadaOptica_Historico',
    'Tb_Otdr',
    'Tb_Atenuacoes',
    'Tb_TestesCampo',
    'Tb_Bypass',
    'Tb_TrocaCabo',
    'Tb_Atuacoes',
    'Tb_RelatorioMensal',
    'Tb_ControleIncidentes'
  ];
BEGIN
  FOREACH tab IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tab);
    EXECUTE format('DROP POLICY IF EXISTS "Public Read Access %I" ON %I;', tab, tab);
    EXECUTE format('CREATE POLICY "Public Read Access %I" ON %I FOR SELECT USING (true);', tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access %I" ON %I;', tab, tab);
    EXECUTE format('CREATE POLICY "Public Insert Access %I" ON %I FOR INSERT WITH CHECK (true);', tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS "Public Update Access %I" ON %I;', tab, tab);
    EXECUTE format('CREATE POLICY "Public Update Access %I" ON %I FOR UPDATE USING (true) WITH CHECK (true);', tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access %I" ON %I;', tab, tab);
    EXECUTE format('CREATE POLICY "Public Delete Access %I" ON %I FOR DELETE USING (true);', tab, tab);
  END LOOP;
END $$;
