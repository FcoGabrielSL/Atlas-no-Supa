import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PageHeader } from "./ui/PageHeader";
import { 
  AlertOctagon, 
  RefreshCw, 
  FileText, 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  AlertCircle, 
  Download, 
  Clock, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  Database,
  Sparkles,
  Plus,
  FolderPlus,
  Trash2,
  Edit,
  ExternalLink,
  X,
  Tag,
  Info,
  Filter,
  AlertTriangle,
  MessageSquare,
  Zap,
  Thermometer,
  TrendingDown,
  Activity,
  CloudOff,
  HelpCircle,
  Minus,
  Layers,
  Wrench
} from "lucide-react";
import { checkIncidentDateError } from "../utils/incidentValidation";

interface ControleIncidentesProps {
  searchTerm: string;
  currentUser?: any;
  postToSheets?: (action: string, tabName: string, payload: any) => Promise<any>;
  onIncidentsLoaded?: (incidents: any[]) => void;
}

// Lógica de Período de Consulta Padrão por Turno de Plantão (Diurno / Noturno)
export const getDefaultShiftDateRange = (now: Date = new Date()): { startDate: string; endDate: string } => {
  const currentHours = now.getHours();

  const formatDateISO = (d: Date, hours: number, minutes: number = 0) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    return `${year}-${month}-${day}T${h}:${m}`;
  };

  // 1. Plantão Diurno: entre 06:00 e 17:59 -> Data Inicial: Hoje às 06:00 | Data Final: Hoje às 18:00
  if (currentHours >= 6 && currentHours < 18) {
    const start = new Date(now);
    const end = new Date(now);
    return {
      startDate: formatDateISO(start, 6, 0),
      endDate: formatDateISO(end, 18, 0)
    };
  }

  // 2. Plantão Noturno (Início): entre 18:00 e 23:59 -> Data Inicial: Hoje às 18:00 | Data Final: Amanhã às 06:00
  if (currentHours >= 18) {
    const start = new Date(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    return {
      startDate: formatDateISO(start, 18, 0),
      endDate: formatDateISO(end, 6, 0)
    };
  }

  // 3. Plantão Noturno (Fim): entre 00:00 e 05:59 -> Data Inicial: Ontem às 18:00 | Data Final: Hoje às 06:00
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  const end = new Date(now);
  return {
    startDate: formatDateISO(start, 18, 0),
    endDate: formatDateISO(end, 6, 0)
  };
};

export function ControleIncidentes({ searchTerm: globalSearchTerm, currentUser, postToSheets, onIncidentsLoaded }: ControleIncidentesProps) {
  // Período de Consulta inicializado com base no turno de plantão atual (Diurno / Noturno)
  const [startDate, setStartDate] = useState(() => getDefaultShiftDateRange().startDate);
  const [endDate, setEndDate] = useState(() => getDefaultShiftDateRange().endDate);

  // Dados e Estados de UI
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'todos' | 'pendentes' | 'rfos_pendentes' | 'inconsistencias'>('pendentes');
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Notificar componente pai e persistir em cache sempre que os incidentes forem atualizados
  useEffect(() => {
    if (incidents.length > 0) {
      if (onIncidentsLoaded) {
        onIncidentsLoaded(incidents);
      }
      try {
        localStorage.setItem("cbe_cached_incidentes", JSON.stringify(incidents));
      } catch (e) {}
    }
  }, [incidents, onIncidentsLoaded]);

  // Debounce do campo de busca rápida para eliminar input lag durante a digitação
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(localSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearchTerm]);

  // Estado para Plantonista do Relatório
  const [plantonista, setPlantonista] = useState(() => {
    return localStorage.getItem("cbe_plantonista") || "";
  });

  // Auto-preencher plantonista quando o usuário logado mudar ou estiver disponível
  useEffect(() => {
    if (currentUser) {
      const name = `${currentUser.nome || ""} ${currentUser.sobrenome || ""}`.trim() || currentUser.email || "";
      if (name) {
        setPlantonista(name);
        localStorage.setItem("cbe_plantonista", name);
      }
    }
  }, [currentUser]);

  // Estados de Relatórios / IA
  const [report, setReport] = useState<string | null>(null);
  const [whatsappTime, setWhatsappTime] = useState("12:00");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedPending, setCopiedPending] = useState(false);
  const [copiedPendingRfo, setCopiedPendingRfo] = useState(false);
  const [slaFilters, setSlaFilters] = useState<string[]>(["dentro", "baixo", "medio", "critico", "sem_sla"]);
  const [selectedRfoSubcategories, setSelectedRfoSubcategories] = useState<string[]>(["FIBRA DANIFICADA"]);
  const [showSubcatDropdown, setShowSubcatDropdown] = useState(false);
  
  // Estados de Informações Adicionais / Categorias Customizadas
  interface CustomCategory {
    id: string;
    title: string;
    emoji: string;
    content: string;
  }
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => {
    try {
      const saved = localStorage.getItem("cbe_custom_categories");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [customCategoryForm, setCustomCategoryForm] = useState({
    title: "",
    emoji: "📌",
    content: ""
  });

  const openReportInNewTab = (
    reportText: string,
    startFormatted: string,
    endFormatted: string,
    plantonistaName: string
  ) => {
    try {
      const newWin = window.open("", "_blank");
      if (!newWin) return false;

      const titleText = `Relatório DWDM (${startFormatted} a ${endFormatted})`;

      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titleText}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; min-height: 100vh; padding: 24px 16px; }
    .container { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .header-bar { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .header-bar h1 { font-size: 18px; font-weight: 800; color: #38bdf8; letter-spacing: -0.01em; }
    .header-bar p { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { padding: 10px 18px; font-size: 13px; font-weight: 700; border-radius: 10px; border: none; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
    .btn-copy { background: #059669; color: white; }
    .btn-copy:hover { background: #047857; }
    .btn-print { background: #0284c7; color: white; }
    .btn-print:hover { background: #0369a1; }
    .btn-close { background: #334155; color: #cbd5e1; }
    .btn-close:hover { background: #475569; color: white; }
    .wa-card { background: #efeae2; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .wa-header { background: #005c4b; color: white; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .avatar { width: 42px; height: 42px; border-radius: 50%; background: #004d3f; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; border: 1.5px solid rgba(255,255,255,0.25); color: white; }
    .wa-info h2 { font-size: 15px; font-weight: 700; }
    .wa-info p { font-size: 12px; color: #a7f3d0; margin-top: 2px; }
    .wa-badge { background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .wa-body { padding: 24px; background-image: radial-gradient(#dfdcd6 1px, transparent 0); background-size: 16px 16px; max-height: 80vh; overflow-y: auto; }
    .wa-bubble { background: #d9fdd3; color: #111b21; padding: 20px; border-radius: 16px; border-top-left-radius: 0; font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
    .toast { position: fixed; bottom: 30px; right: 30px; background: #10b981; color: white; padding: 14px 24px; border-radius: 12px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: none; z-index: 9999; }
    @media print {
      body { background: white; color: black; padding: 0; }
      .header-bar, .actions, .toast, .wa-badge { display: none !important; }
      .wa-card { border: none; box-shadow: none; }
      .wa-body { max-height: none; overflow: visible; padding: 0; background: none; }
      .wa-bubble { background: white; border: 1px solid #ccc; color: black; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div>
        <h1>📊 Relatório de Incidentes DWDM — Brisanet</h1>
        <p>Período: <strong>${startFormatted}</strong> até <strong>${endFormatted}</strong> | Plantonista: <strong>${plantonistaName || 'N/I'}</strong></p>
      </div>
      <div class="actions">
        <button class="btn btn-copy" onclick="copyToClipboard()">
          📋 Copiar Relatório
        </button>
        <button class="btn btn-print" onclick="window.print()">
          🖨️ Imprimir / PDF
        </button>
        <button class="btn btn-close" onclick="window.close()">
          ❌ Fechar Guia
        </button>
      </div>
    </div>

    <div class="wa-card">
      <div class="wa-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="avatar" style="padding: 6px; background: linear-gradient(135deg, #0284c7, #1e3a8a); display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 100 100" fill="none" style="width: 100%; height: 100%;">
              <line x1="5" y1="20" x2="35" y2="35" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
              <line x1="5" y1="35" x2="35" y2="42" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
              <line x1="5" y1="50" x2="35" y2="50" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
              <line x1="5" y1="65" x2="35" y2="58" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
              <line x1="5" y1="80" x2="35" y2="65" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
              <polygon points="35,15 60,30 60,70 35,85" fill="#0284c7" />
              <rect x="60" y="30" width="22" height="40" fill="#0369a1" rx="2" />
              <rect x="82" y="44" width="15" height="12" fill="#38bdf8" rx="3" />
            </svg>
          </div>
          <div class="wa-info">
            <h2>DWDM</h2>
            <p>● online — Formatação Pronta para WhatsApp</p>
          </div>
        </div>
        <div class="wa-badge">Nova Guia</div>
      </div>
      <div class="wa-body">
        <div class="wa-bubble" id="reportTextContent"></div>
      </div>
    </div>
  </div>

  <div class="toast" id="toastMsg">✅ Relatório copiado com sucesso!</div>

  <script>
    const content = ${JSON.stringify(reportText)};
    document.getElementById("reportTextContent").innerText = content;

    function copyToClipboard() {
      navigator.clipboard.writeText(content).then(() => {
        const toast = document.getElementById("toastMsg");
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 3000);
      });
    }
  </script>
</body>
</html>`;

      newWin.document.write(htmlContent);
      newWin.document.close();
      return true;
    } catch (e) {
      console.error("Erro ao abrir nova guia para o relatório:", e);
      return false;
    }
  };

  const handleSaveCustomCategory = () => {
    if (!customCategoryForm.title.trim()) {
      showNotification("error", "Informe o título da categoria ou informação adicional.");
      return;
    }
    let updated: CustomCategory[];
    if (editingCategory) {
      updated = customCategories.map(cat => cat.id === editingCategory.id ? { ...cat, title: customCategoryForm.title.trim(), emoji: customCategoryForm.emoji || "📌", content: customCategoryForm.content.trim() } : cat);
    } else {
      const newCat: CustomCategory = {
        id: String(Date.now()),
        title: customCategoryForm.title.trim(),
        emoji: customCategoryForm.emoji || "📌",
        content: customCategoryForm.content.trim()
      };
      updated = [...customCategories, newCat];
    }
    setCustomCategories(updated);
    localStorage.setItem("cbe_custom_categories", JSON.stringify(updated));
    setCustomCategoryForm({ title: "", emoji: "📌", content: "" });
    setEditingCategory(null);
    showNotification("success", "Informação adicional salva com sucesso!");

    if (report) {
      generateLocalReport(updated, false);
    }
  };

  const handleDeleteCustomCategory = (id: string) => {
    const updated = customCategories.filter(cat => cat.id !== id);
    setCustomCategories(updated);
    localStorage.setItem("cbe_custom_categories", JSON.stringify(updated));
    showNotification("info", "Informação adicional removida.");

    if (report) {
      generateLocalReport(updated, false);
    }
  };
  
  // Feedback e Toasts
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<string>("Data de Abertura");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Helper de formatação resiliente para padrão brasileiro DD/MM/AAAA
  const formatToBrazilianDate = (dateStr: string): string => {
    if (!dateStr) return "—";
    const s = String(dateStr).trim();
    if (!s || s === "—" || s === "N/A" || s === "null" || s === "undefined") return "—";

    // Já está no formato brasileiro? Se sim, apenas retorna ou garante uniformidade
    const matchesBR = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (matchesBR) {
      const day = matchesBR[1].padStart(2, '0');
      const month = matchesBR[2].padStart(2, '0');
      const year = matchesBR[3];
      const hours = matchesBR[4] ? matchesBR[4].padStart(2, '0') : "";
      const minutes = matchesBR[5] ? matchesBR[5].padStart(2, '0') : "";
      const seconds = matchesBR[6] ? matchesBR[6].padStart(2, '0') : "";
      
      let timePart = "";
      if (hours) {
        timePart = ` ${hours}:${minutes}`;
        if (seconds) {
          timePart += `:${seconds}`;
        }
      }
      return `${day}/${month}/${year}${timePart}`;
    }

    // Se estiver no formato ISO YYYY-MM-DD ou similar
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      
      // Verifica se a string original continha informação de hora (T ou espaço seguido de d:d)
      const hasTime = s.includes("T") || (s.includes(" ") && s.split(" ")[1]?.includes(":"));
      if (hasTime) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        // Verifica se a string original continha segundos
        const hasSeconds = s.match(/:[0-5]\d:[0-5]\d/);
        if (hasSeconds) {
          return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        }
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      }
      return `${day}/${month}/${year}`;
    }

    return s; // Fallback
  };

  // Helper para formatar a data ISO em DD/MM/YYYY HH:MM para exibição completa
  const formatFullDateTime = (isoStr: string): string => {
    if (!isoStr) return "";
    const parts = isoStr.split("T");
    const datePart = parts[0];
    const timePart = parts[1] || "";
    
    const dateComps = datePart.split("-");
    if (dateComps.length === 3) {
      const formattedDate = `${dateComps[2]}/${dateComps[1]}/${dateComps[0]}`;
      const timeComps = timePart.split(":");
      if (timeComps.length >= 2) {
        return `${formattedDate} ${timeComps[0]}:${timeComps[1]}`;
      }
      return formattedDate;
    }
    return isoStr;
  };

  // Função para simular o estilo de formatação do WhatsApp no texto do relatório
  const renderWhatsAppText = (text: any) => {
    if (!text || typeof text !== "string") return null;
    
    const lines = text.split("\n");
    
    return lines.map((line, idx) => {
      // Linha separadora do relatório
      if (line.includes("━━━━━━━━━━━━━━━━━━━")) {
        return <div key={idx} className="border-t border-black/10 my-3 w-full" />;
      }
      
      const isQuote = line.startsWith("> ");
      const displayLine = isQuote ? line.substring(2) : line;
      
      // Parser para monospace (triple backticks)
      const monospaceRegex = /```(.*?)```/g;
      const parsedParts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      
      while ((match = monospaceRegex.exec(displayLine)) !== null) {
        const textBefore = displayLine.substring(lastIndex, match.index);
        const matchedText = match[1];
        
        if (textBefore) {
          parsedParts.push(textBefore);
        }
        
        parsedParts.push(
          <code key={`mono-${match.index}`} className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px] text-rose-600 font-bold mx-0.5 select-all">
            {matchedText}
          </code>
        );
        
        lastIndex = monospaceRegex.lastIndex;
      }
      
      if (lastIndex < displayLine.length) {
        parsedParts.push(displayLine.substring(lastIndex));
      }
      
      // Parser para negrito (*) e itálico (_)
      const finalParts: React.ReactNode[] = [];
      parsedParts.forEach((part, pIdx) => {
        if (typeof part === "string") {
          const boldItalicRegex = /(\*|_)(.*?)\1/g;
          let subLastIndex = 0;
          let subMatch;
          const subParts: React.ReactNode[] = [];
          
          while ((subMatch = boldItalicRegex.exec(part)) !== null) {
            const before = part.substring(subLastIndex, subMatch.index);
            const marker = subMatch[1];
            const contentText = subMatch[2];
            
            if (before) {
              subParts.push(before);
            }
            
            if (marker === "*") {
              subParts.push(<strong key={`b-${subMatch.index}`} className="font-bold text-slate-900">{contentText}</strong>);
            } else {
              subParts.push(<em key={`i-${subMatch.index}`} className="italic text-slate-600">{contentText}</em>);
            }
            
            subLastIndex = boldItalicRegex.lastIndex;
          }
          
          if (subLastIndex < part.length) {
            subParts.push(part.substring(subLastIndex));
          }
          
          finalParts.push(...subParts.map((sp, spIdx) => <React.Fragment key={`${pIdx}-${spIdx}`}>{sp}</React.Fragment>));
        } else {
          finalParts.push(part);
        }
      });
      
      if (isQuote) {
        return (
          <div key={idx} className="pl-3 border-l-4 border-emerald-500 bg-emerald-500/5 py-1.5 px-2.5 rounded-r-xl my-1.5 text-slate-700 text-[12px] font-sans">
            {finalParts}
          </div>
        );
      }
      
      return (
        <div key={idx} className="min-h-[1.25rem] text-[13px] text-slate-800 leading-relaxed font-sans">
          {finalParts}
        </div>
      );
    });
  };

  // Helper flexível para buscar valores de propriedades independente de caixa ou acentuação
  const getVal = (obj: any, keyName: string): any => {
    if (!obj) return "";
    if (obj[keyName] !== undefined && obj[keyName] !== null) return obj[keyName];
    
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
    const targetKey = norm(keyName);
    
    // Mapeamento de sinônimos conhecidos para ser extremamente flexível
    const synonyms: { [key: string]: string[] } = {
      operador: ["operador", "criador", "responsavel", "usuario", "abertopor"],
      id: ["id", "chamado", "ticket", "incidente", "protocolo", "codigo"],
      titulo: ["titulo", "assunto", "descricao", "resumo", "summary", "incidenttitle"],
      datadeabertura: ["datadeabertura", "abertura", "data", "createdat", "datadecriacao", "createdAt"],
      rfo: ["rfo", "rfostatus", "rfo_status", "statusrfo", "situacaorfo", "rfo_situacao", "rfo_situacao_chamado", "situacaodorfo", "rfo_status_chamado", "status_rfo", "rfo_solicitado"],
      status: ["status", "situacao", "state"],
      chamadostatus: ["chamadostatus", "chamado_status", "status_chamado", "statuschamado", "situacaochamado", "situacao_chamado", "chamado_situacao", "chamadostate"],
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

    // Find if targetKey matches any synonym group or key in group
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

    // Se ainda assim não achou, faz uma busca por aproximação (evitando colisão de substring reversa indesejada)
    const foundKey = keys.find(k => norm(k) === targetKey || norm(k).includes(targetKey));
    if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) {
      return obj[foundKey];
    }
    return "";
  };

  // Regra de Fallback para o Operador:
  // No cabeçalho principal, se o dado do operador retornar nulo, vazio, "—" ou "N/A",
  // exibe automaticamente o valor correspondente ao atributo "Criador".
  const getOperadorOuCriador = (row: any): string => {
    if (!row) return "N/A";
    const isInvalid = (val: any) => {
      if (val === null || val === undefined) return true;
      const str = String(val).trim();
      if (!str) return true;
      const upper = str.toUpperCase();
      return upper === "N/A" || upper === "N/D" || upper === "ND" || upper === "—" || upper === "-" || upper === "NULL" || upper === "UNDEFINED";
    };

    const rawOperador = row["Operador"] || row["operador"] || row["Operador do Chamado"] || row["Usuario"] || row["usuário"] || row["Usuário"];
    if (!isInvalid(rawOperador)) {
      return String(rawOperador).trim();
    }

    const rawCriador = row["Criador"] || row["criador"] || row["Aberto Por"] || row["aberto_por"] || row["Responsável"] || row["responsavel"] || row["Responsavel do Chamado"];
    if (!isInvalid(rawCriador)) {
      return String(rawCriador).trim();
    }

    // Se ambos forem N/A, busca o Usuário do Último Comentário como fallback seguro
    const rawUsuarioUltimo = row["Usuário do Último Comentário"] || row["Usuario do Ultimo Comentario"] || row["usuario_ultimo_comentario"];
    if (!isInvalid(rawUsuarioUltimo)) {
      return String(rawUsuarioUltimo).trim();
    }

    return "N/A";
  };

  // Helper para normalização de strings (sem acentos e em minúsculas)
  const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Classificação intrínseca da natureza do chamado (independente de estar concluído/resolvido)
  // Usada para os subfiltros de categoria na guia "Todos" (pendentes ou não)
  const getNatureType = (item: any): "rompimento" | "dwdm_om" | "atenuacao_critica" | "atenuado" | "temperatura" | "indisponibilidade" | "outros" => {
    const rawCat = String(getVal(item, "Categoria") || "").trim();
    const catNorm = normStr(rawCat);
    const rawTitle = String(getVal(item, "Título") || getVal(item, "Titulo") || "").trim();
    const titNorm = normStr(rawTitle);

    const ac = normStr(getVal(item, "Atenuação Crítica") || getVal(item, "Atenuacao Critica") || "");
    const isAtenuacaocritica = ac === "sim";

    const stat = normStr(getVal(item, "Status") || "");
    const isAtenuado = stat === "atenuado";

    // 1. Atenuação Crítica (mantém lógica original)
    if (isAtenuacaocritica) {
      return "atenuacao_critica";
    }

    // 2. Status Atenuado (mantém lógica original)
    if (isAtenuado) {
      return "atenuado";
    }

    // 3. Guia "DWDM O&M" (Nova Guia):
    // Inclui todos os chamados que contenham "DWDM O&M -" (ex: DWDM O&M - Acompanhamento de Equipe)
    const isDwdmOm = rawCat.includes("DWDM O&M -") || catNorm.includes("dwdm o&m -") || rawCat.includes("DWDM O&M") || catNorm.includes("dwdm o&m");
    if (isDwdmOm) {
      return "dwdm_om";
    }

    // 4. Guia "Rompimentos":
    // Inclui estritamente os chamados marcados como "DWDM - ROMPIMENTO" (ou comece com ele)
    // Regra de Exclusão: Nenhum chamado do tipo "DWDM O&M -" deve aparecer nesta guia
    const isRompimentoEstrito = 
      !isDwdmOm && 
      (rawCat.includes("DWDM - ROMPIMENTO") || catNorm.includes("dwdm - rompimento") || catNorm === "dwdm - rompimento" || catNorm.startsWith("dwdm - rompimento"));
    if (isRompimentoEstrito) {
      return "rompimento";
    }

    // 5. Guia "Temperatura / Infra":
    // Captura todos os chamados cujo tipo/categoria comece com ou contenha "Operações de Infraestrutura -"
    // (ex: Operações de Infraestrutura - Outros, Operações de Infraestrutura - Alerta de Temperatura)
    const isTemperaturaInfra = 
      rawCat.includes("Operações de Infraestrutura -") || 
      catNorm.includes("operacoes de infraestrutura -") ||
      catNorm === "operacoes de infraestrutura - alerta de temperatura" ||
      catNorm === "imoc - acompanhamento de acesso ao dc";
    if (isTemperaturaInfra) {
      return "temperatura";
    }

    // 6. Indisponibilidade (mantém lógica original)
    const isIndisponibilidade = catNorm.includes("indisponibilidade") || titNorm.includes("indisponibilidade");
    if (isIndisponibilidade) {
      return "indisponibilidade";
    }

    return "outros";
  };

  // Função centralizada para classificação dos incidentes pendentes/resolvidos seguindo as regras de negócio
  const getClassification = (item: any) => {
    const rawCat = String(getVal(item, "Categoria") || "").trim();
    const catNorm = normStr(rawCat);
    const rawTitle = String(getVal(item, "Título") || getVal(item, "Titulo") || "").trim();
    const titNorm = normStr(rawTitle);

    const ac = normStr(getVal(item, "Atenuação Crítica") || getVal(item, "Atenuacao Critica") || "");
    const isAtenuacaocritica = ac === "sim";

    const stat = normStr(getVal(item, "Status") || "");
    const isAtenuado = stat === "atenuado";

    // 1. Atenuação Crítica (mantém original)
    if (isAtenuacaocritica) {
      if (checkIfConcluido(item)) {
        return { type: "resolvido", emoji: "🟢" };
      }
      return { type: "atenuacao_critica", emoji: "🟠" };
    }

    // 2. Status Atenuado (mantém original)
    if (isAtenuado) {
      return { type: "atenuado", emoji: "🟡" };
    }

    // 3. Guia "DWDM O&M" (Nova Guia):
    // Inclui chamados que contenham "DWDM O&M -"
    const isDwdmOm = rawCat.includes("DWDM O&M -") || catNorm.includes("dwdm o&m -") || rawCat.includes("DWDM O&M") || catNorm.includes("dwdm o&m");
    if (isDwdmOm) {
      if (checkIfConcluido(item)) {
        return { type: "resolvido", emoji: "🟢" };
      }
      return { type: "dwdm_om", emoji: "🔧" };
    }

    const dataFimStr = getVal(item, "Data Fim") || "";
    const parsedFimDate = parseIncidentDate(dataFimStr);

    const isDateInPeriod = (d: Date | null) => {
      if (!d) return false;
      if (startDate) {
        const startLimit = new Date(startDate);
        if (!isNaN(startLimit.getTime()) && d < startLimit) return false;
      }
      if (endDate) {
        const endLimit = new Date(endDate);
        if (!isNaN(endLimit.getTime()) && d > endLimit) return false;
      }
      return true;
    };

    const hasDataFimInPeriod = parsedFimDate !== null && (!startDate && !endDate ? true : isDateInPeriod(parsedFimDate));

    // 4. Guia "Rompimentos":
    // Estritamente "DWDM - ROMPIMENTO", sem nenhum "DWDM O&M"
    const isRompimentoEstrito = 
      !isDwdmOm && 
      (rawCat.includes("DWDM - ROMPIMENTO") || catNorm.includes("dwdm - rompimento") || catNorm === "dwdm - rompimento" || catNorm.startsWith("dwdm - rompimento"));
    if (isRompimentoEstrito) {
      if (checkIfConcluido(item) || (hasDataFimInPeriod && !isAtenuado)) {
        return { type: "resolvido", emoji: "🟢" };
      }
      return { type: "rompimento", emoji: "🔴" };
    }

    // 5. Guia "Temperatura / Infra":
    // Captura todos os chamados cujo tipo/categoria comece com ou contenha "Operações de Infraestrutura -"
    const isTemperaturaInfra = 
      rawCat.includes("Operações de Infraestrutura -") || 
      catNorm.includes("operacoes de infraestrutura -") ||
      catNorm === "operacoes de infraestrutura - alerta de temperatura" || 
      catNorm === "imoc - acompanhamento de acesso ao dc";
    if (isTemperaturaInfra) {
      if (checkIfConcluido(item)) {
        return { type: "resolvido", emoji: "🟢" };
      }
      return { type: "temperatura", emoji: "🌡️" };
    }

    // 6. Indisponibilidade (mantém original)
    const isIndisponibilidade = catNorm.includes("indisponibilidade") || titNorm.includes("indisponibilidade");
    if (isIndisponibilidade) {
      if (checkIfConcluido(item)) {
        return { type: "resolvido", emoji: "🟢" };
      }
      return { type: "indisponibilidade", emoji: "🔵" };
    }

    return { type: "outros", emoji: "⚪" };
  };

  // Helper to calculate downtime in hours for SLA filters and display
  const getDowntimeInHours = (item: any): { hours: number; label: string; rawMs: number } | null => {
    const dataInicio = getVal(item, "Data Início") || getVal(item, "Data Inicio") || getVal(item, "Data de Abertura") || getVal(item, "Data Abertura") || "";
    const dataFim = getVal(item, "Data Fim") || "";
    
    if (!dataInicio || dataInicio === "—" || String(dataInicio).trim() === "") {
      return null;
    }
    const start = parseIncidentDate(dataInicio);
    if (!start) return null;

    // Se estiver em aberto, usamos o horário atual do sistema
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
      rawMs: diffMs
    };
  };

  // Helper para formatar e sanitizar datas enviadas no payload da API da Brisanet
  const formatSafeDatePayload = (val: string | Date | null | undefined, defaultTime = "00:00:00") => {
    if (!val) {
      return { iso: "", standard: "", dateOnly: "", timeOnly: defaultTime };
    }
    
    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else {
      const s = String(val).trim();
      // Formato YYYY-MM-DDTHH:mm ou YYYY-MM-DD HH:mm:ss
      if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
        const parts = s.replace("T", " ").split(" ");
        const datePart = parts[0];
        const timePart = (parts[1] || "00:00").substring(0, 8);
        const paddedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
        return {
          iso: `${datePart}T${paddedTime}`,
          standard: `${datePart} ${paddedTime}`,
          dateOnly: datePart,
          timeOnly: paddedTime
        };
      }
      // Formato brasileiro DD/MM/YYYY HH:mm ou DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const [datePart, timePart = "00:00"] = s.split(" ");
        const [day, month, year] = datePart.split("/");
        const paddedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
        return {
          iso: `${year}-${month}-${day}T${paddedTime}`,
          standard: `${year}-${month}-${day} ${paddedTime}`,
          dateOnly: `${year}-${month}-${day}`,
          timeOnly: paddedTime
        };
      }
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }

    if (d && !isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return {
        iso: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`,
        standard: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
        dateOnly: `${year}-${month}-${day}`,
        timeOnly: `${hours}:${minutes}:${seconds}`
      };
    }

    const fallbackStr = String(val).trim();
    return {
      iso: fallbackStr,
      standard: fallbackStr,
      dateOnly: fallbackStr.substring(0, 10),
      timeOnly: defaultTime
    };
  };

  // Carrega incidentes iniciais já salvos localmente
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        setIsLoading(true);
        // 1. Busca instantânea do banco de dados local
        const resLocal = await fetch("/api/sheets");
        const dataLocal = await resLocal.json();
        if (isMounted && dataLocal && dataLocal["CONTROLE DE INCIDENTES"]) {
          setIncidents(dataLocal["CONTROLE DE INCIDENTES"]);
        }
      } catch (err) {
        console.error("Erro ao inicializar incidentes locais:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }

      // 2. Sincronização secundária em background com o Google Sheets sem travar o carregamento da UI
      try {
        const resSync = await fetch("/api/sheets/sync", { method: "POST" });
        const syncResult = await resSync.json();
        if (isMounted && syncResult && (syncResult.success || syncResult.warning)) {
          const resFresh = await fetch("/api/sheets");
          const dataFresh = await resFresh.json();
          if (isMounted && dataFresh && dataFresh["CONTROLE DE INCIDENTES"]) {
            setIncidents(dataFresh["CONTROLE DE INCIDENTES"]);
          }
        }
      } catch (backgroundSyncErr) {
        console.warn("Sincronização em background finalizada:", backgroundSyncErr);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadLocalIncidents = async () => {
    try {
      const resLocal = await fetch("/api/sheets");
      const dataLocal = await resLocal.json();
      if (dataLocal && dataLocal["CONTROLE DE INCIDENTES"]) {
        setIncidents(dataLocal["CONTROLE DE INCIDENTES"]);
      }
    } catch (err) {
      console.error("Erro ao carregar banco de dados local:", err);
    }
  };

  // Helper para analisar datas em múltiplos formatos (ISO ou brasileiro DD/MM/YYYY HH:MM:SS)
  const parseIncidentDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (!s || s === "—" || s === "N/A") return null;

    // Tenta formato brasileiro DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY HH:MM
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

    // Tenta formato ISO ou YYYY-MM-DD
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d;
    }
    return null;
  };

  const handleFetchFromApiInternal = async (): Promise<any[] | null> => {
    const envToken = import.meta.env.VITE_BRISANET_API_TOKEN || "";

    // 1. Debugging do Payload de Data: Formatação padronizada e segura
    const startFormatted = formatSafeDatePayload(startDate, "06:00:00");
    const endFormatted = formatSafeDatePayload(endDate, "18:00:00");

    // 2. Implementação de AbortController com timeout de 15 segundos para prevenção de travamento
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      const response = await fetch("/api/incidentes/fetch", {
        method: "POST",
        signal: controller.signal,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${envToken}`
        },
        body: JSON.stringify({
          start_date: startFormatted.standard,     // "YYYY-MM-DD HH:mm:ss"
          end_date: endFormatted.standard,         // "YYYY-MM-DD HH:mm:ss"
          start_date_iso: startFormatted.iso,      // ISO 8601
          end_date_iso: endFormatted.iso,
          start_date_only: startFormatted.dateOnly, // "YYYY-MM-DD"
          end_date_only: endFormatted.dateOnly,
          start_time: startFormatted.timeOnly.substring(0, 5), // "HH:mm"
          end_time: endFormatted.timeOnly.substring(0, 5),     // "HH:mm"
          token: envToken
        })
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMsg = data.messages 
          ? typeof data.messages === 'object' ? JSON.stringify(data.messages) : data.messages
          : (data.error || "Ocorreu um erro ao consultar a API Brisanet.");
        throw new Error(errorMsg);
      }

      setIncidents(data.incidents || []);
      if (onIncidentsLoaded) {
        onIncidentsLoaded(data.incidents || []);
      }
      return data.incidents || [];
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        showNotification("error", "A API demorou muito para responder. Tente um período de datas menor.");
        throw new Error("A API demorou muito para responder. Tente um período de datas menor.");
      }
      throw err;
    }
  };

  const handleFetchFromApi = async () => {
    setIsLoading(true);
    showNotification("info", "Iniciando requisição e processamento de incidentes...");

    try {
      const freshIncidents = await handleFetchFromApiInternal();
      if (freshIncidents) {
        showNotification(
          "success", 
          `Sincronização concluída com sucesso! ${freshIncidents.length} incidentes carregados.`
        );
      }
    } catch (error: any) {
      console.error(error);
      if (error.name !== "AbortError" && !error.message?.includes("A API demorou muito")) {
        showNotification("error", error.message || "Erro de rede ao conectar com a API de incidentes.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateLocalReport = async (overrideCustomCats?: CustomCategory[], autoOpenNewTab = true) => {
    setIsLoading(true);
    showNotification("info", "Sincronizando incidentes com a API antes de gerar o relatório...");
    
    let activeIncidents = incidents;
    try {
      const freshIncidents = await handleFetchFromApiInternal();
      if (freshIncidents) {
        activeIncidents = freshIncidents;
        showNotification("success", "Sincronização concluída com sucesso! Gerando relatório...");
      }
    } catch (error: any) {
      console.warn("Falha ao sincronizar antes do relatório. Gerando com dados locais atuais.", error);
      showNotification("info", "Não foi possível sincronizar com a API. Usando dados locais para gerar o relatório.");
    } finally {
      setIsLoading(false);
    }

    // Filtra todos os incidentes cadastrados na base apenas pelo período de data selecionado
    const incidentsInPeriod = activeIncidents.filter(item => {
      // Filtrar linhas corrompidas do parser antigo
      const criador = String(getVal(item, "Criador") || "").trim();
      const titulo = String(getVal(item, "Título") || "").trim();
      const id = String(getVal(item, "ID") || "").trim();
      const isGeneratedId = id.startsWith("gen-inc-");
      const hasNoValidCreatorOrTitle = !criador || !titulo || titulo === "Sem Título" || criador === "N/A";
      const creatorIsJustComment = criador.split(" ").length > 3 || 
                                   (criador.includes(" ") && (criador.toLowerCase().includes("chamado") || 
                                                              criador.toLowerCase().includes("trecho") || 
                                                              criador.toLowerCase().includes("procedimento") || 
                                                              criador.toLowerCase().includes("placa") || 
                                                              criador.toLowerCase().includes("modulo") || 
                                                              criador.toLowerCase().includes("procedimentos") || 
                                                              criador.toLowerCase().includes("reparo")));
      
      if (isGeneratedId && (hasNoValidCreatorOrTitle || creatorIsJustComment)) {
        return false;
      }

      // Filtro por Período de Data de Último Comentário, Data Fim ou Data de Abertura para o Relatório
      if (startDate || endDate) {
        const lastCommentDateStr = getVal(item, "Data do Último Comentário") || getVal(item, "Data do Ultimo Comentario") || "";
        const dataFimStr = getVal(item, "Data Fim") || "";
        const aberturaDateStr = getVal(item, "Data de Abertura") || getVal(item, "Abertura") || "";

        const incDate = parseIncidentDate(lastCommentDateStr);
        const fimDate = parseIncidentDate(dataFimStr);
        const abDate = parseIncidentDate(aberturaDateStr);

        const isDateInPeriod = (d: Date | null) => {
          if (!d) return false;
          if (startDate) {
            const startLimit = new Date(startDate);
            if (!isNaN(startLimit.getTime()) && d < startLimit) return false;
          }
          if (endDate) {
            const endLimit = new Date(endDate);
            if (!isNaN(endLimit.getTime()) && d > endLimit) return false;
          }
          return true;
        };

        if (!isDateInPeriod(incDate) && !isDateInPeriod(fimDate) && !isDateInPeriod(abDate)) {
          return false;
        }
      }
      return true;
    });

    if (incidentsInPeriod.length === 0) {
      showNotification("error", "Não há chamados na base para o período selecionado.");
      return;
    }

    // Ordenar por data de abertura decrescente
    const sortedIncidentsInPeriod = [...incidentsInPeriod].sort((a, b) => {
      const dateA = parseIncidentDate(getVal(a, "Data de Abertura") || getVal(a, "Abertura") || "") || new Date(0);
      const dateB = parseIncidentDate(getVal(b, "Data de Abertura") || getVal(b, "Abertura") || "") || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    // Função para calcular o tempo down de forma robusta e dinâmica
    const getTempoDown = (item: any, classificationType: string) => {
      const dataInicio = getVal(item, "Data Início") || getVal(item, "Data Inicio") || "";
      const dataFim = getVal(item, "Data Fim") || "";
      const status = String(getVal(item, "Status") || "").toLowerCase();

      if (!dataInicio || dataInicio === "—") {
        return "Não informado";
      }

      const start = parseIncidentDate(dataInicio);
      if (!start) return "—";

      const isEmAberto = !dataFim || dataFim === "—" || dataFim.toLowerCase().includes("aberto") || dataFim.toLowerCase().includes("andamento");

      if (isEmAberto) {
        if (status.includes("atenuado") || classificationType === "atenuacao_critica") {
          return "Aguardando período diurno";
        }
        return "Em andamento ⏱️";
      }

      const end = parseIncidentDate(dataFim);
      if (!end) return "—";

      const diffMs = end.getTime() - start.getTime();
      const isNegative = diffMs < 0;
      const absDiffMs = Math.abs(diffMs);

      const diffMins = Math.floor(absDiffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;

      let formattedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      return isNegative ? `-${formattedTime} ⏱️` : `${formattedTime} ⏱️`;
    };

    // Calcula as métricas solicitadas sobre a lista do período utilizando a função centralizada
    let totalResolvidos = 0;
    let totalRompimentos = 0;
    let totalDwdmOm = 0;
    let totalAtenuados = 0;
    let totalAtenuacoesCriticas = 0;
    let totalTemperatura = 0;
    let totalIndisponibilidade = 0;
    let totalOutros = 0;

    incidentsInPeriod.forEach(i => {
      const cls = getClassification(i);
      if (cls.type === "resolvido") totalResolvidos++;
      else if (cls.type === "dwdm_om") totalDwdmOm++;
      else if (cls.type === "temperatura") totalTemperatura++;
      else if (cls.type === "rompimento") totalRompimentos++;
      else if (cls.type === "indisponibilidade") totalIndisponibilidade++;
      else if (cls.type === "atenuacao_critica") totalAtenuacoesCriticas++;
      else if (cls.type === "atenuado") totalAtenuados++;
      else totalOutros++;
    });

    const startFormatted = formatFullDateTime(startDate) || "INÍCIO";
    const endFormatted = formatFullDateTime(endDate) || "FIM";

    let rText = `*RELATÓRIO DE INCIDENTES DWDM*\n`;
    rText += `Período: ${startFormatted} a ${endFormatted}\n`;
    rText += `*Plantonista:* ${plantonista || "Não informado"}\n\n`;
    rText += `*RESUMO DOS STATUS*\n`;
    if (totalResolvidos > 0) rText += `🟢 Resolvidos: ${totalResolvidos}\n`;
    if (totalRompimentos > 0) rText += `🔴 Rompimentos: ${totalRompimentos}\n`;
    if (totalDwdmOm > 0) rText += `🔧 DWDM O&M: ${totalDwdmOm}\n`;
    if (totalAtenuacoesCriticas > 0) rText += `🟠 Atenuações Críticas: ${totalAtenuacoesCriticas}\n`;
    if (totalAtenuados > 0) rText += `🟡 Trechos que voltaram atenuados: ${totalAtenuados}\n`;
    if (totalTemperatura > 0) rText += `🌡️ Alertas de temperatura / infraestrutura: ${totalTemperatura}\n`;
    if (totalIndisponibilidade > 0) rText += `🔵 Indisponibilidades: ${totalIndisponibilidade}\n`;
    if (totalOutros > 0) rText += `⚪ Externos/Solicitação de Equipe: ${totalOutros}\n`;

    const targetCustomCats = Array.isArray(overrideCustomCats)
      ? overrideCustomCats
      : (Array.isArray(customCategories) ? customCategories : []);

    const validCustomCats = targetCustomCats.filter(
      cat => cat && typeof cat === "object" && ((cat.title && cat.title.trim() !== "") || (cat.content && cat.content.trim() !== ""))
    );
    if (validCustomCats.length > 0) {
      rText += `📌 Inf. Adicional: ${validCustomCats.length}\n`;
    }

    const grouped: { [key: string]: any[] } = {
      resolvido: [],
      rompimento: [],
      dwdm_om: [],
      atenuacao_critica: [],
      atenuado: [],
      temperatura: [],
      indisponibilidade: [],
      outros: []
    };

    sortedIncidentsInPeriod.forEach(item => {
      const cls = getClassification(item);
      if (grouped[cls.type]) {
        grouped[cls.type].push(item);
      } else {
        grouped.outros.push(item);
      }
    });

    const categoriesConfig = [
      { key: "resolvido", title: "Resolvidos", emoji: "🟢" },
      { key: "rompimento", title: "Rompimentos", emoji: "🔴" },
      { key: "dwdm_om", title: "DWDM O&M", emoji: "🔧" },
      { key: "atenuacao_critica", title: "Atenuações Críticas", emoji: "🟠" },
      { key: "atenuado", title: "Trechos que voltaram atenuados", emoji: "🟡" },
      { key: "temperatura", title: "Alertas de temperatura / infraestrutura", emoji: "🌡️" },
      { key: "indisponibilidade", title: "Indisponibilidades", emoji: "🔵" },
      { key: "outros", title: "Externos / Solicitação de Equipe", emoji: "⚪" }
    ];

    categoriesConfig.forEach(cat => {
      const list = grouped[cat.key];
      if (list && list.length > 0) {
        rText += `\n━━━━━━━━━━━━━━━━━━━\n\n`;
        rText += `*${cat.title} (${list.length})*\n-----------------\n\n`;

        list.forEach(row => {
          const id = getVal(row, "ID") || row.id || "";
          const titulo = getVal(row, "Título") || getVal(row, "Titulo") || "Sem Título";
          const dataAbertura = getVal(row, "Data de Abertura") || getVal(row, "Abertura") || "—";
          const dataAberturaBR = formatToBrazilianDate(dataAbertura);

          const dataInicio = getVal(row, "Data Início") || getVal(row, "Data Inicio") || "—";
          const dataFim = getVal(row, "Data Fim") || "—";

          const dataInicioBR = dataInicio && dataInicio !== "—" ? formatToBrazilianDate(dataInicio) : "—";
          const dataFimBR = dataFim && dataFim !== "—" ? (dataFim.toLowerCase().includes("aberto") ? "Em aberto" : formatToBrazilianDate(dataFim)) : "Em aberto";

          const tempoDown = getTempoDown(row, cat.key);

          const ultimoComentario = getVal(row, "Último Comentário") || getVal(row, "Ultimo Comentario") || "Sem comentário";
          const autorUltimoComentario = getVal(row, "Usuário do Último Comentário") || getVal(row, "Usuario do Ultimo Comentario") || "—";
          const dataUltimoComentario = getVal(row, "Data do Último Comentário") || getVal(row, "Data do Ultimo Comentario") || "—";
          const dataUltimoComentarioBR = formatToBrazilianDate(dataUltimoComentario);

          let commentText = "";
          if (autorUltimoComentario !== "—" || (ultimoComentario !== "Sem comentário" && ultimoComentario !== "—")) {
            const commentLines = String(ultimoComentario).split("\n");
            const firstLine = commentLines[0].trim();
            commentText = `*${dataUltimoComentarioBR} - ${autorUltimoComentario}:* ${firstLine ? `*${firstLine}*` : ""}`;
            if (commentLines.length > 1) {
              commentText += "\n" + commentLines.slice(1).map(line => {
                const trimmed = line.trim();
                return trimmed ? `*${trimmed}*` : ``;
              }).filter(Boolean).join("\n");
            }
          } else {
            commentText = `*Nenhum comentário registrado.*`;
          }

          rText += `${cat.emoji} *${titulo}*\n`;
          rText += `*ID:* ${id}\n`;
          rText += `*Data Inicio:* ${dataInicioBR}\n`;
          rText += `*Data Fim:* ${dataFimBR}\n`;
          rText += `*Tempo down:* ${tempoDown} ⏱️\n`;

          // Para chamados de atenuação crítica ou que voltaram atenuados:
          const isAtenuacaoCritica = cat.key === "atenuacao_critica" || 
                                     String(getVal(row, "Atenuação Crítica") || getVal(row, "Atenuacao Critica") || "").toLowerCase().includes("sim") ||
                                     getClassification(row).type === "atenuacao_critica";
          const isAtenuado = cat.key === "atenuado" || 
                             String(getVal(row, "Status") || "").toLowerCase().includes("atenuado") ||
                             getClassification(row).type === "atenuado";

          if (isAtenuacaoCritica || isAtenuado) {
            const rawCompensado = getVal(row, "Trecho Compensado") || getVal(row, "trecho_compensado") || getVal(row, "Compensado") || "";
            const trechoCompensado = rawCompensado && String(rawCompensado).trim() !== "" ? String(rawCompensado).trim() : "Não";
            rText += `*Trecho Compensado:* ${trechoCompensado}\n`;
          }

          rText += `${commentText}\n\n`;
        });
      }
    });

    // Se houver informações adicionais / categorias customizadas
    if (validCustomCats.length > 0) {
      validCustomCats.forEach(cat => {
        const titleText = (cat.title || "INFORMAÇÃO ADICIONAL").trim().toUpperCase();
        rText += `\n━━━━━━━━━━━━━━━━━━━\n\n`;
        rText += `*${cat.emoji || "📌"} ${titleText}*\n-----------------\n\n`;
        if (cat.content && typeof cat.content === "string" && cat.content.trim() !== "") {
          const lines = cat.content.trim().split("\n");
          lines.forEach(line => {
            rText += `> ${line}\n`;
          });
        }
        rText += `\n`;
      });
    }

    rText = rText.trim();

    const now = new Date();
    setWhatsappTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

    setReport(rText);
    setIsAiGenerated(false);

    if (autoOpenNewTab) {
      // Tenta abrir o relatório em uma nova guia
      const openedInNewTab = openReportInNewTab(rText, startFormatted, endFormatted, plantonista);
      setShowReportModal(true);

      if (openedInNewTab) {
        showNotification("success", "Relatório gerado e aberto em uma nova guia!");
      } else {
        showNotification("success", "Relatório gerado com sucesso! Exibindo no modal e painel.");
      }
    } else {
      setShowReportModal(true);
    }
  };

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 7000);
  };

  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleCopyPendingForWhatsApp = () => {
    if (sortedIncidents.length === 0) {
      showNotification("error", "Nenhum incidente pendente localizado para copiar.");
      return;
    }

    const categoriesOrder = [
      { key: "rompimento", label: "🔴 *Rompimentos*" },
      { key: "dwdm_om", label: "🔧 *DWDM O&M*" },
      { key: "atenuacao_critica", label: "🟠 *Atenuações Críticas*" },
      { key: "atenuado", label: "🟡 *Atenuados*" },
      { key: "temperatura", label: "🌡️ *Temperatura / Infraestrutura*" },
      { key: "indisponibilidade", label: "🔵 *Indisponibilidade*" },
      { key: "outros", label: "⚪ *Externos / Solicitação de Equipe*" }
    ];

    let text = `*Por gentileza atualizar as informações dos incidentes: (${sortedIncidents.length})*\n\n`;
    let sections: string[] = [];

    categoriesOrder.forEach(cat => {
      const itemsInCat = sortedIncidents.filter(item => getClassification(item).type === cat.key);
      if (itemsInCat.length > 0) {
        let sectionText = `${cat.label} (${itemsInCat.length})\n`;
        itemsInCat.forEach(item => {
          const id = getVal(item, "ID") || item.id || "—";
          const abertura = getVal(item, "Data de Abertura") || getVal(item, "Abertura") || "";
          const aberturaBR = formatToBrazilianDate(abertura);
          const titulo = getVal(item, "Título") || getVal(item, "Titulo") || "Sem Título";

          sectionText += `*ID:* ${id} | *Data:* ${aberturaBR}\n> *Título:* ${titulo}\n\n`;
        });
        sections.push(sectionText.trim());
      }
    });

    text += sections.join("\n\n");
    text = text.trim();
    
    navigator.clipboard.writeText(text);
    setCopiedPending(true);
    setTimeout(() => setCopiedPending(false), 2000);
    showNotification("success", "Lista de cobrança de incidentes copiada para o WhatsApp!");
  };

  const handleCopyPendingRfoForWhatsApp = () => {
    if (sortedIncidents.length === 0) {
      showNotification("error", "Nenhum RFO pendente localizado para copiar.");
      return;
    }

    let text = `*Por gentileza verificar os rfos pendentes: (${sortedIncidents.length})*\n\n`;
    sortedIncidents.forEach(item => {
      const id = getVal(item, "ID") || item.id || "—";
      const abertura = getVal(item, "Data de Abertura") || getVal(item, "Abertura") || "";
      const aberturaBR = formatToBrazilianDate(abertura);
      const titulo = getVal(item, "Título") || getVal(item, "Titulo") || "Sem Título";

      text += `*ID:* ${id} | *Data:* ${aberturaBR}\n> *Título:* ${titulo}\n\n`;
    });

    text = text.trim();
    navigator.clipboard.writeText(text);
    setCopiedPendingRfo(true);
    setTimeout(() => setCopiedPendingRfo(false), 2000);
    showNotification("success", "Lista de RFOs pendentes copiada para o WhatsApp!");
  };

  // Helper de badge de severidade
  const getSeverityBadge = (sev: string) => {
    const s = String(sev || "").toUpperCase();
    if (s.includes("ALTA") || s.includes("CRITICA") || s.includes("CRÍTICA") || s.includes("HIGH")) {
      return (
        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-max">
          <ShieldAlert className="w-3 h-3" /> CRÍTICA
        </span>
      );
    }
    if (s.includes("MED") || s.includes("MÉD") || s.includes("MEDIUM") || s.includes("AVISO")) {
      return (
        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-max">
          <AlertCircle className="w-3 h-3" /> MÉDIA
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-150 flex items-center gap-1 w-max">
        <CheckCircle2 className="w-3 h-3" /> BAIXA
      </span>
    );
  };

  // Helper de badge de status
  const getStatusBadge = (status: string) => {
    const s = String(status || "").toUpperCase();
    if (s.includes("UP")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          UP
        </span>
      );
    }
    if (s.includes("ATENUADO")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-amber-950 shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          ATENUADO
        </span>
      );
    }
    if (s.includes("DOWN")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          DOWN
        </span>
      );
    }
    if (s.includes("ABERT") || s.includes("ATIV") || s.includes("PROGRESS") || s.includes("OPEN") || s.includes("PENDENTE")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          PENDENTE
        </span>
      );
    }
    if (s.includes("FECH") || s.includes("RESOLV") || s.includes("CONCLU") || s.includes("CLOSE")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          FECHADO
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
        {status || "N/A"}
      </span>
    );
  };

  // Helper de badge de RFO
  const getRfoBadge = (val: string) => {
    const s = String(val || "").toUpperCase();
    if (s.includes("PENDENTE") || s === "" || s === "—") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          Pendente
        </span>
      );
    }
    if (s.includes("ENVIADO") || s.includes("OK") || s.includes("SIM")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-700 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          Enviado
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
        {val}
      </span>
    );
  };

  // Helper de badge de Concluído
  const getConcluidoBadge = (val: string) => {
    const s = String(val || "").toUpperCase();
    if (s.includes("PENDENTE") || s.includes("NÃO") || s.includes("NAO") || s === "" || s === "—") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          Pendente
        </span>
      );
    }
    if (s.includes("CONCLU") || s.includes("SIM") || s.includes("FEITO") || s.includes("OK") || s.includes("UP")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
          Concluído
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500 text-white shadow-sm inline-flex items-center justify-center text-center w-full max-w-[85px]">
        {val}
      </span>
    );
  };

  // Helper de formatação do Trecho Compensado com suporte a 3 estados: "Sim", "Não" e "Parcialmente"
  const formatTrechoCompensado = (val: any): { label: "Sim" | "Não" | "Parcialmente"; style: string } | null => {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (!s || s === "—" || s === "N/A" || s === "ND" || s === "null" || s === "undefined") return null;

    const sNorm = normStr(s);

    if (sNorm.includes("parcial")) {
      return {
        label: "Parcialmente",
        style: "text-amber-800 bg-amber-50 border-amber-300/80 font-bold"
      };
    }
    if (sNorm === "sim" || sNorm.startsWith("sim") || sNorm === "true" || sNorm === "s" || sNorm === "1") {
      return {
        label: "Sim",
        style: "text-emerald-800 bg-emerald-50 border-emerald-300/80 font-bold"
      };
    }
    if (sNorm === "nao" || sNorm.startsWith("nao") || sNorm === "false" || sNorm === "n" || sNorm === "0") {
      return {
        label: "Não",
        style: "text-slate-600 bg-slate-100 border-slate-200 font-semibold"
      };
    }
    return {
      label: s as any,
      style: "text-[#FF5022] bg-[#FFF5F2] border-[#FFD1C5] font-bold"
    };
  };

  // Helper de célula de Situação unificada padronizada rigorosamente em 3 linhas para todas as categorias
  const getSituacaoCell = (status: string, rfo: string, chamadoStatus: string, categoria: string = "", titulo: string = "") => {
    const s = String(status || "").trim();
    const sUpper = s.toUpperCase();
    const r = String(rfo || "").trim();
    const rUpper = r.toUpperCase();
    const exactChamadoStatus = String(chamadoStatus || "").trim() || "Aberto";
    const csUpper = exactChamadoStatus.toUpperCase();

    // 1. Status de rede (UP / DOWN / ATENUADO / PENDENTE / —)
    let statusText = "—";
    let statusColor = "text-[#1E1E1E]";
    if (sUpper.includes("UP") || sUpper.includes("FECH") || sUpper.includes("RESOLV") || sUpper.includes("CONCLU") || sUpper.includes("CLOSE")) {
      statusText = "UP";
      statusColor = "text-emerald-600";
    } else if (sUpper.includes("ATENUADO")) {
      statusText = "ATENUADO";
      statusColor = "text-emerald-600";
    } else if (sUpper.includes("DOWN")) {
      statusText = "DOWN";
      statusColor = "text-[#FF5022]";
    } else if (sUpper.includes("PENDENTE")) {
      statusText = "PENDENTE";
      statusColor = "text-[#FF5022]";
    } else if (s && s !== "—" && s !== "N/A" && s !== "ND" && s !== "null" && s !== "undefined") {
      statusText = s;
      statusColor = "text-[#1E1E1E]";
    }

    // 2. RFO mapping (Enviado / Pendente / —)
    let rfoText = "—";
    let rfoColor = "text-[#1E1E1E]";
    if (rUpper.includes("ENVIADO") || rUpper.includes("OK") || rUpper.includes("SIM")) {
      rfoText = "Enviado";
      rfoColor = "text-[#1E1E1E]";
    } else if (rUpper.includes("PENDENTE")) {
      rfoText = "Pendente";
      rfoColor = "text-[#FF5022]";
    } else if (r && r !== "—" && r !== "N/A" && r !== "ND" && r !== "null" && r !== "undefined") {
      rfoText = r;
      rfoColor = "text-[#1E1E1E]";
    } else {
      // Se for rompimento DWDM padrão onde o RFO ainda não foi enviado, indica Pendente
      const catNorm = normStr(categoria);
      const titNorm = normStr(titulo);
      const isImocCanal = catNorm.includes("imoc - rompimento dwdm canal");
      const isRompimentoDwdm = !isImocCanal && (catNorm.includes("rompimento") || titNorm.includes("rompimento"));
      if (isRompimentoDwdm) {
        rfoText = "Pendente";
        rfoColor = "text-[#FF5022]";
      }
    }

    // 3. Chamado Status mapping
    let chamadoStatusColor = "text-[#1E1E1E]";
    if (csUpper.includes("FECH") || csUpper.includes("CONCLU") || csUpper.includes("RESOLV") || csUpper.includes("CLOSE")) {
      chamadoStatusColor = "text-emerald-600";
    } else if (csUpper.includes("REABERT") || csUpper.includes("CANCEL")) {
      chamadoStatusColor = "text-[#FF5022]";
    } else if (csUpper.includes("PENDENTE")) {
      chamadoStatusColor = "text-[#FF5022]";
    } else if (csUpper.includes("ABERT") || csUpper.includes("ANDAMENTO")) {
      chamadoStatusColor = "text-[#1E1E1E]";
    } else {
      chamadoStatusColor = "text-[#1E1E1E]";
    }

    return (
      <div className="flex flex-col text-xs leading-tight min-w-[130px] py-0.5 space-y-0.5">
        <div className="flex items-center gap-1.5 leading-tight">
          <span className="text-xs text-gray-400 font-normal uppercase font-mono w-[65px] inline-block shrink-0">STATUS:</span>
          <span className={`text-xs font-semibold ${statusColor}`}>{statusText}</span>
        </div>
        <div className="flex items-center gap-1.5 leading-tight">
          <span className="text-xs text-gray-400 font-normal uppercase font-mono w-[65px] inline-block shrink-0">RFO:</span>
          <span className={`text-xs font-semibold ${rfoColor}`}>{rfoText}</span>
        </div>
        <div className="flex items-center gap-1.5 leading-tight">
          <span className="text-xs text-gray-400 font-normal uppercase font-mono w-[65px] inline-block shrink-0">CHAMADO:</span>
          <span className={`text-xs font-semibold ${chamadoStatusColor}`}>{exactChamadoStatus}</span>
        </div>
      </div>
    );
  };

  // Helpers para verificação de registros corrompidos e conclusão
  const isCorruptLine = (item: any): boolean => {
    const criador = String(getVal(item, "Criador") || "").trim();
    const titulo = String(getVal(item, "Título") || "").trim();
    const id = String(getVal(item, "ID") || "").trim();
    
    const isGeneratedId = id.startsWith("gen-inc-");
    const hasNoValidCreatorOrTitle = !criador || !titulo || titulo === "Sem Título" || criador === "N/A";
    const creatorIsJustComment = criador.split(" ").length > 3 || 
                                 (criador.includes(" ") && (criador.toLowerCase().includes("chamado") || 
                                                            criador.toLowerCase().includes("trecho") || 
                                                            criador.toLowerCase().includes("procedimento") || 
                                                            criador.toLowerCase().includes("placa") || 
                                                            criador.toLowerCase().includes("modulo") || 
                                                            criador.toLowerCase().includes("procedimentos") || 
                                                            criador.toLowerCase().includes("reparo")));
    return isGeneratedId && (hasNoValidCreatorOrTitle || creatorIsJustComment);
  };

  const checkIfConcluido = (item: any): boolean => {
    const statusVal = normStr(getVal(item, "Status") || "");
    const concluidoVal = normStr(getVal(item, "Concluído") || getVal(item, "Concluido") || "");
    const catVal = normStr(getVal(item, "Categoria") || "");
    const titVal = normStr(getVal(item, "Título") || getVal(item, "Titulo") || "");

    const isConcluidoField = concluidoVal === "concluido" || 
                              concluidoVal === "sim" || 
                              concluidoVal === "ok" || 
                              concluidoVal.includes("conclu") ||
                              concluidoVal.includes("feito") ||
                              concluidoVal.includes("cancel") ||
                              statusVal.includes("cancel");

    // Regra A: "IMOC - Rompimento DWDM Canal" -> apenas concluído por campo/status
    if (catVal === "imoc - rompimento dwdm canal" || catVal.startsWith("imoc - rompimento dwdm canal")) {
      return isConcluidoField;
    }

    // Regra B: "Temperatura / Infra" -> apenas concluído por campo/status
    const isTemperaturaInfra = 
      catVal.includes("operacoes de infraestrutura -") ||
      catVal === "operacoes de infraestrutura - alerta de temperatura" || 
      catVal === "imoc - acompanhamento de acesso ao dc";
    if (isTemperaturaInfra) {
      return isConcluidoField;
    }

    // Regra C: "DWDM O&M" -> apenas concluído por campo/status
    const isDwdmOm = catVal.includes("dwdm o&m -") || catVal.includes("dwdm o&m");
    if (isDwdmOm) {
      return isConcluidoField;
    }

    const isIndisponibilidade = catVal.includes("indisponibilidade") || titVal.includes("indisponibilidade");
    if (isIndisponibilidade) {
      return statusVal === "up" || isConcluidoField;
    }

    const isRompimento = !isDwdmOm && (catVal.includes("dwdm - rompimento") || catVal === "dwdm - rompimento");
    if (isRompimento) {
      const isAtenuacaoCritica = normStr(getVal(item, "Atenuação Crítica") || getVal(item, "Atenuacao Critica") || "") === "sim";
      const isAtenuado = statusVal === "atenuado";
      const isUpWithoutAtenuado = statusVal === "up" && !isAtenuacaoCritica && !isAtenuado;
      return isConcluidoField || isUpWithoutAtenuado;
    }

    return isConcluidoField;
  };

  // Predicado unificado de chamados pendentes (garante 100% de consistência entre KPI, Guia e Subfiltros)
  const isPendingBaseIncident = useCallback((item: any): boolean => {
    if (isCorruptLine(item)) return false;
    const statusVal = normStr(getVal(item, "Status") || "");
    const isUp = statusVal === "up";
    const isAtenuacaoCritica = normStr(getVal(item, "Atenuação Crítica") || getVal(item, "Atenuacao Critica") || "") === "sim";
    const isPendingRfoOnly = isUp && !isAtenuacaoCritica;
    return !checkIfConcluido(item) && !isPendingRfoOnly;
  }, []);

  // Contagem unificada e memoizada de subfiltros e categorias pendentes
  const pendingCounts = useMemo(() => {
    const counts = {
      all: 0,
      rompimento: 0,
      dwdm_om: 0,
      atenuacao_critica: 0,
      atenuado: 0,
      temperatura: 0,
      indisponibilidade: 0,
      outros: 0
    };

    incidents.forEach(item => {
      if (!isPendingBaseIncident(item)) return;
      counts.all += 1;
      const clsType = getClassification(item).type;
      if (clsType === "rompimento") {
        counts.rompimento += 1;
      } else if (clsType === "dwdm_om") {
        counts.dwdm_om += 1;
      } else if (clsType === "atenuacao_critica") {
        counts.atenuacao_critica += 1;
      } else if (clsType === "atenuado") {
        counts.atenuado += 1;
      } else if (clsType === "temperatura") {
        counts.temperatura += 1;
      } else if (clsType === "indisponibilidade") {
        counts.indisponibilidade += 1;
      } else {
        counts.outros += 1;
      }
    });

    return counts;
  }, [incidents, isPendingBaseIncident]);

  // Contagem de categorias para todos os registros (aba 'todos') - aplica a todos os chamados (pendentes ou não)
  const allCategoryCounts = useMemo(() => {
    const counts = {
      all: 0,
      rompimento: 0,
      dwdm_om: 0,
      atenuacao_critica: 0,
      atenuado: 0,
      temperatura: 0,
      indisponibilidade: 0,
      outros: 0
    };

    incidents.forEach(item => {
      if (isCorruptLine(item)) return;
      counts.all += 1;
      const nature = getNatureType(item);
      if (nature === "rompimento") {
        counts.rompimento += 1;
      } else if (nature === "dwdm_om") {
        counts.dwdm_om += 1;
      } else if (nature === "atenuacao_critica") {
        counts.atenuacao_critica += 1;
      } else if (nature === "atenuado") {
        counts.atenuado += 1;
      } else if (nature === "temperatura") {
        counts.temperatura += 1;
      } else if (nature === "indisponibilidade") {
        counts.indisponibilidade += 1;
      } else {
        counts.outros += 1;
      }
    });

    return counts;
  }, [incidents]);

  const currentCategoryCounts = activeTab === 'todos' ? allCategoryCounts : pendingCounts;

  // Contagem e lista de subcategorias dos chamados na guia de RFOs Pendentes
  const rfoSubcategoryCounts = useMemo(() => {
    const counts: { [subcat: string]: number } = {};
    incidents.forEach(item => {
      if (isCorruptLine(item)) return;
      const rfoVal = normStr(getVal(item, "RFO") || "");
      const statusVal = normStr(getVal(item, "Status") || "");
      const catVal = normStr(getVal(item, "Categoria") || "");
      const titVal = normStr(getVal(item, "Título") || getVal(item, "Titulo") || "");

      const isImocRompimentoCanal = catVal === "imoc - rompimento dwdm canal" || catVal.startsWith("imoc - rompimento dwdm canal");
      const isTemperatura = 
        catVal.includes("operacoes de infraestrutura -") ||
        catVal === "operacoes de infraestrutura - alerta de temperatura" || 
        catVal === "imoc - acompanhamento de acesso ao dc";
      const isDwdmOm = catVal.includes("dwdm o&m -") || catVal.includes("dwdm o&m");
      const isIndisponibilidade = catVal.includes("indisponibilidade") || titVal.includes("indisponibilidade");

      const isRfoPendente = !isImocRompimentoCanal && !isTemperatura && !isDwdmOm && !isIndisponibilidade && statusVal === "up" && (rfoVal === "pendente" || rfoVal === "");

      if (isRfoPendente) {
        const rawSubcat = String(getVal(item, "Subcategoria") || getVal(item, "subcategoria") || "").trim();
        const subcatKey = rawSubcat ? rawSubcat.toUpperCase() : "SEM SUBCATEGORIA";
        counts[subcatKey] = (counts[subcatKey] || 0) + 1;
      }
    });
    return counts;
  }, [incidents]);

  const availableRfoSubcategories = useMemo(() => {
    return Object.keys(rfoSubcategoryCounts).sort((a, b) => {
      if (a === "SEM SUBCATEGORIA") return 1;
      if (b === "SEM SUBCATEGORIA") return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [rfoSubcategoryCounts]);

  // Busca textual otimizada com debounce para performance
  const query = useMemo(() => {
    return (globalSearchTerm || debouncedSearchTerm).toLowerCase().trim();
  }, [globalSearchTerm, debouncedSearchTerm]);

  // Filtro principal memoizado
  const filteredIncidents = useMemo(() => {
    return incidents.filter(item => {
      if (isCorruptLine(item)) return false;

      // Busca textual
      if (query) {
        const matchesSearch = Object.values(item).some(val => 
          String(val || "").toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      // Filtro pelas guias (Tabs)
      if (activeTab === 'todos') {
        if (pendingCategoryFilter !== "all") {
          if (getNatureType(item) !== pendingCategoryFilter) return false;
        }
      } else if (activeTab === 'pendentes') {
        if (!isPendingBaseIncident(item)) return false;

        if (pendingCategoryFilter !== "all") {
          if (getClassification(item).type !== pendingCategoryFilter) return false;
        }
      } else if (activeTab === 'rfos_pendentes') {
        const catVal = normStr(getVal(item, "Categoria") || "");
        const titVal = normStr(getVal(item, "Título") || getVal(item, "Titulo") || "");
        const isImocRompimentoCanal = catVal === "imoc - rompimento dwdm canal" || catVal.startsWith("imoc - rompimento dwdm canal");
        const isTemperatura = 
          catVal.includes("operacoes de infraestrutura -") ||
          catVal === "operacoes de infraestrutura - alerta de temperatura" || 
          catVal === "imoc - acompanhamento de acesso ao dc";
        const isDwdmOm = catVal.includes("dwdm o&m -") || catVal.includes("dwdm o&m");
        const isIndisponibilidade = catVal.includes("indisponibilidade") || titVal.includes("indisponibilidade");

        const statusVal = normStr(getVal(item, "Status") || "");
        const rfoVal = normStr(getVal(item, "RFO") || "");

        const isRfoCandidate = !isImocRompimentoCanal && !isTemperatura && !isDwdmOm && !isIndisponibilidade && statusVal === "up" && (rfoVal === "pendente" || rfoVal === "");
        if (!isRfoCandidate) return false;

        if (selectedRfoSubcategories.length === 0) return false;
        const rawSubcat = String(getVal(item, "Subcategoria") || getVal(item, "subcategoria") || "").trim();
        const subcatKey = rawSubcat ? rawSubcat.toUpperCase() : "SEM SUBCATEGORIA";
        if (!selectedRfoSubcategories.includes(subcatKey)) return false;
      } else if (activeTab === 'inconsistencias') {
        if (!checkIncidentDateError(item).hasDateError) return false;
      }

      // Filtro de severidade (Atenuação Crítica ou Severidade convencional)
      if (severityFilter !== "all") {
        const isCritica = String(getVal(item, "Atenuação Crítica") || "").toUpperCase() === "SIM";
        const itemSev = String(getVal(item, "Severidade") || getVal(item, "Prioridade") || "Média").toUpperCase();
        if (severityFilter === "high") {
          if (!isCritica && !itemSev.includes("ALTA") && !itemSev.includes("CRIT") && !itemSev.includes("HIGH") && !itemSev.includes("CRÍTICA")) return false;
        } else if (severityFilter === "medium") {
          if (!itemSev.includes("MED") && !itemSev.includes("MEDIUM") && !itemSev.includes("AVISO")) return false;
        } else {
          if (isCritica || itemSev.includes("ALTA") || itemSev.includes("CRIT") || itemSev.includes("MED") || itemSev.includes("HIGH")) return false;
        }
      }

      // Filtro de SLA (aplicado nas guias 'todos' e 'pendentes')
      if (activeTab === 'todos' || activeTab === 'pendentes') {
        const dtInfo = getDowntimeInHours(item);
        if (!dtInfo) {
          if (!slaFilters.includes("sem_sla")) return false;
        } else {
          const h = dtInfo.hours;
          let cat = "";
          if (h <= 8) cat = "dentro";
          else if (h <= 12) cat = "baixo";
          else if (h < 24) cat = "medio";
          else cat = "critico";
          
          if (!slaFilters.includes(cat)) return false;
        }
      }

      return true;
    });
  }, [incidents, query, activeTab, pendingCategoryFilter, severityFilter, slaFilters, selectedRfoSubcategories, isPendingBaseIncident]);

  // Ordenação memoizada
  const sortedIncidents = useMemo(() => {
    return [...filteredIncidents].sort((a, b) => {
      let valA = sortField === "Criador" || sortField === "Operador" 
        ? getOperadorOuCriador(a) 
        : String(getVal(a, sortField) || "").trim();
      let valB = sortField === "Criador" || sortField === "Operador" 
        ? getOperadorOuCriador(b) 
        : String(getVal(b, sortField) || "").trim();
      
      // Tratamento de ID/Número
      if (sortField === "ID" || sortField === "CHAMADO" || sortField === "TICKET") {
        const numA = parseInt(valA.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(valB.replace(/\D/g, ""), 10) || 0;
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      return sortDirection === "asc" 
        ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredIncidents, sortField, sortDirection]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Filtro base para contadores de SLA memoizado
  const baseIncidentsForSla = useMemo(() => {
    return incidents.filter(item => {
      if (isCorruptLine(item)) return false;

      if (query) {
        const matchesSearch = Object.values(item).some(val => 
          String(val || "").toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      if (activeTab === 'todos') {
        if (pendingCategoryFilter !== "all") {
          if (getNatureType(item) !== pendingCategoryFilter) return false;
        }
      } else if (activeTab === 'pendentes') {
        if (!isPendingBaseIncident(item)) return false;

        if (pendingCategoryFilter !== "all") {
          if (getClassification(item).type !== pendingCategoryFilter) return false;
        }
      } else if (activeTab === 'rfos_pendentes') {
        const catVal = normStr(getVal(item, "Categoria") || "");
        const titVal = normStr(getVal(item, "Título") || getVal(item, "Titulo") || "");
        const isImocRompimentoCanal = catVal === "imoc - rompimento dwdm canal" || catVal.startsWith("imoc - rompimento dwdm canal");
        const isTemperatura = 
          catVal.includes("operacoes de infraestrutura -") ||
          catVal === "operacoes de infraestrutura - alerta de temperatura" || 
          catVal === "imoc - acompanhamento de acesso ao dc";
        const isDwdmOm = catVal.includes("dwdm o&m -") || catVal.includes("dwdm o&m");
        const isIndisponibilidade = catVal.includes("indisponibilidade") || titVal.includes("indisponibilidade");

        const statusVal = normStr(getVal(item, "Status") || "");
        const rfoVal = normStr(getVal(item, "RFO") || "");

        const isRfoCandidate = !isImocRompimentoCanal && !isTemperatura && !isDwdmOm && !isIndisponibilidade && statusVal === "up" && (rfoVal === "pendente" || rfoVal === "");
        if (!isRfoCandidate) return false;

        if (selectedRfoSubcategories.length === 0) return false;
        const rawSubcat = String(getVal(item, "Subcategoria") || getVal(item, "subcategoria") || "").trim();
        const subcatKey = rawSubcat ? rawSubcat.toUpperCase() : "SEM SUBCATEGORIA";
        if (!selectedRfoSubcategories.includes(subcatKey)) return false;
      } else if (activeTab === 'inconsistencias') {
        if (!checkIncidentDateError(item).hasDateError) return false;
      }

      if (severityFilter !== "all") {
        const isCritica = String(getVal(item, "Atenuação Crítica") || "").toUpperCase() === "SIM";
        const itemSev = String(getVal(item, "Severidade") || getVal(item, "Prioridade") || "Média").toUpperCase();
        if (severityFilter === "high") {
          if (!isCritica && !itemSev.includes("ALTA") && !itemSev.includes("CRIT") && !itemSev.includes("HIGH") && !itemSev.includes("CRÍTICA")) return false;
        } else if (severityFilter === "medium") {
          if (!itemSev.includes("MED") && !itemSev.includes("MEDIUM") && !itemSev.includes("AVISO")) return false;
        } else {
          if (isCritica || itemSev.includes("ALTA") || itemSev.includes("CRIT") || itemSev.includes("MED") || itemSev.includes("HIGH")) return false;
        }
      }

      return true;
    });
  }, [incidents, query, activeTab, pendingCategoryFilter, severityFilter, selectedRfoSubcategories, isPendingBaseIncident]);

  const slaCounts = useMemo(() => {
    return baseIncidentsForSla.reduce((acc, item) => {
      const dtInfo = getDowntimeInHours(item);
      if (!dtInfo) {
        acc.sem_sla += 1;
      } else {
        const h = dtInfo.hours;
        if (h <= 8) acc.dentro += 1;
        else if (h <= 12) acc.baixo += 1;
        else if (h < 24) acc.medio += 1;
        else acc.critico += 1;
      }
      return acc;
    }, { dentro: 0, baixo: 0, medio: 0, critico: 0, sem_sla: 0 });
  }, [baseIncidentsForSla]);

  // Métricas de Painel / KPI Cards 100% alinhadas com as guias e subfiltros
  const totalIncidentsCount = allCategoryCounts.all;
  const pendingIncidentsCount = pendingCounts.all;

  const pendingRfoCount = useMemo(() => {
    return incidents.filter(i => {
      if (isCorruptLine(i)) return false;
      const catVal = normStr(getVal(i, "Categoria") || "");
      const titVal = normStr(getVal(i, "Título") || getVal(i, "Titulo") || "");
      const isImocRompimentoCanal = catVal === "imoc - rompimento dwdm canal" || catVal.startsWith("imoc - rompimento dwdm canal");
      const isTemperatura = 
        catVal === "operacoes de infraestrutura - alerta de temperatura" || 
        catVal === "imoc - acompanhamento de acesso ao dc";
      const isIndisponibilidade = catVal.includes("indisponibilidade") || titVal.includes("indisponibilidade");

      const statusVal = normStr(getVal(i, "Status") || "");
      const rfoVal = normStr(getVal(i, "RFO") || "");

      const isRfoCandidate = !isImocRompimentoCanal && !isTemperatura && !isIndisponibilidade && statusVal === "up" && (rfoVal === "pendente" || rfoVal === "");
      if (!isRfoCandidate) return false;

      if (selectedRfoSubcategories.length === 0) return false;
      const rawSubcat = String(getVal(i, "Subcategoria") || getVal(i, "subcategoria") || "").trim();
      const subcatKey = rawSubcat ? rawSubcat.toUpperCase() : "SEM SUBCATEGORIA";
      return selectedRfoSubcategories.includes(subcatKey);
    }).length;
  }, [incidents, selectedRfoSubcategories]);

  // Contagem de incidentes com inconsistências de data/cronologia
  const inconsistenciesCount = useMemo(() => {
    return incidents.filter(i => !isCorruptLine(i) && checkIncidentDateError(i).hasDateError).length;
  }, [incidents]);

  return (
    <div className="space-y-3.5 font-sans">
      {/* Cabeçalho Global Reutilizável */}
      <PageHeader
        title="Controle de Incidentes DWDM"
        subtitle="Buscador integrado de chamados via API Brisanet e sincronizador automático de planilha."
        icon={<AlertOctagon className="w-5 h-5 animate-pulse" />}
        actions={
          <>
            <button
              onClick={handleFetchFromApi}
              disabled={isLoading}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center gap-2 transition shadow-xs cursor-pointer ${
                isLoading 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                  : "bg-[#FF5022] hover:bg-[#E63D10] text-white hover:shadow-orange-500/20"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Sincronizando..." : "Sincronizar API"}
            </button>

            <button
              onClick={() => generateLocalReport()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center gap-2 transition border shadow-xs bg-[#EEF4FF] hover:bg-[#DCE7FE] text-[#0055FF] border-[#BFD5FE] hover:border-[#93BAFD] cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#0055FF]" />
              Gerar Relatório
            </button>

            {report && (
              <button
                onClick={() => {
                  const startFormatted = formatFullDateTime(startDate) || "INÍCIO";
                  const endFormatted = formatFullDateTime(endDate) || "FIM";
                  openReportInNewTab(report, startFormatted, endFormatted, plantonista);
                  setShowReportModal(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition border shadow-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ver Relatório (Nova Guia)</span>
              </button>
            )}
          </>
        }
      />

      {/* Alertas e Notificações */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl flex items-start gap-2.5 border shadow-xs ${
              notification.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : notification.type === "error" 
                ? "bg-rose-50 border-rose-200 text-rose-800" 
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${notification.type === "error" ? "text-rose-600" : notification.type === "success" ? "text-emerald-600" : "text-blue-600"}`} />
            <div className="text-xs font-medium leading-relaxed font-sans">{notification.message}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bloco Superior: Período de Consulta Exclusivo (Ultra-Minimalista) */}
      <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-gray-100/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 bg-[#FFF5F2] text-[#FF5022] rounded-md">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans block">
              Período de Consulta
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Filtro de chamados e incidentes por intervalo de data
            </span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Data Inicial:</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 h-8.5 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5022]/20 focus:border-[#FF5022] text-xs font-sans text-slate-700 transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Data Final:</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 h-8.5 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5022]/20 focus:border-[#FF5022] text-xs font-sans text-slate-700 transition"
            />
          </div>
        </div>
      </div>

      {/* Navegação por Tabs Principal (Estilo Limpo com Underline Laranja #FF5022) */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-gray-200 px-1 pt-1 overflow-x-auto overflow-y-hidden scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('todos')}
          className={`pb-2.5 text-xs sm:text-sm whitespace-nowrap transition cursor-pointer flex items-center gap-2 border-b-2 -mb-[1px] font-sans ${
            activeTab === 'todos'
              ? "border-[#FF5022] text-[#FF5022] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
          }`}
        >
          <span>Todos os Incidentes</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
            activeTab === 'todos' 
              ? "bg-orange-50 text-[#FF5022] font-bold border border-orange-200/50" 
              : "bg-slate-100 text-slate-500 font-medium"
          }`}>
            {totalIncidentsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pendentes')}
          className={`pb-2.5 text-xs sm:text-sm whitespace-nowrap transition cursor-pointer flex items-center gap-2 border-b-2 -mb-[1px] font-sans ${
            activeTab === 'pendentes'
              ? "border-[#FF5022] text-[#FF5022] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
          }`}
        >
          <span>Incidentes Pendentes</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
            activeTab === 'pendentes' 
              ? "bg-orange-50 text-[#FF5022] font-bold border border-orange-200/50" 
              : "bg-slate-100 text-slate-500 font-medium"
          }`}>
            {pendingCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rfos_pendentes')}
          className={`pb-2.5 text-xs sm:text-sm whitespace-nowrap transition cursor-pointer flex items-center gap-2 border-b-2 -mb-[1px] font-sans ${
            activeTab === 'rfos_pendentes'
              ? "border-[#FF5022] text-[#FF5022] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
          }`}
        >
          <span>RFOs Pendentes</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
            activeTab === 'rfos_pendentes' 
              ? "bg-orange-50 text-[#FF5022] font-bold border border-orange-200/50" 
              : "bg-slate-100 text-slate-500 font-medium"
          }`}>
            {pendingRfoCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inconsistencias')}
          className={`pb-2.5 text-xs sm:text-sm whitespace-nowrap transition cursor-pointer flex items-center gap-2 border-b-2 -mb-[1px] font-sans ${
            activeTab === 'inconsistencias'
              ? "border-[#FF5022] text-[#FF5022] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
          }`}
        >
          <span>Inconsistências</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
            activeTab === 'inconsistencias' 
              ? "bg-orange-50 text-[#FF5022] font-bold border border-orange-200/50" 
              : "bg-slate-100 text-slate-500 font-medium"
          }`}>
            {inconsistenciesCount}
          </span>
        </button>
      </div>

      {/* Tabela de Incidentes Recentes */}
      <div className="bg-white border border-gray-100/90 rounded-xl shadow-xs overflow-hidden">
        {/* Filtros de Busca na Tabela */}
        <div className="p-3.5 sm:p-4 border-b border-gray-100 bg-slate-50/30 space-y-3">

          {/* Cards Rápidos e Filtros Unificados de SLA (aparece nas guias Todos e Pendentes) */}
          {(activeTab === 'todos' || activeTab === 'pendentes') && (
            <div className="space-y-2 py-0.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#FF5022]" /> SLA e Tempo Fora (Clique no card para filtrar a tabela)
                </span>
                <button
                  onClick={() => {
                    if (slaFilters.length === 5) {
                      setSlaFilters([]);
                    } else {
                      setSlaFilters(["dentro", "baixo", "medio", "critico", "sem_sla"]);
                    }
                  }}
                  className="text-[10px] font-bold text-[#0055FF] hover:text-[#0045D6] transition cursor-pointer"
                >
                  {slaFilters.length === 5 ? "Desmarcar Todos" : "Marcar Todos"}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* SLA Dentro - Neutro */}
                <button
                  onClick={() => {
                    setSlaFilters(prev => 
                      prev.includes("dentro") ? prev.filter(x => x !== "dentro") : [...prev, "dentro"]
                    );
                  }}
                  className={`p-4 rounded-xl border border-slate-200/80 border-t-2 border-t-slate-400 bg-white text-left transition relative cursor-pointer select-none flex flex-col justify-between min-h-[100px] shadow-xs hover:border-slate-300 ${
                    slaFilters.includes("dentro")
                      ? "ring-1 ring-slate-300 shadow-sm opacity-100"
                      : "opacity-50 hover:opacity-90"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Dentro (≤ 8h)
                    </span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="flex justify-between items-end w-full mt-2">
                    <span className="text-2xl font-extrabold font-mono text-[#1E1E1E] leading-none">
                      {slaCounts.dentro}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 leading-none">chamados</span>
                  </div>
                </button>

                {/* SLA Baixo - Laranja super claro */}
                <button
                  onClick={() => {
                    setSlaFilters(prev => 
                      prev.includes("baixo") ? prev.filter(x => x !== "baixo") : [...prev, "baixo"]
                    );
                  }}
                  className={`p-4 rounded-xl border border-slate-200/80 border-t-2 border-t-orange-200 bg-white text-left transition relative cursor-pointer select-none flex flex-col justify-between min-h-[100px] shadow-xs hover:border-slate-300 ${
                    slaFilters.includes("baixo")
                      ? "ring-1 ring-orange-200 shadow-sm opacity-100"
                      : "opacity-50 hover:opacity-90"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200/70">
                      Baixo (8h-12h)
                    </span>
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div className="flex justify-between items-end w-full mt-2">
                    <span className="text-2xl font-extrabold font-mono text-[#1E1E1E] leading-none">
                      {slaCounts.baixo}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 leading-none">chamados</span>
                  </div>
                </button>

                {/* SLA Médio - Laranja médio */}
                <button
                  onClick={() => {
                    setSlaFilters(prev => 
                      prev.includes("medio") ? prev.filter(x => x !== "medio") : [...prev, "medio"]
                    );
                  }}
                  className={`p-4 rounded-xl border border-slate-200/80 border-t-2 border-t-orange-400 bg-white text-left transition relative cursor-pointer select-none flex flex-col justify-between min-h-[100px] shadow-xs hover:border-slate-300 ${
                    slaFilters.includes("medio")
                      ? "ring-1 ring-orange-300 shadow-sm opacity-100"
                      : "opacity-50 hover:opacity-90"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-300">
                      Médio (12h-24h)
                    </span>
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                  <div className="flex justify-between items-end w-full mt-2">
                    <span className="text-2xl font-extrabold font-mono text-[#1E1E1E] leading-none">
                      {slaCounts.medio}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 leading-none">chamados</span>
                  </div>
                </button>

                {/* SLA Crítico - Laranja Vibrante da marca */}
                <button
                  onClick={() => {
                    setSlaFilters(prev => 
                      prev.includes("critico") ? prev.filter(x => x !== "critico") : [...prev, "critico"]
                    );
                  }}
                  className={`p-4 rounded-xl border border-slate-200/80 border-t-2 border-t-[#FF5022] bg-white text-left transition relative cursor-pointer select-none flex flex-col justify-between min-h-[100px] shadow-xs hover:border-slate-300 ${
                    slaFilters.includes("critico")
                      ? "ring-1 ring-[#FF5022]/50 shadow-sm opacity-100"
                      : "opacity-50 hover:opacity-90"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FF5022] text-white border border-[#FF5022]">
                      Crítico (≥ 24h)
                    </span>
                    <AlertOctagon className="w-3.5 h-3.5 text-[#FF5022]" />
                  </div>
                  <div className="flex justify-between items-end w-full mt-2">
                    <span className="text-2xl font-extrabold font-mono text-[#1E1E1E] leading-none">
                      {slaCounts.critico}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 leading-none">chamados</span>
                  </div>
                </button>

                {/* Sem SLA - Neutro */}
                <button
                  onClick={() => {
                    setSlaFilters(prev => 
                      prev.includes("sem_sla") ? prev.filter(x => x !== "sem_sla") : [...prev, "sem_sla"]
                    );
                  }}
                  className={`p-4 rounded-xl border border-slate-200/80 border-t-2 border-t-slate-300 bg-white text-left transition relative cursor-pointer select-none flex flex-col justify-between min-h-[100px] col-span-2 sm:col-span-1 shadow-xs hover:border-slate-300 ${
                    slaFilters.includes("sem_sla")
                      ? "ring-1 ring-slate-300 shadow-sm opacity-100"
                      : "opacity-50 hover:opacity-90"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Sem SLA / Data
                    </span>
                    <Minus className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="flex justify-between items-end w-full mt-2">
                    <span className="text-2xl font-extrabold font-mono text-[#1E1E1E] leading-none">
                      {slaCounts.sem_sla}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 leading-none">chamados</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Subfiltros de Categorias em Formato de Tabs (Design Ultra-Minimalista) */}
          {(activeTab === 'pendentes' || activeTab === 'todos') && (
            <div className="flex items-center gap-5 sm:gap-6 border-b border-gray-200/80 px-1 pt-0.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('all')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'all'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Todas ({currentCategoryCounts.all})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('rompimento')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'rompimento'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>Rompimentos ({currentCategoryCounts.rompimento})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('dwdm_om')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'dwdm_om'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span>DWDM O&M ({currentCategoryCounts.dwdm_om})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('atenuacao_critica')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'atenuacao_critica'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                <span>Atenuação Crítica ({currentCategoryCounts.atenuacao_critica})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('atenuado')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'atenuado'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span>Atenuados ({currentCategoryCounts.atenuado})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('temperatura')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'temperatura'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <Thermometer className="w-3.5 h-3.5 shrink-0" />
                <span>Temperatura / Infra ({currentCategoryCounts.temperatura})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('indisponibilidade')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'indisponibilidade'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <CloudOff className="w-3.5 h-3.5 shrink-0" />
                <span>Indisponibilidade ({currentCategoryCounts.indisponibilidade})</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingCategoryFilter('outros')}
                className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
                  pendingCategoryFilter === 'outros'
                    ? "border-[#FF5022] text-[#FF5022] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Outros ({currentCategoryCounts.outros})</span>
              </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Registros Localizados ({sortedIncidents.length})</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto animate-fade-in">
              {/* Botão de Filtro Discreto de Subcategorias dos RFOs */}
              {activeTab === 'rfos_pendentes' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSubcatDropdown(prev => !prev)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                      selectedRfoSubcategories.length > 0 && (selectedRfoSubcategories.length < availableRfoSubcategories.length || selectedRfoSubcategories[0] === "FIBRA DANIFICADA")
                        ? "border-rose-300 bg-rose-50 text-rose-800 font-bold ring-1 ring-rose-300"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                    title="Filtrar por subcategoria"
                  >
                    <Filter className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      {selectedRfoSubcategories.length === 1 && selectedRfoSubcategories[0] === "FIBRA DANIFICADA"
                        ? "Subcategoria: Fibra Danificada"
                        : selectedRfoSubcategories.length === availableRfoSubcategories.length || selectedRfoSubcategories.length === 0
                        ? "Subcategorias: Todas"
                        : `Subcategorias (${selectedRfoSubcategories.length})`}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform text-slate-400 ${showSubcatDropdown ? "rotate-180" : ""}`} />
                  </button>

                  {showSubcatDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowSubcatDropdown(false)} 
                      />
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-3.5 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Filter className="w-3.5 h-3.5 text-rose-600" />
                            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider font-mono">
                              Subcategorias
                            </span>
                          </div>
                          <button
                            onClick={() => setShowSubcatDropdown(false)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            onClick={() => setSelectedRfoSubcategories(["FIBRA DANIFICADA"])}
                            className={`px-2 py-1 rounded-md font-bold transition border cursor-pointer ${
                              selectedRfoSubcategories.length === 1 && selectedRfoSubcategories[0] === "FIBRA DANIFICADA"
                                ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            Padrão (Fibra)
                          </button>
                          <button
                            onClick={() => setSelectedRfoSubcategories([...availableRfoSubcategories])}
                            className="px-2 py-1 rounded-md font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                          >
                            Todas
                          </button>
                          <button
                            onClick={() => setSelectedRfoSubcategories([])}
                            className="px-2 py-1 rounded-md font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                          {availableRfoSubcategories.length === 0 ? (
                            <div className="text-xs text-slate-400 py-2 text-center">Nenhuma subcategoria</div>
                          ) : (
                            availableRfoSubcategories.map(subcat => {
                              const isSelected = selectedRfoSubcategories.includes(subcat);
                              const count = rfoSubcategoryCounts[subcat] || 0;
                              return (
                                <label
                                  key={subcat}
                                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition select-none ${
                                    isSelected ? "bg-rose-50/80 font-bold text-rose-900" : "hover:bg-slate-50 text-slate-600 font-medium"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedRfoSubcategories(prev => 
                                          prev.includes(subcat) ? prev.filter(s => s !== subcat) : [...prev, subcat]
                                        );
                                      }}
                                      className="w-3.5 h-3.5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                                    />
                                    <span className="truncate max-w-[170px]" title={subcat}>{subcat}</span>
                                  </div>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                                    isSelected ? "bg-rose-200/70 text-rose-800" : "bg-slate-100 text-slate-500"
                                  }`}>
                                    {count}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Botões de Cópia WhatsApp */}
              {activeTab === 'pendentes' && (
                <button
                  onClick={handleCopyPendingForWhatsApp}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 ${
                    copiedPending
                      ? "border-emerald-200 bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800"
                  }`}
                  title="Copiar lista de incidentes pendentes formatada para o WhatsApp"
                >
                  {copiedPending ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPending ? "Copiado!" : "Copiar Cobrança"}
                </button>
              )}
              {activeTab === 'rfos_pendentes' && (
                <button
                  onClick={handleCopyPendingRfoForWhatsApp}
                  className={`px-3.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 text-xs font-bold ${
                    copiedPendingRfo
                      ? "border-emerald-200 bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800"
                  }`}
                  title="Copiar lista de RFOs pendentes formatada para o WhatsApp"
                >
                  {copiedPendingRfo ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPendingRfo ? "Copiado!" : "Copiar RFOs"}
                </button>
              )}

              {/* Campo Filtro */}
              <div className="relative flex items-center grow">
                <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  placeholder="Filtro rápido..."
                  className="w-full lg:w-64 pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5022]/20 focus:border-[#FF5022] text-xs font-sans transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto min-h-[320px] flex flex-col justify-center">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-20 gap-3.5">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#FF5022] border-solid border-r-transparent"></div>
              <p className="text-xs text-slate-500 font-sans font-medium">Buscando dados da malha e processando incidentes...</p>
            </div>
          ) : sortedIncidents.length === 0 ? (
            <div className="py-16 px-4 text-center text-slate-400 text-xs font-medium space-y-2">
              <Database className="w-10 h-10 mx-auto text-slate-300 animate-pulse" />
              <p>Nenhum chamado localizado para a consulta ou filtro selecionado.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                  <th className="py-3.5 px-4 w-12 text-center rounded-tl-xl"></th>
                  <th className="py-3.5 px-4">
                    <div className="flex items-center gap-1 text-slate-600">Operador</div>
                  </th>
                  <th className="py-3.5 px-4">
                    <div className="flex items-center gap-1 text-slate-600">ID</div>
                  </th>
                  <th className="py-3.5 px-4">
                    <div className="flex items-center gap-1 text-slate-600">Título & Cronologia</div>
                  </th>
                  <th className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-600">Situação</div>
                  </th>
                  {activeTab === 'rfos_pendentes' && (
                    <th className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-600">Subcategoria</div>
                    </th>
                  )}
                  <th className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-600 rounded-tr-xl">At. Crítica</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {sortedIncidents.map((row, idx) => {
                  const rowId = row.id || row.ID || `inc-${idx}`;
                  const isExpanded = expandedRowId === rowId;
                  
                  // Extrair dados específicos solicitados usando o helper flexível
                  const id = getVal(row, "ID") || rowId;
                  const titulo = getVal(row, "Título") || getVal(row, "Titulo") || getVal(row, "ASSUNTO") || "Sem Título";
                  
                  // 1. Regra de Fallback para o Operador: se nulo, vazio ou "N/A", usa o Criador
                  const operador = getOperadorOuCriador(row);
                  
                  const dataAbertura = getVal(row, "Data de Abertura") || getVal(row, "Abertura") || "N/A";
                  const subcategoria = getVal(row, "Subcategoria") || getVal(row, "subcategoria") || "—";
                  
                  // 3. Trecho Compensado com suporte completo aos 3 estados: Sim, Não, Parcialmente
                  const rawCompensado = getVal(row, "Trecho Compensado") || getVal(row, "trecho_compensado") || getVal(row, "Compensado") || "";
                  const compInfo = formatTrechoCompensado(rawCompensado);
                  
                  // Classificação inteligente da Categoria
                  let categoria = getVal(row, "Categoria");
                  if (!categoria || categoria === "N/A" || categoria === "N/D" || categoria === "") {
                    const tit = String(titulo).toLowerCase();
                    if (tit.includes("rompimento")) {
                      categoria = "Rompimento";
                    } else if (tit.includes("hardware") || tit.includes("placa") || tit.includes("placas") || tit.includes("modulo") || tit.includes("módulo")) {
                      categoria = "Hardware";
                    } else if (tit.includes("atenuacao") || tit.includes("atenuacão")) {
                      categoria = "Atenuação";
                    } else if (tit.includes("energia") || tit.includes("disjuntor")) {
                      categoria = "Energia";
                    } else if (tit.includes("temperatura") || tit.includes("climatizacao") || tit.includes("climatização") || tit.includes("ar condicionado") || tit.includes("gerador")) {
                      categoria = "Temperatura / Infraestrutura";
                    } else {
                      categoria = "ND"; // "ND" as requested
                    }
                  }
                  
                  const rfo = getVal(row, "RFO") || "—";
                  const status = getVal(row, "Status") || "Aberto";
                  
                  // 2. Mapeamento de Status do Chamado: puxa diretamente o valor do atributo Chamado Status
                  const rawChamadoStatus = row?.["Chamado Status"] || row?.["chamado_status"] || row?.["status_chamado"] || getVal(row, "Chamado Status") || "";
                  const chamadoStatus = rawChamadoStatus && String(rawChamadoStatus).trim() !== "" 
                    ? String(rawChamadoStatus).trim() 
                    : (getVal(row, "Concluído") || "Aberto");

                  // Dados para a área expandida
                  const atenuacaoCritica = getVal(row, "Atenuação Crítica") || getVal(row, "Atenuacao Critica") || "Não";
                  const usuarioUltimoComentario = getVal(row, "Usuário do Último Comentário") || getVal(row, "Usuario do Ultimo Comentario") || "—";
                  const dataUltimoComentario = getVal(row, "Data do Último Comentário") || getVal(row, "Data do Ultimo Comentario") || "—";
                  const dataInicio = getVal(row, "Data Início") || getVal(row, "Data Inicio") || "—";
                  const dataFim = getVal(row, "Data Fim") || "—";
                  const ultimoComentario = getVal(row, "Último Comentário") || getVal(row, "Ultimo Comentario") || "—";

                  // Verificação para exibição condicional do Trecho Compensado na tabela (Atenuação Crítica ou Atenuados)
                  const rowNature = getNatureType(row);
                  const isAtenuacaoCriticaRow = 
                    String(atenuacaoCritica).toLowerCase().includes("sim") || 
                    rowNature === "atenuacao_critica";
                  const isAtenuadoRow = 
                    String(status).toLowerCase().includes("atenuado") || 
                    rowNature === "atenuado";
                  const isAtenuacaoOuAtenuado = isAtenuacaoCriticaRow || isAtenuadoRow;

                  // Informações de Downtime para o bloco temporal unificado
                  const dtInfo = getDowntimeInHours(row);

                  // 1. Lógica de Validação Múltipla (Datas e Categorias)
                  const validation = checkIncidentDateError(row);
                  const hasDateError = validation.hasDateError;
                  const dateErrorTitle = validation.dateErrorTitle;

                  return (
                    <React.Fragment key={rowId}>
                      <tr className={`hover:bg-slate-50/75 transition border-b border-slate-100 ${isExpanded ? "bg-[#FFF5F2]/40" : ""}`}>
                        <td className="py-3.5 px-4 text-center align-middle">
                          <button
                            onClick={() => setExpandedRowId(isExpanded ? null : rowId)}
                            className="p-1 rounded hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-sm font-medium text-gray-800 align-middle">{operador}</td>
                        <td className="py-3.5 px-4 font-mono text-sm align-middle">
                          <a
                            href={`https://saski.brisanet.net.br/chamado/${id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-800 font-medium transition-colors hover:text-[#FF5022] hover:underline cursor-pointer"
                            title={`Abrir chamado #${id} no Saski`}
                          >
                            {id}
                          </a>
                        </td>

                        {/* Coluna Título & Cronologia: Nivelamento do tamanho base em text-sm e hierarquia por font-semibold */}
                        <td className="py-3.5 px-4 max-w-lg align-middle">
                          {/* Título: text-sm font-semibold text-gray-900 */}
                          <div className="text-sm font-semibold text-gray-900 leading-snug" title={titulo}>
                            {titulo}
                          </div>

                          {/* Metadados: text-xs text-gray-500, colado abaixo do título com mt-1 */}
                          <div className="flex flex-wrap items-center gap-2 mt-1 pt-1 border-t border-slate-100 text-xs font-normal text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <span className="flex items-center gap-1 text-xs font-normal text-gray-500" title="Data de Abertura">
                                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                {formatToBrazilianDate(dataAbertura)}
                              </span>

                              {hasDateError && (
                                <AlertTriangle 
                                  className="w-4 h-4 text-[#FF5022] shrink-0 cursor-help" 
                                  title={dateErrorTitle}
                                />
                              )}
                            </div>

                            <span className="text-gray-300">•</span>

                            <div className="flex items-center gap-1 text-xs font-normal text-gray-500" title="Tempo em Aberto / Downtime">
                              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span>{dtInfo ? dtInfo.label : "—"}</span>
                            </div>

                            {/* Trecho Compensado com recuo visual integrado */}
                            {isAtenuacaoOuAtenuado && compInfo && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-500" title="Trecho Compensado">
                                  <span className="text-gray-400 font-normal">Compensado:</span>
                                  <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-gray-700 border border-slate-200">
                                    {compInfo.label}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Situação padronizada com alinhamento vertical centralizado */}
                        <td className="py-3.5 px-4 align-middle">{getSituacaoCell(status, rfo, chamadoStatus, categoria, titulo)}</td>

                        {activeTab === 'rfos_pendentes' && (
                          <td className="py-3.5 px-4 align-middle">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-block max-w-[140px] truncate" title={subcategoria}>
                              {subcategoria}
                            </span>
                          </td>
                        )}

                        {/* Coluna Direita dedicada a Atenuação Crítica com alinhamento vertical centralizado */}
                        <td className="py-3.5 px-4 text-center align-middle">
                          <span 
                            title={`Atenuação Crítica: ${String(atenuacaoCritica).toLowerCase().includes("sim") ? "Sim" : "Não"}`}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold text-center inline-flex items-center justify-center w-full max-w-[65px] ${
                              String(atenuacaoCritica).toLowerCase().includes("sim")
                                ? "bg-rose-500 text-white shadow-xs"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {String(atenuacaoCritica).toLowerCase().includes("sim") ? "Sim" : "Não"}
                          </span>
                        </td>
                      </tr>
                      
                      {/* 3. Sublinha Expandida com Detalhes Estruturados Refatorados */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={activeTab === 'rfos_pendentes' ? 7 : 6} className="p-4 sm:p-5 border-l-4 border-[#FF5022]">
                            <div className="space-y-4">
                              {/* Cabeçalho da Seção de Detalhes */}
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                  <span className="p-1 rounded bg-[#FFF5F2] text-[#FF5022] border border-[#FFD1C5]">
                                    <AlertOctagon className="w-4 h-4" />
                                  </span>
                                  <span>Detalhes Adicionais do Chamado #{id}</span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                                  <span>Data Abertura:</span>
                                  <strong className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{formatToBrazilianDate(dataAbertura)}</strong>
                                </div>
                              </div>

                              {/* Tabela de Especificações Técnicas Clean & Responsiva */}
                              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                                {/* Visão Desktop / Grid Horizontal Alinhado */}
                                <div className="hidden lg:grid lg:grid-cols-7 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                                  <div className="p-3 text-center">Chamado Status</div>
                                  <div className="p-3 col-span-2 text-left">Categoria</div>
                                  <div className="p-3 text-left">Subcategoria</div>
                                  <div className="p-3 text-center">Trecho Compensado</div>
                                  <div className="p-3 text-center">Atenuação Crítica</div>
                                  <div className="p-3 text-center">Período (Início / Fim)</div>
                                </div>
                                <div className="hidden lg:grid lg:grid-cols-7 divide-x divide-slate-100 text-xs items-center">
                                  {/* Chamado Status */}
                                  <div className="p-3 flex items-center justify-center">
                                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                                      String(chamadoStatus).toLowerCase().includes("fech") || String(chamadoStatus).toLowerCase().includes("conclu")
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : String(chamadoStatus).toLowerCase().includes("reabert") || String(chamadoStatus).toLowerCase().includes("cancel")
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}>
                                      {chamadoStatus}
                                    </span>
                                  </div>
                                  
                                  {/* Categoria */}
                                  <div className="p-3 col-span-2">
                                    <div className="font-semibold text-slate-800 text-[12px] leading-snug line-clamp-2" title={categoria}>
                                      {categoria}
                                    </div>
                                  </div>

                                  {/* Subcategoria */}
                                  <div className="p-3">
                                    <span className="text-slate-700 font-medium text-[11px]" title={subcategoria}>
                                      {subcategoria && subcategoria !== "—" ? subcategoria : <span className="text-slate-400">—</span>}
                                    </span>
                                  </div>

                                  {/* Trecho Compensado */}
                                  <div className="p-3 flex items-center justify-center">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                      compInfo 
                                        ? compInfo.style 
                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                    }`}>
                                      {compInfo ? compInfo.label : "Não"}
                                    </span>
                                  </div>

                                  {/* Atenuação Crítica */}
                                  <div className="p-3 flex items-center justify-center">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                      String(atenuacaoCritica).toLowerCase().includes("sim")
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                    }`}>
                                      {atenuacaoCritica}
                                    </span>
                                  </div>

                                  {/* Datas */}
                                  <div className="p-3 text-center space-y-1 font-mono text-[11px]">
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                                      <span>Início:</span>
                                      <span className="font-semibold text-slate-700">{formatToBrazilianDate(dataInicio)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-0.5 gap-2">
                                      <span>Fim:</span>
                                      <span className="font-semibold text-slate-700">{formatToBrazilianDate(dataFim)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Visão Tablet/Mobile Responsiva */}
                                <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 divide-y sm:divide-y-0 divide-slate-100">
                                  <div className="flex items-center justify-between pt-2 sm:pt-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Chamado Status:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      String(chamadoStatus).toLowerCase().includes("fech")
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}>
                                      {chamadoStatus}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 pt-2 sm:pt-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Categoria:</span>
                                    <span className="text-xs font-semibold text-slate-800">{categoria}</span>
                                  </div>
                                  <div className="flex items-center justify-between pt-2 sm:pt-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Subcategoria:</span>
                                    <span className="text-xs text-slate-700">{subcategoria}</span>
                                  </div>
                                  <div className="flex items-center justify-between pt-2 sm:pt-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Compensado:</span>
                                    <span className={`text-xs font-bold ${compInfo ? compInfo.style.split(' ')[0] : 'text-slate-700'}`}>
                                      {compInfo ? compInfo.label : "Não"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between pt-2 sm:pt-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">At. Crítica:</span>
                                    <span className="text-xs font-bold text-slate-700">{atenuacaoCritica}</span>
                                  </div>
                                  <div className="flex flex-col gap-1 pt-2 sm:pt-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Período:</span>
                                    <span className="text-[11px] font-mono text-slate-700">{formatToBrazilianDate(dataInicio)} → {formatToBrazilianDate(dataFim)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Último Comentário em destaque */}
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-[#FF5022]" /> Último Comentário Registrado
                                  </div>
                                  <div className="text-[11px] font-bold text-slate-800 font-mono">
                                    {formatToBrazilianDate(dataUltimoComentario)} {usuarioUltimoComentario && usuarioUltimoComentario !== "—" ? `• ${usuarioUltimoComentario}` : ""}
                                  </div>
                                </div>
                                <div className="border-l-2 border-[#FF5022] pl-3.5 py-0.5">
                                  <p className="text-xs text-slate-900 leading-relaxed font-sans font-bold whitespace-pre-wrap bg-slate-50/80 p-3 rounded-lg border border-slate-200/70 mt-1">
                                    {ultimoComentario || "Nenhum comentário registrado."}
                                  </p>
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
      {/* Seção do Relatório (Abaixo da Tabela - Exibida apenas quando houver relatório gerado) */}
      {report && (
        <div className="w-full pt-2">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex flex-col h-full space-y-4"
          >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#FFF5F2] text-[#FF5022] rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Relatório de Controle de Incidentes</h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Gerador Analítico Estruturado do Período Selecionado
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setCustomCategoryForm({ title: "", emoji: "📌", content: "" });
                      setShowCustomCategoryModal(true);
                    }}
                    className="p-2 rounded-lg border border-[#BFD5FE] bg-[#EEF4FF] text-[#0055FF] hover:bg-[#DCE7FE] transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#0055FF]" />
                    <span>+ Info Adicional</span>
                  </button>
                  <button
                    onClick={() => {
                      const startFormatted = formatFullDateTime(startDate) || "INÍCIO";
                      const endFormatted = formatFullDateTime(endDate) || "FIM";
                      openReportInNewTab(report, startFormatted, endFormatted, plantonista);
                    }}
                    className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                    <span>Abrir em Nova Guia</span>
                  </button>
                  <button
                    onClick={handleCopyReport}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {copiedReport ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setReport(null)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition cursor-pointer text-xs font-semibold"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {/* Corpo do Relatório - WhatsApp Simulation */}
              <div className="flex flex-col rounded-xl overflow-hidden border border-[#005c4b]/20 shadow-lg bg-[#efeae2]">
                <div className="bg-[#005c4b] text-white px-4 py-3 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.1)] select-none">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-600 to-blue-900 p-1.5 flex items-center justify-center border border-white/30 select-none shadow-sm shrink-0">
                      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                        <line x1="5" y1="20" x2="35" y2="35" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                        <line x1="5" y1="35" x2="35" y2="42" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                        <line x1="5" y1="50" x2="35" y2="50" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                        <line x1="5" y1="65" x2="35" y2="58" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                        <line x1="5" y1="80" x2="35" y2="65" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                        <polygon points="35,15 60,30 60,70 35,85" fill="#0284c7" />
                        <rect x="60" y="30" width="22" height="40" fill="#0369a1" rx="2" />
                        <rect x="82" y="44" width="15" height="12" fill="#38bdf8" rx="3" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold tracking-wide">DWDM</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>online</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-white/80">
                    <span className="text-[10px] bg-white/15 px-2.5 py-0.5 rounded-full text-white font-bold tracking-wide uppercase select-none">
                      WhatsApp Preview
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto max-h-[550px] space-y-4 relative select-text" style={{ backgroundImage: "radial-gradient(#dfdcd6 1px, transparent 0)", backgroundSize: "16px 16px" }}>
                  <div className="flex flex-col items-start w-full">
                    <span className="text-[11px] text-[#008069] font-bold ml-3 mb-1 font-sans">
                      Você (Relatório Formatado)
                    </span>
                    <div className="bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tl-none px-4 py-3.5 max-w-[95%] sm:max-w-[88%] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative flex flex-col space-y-1">
                      <div className="space-y-1 text-left select-text">
                        {renderWhatsAppText(report)}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-[#667781] select-none pt-2 font-sans self-end">
                        <span>{whatsappTime}</span>
                        <div className="flex items-center text-[#53bdeb]">
                          <span className="text-[14px] leading-none select-none font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
        </div>
      )}

      {/* Modal de Gerenciamento de Informações Adicionais / Categorias Customizadas */}
      <AnimatePresence>
        {showCustomCategoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowCustomCategoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-150 overflow-hidden my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-[#FF5022] to-[#E63D10] text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <FolderPlus className="w-5 h-5 text-white/90" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Informações Adicionais / Categorias Customizadas</h3>
                    <p className="text-xs text-orange-100">Adicione observações e blocos adicionais que serão incluídos no relatório</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomCategoryModal(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Formulário para Adicionar / Editar */}
                <div className="bg-[#FFF5F2]/60 p-5 rounded-2xl border border-[#FFD1C5] space-y-4">
                  <h4 className="text-xs font-bold text-[#FF5022] uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#FF5022]" />
                    {editingCategory ? "Editar Informação Adicional" : "Nova Informação Adicional / Categoria"}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Título / Nome da Categoria:</label>
                      <input
                        type="text"
                        value={customCategoryForm.title}
                        onChange={(e) => setCustomCategoryForm({ ...customCategoryForm, title: e.target.value })}
                        placeholder="Ex: MANUTENÇÃO PROGRAMADA, NOTAS DO PLANTÃO..."
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5022] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Emoji / Ícone:</label>
                      <select
                        value={customCategoryForm.emoji}
                        onChange={(e) => setCustomCategoryForm({ ...customCategoryForm, emoji: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5022] bg-white font-mono"
                      >
                        <option value="📌">📌 Marcador</option>
                        <option value="⚙️">⚙️ Manutenção</option>
                        <option value="⚡">⚡ Energia</option>
                        <option value="📢">📢 Anúncio/Aviso</option>
                        <option value="🛠️">🛠️ Reparo</option>
                        <option value="🔔">🔔 Alerta</option>
                        <option value="👥">👥 Equipes</option>
                        <option value="⚪">⚪ Externo/Solicitação</option>
                        <option value="🔵">🔵 Info</option>
                        <option value="🟠">🟠 Atenção</option>
                        <option value="🟢">🟢 Concluído</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Informação / Detalhes:</label>
                    <textarea
                      value={customCategoryForm.content}
                      onChange={(e) => setCustomCategoryForm({ ...customCategoryForm, content: e.target.value })}
                      placeholder="Digite os detalhes da informação adicional que constará no relatório..."
                      rows={3}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5022] bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    {editingCategory && (
                      <button
                        onClick={() => {
                          setEditingCategory(null);
                          setCustomCategoryForm({ title: "", emoji: "📌", content: "" });
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      onClick={handleSaveCustomCategory}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF5022] hover:bg-[#E63D10] transition shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {editingCategory ? "Atualizar" : "Salvar Informação"}
                    </button>
                  </div>
                </div>

                {/* Lista de Categorias / Infos Adicionadas */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Informações Salvas ({customCategories.length})
                  </h4>

                  {customCategories.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                      Nenhuma informação adicional cadastrada no momento. Adicione no formulário acima.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customCategories.map((cat) => (
                        <div key={cat.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                              <span>{cat.emoji}</span>
                              <span className="uppercase">{cat.title}</span>
                            </div>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                              {cat.content}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingCategory(cat);
                                setCustomCategoryForm({ title: cat.title, emoji: cat.emoji, content: cat.content });
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF5022] hover:bg-[#FFF5F2] transition cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomCategory(cat.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">
                  Essas informações serão incluídas automaticamente ao gerar o relatório.
                </span>
                <button
                  onClick={() => setShowCustomCategoryModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition cursor-pointer"
                >
                  Concluído
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Popup para Exibição Completa do Relatório */}
      <AnimatePresence>
        {showReportModal && report && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-150 overflow-hidden my-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <FileText className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Relatório Consolidado do Período</h3>
                    <p className="text-xs text-emerald-200">Pronto para visualização, cópia ou abertura em nova guia</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setCustomCategoryForm({ title: "", emoji: "📌", content: "" });
                      setShowCustomCategoryModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#FF5022] hover:bg-[#E63D10] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Adicionar ou editar informações adicionais no relatório"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-white/90" />
                    <span>+ Info Adicional</span>
                    {customCategories.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#992607] text-[#FFF5F2] text-[10px] font-extrabold">
                        {customCategories.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const startFormatted = formatFullDateTime(startDate) || "INÍCIO";
                      const endFormatted = formatFullDateTime(endDate) || "FIM";
                      openReportInNewTab(report, startFormatted, endFormatted, plantonista);
                    }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir em Nova Guia</span>
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50">
                {/* Painel de Gerenciamento de Informações Adicionais no próprio Relatório */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-[#0055FF]" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Informações Adicionais / Categorias Customizadas
                      </h4>
                      {customCategories.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FFF5F2] text-[#FF5022] border border-[#FFD1C5] text-[11px] font-extrabold">
                          {customCategories.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingCategory(null);
                        setCustomCategoryForm({ title: "", emoji: "📌", content: "" });
                        setShowCustomCategoryModal(true);
                      }}
                      className="px-3 py-1 bg-[#EEF4FF] hover:bg-[#DCE7FE] text-[#0055FF] border border-[#BFD5FE] text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>+ Adicionar Info</span>
                    </button>
                  </div>

                  {customCategories.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Nenhuma informação adicional cadastrada. Clique em "+ Adicionar Info" para incluir observações customizadas no relatório.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {customCategories.map(cat => (
                        <div key={cat.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                              <span>{cat.emoji || "📌"}</span>
                              <span className="truncate">{cat.title}</span>
                            </div>
                            {cat.content && (
                              <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 whitespace-pre-wrap font-mono bg-white p-1.5 rounded border border-slate-150">
                                {cat.content}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingCategory(cat);
                                setCustomCategoryForm({ title: cat.title, emoji: cat.emoji, content: cat.content });
                                setShowCustomCategoryModal(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-[#FF5022] hover:bg-[#FFF5F2] transition cursor-pointer"
                              title="Editar Informação Adicional"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomCategory(cat.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Excluir Informação Adicional"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col rounded-xl overflow-hidden border border-[#005c4b]/20 shadow-lg bg-[#efeae2]">
                  <div className="bg-[#005c4b] text-white px-4 py-3 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.1)] select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-600 to-blue-900 p-1.5 flex items-center justify-center border border-white/30 select-none shadow-sm shrink-0">
                        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                          <line x1="5" y1="20" x2="35" y2="35" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                          <line x1="5" y1="35" x2="35" y2="42" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                          <line x1="5" y1="50" x2="35" y2="50" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                          <line x1="5" y1="65" x2="35" y2="58" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                          <line x1="5" y1="80" x2="35" y2="65" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                          <polygon points="35,15 60,30 60,70 35,85" fill="#0284c7" />
                          <rect x="60" y="30" width="22" height="40" fill="#0369a1" rx="2" />
                          <rect x="82" y="44" width="15" height="12" fill="#38bdf8" rx="3" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold tracking-wide">DWDM</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>online</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-white/80">
                      <span className="text-[10px] bg-white/15 px-2.5 py-0.5 rounded-full text-white font-bold tracking-wide uppercase select-none">
                        WhatsApp Preview
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 overflow-y-auto max-h-[500px] space-y-4 relative select-text" style={{ backgroundImage: "radial-gradient(#dfdcd6 1px, transparent 0)", backgroundSize: "16px 16px" }}>
                    <div className="flex flex-col items-start w-full">
                      <span className="text-[11px] text-[#008069] font-bold ml-3 mb-1 font-sans">
                        Você (Relatório Formatado)
                      </span>
                      <div className="bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tl-none px-4 py-3.5 max-w-[95%] sm:max-w-[90%] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative flex flex-col space-y-1">
                        <div className="space-y-1 text-left select-text font-mono text-xs leading-relaxed">
                          {renderWhatsAppText(report)}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[10px] text-[#667781] select-none pt-2 font-sans self-end">
                          <span>{whatsappTime}</span>
                          <div className="flex items-center text-[#53bdeb]">
                            <span className="text-[14px] leading-none select-none font-bold">✓✓</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white px-6 py-4 border-t border-slate-150 flex flex-wrap justify-between items-center gap-3">
                <button
                  onClick={handleCopyReport}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  {copiedReport ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedReport ? "Copiado!" : "Copiar Relatório Formatado"}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setCustomCategoryForm({ title: "", emoji: "📌", content: "" });
                      setShowCustomCategoryModal(true);
                    }}
                    className="px-3.5 py-2 bg-[#EEF4FF] text-[#0055FF] hover:bg-[#DCE7FE] border-[#BFD5FE] font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#0055FF]" />
                    <span>+ Info Adicional</span>
                  </button>
                  <button
                    onClick={() => {
                      const startFormatted = formatFullDateTime(startDate) || "INÍCIO";
                      const endFormatted = formatFullDateTime(endDate) || "FIM";
                      openReportInNewTab(report, startFormatted, endFormatted, plantonista);
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                    <span>Abrir em Nova Guia</span>
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-900 transition cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
