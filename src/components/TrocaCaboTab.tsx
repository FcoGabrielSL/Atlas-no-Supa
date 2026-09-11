import React, { useState } from "react";
import { 
  Cable, 
  CheckCircle, 
  Trash2, 
  Edit, 
  Plus, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Clock,
  FileSpreadsheet,
  X,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertTriangle,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TrocaCaboTabProps {
  camadaOptica: any[];
  atenuacoes: any[];
  atuacoes: any[];
  testesCampo: any[];
  bypassData: any[];
  filteredTrocaCaboList: any[];
  currentUser: any;
  setSelectedItem: (item: any) => void;
  setSelectedItemType: (type: string) => void;
  setShowInsertModal: (tab: any) => void;
  handleDeleteRecord: (item: any, type: any) => void;
  onStartFinalize?: (item: any) => void;
  trocaCabo?: any[];
  onQuickImportDirect?: (record: any) => Promise<boolean>;
}

export const TrocaCaboTab: React.FC<TrocaCaboTabProps> = ({
  filteredTrocaCaboList,
  currentUser,
  setSelectedItem,
  setSelectedItemType,
  setShowInsertModal,
  handleDeleteRecord,
  onStartFinalize,
  trocaCabo = [],
  onQuickImportDirect
}) => {
  // Estados para Cadastro Rápido
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState("");

  // Estados de Filtragem Padronizados
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["ABERTO", "FECHADO"]);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const displayedList = filteredTrocaCaboList.filter((item) => {
    const query = localSearchQuery.toLowerCase().trim();
    const matchSearch =
      !query ||
      String(item.ID || item.id || "").toLowerCase().includes(query) ||
      String(item.STATUS || "").toLowerCase().includes(query) ||
      String(item.DATA || "").toLowerCase().includes(query) ||
      String(item["TRECHO "] || item["TRECHO"] || "").toLowerCase().includes(query) ||
      String(item.Descricao || "").toLowerCase().includes(query) ||
      String(item["Site A"] || "").toLowerCase().includes(query) ||
      String(item["Site B"] || "").toLowerCase().includes(query);

    const isClosed = String(item.STATUS || "").trim().toUpperCase() === "FECHADO" || String(item.conclusao || "").trim().toLowerCase() === "sim";
    const statusVal = isClosed ? "FECHADO" : "ABERTO";
    const matchStatus = selectedStatuses.includes(statusVal);

    return matchSearch && matchStatus;
  });

  const parseQuickTrocaCabo = (text: string) => {
    const parts = text.split('\t').map(p => p.trim());
    if (parts.length >= 5) {
      return {
        status: parts[0] || 'ABERTO',
        id: parts[1] || '',
        dataRegistro: parts[2] || new Date().toLocaleDateString('pt-BR'),
        trecho: parts[3] || '',
        descricao: parts[4] || ''
      };
    }

    let status = "ABERTO";
    if (/aberto|open/i.test(text)) status = "ABERTO";
    else if (/fechado|concluido|closed|concluída/i.test(text)) status = "FECHADO";

    const idMatch = text.match(/\b\d{5,8}\b/);
    const id = idMatch ? idMatch[0] : "";

    const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    const dataRegistro = dateMatch ? dateMatch[0] : new Date().toLocaleDateString('pt-BR');

    let trecho = "";
    const trechoMatch = text.match(/([a-zA-Z\s]+(?:>>|<>)[a-zA-Z\s]+)/i);
    if (trechoMatch) {
      trecho = trechoMatch[0].trim();
    }

    let descricao = "";
    if (trecho) {
      descricao = text.split(trecho)[1]?.trim() || "";
    } else {
      descricao = text;
    }

    return {
      status,
      id,
      dataRegistro,
      trecho: trecho || "ND",
      descricao
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
      const parsed = parseQuickTrocaCabo(quickImportText);
      if (!parsed.trecho) {
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

  // Permissions Config mapping
  const canEdit = currentUser?.is_admin || currentUser?.email === "francisco.gabriel@grupobrisanet.com.br" || !!currentUser?.permissions?.troca_cabo?.editar;
  const canExcluir = currentUser?.is_admin || currentUser?.email === "francisco.gabriel@grupobrisanet.com.br" || !!currentUser?.permissions?.troca_cabo?.excluir;

  // Let's calculate KPIs
  const totalRecords = trocaCabo.length || filteredTrocaCaboList.length;
  const closedRecords = (trocaCabo.length ? trocaCabo : filteredTrocaCaboList).filter(x => {
    return String(x.STATUS || "").trim().toUpperCase() === "FECHADO" || String(x.conclusao || "").trim().toLowerCase() === "sim";
  }).length;
  const openRecords = totalRecords - closedRecords;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-slate-800 font-sans"
    >
      {/* 1. Header Card (Matching standard page layouts) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1 text-left">
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-rose-500 rounded-full inline-block"></span>
            Acompanhamento Técnico: Troca de Cabo
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Gerenciamento local e em nuvem de chamados de substituição de enlaces ópticos e medição de atenuação DWDM • <span className="text-rose-600 font-bold">{filteredTrocaCaboList.length}</span> registros visíveis
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedItem(null);
                setSelectedItemType("troca_cabo");
                setShowInsertModal("troca_cabo");
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold transition cursor-pointer select-none shrink-0"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Nova Troca de Cabo</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. KPIs Section (Click to Filter Status Cards) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            Filtro por Situação (Clique nos cards para filtrar a tabela)
          </span>
          {selectedStatuses.length < 2 && (
            <button
              onClick={() => setSelectedStatuses(["ABERTO", "FECHADO"])}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-850 transition cursor-pointer"
            >
              Ver Todas as Demandas
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total de Demandas */}
          <button
            onClick={() => {
              if (selectedStatuses.length === 2) {
                setSelectedStatuses([]);
              } else {
                setSelectedStatuses(["ABERTO", "FECHADO"]);
              }
            }}
            className={`p-5 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.length === 2
                ? "border-slate-300 bg-slate-50/70 text-slate-900 ring-2 ring-slate-500/20"
                : "border-slate-200 bg-white text-slate-400 opacity-60 hover:opacity-100 hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.length === 2 ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-500"
              }`}>
                Total de Demandas
              </span>
              <span className="text-xs">📋</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-2xl font-black font-mono ${
                selectedStatuses.length === 2 ? "text-slate-800" : "text-slate-400"
              }`}>{totalRecords}</span>
              <span className="text-[10px] font-bold text-slate-500">chamados</span>
            </div>
          </button>

          {/* Card 2: Obras Concluídas */}
          <button
            onClick={() => {
              setSelectedStatuses(prev => 
                prev.includes("FECHADO") ? prev.filter(x => x !== "FECHADO") : [...prev, "FECHADO"]
              );
            }}
            className={`p-5 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.includes("FECHADO")
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                : "border-slate-200 bg-white text-slate-400 opacity-60 hover:opacity-100 hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.includes("FECHADO") ? "bg-emerald-100 text-emerald-850" : "bg-slate-100 text-slate-500"
              }`}>
                Obras Concluídas
              </span>
              <span className="text-xs">🟢</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-2xl font-black font-mono ${
                selectedStatuses.includes("FECHADO") ? "text-emerald-700" : "text-slate-400"
              }`}>{closedRecords}</span>
              <span className="text-[10px] font-bold text-slate-500">fechados</span>
            </div>
          </button>

          {/* Card 3: Atendim. Pendentes */}
          <button
            onClick={() => {
              setSelectedStatuses(prev => 
                prev.includes("ABERTO") ? prev.filter(x => x !== "ABERTO") : [...prev, "ABERTO"]
              );
            }}
            className={`p-5 rounded-2xl border text-left transition relative cursor-pointer select-none flex flex-col justify-between h-24 shadow-xs ${
              selectedStatuses.includes("ABERTO")
                ? "border-rose-300 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20"
                : "border-slate-200 bg-white text-slate-400 opacity-60 hover:opacity-100 hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                selectedStatuses.includes("ABERTO") ? "bg-rose-100 text-rose-850" : "bg-slate-100 text-slate-500"
              }`}>
                Atendim. Pendentes
              </span>
              <span className="text-xs">🔴</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className={`text-2xl font-black font-mono ${
                selectedStatuses.includes("ABERTO") ? "text-rose-700" : "text-slate-400"
              }`}>{openRecords}</span>
              <span className="text-[10px] font-bold text-slate-500">em aberto</span>
            </div>
          </button>
        </div>
      </div>

      {/* PAINEL DE FILTROS PADRONIZADO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm select-none">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            placeholder="Buscar por ID, Trecho, Descrição, Site A ou Site B..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500 placeholder-slate-400 bg-slate-50/50"
          />
        </div>
      </div>

      {/* 3. Grid / Responsive Table list */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-mono tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">ID do Chamado</th>
                <th className="p-4 font-bold">Data de Registro</th>
                <th className="p-4 font-bold">Trecho Afetado</th>
                <th className="p-4 font-bold">Descrição / Detalhes</th>
                <th className="p-4 font-bold">Site A / Abordagem</th>
                <th className="p-4 font-bold">Site B / Abordagem</th>
                <th className="p-4 font-bold text-center">Conclusão</th>
                <th className="p-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-sans text-slate-700">
              {displayedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-550 font-medium font-sans">
                    Nenhum chamado de Troca de Cabo encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : (
                displayedList.map((item) => {
                  const isClosed = String(item.STATUS || "").trim().toUpperCase() === "FECHADO" || String(item.conclusao || "").trim().toLowerCase() === "sim";
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      {/* 1. Status */}
                      <td className="p-4 font-medium">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border leading-none uppercase ${
                          isClosed 
                            ? "bg-slate-100 text-slate-600 border-slate-200" 
                            : "bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse"
                        }`}>
                          {item.STATUS || "ABERTO"}
                        </span>
                      </td>

                      {/* 2. Chamado (ID) */}
                      <td className="p-4 font-mono font-bold text-slate-800 text-[11.5px] tracking-wide">
                        {item.ID || item.id}
                      </td>

                      {/* 3. Data */}
                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {item.DATA || "-"}
                      </td>

                      {/* 4. Trecho Afetado */}
                      <td className="p-4 font-extrabold text-slate-800 text-[12px] font-mono">
                        {item["TRECHO "] || item["TRECHO"] || "Não definido"}
                      </td>

                      {/* 5. Descrição */}
                      <td className="p-4 text-slate-600 max-w-[220px] leading-relaxed break-words font-sans">
                        {item.Descricao || "-"}
                      </td>

                      {/* 6. Site A Detail */}
                      <td className="p-4 space-y-0.5">
                        <div className="font-semibold text-slate-800 uppercase tracking-tight text-[11px]">{item["Site A"] || "-"}</div>
                        {(item["Abordagem A"] || item["Qt de Caixas A "]) && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Abord: {item["Abordagem A"] || "0"} | Caixas: {item["Qt de Caixas A "] || "0"}
                          </div>
                        )}
                      </td>

                      {/* 7. Site B Detail */}
                      <td className="p-4 space-y-0.5">
                        <div className="font-semibold text-slate-800 uppercase tracking-tight text-[11px]">{item["Site B"] || "-"}</div>
                        {(item["Abordagem B"] || item["Qt de Caixas B"]) && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Abord: {item["Abordagem B"] || "0"} | Caixas: {item["Qt de Caixas B"] || "0"}
                          </div>
                        )}
                      </td>

                      {/* 8. Conclusão & Data */}
                      <td className="p-4 text-center">
                        {isClosed ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-emerald-600 font-bold text-[10.5px] uppercase tracking-wider flex items-center gap-1 font-mono">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Sim
                            </span>
                            {item["data conclusao"] && (
                              <span className="text-[9px] font-mono text-slate-500 mt-0.5">{item["data conclusao"]}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-550 font-semibold italic text-[11px] font-sans">Pendente</span>
                        )}
                      </td>

                      {/* 9. Ações (CRUD & Finalizar) */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Finalizar Button */}
                          {!isClosed && onStartFinalize && canEdit && (
                            <button
                              onClick={() => {
                                onStartFinalize(item);
                              }}
                              className="bg-rose-500/10 border border-rose-500/20 text-rose-600 hover:bg-rose-600 hover:text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Concluir</span>
                            </button>
                          )}
                          
                          {/* Edit Button */}
                          {canEdit && (
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setSelectedItemType("troca_cabo");
                                setShowInsertModal("troca_cabo");
                              }}
                              className="font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                            >
                              <Edit className="w-3 h-3 text-slate-500" />
                              <span>Editar</span>
                            </button>
                          )}

                          {/* Delete Button */}
                          {canExcluir && (
                            <button
                              onClick={() => handleDeleteRecord(item, "troca_cabo")}
                              className="font-bold p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] flex items-center gap-1 transition cursor-pointer bg-white"
                              title="Excluir Registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                    Cadastro Rápido de Troca de Cabo
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
                  Cole abaixo a linha de dados de troca de cabo copiada diretamente do Excel ou Google Sheets.
                  O sistema identificará de forma inteligente o Status, ID do Chamado (ex: <strong>491359</strong>), Data (ex: <strong>03/11/2025</strong>), Trecho (ex: <strong>Barro duro &gt;&gt; Teresina</strong>) e Descrição.
                </p>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                    Dados Copiados da Planilha:
                  </label>
                  <textarea
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    placeholder={`Cole aqui... Ex:
ABERTO 491359 03/11/2025 Barro duro >> Teresina 12 caixas em 4 km`}
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
