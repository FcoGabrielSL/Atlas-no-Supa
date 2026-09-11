import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { getDbState, saveDbState, registerLocalChange, syncWithSpreadsheet, initializeDb, forceResetAndImport, normalizeWebAppUrl } from "./src/dbManager";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import { parseCSV } from "./src/utils/csvParser";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Inicialização do cliente Gemini AI com tratamento resiliente
let aiClient: GoogleGenAI | null = null;
const getAiClient = (): GoogleGenAI | null => {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
};

// Gerador robusto de relatório técnico (fallback estruturado caso IA falhe ou chave esteja ausente)
function generateStructuredCodeReport(incidents: any[]): string {
  const total = incidents.length;
  
  const severityCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const trechoCounts: Record<string, number> = {};
  const tipoCounts: Record<string, number> = {};

  incidents.forEach(item => {
    const sev = String(item.SEVERIDADE || item.severidade || item.PRIORIDADE || item.prioridade || "Média").trim();
    severityCounts[sev] = (severityCounts[sev] || 0) + 1;

    const status = String(item.STATUS || item.status || item.SITUAÇÃO || item.situacao || "Aberto").trim();
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const trecho = String(item.TRECHO || item.trecho || item["TRECHO A"] || item["TRECHO B"] || item["ESTAÇÃO"] || item["estacao"] || "Não Identificado").trim();
    trechoCounts[trecho] = (trechoCounts[trecho] || 0) + 1;

    const tipo = String(item.TIPO || item.tipo || item.CATEGORIA || item.categoria || "Geral").trim();
    tipoCounts[tipo] = (tipoCounts[tipo] || 0) + 1;
  });

  const topTrechos = Object.entries(trechoCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTipos = Object.entries(tipoCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  let report = `# 📊 Relatório Executivo de Controle de Incidentes DWDM\n\n`;
  report += `*Relatório gerado automaticamente baseado nos incidentes importados da API.*\n\n`;
  
  report += `## 1. Resumo Quantitativo\n`;
  report += `- **Total de Incidentes Analisados:** ${total}\n`;
  report += `- **Período de Monitoramento:** Recente (conforme parâmetros de busca)\n\n`;

  report += `### Distribuição por Severidade\n`;
  for (const [key, val] of Object.entries(severityCounts)) {
    report += `- **${key}:** ${val} (${((val / total) * 100).toFixed(1)}%)\n`;
  }
  report += `\n`;

  report += `### Status dos Chamados\n`;
  for (const [key, val] of Object.entries(statusCounts)) {
    report += `- **${key}:** ${val}\n`;
  }
  report += `\n`;

  report += `## 2. Pontos Críticos e Ofensores de Rede\n`;
  report += `Identificamos os trechos ou estações com maior recorrência de chamados e falhas ativas de transmissão:\n\n`;
  report += `| Trecho / Localidade / Estação | Qtd Chamados | % Total |\n`;
  report += `| :--- | :---: | :---: |\n`;
  topTrechos.forEach(([trecho, val]) => {
    report += `| ${trecho} | ${val} | ${((val / total) * 100).toFixed(1)}% |\n`;
  });
  report += `\n`;

  report += `### Tipologia de Falhas Comuns\n`;
  topTipos.forEach(([tipo, val]) => {
    report += `- **${tipo}:** ${val} chamados registrados.\n`;
  });
  report += `\n`;

  report += `## 3. Recomendações e Plano de Ação\n`;
  report += `1. **Atuação Imediata nos Ofensores:** Mobilizar equipes de campo para vistoria física e medições de atenuação óptica nos trechos com maior incidência de falhas (${topTrechos[0]?.[0] || "ofensores principais"}).\n`;
  report += `2. **Manutenção Preventiva:** Agendar testes de OTDR em canais com alertas recorrentes de degradação de sinal óptico para evitar interrupções completas.\n`;
  report += `3. **Saneamento de Rotas:** Revisar as emendas ópticas e caixas de junção nos trechos de alta criticidade identificados.\n`;
  
  return report;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ezebjlodizcjozsjbweq.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ThdEI0G6dw22Qvx2F-d-OQ_WABQQFWb";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WEb_APP_API_URL = normalizeWebAppUrl(process.env.VITE_APP_SCRIPT_URL);

async function startServer() {
  let isSyncPaused = false;
  let isSyncing = false;

  // Inicializa o banco de dados local na inicialização do servidor
  try {
    console.log("[CBE Server] Inicializando banco de dados local...");
    const initialDb = await initializeDb();
    if (typeof initialDb.isSyncPaused === "boolean") {
      isSyncPaused = initialDb.isSyncPaused;
    }
    console.log(`[CBE Server] Banco de dados inicializado com sucesso. Estado da sincronia: ${isSyncPaused ? "PAUSADO" : "ATIVO"}.`);
    
    // Sincroniza com a planilha real em segundo plano na inicialização para não bloquear o boot do servidor
    console.log("[CBE Server] Agendando sincronização inicial com a planilha em segundo plano...");
    syncWithSpreadsheet(WEb_APP_API_URL)
      .then((res) => {
        console.log("[CBE Server Background Sync] Sincronização inicial em segundo plano concluída:", res.success ? "Sucesso" : "Falha/Aviso", res);
      })
      .catch((err) => {
        console.error("[CBE Server Background Sync Error] Falha na sincronização em segundo plano:", err);
      });

    // Configura sincronização automática periódica em segundo plano (a cada 120 segundos)
    setInterval(() => {
      if (isSyncPaused) {
        console.log("[CBE Server Background Sync] Sincronização pausada pelo usuário. Ignorando ciclo automático.");
        return;
      }
      console.log("[CBE Server Background Sync] Iniciando sincronização periódica automática com o Google Sheets...");
      syncWithSpreadsheet(WEb_APP_API_URL)
        .then((res) => {
          if (res.success) {
            console.log("[CBE Server Background Sync] Sincronização automática concluída com sucesso.");
          } else {
            console.warn("[CBE Server Background Sync Warning] Sincronização automática concluída com avisos:", res.error);
          }
        })
        .catch((err) => {
          console.error("[CBE Server Background Sync Error] Erro na sincronização automática periódica:", err);
        });
    }, 120 * 1000);
  } catch (dbErr) {
    console.error("[CBE Server Master Fail] Falha crucial ao preparar banco de dados:", dbErr);
  }

  const app = express();
  const PORT = 3000;

  // Middlewares de Parsing para requisições com corpo JSON e URL-Encoded
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Endpoint de status da sincronização
  app.get("/api/sheets/sync-status", async (req, res) => {
    try {
      const db = await getDbState();
      res.json({
        success: true,
        isPaused: isSyncPaused,
        pendingChangesCount: db.pendingChanges ? db.pendingChanges.length : 0,
        lastSyncTime: db.lastSyncTime || "Nunca sincronizado",
        lastSyncStatus: db.lastSyncStatus || ""
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint de alternância de pausa na sincronização
  app.post("/api/sheets/toggle-sync", async (req, res) => {
    try {
      const { pause } = req.body;
      isSyncPaused = typeof pause === "boolean" ? pause : !isSyncPaused;
      console.log(`[CBE Sync Toggle] Estado da sincronização alterado para: ${isSyncPaused ? "PAUSADO" : "ATIVO"}`);
      
      const db = await getDbState();
      db.isSyncPaused = isSyncPaused;
      await saveDbState(db);

      let syncResult = null;
      if (!isSyncPaused) {
        console.log("[CBE Sync Toggle] Sincronização despausada! Executando envio imediato de alterações pendentes...");
        syncResult = await syncWithSpreadsheet(WEb_APP_API_URL);
      }
      
      const currentDb = await getDbState();
      res.json({
        success: true,
        isPaused: isSyncPaused,
        pendingChangesCount: currentDb.pendingChanges ? currentDb.pendingChanges.length : 0,
        syncResult
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Proxy GET: Busca os dados instantaneamente do banco de dados local (Elimina OFFLINE FALLBACK!)
  app.get("/api/sheets", async (req, res) => {
    try {
      let dbState = await getDbState();
      
      const forceFresh = req.query.fresh === "true" || req.query.force === "true";
      const neverSynced = !dbState.lastSyncTime || dbState.lastSyncTime === "Nunca sincronizado";
      const cacheStale = !dbState.lastSyncTimestamp || (Date.now() - dbState.lastSyncTimestamp > 30000); // 30s cache
      
      if ((neverSynced || cacheStale || forceFresh) && !isSyncing && !isSyncPaused) {
        isSyncing = true;
        console.log(`[CBE Proxy GET] Iniciando sincronização em segundo plano (neverSynced: ${neverSynced}, cacheStale: ${cacheStale}, forceFresh: ${forceFresh})...`);
        
        syncWithSpreadsheet(WEb_APP_API_URL)
          .then((syncResult) => {
            if (syncResult.success) {
              console.log("[CBE Proxy GET Background] Sincronização em segundo plano bem-sucedida.");
            } else {
              console.warn("[CBE Proxy GET Background] Sincronização em segundo plano retornou falha/aviso:", syncResult.error);
            }
          })
          .catch((syncErr) => {
            console.error("[CBE Proxy GET Background] Erro na sincronização em segundo plano:", syncErr);
          })
          .finally(() => {
            isSyncing = false;
          });
      }

      res.json(dbState);
    } catch (err: any) {
      console.error("[CBE Proxy ERROR] Falha ao ler banco de dados local:", err);
      res.status(500).json({
        success: false,
        error: "Falha interna ao recuperar dados locais do banco estruturado",
        details: err.message
      });
    }
  });

  // Validação resiliente de pré-cadastro de operador (fuga de RLS do Supabase para Primeiro Acesso)
  app.get("/api/users/check-email", async (req, res) => {
    try {
      const queryEmail = String(req.query.email || "").trim().toLowerCase();
      if (!queryEmail) {
        return res.status(400).json({ success: false, error: "O parâmetro 'email' é obrigatório." });
      }

      // 1. Caso especial: Super Administrador estático de fallback (Exclusivo Francisco Gabriel)
      const staticAdmins = [
        "francisco.gabriel@grupobrisanet.com.br",
        "fcogabriel373@gmail.com",
        "contato@franciscogabriel.com.br"
      ];
      if (staticAdmins.includes(queryEmail)) {
        return res.json({
          success: true,
          authorized: true,
          user: {
            email: queryEmail,
            nome: "Francisco",
            sobrenome: "Gabriel",
            nivel: "Administrador (Admin)",
            permissions: {
              entroncamentos: { visualizar: true, editar: true, excluir: true },
              camada_optica: { visualizar: true, editar: true, excluir: true },
              otdr: { visualizar: true, editar: true, excluir: true },
              atenuacoes: { visualizar: true, editar: true, excluir: true },
              testes_campo: { visualizar: true, editar: true, excluir: true },
              bypass: { visualizar: true, editar: true, excluir: true },
              relatorio_mensal: { visualizar: true, editar: true, excluir: true },
              atuacoes_geral: { visualizar: true, editar: true, excluir: true },
              settings: { visualizar: true, editar: true, excluir: true },
              admin: { visualizar: true, editar: true, excluir: true }
            }
          }
        });
      }

      // 2. Consulta Supabase PRIMEIRO (Fonte de verdade para logins e permissões live)
      try {
        console.log(`[CBE Users Check] Buscando operador '${queryEmail}' diretamente no Supabase como recurso prioritário de sincronia...`);
        const { data: sbUsers, error: sbError } = await supabase
          .from("Tb_Users")
          .select("*")
          .eq("email", queryEmail);

        if (!sbError && sbUsers && sbUsers.length > 0) {
          const sbUser = sbUsers[0];
          console.log(`[CBE Users Check] Operador '${queryEmail}' localizado em tempo real no Supabase! (ID: ${sbUser.id})`);
          
          let parsedPermissions = null;
          if (sbUser.permissoes) {
            try {
              parsedPermissions = typeof sbUser.permissoes === "string" 
                ? JSON.parse(sbUser.permissoes) 
                : sbUser.permissoes;
            } catch (e) {
              console.warn("Erro ao fazer parse de permissoes do Supabase:", e);
            }
          }

          const localUser = {
            id: String(sbUser.id),
            nome: sbUser.nome || "",
            sobrenome: sbUser.sobrenome || "",
            email: sbUser.email || "",
            nivel: sbUser.nivel || "Assistente",
            permissions: parsedPermissions,
            dataNascimento: sbUser.data_nasc || sbUser.dataNascimento || "",
            senha: sbUser.senha || "OAuth/SupabaseAuthSecure"
          };

          // Sincroniza dinamicamente para o banco local database.json para manter o cache atualizado
          try {
            const db = await getDbState();
            if (!db.USERS) db.USERS = [];
            const existingIdx = db.USERS.findIndex((u: any) => String(u.email || "").trim().toLowerCase() === queryEmail);
            if (existingIdx !== -1) {
              db.USERS[existingIdx] = { ...db.USERS[existingIdx], ...localUser };
            } else {
              db.USERS.push(localUser);
            }
            await fs.writeFile("./data/database.json", JSON.stringify(db, null, 2), "utf-8");
            console.log(`[CBE Users Check] Cache local de '${queryEmail}' atualizado no database.json.`);
          } catch (syncLocalErr) {
            console.warn("[CBE Users Check] Erro ao sincronizar usuário no database.json local:", syncLocalErr);
          }

          return res.json({
            success: true,
            authorized: true,
            user: localUser
          });
        }
      } catch (sbErr) {
        console.warn("[CBE Users Check] Falha de comunicação direta com Supabase Tb_Users:", sbErr);
      }

      // 3. Fallback: Busca na base de usuários local em /data/database.json
      const dbState = await getDbState();
      const localUsers = dbState.USERS || [];
      const foundUser = localUsers.find(
        (u: any) => String(u.email || "").trim().toLowerCase() === queryEmail
      );

      if (foundUser) {
        let parsedPermissions = foundUser.permissions || foundUser.PERMISOES;
        if (typeof parsedPermissions === "string") {
          try {
            parsedPermissions = JSON.parse(parsedPermissions);
          } catch (e) {}
        }

        return res.json({
          success: true,
          authorized: true,
          user: {
            id: foundUser.id,
            nome: foundUser.nome || "",
            sobrenome: foundUser.sobrenome || "",
            email: foundUser.email || "",
            nivel: foundUser.nivel || foundUser.Nivel || "Assistente",
            permissions: parsedPermissions || null,
            dataNascimento: foundUser.dataNascimento || foundUser.data_nasc || ""
          }
        });
      }

      return res.json({
        success: true,
        authorized: false,
        user: null
      });
    } catch (err: any) {
      console.error("[CBE Check Email ERROR] Falha ao verificar operador:", err);
      res.status(500).json({
        success: false,
        error: "Erro no servidor ao validar matriz do operador",
        details: err.message
      });
    }
  });

  // Endpoint de Sincronização Bidirecional Direta: Push pendentes e Pull atualizações
  app.post("/api/sheets/sync", async (req, res) => {
    try {
      if (isSyncPaused) {
        const db = await getDbState();
        return res.json({
          success: true,
          isPaused: true,
          message: "Sincronização pausada pelo usuário. Os dados estão salvos em cache local.",
          pushedChangesCount: 0,
          pendingChangesCount: db.pendingChanges ? db.pendingChanges.length : 0
        });
      }
      console.log("[CBE Sync Endpoint] Iniciando Sincronização Bidirecional...");
      const syncResult = await syncWithSpreadsheet(WEb_APP_API_URL);
      res.json(syncResult);
    } catch (err: any) {
      console.error("[CBE Sync Endpoint ERROR] Falha crítica durante sincronização:", err);
      res.status(502).json({
        success: false,
        error: "Falha de conexão ou processamento durante a sincronização com o Google Sheets",
        details: err.message
      });
    }
  });

// Helpers de normalização flexível para campos de incidentes no backend (Sincronia robusta com Google Sheets)
function getBackendVal(obj: any, keyName: string): any {
  if (!obj) return "";
  if (obj[keyName] !== undefined && obj[keyName] !== null) return obj[keyName];
  
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
  const targetKey = norm(keyName);
  
  const synonyms: { [key: string]: string[] } = {
    operador: ["operador", "criador", "responsavel", "usuario", "abertopor", "operator", "creator"],
    id: ["id", "chamado", "ticket", "incidente", "protocolo", "codigo"],
    titulo: ["titulo", "assunto", "descricao", "resumo", "summary", "incidenttitle", "titulo_chamado"],
    datadeabertura: ["datadeabertura", "abertura", "data", "createdat", "datadecriacao", "createdAt", "data_abertura"],
    rfo: ["rfo", "rfostatus", "rfo_status", "statusrfo", "situacaorfo", "rfo_situacao", "rfo_situacao_chamado", "situacaodorfo", "rfo_status_chamado", "status_rfo", "rfo_solicitado"],
    status: ["status", "situacao", "state"],
    concluido: ["concluido", "concluida", "is_concluido"],
    categoria: ["categoria", "grupo", "tipo", "category"],
    subcategoria: ["subcategoria", "sub_categoria", "subcat", "sub_cat", "subcategoria_chamado", "sub_category"],
    trechocompensado: ["trechocompensado", "trecho_compensado", "compensado", "trechocompensacao", "compensacao", "is_compensado"],
    atenuacaocritica: ["atenuacaocritica", "critica", "critico", "is_critica", "atenuacao_critica"],
    ultimocomentario: ["ultimocomentario", "comentario", "ultimo_comentario", "ultimocomentariodoatendimento", "observacao"],
    usuariodoultimocomentario: ["usuariodoultimocomentario", "usuarioultimocomentario", "usuariodoultimo", "usuario_ultimo_comentario", "atendente", "operador_ultimo_comentario", "usuario_ultimo"],
    datadoultimocomentario: ["datadoultimocomentario", "dataultimocomentario", "datadoultimo", "data_ultimo_comentario", "data_comentario", "data_ultimo"],
    datainicio: ["datainicio", "inicio", "data_inicio"],
    datafim: ["datafim", "fim", "data_fim"]
  };

  let synonymList = [targetKey];
  for (const [groupKey, list] of Object.entries(synonyms)) {
    if (groupKey === targetKey || list.map(norm).includes(targetKey)) {
      synonymList = list.map(norm);
      break;
    }
  }

  const keys = Object.keys(obj);
  for (const key of keys) {
    const normKey = norm(key);
    if (synonymList.includes(normKey)) {
      return obj[key];
    }
  }

  const foundKey = keys.find(k => norm(k) === targetKey || norm(k).includes(targetKey));
  if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) {
    return obj[foundKey];
  }
  return "";
}

function normalizeIncidentKeys(row: any): any {
  if (!row) return row;
  const normalized = { ...row };

  const officialKeys = [
    "ID", "Título", "Criador", "Data de Abertura", "Status", "RFO",
    "Atenuação Crítica", "Concluído", "Último Comentário",
    "Usuário do Último Comentário", "Data do Último Comentário",
    "Data Início", "Data Fim", "Categoria"
  ];

  officialKeys.forEach(key => {
    const val = getBackendVal(row, key);
    if (val !== undefined && val !== null && val !== "") {
      normalized[key] = val;
    } else if (normalized[key] === undefined) {
      normalized[key] = "";
    }
  });

  return normalized;
}

// Helper para subtrair N dias de uma string de data YYYY-MM-DD de forma segura
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// Helper para subtrair 1 dia de uma string de data YYYY-MM-DD de forma segura
function getYesterdayDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// Helper para realizar a chamada HTTP e processamento do retorno da Brisanet com timeout de segurança
async function fetchFromBrisanet(startDate: string, endDate: string, startTime: string, endTime: string, token: string): Promise<any[]> {
  console.log(`[CBE Incidentes] Requisição Brisanet -> start_date=${startDate}&end_date=${endDate}&start_time=${startTime}&end_time=${endTime}`);
  const apiUrl = `https://saski.brisanet.net.br/api/reports/dwdm/chamados-incidentes/export?start_date=${startDate}&end_date=${endDate}&start_time=${startTime}&end_time=${endTime}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(apiUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${token.trim()}`
      }
    });
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    if (fetchErr.name === "AbortError") {
      throw new Error("A API de Incidentes Brisanet demorou muito para responder (timeout de 15s).");
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`A API de Incidentes Brisanet retornou erro ${response.status}: ${errorText || "Nenhum detalhe"}`);
  }

  const responseText = await response.text();
  
  if (responseText.trim().startsWith("<") || responseText.trim().toLowerCase().startsWith("<!doctype")) {
    throw new Error("⚠️ Token inválido ou não autorizado: A API externa retornou uma página HTML em vez de um arquivo de chamados.");
  }

  let parsedIncidents: any[] = [];
  const trimmedText = responseText.trim();
  if (trimmedText.startsWith("[") || trimmedText.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmedText);
      if (Array.isArray(parsed)) {
        parsedIncidents = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.incidents)) {
          parsedIncidents = parsed.incidents;
        } else if (Array.isArray(parsed.data)) {
          parsedIncidents = parsed.data;
        } else if (Array.isArray(parsed.reports)) {
          parsedIncidents = parsed.reports;
        } else if (parsed.ID || parsed.id) {
          parsedIncidents = [parsed];
        } else {
          const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
          if (arrayKey) {
            parsedIncidents = parsed[arrayKey];
          } else {
            parsedIncidents = [parsed];
          }
        }
      }
    } catch (jsonErr) {
      console.error("[CBE Incidentes] Falha ao parsear como JSON, tentando CSV:", jsonErr);
      parsedIncidents = parseCSV(responseText);
    }
  } else {
    parsedIncidents = parseCSV(responseText);
  }

  return parsedIncidents;
}

  // Endpoint para verificar configuração global de token
  app.get("/api/incidentes/config", (req, res) => {
    res.json({
      hasGlobalToken: !!process.env.BRISANET_API_TOKEN
    });
  });

  // Endpoint para buscar incidentes da API DWDM e salvar localmente/sincronizar
  app.post("/api/incidentes/fetch", async (req, res) => {
    try {
      const { start_date, end_date, token } = req.body;
      const authHeader = req.headers.authorization;
      const headerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
      const apiToken = (token && typeof token === "string" && token.trim()) || headerToken || process.env.BRISANET_API_TOKEN || process.env.VITE_BRISANET_API_TOKEN || "32271|rFgGkhQAB4kk4qTwy2OlabY7Fitg2DqGnMmmadr235a3c944";
      if (!start_date || !end_date || !apiToken) {
        return res.status(400).json({ success: false, error: "Parâmetros 'start_date', 'end_date' e 'token' são obrigatórios (ou defina BRISANET_API_TOKEN no servidor)." });
      }

      // 1. Extração robusta de data (suporta YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, YYYY-MM-DD HH:mm:ss e DD/MM/YYYY)
      const extractDateOnly = (val: any): string => {
        const str = String(val || "").trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          return str.substring(0, 10);
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
          const [d, m, y] = str.substring(0, 10).split("/");
          return `${y}-${m}-${d}`;
        }
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split("T")[0];
        }
        return str.split("T")[0].split(" ")[0].substring(0, 10).trim();
      };

      const cleanStartDate = extractDateOnly(req.body.start_date_only || start_date);
      const cleanEndDate = extractDateOnly(req.body.end_date_only || end_date);

      // 2. Isola os horários no formato HH:mm obtidos do front-end ou define os fallbacks
      let startTime = req.body.start_time || "00:00";
      let endTime = req.body.end_time || "23:59";

      if (!req.body.start_time) {
        if (String(start_date).includes("T")) {
          startTime = String(start_date).split("T")[1]?.substring(0, 5) || startTime;
        } else if (String(start_date).includes(" ")) {
          startTime = String(start_date).split(" ")[1]?.substring(0, 5) || startTime;
        }
      }
      if (!req.body.end_time) {
        if (String(end_date).includes("T")) {
          endTime = String(end_date).split("T")[1]?.substring(0, 5) || endTime;
        } else if (String(end_date).includes(" ")) {
          endTime = String(end_date).split(" ")[1]?.substring(0, 5) || endTime;
        }
      }

      // Para garantir que chamados abertos anteriormente (como rompimentos em andamento ou chamados de dias passados)
      // que receberam novos comentários hoje sejam atualizados com sucesso, nós estendemos a busca na API externa Brisanet
      // para buscar chamados criados desde 45 dias atrás. Isso possibilita atualizar os comentários locais deles!
      // Nós buscamos de 00:00 até 23:59 do dia para garantir que todos os chamados abertos a qualquer hora sejam retornados.
      const apiSearchStartDate = subtractDays(cleanStartDate, 45);
      const apiSearchStartTime = "00:00"; 
      const apiSearchEndTime = "23:59"; // Sempre 23:59 para garantir que chamados abertos em qualquer horário (ex: à noite) sejam retornados

      console.log(`[CBE Incidentes] Sincronização estendida (45 dias para trás): buscando de ${apiSearchStartDate} ${apiSearchStartTime} até ${cleanEndDate} ${apiSearchEndTime}`);

      let parsedIncidents: any[] = [];
      
      // Como o período estendido cobre de 00:00 até 23:59, não há restrições de horários de abertura na API externa,
      // baixando 100% dos incidentes ativos e permitindo filtros precisos no front-end por último comentário.
      parsedIncidents = await fetchFromBrisanet(apiSearchStartDate, cleanEndDate, apiSearchStartTime, apiSearchEndTime, apiToken);

      console.log(`[CBE Incidentes] Encontrados ${parsedIncidents.length} incidentes na API.`);

      if (parsedIncidents.length === 0) {
        return res.json({
          success: true,
          addedCount: 0,
          updatedCount: 0,
          totalCount: 0,
          message: "Nenhum incidente localizado para o período informado."
        });
      }

      // Reconciliar/atualizar localmente
      const db = await getDbState();
      if (!db["CONTROLE DE INCIDENTES"]) {
        db["CONTROLE DE INCIDENTES"] = [];
      }

      let addedCount = 0;
      let updatedCount = 0;

      const getRowId = (row: any, idx: number) => {
        const keys = Object.keys(row);
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        const possibleKeys = ["id", "chamado", "ticket", "incidente", "protocolo"];
        for (const target of possibleKeys) {
          const foundKey = keys.find(k => norm(k) === target);
          if (foundKey && row[foundKey]) {
            return String(row[foundKey]).trim();
          }
        }
        
        const softKey = keys.find(k => norm(k).includes("id") || norm(k).includes("chamado"));
        if (softKey && row[softKey]) {
          return String(row[softKey]).trim();
        }

        return `gen-inc-${idx}-${Date.now()}`;
      };

      for (let i = 0; i < parsedIncidents.length; i++) {
        const rawRow = parsedIncidents[i];
        const rowId = getRowId(rawRow, i);
        
        // Normaliza as chaves do objeto vindo da API externa para que propriedades oficiais como RFO fiquem mapeadas perfeitamente
        const normalizedRow = normalizeIncidentKeys({ ...rawRow, id: rowId, ID: rowId, operId: rowId });

        const existingIdx = db["CONTROLE DE INCIDENTES"].findIndex((r: any) => String(r.id) === String(rowId));
        if (existingIdx !== -1) {
          const existingRow = db["CONTROLE DE INCIDENTES"][existingIdx];
          
          // Preservar campos que foram validados/atualizados na planilha ou em estado anterior local
          const mergedRow = {
            ...existingRow,
            ...normalizedRow,
            // Garantir que os campos validados fiquem preservados se existirem
            RFO: existingRow.RFO || normalizedRow.RFO || "",
            "Concluído": existingRow["Concluído"] || existingRow["Concluido"] || normalizedRow["Concluído"] || normalizedRow["Concluido"] || "",
            "Concluido": existingRow["Concluído"] || existingRow["Concluido"] || normalizedRow["Concluído"] || normalizedRow["Concluido"] || "",
            "Atenuação Crítica": existingRow["Atenuação Crítica"] || existingRow["Atenuacao Critica"] || normalizedRow["Atenuação Crítica"] || normalizedRow["Atenuacao Critica"] || "",
            "Último Comentário": normalizedRow["Último Comentário"] || normalizedRow["Ultimo Comentario"] || existingRow["Último Comentário"] || existingRow["Ultimo Comentario"] || "",
            "Usuário do Último Comentário": normalizedRow["Usuário do Último Comentário"] || normalizedRow["Usuario do Ultimo Comentario"] || existingRow["Usuário do Último Comentário"] || existingRow["Usuario do Ultimo Comentario"] || "",
            "Data do Último Comentário": normalizedRow["Data do Último Comentário"] || normalizedRow["Data do Ultimo Comentario"] || existingRow["Data do Último Comentário"] || existingRow["Data do Ultimo Comentario"] || "",
          };

          const isDifferent = JSON.stringify(existingRow) !== JSON.stringify(mergedRow);
          if (isDifferent) {
            db["CONTROLE DE INCIDENTES"][existingIdx] = mergedRow;
            updatedCount++;
          }
        } else {
          db["CONTROLE DE INCIDENTES"].push(normalizedRow);
          addedCount++;
        }
      }

      // Limpeza de incidentes cancelados ou removidos da API externa:
      // Qualquer incidente na base local que esteja no período de busca (apiSearchStartDate a cleanEndDate)
      // mas não retornou na resposta atual da API, significa que foi cancelado/deletado.
      const fetchedIds = new Set(parsedIncidents.map((rawRow, idx) => getRowId(rawRow, idx)));
      let deletedCount = 0;

      if (db["CONTROLE DE INCIDENTES"]) {
        db["CONTROLE DE INCIDENTES"] = db["CONTROLE DE INCIDENTES"].filter((item: any) => {
          const itemId = String(item.id || item.ID || "").trim();
          // Ignorar incidentes simulados/gerados localmente
          if (itemId.startsWith("gen-inc-")) {
            return true;
          }

          // Verificar se a data de abertura do incidente local está dentro do período de sincronização de 45 dias
          const itemDateStr = String(item["Data de Abertura"] || "").substring(0, 10).trim();
          if (itemDateStr >= apiSearchStartDate && itemDateStr <= cleanEndDate) {
            // Se cair no período de busca mas não foi retornado pela API Brisanet, ele foi cancelado/excluído
            if (!fetchedIds.has(itemId)) {
              console.log(`[CBE Incidentes Sync] Removendo incidente cancelado/excluído no servidor da API: ID ${itemId}`);
              deletedCount++;
              return false;
            }
          }
          return true;
        });
      }

      await fs.writeFile("./data/database.json", JSON.stringify(db, null, 2), "utf-8");
      console.log(`[CBE Incidentes] Sincronização local concluída: ${addedCount} adicionados, ${updatedCount} atualizados, ${deletedCount} cancelados/removidos.`);

      // Sincronização secundária com a planilha em background para não atrasar a resposta ao usuário
      syncWithSpreadsheet(WEb_APP_API_URL).catch(syncErr => {
        console.error("[CBE Incidentes] Sincronização em background com a planilha falhou:", syncErr);
      });

      res.json({
        success: true,
        addedCount,
        updatedCount,
        totalCount: parsedIncidents.length,
        incidents: db["CONTROLE DE INCIDENTES"]
      });

    } catch (err: any) {
      console.error("[CBE Fetch Incidentes Error]", err);
      res.status(500).json({
        success: false,
        error: err.message || "Erro interno ao buscar incidentes da API DWDM."
      });
    }
  });

  // Endpoint para gerar a análise inteligente (IA Gemini ou Fallback Estruturado)
  app.post("/api/incidentes/analise", async (req, res) => {
    try {
      const { incidents } = req.body;
      if (!incidents || !Array.isArray(incidents) || incidents.length === 0) {
        return res.status(400).json({ success: false, error: "Nenhum incidente fornecido para análise." });
      }

      const ai = getAiClient();
      if (!ai) {
        console.log("[CBE Analise] GEMINI_API_KEY não localizada. Utilizando fallback analítico estruturado...");
        const report = generateStructuredCodeReport(incidents);
        return res.json({
          success: true,
          report,
          isAiGenerated: false
        });
      }

      console.log(`[CBE Analise] Iniciando geração de análise com Gemini (3.5-flash) para ${incidents.length} incidentes...`);
      const maxIncidents = incidents.slice(0, 80);
      const incidentsStr = JSON.stringify(maxIncidents, null, 2);

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Você é um Engenheiro de Telecomunicações especialista em redes DWDM. Analise a seguinte lista de incidentes obtida do sistema de monitoramento no formato JSON:

${incidentsStr}

Por favor, gere um Relatório Executivo de Controle de Incidentes estruturado e profissional (em português do Brasil) utilizando formatação Markdown. O relatório deve conter:
1. **Resumo Executivo**: Uma visão geral do estado atual da rede DWDM com base nos incidentes fornecidos.
2. **Métricas de Impacto**: Análise quantitativa (ex: total de incidentes, tipos mais comuns, severidades/prioridades).
3. **Pontos Críticos Identificados**: Quais trechos, estações ou redes apresentaram mais falhas.
4. **Recomendações Técnicas**: Ações preventivas ou corretivas imediatas e de longo prazo para estabilizar os trechos mais críticos.

Seja objetivo, técnico, focado na confiabilidade da rede DWDM e utilize formatação elegante com tabelas e listas.`
      });

      res.json({
        success: true,
        report: response.text,
        isAiGenerated: true
      });
    } catch (err: any) {
      console.error("[CBE Gemini Analise Error]", err);
      // Fallback gracioso
      try {
        const fallbackIncidents = req.body.incidents || [];
        const report = generateStructuredCodeReport(fallbackIncidents);
        return res.json({
          success: true,
          report,
          isAiGenerated: false,
          warning: "Falha ao consultar IA (usando gerador interno): " + err.message
        });
      } catch (innerErr) {
        res.status(500).json({
          success: false,
          error: "Erro ao gerar análise dos incidentes",
          details: err.message
        });
      }
    }
  });

  // Endpoint de Importação Completa (Limpar base local e sobrescrever com tudo da planilha)
  app.post("/api/sheets/import-reset", async (req, res) => {
    try {
      console.log("[CBE Import Reset] Forçando importação limpa e resetando base local...");
      const result = await forceResetAndImport(WEb_APP_API_URL);
      if (result.success) {
        res.json({ success: true, message: "Banco de dados local limpo e reimportado com sucesso!" });
      } else {
        res.status(502).json({ success: false, error: result.error || "Falha na sincronização direta." });
      }
    } catch (err: any) {
      console.error("[CBE Import Reset ERROR]", err);
      res.status(500).json({ success: false, error: "Erro de processamento no reset/import", details: err.message });
    }
  });

  // Proxy POST: Insere, atualiza ou exclui registros no banco local, enfileirando alteração para sync
  app.post("/api/sheets", async (req, res) => {
    try {
      const { action, sheetName, rowData } = req.body;

      if (!action || !sheetName) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos. É necessário 'action' e 'sheetName'." });
      }

      const sheetUpper = String(sheetName).toUpperCase().trim();
      if (sheetUpper === "USERS" || sheetUpper === "USUARIOS" || sheetUpper === "USUÁRIOS") {
        console.log(`[CBE Write API] Alteração de USERS interceptada. Operadores são gerenciados com exclusividade via Supabase Auth.`);
        const updatedDb = await registerLocalChange(sheetName, action, rowData);
        return res.json({
          success: true,
          syncSuccess: true,
          message: "Operador gerenciado via Supabase Auth. Cache local atualizado com segurança.",
          pendingChangesCount: (updatedDb.pendingChanges || []).length
        });
      }

      console.log(`[CBE Write API] Registrando alteração local (${action}) para tabela [${sheetName}]`);
      const updatedDb = await registerLocalChange(sheetName, action, rowData);
      
      console.log(`[CBE Write API] Iniciando sincronização em background com Google Sheets para a tabela [${sheetName}]...`);
      // Execução assíncrona em background para liberar o cliente de imediato!
      syncWithSpreadsheet(WEb_APP_API_URL)
        .then((syncResult) => {
          if (syncResult.success) {
            console.log(`[CBE Write API Background Sync] Sincronização para [${sheetName}] concluída com sucesso.`);
          } else {
            console.warn(`[CBE Write API Background Sync] Sincronização para [${sheetName}] aviso:`, syncResult.error);
          }
        })
        .catch((syncErr) => {
          console.error(`[CBE Write API Background Sync] Erro catastrófico:`, syncErr);
        });

      res.json({
        success: true,
        syncSuccess: true,
        message: "Alteração registrada localmente com sucesso! Sincronização em background iniciada.",
        pendingChangesCount: updatedDb.pendingChanges.length
      });
    } catch (err: any) {
      console.error("[CBE Proxy ERROR] Falha ao registrar modificações no banco de dados local ou na planilha:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Erro na gravação local de destino",
        details: err.message || String(err)
      });
    }
  });

  // Middleware do Vite (desenvolvimento) ou Arquivos Estáticos (produção)
  if (process.env.NODE_ENV !== "production") {
    console.log("[CBE Server] Iniciando no modo DESENVOLVIMENTO (Vite Middleware)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[CBE Server] Iniciando no modo PRODUÇÃO");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CBE Server] Rodando com sucesso em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("[CBE Server Critical Fail] Falha fatal na inicialização:", error);
});
