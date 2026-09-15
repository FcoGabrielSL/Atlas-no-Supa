import React, { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Calendar, 
  CheckCircle, 
  Clock, 
  User, 
  Layers, 
  Info,
  X,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MessageSquare,
  CalendarRange,
  Upload, 
  FileText, 
  TrendingUp, 
  Check, 
  CheckCircle2,
  XCircle,
  Pause, 
  Play, 
  ExternalLink,
  Sliders,
  Sparkles,
  Filter
} from "lucide-react";
import { motion } from "motion/react";
import { RelatorioGerencialEntroncamentos } from "./RelatorioGerencialEntroncamentos";

interface EntroncamentosTabProps {
  filteredEntroncamentos: any[];
  entroncamentos: any[];
  currentUser: any;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onStartFinalize: (item: any) => void;
  isDeadlineExpired: (prazo: string, status: string) => boolean;
  formatSheetDate: (dateStr: string) => string;
  normalizeStatus: (status: string) => string;
  parseTimelineLogs: (logsStr: string) => any[];
  formatRouteTitle: (a: string, b: string, c?: string, d?: string) => string;
  getStatusBadgeStyle: (status: string) => string;
  onExtendDeadline: (item: any) => void;
  onOpenAta: (item: any) => void;
  onEditTimelineEntry?: (item: any, field: string, entryIndex: number, date: string, content: string) => void;
  onDeleteTimelineEntry?: (item: any, field: string, entryIndex: number) => void;
  onQuickImportDirect?: (parsedRow: any) => Promise<boolean>;
  onCSVImport?: (rows: any[], duplicateAction: "merge" | "ignore") => Promise<{ success: boolean; inserted: number; updated: number; ignored: number; msg: string }>;
  isSyncPaused?: boolean;
  onToggleSyncPause?: () => void;
  pendingSyncCount?: number;
}

export const EntroncamentosTab: React.FC<EntroncamentosTabProps> = ({
  filteredEntroncamentos,
  entroncamentos,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
  onStartFinalize,
  isDeadlineExpired,
  formatSheetDate,
  normalizeStatus,
  parseTimelineLogs,
  formatRouteTitle,
  getStatusBadgeStyle,
  onExtendDeadline,
  onOpenAta,
  onEditTimelineEntry,
  onDeleteTimelineEntry,
  onQuickImportDirect,
  onCSVImport,
  isSyncPaused,
  onToggleSyncPause,
  pendingSyncCount
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["Solucionado", "Em andamento", "Pendente", "Sem solução"]);
  const [selectedGroup, setSelectedGroup] = useState<"todos" | "abertos" | "fechados">("todos");
  const [selectedPrazo, setSelectedPrazo] = useState<"all" | "atrasado" | "sem-prazo" | "no-prazo">("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [periodStartDate, setPeriodStartDate] = useState<string>("");
  const [periodEndDate, setPeriodEndDate] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRelatorioModal, setShowRelatorioModal] = useState<boolean>(false);
  const [relatorioDropdownOpen, setRelatorioDropdownOpen] = useState<boolean>(false);
  const [showCustomRelatorioModal, setShowCustomRelatorioModal] = useState<boolean>(false);
  const [selectedRelatorioFilterMode, setSelectedRelatorioFilterMode] = useState<"todos" | "abertos" | "fechados">("todos");
  const [selectedRelatorioAtasMode, setSelectedRelatorioAtasMode] = useState<"todas" | "ultima" | "sem_atas">("todas");

  const [tempFilterMode, setTempFilterMode] = useState<"todos" | "abertos" | "fechados">("todos");
  const [tempAtasMode, setTempAtasMode] = useState<"todas" | "ultima" | "sem_atas">("todas");

  const relatorioDropdownRef = React.useRef<HTMLDivElement>(null);
  const [showCustomDatePopover, setShowCustomDatePopover] = useState(false);
  const periodPopoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (relatorioDropdownRef.current && !relatorioDropdownRef.current.contains(event.target as Node)) {
        setRelatorioDropdownOpen(false);
      }
      if (periodPopoverRef.current && !periodPopoverRef.current.contains(event.target as Node)) {
        setShowCustomDatePopover(false);
      }
    };
    if (relatorioDropdownOpen || showCustomDatePopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [relatorioDropdownOpen, showCustomDatePopover]);

  const ALL_STATUSES = ["Solucionado", "Em andamento", "Pendente", "Sem solução"];

  const handleFilterClick = (status: string) => {
    if (status === "all") {
      setSelectedStatuses(ALL_STATUSES);
      return;
    }
    // Se o usuário clicar no mesmo status que já está ativo isoladamente, limpa o filtro voltando a exibir Todos
    if (selectedStatuses.length === 1 && selectedStatuses[0] === status) {
      setSelectedStatuses(ALL_STATUSES);
    } else {
      // Isola estritamente a categoria selecionada
      setSelectedStatuses([status]);
    }
  };
  const handleCardClick = handleFilterClick;

  const displayVal = (val: any) => {
    const s = String(val || "").trim();
    return s === "" || s === "-" || s === "null" || s === "undefined" ? "ND" : val;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      if (dateStr.includes("T")) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("pt-BR");
      }
      return formatSheetDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  const isSolvedStatus = (item: any): boolean => {
    if (!item) return false;
    const rawStatusVal = item["STATUS"] || item["status"] || item["Status"] || "";
    const normStatus = normalizeStatus(rawStatusVal);
    const rawStatus = String(rawStatusVal).toLowerCase().trim();

    return (
      normStatus === "Solucionado" ||
      normStatus === "Sem solução" ||
      normStatus === "Concluído" ||
      normStatus === "Sucesso" ||
      normStatus === "Finalizado" ||
      rawStatus.includes("solucionad") ||
      rawStatus.includes("concluid") ||
      rawStatus.includes("finalizad") ||
      rawStatus.includes("sem soluç") ||
      rawStatus.includes("sem soluc") ||
      rawStatus.includes("sem sol") ||
      rawStatus.includes("resolvid") ||
      rawStatus.includes("fechad")
    );
  };

  const getCompletionDateStr = (item: any): string => {
    if (!item) return "";

    // A data de conclusão aplica-se SOMENTE a chamados solucionados / concluídos
    if (!isSolvedStatus(item)) {
      return "";
    }

    // 1. Procurar em colunas explícitas de data de conclusão
    const explicitCandidates = [
      item["DATA DE CONCLUSÃO"],
      item["DATA DE RESOLUÇÃO"],
      item["DATA CONCLUSÃO"],
      item["DATA_CONCLUSAO"],
      item["DATA_RESOLUCAO"],
      item["data_resolucao"],
      item["data_conclusao"],
      item["data de conclusão"],
      item["ULTIMA ATUALIZACAO"],
      item["ULTIMA_ATUALIZACAO"]
    ];

    for (const cand of explicitCandidates) {
      if (cand) {
        const clean = String(cand).trim();
        if (clean && clean !== "-" && clean !== "—" && clean.toLowerCase() !== "n/a" && clean.toLowerCase() !== "a definir") {
          return clean;
        }
      }
    }

    // 2. Caso o chamado esteja resolvido sem coluna de data preenchida,
    // buscar nos campos de texto (Observações, Atas, Histórico) por padrão [CONCLUSÃO]
    const textFields = [
      item["OBSERVAÇÃO"],
      item["OBSERVAÇÃO "],
      item["OBSERVACAO"],
      item["OBSERVAÇÕES"],
      item["HISTORICO"],
      item["HISTÓRICO"],
      item["HISTÓRICO DE REUNIÃO / ATA"],
      item["ATAS"],
      item["NOTAS"],
      item["DETALHES"]
    ];

    for (const tf of textFields) {
      if (tf) {
        const text = String(tf);
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (/\[(CONCLUSÃO|CONCLUSAO|SOLUÇÃO|SOLUCAO|CONCLUÍDO|FINALIZADO)\]/i.test(line)) {
            const dateMatch = line.match(/(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})/);
            if (dateMatch) {
              return dateMatch[1];
            }
          }
        }
        if (/\[(CONCLUSÃO|CONCLUSAO|SOLUÇÃO|SOLUCAO|CONCLUÍDO|FINALIZADO)\]/i.test(text)) {
          const dateMatch = text.match(/(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})/);
          if (dateMatch) {
            return dateMatch[1];
          }
        }
      }
    }

    return "";
  };

  const parseDateString = (str: string): Date | null => {
    if (!str) return null;
    const clean = String(str).trim();
    if (!clean || clean === "-" || clean === "—" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "a definir") {
      return null;
    }
    const dmyMatch = clean.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900 && year < 2100) {
        return new Date(year, month, day);
      }
    }
    const ymdMatch = clean.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900 && year < 2100) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

  const getRecordCreatedDate = (item: any): Date | null => {
    if (!item) return null;
    const candidates = [
      item["DATA"],
      item["Data"],
      item["DATA_CADASTRO"],
      item["DATA CADASTRO"],
      item["DATA DE ABERTURA"],
      item["data_abertura"],
      item["createdAt"],
      item["created_at"],
      item["DATA BACKUP"],
      item["DATA_BACKUP"]
    ];

    for (const c of candidates) {
      if (c) {
        const d = parseDateString(String(c));
        if (d) return d;
      }
    }

    const rawTimeline = item["AÇÕES"] || item["ACOES"] || item["OBSERVAÇÕES"] || item["OBSERVACOES"] || "";
    const logs = parseTimelineLogs(rawTimeline);
    if (logs && logs.length > 0) {
      for (const log of logs) {
        if (log.date && log.date !== "Histórico" && log.date !== "Registro") {
          const d = parseDateString(log.date);
          if (d) return d;
        }
      }
    }
    return null;
  };

  const getLocationStr = (item: any): string => {
    if (!item) return "";
    const val =
      item["LOCALIZAÇÃO"] ||
      item["LOCALIZACAO"] ||
      item["Localização"] ||
      item["Coordenadas"] ||
      item["coordenadas"] ||
      item["Coordenadas Recebidas"] ||
      item["LOCAL"];
    if (!val) return "";
    const clean = String(val).trim();
    if (clean === "-" || clean === "—" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "a definir") {
      return "";
    }
    return clean;
  };

  // Estados para o Cadastro Rápido
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [importMode, setImportMode] = useState<"text" | "csv">("text");
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");

  // Estados para importação de CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"merge" | "ignore">("merge");
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = (text: string): any[] => {
    const lines: string[] = [];
    let row = [""];
    let inQuotes = false;

    // Split text into lines while respecting quotes.
    let currentLine = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === '\n' && !inQuotes) {
        lines.push(currentLine);
        currentLine = "";
        continue;
      } else if (char === '\r' && !inQuotes) {
        continue;
      }
      currentLine += char;
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length < 2) return [];

    const headerLine = lines[0];
    let delimiter = ",";
    if (headerLine.includes(";")) delimiter = ";";
    else if (headerLine.includes("\t")) delimiter = "\t";

    const parseLine = (line: string): string[] => {
      const fields: string[] = [];
      let field = "";
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
          fields.push(field.trim());
          field = "";
        } else {
          field += char;
        }
      }
      fields.push(field.trim());
      return fields;
    };

    const rawHeaders = parseLine(headerLine);
    const headers = rawHeaders.map(h => {
      return h.replace(/^["']|["']$/g, "").trim().toUpperCase();
    });

    const records: any[] = [];
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;
      const values = parseLine(line).map(v => v.replace(/^["']|["']$/g, "").trim());
      const record: any = {};
      
      headers.forEach((header, index) => {
        let key = header;
        if (header === "ID" || header === "IDENTIFICADOR" || header === "OPERID") {
          key = "id";
        } else if (header === "TRECHO_A" || header === "TRECHOA" || header === "TRECHO A") {
          key = "TRECHO A";
        } else if (header === "TRECHO_B" || header === "TRECHOB" || header === "TRECHO B") {
          key = "TRECHO B";
        } else if (header === "TRECHO_C" || header === "TRECHOC" || header === "TRECHO C") {
          key = "TRECHO C";
        } else if (header === "TRECHO_D" || header === "TRECHOD" || header === "TRECHO D ") {
          key = "TRECHO D ";
        } else if (header === "LOCALIZACAO" || header === "LOCALIZAÇÃO") {
          key = "LOCALIZAÇÃO";
        } else if (header === "TIPO") {
          key = "TIPO";
        } else if (header === "PROVEDOR" || header === "PROVEDOR ") {
          key = "PROVEDOR ";
        } else if (header === "ACOES" || header === "AÇÕES") {
          key = "AÇÕES";
        } else if (header === "STATUS") {
          key = "STATUS";
        } else if (header === "RESPONSAVEL" || header === "RESPONSÁVEL" || header === "RESPONSÁVEL ") {
          key = "RESPONSÁVEL ";
        } else if (header === "PRAZO") {
          key = "PRAZO";
        } else if (header === "DATA_BACKUP" || header === "DATA BACKUP") {
          key = "DATA BACKUP";
        } else if (header === "OBSERVACOES" || header === "OBSERVAÇÕES") {
          key = "OBSERVAÇÕES";
        } else if (header === "DESCRICAO" || header === "DESCRIÇÃO") {
          key = "DESCRIÇÃO";
        } else if (header === "DATA") {
          key = "DATA";
        }

        record[key] = values[index] !== undefined ? values[index] : "";
      });

      if (record["TRECHO A"] || record["TRECHO B"] || record.id) {
        records.push(record);
      }
    }

    return records;
  };

  const parseDirectPaste = (text: any): any => {
    if (!text || typeof text !== "string") return null;
    const parts = text.split("\t").map(p => p.trim());
    
    const cleanQuotes = (str: string) => {
      let s = str.trim();
      if (s.startsWith('"') && s.endsWith('"')) {
        s = s.substring(1, s.length - 1);
      }
      return s.trim();
    };

    const parsedForm: any = {
      "TRECHO A": "",
      "TRECHO B": "",
      "TRECHO C": "",
      "TRECHO D ": "",
      LOCALIZAÇÃO: "",
      TIPO: "CAIXA", // padrão
      "PROVEDOR ": "",
      AÇÕES: "",
      STATUS: "Pendente",
      "RESPONSÁVEL ": "",
      PRAZO: "",
      "DATA BACKUP": "",
      OBSERVAÇÕES: "",
      DESCRIÇÃO: "",
      id: "",
    };

    const isTsv = text.includes("\t") && parts.length >= 4;

    if (isTsv) {
      // Sincronização e mapeamento direto por posição das colunas da planilha ENTRONCAMENTOS do cliente
      const columns = [
        "ID",               // 0
        "DATA",             // 1
        "DESCRIÇÃO",        // 2
        "TRECHO A",         // 3
        "TRECHO B",         // 4
        "TRECHO C",         // 5
        "TRECHO D ",        // 6
        "LOCALIZAÇÃO",      // 7
        "TIPO",             // 8
        "PROVEDOR ",        // 9
        "AÇÕES",            // 10
        "STATUS",           // 11
        "RESPONSÁVEL ",     // 12
        "PRAZO",            // 13
        "DATA BACKUP",      // 14
        "OBSERVAÇÕES",      // 15
        "DATA DE CONCLUSAO" // 16
      ];

      parts.forEach((part, index) => {
        const cleaned = cleanQuotes(part);
        if (index < columns.length) {
          const key = columns[index];
          if (key === "ID") {
            parsedForm.id = cleaned || parsedForm.id;
            parsedForm.ID = cleaned || parsedForm.ID;
            parsedForm.operId = cleaned || parsedForm.operId;
          } else if (key === "STATUS") {
            const upper = cleaned.toUpperCase();
            if (upper === "PENDENTE") {
              parsedForm["STATUS"] = "Pendente";
            } else if (upper === "EM ANDAMENTO" || upper === "ANDAMENTO") {
              parsedForm["STATUS"] = "Em andamento";
            } else if (upper === "SOLUCIONADO") {
              parsedForm["STATUS"] = "Solucionado";
            } else if (upper === "SEM SOLUÇÃO" || upper === "SEM SOLUCAO") {
              parsedForm["STATUS"] = "Sem solução";
            } else if (cleaned) {
              parsedForm["STATUS"] = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
            } else {
              parsedForm["STATUS"] = "Pendente";
            }
          } else {
            parsedForm[key] = cleaned;
          }
        }
      });

      if (parsedForm["AÇÕES"]) {
        parsedForm["OBSERVAÇÕES"] = parsedForm["AÇÕES"];
      }

      return parsedForm;
    }

    const knownStatuses = ["PENDENTE", "EM ANDAMENTO", "ANDAMENTO", "SOLUCIONADO", "SEM SOLUÇÃO", "SEM SOLUCAO", "CONCLUÍDO", "CONCLUIDO"];
    const knownResponsibles = ["MARCOS", "FRANCISCO", "GABRIEL", "JAKELINE", "PATRICK", "VALDEMAR"];
    const knownProviders = ["WIRELINK", "BRISANET", "TELY", "GIGA+", "GIGA", "WORLDNET", "TELECOM"];

    const trechos: string[] = [];
    let detectedCoordinates = "";
    let detectedStatus = "";
    let detectedAcoes = "";
    let detectedDescricao = "";
    let detectedResponsavel = "";
    let detectedProvedor = "";
    let detectedId = "";

    for (const part of parts) {
      const cleaned = cleanQuotes(part);
      if (!cleaned) continue;

      // Detectar ID (ex: ENT-027)
      if (/^ENT-\d+$/i.test(cleaned)) {
        detectedId = cleaned.toUpperCase();
        continue;
      }

      // Detectar segmentos (ex: CALDAS BRANDÃO <> BAYEUX)
      if (cleaned.includes("<>")) {
        trechos.push(cleaned);
        continue;
      }

      // Detectar coordenadas (ex: -7.122222, -34.983861)
      if (/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.test(cleaned)) {
        detectedCoordinates = cleaned;
        continue;
      }

      // Detectar status conhecido
      if (knownStatuses.includes(cleaned.toUpperCase())) {
        const normStatus = cleaned.toUpperCase();
        if (normStatus === "ANDAMENTO" || normStatus === "EM ANDAMENTO") {
          detectedStatus = "Em andamento";
        } else if (normStatus === "SEM SOLUÇÃO" || normStatus === "SEM SOLUCAO") {
          detectedStatus = "Sem solução";
        } else {
          detectedStatus = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
        }
        continue;
      }

      // Detectar ações / histórico (ex: "02/06/2026:\n• Descrição...")
      if (cleaned.includes("•") || cleaned.includes(":") || /\d{2}\/\d{2}\/\d{4}/.test(cleaned)) {
        if (cleaned.includes("\n") || cleaned.includes("•") || cleaned.length > 40) {
          detectedAcoes = cleaned;
          continue;
        }
      }

      // Detectar responsável conhecido
      if (knownResponsibles.includes(cleaned.toUpperCase())) {
        detectedResponsavel = cleaned.toUpperCase();
        continue;
      }

      // Detectar provedor conhecido
      if (knownProviders.includes(cleaned.toUpperCase())) {
        detectedProvedor = cleaned.toUpperCase();
        continue;
      }

      // Se for um texto mais longo e ainda não temos descrição, atribui a descrição
      if (cleaned.length > 25 && !detectedDescricao) {
        detectedDescricao = cleaned;
        continue;
      }
    }

    if (trechos.length > 0) {
      // Ex: CALDAS BRANDÃO <> BAYEUX
      const subParts = trechos[0].split("<>").map(p => p.trim());
      parsedForm["TRECHO A"] = subParts[0] || "";
      parsedForm["TRECHO B"] = subParts[1] || "";
      
      if (trechos.length > 1) {
        const subParts2 = trechos[1].split("<>").map(p => p.trim());
        parsedForm["TRECHO C"] = subParts2[0] || "";
        parsedForm["TRECHO D "] = subParts2[1] || "";
      }
    }

    if (detectedId) {
      parsedForm.id = detectedId;
      parsedForm.ID = detectedId;
      parsedForm.operId = detectedId;
    }
    if (detectedCoordinates) parsedForm["LOCALIZAÇÃO"] = detectedCoordinates;
    if (detectedStatus) parsedForm["STATUS"] = detectedStatus;
    if (detectedAcoes) {
      parsedForm["AÇÕES"] = detectedAcoes;
      parsedForm["OBSERVAÇÕES"] = detectedAcoes;
    }
    if (detectedDescricao) parsedForm["DESCRIÇÃO"] = detectedDescricao;
    if (detectedResponsavel) parsedForm["RESPONSÁVEL "] = detectedResponsavel;
    if (detectedProvedor) parsedForm["PROVEDOR "] = detectedProvedor;

    return parsedForm;
  };

  // KPIs baseados em todos os registros
  const total = entroncamentos.length;
  const solucionados = entroncamentos.filter(x => normalizeStatus(x.STATUS) === "Solucionado").length;
  const emAndamento = entroncamentos.filter(x => normalizeStatus(x.STATUS) === "Em andamento").length;
  const pendentes = entroncamentos.filter(x => normalizeStatus(x.STATUS) === "Pendente").length;
  const semSolucao = entroncamentos.filter(x => normalizeStatus(x.STATUS) === "Sem solução").length;
  const percentDone = total ? Math.round(((solucionados + semSolucao) / total) * 100) : 0;
  const pctSolucionados = total ? (solucionados / total) * 100 : 0;
  const pctEmAndamento = total ? (emAndamento / total) * 100 : 0;
  const pctPendentes = total ? (pendentes / total) * 100 : 0;
  const pctSemSolucao = total ? (semSolucao / total) * 100 : 0;
  const pctSolucionadosRound = Math.round(pctSolucionados);
  const pctEmAndamentoRound = Math.round(pctEmAndamento);
  const pctPendentesRound = Math.round(pctPendentes);
  const pctSemSolucaoRound = Math.round(pctSemSolucao);

  const displayRecords = useMemo(() => {
    return entroncamentos.filter((item) => {
      // 1. Filtro de pesquisa textual
      const query = searchTerm.toLowerCase();
      const matchSearch =
        (item["TRECHO A"] || "").toLowerCase().includes(query) ||
        (item["TRECHO B"] || "").toLowerCase().includes(query) ||
        (item["TRECHO C"] || "").toLowerCase().includes(query) ||
        (item["PROVEDOR "] || item["PROVEDOR"] || "").toLowerCase().includes(query) ||
        (item["RESPONSÁVEL "] || item["RESPONSAVEL"] || "").toLowerCase().includes(query) ||
        (item["TIPO"] || "").toLowerCase().includes(query) ||
        (item.ID || "").toLowerCase().includes(query) ||
        getLocationStr(item).toLowerCase().includes(query) ||
        getCompletionDateStr(item).toLowerCase().includes(query);

      // 2. Filtro de status individual
      const statusVal = normalizeStatus(item["STATUS"]);
      const matchStatus = selectedStatuses.includes(statusVal);

      // 3. Filtro de grupo de demandas (Abertas vs Concluídas)
      let matchGroup = true;
      if (selectedGroup === "abertos") {
        matchGroup = statusVal === "Pendente" || statusVal === "Em andamento";
      } else if (selectedGroup === "fechados") {
        matchGroup = statusVal === "Solucionado" || statusVal === "Sem solução";
      }

      // 4. Filtro de prazos
      const isPrazoEmpty = !item["PRAZO"] || String(item["PRAZO"]).trim() === "" || String(item["PRAZO"]).trim() === "-";
      const isExpired = !isPrazoEmpty && isDeadlineExpired(item["PRAZO"], item["STATUS"]);
      
      let matchPrazo = true;
      if (selectedPrazo === "sem-prazo") {
        matchPrazo = isPrazoEmpty;
      } else if (selectedPrazo === "atrasado") {
        matchPrazo = isExpired;
      } else if (selectedPrazo === "no-prazo") {
        matchPrazo = !isPrazoEmpty && !isExpired;
      }

      // 5. Filtro de Período (Regra de Inclusão no Período do Relatório e Tabela)
      // Satisfaz pelo menos uma destas condições:
      // - Foram abertos/cadastrados dentro do período selecionado
      // - Tiveram novas atas/movimentações registradas dentro do período
      // - Tiveram data de conclusão/resolução dentro do período
      let matchPeriod = true;
      if (selectedPeriod !== "all") {
        const now = new Date();
        let rangeStart: Date;
        let rangeEnd: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (selectedPeriod === "hoje") {
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        } else if (selectedPeriod === "7dias") {
          rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          rangeStart.setHours(0, 0, 0, 0);
        } else if (selectedPeriod === "30dias") {
          rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          rangeStart.setHours(0, 0, 0, 0);
        } else if (selectedPeriod === "este_mes") {
          rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        } else if (selectedPeriod === "custom") {
          rangeStart = periodStartDate ? (parseDateString(periodStartDate) || new Date(0)) : new Date(0);
          rangeStart.setHours(0, 0, 0, 0);
          if (periodEndDate) {
            const parsedEnd = parseDateString(periodEndDate) || new Date();
            parsedEnd.setHours(23, 59, 59, 999);
            rangeEnd = parsedEnd;
          }
        } else {
          rangeStart = new Date(0);
        }

        // Condição 1: Abertos/cadastrados dentro do período
        const createdDate = getRecordCreatedDate(item);
        const isCreatedInPeriod = createdDate ? (createdDate >= rangeStart && createdDate <= rangeEnd) : false;

        // Condição 2: Novas atas/movimentações registradas dentro do período
        const rawTimeline = item["AÇÕES"] || item["ACOES"] || item["OBSERVAÇÕES"] || item["OBSERVACOES"] || "";
        const logs = parseTimelineLogs(rawTimeline);
        const hasAtasInPeriod = logs.some((log: any) => {
          if (!log.date || log.date === "Histórico" || log.date === "Registro") return false;
          const logDate = parseDateString(log.date);
          return logDate ? (logDate >= rangeStart && logDate <= rangeEnd) : false;
        });

        // Condição 3: Concluídos dentro do período
        const concDateStr = getCompletionDateStr(item);
        const concDate = concDateStr ? parseDateString(concDateStr) : null;
        const isClosedInPeriod = concDate ? (concDate >= rangeStart && concDate <= rangeEnd) : false;

        matchPeriod = isCreatedInPeriod || hasAtasInPeriod || isClosedInPeriod;
      }

      return matchSearch && matchStatus && matchGroup && matchPrazo && matchPeriod;
    });
  }, [entroncamentos, searchTerm, selectedStatuses, selectedGroup, selectedPrazo, selectedPeriod, periodStartDate, periodEndDate]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-slate-800 font-sans"
    >
      {/* Pause Notification Banner */}
      {isSyncPaused && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 text-slate-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-700 rounded-xl shrink-0">
              <Pause className="w-5 h-5 animate-pulse text-amber-600" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                Sincronização do Sistema Pausada
              </h4>
              <p className="text-xs text-amber-900/80">
                O envio de alterações automáticas para o Google Sheets está pausado. Suas edições estão salvas localmente no navegador {pendingSyncCount ? `(${pendingSyncCount} alterações pendentes)` : ''}.
              </p>
            </div>
          </div>
          {onToggleSyncPause && (
            <button
              onClick={onToggleSyncPause}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0 shadow-sm"
            >
              Despausar Sincronia
            </button>
          )}
        </div>
      )}

      {/* 1. Header Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 text-gray-800">
        <div className="space-y-1 text-left">
          <h2 className="text-xl font-bold text-[#1E1E1E]">
            Controle de Entroncamentos
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Diagnóstico, dimensionamento e planejamento de entroncamentos de rede • <span className="text-[#FF5022] font-semibold">{displayRecords.length}</span> registros visíveis
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3 w-full sm:w-[380px] shrink-0">
          {/* Linha Superior: Filtro de Período (Global Header com Popover Flutuante) */}
          <div className="relative w-full" ref={periodPopoverRef}>
            <div className="flex items-center justify-between gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 shadow-2xs w-full">
              <span className="text-[11px] font-bold text-gray-500 font-mono flex items-center gap-1 pl-1.5 shrink-0">
                <CalendarRange className="w-3.5 h-3.5 text-[#FF5022]" />
                <span className="hidden sm:inline">Período:</span>
              </span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                <select
                  value={selectedPeriod}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPeriod(val);
                    if (val === "custom") {
                      setShowCustomDatePopover(true);
                    } else {
                      setShowCustomDatePopover(false);
                    }
                  }}
                  className="w-full bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022]/20 cursor-pointer transition shadow-2xs min-w-0"
                >
                  <option value="all">Qualquer período</option>
                  <option value="hoje">Hoje</option>
                  <option value="7dias">Últimos 7 Dias</option>
                  <option value="30dias">Últimos 30 Dias</option>
                  <option value="este_mes">Mês Atual</option>
                  <option value="custom">Personalizado...</option>
                </select>

                {selectedPeriod === "custom" && (
                  <button
                    type="button"
                    onClick={() => setShowCustomDatePopover(prev => !prev)}
                    className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-md text-[11px] font-bold text-[#FF5022] flex items-center gap-1 cursor-pointer transition shrink-0 whitespace-nowrap"
                    title="Configurar intervalo de datas"
                  >
                    <span>
                      {periodStartDate && periodEndDate
                        ? `${periodStartDate.split('-').reverse().slice(0, 2).join('/')} - ${periodEndDate.split('-').reverse().slice(0, 2).join('/')}`
                        : "Definir datas"}
                    </span>
                    <Sliders className="w-3 h-3 text-[#FF5022]" />
                  </button>
                )}
              </div>
            </div>

            {/* Popover Flutuante de Período Personalizado */}
            {showCustomDatePopover && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 text-left animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-[#FF5022]" />
                    Período Personalizado
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustomDatePopover(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Data Inicial</label>
                    <input
                      type="date"
                      value={periodStartDate}
                      onChange={(e) => setPeriodStartDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-[#FF5022]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Data Final</label>
                    <input
                      type="date"
                      value={periodEndDate}
                      onChange={(e) => setPeriodEndDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-[#FF5022]"
                    />
                  </div>
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodStartDate("");
                        setPeriodEndDate("");
                        setSelectedPeriod("all");
                        setShowCustomDatePopover(false);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-800 font-medium cursor-pointer"
                    >
                      Limpar filtro
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomDatePopover(false)}
                      className="px-3 py-1.5 bg-[#FF5022] hover:bg-orange-600 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Aplicar Intervalo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Linha Inferior: Botões lado a lado */}
          <div className="flex items-center gap-2 w-full">
            {/* Dropdown do Relatório Gerencial */}
            <div className="relative flex-1" ref={relatorioDropdownRef}>
              <button
                onClick={() => setRelatorioDropdownOpen(prev => !prev)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-[#1E1E1E] font-bold text-xs transition cursor-pointer select-none shadow-xs whitespace-nowrap"
                title="Opções do Relatório Gerencial de Entroncamentos"
              >
                <FileText className="w-4 h-4 text-[#FF5022]" />
                <span>Relatório Gerencial</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-150 ${relatorioDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {relatorioDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-72 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-fade-in">
                  <div className="px-3.5 py-2 border-b border-gray-800 text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                    Escopo do Relatório Gerencial
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRelatorioFilterMode("todos");
                      setSelectedRelatorioAtasMode("todas");
                      setRelatorioDropdownOpen(false);
                      setShowRelatorioModal(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-gray-800 transition flex items-start gap-2.5 text-white group cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[#FF5022] mt-0.5 shrink-0 group-hover:scale-110 transition" />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Relatório Completo</span>
                        <span className="text-[10px] bg-orange-950 text-orange-400 px-1.5 py-0.2 rounded font-mono font-bold">Padrão</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Exibe e exporta todas as movimentações e atas dos trechos.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRelatorioFilterMode("todos");
                      setSelectedRelatorioAtasMode("ultima");
                      setRelatorioDropdownOpen(false);
                      setShowRelatorioModal(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-gray-800 transition flex items-start gap-2.5 text-white group cursor-pointer border-t border-gray-800/80"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0 group-hover:scale-110 transition" />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Relatório Resumido</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">Diretoria</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Exibe apenas a última ata/atualização registrada de cada chamado.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTempFilterMode(selectedRelatorioFilterMode);
                      setTempAtasMode(selectedRelatorioAtasMode);
                      setRelatorioDropdownOpen(false);
                      setShowCustomRelatorioModal(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-gray-800 transition flex items-start gap-2.5 text-white group cursor-pointer border-t border-gray-800/80"
                  >
                    <Sliders className="w-4 h-4 text-sky-400 mt-0.5 shrink-0 group-hover:scale-110 transition" />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Personalizado...</span>
                        <span className="text-[10px] bg-sky-950 text-sky-400 px-1.5 py-0.2 rounded font-mono font-bold">Filtros</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Configure manualmente os filtros de chamados e nível de detalhamento de atas.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {currentUser?.permissions?.entroncamentos?.editar && (
              <button
                onClick={onAdd}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF5022] hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer select-none shadow-sm border-none whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Adicionar Registro</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Metas da Malha de Transporte com Stacked Bar e Legenda de Filtro Exclusivo */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between text-left">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-mono font-bold tracking-widest">
              Metas da Malha de Transporte
            </span>
            <span className="text-xs text-[#1E1E1E] font-mono font-bold flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF5022]"></span>
              {percentDone}% Geral
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-700 font-semibold">
              <span>Distribuição e Resolução de Trechos</span>
              <span className="font-mono">
                {solucionados + semSolucao} de {total} Trechos Concluídos
              </span>
            </div>

            {/* Stacked Progress Bar - Paleta Minimalista Grafite & Laranja */}
            <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100 border border-gray-200/50">
              <div
                className="bg-[#1E1E1E] h-full transition-all duration-500"
                style={{ width: `${pctSolucionados}%` }}
                title={`Solucionados: ${solucionados} (${pctSolucionadosRound}%)`}
              />
              <div
                className="bg-[#FF5022] h-full transition-all duration-500"
                style={{ width: `${pctEmAndamento}%` }}
                title={`Em Andamento: ${emAndamento} (${pctEmAndamentoRound}%)`}
              />
              <div
                className="bg-gray-400 h-full transition-all duration-500"
                style={{ width: `${pctPendentes}%` }}
                title={`Pendentes: ${pendentes} (${pctPendentesRound}%)`}
              />
              <div
                className="bg-gray-200 h-full transition-all duration-500"
                style={{ width: `${pctSemSolucao}%` }}
                title={`Sem Solução: ${semSolucao} (${pctSemSolucaoRound}%)`}
              />
            </div>
          </div>
        </div>

        {/* Legenda Consolidada com Filtro Exclusivo e Paleta Minimalista */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleFilterClick("Solucionado")}
              className={`flex items-center gap-2 cursor-pointer transition select-none px-2 py-1 rounded-lg ${
                selectedStatuses.length === 1 && selectedStatuses[0] === "Solucionado"
                  ? "bg-[#1E1E1E]/10 text-[#1E1E1E] ring-1 ring-[#1E1E1E]/30 font-bold"
                  : selectedStatuses.includes("Solucionado")
                  ? "text-[#1E1E1E] hover:bg-gray-50"
                  : "text-gray-400 opacity-40 hover:opacity-80"
              }`}
              title="Filtrar exclusivamente por Solucionados (clique novamente para limpar)"
            >
              <CheckCircle2 className="w-4 h-4 text-[#1E1E1E] shrink-0" />
              <span>
                Solucionados: <span className="font-mono font-bold text-gray-900">{solucionados}</span>{" "}
                <span className="text-gray-500 font-normal">({pctSolucionadosRound}%)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterClick("Em andamento")}
              className={`flex items-center gap-2 cursor-pointer transition select-none px-2 py-1 rounded-lg ${
                selectedStatuses.length === 1 && selectedStatuses[0] === "Em andamento"
                  ? "bg-[#FF5022]/10 text-[#FF5022] ring-1 ring-[#FF5022]/30 font-bold"
                  : selectedStatuses.includes("Em andamento")
                  ? "text-gray-800 hover:bg-gray-50"
                  : "text-gray-400 opacity-40 hover:opacity-80"
              }`}
              title="Filtrar exclusivamente por Em Andamento (clique novamente para limpar)"
            >
              <Clock className="w-4 h-4 text-[#FF5022] shrink-0" />
              <span>
                Em Andamento: <span className="font-mono font-bold text-gray-900">{emAndamento}</span>{" "}
                <span className="text-gray-500 font-normal">({pctEmAndamentoRound}%)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterClick("Pendente")}
              className={`flex items-center gap-2 cursor-pointer transition select-none px-2 py-1 rounded-lg ${
                selectedStatuses.length === 1 && selectedStatuses[0] === "Pendente"
                  ? "bg-gray-100 text-gray-800 ring-1 ring-gray-300 font-bold"
                  : selectedStatuses.includes("Pendente")
                  ? "text-gray-800 hover:bg-gray-50"
                  : "text-gray-400 opacity-40 hover:opacity-80"
              }`}
              title="Filtrar exclusivamente por Pendentes (clique novamente para limpar)"
            >
              <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
              <span>
                Pendentes: <span className="font-mono font-bold text-gray-900">{pendentes}</span>{" "}
                <span className="text-gray-500 font-normal">({pctPendentesRound}%)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleFilterClick("Sem solução")}
              className={`flex items-center gap-2 cursor-pointer transition select-none px-2 py-1 rounded-lg ${
                selectedStatuses.length === 1 && selectedStatuses[0] === "Sem solução"
                  ? "bg-gray-100 text-gray-700 ring-1 ring-gray-300 font-bold"
                  : selectedStatuses.includes("Sem solução")
                  ? "text-gray-800 hover:bg-gray-50"
                  : "text-gray-400 opacity-40 hover:opacity-80"
              }`}
              title="Filtrar exclusivamente por Sem Solução (clique novamente para limpar)"
            >
              <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
              <span>
                Sem Solução: <span className="font-mono font-bold text-gray-900">{semSolucao}</span>{" "}
                <span className="text-gray-500 font-normal">({pctSemSolucaoRound}%)</span>
              </span>
            </button>
          </div>

          {selectedStatuses.length !== 4 && (
            <button
              type="button"
              onClick={() => handleFilterClick("all")}
              className="text-xs font-bold text-[#FF5022] hover:underline cursor-pointer"
            >
              Ver Todos ({total})
            </button>
          )}
        </div>
      </div>

      {/* 3. Search and Tabs Filter */}
      <div className="space-y-4 pt-1">
        {/* Row 1: Search option (Clean and unboxed) */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar por trechos, provedor, responsável ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022]/20 rounded-lg py-2.5 pl-10 pr-4 text-xs font-sans text-gray-800 placeholder-gray-400 focus:outline-none shadow-xs transition"
          />
        </div>

        {/* Row 2: Tabs Filters for Groups and Deadline states */}
        <div className="flex flex-wrap gap-4 justify-between items-center border-b border-gray-200 pb-0">
          <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedGroup("todos")}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition cursor-pointer font-medium border-b-2 -mb-[1px] bg-transparent ${
                selectedGroup === "todos" 
                  ? "border-[#FF5022] text-[#FF5022]" 
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Todas as Demandas
            </button>
            <button
              onClick={() => setSelectedGroup("abertos")}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition cursor-pointer font-medium border-b-2 -mb-[1px] bg-transparent ${
                selectedGroup === "abertos" 
                  ? "border-[#FF5022] text-[#FF5022]" 
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Demandas Abertas
            </button>
            <button
              onClick={() => setSelectedGroup("fechados")}
              className={`pb-3 text-xs sm:text-sm whitespace-nowrap transition cursor-pointer font-medium border-b-2 -mb-[1px] bg-transparent ${
                selectedGroup === "fechados" 
                  ? "border-[#FF5022] text-[#FF5022]" 
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Concluídas
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pb-3 sm:pb-2">
            {/* Filtro de Prazos */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500 font-mono">Filtro de Prazos:</span>
              <div className="flex gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
                <button
                  onClick={() => setSelectedPrazo("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    selectedPrazo === "all" 
                      ? "bg-[#1E1E1E] text-white shadow-xs" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setSelectedPrazo("atrasado")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    selectedPrazo === "atrasado" 
                      ? "bg-rose-500/15 text-[#FF5022] font-bold border border-rose-200 shadow-xs" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Atrasadas
                </button>
                <button
                  onClick={() => setSelectedPrazo("no-prazo")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    selectedPrazo === "no-prazo" 
                      ? "bg-emerald-500/15 text-emerald-700 font-bold border border-emerald-200 shadow-xs" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  No Prazo
                </button>
                <button
                  onClick={() => setSelectedPrazo("sem-prazo")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    selectedPrazo === "sem-prazo" 
                      ? "bg-gray-200 text-gray-800 font-bold border border-gray-300 shadow-xs" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Sem Prazo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Table Card - White Theme Style matching OTDR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6 text-slate-800">
        <div className="overflow-x-auto">
          {displayRecords.length === 0 ? (
            <div className="p-16 text-center font-sans">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-500">Nenhum entroncamento encontrado</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">Refine o filtro ou a busca por texto para encontrar o registro desejado.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-sans font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 text-left">ID / Rota</th>
                  <th className="py-3 px-3 text-left">Equipamento / Tipo</th>
                  <th className="py-3 px-3 text-left">Provedor / Responsável</th>
                  <th className="py-3 px-3 text-left">Prazo / Conclusão</th>
                  <th className="py-3 px-3 text-left">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-xs">
                {displayRecords.map((item, idx) => {
                  const isSelected = expandedId === item.id;
                  const isPrazoEmpty = !item["PRAZO"] || String(item["PRAZO"]).trim() === "" || String(item["PRAZO"]).trim() === "-";
                  const hasExpired = !isPrazoEmpty && isDeadlineExpired(item["PRAZO"], item["STATUS"]);
                  const routeTitle = formatRouteTitle(
                    item["TRECHO A"],
                    item["TRECHO B"],
                    item["TRECHO C"],
                    item["TRECHO D "]
                  );
                  const statusVal = normalizeStatus(item["STATUS"]);
                  const nomeResponsavel =
                    item.responsaveis?.[0]?.user?.nome ||
                    item.responsaveis?.[0]?.responsavel?.nome ||
                    item.responsavel ||
                    (item["RESPONSÁVEL "] && item["RESPONSÁVEL "] !== "ND" && item["RESPONSÁVEL "] !== "-" ? item["RESPONSÁVEL "] : null) ||
                    (item["RESPONSAVEL"] && item["RESPONSAVEL"] !== "ND" && item["RESPONSAVEL"] !== "-" ? item["RESPONSAVEL"] : null) ||
                    "Não Atribuído";

                  return (
                    <React.Fragment key={item.id ? `${item.id}-${idx}` : `ent-${idx}`}>
                      <tr 
                        onClick={() => setExpandedId(isSelected ? null : item.id)}
                        className={`transition-colors cursor-pointer text-gray-700 ${isSelected ? "bg-white font-medium text-gray-900 border-none" : "hover:bg-gray-50/50"}`}
                      >
                        {/* ID / Rota */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col text-left max-w-xs">
                            <span className="text-[10px] font-medium font-mono text-gray-600 bg-gray-100 rounded px-1.5 py-0.5 inline-block w-fit mb-1">
                              {displayVal(item.ID || item.operId || `REC-${item.id}`)}
                            </span>
                            <span className="text-xs font-bold text-[#1E1E1E] leading-tight">
                              {displayVal(routeTitle.title)}
                            </span>
                            {routeTitle.segments && routeTitle.segments.length > 1 && (
                              <span className="text-[9px] font-medium text-gray-400 mt-0.5 block max-w-xs truncate font-mono">
                                Trechos: {routeTitle.segments.join(" | ")}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Equipamento / Tipo */}
                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          {item["TIPO"] && String(item["TIPO"]).trim() !== "" && String(item["TIPO"]).trim() !== "-" ? (
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium uppercase tracking-wider">
                              {displayVal(item["TIPO"])}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-mono text-[10px]">ND</span>
                          )}
                        </td>

                        {/* Provedor / Responsável */}
                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          <div className="flex flex-col text-left">
                            <span className="font-mono font-bold text-[#1E1E1E]">
                              {displayVal(item["PROVEDOR "] || item["PROVEDOR"])}
                            </span>
                            <span className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 font-sans">
                              <User className="w-3 h-3 text-gray-400 shrink-0" />
                              <span>{nomeResponsavel}</span>
                            </span>
                          </div>
                        </td>

                        {/* Prazo e Data de Conclusão */}
                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-left">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-medium text-gray-400 font-mono uppercase">Prazo:</span>
                              {item["PRAZO"] && String(item["PRAZO"]).trim() !== "" && String(item["PRAZO"]).trim() !== "-" ? (
                                hasExpired ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[#FF5022] font-semibold text-[10px]">
                                    <Calendar className="w-3 h-3 text-[#FF5022] shrink-0" />
                                    {formatSheetDate(item["PRAZO"])}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[#1E1E1E] font-medium text-[10px]">
                                    <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                                    {formatSheetDate(item["PRAZO"])}
                                  </span>
                                )
                              ) : (
                                <span className="text-gray-400 text-[10px] font-mono">ND</span>
                              )}
                            </div>

                            {(() => {
                              const concDate = getCompletionDateStr(item);
                              if (!concDate) return null;
                              return (
                                <div className="flex items-center gap-1 mt-0.5 pt-0.5 border-t border-gray-100">
                                  <span className="text-[9px] font-medium text-gray-400 font-mono uppercase flex items-center gap-0.5">
                                    <CheckCircle className="w-3 h-3 text-gray-400 shrink-0" />
                                    Conclusão:
                                  </span>
                                  <span className="text-[10px] font-medium text-[#1E1E1E]">
                                    {formatSheetDate(concDate)}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium leading-none uppercase bg-gray-100 text-gray-700">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              statusVal === "Solucionado"
                                ? "bg-emerald-500"
                                : statusVal === "Sem solução"
                                  ? "bg-rose-500"
                                  : statusVal === "Em andamento"
                                    ? "bg-amber-400"
                                    : "bg-[#FF5022]"
                            }`}></span>
                            {displayVal(item["STATUS"])}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isSelected && (
                              <>
                                {statusVal !== "Solucionado" && statusVal !== "Sem solução" && currentUser?.permissions?.entroncamentos?.editar && (
                                  <button
                                    onClick={() => onStartFinalize(item)}
                                    className="font-medium px-2.5 py-1 rounded-md border border-gray-200 text-emerald-700 hover:bg-emerald-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                                    title="Finalizar e mudar status para Solucionado"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Finalizar</span>
                                  </button>
                                )}
                                {currentUser?.permissions?.entroncamentos?.editar && (
                                  <button
                                    onClick={() => onEdit(item)}
                                    className="font-medium px-2.5 py-1 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                                    title="Editar"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-gray-500" />
                                    <span>Editar</span>
                                  </button>
                                )}
                                {currentUser?.permissions?.entroncamentos?.excluir && (
                                  <button
                                    onClick={() => onDelete(item)}
                                    className="font-medium px-2.5 py-1 rounded-md border border-gray-200 text-rose-600 hover:bg-rose-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Excluir</span>
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => setExpandedId(isSelected ? null : item.id)}
                              className="font-medium px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:text-[#FF5022] hover:border-[#FF5022]/40 transition text-[11px] cursor-pointer bg-white shadow-xs"
                            >
                              {isSelected ? "Fechar" : "Detalhes"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded selected details view (Adaptação ao Light Box) */}
                      {isSelected && (
                        <tr className="bg-white border-none">
                          <td colSpan={6} className="px-4 py-4 pt-1">
                            <div className="space-y-4 text-left">
                              {/* Top Section: Descrição e Escopo Técnico */}
                              <div className="py-3 border-t border-b border-gray-100">
                                <div className="space-y-1.5 flex flex-col">
                                  <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 font-mono">
                                    Descrição e Escopo Técnico do Trecho
                                  </h4>
                                  <div className="pt-0.5">
                                    {item["DESCRIÇÃO"] && String(item["DESCRIÇÃO"]).trim() !== "" && String(item["DESCRIÇÃO"]).trim() !== "-" ? (
                                      <p className="text-[#1E1E1E] text-sm leading-relaxed whitespace-pre-line">
                                        {displayVal(item["DESCRIÇÃO"])}
                                      </p>
                                    ) : (
                                      <p className="text-gray-400 text-sm italic">
                                        ND
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom Section: Histórico / Atas */}
                              <div className="space-y-2.5 pt-1">
                                <div className="flex justify-between items-center pb-1">
                                  <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                    Histórico de Cobranças / Observações / Atas
                                  </h5>
                                  {currentUser?.permissions?.entroncamentos?.editar && (
                                    <button
                                      onClick={() => onOpenAta(item)}
                                      className="px-3 py-1 rounded-md text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:text-[#FF5022] hover:border-[#FF5022]/40 transition cursor-pointer select-none flex items-center gap-1.5 shadow-xs"
                                      title="Inserir novas informações de Ata de alinhamento"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Nova Ata</span>
                                    </button>
                                  )}
                                </div>

                                <div>
                                  {(() => {
                                    const rawTimeline = item["AÇÕES"] || item["ACOES"] || item["OBSERVAÇÕES"] || item["OBSERVACOES"] || "";
                                    const logs = parseTimelineLogs(rawTimeline);
                                    if (logs.length === 0 && (!item.historico || item.historico.length === 0)) {
                                      return rawTimeline ? (
                                        <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-line break-words">{rawTimeline}</p>
                                      ) : (
                                        <p className="text-gray-400 text-xs italic">Nenhuma ata ou histórico registrado. Use o botão + Nova Ata para inserir!</p>
                                      );
                                    }

                                    const ataLogs = logs.filter(log => !log.content.includes("[ALTERAÇÃO DE PRAZO]") && !log.content.includes("[ALTERACAO_DE_PRAZO]"));

                                    return (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1E1E] font-sans border-b border-gray-100 pb-1.5">
                                          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                                          <span>Atas & Alinhamentos de Reuniões</span>
                                          <span className="text-[10px] font-normal text-gray-400 font-mono">
                                            ({item.historico && item.historico.length > 0 ? item.historico.length : ataLogs.length})
                                          </span>
                                        </div>
                                        
                                        {item.historico?.length > 0 ? (
                                          <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3.5 text-left ml-2 scrollbar-thin">
                                            {item.historico.map((ata: any) => (
                                              <div key={ata.id_historico || ata.id} className="relative pl-4 border-l-2 border-gray-200 mb-4">
                                                <div className="absolute w-2 h-2 bg-red-500 rounded-full -left-[5px] top-1"></div>
                                                <div className="text-xs text-gray-500 mb-1">
                                                  <span className="font-semibold text-gray-700">{formatDate(ata.created_at || ata.data_ocorrencia)}</span> • por {ata.nome_autor || ata.autor?.nome || 'Usuário'}
                                                </div>
                                                <div className="text-sm text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-100 whitespace-pre-wrap break-words">{ata.descricao}</div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : ataLogs.length > 0 ? (
                                          <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3.5 relative border-l border-gray-200 pl-3.5 text-left ml-2 scrollbar-thin">
                                            {ataLogs.map((log, lidx) => {
                                              const isAta = typeof log.content === "string" && log.content.includes("[ATA/ALINHAMENTO]");
                                              let cleanContent = typeof log.content === "string" ? log.content : String(log.content || "");
                                              if (isAta) {
                                                cleanContent = cleanContent.replace("[ATA/ALINHAMENTO]", "").trim();
                                              }
                                              const lines = cleanContent.split("\n").map(l => l.trim()).filter(Boolean);

                                              return (
                                                <div key={`ata-${lidx}`} className="relative text-left font-sans group">
                                                  {/* dot */}
                                                  <div className="absolute -left-[19.5px] top-2 w-2 h-2 rounded-full border border-white bg-[#FF5022]" />
                                                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                                    <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1 flex-wrap">
                                                      <span className="px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600">{log.date}</span>
                                                      <span>• por {log.author || "Sistema"}</span>
                                                    </div>

                                                    {/* Edit & Delete Action Buttons */}
                                                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition">
                                                      {currentUser?.permissions?.entroncamentos?.editar && (
                                                        <button
                                                          onClick={() => onEditTimelineEntry?.(item, "AÇÕES", log.index !== undefined ? log.index : lidx, log.date, log.content)}
                                                          className="p-1 rounded text-gray-500 hover:text-[#FF5022] transition cursor-pointer border-none bg-transparent"
                                                          title="Editar ata"
                                                        >
                                                          <Edit className="w-3 h-3" />
                                                        </button>
                                                      )}
                                                      {currentUser?.permissions?.entroncamentos?.excluir && (
                                                        <button
                                                          onClick={() => onDeleteTimelineEntry?.(item, "AÇÕES", log.index !== undefined ? log.index : lidx)}
                                                          className="p-1 rounded text-gray-400 hover:text-rose-600 transition cursor-pointer border-none bg-transparent"
                                                          title="Excluir ata"
                                                        >
                                                          <Trash2 className="w-3 h-3" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>

                                                  <div className="mt-1 space-y-1 p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-700 font-sans text-xs break-words whitespace-pre-wrap">
                                                    {lines.map((line, lineIdx) => {
                                                      const isTitleBullet = line.startsWith("• Objetivo:") || line.startsWith("• Descrição:") || line.startsWith("• Prazo de retorno:");
                                                      return (
                                                        <p key={lineIdx} className={isTitleBullet ? "text-gray-800 font-semibold text-[11px]" : "whitespace-pre-line pl-1 text-gray-600"}>
                                                          {line}
                                                        </p>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-gray-400 italic">Nenhuma ata registrada.</p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick Import Modal */}
      {showQuickImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-2xl w-full overflow-hidden text-slate-800"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-teal-50/40">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Cadastro Rápido de Entroncamentos
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowQuickImportModal(false);
                  setQuickImportText("");
                  setCsvFile(null);
                  setImportStatus("idle");
                  setImportMsg("");
                }}
                className="text-slate-400 hover:text-slate-650 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selection */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setImportMode("text");
                  setImportStatus("idle");
                  setImportMsg("");
                }}
                className={`flex-1 py-2.5 text-center text-xs font-bold font-mono uppercase tracking-wider transition rounded-xl cursor-pointer ${
                  importMode === "text"
                    ? "bg-white text-teal-700 shadow-sm border border-slate-200/50"
                    : "text-slate-450 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                📝 Texto Copiado (Excel/Sheets)
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportMode("csv");
                  setImportStatus("idle");
                  setImportMsg("");
                }}
                className={`flex-1 py-2.5 text-center text-xs font-bold font-mono uppercase tracking-wider transition rounded-xl cursor-pointer ${
                  importMode === "csv"
                    ? "bg-white text-teal-700 shadow-sm border border-slate-200/50"
                    : "text-slate-450 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                📎 Importar Arquivo CSV
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {importMode === "text" ? (
                <>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans text-left">
                    Cole abaixo a linha de dados copiada diretamente do Excel ou Google Sheets. 
                    O sistema identificará de forma inteligente o ID (ex: <strong>ENT-027</strong>), os Trechos (ex: <strong>CALDAS BRANDÃO &lt;&gt; BAYEUX</strong>), Coordenadas, Descrição, Ações e Status.
                  </p>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                      Dados Copiados da Planilha:
                    </label>
                    <textarea
                      value={quickImportText}
                      onChange={(e) => setQuickImportText(e.target.value)}
                      placeholder={`Cole aqui... Ex:
ENT-027\t\tAnálise do trecho de transmissão afetado. Incidentes e cruzamento de rotas de fibra óptica em andamento técnico.\tCALDAS BRANDÃO <> BAYEUX \tBAYEUX <> GUARABIRA \t\t\t-7.122222, -34.983861 // -7.124083, -34.979417\t\t\t"02/06/2026:\n• Descrição: Aguardando vistoria"\tPendente`}
                      className="w-full h-32 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-teal-500 rounded-xl p-3.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 resize-y"
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans text-left">
                    Selecione ou arraste um arquivo <strong>CSV (.csv)</strong> contendo as colunas de entroncamentos. 
                    A importação irá <strong>limpar o cache local</strong>, sincronizar com a planilha vinculada e verificar duplicados.
                  </p>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        if (file.name.endsWith(".csv")) {
                          setCsvFile(file);
                        } else {
                          setImportStatus("error");
                          setImportMsg("Por favor, envie apenas arquivos com a extensão .csv");
                        }
                      }
                    }}
                    onClick={() => {
                      const input = document.getElementById("csv-file-input");
                      if (input) input.click();
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                      isDragging 
                        ? "border-teal-500 bg-teal-50/40" 
                        : csvFile 
                        ? "border-emerald-500 bg-emerald-50/10" 
                        : "border-slate-300 hover:border-teal-400 bg-slate-50"
                    }`}
                  >
                    <input
                      id="csv-file-input"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          setCsvFile(files[0]);
                        }
                      }}
                    />
                    <Upload className={`w-8 h-8 ${csvFile ? "text-emerald-500" : "text-slate-400"}`} />
                    {csvFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-700">{csvFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{(csvFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-600">Arraste seu arquivo CSV ou clique para selecionar</p>
                        <p className="text-[10px] text-slate-400">Suporta delimitadores de vírgula, ponto e vírgula, e tabulação</p>
                      </div>
                    )}
                  </div>

                  {/* Duplicate Handle Choice */}
                  <div className="space-y-2 text-left bg-slate-50 border border-slate-150 rounded-xl p-4">
                    <label className="text-[10px] font-black font-mono text-slate-500 uppercase tracking-wider block">
                      Tratamento de Registros Duplicados (Mesmo ID):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="duplicateAction"
                          checked={duplicateAction === "merge"}
                          onChange={() => setDuplicateAction("merge")}
                          className="mt-0.5 text-teal-600 focus:ring-teal-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Mesclar / Incrementar</p>
                          <p className="text-[10px] text-slate-450 leading-normal">
                            Atualiza campos modificados e concatena novas Ações/Observações sem perder dados antigos.
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="duplicateAction"
                          checked={duplicateAction === "ignore"}
                          onChange={() => setDuplicateAction("ignore")}
                          className="mt-0.5 text-teal-600 focus:ring-teal-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Ignorar / Pular</p>
                          <p className="text-[10px] text-slate-450 leading-normal">
                            Mantém o registro atual inalterado e ignora a linha correspondente do arquivo CSV.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {importStatus === "success" && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-150 text-emerald-700 text-xs font-medium flex items-center gap-2 text-left">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{importMsg}</span>
                </div>
              )}
              {importStatus === "error" && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-150 text-rose-700 text-xs font-medium flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{importMsg}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowQuickImportModal(false);
                  setQuickImportText("");
                  setCsvFile(null);
                  setImportStatus("idle");
                  setImportMsg("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 bg-white font-bold text-xs transition cursor-pointer select-none"
              >
                Cancelar
              </button>

              {importMode === "text" ? (
                <button
                  type="button"
                  disabled={!quickImportText.trim() || importStatus === "loading"}
                  onClick={async () => {
                    setImportStatus("loading");
                    try {
                      const parsedForm = parseDirectPaste(quickImportText);
                      if (!parsedForm["TRECHO A"] || !parsedForm["TRECHO B"]) {
                        throw new Error("Não foi possível identificar os trechos principais (ex: 'TRECHO A <> TRECHO B') no texto colado.");
                      }
                      if (onQuickImportDirect) {
                        const success = await onQuickImportDirect(parsedForm);
                        if (success) {
                          setImportStatus("success");
                          setImportMsg("✓ Entroncamento cadastrado com sucesso e sincronizado com a planilha!");
                          setTimeout(() => {
                            setShowQuickImportModal(false);
                            setQuickImportText("");
                            setImportStatus("idle");
                            setImportMsg("");
                          }, 1500);
                        } else {
                          throw new Error("Erro ao salvar o registro no banco de dados.");
                        }
                      } else {
                        throw new Error("Função de importação não está disponível.");
                      }
                    } catch (e: any) {
                      setImportStatus("error");
                      setImportMsg(e.message || "Erro desconhecido ao processar os dados.");
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition cursor-pointer select-none border-none shadow-md ${
                    !quickImportText.trim() || importStatus === "loading"
                      ? "bg-slate-300 shadow-none cursor-not-allowed"
                      : "bg-teal-600 hover:bg-teal-500 shadow-teal-500/10"
                  }`}
                >
                  {importStatus === "loading" ? "Processando..." : "Cadastrar Entroncamento"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!csvFile || importStatus === "loading"}
                  onClick={async () => {
                    if (!csvFile) return;
                    setImportStatus("loading");
                    setImportMsg("Limpando cache, sincronizando banco de dados...");
                    try {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const text = event.target?.result as string;
                          if (!text) {
                            throw new Error("Não foi possível ler o conteúdo do arquivo CSV.");
                          }
                          const parsedRows = parseCSV(text);
                          if (parsedRows.length === 0) {
                            throw new Error("Nenhum registro válido pôde ser importado do CSV. Verifique os cabeçalhos.");
                          }

                          if (onCSVImport) {
                            const result = await onCSVImport(parsedRows, duplicateAction);
                            if (result.success) {
                              setImportStatus("success");
                              setImportMsg(result.msg);
                              setTimeout(() => {
                                setShowQuickImportModal(false);
                                setCsvFile(null);
                                setImportStatus("idle");
                                setImportMsg("");
                              }, 3000);
                            } else {
                              throw new Error(result.msg);
                            }
                          } else {
                            throw new Error("Função de importação de CSV não está disponível no sistema.");
                          }
                        } catch (e: any) {
                          setImportStatus("error");
                          setImportMsg(e.message || "Erro ao parsear arquivo CSV.");
                        }
                      };
                      reader.onerror = () => {
                        setImportStatus("error");
                        setImportMsg("Falha ao ler o arquivo físico do disco.");
                      };
                      reader.readAsText(csvFile, "UTF-8");
                    } catch (e: any) {
                      setImportStatus("error");
                      setImportMsg(e.message || "Erro desconhecido durante o upload.");
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition cursor-pointer select-none border-none shadow-md ${
                    !csvFile || importStatus === "loading"
                      ? "bg-slate-300 shadow-none cursor-not-allowed"
                      : "bg-teal-600 hover:bg-teal-500 shadow-teal-500/10"
                  }`}
                >
                  {importStatus === "loading" ? "Processando..." : "Sincronizar e Importar CSV"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Configuração Personalizada do Relatório Gerencial */}
      {showCustomRelatorioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-[#FF5022]" />
                <div>
                  <h3 className="text-sm font-bold tracking-wide text-white">
                    Configuração do Relatório Gerencial
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Defina o escopo de chamados e a profundidade de atas a serem impressas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomRelatorioModal(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-slate-800 text-xs">
              {/* 1. Filtro de Chamados */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-900 uppercase font-mono tracking-wider block">
                  1. Filtro de Chamados (Status)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTempFilterMode("todos")}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      tempFilterMode === "todos"
                        ? "border-[#FF5022] bg-orange-50/50 text-[#FF5022] ring-1 ring-[#FF5022]"
                        : "border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Todos</span>
                      {tempFilterMode === "todos" && <Check className="w-3.5 h-3.5 text-[#FF5022]" />}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium leading-tight">
                      Abertos + Concluídos
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTempFilterMode("abertos")}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      tempFilterMode === "abertos"
                        ? "border-[#FF5022] bg-orange-50/50 text-[#FF5022] ring-1 ring-[#FF5022]"
                        : "border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Apenas Abertos</span>
                      {tempFilterMode === "abertos" && <Check className="w-3.5 h-3.5 text-[#FF5022]" />}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium leading-tight">
                      Pendente, Andamento e Sem Solução
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTempFilterMode("fechados")}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      tempFilterMode === "fechados"
                        ? "border-emerald-600 bg-emerald-50/50 text-emerald-700 ring-1 ring-emerald-600"
                        : "border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Apenas Solucionados</span>
                      {tempFilterMode === "fechados" && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium leading-tight">
                      Finalizados e Concluídos
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. Filtro de Atas / Movimentações */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-900 uppercase font-mono tracking-wider block">
                  2. Filtro de Atas & Histórico
                </label>
                <div className="space-y-2">
                  <label
                    onClick={() => setTempAtasMode("todas")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      tempAtasMode === "todas"
                        ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="atasMode"
                      checked={tempAtasMode === "todas"}
                      onChange={() => setTempAtasMode("todas")}
                      className="mt-0.5 text-[#FF5022] focus:ring-[#FF5022]"
                    />
                    <div>
                      <div className="font-bold text-xs text-gray-900">Todas as Movimentações (Histórico Completo)</div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Imprime a lista cronológica de todas as atas registradas para cada trecho.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setTempAtasMode("ultima")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      tempAtasMode === "ultima"
                        ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="atasMode"
                      checked={tempAtasMode === "ultima"}
                      onChange={() => setTempAtasMode("ultima")}
                      className="mt-0.5 text-[#FF5022] focus:ring-[#FF5022]"
                    />
                    <div>
                      <div className="font-bold text-xs text-gray-900">Apenas a Última Ata (Resumido para Diretoria)</div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Exibe somente a atualização mais recente de cada chamado para leitura rápida.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setTempAtasMode("sem_atas")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      tempAtasMode === "sem_atas"
                        ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="atasMode"
                      checked={tempAtasMode === "sem_atas"}
                      onChange={() => setTempAtasMode("sem_atas")}
                      className="mt-0.5 text-[#FF5022] focus:ring-[#FF5022]"
                    />
                    <div>
                      <div className="font-bold text-xs text-gray-900">Sem Atas (Apenas os Cards dos Trechos)</div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Oculta caixas de histórico e gera uma listagem enxuta apenas com provedor, rota, status e previsão.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCustomRelatorioModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-xs hover:bg-gray-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRelatorioFilterMode(tempFilterMode);
                  setSelectedRelatorioAtasMode(tempAtasMode);
                  setShowCustomRelatorioModal(false);
                  setShowRelatorioModal(true);
                }}
                className="px-5 py-2 rounded-lg bg-[#FF5022] hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer shadow-sm border-none flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Gerar Relatório</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Visualização e Exportação do Relatório Gerencial de Entroncamentos */}
      <RelatorioGerencialEntroncamentos
        isOpen={showRelatorioModal}
        onClose={() => setShowRelatorioModal(false)}
        entroncamentos={entroncamentos}
        selectedPeriod={selectedPeriod}
        periodStartDate={periodStartDate}
        periodEndDate={periodEndDate}
        formatRouteTitle={formatRouteTitle}
        normalizeStatus={normalizeStatus}
        parseTimelineLogs={parseTimelineLogs}
        formatSheetDate={formatSheetDate}
        isDeadlineExpired={isDeadlineExpired}
        initialFilterMode={selectedRelatorioFilterMode}
        initialAtasMode={selectedRelatorioAtasMode}
        onPeriodChange={(newPeriod, start, end) => {
          setSelectedPeriod(newPeriod);
          if (start !== undefined) setPeriodStartDate(start);
          if (end !== undefined) setPeriodEndDate(end);
        }}
      />
    </motion.div>
  );
};
