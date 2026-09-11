import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Layers, 
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
  MessageSquare,
  CalendarRange,
  FileSpreadsheet,
  RefreshCw,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
  Play,
  ChevronDown,
  FileText,
  ArrowRight,
  Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RelatorioGerencialCamadaOptica } from "./RelatorioGerencialCamadaOptica";

interface CamadaOpticaTabProps {
  filteredCamadaOptica: any[];
  camadaOptica: any[];
  currentUser: any;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onStartFinalize: (item: any) => void;
  isDeadlineExpired: (prazo: string, status: string) => boolean;
  formatSheetDate: (dateStr: string) => string;
  normalizeStatus: (status: string) => string;
  parseTimelineLogs: (logsStr: string) => any[];
  isCamadaOpticaScriptOutdated: boolean;
  onExtendDeadline: (item: any) => void;
  onOpenAta: (item: any) => void;
  onEditTimelineEntry?: (item: any, field: string, entryIndex: number, date: string, content: string) => void;
  onDeleteTimelineEntry?: (item: any, field: string, entryIndex: number) => void;
  onQuickImportDirect?: (record: any) => Promise<boolean>;
  isSyncPaused?: boolean;
  onToggleSyncPause?: () => void;
  pendingSyncCount?: number;
}

export const CamadaOpticaTab: React.FC<CamadaOpticaTabProps> = ({
  filteredCamadaOptica,
  camadaOptica,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
  onStartFinalize,
  isDeadlineExpired,
  formatSheetDate,
  normalizeStatus,
  parseTimelineLogs,
  isCamadaOpticaScriptOutdated,
  onExtendDeadline,
  onOpenAta,
  onEditTimelineEntry,
  onDeleteTimelineEntry,
  onQuickImportDirect,
  isSyncPaused,
  onToggleSyncPause,
  pendingSyncCount
}) => {
  // Estados para Cadastro Rápido
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState("");

  const parseQuickCamadaOptica = (text: string) => {
    const parts = text.split('\t').map(p => p.trim());
    if (parts.length >= 6) {
      return {
        "ID": parts[0] || '',
        "DATA DO REGISTRO": parts[1] || new Date().toLocaleDateString('pt-BR'),
        "TRECHO DE TRABALHO": parts[2] || '',
        "STATUS DO PLANO": parts[3] || 'Em andamento',
        "DESCRIÇÃO DAS ATIVIDADES / OBSERVAÇÃO": parts[4] || '',
        "HISTÓRICO DE REUNIÃO / ATA": parts[5] || ''
      };
    }

    let idMatch = text.match(/\bCO\d{3}\b/i) || text.match(/\b\d{5,8}\b/);
    let id = idMatch ? idMatch[0].toUpperCase() : "CO" + Math.floor(100 + Math.random() * 900);

    const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    const dateVal = dateMatch ? dateMatch[0] : new Date().toLocaleDateString('pt-BR');

    let trecho = "";
    const trechoMatch = text.match(/([a-zA-Z\s]+(?:<>|>>)[a-zA-Z\s-]+)/i);
    if (trechoMatch) {
      trecho = trechoMatch[0].trim();
    }

    let status = "Em andamento";
    if (/andamento/i.test(text)) status = "Em andamento";
    else if (/concluido|concluído|fechado/i.test(text)) status = "Concluído";
    else if (/suspenso|parado/i.test(text)) status = "Suspenso";

    let obs = "";
    let ata = "";
    const quoteMatch = text.match(/"([^"]+)"/s);
    if (quoteMatch) {
      ata = quoteMatch[1];
      obs = text.split(quoteMatch[0])[0].split(status)[1]?.trim() || "";
    } else {
      if (trecho) {
        const remaining = text.split(trecho)[1]?.trim() || "";
        obs = remaining;
      } else {
        obs = text;
      }
    }

    return {
      "ID": id,
      "DATA DO REGISTRO": dateVal,
      "TRECHO DE TRABALHO": trecho || "ND",
      "STATUS DO PLANO": status,
      "DESCRIÇÃO DAS ATIVIDADES / OBSERVAÇÃO": obs,
      "HISTÓRICO DE REUNIÃO / ATA": ata
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
      const parsed = parseQuickCamadaOptica(quickImportText);
      if (!parsed["TRECHO DE TRABALHO"] || parsed["TRECHO DE TRABALHO"] === "ND") {
        setImportStatus("error");
        setImportMsg("Não foi possível identificar o trecho de trabalho no texto informado. Certifique-se de que ele contém o formato LOCAL_A <> LOCAL_B.");
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
  const [showCustomDatePopover, setShowCustomDatePopover] = useState(false);
  const periodPopoverRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [showRelatorioModal, setShowRelatorioModal] = useState<boolean>(false);
  const [selectedRelatorioAtasMode, setSelectedRelatorioAtasMode] = useState<"todas" | "ultima" | "sem_atas">("todas");
  const reportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reportDropdownRef.current && !reportDropdownRef.current.contains(event.target as Node)) {
        setShowReportDropdown(false);
      }
      if (periodPopoverRef.current && !periodPopoverRef.current.contains(event.target as Node)) {
        setShowCustomDatePopover(false);
      }
    };
    if (showReportDropdown || showCustomDatePopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showReportDropdown, showCustomDatePopover]);

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

  // KPIs baseados em todos os registros
  const total = camadaOptica.length;
  const solucionados = camadaOptica.filter(x => normalizeStatus(x.STATUS) === "Solucionado").length;
  const emAndamento = camadaOptica.filter(x => normalizeStatus(x.STATUS) === "Em andamento").length;
  const pendentes = camadaOptica.filter(x => normalizeStatus(x.STATUS) === "Pendente").length;
  const semSolucao = camadaOptica.filter(x => normalizeStatus(x.STATUS) === "Sem solução").length;
  const percentDone = total ? Math.round(((solucionados + semSolucao) / total) * 100) : 0;
  const pctSolucionados = total ? (solucionados / total) * 100 : 0;
  const pctEmAndamento = total ? (emAndamento / total) * 100 : 0;
  const pctPendentes = total ? (pendentes / total) * 100 : 0;
  const pctSemSolucao = total ? (semSolucao / total) * 100 : 0;
  const pctSolucionadosRound = Math.round(pctSolucionados);
  const pctEmAndamentoRound = Math.round(pctEmAndamento);
  const pctPendentesRound = Math.round(pctPendentes);
  const pctSemSolucaoRound = Math.round(pctSemSolucao);

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

    // 2. Caso esteja resolvido sem coluna de data preenchida,
    // buscar nos campos de texto por padrão [CONCLUSÃO]
    const textFields = [
      item["OBSERVAÇÃO"],
      item["OBSERVAÇÃO "],
      item["OBSERVACAO"],
      item["OBSERVAÇÕES"],
      item["HISTORICO"],
      item["HISTÓRICO"],
      item["HISTÓRICO DE REUNIÃO / ATA"],
      item["INFORMAÇÃO"],
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
    return camadaOptica.filter((item) => {
      // 1. Filtro de busca textual
      const query = searchTerm.toLowerCase();
      const matchSearch =
        (item["TRECHO"] || "").toLowerCase().includes(query) ||
        (item["INFORMAÇÃO"] || "").toLowerCase().includes(query) ||
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

      // 5. Filtro de Período (Demandas Resolvidas / Concluídas no período)
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
  }, [camadaOptica, searchTerm, selectedStatuses, selectedGroup, selectedPrazo, selectedPeriod, periodStartDate, periodEndDate]);

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

      {/* Script notice in Elegant banner */}
      {isCamadaOpticaScriptOutdated && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm text-slate-800 bg-white">
          <div className="flex gap-3">
            <div className="p-2.5 bg-amber-500/15 text-amber-600 rounded-xl shrink-0 mt-0.5 md:mt-0 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 animate-pulse text-amber-500" />
            </div>
            <div className="text-left font-sans">
              <h4 className="text-sm font-bold text-amber-600 font-mono uppercase tracking-wider">
                Aba 'Camada Óptica' não configurada no Google Sheets!
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                A API respondeu com sucesso, mas o script de integração do Google Sheets não está enviando os dados da guia <strong>"Camada Óptica"</strong>. O sistema carregou dados locais de fallback. Sincronize atualizando seu Apps Script na aba <strong>"Parâmetro / Config"</strong>!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 1. Header Card — Design System: Grafite #1E1E1E + Laranja #FF5022 */}
      <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-0.5 text-left">
          <h2 className="text-xl font-bold text-[#1E1E1E]">
            Controle de Camada Óptica
          </h2>
          <p className="text-xs text-[#6B7280] font-medium">
            Monitoramento de canais de fibra, as-built, sobressalentes e status de rotas • <span className="text-[#FF5022] font-bold">{displayRecords.length}</span> registros visíveis
          </p>
        </div>

        <div className="flex flex-col items-end gap-3 w-full sm:w-[380px] shrink-0">
          {/* Linha Superior: Filtro de Período (Global Header com Popover Flutuante) */}
          <div className="relative w-full" ref={periodPopoverRef}>
            <div className="flex items-center justify-between gap-2 bg-[#F9FAFB] p-1 rounded-lg border border-[#E5E7EB] shadow-2xs w-full">
              <span className="text-[11px] font-bold text-[#6B7280] font-mono flex items-center gap-1 pl-1.5 shrink-0">
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
                  className="w-full bg-white border border-[#E5E7EB] rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#374151] focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022]/20 cursor-pointer transition shadow-2xs min-w-0"
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
                    className="px-2 py-1 bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded-md text-[11px] font-bold text-[#FF5022] flex items-center gap-1 cursor-pointer transition shrink-0 whitespace-nowrap"
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
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-[#E5E7EB] p-4 z-50 text-left animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] mb-3">
                  <span className="text-xs font-bold text-[#1E1E1E] flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-[#FF5022]" />
                    Período Personalizado
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustomDatePopover(false)}
                    className="text-[#9CA3AF] hover:text-[#374151] p-1 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Data Inicial</label>
                    <input
                      type="date"
                      value={periodStartDate}
                      onChange={(e) => setPeriodStartDate(e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#FF5022]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Data Final</label>
                    <input
                      type="date"
                      value={periodEndDate}
                      onChange={(e) => setPeriodEndDate(e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#FF5022]"
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
                      className="text-xs text-[#6B7280] hover:text-[#1E1E1E] font-medium cursor-pointer"
                    >
                      Limpar filtro
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomDatePopover(false)}
                      className="px-3 py-1.5 bg-[#FF5022] hover:bg-[#e8451e] text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
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
            {/* Dropdown Relatório Gerencial */}
            <div className="relative flex-1" ref={reportDropdownRef}>
              <button
                onClick={() => setShowReportDropdown(v => !v)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-[#1E1E1E] font-bold text-xs transition cursor-pointer select-none shadow-xs whitespace-nowrap"
                title="Opções do Relatório Gerencial de Camada Óptica"
              >
                <FileText className="w-4 h-4 text-[#FF5022]" />
                <span>Relatório Gerencial</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showReportDropdown ? "rotate-180" : ""}`} />
              </button>
              {showReportDropdown && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-30 overflow-hidden">
                  <button onClick={() => { setShowReportDropdown(false); setSelectedRelatorioAtasMode("todas"); setShowRelatorioModal(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-[#1E1E1E] hover:bg-[#FFF5F3] transition text-left cursor-pointer">
                    <FileText className="w-3.5 h-3.5 text-[#FF5022] shrink-0" />
                    <div>
                      <div className="font-bold">Completo</div>
                      <div className="text-[#9CA3AF] text-[10px]">Todas as atas de histórico</div>
                    </div>
                  </button>
                  <button onClick={() => { setShowReportDropdown(false); setSelectedRelatorioAtasMode("ultima"); setShowRelatorioModal(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-[#1E1E1E] hover:bg-[#FFF5F3] transition text-left border-t border-[#F3F4F6] cursor-pointer">
                    <FileText className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                    <div>
                      <div className="font-bold">Resumido</div>
                      <div className="text-[#9CA3AF] text-[10px]">Apenas última ata</div>
                    </div>
                  </button>
                  <button onClick={() => { setShowReportDropdown(false); setShowRelatorioModal(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-[#1E1E1E] hover:bg-[#FFF5F3] transition text-left border-t border-[#F3F4F6] cursor-pointer">
                    <FileText className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                    <div>
                      <div className="font-bold">Personalizado</div>
                      <div className="text-[#9CA3AF] text-[10px]">Escolher escopo manualmente</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {currentUser?.permissions?.camada_optica?.editar && (
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

      {/* 2. Metas da Malha de Transporte Óptico com Stacked Bar e Legenda de Filtro Exclusivo */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between text-left">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px] uppercase font-mono font-bold tracking-widest">
              Metas da Malha de Transporte Óptico
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
            placeholder="Pesquisar por trechos, informações e dados..."
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


      {/* 4. Table Card - White theme */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6 text-gray-800">
        <div className="overflow-x-auto">
          {displayRecords.length === 0 ? (
            <div className="p-16 text-center font-sans bg-white">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-gray-500">Nenhum registro localizado</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">Refine o filtro ou a busca por texto.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-sans font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-4 px-6 w-1/3 text-left">Trecho Óptico</th>
                  <th className="py-4 px-6 text-left">Informações Adicionais</th>
                  <th className="py-4 px-6 text-left">Prazo / Conclusão</th>
                  <th className="py-4 px-6 w-[150px] text-left">Estado do Serviço</th>
                  <th className="py-4 px-6 text-right w-[200px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans text-xs text-gray-700">
                {displayRecords.map((item, idx) => {
                  const isSelected = expandedId === item.id;
                  const isPrazoEmpty = !item["PRAZO"] || String(item["PRAZO"]).trim() === "" || String(item["PRAZO"]).trim() === "-";
                  const hasExpired = !isPrazoEmpty && isDeadlineExpired(item["PRAZO"], item["STATUS"]);
                  const statusVal = normalizeStatus(item["STATUS"]);
                  const concDate = getCompletionDateStr(item);

                  return (
                    <React.Fragment key={item.id ? `${item.id}-${idx}` : `co-${idx}`}>
                      <tr 
                        onClick={() => setExpandedId(isSelected ? null : item.id)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer text-gray-700 ${isSelected ? "bg-gray-50/80 font-medium text-gray-900" : ""}`}
                      >
                        {/* Trecho */}
                        <td className="py-4.5 px-6 font-sans text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.isLocal && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-[#FF5022] border border-[#FF5022]/20 uppercase font-sans tracking-wider shrink-0">
                                LOCAL
                              </span>
                            )}
                            <span className="font-bold text-gray-900 text-xs">{item["TRECHO"]}</span>
                          </div>
                        </td>

                        {/* Informações */}
                        <td className="py-4.5 px-6 font-sans text-gray-600 max-w-xs md:max-w-md text-left">
                          <p className="line-clamp-2 leading-relaxed">
                            {item["INFORMAÇÃO"] || "-"}
                          </p>
                        </td>

                        {/* Prazo e Data de Conclusão */}
                        <td className="py-4.5 px-6 font-sans text-gray-700 whitespace-nowrap text-left">
                          <div className="flex flex-col gap-1 text-left">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-gray-400 font-sans uppercase">Prazo:</span>
                              {item["PRAZO"] && String(item["PRAZO"]).trim() !== "" && String(item["PRAZO"]).trim() !== "-" ? (
                                hasExpired ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-200 font-bold text-[10px]">
                                    <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                                    {formatSheetDate(item["PRAZO"])}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-200 font-bold text-[10px]">
                                    <Calendar className="w-3 h-3 text-emerald-500 shrink-0" />
                                    {formatSheetDate(item["PRAZO"])}
                                  </span>
                                )
                              ) : (
                                <span className="text-gray-400 text-[10px] font-sans">Sem prazo</span>
                              )}
                            </div>

                            {concDate && (
                              <div className="flex items-center gap-1 mt-0.5 pt-0.5 border-t border-gray-100">
                                <span className="text-[9px] font-bold text-purple-600 font-sans uppercase flex items-center gap-0.5">
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
                        <td className="py-4.5 px-6 font-sans whitespace-nowrap text-left">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              statusVal === "Solucionado" ? "bg-[#10B981]"
                              : statusVal === "Sem solução" ? "bg-[#6B7280]"
                              : statusVal === "Em andamento" ? "bg-[#FBBF24]"
                              : "bg-[#FF5022]"
                            }`} />
                            <span className="text-xs font-semibold text-gray-700">{item["STATUS"] || "Sem Status"}</span>
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-4.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isSelected && (
                              <>
                                {statusVal !== "Solucionado" && statusVal !== "Sem solução" && currentUser?.permissions?.camada_optica?.editar && (
                                  <button
                                    onClick={() => onStartFinalize(item)}
                                    className="font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-650 hover:bg-emerald-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                                    title="Finalizar e Concluir este Atendimento"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Finalizar</span>
                                  </button>
                                )}
                                {currentUser?.permissions?.camada_optica?.editar && (
                                  <button
                                    onClick={() => onEdit(item)}
                                    className="font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                                    title="Editar"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Editar</span>
                                  </button>
                                )}
                                {currentUser?.permissions?.camada_optica?.excluir && (
                                  <button
                                    onClick={() => onDelete(item)}
                                    className="font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-550" />
                                    <span>Excluir</span>
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => setExpandedId(isSelected ? null : item.id)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer bg-white ${
                                isSelected
                                  ? "text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                                  : "text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#FF5022]"
                              }`}
                              title={isSelected ? "Fechar detalhes" : "Ver detalhes"}
                            >
                              {isSelected ? <X className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Detail row (Stays dark/sleek) */}
                      {/* Expanded selected details view (Adaptação ao Light Box) */}
                      {isSelected && (
                        <tr className="bg-slate-50/50 border-none">
                          <td colSpan={5} className="px-6 py-6 border-t border-b border-slate-100">
                            <div className="space-y-6 text-slate-800 text-left">
                              {/* Top Section: Technical details in two columns */}
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left top: Description */}
                                <div className="lg:col-span-7 space-y-2 flex flex-col">
                                  <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                                    Resumo do Andamento / Informação
                                  </h4>
                                  <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-center min-h-[100px]">
                                    {item["INFORMAÇÃO"] && String(item["INFORMAÇÃO"]).trim() !== "" && String(item["INFORMAÇÃO"]).trim() !== "-" ? (
                                      <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-line font-medium">
                                        {item["INFORMAÇÃO"]}
                                      </p>
                                    ) : (
                                      <p className="text-slate-400 text-xs italic">ND</p>
                                    )}
                                  </div>
                                </div>

                                {/* Right top: Meta parameters */}
                                <div className="lg:col-span-5 space-y-2 flex flex-col justify-between">
                                  <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                                    Parâmetros do Canal
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
                                        Data Limite (Prazo)
                                        {currentUser?.permissions?.camada_optica?.editar && (
                                          <button 
                                            onClick={() => onExtendDeadline(item)}
                                            className="p-0.5 rounded text-sky-600 hover:bg-sky-50 transition"
                                            title="Prorrogar Prazo"
                                          >
                                            <Calendar className="w-3" />
                                          </button>
                                        )}
                                      </span>
                                      <span className={`text-xs font-bold mt-0.5 block ${hasExpired ? "text-rose-600" : "text-amber-500"}`}>
                                        {isPrazoEmpty ? "SEM PRAZO" : formatSheetDate(item["PRAZO"])}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Data de Solicitação</span>
                                      <span className="text-xs font-semibold text-slate-700 mt-0.5 block font-mono">
                                        {item["DATA"] ? formatSheetDate(item["DATA"]) : "-"}
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
                                  {currentUser?.permissions?.camada_optica?.editar && (
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
                                    const rawTimeline = item["HISTORICO"] || "";
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
                                                        {currentUser?.permissions?.camada_optica?.editar && (
                                                          <button
                                                            onClick={() => onEditTimelineEntry?.(item, "HISTORICO", log.index !== undefined ? log.index : lidx, log.date, log.content)}
                                                            className="p-1 rounded text-teal-600 hover:bg-teal-50 hover:text-teal-700 transition cursor-pointer border-none bg-transparent"
                                                            title="Editar ata"
                                                          >
                                                            <Edit className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                        {currentUser?.permissions?.camada_optica?.excluir && (
                                                          <button
                                                            onClick={() => onDeleteTimelineEntry?.(item, "HISTORICO", log.index !== undefined ? log.index : lidx)}
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
                                                        {currentUser?.permissions?.camada_optica?.editar && (
                                                          <button
                                                            onClick={() => onEditTimelineEntry?.(item, "HISTORICO", log.index !== undefined ? log.index : lidx, log.date, log.content)}
                                                            className="p-1 rounded text-amber-600 hover:bg-amber-50 transition cursor-pointer border-none bg-transparent"
                                                            title="Editar registro"
                                                          >
                                                            <Edit className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                        {currentUser?.permissions?.camada_optica?.excluir && (
                                                          <button
                                                            onClick={() => onDeleteTimelineEntry?.(item, "HISTORICO", log.index !== undefined ? log.index : lidx)}
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
                    Cadastro Rápido de Camada Óptica
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
                  Cole abaixo a linha de dados de camada óptica copiada diretamente do Excel ou Google Sheets.
                  O sistema identificará de forma inteligente o ID (ex: <strong>CO004</strong>), Data (ex: <strong>01/07/2026</strong>), Trecho (ex: <strong>RECIFE &lt;&gt; CABO - PROTEC</strong>), Status (ex: <strong>Em andamento</strong>), Atividades e Histórico.
                </p>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                    Dados Copiados da Planilha:
                  </label>
                  <textarea
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    placeholder={`Cole aqui... Ex:
CO004 01/07/2026 RECIFE <> CABO - PROTEC Em andamento Verificando remoção de caixas. "Recife <> Cabo Protec Ganho de 1,9 em cabo..."`}
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

      <RelatorioGerencialCamadaOptica
        isOpen={showRelatorioModal}
        onClose={() => setShowRelatorioModal(false)}
        camadaOptica={camadaOptica}
        selectedPeriod={selectedPeriod}
        periodStartDate={periodStartDate}
        periodEndDate={periodEndDate}
        formatRouteTitle={() => ""}
        normalizeStatus={normalizeStatus}
        parseTimelineLogs={parseTimelineLogs}
        formatSheetDate={formatSheetDate}
        isDeadlineExpired={isDeadlineExpired}
        initialFilterMode={"todos"}
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
