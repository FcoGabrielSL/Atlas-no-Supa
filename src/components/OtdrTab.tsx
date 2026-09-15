import React, { useState, useMemo } from "react";
import { 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Calendar, 
  CheckCircle, 
  Clock, 
  User, 
  Info,
  X,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertTriangle,
  CalendarRange,
  MessageSquare,
  Pause,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface OtdrTabProps {
  filteredOtdr: any[];
  otdrData: any[];
  currentUser: any;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onStartFinalize: (item: any) => void;
  isDeadlineExpired: (prazo: string, status: string) => boolean;
  formatSheetDate: (dateStr: string) => string;
  normalizeStatus: (status: string) => string;
  parseTimelineLogs: (logsStr: string) => any[];
  isOtdrScriptOutdated: boolean;
  onEditDescription: (item: any) => void;
  onExtendDeadline: (item: any) => void;
  onOpenAta: (item: any) => void;
  onEditTimelineEntry?: (item: any, field: string, entryIndex: number, date: string, content: string) => void;
  onDeleteTimelineEntry?: (item: any, field: string, entryIndex: number) => void;
  onQuickImportDirect?: (record: any) => Promise<boolean>;
  isSyncPaused?: boolean;
  onToggleSyncPause?: () => void;
  pendingSyncCount?: number;
}

export const OtdrTab: React.FC<OtdrTabProps> = ({
  filteredOtdr,
  otdrData,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
  onStartFinalize,
  isDeadlineExpired,
  formatSheetDate,
  normalizeStatus,
  parseTimelineLogs,
  isOtdrScriptOutdated,
  onEditDescription,
  onExtendDeadline,
  onOpenAta,
  onEditTimelineEntry,
  onDeleteTimelineEntry,
  onQuickImportDirect,
  isSyncPaused,
  onToggleSyncPause,
  pendingSyncCount
}) => {
  const formatTamanho = (val: any) => {
    if (!val) return "-";
    const str = String(val).trim();
    if (/km$/i.test(str)) {
      return str.toUpperCase();
    }
    return `${str} KM`;
  };

  // Estados para Cadastro Rápido
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState("");

  const parseQuickOtdr = (text: any) => {
    if (!text || typeof text !== "string") return null;
    const parts = text.split('\t').map(p => p.trim());
    if (parts.length >= 7) {
      return {
        "TRECHO": parts[0] || '',
        "ONDE TEM": parts[1] || '',
        "ONDE PRECISA": parts[2] || '',
        "TAMANHO KM": parts[3] || '',
        "STATUS": parts[4] || 'Pendente',
        "OBSERVAÇÃO": parts[5] || '',
        "Data de abertura": parts[6] || new Date().toLocaleDateString('pt-BR'),
        "data estimada": parts[7] || '',
        "data de conclusão": parts[8] || ''
      };
    }

    let trecho = "";
    const trechoMatch = text.match(/([a-zA-Z0-9\s_-]+(?:<>|>>)[a-zA-Z0-9\s_-]+)/i);
    if (trechoMatch) {
      trecho = trechoMatch[0].trim();
    }

    const dateMatches = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [];
    const dataAbertura = dateMatches[0] || new Date().toLocaleDateString('pt-BR');
    const dataEstimada = dateMatches[1] || "";
    const dataConclusao = dateMatches[2] || "";

    let km = "";
    const kmMatch = text.match(/(\d+)\s*(?:km|KM)/i);
    if (kmMatch) {
      km = kmMatch[1];
    }

    let status = "Pendente";
    if (/pendente|aberto/i.test(text)) status = "Pendente";
    else if (/concluido|concluído|finalizado/i.test(text)) status = "Concluído";
    else if (/andamento/i.test(text)) status = "Em andamento";

    let ondeTem = "";
    let ondePrecisa = "";
    if (trecho) {
      const partsOfTrecho = trecho.split(/[><=-]+/);
      ondeTem = partsOfTrecho[0]?.trim() || "";
      ondePrecisa = partsOfTrecho[1]?.trim() || "";
    }

    let obs = "";
    if (trecho) {
      const partsAfterTrecho = text.split(trecho)[1];
      obs = partsAfterTrecho?.trim() || "";
    } else {
      obs = text;
    }

    return {
      "TRECHO": trecho || "ND",
      "ONDE TEM": ondeTem,
      "ONDE PRECISA": ondePrecisa,
      "TAMANHO KM": km,
      "STATUS": status,
      "OBSERVAÇÃO": obs,
      "Data de abertura": dataAbertura,
      "data estimada": dataEstimada,
      "data de conclusão": dataConclusao
    };
  };

  const handleQuickImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickImportText.trim()) {
      alert("Por favor, insira o texto a ser cadastrado.");
      return;
    }

    setImportStatus("loading");
    try {
      const parsed = parseQuickOtdr(quickImportText);
      if (!parsed.TRECHO || parsed.TRECHO === "ND") {
        setImportStatus("error");
        setImportMsg("Não foi possível identificar o trecho no texto informado. Certifique-se de que ele contém o formato LOCAL_A <> LOCAL_B.");
        return;
      }

      if (onQuickImportDirect) {
        const success = await onQuickImportDirect(parsed);
        if (success) {
          setImportStatus("success");
          setShowQuickImportModal(false);
          setQuickImportText("");
          setImportMsg("");
        } else {
          setImportStatus("error");
          setImportMsg("Ocorreu um erro ao processar o cadastro rápido.");
        }
      } else {
        setImportStatus("error");
        setImportMsg("Ação de cadastro rápido não configurada para esta guia.");
      }
    } catch (err: any) {
      setImportStatus("error");
      setImportMsg("Erro: " + (err.message || err));
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["Solucionado", "Em andamento", "Pendente", "Sem solução"]);
  const [selectedGroup, setSelectedGroup] = useState<"todos" | "abertos" | "fechados">("todos");
  const [selectedPrazo, setSelectedPrazo] = useState<"all" | "atrasado" | "sem-prazo" | "no-prazo">("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [periodStartDate, setPeriodStartDate] = useState<string>("");
  const [periodEndDate, setPeriodEndDate] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCardClick = (status: string) => {
    if (status === "all") {
      if (selectedStatuses.length === 4) {
        setSelectedStatuses([]);
      } else {
        setSelectedStatuses(["Solucionado", "Em andamento", "Pendente", "Sem solução"]);
      }
    } else {
      setSelectedStatuses(prev => {
        if (prev.includes(status)) {
          return prev.filter(x => x !== status);
        } else {
          return [...prev, status];
        }
      });
    }
  };

  // KPIs
  const total = otdrData.length;
  const solucionados = otdrData.filter(x => normalizeStatus(x.STATUS) === "Solucionado").length;
  const emAndamento = otdrData.filter(x => normalizeStatus(x.STATUS) === "Em andamento").length;
  const pendentes = otdrData.filter(x => normalizeStatus(x.STATUS) === "Pendente").length;
  const semSolucao = otdrData.filter(x => normalizeStatus(x.STATUS) === "Sem solução").length;

  const checkIsDeadlineExpired = (prazoStr: any, statusStr: any): boolean => {
    if (!prazoStr) return false;
    const norm = normalizeStatus(statusStr);
    if (norm === "Solucionado" || norm === "Sem solução") return false;

    const clean = String(prazoStr).trim();
    if (!clean || clean === "-" || clean === "—" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "a definir") {
      return false;
    }

    let deadlineDate: Date | null = null;
    const dmyMatch = clean.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        deadlineDate = new Date(year, month, day, 23, 59, 59);
      }
    } else {
      const ymdMatch = clean.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
      if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          deadlineDate = new Date(year, month, day, 23, 59, 59);
        }
      } else {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
          deadlineDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        }
      }
    }

    if (!deadlineDate) return false;
    const now = new Date();
    return now > deadlineDate;
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
      item["data de conclusão"],
      item["DATA DE CONCLUSÃO"],
      item["DATA DE RESOLUÇÃO"],
      item["DATA CONCLUSÃO"],
      item["DATA_CONCLUSAO"],
      item["DATA_RESOLUCAO"],
      item["data_resolucao"],
      item["data_conclusao"],
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

    // 2. Caso esteja resolvido sem coluna de data preenchida,
    // buscar nos campos de texto por padrão [CONCLUSÃO]
    const textFields = [
      item["OBSERVAÇÃO"],
      item["OBSERVAÇÃO "],
      item["OBSERVACAO"],
      item["HISTORICO"],
      item["HISTÓRICO"],
      item["PLANEJAMENTO DE ATUAÇÃO"],
      item["ATAS"],
      item["NOTAS"]
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

  const displayRecords = useMemo(() => {
    return filteredOtdr.filter((item) => {
      // 1. Text Search
      const query = searchTerm.toLowerCase();
      const matchSearch =
        (item["TRECHO"] || "").toLowerCase().includes(query) ||
        (item["ONDE TEM"] || "").toLowerCase().includes(query) ||
        (item["ONDE PRECISA"] || "").toLowerCase().includes(query) ||
        (item["OBSERVAÇÃO "] || "").toLowerCase().includes(query) ||
        (item["OBSERVAÇÃO"] || "").toLowerCase().includes(query) ||
        getCompletionDateStr(item).toLowerCase().includes(query);

      // 2. Individual Status Filter
      const statusVal = normalizeStatus(item["STATUS"]);
      const matchStatus = selectedStatuses.includes(statusVal);

      // 3. Group Filter (Abertas vs Concluídas)
      let matchGroup = true;
      if (selectedGroup === "abertos") {
        matchGroup = statusVal === "Pendente" || statusVal === "Em andamento";
      } else if (selectedGroup === "fechados") {
        matchGroup = statusVal === "Solucionado" || statusVal === "Sem solução";
      }

      // 4. Deadline Filter
      const prazoVal = item["data estimada"] || item["PRAZO"] || item["prazo"];
      const isPrazoEmpty = !prazoVal || String(prazoVal).trim() === "" || String(prazoVal).trim() === "-";
      const isExpired = !isPrazoEmpty && checkIsDeadlineExpired(prazoVal, item["STATUS"]);
      
      let matchPrazo = true;
      if (selectedPrazo === "sem-prazo") {
        matchPrazo = isPrazoEmpty;
      } else if (selectedPrazo === "atrasado") {
        matchPrazo = isExpired;
      } else if (selectedPrazo === "no-prazo") {
        matchPrazo = !isPrazoEmpty && !isExpired;
      }

      // 5. Period Filter (Demandas Resolvidas / Concluídas no período)
      let matchPeriod = true;
      if (selectedPeriod !== "all") {
        const concDateStr = getCompletionDateStr(item);
        if (!concDateStr) {
          matchPeriod = false;
        } else {
          const recordDate = parseDateString(concDateStr);
          if (!recordDate) {
            matchPeriod = false;
          } else {
            recordDate.setHours(0, 0, 0, 0);
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
              if (!periodStartDate && !periodEndDate) {
                matchPeriod = true;
              } else {
                rangeStart = periodStartDate ? new Date(`${periodStartDate}T00:00:00`) : new Date(0);
                rangeEnd = periodEndDate ? new Date(`${periodEndDate}T23:59:59`) : new Date();
                matchPeriod = recordDate >= rangeStart && recordDate <= rangeEnd;
              }
            } else {
              matchPeriod = true;
            }

            if (selectedPeriod !== "custom") {
              matchPeriod = recordDate >= rangeStart && recordDate <= rangeEnd;
            }
          }
        }
      }

      return matchSearch && matchStatus && matchGroup && matchPrazo && matchPeriod;
    });
  }, [filteredOtdr, searchTerm, selectedStatuses, selectedGroup, selectedPrazo, selectedPeriod, periodStartDate, periodEndDate]);

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

      {/* Script notice in Light banner */}
      {isOtdrScriptOutdated && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm text-slate-800">
          <div className="flex gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 md:mt-0 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 animate-pulse text-amber-600" />
            </div>
            <div className="text-left font-sans col-span-3">
              <h4 className="text-sm font-bold text-slate-805 font-mono uppercase tracking-wider">
                Aba 'OTDR' não configurada no Google Sheets!
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                A API respondeu com sucesso, mas o script de integration do Google Sheets não está enviando os dados da guia <strong>"OTDR"</strong>. O sistema carregou dados locais de fallback. Sincronize atualizando seu Apps Script na aba <strong>"Parâmetro / Config"</strong>!
              </p>
            </div>
          </div>
        </div>
      )}

          {/* 1. Header Card (Matching Atenuações) */}
      <div className="bg-white text-slate-800 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1 text-left">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-amber-500 rounded-full inline-block"></span>
            Planejamento OTDR
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Diagnóstico e planejamento de testes de refletometria óptica na malha física • <span className="text-amber-600 font-bold">{displayRecords.length}</span> registros visíveis
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {onToggleSyncPause && (
            <button
              onClick={onToggleSyncPause}
              title={isSyncPaused ? "Sincronização pausada. Clique para despausar e enviar para o Google Sheets" : "Sincronização ativa. Clique para pausar a sincronização automática"}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer select-none shrink-0 shadow-xs ${
                isSyncPaused
                  ? "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400 font-extrabold shadow-md shadow-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-800 border-emerald-300 hover:bg-emerald-500/20"
              }`}
            >
              {isSyncPaused ? (
                <>
                  <Pause className="w-4 h-4 text-slate-950 fill-slate-950 animate-pulse" />
                  <span className="text-slate-950 font-black tracking-tight">Sincronia Pausada {pendingSyncCount ? `(${pendingSyncCount})` : ''}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-emerald-600" />
                  <span>Sincronia Ativa</span>
                </>
              )}
            </button>
          )}

          {currentUser?.permissions?.otdr?.editar && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold transition cursor-pointer select-none shrink-0"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Adicionar Registro</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. KPIs Section (Click to Filter Status Cards) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Filtro por Situação (Clique nos cards para filtrar a tabela)
          </span>
          {selectedStatuses.length !== 4 && (
            <button
              onClick={() => handleCardClick("all")}
              className="text-[10px] font-bold text-amber-600 hover:text-amber-750 transition cursor-pointer"
            >
              Ver Todos os Trechos
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Cadastrados */}
          <button
            onClick={() => handleCardClick("all")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.length === 4
                ? "border-amber-300 bg-amber-50/50 text-amber-900 ring-2 ring-amber-500/20"
                : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 opacity-60 hover:opacity-100 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.length === 4 ? "bg-amber-100 text-amber-850" : "bg-slate-100 text-slate-500"
              }`}>
                Mapeados
              </span>
              <span className="text-xs">📋</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-xl font-black font-mono ${
                selectedStatuses.length === 4 ? "text-amber-750" : "text-slate-400"
              }`}>{total}</span>
              <span className="text-[10px] font-bold text-slate-500">trechos</span>
            </div>
          </button>

          {/* Card 2: Solucionados */}
          <button
            onClick={() => handleCardClick("Solucionado")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.includes("Solucionado")
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 opacity-60 hover:opacity-100 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.includes("Solucionado") ? "bg-emerald-100 text-emerald-850" : "bg-slate-100 text-slate-500"
              }`}>
                Solucionados
              </span>
              <span className="text-xs">🟢</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-xl font-black font-mono ${
                selectedStatuses.includes("Solucionado") ? "text-emerald-700" : "text-slate-400"
              }`}>{solucionados}</span>
              <span className="text-[10px] font-bold text-slate-500">trechos</span>
            </div>
          </button>

          {/* Card 3: Em Andamento */}
          <button
            onClick={() => handleCardClick("Em andamento")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.includes("Em andamento")
                ? "border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20"
                : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 opacity-60 hover:opacity-100 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.includes("Em andamento") ? "bg-amber-100 text-amber-850" : "bg-slate-100 text-slate-500"
              }`}>
                Em Andamento
              </span>
              <span className="text-xs">🟡</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-xl font-black font-mono ${
                selectedStatuses.includes("Em andamento") ? "text-amber-700" : "text-slate-400"
              }`}>{emAndamento}</span>
              <span className="text-[10px] font-bold text-slate-500">trechos</span>
            </div>
          </button>

          {/* Card 4: Pendentes */}
          <button
            onClick={() => handleCardClick("Pendente")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.includes("Pendente")
                ? "border-yellow-300 bg-yellow-50 text-yellow-950 ring-2 ring-yellow-500/20"
                : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 opacity-60 hover:opacity-100 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.includes("Pendente") ? "bg-yellow-100 text-yellow-900" : "bg-slate-100 text-slate-500"
              }`}>
                Pendentes
              </span>
              <span className="text-xs">🟠</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-xl font-black font-mono ${
                selectedStatuses.includes("Pendente") ? "text-yellow-700" : "text-slate-400"
              }`}>{pendentes}</span>
              <span className="text-[10px] font-bold text-slate-500">trechos</span>
            </div>
          </button>

          {/* Card 5: Sem Solução */}
          <button
            onClick={() => handleCardClick("Sem solução")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.includes("Sem solução")
                ? "border-rose-300 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20"
                : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 opacity-60 hover:opacity-100 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.includes("Sem solução") ? "bg-rose-100 text-rose-850" : "bg-slate-100 text-slate-500"
              }`}>
                Sem Solução
              </span>
              <span className="text-xs">🔴</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-xl font-black font-mono ${
                selectedStatuses.includes("Sem solução") ? "text-rose-700" : "text-slate-400"
              }`}>{semSolucao}</span>
              <span className="text-[10px] font-bold text-slate-500">trechos</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Filters in Light Mode */}
      <div className="bg-white text-slate-800 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Row 1: Search option */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por trecho, onde tem/precisa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl py-2 pl-10 pr-4 text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Row 2: Tabs Filters for Groups, Deadline states and Period */}
        <div className="flex flex-wrap gap-4 justify-between items-center pt-2 border-t border-slate-100">
          <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setSelectedGroup("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGroup === "todos" 
                  ? "bg-amber-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todas as Demandas
            </button>
            <button
              onClick={() => setSelectedGroup("abertos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGroup === "abertos" 
                  ? "bg-amber-500 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Demandas Abertas (Pendente e Em andamento)
            </button>
            <button
              onClick={() => setSelectedGroup("fechados")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGroup === "fechados" 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Concluídas (Solucionadas, Sem solução)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro de Prazos */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 font-mono">Filtro de Prazos:</span>
              <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setSelectedPrazo("all")}
                  className={`px-2.5 py-1.2 rounded-lg text-[11px] font-bold transition-all ${
                    selectedPrazo === "all" 
                      ? "bg-slate-200 text-slate-800" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setSelectedPrazo("atrasado")}
                  className={`px-2.5 py-1.2 rounded-lg text-[11px] font-bold transition-all ${
                    selectedPrazo === "atrasado" 
                      ? "bg-rose-500/10 text-rose-600 border border-rose-200" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Atrasadas
                </button>
                <button
                  onClick={() => setSelectedPrazo("no-prazo")}
                  className={`px-2.5 py-1.2 rounded-lg text-[11px] font-bold transition-all ${
                    selectedPrazo === "no-prazo" 
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  No Prazo
                </button>
                <button
                  onClick={() => setSelectedPrazo("sem-prazo")}
                  className={`px-2.5 py-1.2 rounded-lg text-[11px] font-bold transition-all ${
                    selectedPrazo === "sem-prazo" 
                      ? "bg-slate-100 text-slate-600 border border-slate-200" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sem Prazo
                </button>
              </div>
            </div>

            {/* Filtro de Período (Resolvidos / Concluídos no período) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 font-mono flex items-center gap-1">
                <CalendarRange className="w-3.5 h-3.5 text-purple-600" />
                Filtro de Período:
              </span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
              >
                <option value="all">Qualquer período (Padrão)</option>
                <option value="hoje">Hoje</option>
                <option value="7dias">Últimos 7 Dias</option>
                <option value="30dias">Últimos 30 Dias</option>
                <option value="este_mes">Mês Atual</option>
                <option value="custom">Período Personalizado...</option>
              </select>

              {selectedPeriod === "custom" && (
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-xl text-xs">
                  <input
                    type="date"
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-slate-400 font-bold">até</span>
                  <input
                    type="date"
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. White Theme Table Card */}
      <div className="bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="overflow-x-auto">
          {displayRecords.length === 0 ? (
            <div className="p-16 text-center font-sans">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-500">Nenhum planejamento otdr encontrado</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Modifique o filtro ou pesquise por termo.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-sans font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-4 px-6 w-[200px] text-left">Trecho Óptico *</th>
                  <th className="py-4 px-6 text-left">Onde Tem / Onde Precisa *</th>
                  <th className="py-4 px-6 w-[120px] text-left">Tamanho KM *</th>
                  <th className="py-4 px-6 text-left">Prazo / Conclusão</th>
                  <th className="py-4 px-6 w-[150px] text-left">Status</th>
                  <th className="py-4 px-6 text-right w-[200px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-xs">
                {displayRecords.map((item) => {
                  const isSelected = expandedId === item.id;
                  const hasExpired = isDeadlineExpired(item["data estimada"], item["STATUS"]);
                  const statusVal = normalizeStatus(item["STATUS"]);
                  const concDate = getCompletionDateStr(item);

                  return (
                    <React.Fragment key={item.id}>
                      <tr 
                        onClick={() => setExpandedId(isSelected ? null : item.id)}
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${isSelected ? "bg-slate-50/50 font-medium" : ""}`}
                      >
                        {/* Trecho */}
                        <td className="py-4.5 px-6 font-mono font-bold text-slate-705">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.isLocal && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase font-mono tracking-wider shrink-0">
                                LOCAL
                              </span>
                            )}
                            <span>{item["TRECHO"]}</span>
                          </div>
                          {item["Data de abertura"] && (
                            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono font-normal">
                              Abertura: {formatSheetDate(item["Data de abertura"])}
                            </span>
                          )}
                        </td>

                        {/* Onde Tem -> Onde Precisa */}
                        <td className="py-4.5 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <span className="bg-slate-100 px-2 py-0.8 rounded text-amber-700 border border-slate-200 max-w-[150px] truncate uppercase font-bold">
                              {item["ONDE TEM"] || "Não informado"}
                            </span>
                            <span className="text-slate-400 shrink-0">➔</span>
                            <span className="bg-slate-100 px-2 py-0.8 rounded text-sky-700 border border-slate-200 max-w-[150px] truncate uppercase font-bold">
                              {item["ONDE PRECISA"] || "Não informado"}
                            </span>
                          </div>
                        </td>

                        {/* Tamanho KM */}
                        <td className="py-4.5 px-6 font-mono whitespace-nowrap">
                          <span className="bg-teal-50 px-2.5 py-1 rounded text-teal-700 border border-teal-200 font-bold inline-block whitespace-nowrap">
                            {formatTamanho(item["TAMANHO KM"])}
                          </span>
                        </td>

                        {/* Prazo e Data de Conclusão */}
                        <td className="py-4.5 px-6 font-mono whitespace-nowrap text-left">
                          <div className="flex flex-col gap-1 text-left">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-slate-400 font-mono uppercase">Prazo:</span>
                              {item["data estimada"] && String(item["data estimada"]).trim() !== "" && String(item["data estimada"]).trim() !== "-" ? (
                                hasExpired ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-200 font-bold text-[10px]">
                                    <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                                    {formatSheetDate(item["data estimada"])}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-600 text-[10px] font-bold">
                                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                    {formatSheetDate(item["data estimada"])}
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 text-[10px] font-mono">Sem prazo</span>
                              )}
                            </div>

                            {concDate && (
                              <div className="flex items-center gap-1 mt-0.5 pt-0.5 border-t border-slate-100">
                                <span className="text-[9px] font-bold text-purple-600 font-mono uppercase flex items-center gap-0.5">
                                  <CheckCircle className="w-3 h-3 text-purple-600 shrink-0" />
                                  Conclusão:
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/80 font-bold text-[10px]">
                                  {formatSheetDate(concDate)}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4.5 px-6 font-sans whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border leading-none uppercase ${
                            statusVal === "Solucionado" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : statusVal === "Sem solução"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : statusVal === "Em andamento"
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : "bg-amber-50 text-amber-705 border-amber-200"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {item["STATUS"] || "Sem Status"}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-4.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isSelected && (
                              <>
                                {statusVal !== "Solucionado" && statusVal !== "Sem solução" && currentUser?.permissions?.otdr?.editar && (
                                  <button
                                    onClick={() => onStartFinalize(item)}
                                    className="font-bold px-2.5 py-1.5 rounded-lg border border-emerald-250 text-emerald-700 hover:bg-emerald-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white border-solid"
                                    title="Finalizar e Concluir este Atendimento"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Finalizar</span>
                                  </button>
                                )}
                                {currentUser?.permissions?.otdr?.editar && (
                                  <button
                                    onClick={() => onEdit(item)}
                                    className="font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white border-solid"
                                    title="Editar"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Editar</span>
                                  </button>
                                )}
                                {currentUser?.permissions?.otdr?.excluir && (
                                  <button
                                    onClick={() => onDelete(item)}
                                    className="font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white border-solid"
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
                              className={`font-semibold px-3 py-1.5 rounded-lg border transition text-[11px] cursor-pointer bg-white ${
                                isSelected
                                  ? "text-slate-500 border-slate-300 hover:bg-slate-50"
                                  : "text-amber-600 border-amber-200 hover:bg-amber-50"
                              }`}
                            >
                              {isSelected ? "Fechar" : "Detalhes"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Detail row */}
                      {isSelected && (
                        <tr className="bg-slate-50/50 border-none">
                          <td colSpan={6} className="px-6 py-6 border-t border-b border-slate-100">
                            <div className="space-y-6 text-slate-800 text-left">
                              {/* Top Section: Technical details in two columns */}
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left top: Description */}
                                <div className="lg:col-span-7 space-y-2 flex flex-col">
                                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
                                    <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                                      Planejamento / Descrição Técnica
                                    </h4>
                                    <button 
                                      onClick={() => onEditDescription(item)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 transition cursor-pointer"
                                      title="Editar Planejamento"
                                    >
                                      <Edit className="w-3 h-3" />
                                      <span>Editar</span>
                                    </button>
                                  </div>
                                  <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-center min-h-[100px]">
                                    {item["Planejamento"] && String(item["Planejamento"]).trim() !== "" && String(item["Planejamento"]).trim() !== "-" ? (
                                      <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-line font-medium">
                                        {item["Planejamento"]}
                                      </p>
                                    ) : (
                                      <p className="text-slate-400 text-xs italic">
                                        Nenhum planejamento registrado para este trecho. Clique no botão de editar acima para incluir a descrição.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Right top: Meta parameters */}
                                <div className="lg:col-span-5 space-y-2 flex flex-col justify-between">
                                  <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                                    Parâmetros do Planejamento
                                  </h4>
                                  <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm grid grid-cols-2 gap-4 flex-1">
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Status do Serviço</span>
                                      <span className={`text-xs font-bold mt-1 inline-flex items-center gap-1.5 uppercase ${
                                        statusVal === "Solucionado"
                                          ? "text-emerald-600"
                                          : statusVal === "Sem solução"
                                            ? "text-rose-600"
                                            : statusVal === "Em andamento"
                                              ? "text-sky-600"
                                              : "text-amber-500"
                                      }`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                        {item["STATUS"] || "Sem Status"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block flex items-center gap-1">
                                        Data Estimada
                                        {currentUser?.permissions?.otdr?.editar && (
                                          <button 
                                            onClick={() => onExtendDeadline(item)}
                                            className="p-0.5 rounded text-sky-600 hover:bg-sky-50 transition cursor-pointer"
                                            title="Prorrogar Prazo"
                                          >
                                            <Calendar className="w-3" />
                                          </button>
                                        )}
                                      </span>
                                      <span className={`text-xs font-bold mt-0.5 block ${hasExpired ? "text-rose-600" : "text-amber-500"}`}>
                                        {(!item["data estimada"] || String(item["data estimada"]).trim() === "" || String(item["data estimada"]).trim() === "-") ? "SEM PRAZO" : formatSheetDate(item["data estimada"])}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">ID DO REGISTRO</span>
                                      <span className="text-xs font-semibold text-slate-700 mt-0.5 block font-mono">
                                        {item.id}
                                      </span>
                                    </div>
                                    {getCompletionDateStr(item) && (
                                      <div>
                                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Data Conclusão</span>
                                        <span className="text-xs font-bold text-purple-700 mt-0.5 block font-mono">
                                          {formatSheetDate(getCompletionDateStr(item))}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom Section: Atas & Alterações de Prazo Side-by-Side */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    Histórico de Cobranças / Observações / Atas
                                  </h5>
                                  {currentUser?.permissions?.otdr?.editar && (
                                    <button
                                      onClick={() => onOpenAta(item)}
                                      className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-sky-50 shadow-sm border border-sky-200 text-sky-600 hover:bg-sky-100 hover:border-sky-350 transition cursor-pointer select-none flex items-center gap-1"
                                      title="Inserir novas informações de Ata de alinhamento"
                                    >
                                      <Plus className="w-3" />
                                      <span>Nova Ata</span>
                                    </button>
                                  )}
                                </div>

                                <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm">
                                  {(() => {
                                    const obvFieldKey = "OBSERVAÇÃO " in item ? "OBSERVAÇÃO " : "OBSERVAÇÃO";
                                    const rawTimeline = item[obvFieldKey] || "";
                                    const logs = parseTimelineLogs(rawTimeline);
                                    if (logs.length === 0) {
                                      return rawTimeline ? (
                                        <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-line break-words">{rawTimeline}</p>
                                      ) : (
                                        <p className="text-slate-400 text-xs italic">Nenhuma ata ou histórico registrado. Use o botão + Nova Ata para inserir!</p>
                                      );
                                    }

                                    const ataLogs = logs.filter(log => !log.content.includes("[ALTERAÇÃO DE PRAZO]") && !log.content.includes("[ALTERACAO_DE_PRAZO]"));
                                    const prazoLogs = logs.filter(log => log.content.includes("[ALTERAÇÃO DE PRAZO]") || log.content.includes("[ALTERACAO_DE_PRAZO]"));

                                    return (
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Column 1: Atas & Alinhamentos */}
                                        <div className="space-y-4">
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 font-sans border-b border-sky-100 pb-2">
                                            <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                                            <span>Atas & Alinhamentos de Reuniões</span>
                                            <span className="text-[10px] font-normal text-slate-400 font-mono">({ataLogs.length})</span>
                                          </div>
                                          
                                          {ataLogs.length === 0 ? (
                                            <p className="text-slate-400 text-xs italic pl-1">Nenhuma ata cadastrada para este canal.</p>
                                          ) : (
                                            <div className="max-h-[250px] overflow-y-auto pr-1 space-y-4 relative border-l border-slate-200 pl-3.5 text-left ml-2 scrollbar-thin">
                                              {ataLogs.map((log, lidx) => {
                                                const isAta = log.content.includes("[ATA/ALINHAMENTO]");
                                                let cleanContent = log.content;
                                                if (isAta) {
                                                  cleanContent = cleanContent.replace("[ATA/ALINHAMENTO]", "").trim();
                                                }
                                                const lines = cleanContent.split("\n").map(l => l.trim()).filter(Boolean);

                                                return (
                                                  <div key={`ata-${lidx}`} className="relative text-left font-sans group">
                                                    {/* dot */}
                                                    <div className="absolute -left-[19.5px] top-1.5 w-2 h-2 rounded-full border border-white bg-sky-500 animate-pulse" />
                                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 flex-wrap">
                                                        <span className="px-1.5 py-0.2 rounded font-bold border bg-slate-100 border-slate-200 text-slate-600">{log.date}</span>
                                                        <span>• por {log.author || "Sistema"}</span>
                                                      </div>

                                                      {/* Edit & Delete Action Buttons */}
                                                      <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition">
                                                        {currentUser?.permissions?.otdr?.editar && (
                                                          <button
                                                            onClick={() => onEditTimelineEntry?.(item, obvFieldKey, log.index !== undefined ? log.index : lidx, log.date, log.content)}
                                                            className="p-1 rounded text-teal-600 hover:bg-teal-50 hover:text-teal-700 transition cursor-pointer border-none bg-transparent"
                                                            title="Editar ata"
                                                          >
                                                            <Edit className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                        {currentUser?.permissions?.otdr?.excluir && (
                                                          <button
                                                            onClick={() => onDeleteTimelineEntry?.(item, obvFieldKey, log.index !== undefined ? log.index : lidx)}
                                                            className="p-1 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer border-none bg-transparent"
                                                            title="Excluir ata"
                                                          >
                                                            <Trash2 className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>

                                                    <div className="mt-1.5 space-y-1 p-2.5 rounded-lg border font-mono text-xs bg-slate-50 border-slate-150 text-slate-700 break-words whitespace-pre-wrap overflow-hidden">
                                                      {lines.map((line, lineIdx) => {
                                                        const isTitleBullet = line.startsWith("• Objetivo:") || line.startsWith("• Descrição:") || line.startsWith("• Prazo de retorno:");
                                                        return (
                                                          <p key={lineIdx} className={isTitleBullet ? "text-sky-700 font-sans font-extrabold text-[11px]" : "whitespace-pre-line pl-2 text-slate-600"}>
                                                            {line}
                                                          </p>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>

                                        {/* Column 2: Alterações de Prazo */}
                                        <div className="space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-750 font-sans border-b border-amber-100 pb-2">
                                            <CalendarRange className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Cronograma & Alterações de Prazo</span>
                                            <span className="text-[10px] font-normal text-slate-400 font-mono">({prazoLogs.length})</span>
                                          </div>

                                          {prazoLogs.length === 0 ? (
                                            <p className="text-slate-400 text-xs italic pl-1">Nenhuma alteração de prazo registrada.</p>
                                          ) : (
                                            <div className="max-h-[250px] overflow-y-auto pr-1 space-y-4 relative border-l border-slate-200 pl-3.5 text-left ml-2 scrollbar-thin">
                                              {prazoLogs.map((log, lidx) => {
                                                let cleanContent = log.content.replace("[ALTERAÇÃO DE PRAZO]", "").replace("[ALTERACAO_DE_PRAZO]", "").trim();
                                                const lines = cleanContent.split("\n").map(l => l.trim()).filter(Boolean);

                                                return (
                                                  <div key={`prazo-${lidx}`} className="relative text-left font-sans group">
                                                    {/* dot */}
                                                    <div className="absolute -left-[19.5px] top-1.5 w-2 h-2 rounded-full border border-white bg-amber-500 ring-2 ring-amber-500/20" />
                                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 flex-wrap">
                                                        <span className="px-1.5 py-0.2 rounded font-bold border bg-amber-50 border-amber-200 text-amber-750">{log.date}</span>
                                                        <span>• por {log.author || "Sistema"}</span>
                                                      </div>

                                                      {/* Edit & Delete Action Buttons */}
                                                      <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition">
                                                        {currentUser?.permissions?.otdr?.editar && (
                                                          <button
                                                            onClick={() => onEditTimelineEntry?.(item, obvFieldKey, log.index !== undefined ? log.index : lidx, log.date, log.content)}
                                                            className="p-1 rounded text-amber-600 hover:bg-amber-50 transition cursor-pointer border-none bg-transparent"
                                                            title="Editar registro"
                                                          >
                                                            <Edit className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                        {currentUser?.permissions?.otdr?.excluir && (
                                                          <button
                                                            onClick={() => onDeleteTimelineEntry?.(item, obvFieldKey, log.index !== undefined ? log.index : lidx)}
                                                            className="p-1 rounded text-rose-600 hover:bg-rose-50 transition cursor-pointer border-none bg-transparent"
                                                            title="Excluir registro"
                                                          >
                                                            <Trash2 className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>

                                                    <div className="mt-1.5 space-y-1 p-2.5 rounded-lg border font-mono text-xs bg-amber-50/20 border-amber-200/60 text-amber-900 break-words whitespace-pre-wrap overflow-hidden">
                                                      {lines.map((line, lineIdx) => {
                                                        const isTitleBullet = line.startsWith("• Prazo anterior:") || line.startsWith("• Novo prazo:") || line.startsWith("• Justificativa:");
                                                        return (
                                                          <p key={lineIdx} className={isTitleBullet ? "text-amber-800 font-sans font-extrabold text-[11px]" : "pl-2 text-amber-950"}>
                                                            {line}
                                                          </p>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
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

      {/* Modal Cadastro Rápido */}
      <AnimatePresence>
        {showQuickImportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-2xl w-full overflow-hidden text-slate-800"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-teal-50/40">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-teal-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                    Cadastro Rápido de OTDR
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowQuickImportModal(false);
                    setQuickImportText("");
                    setImportStatus("idle");
                    setImportMsg("");
                  }}
                  className="text-slate-400 hover:text-slate-650 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleQuickImportSubmit} className="p-6 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed font-sans text-left">
                  Cole abaixo a linha de dados de OTDR copiada diretamente do Excel ou Google Sheets.
                  O sistema identificará de forma inteligente o Trecho (ex: <strong>FORTALEZA &lt;&gt; JAGUARETAMA</strong>), Onde Tem/Onde Precisa, Km (ex: <strong>50 km</strong>), Status e Observação.
                </p>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                    Dados Copiados da Planilha:
                  </label>
                  <textarea
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    placeholder={`Cole aqui... Ex:
FORTALEZA <> JAGUARETAMA 50 km Pendente "ja tem otdr as portas estão livres apenas fazer a ligação fisica"`}
                    className="w-full h-32 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-teal-500 rounded-xl p-3.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 resize-y"
                  />
                </div>

                {/* Status indicator */}
                {importStatus === "loading" && (
                  <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-xl flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Enviando dados para a planilha... Por favor, aguarde.</span>
                  </div>
                )}
                {importStatus === "success" && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Sincronizado com sucesso!</span>
                  </div>
                )}
                {importStatus === "error" && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2 text-left">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{importMsg}</span>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickImportModal(false);
                      setQuickImportText("");
                      setImportStatus("idle");
                      setImportMsg("");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={importStatus === "loading" || !quickImportText.trim()}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs transition cursor-pointer border-none flex items-center gap-1.5 shadow-md shadow-teal-500/10"
                  >
                    {importStatus === "loading" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Check className="w-4 h-4 text-white" />
                    )}
                    <span>Importar Registro</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
