// Helper functions for incident date and chronology validation

export const parseIncidentDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s || s === "—" || s === "N/A") return null;

  // Formato brasileiro DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY HH:MM
  const matchesBR = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (matchesBR) {
    const day = parseInt(matchesBR[1], 10);
    const month = parseInt(matchesBR[2], 10) - 1; // 0-indexed
    const year = parseInt(matchesBR[3], 10);
    const hour = matchesBR[4] ? parseInt(matchesBR[4], 10) : 0;
    const minute = matchesBR[5] ? parseInt(matchesBR[5], 10) : 0;
    const second = matchesBR[6] ? parseInt(matchesBR[6], 10) : 0;
    return new Date(year, month, day, hour, minute, second);
  }

  // Formato ISO ou YYYY-MM-DD
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d;
  }
  return null;
};

export const getValFromRow = (item: any, colName: string): string => {
  if (!item) return "";
  if (item[colName] !== undefined && item[colName] !== null) return String(item[colName]).trim();
  const cleanKey = colName.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const k of Object.keys(item)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanKey) {
      return String(item[k]).trim();
    }
  }
  return "";
};

export const getDowntimeInfo = (item: any) => {
  if (!item) return null;
  const dataInicio = getValFromRow(item, "Data Início") || getValFromRow(item, "Data Inicio") || getValFromRow(item, "Data de Abertura") || getValFromRow(item, "Data Abertura") || "";
  const dataFim = getValFromRow(item, "Data Fim") || "";
  
  if (!dataInicio || dataInicio === "—" || String(dataInicio).trim() === "") {
    return null;
  }
  const start = parseIncidentDate(dataInicio);
  if (!start) return null;

  const isEmAberto = !dataFim || dataFim === "—" || dataFim.toLowerCase().includes("aberto") || dataFim.toLowerCase().includes("andamento");
  const end = isEmAberto ? new Date() : parseIncidentDate(dataFim);
  if (!end) return null;

  const diffMs = end.getTime() - start.getTime();
  const isNegative = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const diffMins = Math.floor(absDiffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  let formattedTime = "";
  if (hours > 0) {
    formattedTime = `${hours}h ${mins}m`;
  } else {
    formattedTime = `${mins}m`;
  }

  let label = isNegative ? `-${formattedTime}` : formattedTime;
  if (isEmAberto) {
    label += " (Em aberto)";
  }

  return {
    hours: diffMs / (1000 * 60 * 60),
    label,
    rawMs: diffMs,
    isNegative
  };
};

export interface IncidentDateErrorResult {
  hasDateError: boolean;
  isChronologyError: boolean;
  isMissingStartDateError: boolean;
  dateErrorTitle: string;
  startDate: Date | null;
  endDate: Date | null;
  categoria: string;
  titulo: string;
  id: string;
  operador: string;
  dataInicioRaw: string;
  dataFimRaw: string;
  dtInfo: { hours: number; label: string; rawMs: number; isNegative: boolean } | null;
}

export const checkIncidentDateError = (row: any): IncidentDateErrorResult => {
  const id = getValFromRow(row, "id") || getValFromRow(row, "ID") || getValFromRow(row, "Número") || "";
  const operador = getValFromRow(row, "Operador") || getValFromRow(row, "OPERADOR") || "—";
  const categoria = getValFromRow(row, "Categoria") || getValFromRow(row, "Subcategoria");
  const titulo = getValFromRow(row, "Título") || getValFromRow(row, "Titulo");
  const dataInicioRaw = getValFromRow(row, "Data Início") || getValFromRow(row, "Data Inicio");
  const dataFimRaw = getValFromRow(row, "Data Fim") || getValFromRow(row, "Data Normalização");
  const atenuacaoCritica = getValFromRow(row, "Atenuação Crítica") || getValFromRow(row, "Atenuacao Critica");
  const status = getValFromRow(row, "Status") || getValFromRow(row, "Situação");

  const isAtenuacaoCriticaRow = String(atenuacaoCritica).toLowerCase().includes("sim");
  const isAtenuadoRow = String(status).toLowerCase().includes("atenuado");
  const isAtenuacaoOuAtenuado = isAtenuacaoCriticaRow || isAtenuadoRow;

  const parsedStartDate = parseIncidentDate(dataInicioRaw);
  const parsedEndDate = parseIncidentDate(dataFimRaw);

  const isDwdmRompimento = 
    String(categoria || "").toUpperCase().includes("DWDM - ROMPIMENTO") || 
    String(titulo || "").toUpperCase().includes("DWDM - ROMPIMENTO");

  const isChronologyError = Boolean(
    isDwdmRompimento && parsedStartDate && parsedEndDate && parsedEndDate.getTime() < parsedStartDate.getTime()
  );

  const isMissingStartDateError = Boolean(
    isDwdmRompimento && !parsedStartDate && !isAtenuacaoOuAtenuado
  );

  const hasDateError = isDwdmRompimento && (isChronologyError || isMissingStartDateError);

  const dateErrorTitle = isChronologyError
    ? "Inconsistência: A data de normalização não pode ser anterior à data de início."
    : "Atenção: Data de início é obrigatória para chamados de Rompimento.";

  const dtInfo = getDowntimeInfo(row);

  return {
    hasDateError,
    isChronologyError,
    isMissingStartDateError,
    dateErrorTitle,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    categoria,
    titulo,
    id,
    operador,
    dataInicioRaw,
    dataFimRaw,
    dtInfo
  };
};
