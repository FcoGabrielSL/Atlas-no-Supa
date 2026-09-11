import React, { useState, useMemo } from "react";
import { 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText,
  Percent,
  Check,
  AlertTriangle,
  MapPin,
  X,
  ChevronDown,
  Filter,
  FileSpreadsheet,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface TestesCampoTabProps {
  filteredTestesCampo: any[];
  testesCampo: any[];
  currentUser: any;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onStartFinalize?: (item: any) => void;
  onQuickImportDirect?: (record: any) => Promise<boolean>;
}

export const TestesCampoTab: React.FC<TestesCampoTabProps> = ({
  filteredTestesCampo,
  testesCampo,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
  onStartFinalize,
  onQuickImportDirect
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]); // 'SIM', 'NÃO'
  const [slaFilter, setSlaFilter] = useState<string[]>([]); // 'Crítico', 'Médio', 'Baixo'
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);

  // Estados para Cadastro Rápido
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState("");

  const parseQuickTestesCampo = (text: string) => {
    const parts = text.split('\t').map(p => p.trim());
    if (parts.length >= 6) {
      return {
        "ID": parts[0] || '',
        "ABERTURA": parts[1] || new Date().toLocaleDateString('pt-BR'),
        "TRECHOS PARA REALIZAR TESTES": parts[2] || '',
        "LOCALIDADE": parts[3] || '',
        "CONCLUÍDO": parts[4] || 'Não',
        "SLA": parts[5] || 'Não Crítico',
        "OBSERVAÇÃO": parts[6] || ''
      };
    }
    
    // Heuristic parse:
    const numMatches = text.match(/\b\d{5,8}\b/g) || [];
    const idVal = numMatches[0] || "";

    const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    const dateVal = dateMatch ? dateMatch[0] : new Date().toLocaleDateString('pt-BR');

    let trechosVal = "";
    const trechosMatch = text.match(/([A-Z0-9_\s]+(?:>>|<>)[A-Z0-9_\s]+)/i);
    if (trechosMatch) {
      trechosVal = trechosMatch[0].trim();
    }

    let concluidoVal = "Não";
    if (/sim|concluído|concluido/i.test(text)) concluidoVal = "Sim";

    let slaVal = "Não Crítico";
    if (/crítico|critico/i.test(text) && !/não/i.test(text)) slaVal = "Crítico";
    else if (/médio|medio/i.test(text)) slaVal = "Médio";

    let localidadeVal = "Senhor do bonfim";
    if (trechosVal) {
      const partsAfterTrecho = text.split(trechosVal)[1] || "";
      const words = partsAfterTrecho.trim().split(/\s+/);
      if (words.length > 0) {
        const cleanWords = [];
        for (const w of words) {
          if (/não|nao|sim|crítico|critico/i.test(w)) break;
          cleanWords.push(w);
        }
        if (cleanWords.length > 0) {
          localidadeVal = cleanWords.join(" ");
        }
      }
    }

    let obsVal = "";
    if (numMatches.length > 1) {
      obsVal = numMatches[numMatches.length - 1];
    }

    return {
      "ID": idVal,
      "ABERTURA": dateVal,
      "TRECHOS PARA REALIZAR TESTES": trechosVal || "ND",
      "LOCALIDADE": localidadeVal,
      "CONCLUÍDO": concluidoVal,
      "SLA": slaVal,
      "OBSERVAÇÃO": obsVal
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
      const parsed = parseQuickTestesCampo(quickImportText);
      if (!parsed["TRECHOS PARA REALIZAR TESTES"]) {
        setImportStatus("error");
        setImportMsg("Não foi possível identificar o trecho no texto informado. Certifique-se de que ele contém o formato LOCAL_A >> LOCAL_B.");
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

  const formatToLocalDate = (dateVal: string | undefined | null): string => {
    if (!dateVal) return '';
    const str = String(dateVal).trim();
    if (!str) return '';
    
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }
    
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          const [_, year, month, day] = isoMatch;
          return `${day}/${month}/${year}`;
        }
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (e) {
      // fallback
    }
    return str;
  };

  const toggleFilter = (current: string[], value: string, setter: (val: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  // Calculate high-fidelity KPIs
  const totalTests = testesCampo.length;
  
  const completed = useMemo(() => {
    return testesCampo.filter((item) => {
      const val = String(item["CONCLUÍDO"] || item["STATUS"] || "").trim().toLowerCase();
      return val === "sim" || val === "concluído" || val === "concluido";
    }).length;
  }, [testesCampo]);

  const pending = totalTests - completed;
  const successRate = totalTests > 0 ? Math.round((completed / totalTests) * 100) : 100;

  // Filter list locally based on text input and exact user-specified columns
  const displayRecords = useMemo(() => {
    return filteredTestesCampo.filter((item) => {
      if (!item) return false;
      const query = searchTerm.toLowerCase();
      
      const idVal = String(item["ID"] || item["id"] || "");
      const aberturaVal = String(item["ABERTURA"] || item["DATA DO TESTE"] || item["DATA REALIZADA"] || "");
      const trechosVal = String(item["TRECHOS PARA REALIZAR TESTES"] || item["LOCAL/TRECHO"] || "");
      const localidadeVal = String(item["LOCALIDADE"] || item["TÉCNICO"] || "");
      const slaVal = String(item["SLA"] || item["TIPO DE TESTE"] || "");
      const previstoVal = String(item["DATA PREVISTA"] || "");
      const obsVal = String(item["OBSERVAÇÃO"] || item["OBSERVAÇÕES"] || "");
      const concluidoVal = String(item["CONCLUÍDO"] || item["STATUS"] || "");

      // 1. Text Search Box
      if (searchTerm.trim() !== '') {
        const matchesQuery = (
          idVal.toLowerCase().includes(query) ||
          aberturaVal.toLowerCase().includes(query) ||
          trechosVal.toLowerCase().includes(query) ||
          localidadeVal.toLowerCase().includes(query) ||
          concluidoVal.toLowerCase().includes(query) ||
          slaVal.toLowerCase().includes(query) ||
          previstoVal.toLowerCase().includes(query) ||
          obsVal.toLowerCase().includes(query)
        );
        if (!matchesQuery) return false;
      }

      // 2. Period Filter
      if (startDate || endDate) {
        const itemDateStr = item["ABERTURA"] || item["DATA DO TESTE"] || item["DATA REALIZADA"] || "";
        if (!itemDateStr) return false;
        try {
          const cleanDate = formatToLocalDate(String(itemDateStr));
          const [d, m, y] = cleanDate.split('/').map(Number);
          const itemDate = new Date(y, m - 1, d);

          if (startDate) {
            const [sY, sM, sD] = startDate.split('-').map(Number);
            const sDate = new Date(sY, sM - 1, sD);
            if (itemDate < sDate) return false;
          }
          if (endDate) {
            const [eY, eM, eD] = endDate.split('-').map(Number);
            const eDate = new Date(eY, eM - 1, eD);
            if (itemDate > eDate) return false;
          }
        } catch (e) {
          console.error("Erro no filtro de data (Testes)", e);
        }
      }

      // 3. Status Filter (SIM / NÃO)
      if (statusFilter.length > 0) {
        const isSim = concluidoVal.trim().toLowerCase() === "sim" || concluidoVal.trim().toLowerCase() === "concluído" || concluidoVal.trim().toLowerCase() === "concluido";
        const itemStatusCategory = isSim ? "SIM" : "NÃO";
        if (!statusFilter.includes(itemStatusCategory)) return false;
      }

      // 4. SLA Filter (Crítico / Médio / Baixo)
      if (slaFilter.length > 0) {
        const isCrit = slaVal.toLowerCase().includes("crit") || slaVal.toLowerCase().includes("crít");
        const isMed = slaVal.toLowerCase().includes("med") || slaVal.toLowerCase().includes("méd");
        let itemSlaCategory = "Baixo";
        if (isCrit) itemSlaCategory = "Crítico";
        else if (isMed) itemSlaCategory = "Médio";
        
        if (!slaFilter.includes(itemSlaCategory)) return false;
      }

      return true;
    });
  }, [filteredTestesCampo, searchTerm, startDate, endDate, statusFilter, slaFilter]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 text-slate-800 font-sans"
    >
      {/* Header Panel (User loved this styling) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-cyan-500 rounded-full inline-block animate-pulse"></span>
            Testes de Campo
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sincronize, acompanhe e registre testes de certificação física do sinal, SLAs de entrega e inspeção óptica.
          </p>
        </div>
        {currentUser?.permissions?.testes_campo?.editar && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold transition cursor-pointer select-none shrink-0"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Inserir Linha</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1">
          <div className="flex items-center justify-between select-none p-1">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Total Registrados</span>
            <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800 font-mono tracking-tight">{totalTests}</span>
            <span className="text-xs text-slate-400 font-medium font-sans">laudos</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1">
          <div className="flex items-center justify-between select-none p-1">
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase font-mono">Concluídos (Sim)</span>
            <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">{completed}</span>
            <span className="text-xs text-slate-400 font-medium font-sans">concluídos</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1">
          <div className="flex items-center justify-between select-none p-1">
            <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase font-mono">Pendentes (Não)</span>
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-black text-amber-600 font-mono tracking-tight">{pending}</span>
            <span className="text-xs text-slate-400 font-medium font-sans">em aberto</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1">
          <div className="flex items-center justify-between select-none p-1">
            <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-mono">Eficiência Geral</span>
            <div className="p-2 bg-cyan-50 text-cyan-500 rounded-xl">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-black text-cyan-600 font-mono tracking-tight">{successRate}%</span>
            <span className="text-xs text-slate-400 font-medium font-sans">taxa</span>
          </div>
        </div>
      </div>

      {/* PAINEL DE FILTROS PADRONIZADO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 select-none">
        {/* 1. Controle de Demandas (Status Principal) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter([])}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 border",
                statusFilter.length === 0
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Todas as Demandas
            </button>
            <button
              onClick={() => setStatusFilter(['NÃO'])}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 border",
                statusFilter.length === 1 && statusFilter[0] === 'NÃO'
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20 shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Demandas Abertas
            </button>
            <button
              onClick={() => setStatusFilter(['SIM'])}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 border",
                statusFilter.length === 1 && statusFilter[0] === 'SIM'
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Concluídas
            </button>
          </div>
          
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
            Controle de Demandas
          </div>
        </div>

        {/* 2. Busca e Período */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID, Trecho, Localidade, Observação..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-cyan-500 placeholder-slate-400 bg-slate-50/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 font-mono">Início:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:border-cyan-500 bg-slate-50/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 font-mono">Fim:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:border-cyan-500 bg-slate-50/50"
            />
            {(startDate || endDate || searchTerm || statusFilter.length > 0 || slaFilter.length > 0) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSearchTerm('');
                  setStatusFilter([]);
                  setSlaFilter([]);
                }}
                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                title="Limpar todos os filtros"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 3. Filtros Avançados */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-400 mr-2 border-r pr-4 border-slate-200">
            <Filter size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Filtros Avançados</span>
          </div>

          {/* Status Secundário Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setActiveFilterMenu(activeFilterMenu === 'status' ? null : 'status')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                statusFilter.length > 0 
                  ? "bg-cyan-50 border-cyan-200 text-cyan-700" 
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
            >
              Status Conclusão: {statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} selecionados`}
              <ChevronDown size={14} className={cn("transition-transform", activeFilterMenu === 'status' && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {activeFilterMenu === 'status' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActiveFilterMenu(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 space-y-1"
                  >
                    {(['SIM', 'NÃO'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => toggleFilter(statusFilter, s, setStatusFilter)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors",
                          statusFilter.includes(s) ? "bg-cyan-50 text-cyan-600" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {s === 'SIM' ? 'Concluído (Sim)' : 'Pendente (Não)'}
                        {statusFilter.includes(s) && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                    {statusFilter.length > 0 && (
                      <button 
                        onClick={() => setStatusFilter([])}
                        className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider pt-2 border-t border-slate-50 mt-1"
                      >
                        Limpar Filtro
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* SLA Dropdown Filter */}
          <div className="relative">
            <button 
              onClick={() => setActiveFilterMenu(activeFilterMenu === 'sla' ? null : 'sla')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                slaFilter.length > 0 
                  ? "bg-amber-50 border-amber-200 text-amber-700" 
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
            >
              SLA / Gravidade: {slaFilter.length === 0 ? 'Todas' : `${slaFilter.length} selecionadas`}
              <ChevronDown size={14} className={cn("transition-transform", activeFilterMenu === 'sla' && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {activeFilterMenu === 'sla' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActiveFilterMenu(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 space-y-1"
                  >
                    {(['Crítico', 'Médio', 'Baixo'] as const).map(lev => (
                      <button
                        key={lev}
                        onClick={() => toggleFilter(slaFilter, lev, setSlaFilter)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors",
                          slaFilter.includes(lev) ? "bg-amber-50 text-amber-600" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {lev}
                        {slaFilter.includes(lev) && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                    {slaFilter.length > 0 && (
                      <button 
                        onClick={() => setSlaFilter([])}
                        className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider pt-2 border-t border-slate-50 mt-1"
                      >
                        Limpar Filtro
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-sans font-bold text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4 w-20 text-left">ID</th>
                <th className="px-6 py-4 text-left">Abertura</th>
                <th className="px-6 py-4 text-left">Trechos para Realizar Testes</th>
                <th className="px-6 py-4 text-left">Localidade</th>
                <th className="px-6 py-4 text-center">SLA</th>
                <th className="px-6 py-4 text-left">Data Prevista</th>
                <th className="px-6 py-4 text-center">Concluído</th>
                <th className="px-6 py-4 max-w-xs text-left">Observação</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRecords.length > 0 ? (
                displayRecords.map((item) => {
                  const idVal = item["ID"] || item["id"] || "-";
                  const aberturaVal = item["ABERTURA"] || item["DATA DO TESTE"] || item["DATA REALIZADA"] || "-";
                  const trechosVal = item["TRECHOS PARA REALIZAR TESTES"] || item["LOCAL/TRECHO"] || "Sem trecho";
                  const localidadeVal = item["LOCALIDADE"] || item["TÉCNICO"] || "-";
                  
                  // SLA extraction & styling
                  const rawSla = item["SLA"] || item["TIPO DE TESTE"] || "Médio";
                  const isCrit = String(rawSla).toLowerCase().includes("crit") || String(rawSla).toLowerCase().includes("crít");
                  const isMed = String(rawSla).toLowerCase().includes("med") || String(rawSla).toLowerCase().includes("méd");
                  const slaColor = isCrit
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : isMed
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200";

                  const previstoVal = item["DATA PREVISTA"] || item["DATA DO TESTE"] || "-";
                  
                  // Completed status
                  const rawConc = String(item["CONCLUÍDO"] || item["STATUS"] || "Não").trim().toLowerCase();
                  const isConc = rawConc === "sim" || rawConc === "concluído" || rawConc === "concluido";
                  
                  const obsVal = item["OBSERVAÇÃO"] || item["OBSERVAÇÕES"] || "-";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition text-slate-700">
                      {/* ID */}
                      <td className="px-6 py-4 font-mono font-bold text-slate-400">
                        #{idVal}
                      </td>
                      
                      {/* ABERTURA */}
                      <td className="px-6 py-4 text-slate-600 font-medium font-sans">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatToLocalDate(aberturaVal)}</span>
                        </div>
                      </td>
                      
                      {/* TRECHOS PARA REALIZAR TESTES */}
                      <td className="px-6 py-4 font-sans">
                        <div className="font-bold text-slate-800 tracking-tight text-xs uppercase" title={trechosVal}>
                          {trechosVal}
                        </div>
                      </td>
                      
                      {/* LOCALIDADE */}
                      <td className="px-6 py-4 font-sans">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium font-sans">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{localidadeVal}</span>
                        </div>
                      </td>
                      
                      {/* SLA */}
                      <td className="px-6 py-4 text-center font-sans">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold font-sans ${slaColor}`}>
                          {rawSla}
                        </span>
                      </td>
                      
                      {/* DATA PREVISTA */}
                      <td className="px-6 py-4 text-slate-600 font-medium font-mono">
                        {formatToLocalDate(previstoVal)}
                      </td>
                      
                      {/* CONCLUÍDO */}
                      <td className="px-6 py-4 text-center font-sans">
                        <span className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border font-sans ${
                          isConc
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {isConc ? (
                            <>
                              <Check className="w-3 h-3" />
                              Sim
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              Não
                            </>
                          )}
                        </span>
                      </td>
                      
                      {/* OBSERVAÇÃO */}
                      <td className="px-6 py-4 max-w-xs truncate text-slate-650 font-medium font-sans" title={obsVal}>
                        {obsVal}
                      </td>
                      
                      {/* AÇÕES (Equal to other tables) */}
                      <td className="px-6 py-4 text-right font-sans">
                        <div className="flex justify-end gap-1.5 items-center">
                          {!isConc && currentUser?.permissions?.testes_campo?.editar && (
                            <button
                              onClick={() => onStartFinalize?.(item)}
                              className="p-1.5 bg-white hover:bg-emerald-50 border border-slate-200 text-emerald-600 hover:text-emerald-700 rounded-lg cursor-pointer flex items-center transition shadow-sm"
                              title="Finalizar"
                            >
                              <CheckCircle2 size={13} />
                            </button>
                          )}
                          {currentUser?.permissions?.testes_campo?.editar && (
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer flex items-center transition shadow-sm"
                              title="Editar"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                          {currentUser?.permissions?.testes_campo?.excluir && (
                            <button
                              onClick={() => onDelete(item)}
                              className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-rose-500 hover:text-rose-600 rounded-lg cursor-pointer flex items-center transition shadow-sm"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400 italic text-xs">
                    Nenhum teste de campo ou laudo técnico encontrado para esta busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                    Cadastro Rápido de Testes de Campo
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
                  Cole abaixo a linha de dados de teste de campo copiada diretamente do Excel ou Google Sheets.
                  O sistema identificará de forma inteligente o ID (ex: <strong>560353</strong>), Data (ex: <strong>03/03/2026</strong>), Trecho (ex: <strong>SENHOR DO BONFIM &gt;&gt; JUAZEIRO</strong>), Localidade, Status e SLA.
                </p>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                    Dados Copiados da Planilha:
                  </label>
                  <textarea
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    placeholder={`Cole aqui... Ex:
560353 03/03/2026 SENHOR DO BONFIM >> JUAZEIRO Senhor do bonfim Não Crítico 560353`}
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
