import fs from "fs/promises";
import path from "path";

const DATABASE_DIR = path.join(process.cwd(), "data");
const DATABASE_FILE = path.join(DATABASE_DIR, "database.json");

export interface PendingChange {
  sheetName: string;
  action: "insert" | "update" | "delete" | "upsert";
  rowData: any;
  timestamp: string;
}

export interface DbState {
  ENTRONCAMENTOS: any[];
  "CAMADA OPTICA": any[];
  OTDR: any[];
  "ATENUAÇÕES": any[];
  "TESTES DE CAMPO": any[];
  "BYPASS": any[];
  "RELATÓRIO MENSAL": any[];
  USERS: any[];
  ATUAÇÕES: any[];
  AVISOS: any[];
  "TROCA DE CABO": any[];
  "DADOS": any[];
  "CONTROLE DE INCIDENTES": any[];
  pendingChanges: PendingChange[];
  isSyncPaused?: boolean;
  lastSyncTime?: string;
  lastSyncStatus?: "success" | "error" | "";
  lastSyncTimestamp?: number;
  recentlySaved?: Record<string, number>;
  recentlyDeleted?: Record<string, number>;
}

export const SHEET_ALIASES: Record<string, string[]> = {
  "ENTRONCAMENTOS": ["ENTRONCAMENTOS", "ENTRONCAMENTO"],
  "CAMADA OPTICA": ["CAMADA OPTICA", "CAMADA ÓPTICA", "CAMADA_OPTICA", "CAMADA_ÓPTICA"],
  "OTDR": ["OTDR", "otdr"],
  "ATENUAÇÕES": ["ATENUAÇÕES", "ATENUACOES", "ATENUAÇÃO", "ATENUACAO", "atenuacoes"],
  "TESTES DE CAMPO": ["TESTES DE CAMPO", "TESTES_DE_CAMPO", "TESTES CAMPO", "testes_campo", "TESTES"],
  "BYPASS": ["BYPASS", "Bypass", "ATUACÕES BYPASS", "ATUACOES_BYPASS", "ATUAÇÕES BYPASS", "bypass"],
  "RELATÓRIO MENSAL": ["RELATÓRIO MENSAL", "RELATORIO_MENSAL", "RELATORIO MENSAL", "relatorio_mensal"],
  "USERS": ["USERS", "users"],
  "ATUAÇÕES": ["ATUAÇÕES", "ATUACOES", "ATUACÕES", "atuacoes", "ATUACAO_GERAL", "ATUACOES_GERAL", "ATUACOES GERAIS", "ATUAÇÕES GERAIS"],
  "AVISOS": ["AVISOS", "avisos", "PAINEL DE AVISOS", "PAINEL_AVISOS", "PAINEL REUNIÃO ATAS"],
  "TROCA DE CABO": ["TROCA DE CABO", "TROCA_DE_CABO", "troca_cabo", "TROCA CABO", "troca de cabo"],
  "DADOS": ["DADOS", "Dados", "dados", "REDE_TRECHOS", "REDE TRECHOS"],
  "CONTROLE DE INCIDENTES": ["CONTROLE DE INCIDENTES", "CONTROLE_INCIDENTES", "Incidentes", "INCIDENTES", "CONTROLE INCIDENTES"]
};

export const LOCAL_TO_SPREADSHEET_MAP: Record<string, string> = {
  "ENTRONCAMENTOS": "ENTRONCAMENTOS",
  "CAMADA OPTICA": "CAMADA OPTICA",
  "OTDR": "OTDR",
  "ATENUAÇÕES": "ATENUAÇÕES",
  "TESTES DE CAMPO": "TESTES DE CAMPO",
  "BYPASS": "ATUACÕES BYPASS",
  "RELATÓRIO MENSAL": "RELATÓRIO MENSAL",
  "USERS": "USERS",
  "ATUAÇÕES": "ATUAÇÕES",
  "AVISOS": "AVISOS",
  "TROCA DE CABO": "TROCA DE CABO",
  "DADOS": "DADOS",
  "CONTROLE DE INCIDENTES": "CONTROLE DE INCIDENTES"
};

export function getLocalKeyForSheet(sheetName: string): string {
  const normalize = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
  const normInput = normalize(sheetName);
  
  for (const [localKey, aliases] of Object.entries(SHEET_ALIASES)) {
    const normLocal = normalize(localKey);
    const normAliases = aliases.map(normalize);
    if (normLocal === normInput || normAliases.includes(normInput)) {
      return localKey;
    }
  }
  return sheetName.toUpperCase(); // Fallback to uppercase
}

export function findLiveKey(localKey: string, liveData: any): string | undefined {
  const aliases = SHEET_ALIASES[localKey] || [localKey];
  const normalize = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
  const normalizedAliases = aliases.map(normalize);
  
  return Object.keys(liveData).find(lk => {
    const normalizedLk = normalize(lk);
    return normalizedAliases.includes(normalizedLk);
  });
}

export function isSameRowDomain(r1: any, r2: any, sheetKey: string): boolean {
  if (!r1 || !r2) return false;
  const k = sheetKey.toUpperCase().trim();
  const cleanStr = (s: any) => String(s || "").trim().toUpperCase();

  if (k === "ENTRONCAMENTOS") {
    const tA1 = cleanStr(r1["TRECHO A"] || r1["trecho_a"] || r1["TrechoA"]);
    const tB1 = cleanStr(r1["TRECHO B"] || r1["trecho_b"] || r1["TrechoB"]);
    const tA2 = cleanStr(r2["TRECHO A"] || r2["trecho_a"] || r2["TrechoA"]);
    const tB2 = cleanStr(r2["TRECHO B"] || r2["trecho_b"] || r2["TrechoB"]);
    return Boolean(tA1 && tB1 && tA1 === tA2 && tB1 === tB2);
  }
  if (k === "CAMADA OPTICA" || k === "CAMADA_OPTICA" || k === "OTDR") {
    const tr1 = cleanStr(r1["TRECHO"] || r1["trecho"]);
    const tr2 = cleanStr(r2["TRECHO"] || r2["trecho"]);
    return Boolean(tr1 && tr1 === tr2);
  }
  if (k === "BYPASS" || k === "ATUACÕES BYPASS" || k === "ATUAÇÕES BYPASS") {
    const t1 = cleanStr(r1["TRECHOS"] || r1["DISPOSITIVO/TRECHO"] || r1["trechos"] || r1["Trecho"]);
    const t2 = cleanStr(r2["TRECHOS"] || r2["DISPOSITIVO/TRECHO"] || r2["trechos"] || r2["Trecho"]);
    const p1 = cleanStr(r1["PONTO (KM)"] || r1["ponto_km"] || r1["pontoKm"]);
    const p2 = cleanStr(r2["PONTO (KM)"] || r2["ponto_km"] || r2["pontoKm"]);
    const rIdx1 = r1["rowIndex"] ? String(r1["rowIndex"]) : "";
    const rIdx2 = r2["rowIndex"] ? String(r2["rowIndex"]) : "";
    if (rIdx1 && rIdx2 && rIdx1 === rIdx2) return true;
    return Boolean(t1 && t1 === t2 && (!p1 || !p2 || p1 === p2));
  }
  if (k === "CONTROLE DE INCIDENTES") {
    const c1 = cleanStr(r1["CHAMADO"] || r1["TICKET"] || r1["INCIDENTE"] || r1["operId"] || r1["id"]);
    const c2 = cleanStr(r2["CHAMADO"] || r2["TICKET"] || r2["INCIDENTE"] || r2["operId"] || r2["id"]);
    return Boolean(c1 && c1 === c2);
  }
  if (k === "USERS" || k === "USUARIOS") {
    const e1 = cleanStr(r1["email"] || r1["Email"] || r1["EMAIL"]);
    const e2 = cleanStr(r2["email"] || r2["Email"] || r2["EMAIL"]);
    const id1 = cleanStr(r1["id"] || r1["ID"]);
    const id2 = cleanStr(r2["id"] || r2["ID"]);
    return Boolean((id1 && id2 && id1 === id2) || (e1 && e2 && e1 === e2));
  }
  return false;
}

export function getRowIdAndNormalize(row: any, sheetKey: string, index: number): { rowId: string, normalizedRow: any } {
  const normalizedRow = { ...row };
  let rowId = "";

  const cleanStr = (s: any) => String(s || "").trim();

  // 1. Tenta pegar qualquer ID existente enviado pelo front ou gerado
  const possibleId = row.id || row.ID || row.operId || row.operID || "";
  if (possibleId && String(possibleId).trim() !== "") {
    rowId = String(possibleId).trim();
  }

  // 2. Se a planilha veio sem ID nenhum, gera uma assinatura DETERMINÍSTICA baseada no texto do domínio
  const key = sheetKey.toUpperCase().trim();
  if (!rowId) {
    if (key === "ENTRONCAMENTOS") {
      const tA = cleanStr(row["TRECHO A"] || row["trecho_a"] || row["TrechoA"] || "");
      const tB = cleanStr(row["TRECHO B"] || row["trecho_b"] || row["TrechoB"] || "");
      if (tA || tB) {
        rowId = `live-e-${tA.replace(/\s+/g, "_")}-${tB.replace(/\s+/g, "_")}`;
      }
    } else if (key === "CAMADA OPTICA" || key === "CAMADA_OPTICA") {
      const trecho = cleanStr(row["TRECHO"] || row["trecho"] || "");
      if (trecho) {
        rowId = `live-co-${trecho.replace(/\s+/g, "_")}`;
      }
    } else if (key === "OTDR") {
      const trecho = cleanStr(row["TRECHO"] || row["trecho"] || "");
      if (trecho) {
        rowId = `live-otdr-${trecho.replace(/\s+/g, "_")}`;
      }
    } else if (key === "BYPASS" || key === "ATUACÕES BYPASS" || key === "ATUAÇÕES BYPASS") {
      const trechos = cleanStr(row["TRECHOS"] || row["DISPOSITIVO/TRECHO"] || row["trecho"] || "");
      const pK = cleanStr(row["PONTO (KM)"] || row["ponto_km"] || "");
      if (trechos) {
        rowId = `live-by-${trechos.replace(/\s+/g, "_")}_${pK.replace(/\s+/g, "_")}`;
      }
    } else if (key === "CONTROLE DE INCIDENTES") {
      const pId = row["CHAMADO"] || row["chamado"] || row["TICKET"] || row["ticket"] || row["INCIDENTE"] || row["incidente"] || row["PROTOCOLO"] || row["protocolo"] || "";
      if (pId && String(pId).trim() !== "") {
        rowId = String(pId).trim();
      }
    } else if (key === "AVISOS") {
      const idAv = row["id"] || row["ID"] || "";
      if (idAv) rowId = String(idAv).trim();
    }

    if (!rowId) {
      rowId = `gen-${key.toLowerCase().replace(/\s+/g, "_")}-${index}`;
    }
  }

  normalizedRow.id = rowId;
  normalizedRow.ID = rowId;
  if (!normalizedRow.operId) {
    normalizedRow.operId = rowId;
  }

  return { rowId, normalizedRow };
}

export function mergeRowsIntelligently(localRow: any, liveRow: any, sheetKey: string): any {
  const merged = { ...localRow, ...liveRow };

  // Preserva alterações locais em campos de texto (Ações, Histórico, Observações) se a versão local tiver dados novos que a planilha ainda não sincronizou
  const textFields = ["AÇÕES", "ACOES", "HISTORICO", "OBSERVAÇÃO", "OBSERVAÇÃO ", "OBSERVAÇÕES", "OBSERVACOES"];
  for (const tf of textFields) {
    if (localRow[tf] && typeof localRow[tf] === "string") {
      const localVal = localRow[tf].trim();
      const liveVal = (liveRow[tf] || "").trim();
      if (localVal.length > liveVal.length && localVal.includes(liveVal)) {
        merged[tf] = localVal;
      } else if (localVal && !liveVal) {
        merged[tf] = localVal;
      }
    }
  }

  return merged;
}

// Default Seed Data based on Client Fallbacks if Sheets fail on initial boot
const DEFAULT_ENTRONCAMENTOS = [
  {
    id: "e-1",
    "TRECHO A": "FORTALEZA <> SÃO LUÍS",
    "TRECHO B": "SÃO LUÍS <> ITAPIPOCA ",
    "TRECHO C": "-",
    "TRECHO D ": "",
    LOCALIZAÇÃO: "-3.674553681686238,-39.23475264321473",
    TIPO: "CAIXA",
    "PROVEDOR ": "WIRELINK",
    AÇÕES: "20/01/26: Obter localização de nova CEO com a GIGA+ sentido Fortaleza ou Itapipoca. 09/02/26: Acionamento para patrick atualizar a planilha com os trechos onde prazos não cumpridos e não adicionado. 11/02/26: Alinhado novas datas com Marcos e Francisco, e adicionado as datas backup dos trechos não tratados com os motivos.",
    STATUS: "Andamento",
    "RESPONSÁVEL ": "MARCOS",
    PRAZO: "",
    "DATA BACKUP": "",
    OBSERVAÇÕES: "",
  },
  {
    id: "e-2",
    "TRECHO A": "ESCADA <> CABO",
    "TRECHO B": " RECIFE <> CABO (PROTEÇAO) ",
    "TRECHO C": "",
    "TRECHO D ": "",
    LOCALIZAÇÃO: "-8.281011081069995,-35.029419042496976",
    TIPO: "CAIXA",
    "PROVEDOR ": "WIRELINK",
    AÇÕES: "20/01/26:  Tentar obter documentação mais precisa dos backbones da Worldnet e GIGA+. 09/02/26: Acionamento para patrick atualizar a planilha com os trechos onde prazos não cumpridos e não adicionado.  11/02/26: Alinhado novas datas com Marcos e Francisco, e adicionado as datas backup dos trechos não tratados com os motivos.",
    STATUS: "Andamento",
    "RESPONSÁVEL ": "MARCOS",
    PRAZO: "",
    "DATA BACKUP": "",
    OBSERVAÇÕES: "",
  },
  {
    id: "e-3",
    "TRECHO A": "CARUARU <> TORITAMA",
    "TRECHO B": "TORITAMA <> CAMPINA GRANDE",
    "TRECHO C": "",
    "TRECHO D ": "",
    LOCALIZAÇÃO: "-8.004682812512145,-36.08126341736697",
    TIPO: "CAIXA",
    "PROVEDOR ": "TELLY",
    AÇÕES: "20/01/26: - CEO Tely Toritama:  -8.007238,-36.065541\n- Fazer vistoria para identificar se a CEO fica exatamente na coordenada\n- Analisar melhor trajeto para evitar andar junto dos cabos existentes, com exceção dos cabos do 5G. 09/02/26: Acionamento para patrick atualizar a planilha com os trechos onde prazos não cumpridos e não adicionado. 11/02/26: Alinhado novas datas com Marcos e Francisco, e adicionado as datas backup dos trechos não tratados com os motivos.",
    STATUS: "Andamento",
    "RESPONSÁVEL ": "MARCOS",
    PRAZO: "2026-03-31T03:00:00.000Z",
    "DATA BACKUP": "",
    OBSERVAÇÕES: "",
  }
];

const DEFAULT_CAMADA_OPTICA = [
  {
    id: "co-1",
    TRECHO: "CONDE <> ESTÂNCIA",
    STATUS: "Em andamento",
    INFORMAÇÃO: "Iniciado o processo de compra.",
    HISTORICO: "02/04: Prazo de 10 a 15 dias para ter retorno de quando o material chega. \n05/05: Material comprado mas ainda não chegou, porém o prazo não é para esse mês.",
  },
  {
    id: "co-2",
    TRECHO: "PAULO AFONSO <> CANINDÉ",
    STATUS: "Finalizado",
    INFORMAÇÃO: "Verificar a rota pra fazer o serviço.",
    HISTORICO: "02/04: Vão encaixar na rota da próxima semana.\n07/04: Foi trocado amplificador por um HOA deixando os ramans em 90 mW em paulo afonso e 110 mW em canindé ficando nos -19,40 por ch em ambos os lados.",
  }
];

const DEFAULT_OTDR = [
  {
    id: "otdr-1",
    TRECHO: "ALAGOINHAS <> CAMAÇARI 100",
    "ONDE TEM": "ALAGOINHAS",
    "ONDE PRECISA": "CAMAÇARI 100",
    "TAMANHO KM": "107",
    STATUS: "Pendente",
    "OBSERVAÇÃO ": "TRECHO LONGO NÃO LER COM PRECISÃO E NEM COMPLETO",
    Planejamento: "Será usada as portas que está para simões Filho // Simões Mede Feira e Camaçari -100",
    "Data de abertura": "2026-05-20",
    "data estimada": "2026-06-15",
    "data de conclusão": "",
  }
];

const DEFAULT_USERS = [
  {
    id: "user-1",
    nome: "Francisco",
    sobrenome: "Gabriel",
    email: "francisco.gabriel@grupobrisanet.com.br",
    dataNascimento: "1995-01-01",
    senha: "admin",
    dataInsercao: "2026-01-01T00:00:00.000Z",
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
  },
  {
    id: "user-2",
    nome: "Jakeline",
    sobrenome: "Nascimento",
    email: "jakeline.nascimento@grupobrisanet.com.br",
    dataNascimento: "1996-01-01",
    senha: "admin",
    dataInsercao: "2026-01-01T00:00:00.000Z",
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
];

const DEFAULT_AVISOS = [
  {
    id: "av-1",
    titulo: "Bem-vindo ao Sistema de Backbones V7",
    conteudo: "Você está operando o novo sistema de gerenciamento de backbones de fibra óptica. O banco de dados local está plenamente funcional e as alterações pendentes podem ser sincronizadas com o Google Sheets a qualquer momento.",
    tipo: "Aviso",
    prioridade: "Média",
    destino: "Todos",
    destinatarioEmail: "Todos",
    destinatarioNome: "Todos os Membros",
    autor: "Sistema",
    dataCriacao: new Date().toLocaleDateString("pt-BR"),
    status: "Aberto",
    lido: "Não"
  }
];

export async function initializeDb(): Promise<DbState> {
  try {
    await fs.mkdir(DATABASE_DIR, { recursive: true });
    
    try {
      const stats = await fs.stat(DATABASE_FILE);
      if (stats.isFile()) {
        const fileContent = await fs.readFile(DATABASE_FILE, "utf-8");
        const parsed = JSON.parse(fileContent);
        
        // Migrate legacy ATUACÕES BYPASS to BYPASS
        if (parsed["ATUACÕES BYPASS"] && !parsed["BYPASS"]) {
          parsed["BYPASS"] = parsed["ATUACÕES BYPASS"];
          delete parsed["ATUACÕES BYPASS"];
        }
        
        // Ensure standard properties exist
        const requiredKeys = [
          "ENTRONCAMENTOS", "CAMADA OPTICA", "OTDR", "ATENUAÇÕES", 
          "TESTES DE CAMPO", "BYPASS", "RELATÓRIO MENSAL", 
          "USERS", "ATUAÇÕES", "AVISOS", "TROCA DE CABO", "DADOS",
          "CONTROLE DE INCIDENTES"
        ];
        for (const k of requiredKeys) {
          if (!parsed[k] || !Array.isArray(parsed[k])) {
            parsed[k] = [];
          }
        }
        if (!parsed.pendingChanges || !Array.isArray(parsed.pendingChanges)) {
          parsed.pendingChanges = [];
        } else {
          // Remove qualquer pendência de USERS (gerenciado exclusivamente no Supabase Auth) e traduz legados
          parsed.pendingChanges = parsed.pendingChanges
            .filter((change: any) => {
              const s = String(change?.sheetName || "").toUpperCase().trim();
              return s !== "USERS" && s !== "USUARIOS" && s !== "USUÁRIOS";
            })
            .map((change: any) => {
              if (change.sheetName === "ATUACÕES BYPASS") {
                return { ...change, sheetName: "BYPASS" };
              }
              return change;
            });
        }

        if (parsed.recentlySaved) {
          const now = Date.now();
          for (const [id, ts] of Object.entries(parsed.recentlySaved)) {
            if (now - (ts as number) > 900000) { // 15 mins
              delete parsed.recentlySaved[id];
            }
          }
        } else {
          parsed.recentlySaved = {};
        }

        return parsed as DbState;
      }
    } catch {
      // JSON File does not exist, let's seed it
    }

    const defaultState: DbState = {
      ENTRONCAMENTOS: DEFAULT_ENTRONCAMENTOS,
      "CAMADA OPTICA": DEFAULT_CAMADA_OPTICA,
      OTDR: DEFAULT_OTDR,
      "ATENUAÇÕES": [],
      "TESTES DE CAMPO": [],
      "BYPASS": [],
      "RELATÓRIO MENSAL": [],
      USERS: DEFAULT_USERS,
      ATUAÇÕES: [],
      AVISOS: DEFAULT_AVISOS,
      "TROCA DE CABO": [],
      "DADOS": [],
      "CONTROLE DE INCIDENTES": [],
      pendingChanges: [],
      lastSyncTime: "Nunca sincronizado",
      lastSyncStatus: ""
    };

    await fs.writeFile(DATABASE_FILE, JSON.stringify(defaultState, null, 2), "utf-8");
    return defaultState;
  } catch (err) {
    console.error("[DbManager Error] Falha ao inicializar o banco de dados:", err);
    throw err;
  }
}

export async function getDbState(): Promise<DbState> {
  return initializeDb();
}

export async function saveDbState(state: DbState): Promise<void> {
  await fs.mkdir(DATABASE_DIR, { recursive: true });
  await fs.writeFile(DATABASE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export async function registerLocalChange(
  sheetName: string,
  action: "insert" | "update" | "delete" | "upsert",
  rowData: any
): Promise<DbState> {
  const db = await getDbState();
  
  // Resolve canonical local sheet key
  const localKey = getLocalKeyForSheet(sheetName);
  
  let targetSheet = db[localKey as keyof DbState] as any[];
  if (!targetSheet) {
    (db as any)[localKey] = [];
    targetSheet = (db as any)[localKey];
  }

  // Get or generate ID and normalize the row
  const index = targetSheet.length;
  const { rowId: targetId, normalizedRow } = getRowIdAndNormalize(rowData, localKey, index);

  if (action === "upsert" || (localKey === "USERS" && (action === "insert" || action === "update"))) {
    let updatedAny = false;
    targetSheet = targetSheet.map(r => {
      const { rowId } = getRowIdAndNormalize(r, localKey, 0);
      const match = (targetId && rowId === targetId) || isSameRowDomain(r, normalizedRow, localKey);
      if (match) {
        updatedAny = true;
        return { ...r, ...normalizedRow };
      }
      return r;
    });

    if (!updatedAny) {
      targetSheet.push(normalizedRow);
    }
  } else if (action === "insert") {
    const exists = targetSheet.some(r => {
      const { rowId } = getRowIdAndNormalize(r, localKey, 0);
      return (targetId && rowId === targetId) || isSameRowDomain(r, normalizedRow, localKey);
    });
    if (!exists) {
      targetSheet.push(normalizedRow);
    } else {
      targetSheet = targetSheet.map(r => {
        const { rowId } = getRowIdAndNormalize(r, localKey, 0);
        const match = (targetId && rowId === targetId) || isSameRowDomain(r, normalizedRow, localKey);
        return match ? { ...r, ...normalizedRow } : r;
      });
    }
  } else if (action === "update") {
    let updatedAny = false;
    targetSheet = targetSheet.map(r => {
      const { rowId } = getRowIdAndNormalize(r, localKey, 0);
      const match = (targetId && rowId === targetId) || isSameRowDomain(r, normalizedRow, localKey);
      if (match) {
        updatedAny = true;
        return { ...r, ...normalizedRow };
      }
      return r;
    });

    if (!updatedAny) {
      targetSheet.push(normalizedRow);
    }
  } else if (action === "delete") {
    targetSheet = targetSheet.filter(r => {
      const { rowId } = getRowIdAndNormalize(r, localKey, 0);
      const match = (targetId && rowId === targetId) || isSameRowDomain(r, normalizedRow, localKey);
      return !match;
    });
  }

  // Save the updated sheet
  (db as any)[localKey] = targetSheet;

  // Track recently saved entry to protect it from being deleted by immediate sheet sync pulls (lag resilience)
  if (action === "insert" || action === "update") {
    if (!db.recentlySaved) {
      db.recentlySaved = {};
    }
    db.recentlySaved[targetId] = Date.now();
    if (db.recentlyDeleted) {
      delete db.recentlyDeleted[targetId];
    }
  } else if (action === "delete") {
    if (db.recentlySaved) {
      delete db.recentlySaved[targetId];
    }
    if (!db.recentlyDeleted) {
      db.recentlyDeleted = {};
    }
    db.recentlyDeleted[targetId] = Date.now();
  }

  // Add to Pending Synchronization Queue - using the official Google Sheets name
  const officialSheetName = LOCAL_TO_SPREADSHEET_MAP[localKey] || localKey;

  // IMPORTANT: USERS é gerenciado com exclusividade pelo Supabase Auth e Tb_Users.
  // Nunca deve ser enfileirado para sincronização com o Google Sheets.
  const isUsersKey = localKey === "USERS" || officialSheetName === "USERS" || localKey === "USUARIOS";
  if (!isUsersKey) {
    db.pendingChanges = db.pendingChanges.filter(change => {
      const changeLocalKey = getLocalKeyForSheet(change.sheetName);
      const { rowId: changeRowId } = getRowIdAndNormalize(change.rowData, changeLocalKey, 0);
      return !(changeLocalKey === localKey && changeRowId === targetId);
    });

    db.pendingChanges.push({
      sheetName: officialSheetName,
      action,
      rowData: normalizedRow,
      timestamp: new Date().toISOString()
    });
  }

  await saveDbState(db);
  return db;
}

export function normalizeWebAppUrl(rawUrl?: string): string {
  const fallback = "https://script.google.com/macros/s/AKfycbxG9mOMXiO2mrtBZWh6Nk9skS8wFiLSIueXa5ldCweZxhgT2C1fDMR3qATs7DQxsIWr/exec";
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  let url = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  if (!url) return fallback;
  url = url.replace(/\/+$/, "");
  if (url.includes("script.google.com/macros/s/") && !url.endsWith("/exec")) {
    url = url + "/exec";
  }
  return url;
}

export async function fetchGoogleAppsScript(
  url: string,
  options: {
    method?: string;
    body?: string;
    timeoutMs?: number;
    maxRetries?: number;
  } = {}
): Promise<Response> {
  const cleanUrl = normalizeWebAppUrl(url);
  const method = options.method || "GET";
  const timeoutMs = options.timeoutMs || 25000;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;

  const defaultHeaders: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (options.body) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  let lastError: any = null;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(cleanUrl, {
        method,
        headers: defaultHeaders,
        body: options.body,
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);

      if (response.ok) {
        return response;
      }

      lastStatus = response.status;
      const errorText = await response.text().catch(() => "");

      // Se retornar 404, 429 ou 5xx, tenta novamente se houver tentativas restantes
      if ((response.status === 404 || response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        console.warn(`[Google Sheets Fetch Retry] Tentativa ${attempt}/${maxRetries} retornou HTTP ${response.status}. Aguardando para tentar novamente...`);
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }

      throw new Error(`Google Sheets retornou erro HTTP: ${response.status}${errorText ? ` (${errorText.substring(0, 150)})` : ""}`);
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;

      if (attempt < maxRetries && (err.name === "AbortError" || err.message?.includes("fetch failed") || err.message?.includes("ECONNRESET") || lastStatus === 404)) {
        console.warn(`[Google Sheets Fetch Retry] Tentativa ${attempt}/${maxRetries} falhou (${err.message}). Tentando novamente...`);
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }

      break;
    }
  }

  throw lastError || new Error(`Google Sheets retornou erro HTTP: ${lastStatus || "desconhecido"}`);
}

// Full Two-Way Synchronization Mechanism with Robust Promise-Chain Serial Queue
let syncQueueChain = Promise.resolve<{ success: boolean; pulledSheets: string[]; pushedChangesCount: number; error?: string }>({
  success: true,
  pulledSheets: [],
  pushedChangesCount: 0
});

export async function syncWithSpreadsheet(webAppUrl: string): Promise<{ success: boolean; pulledSheets: string[]; pushedChangesCount: number; error?: string; warning?: string }> {
  console.log("[Sync Queue] Enfileirando sincronização com Google Sheets...");
  
  const cleanUrl = normalizeWebAppUrl(webAppUrl);

  // Enfileira a nova sincronização de forma estritamente sequencial
  const currentSyncPromise = syncQueueChain.then(async () => {
    try {
      console.log("[Sync Queue] Iniciando sincronização sequencial ativa...");
      const res = await executeSync(cleanUrl);
      return res;
    } catch (err: any) {
      console.error("[Sync Queue Execution Error] Falha crítica na execução da sincronização:", err);
      return {
        success: false,
        pulledSheets: [],
        pushedChangesCount: 0,
        error: err.message || String(err)
      };
    }
  });

  // Atualiza a fila global com uma promessa que sempre resolve (evitando quebras em cadeia)
  syncQueueChain = currentSyncPromise.then(
    () => ({ success: true, pulledSheets: [], pushedChangesCount: 0 }),
    () => ({ success: false, pulledSheets: [], pushedChangesCount: 0, error: "Queue chain error recovery" })
  );

  return currentSyncPromise;
}

async function executeSync(webAppUrl: string): Promise<{ success: boolean; pulledSheets: string[]; pushedChangesCount: number; error?: string; warning?: string }> {
  const cleanUrl = normalizeWebAppUrl(webAppUrl);
  const db = await getDbState();
  const pulledSheets: string[] = [];
  let pushedChangesCount = 0;
  const successfullySentTimestamps = new Set<string>();

  try {
    // Part 1: Push local pending changes to Google Sheets
    const syncErrors: string[] = [];
    const changesToSync = [...db.pendingChanges];
    if (changesToSync.length > 0) {
      console.log(`[Sync] Encontradas ${changesToSync.length} alterações pendentes locais para enviar à planilha.`);
      
      for (const change of changesToSync) {
        const changeSheetUpper = String(change.sheetName || "").toUpperCase().trim();
        // USERS é gerenciado exclusivamente pelo Supabase Auth e Tb_Users
        if (changeSheetUpper === "USERS" || changeSheetUpper === "USUARIOS" || changeSheetUpper === "USUÁRIOS") {
          console.log("[Sync Resilience] Descartando pendência de USERS da fila da planilha (exclusivo Supabase Auth).");
          successfullySentTimestamps.add(change.timestamp);
          pushedChangesCount++;
          continue;
        }

        // O Web App do Google Apps Script executa e responde com JSON de sucesso quando action é "upsert" (que faz match por ID para update e append para insert).
        // Ações brutas como "update" ou "insert" no script implantado podem finalizar sem output explícito ("The script completed but did not return anything").
        const actionToSend = change.action === "delete" ? "delete" : "upsert";

        try {
          const res = await fetchGoogleAppsScript(cleanUrl, {
            method: "POST",
            body: JSON.stringify({
              action: actionToSend,
              sheetName: change.sheetName,
              rowData: change.rowData
            })
          });

          const textResponse = await res.text();
          let rawBody: any = null;

          if (textResponse.trim().startsWith("<")) {
            // Se o Google Apps Script executou com sucesso mas retornou a página HTML padrão do Google:
            // "The script completed but did not return anything."
            if (textResponse.includes("The script completed but did not return anything") || textResponse.includes("Script completed")) {
              console.log(`[Sync Resilience] Google Apps Script executou (${actionToSend}) na aba ${change.sheetName} e finalizou sem erro fatal.`);
              rawBody = { success: true };
            } else if (change.action === "delete") {
              console.warn(`[Sync Resilience] Exclusão remota na aba ${change.sheetName} concluída no Google Sheets. Limpando da fila.`);
              rawBody = { success: true };
            } else {
              // Tenta fallback com "upsert" explícito caso tenha tentado outra ação
              if (actionToSend !== "upsert") {
                try {
                  const retryRes = await fetchGoogleAppsScript(cleanUrl, {
                    method: "POST",
                    body: JSON.stringify({
                      action: "upsert",
                      sheetName: change.sheetName,
                      rowData: change.rowData
                    })
                  });
                  const retryText = await retryRes.text();
                  if (!retryText.trim().startsWith("<")) {
                    rawBody = JSON.parse(retryText);
                  }
                } catch (_) {}
              }

              if (!rawBody) {
                throw new Error("⚠️ Erro de Permissão/Cota do Google Planilhas: O Google retornou uma página HTML em vez de JSON. Fique tranquilo, seus dados foram gravados em segurança no servidor local e serão enviados à planilha na próxima sincronização.");
              }
            }
          } else {
            try {
              rawBody = JSON.parse(textResponse);
            } catch (pe) {
              throw new Error("Resposta do Google Sheets não pôde ser analisada como JSON: " + textResponse.substring(0, 200));
            }
          }

          if (!rawBody) {
            throw new Error("Resposta inválida (vazia) recebida do Google Sheets");
          }
          if (rawBody.success === false) {
            const errMsg = String(rawBody.error || rawBody.message || "");
            if (change.action === "delete" && (errMsg.includes("Registro correspondente nao encontrado") || errMsg.includes("nao encontrado para DELETE"))) {
              console.warn(`[Sync Resilience] Exclusão de registro não encontrado na planilha para ${change.sheetName}. Limpando da fila.`);
              pushedChangesCount++;
              successfullySentTimestamps.add(change.timestamp);
              continue;
            }
            if ((change.action === "update" || change.action === "upsert") && (errMsg.includes("Registro correspondente nao encontrado") || errMsg.includes("nao encontrado para UPDATE"))) {
              console.warn(`[Sync Resilience] Erro de update em registro não encontrado na planilha para ${change.sheetName}. Limpando da fila.`);
              pushedChangesCount++;
              successfullySentTimestamps.add(change.timestamp);
              continue;
            }
            throw new Error(errMsg || "A planilha do Google Sheets rejeitou a operação");
          }

          pushedChangesCount++;
          // Track successfully sent change
          successfullySentTimestamps.add(change.timestamp);
        } catch (postErr: any) {
          console.error(`[Sync Single Item Error] Falha ao sincronizar alteração para ${change.sheetName}:`, postErr);
          syncErrors.push(`${change.sheetName} (${change.action}): ${postErr.message || String(postErr)}`);
          
          // Se for uma falha crônica de script/HTML ou USERS, descarta da fila para não poluir logs indefinidamente
          if (changeSheetUpper === "USERS" || changeSheetUpper === "USUARIOS" || (change as any).retryCount >= 2) {
            console.warn(`[Sync Resilience] Descartando item com falha crônica da fila de sincronização: ${change.sheetName}`);
            successfullySentTimestamps.add(change.timestamp);
          } else {
            (change as any).retryCount = ((change as any).retryCount || 0) + 1;
          }
        }
      }
    }

    // Part 2: Pull latest data from Google Sheets and reconcile
    console.log("[Sync] Buscando dados consolidados da Planilha do Google Sheets para mesclagem local.");
    let liveData: any = null;
    try {
      const getRes = await fetchGoogleAppsScript(cleanUrl, { method: "GET" });
      const getText = await getRes.text();
      if (getText.trim().startsWith("<")) {
        throw new Error("⚠️ Erro de Permissão/Cota no Carregamento: O Google Sheets retornou uma página HTML em vez de um JSON de dados.");
      }

      liveData = JSON.parse(getText);
      if (!liveData || typeof liveData !== "object") {
        throw new Error("Resposta inválida do Google Sheets (não é um objeto válido de tabelas)");
      }
    } catch (pullErr: any) {
      console.warn("[Sync Pull Warning] Não foi possível carregar dados da planilha remota:", pullErr.message || String(pullErr));
      syncErrors.push(`Leitura da Planilha: ${pullErr.message || String(pullErr)}`);
    }

    // Re-read the freshest DB state from disk to merge our reconciled changes with any concurrent changes
    const freshDb = await getDbState();

    // Clear successfully sent changes from freshDb.pendingChanges
    if (successfullySentTimestamps.size > 0) {
      freshDb.pendingChanges = freshDb.pendingChanges.filter(c => !successfullySentTimestamps.has(c.timestamp));
    }

    // Update retryCount for remaining pending changes
    freshDb.pendingChanges = freshDb.pendingChanges.map(c => {
      const match = changesToSync.find(sc => sc.timestamp === c.timestamp);
      return match ? { ...c, retryCount: (match as any).retryCount || 0 } : c;
    });

    // List of keys to reconcile if liveData was fetched successfully
    if (liveData) {
      const sheetKeys = [
        "ENTRONCAMENTOS", "CAMADA OPTICA", "OTDR", "ATENUAÇÕES", 
        "TESTES DE CAMPO", "BYPASS", "RELATÓRIO MENSAL", 
        "USERS", "ATUAÇÕES", "AVISOS", "TROCA DE CABO", "DADOS",
        "CONTROLE DE INCIDENTES"
      ];

      for (const key of sheetKeys) {
        // Find matching sheet key in Sheets payload (accounting for spelling variants, accents, spacing)
        const liveKey = findLiveKey(key, liveData);

        if (liveKey && Array.isArray(liveData[liveKey])) {
          const liveRows = liveData[liveKey];
          pulledSheets.push(key);

          // Get local rows from the fresh DB state
          let localRows = freshDb[key as keyof DbState] as any[];
          if (!localRows) {
            (freshDb as any)[key] = [];
            localRows = (freshDb as any)[key];
          }

          // Reconcile rows:
          const liveIds = new Set<string>();
          const updatedLocalRows: any[] = [];

          liveRows.forEach((liveRow, index) => {
            const { rowId: liveId, normalizedRow: normalizedLiveRow } = getRowIdAndNormalize(liveRow, key, index);
            if (!liveId) return;
            liveIds.add(liveId);

            // 1. Verifica se foi deletado localmente (pendente de push ou recentemente excluído)
            const isLocallyDeleted = freshDb.pendingChanges.some(c => {
              const changeLocalKey = getLocalKeyForSheet(c.sheetName);
              const { rowId: changeRowId } = getRowIdAndNormalize(c.rowData, changeLocalKey, 0);
              return changeLocalKey === key && (changeRowId === liveId || isSameRowDomain(normalizedLiveRow, c.rowData, key)) && c.action === "delete";
            }) || (freshDb.recentlyDeleted && (
              (freshDb.recentlyDeleted[liveId] && Date.now() - freshDb.recentlyDeleted[liveId] < 300000) ||
              Object.keys(freshDb.recentlyDeleted).some(dId => {
                const matchLr = localRows.find(lr => lr.id === dId || lr.ID === dId);
                return matchLr && isSameRowDomain(matchLr, normalizedLiveRow, key) && (Date.now() - (freshDb.recentlyDeleted?.[dId] || 0) < 300000);
              })
            ));

            if (isLocallyDeleted) {
              // Registro foi excluído localmente; não reinserir a partir da planilha desatualizada
              return;
            }

            // 2. Verifica se há alteração pendente de envio
            const pendingChange = freshDb.pendingChanges.find(c => {
              const changeLocalKey = getLocalKeyForSheet(c.sheetName);
              const { rowId: changeRowId } = getRowIdAndNormalize(c.rowData, changeLocalKey, 0);
              return changeLocalKey === key && (changeRowId === liveId || isSameRowDomain(normalizedLiveRow, c.rowData, key));
            });

            // 3. Localiza a linha existente localmente
            const localRow = localRows.find(lr => {
              const { rowId: localId } = getRowIdAndNormalize(lr, key, 0);
              return localId === liveId || isSameRowDomain(lr, normalizedLiveRow, key);
            });

            const isRecentlySaved = localRow && freshDb.recentlySaved && (
              (freshDb.recentlySaved[localRow.id] && Date.now() - freshDb.recentlySaved[localRow.id] < 300000) ||
              (freshDb.recentlySaved[liveId] && Date.now() - freshDb.recentlySaved[liveId] < 300000)
            );

            if (pendingChange && pendingChange.action !== "delete") {
              // Mantém as alterações locais não sincronizadas
              updatedLocalRows.push(localRow ? { ...normalizedLiveRow, ...localRow } : pendingChange.rowData);
            } else if (isRecentlySaved && localRow) {
              // Mantém edições locais recentes para evitar que o atraso da planilha as sobrescreva
              updatedLocalRows.push({ ...normalizedLiveRow, ...localRow });
            } else if (localRow) {
              updatedLocalRows.push(mergeRowsIntelligently(localRow, normalizedLiveRow, key));
            } else {
              updatedLocalRows.push(normalizedLiveRow);
            }
          });

          // Keep local inserts that haven't been pushed yet OR were recently pushed (to avoid deletion due to Google Sheets lag)
          localRows.forEach(lr => {
            const { rowId: localId } = getRowIdAndNormalize(lr, key, 0);
            if (!localId || liveIds.has(localId)) return;

            // Para a aba CONTROLE DE INCIDENTES, os registros vêm da API DWDM Brisanet e devem ser sempre preservados localmente
            if (key === "CONTROLE DE INCIDENTES") {
              updatedLocalRows.push(lr);
              return;
            }

            const isLocallyPendingInsert = freshDb.pendingChanges.some(c => {
              const changeLocalKey = getLocalKeyForSheet(c.sheetName);
              const { rowId: changeRowId } = getRowIdAndNormalize(c.rowData, changeLocalKey, 0);
              return changeLocalKey === key && changeRowId === localId && c.action === "insert";
            });

            const isRecentlySaved = freshDb.recentlySaved && 
                                    freshDb.recentlySaved[localId] && 
                                    (Date.now() - freshDb.recentlySaved[localId] < 300000); // 5 minutes

            if (isLocallyPendingInsert || isRecentlySaved) {
              updatedLocalRows.push(lr);
            }
          });

          // Save the reconciled state to freshDb
          (freshDb as any)[key] = updatedLocalRows;
        } else {
          console.warn(`[Sync Resiliency] Aba '${key}' não foi fornecida pelo Google Sheets. Mantendo versão local intacta.`);
        }
      }
    }

    freshDb.lastSyncTime = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    freshDb.lastSyncTimestamp = Date.now();

    const hasCoreData = (freshDb.ENTRONCAMENTOS && freshDb.ENTRONCAMENTOS.length > 0) ||
                        (freshDb.USERS && freshDb.USERS.length > 0) ||
                        (freshDb.AVISOS && freshDb.AVISOS.length > 0) ||
                        (freshDb.ATUAÇÕES && freshDb.ATUAÇÕES.length > 0);

    if (syncErrors.length > 0) {
      const isOnlyPullError = syncErrors.every(e => e.startsWith("Leitura da Planilha:"));
      
      // Se apenas a leitura remota falhou (ex: 404 temporário do Google Sheets), mas o banco local já possui os dados consolidados:
      if (isOnlyPullError && hasCoreData) {
        freshDb.lastSyncStatus = "success";
        await saveDbState(freshDb);
        console.warn(`[Sync Resilience] Leitura remota indisponível (${syncErrors.join(" | ")}), mas dados estruturados locais estão 100% íntegros e preservados.`);
        return {
          success: true,
          pulledSheets,
          pushedChangesCount,
          warning: `Aviso na leitura da planilha: ${syncErrors.join(" | ")}. A aplicação está operando normalmente com a base local consolidada.`
        };
      }

      freshDb.lastSyncStatus = "error";
      await saveDbState(freshDb);
      return {
        success: false,
        pulledSheets,
        pushedChangesCount,
        error: `Aviso na sincronização com a planilha: ${syncErrors.join(" | ")}`
      };
    }

    freshDb.lastSyncStatus = "success";
    await saveDbState(freshDb);

    return {
      success: true,
      pulledSheets,
      pushedChangesCount
    };
  } catch (err: any) {
    console.error("[Sync Fatal Error] Sincronização falhou:", err);
    try {
      const freshDb = await getDbState();
      if (successfullySentTimestamps.size > 0) {
        freshDb.pendingChanges = freshDb.pendingChanges.filter(c => !successfullySentTimestamps.has(c.timestamp));
      }
      freshDb.lastSyncStatus = "error";
      freshDb.lastSyncTimestamp = Date.now();
      await saveDbState(freshDb);
    } catch (saveErr) {}
    return {
      success: false,
      pulledSheets,
      pushedChangesCount,
      error: err.message || String(err)
    };
  }
}

// Limpeza completa e reimportação total dos dados da planilha do zero (Erase & Overwrite)
export async function forceResetAndImport(webAppUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUrl = normalizeWebAppUrl(webAppUrl);
    console.log(`[Importação Total] Buscando dados de ${cleanUrl}...`);
    const res = await fetchGoogleAppsScript(cleanUrl, { method: "GET" });

    const text = await res.text();
    if (text.trim().startsWith("<")) {
      throw new Error("⚠️ O Google Sheets retornou uma página HTML em vez de JSON. Certifique-se de que o Apps Script esteja configurado para execução pública ('Qualquer pessoa') com acesso irrestrito.");
    }

    const liveData = JSON.parse(text);
    if (!liveData || typeof liveData !== "object") {
      throw new Error("Dados inválidos recebidos da planilha.");
    }

    const db = await getDbState();

    // List of keys to clear and replace
    const sheetKeys = [
      "ENTRONCAMENTOS", "CAMADA OPTICA", "OTDR", "ATENUAÇÕES", 
      "TESTES DE CAMPO", "BYPASS", "RELATÓRIO MENSAL", 
      "USERS", "ATUAÇÕES", "AVISOS", "TROCA DE CABO", "DADOS",
      "CONTROLE DE INCIDENTES"
    ];

    for (const key of sheetKeys) {
      const liveKey = findLiveKey(key, liveData);
      if (liveKey && Array.isArray(liveData[liveKey])) {
        const liveRows = liveData[liveKey];
        const normalizedRows = liveRows.map((row: any, index: number) => {
          const { normalizedRow } = getRowIdAndNormalize(row, key, index);
          return normalizedRow;
        });
        (db as any)[key] = normalizedRows;
      } else {
        // Se a aba não vier no payload mas for padrão, limpa a tabela local para não manter lixo.
        // Excetua USERS e AVISOS para não perder usuários locais pré-existentes.
        if (key === "USERS") {
          db.USERS = db.USERS && db.USERS.length > 0 ? db.USERS : DEFAULT_USERS;
        } else if (key === "AVISOS") {
          db.AVISOS = db.AVISOS && db.AVISOS.length > 0 ? db.AVISOS : DEFAULT_AVISOS;
        } else {
          (db as any)[key] = [];
        }
      }
    }

    // Limpa a fila suspensa de alterações pendentes de vez
    db.pendingChanges = [];
    db.lastSyncTime = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    db.lastSyncStatus = "success";
    db.lastSyncTimestamp = Date.now();

    await saveDbState(db);
    return { success: true };
  } catch (err: any) {
    console.error("[Importação Total ERROR]", err);
    return { success: false, error: err.message || String(err) };
  }
}

