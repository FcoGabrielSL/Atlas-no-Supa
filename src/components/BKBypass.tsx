import React, { useMemo, useState } from 'react';
import { 
  Activity, 
  MapPin, 
  Info, 
  BarChart3, 
  TrendingUp, 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Calendar,
  AlertCircle,
  Search,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
  X,
  RefreshCw,
  Check,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Bypass as BypassType } from '../types';

interface BKBypassProps {
  bypasses: BypassType[]; // All mapped bypass items
  filteredBypasses: BypassType[]; // Mapped & filtered bypass items
  rawBypasses: any[]; // Raw bypassData list
  rawFilteredBypasses: any[]; // Raw filteredBypass list
  currentUser: any;
  onAdd: () => void;
  onEdit: (rawItem: any) => void;
  onDelete: (rawItem: any) => void;
  onStartFinalize?: (rawItem: any) => void;
  onQuickImportDirect?: (record: any) => Promise<boolean>;
}

function extractState(local: string): string {
  if (!local) return "CE";
  const match = local.match(/\b(AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/u);
  if (match) return match[1];
  
  const norm = local.toLowerCase();
  if (norm.includes("ceará") || norm.includes("fortaleza") || norm.includes("jaguaretama") || norm.includes("iguatu") || norm.includes("juazeiro")) return "CE";
  if (norm.includes("paraíba") || norm.includes("campina") || norm.includes("joão pessoa") || norm.includes("patos") || norm.includes("sousa")) return "PB";
  if (norm.includes("pernambuco") || norm.includes("recife") || norm.includes("caruaru") || norm.includes("cabo")) return "PE";
  if (norm.includes("rio grande") || norm.includes("natal") || norm.includes("mossoró")) return "RN";
  if (norm.includes("bahia") || norm.includes("salvador") || norm.includes("bonfim")) return "BA";
  
  return "CE"; // Default to CE as primary operating territory of Brisanet
}

export default function BKBypass({ 
  bypasses, 
  filteredBypasses, 
  rawBypasses,
  rawFilteredBypasses,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
  onStartFinalize,
  onQuickImportDirect
}: BKBypassProps) {
  // Estados para Cadastro Rápido
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState("");

  const parseQuickBypass = (text: string) => {
    const parts = text.split('\t').map(p => p.trim());
    if (parts.length >= 4) {
      return {
        trecho: parts[0] || '',
        km: parts[1] || '0',
        rede: parts[2] || '',
        localidade: parts[3] || ''
      };
    }

    let trecho = "";
    const trechoMatch = text.match(/([A-Z0-9_-]+\s*<>\s*[A-Z0-9_-]+)/i);
    if (trechoMatch) {
      trecho = trechoMatch[0];
    }

    let km = "0";
    const kmMatch = text.match(/(\d+)\s*(?:km|KM)/i);
    if (kmMatch) {
      km = kmMatch[1];
    } else {
      const partsAfterTrecho = trecho ? text.split(trecho)[1] : text;
      const partWords = partsAfterTrecho.trim().split(/\s+/);
      for (const w of partWords) {
        const val = parseFloat(w);
        if (!isNaN(val) && val > 0 && val < 500) {
          km = String(val);
          break;
        }
      }
    }

    let rede = "DC Brisanet";
    if (/brisanet/i.test(text)) rede = "DC Brisanet";
    else if (/copel/i.test(text)) rede = "Copel";
    else if (/claro/i.test(text)) rede = "Claro";

    let localidade = "ND";
    const words = text.split(/\s+/);
    if (words.length > 0) {
      localidade = words[words.length - 1];
    }

    return {
      trecho: trecho || "ND",
      km,
      rede,
      localidade
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
      const parsed = parseQuickBypass(quickImportText);
      if (!parsed.trecho) {
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

  // General KPIs based on the global list
  const totalBypasses = bypasses.length;
  const ativos = bypasses.filter(b => String(b.status || "").toLowerCase() === "ativo").length;
  const resolvidos = Math.max(0, totalBypasses - ativos);

  // Compute total points of bypass (e.g., counting KM markers listed)
  const { totalPoints, rankings } = useMemo(() => {
    const trechoCounts: Record<string, number> = {};
    const localCounts: Record<string, number> = {};
    const stateCounts: Record<string, number> = {};
    let points = 0;

    bypasses.forEach(b => {
      const kms = b.pontoKm.match(/([\d.,]+)/g);
      const count = kms ? kms.length : 1;
      
      points += count;
      trechoCounts[b.trechos] = (trechoCounts[b.trechos] || 0) + count;
      localCounts[b.localInicial] = (localCounts[b.localInicial] || 0) + count;

      const st = extractState(b.localInicial);
      stateCounts[st] = (stateCounts[st] || 0) + count;
    });

    const trechoRanking = Object.entries(trechoCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const localRanking = Object.entries(localCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const stateRanking = Object.entries(stateCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { totalPoints: points, rankings: { trechoRanking, localRanking, stateRanking } };
  }, [bypasses]);

  // Compute Device Incidence data mapping for BarChart
  const deviceChartData = useMemo(() => {
    const map: Record<string, number> = {};
    bypasses.forEach(item => {
      const dev = String(item.trechos || "Outros").split("-")[0]?.trim()?.substring(0, 16);
      map[dev] = (map[dev] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  }, [bypasses]);

  // Compute Reason for opening data mapping for PieChart
  const motivoDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    bypasses.forEach(item => {
      const r = String(item.motivo || "Outros").trim();
      let category = "Preventiva";
      if (r.toLowerCase().includes(" romp") || r.toLowerCase().includes("rupt")) category = "Fibra Rompida";
      else if (r.toLowerCase().includes("energ") || r.toLowerCase().includes("falta")) category = "Falha de Energia";
      else if (r.toLowerCase().includes("equip") || r.toLowerCase().includes("placa")) category = "Falha Eq. Óptico";
      else if (r.toLowerCase().includes("bypass") || r.toLowerCase().includes("ajust")) category = "Ajuste Técnico";
      else category = "Outros / Outar";
      
      map[category] = (map[category] || 0) + 1;
    });
    const colors = ["#6366f1", "#06b6d4", "#f43f5e", "#10b981", "#64748b"];
    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  }, [bypasses]);

  const handleEditClick = (bypassId: string) => {
    const rawItem = rawBypasses.find(b => b.id === bypassId);
    if (rawItem) {
      onEdit(rawItem);
    }
  };

  const handleDeleteClick = (bypassId: string) => {
    const rawItem = rawBypasses.find(b => b.id === bypassId);
    if (rawItem) {
      onDelete(rawItem);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 text-slate-800 font-sans"
    >
      {/* Header Panel (with Title & Actions) */}
      <div id="bypass-header-panel" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-orange-500 rounded-full inline-block"></span>
            Guia de Bypass
            <span className="ml-1.5 bg-orange-50 text-orange-700 border border-orange-200 text-[10.5px] px-2.5 py-0.5 rounded-full font-bold">
              {totalBypasses} Registrados
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 mt-0.5 font-medium">
            Inspeção e monitoramento de desvios, pontes temporárias e atenuações de sinal permanentes no backbone de fibra.
          </p>
        </div>
        {currentUser?.permissions?.bypass?.editar && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-add-bypass-main"
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700 text-xs font-semibold transition cursor-pointer select-none shrink-0"
            >
              <Plus className="w-4 h-4 text-gray-600" />
              <span>+ Novo Bypass</span>
            </button>
          </div>
        )}
      </div>

      {/* Bento Grid: Indicators of cities, states and trechos with most bypasses */}
      <div id="bypass-charts-row" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Cidades com mais Bypasses */}
        <div className="bg-white border border-slate-200 shadow-sm p-5.5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider font-mono">
              <MapPin className="w-4 h-4 text-emerald-500" />
              Cidades com Mais Bypasses
            </h3>
            <p className="text-[11px] text-slate-450 mt-0.5 mb-4">
              Municípios com maior recorrência de contornos temporários
            </p>
          </div>

          <div className="space-y-3.5 flex-1 justify-center flex flex-col">
            {rankings.localRanking.length === 0 ? (
              <p className="text-xs italic text-slate-400 py-4 text-center">Nenhuma cidade registrada</p>
            ) : (
              rankings.localRanking.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-700 font-semibold truncate max-w-[150px]" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full" 
                        style={{ width: `${(item.count / Math.max(1, rankings.localRanking[0].count)) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 font-mono w-4 text-right">{item.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 2: Estados com mais Bypasses */}
        <div className="bg-white border border-slate-200 shadow-sm p-5.5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider font-mono">
              <Layers className="w-4 h-4 text-indigo-500" />
              Estados com Mais Bypasses
            </h3>
            <p className="text-[11px] text-slate-450 mt-0.5 mb-4">
              Distribuição federativa de rotas com atenuações ativas
            </p>
          </div>

          <div className="space-y-3.5 flex-1 justify-center flex flex-col">
            {rankings.stateRanking.length === 0 ? (
              <p className="text-xs italic text-slate-400 py-4 text-center">Nenhum estado registrado</p>
            ) : (
              rankings.stateRanking.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-indigo-700 font-black font-mono bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full" 
                        style={{ width: `${(item.count / Math.max(1, rankings.stateRanking[0].count)) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 font-mono w-4 text-right">{item.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 3: Principais Trechos */}
        <div className="bg-white border border-slate-200 shadow-sm p-5.5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider font-mono">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Trechos Mais Afetados
            </h3>
            <p className="text-[11px] text-slate-450 mt-0.5 mb-4">
              Pontos e enlaces que exigiram mais contornos ópticos
            </p>
          </div>

          <div className="space-y-3.5 flex-1 justify-center flex flex-col">
            {rankings.trechoRanking.length === 0 ? (
              <p className="text-xs italic text-slate-400 py-4 text-center">Nenhum trecho registrado</p>
            ) : (
              rankings.trechoRanking.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-700 font-semibold leading-relaxed break-words flex-1" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 justify-end">
                    <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-orange-500 h-full rounded-full" 
                        style={{ width: `${(item.count / Math.max(1, rankings.trechoRanking[0].count)) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 font-mono w-4 text-right">{item.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom section: Main Database Catalog styled table */}
      <div id="bypass-data-table-container" className="border border-gray-200 rounded-2xl bg-white shadow-xs overflow-hidden">
        <div id="bypass-catalog-header" className="p-5 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Catálogo Histórico de Bypasses</h3>
            <p className="text-xs text-slate-500 mt-0.5">Base de dados sincronizada com o painel principal de atuações</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search filter for Trecho and Site */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por trecho ou site (local)..."
                className="w-full bg-white border border-gray-300 rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:border-orange-500 font-mono text-slate-700 shadow-xs"
              />
            </div>
            <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full font-bold shadow-xs whitespace-nowrap shrink-0">
              {(() => {
                const term = searchTerm.toLowerCase().trim();
                const count = term 
                  ? filteredBypasses.filter(bp => 
                      (bp.trechos || "").toLowerCase().includes(term) ||
                      (bp.localInicial || "").toLowerCase().includes(term) ||
                      (bp.pontoKm || "").toLowerCase().includes(term) ||
                      (bp.observacao || bp.motivo || "").toLowerCase().includes(term)
                    ).length
                  : filteredBypasses.length;
                return count;
              })()} registros exibidos
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-mono uppercase tracking-wider text-[10px]">
                <th className="px-5 py-3.5">Trechos</th>
                <th className="px-5 py-3.5">Ponto (KM)</th>
                <th className="px-5 py-3.5">Observação</th>
                <th className="px-5 py-3.5">Local Inicial</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {(() => {
                const term = searchTerm.toLowerCase().trim();
                const list = term 
                  ? filteredBypasses.filter(bp => 
                      (bp.trechos || "").toLowerCase().includes(term) ||
                      (bp.localInicial || "").toLowerCase().includes(term) ||
                      (bp.pontoKm || "").toLowerCase().includes(term) ||
                      (bp.observacao || bp.motivo || "").toLowerCase().includes(term)
                    )
                  : filteredBypasses;
                
                return list.length > 0 ? (
                  list.map((bp) => (
                    <tr key={bp.id} className="hover:bg-gray-50/80 transition bg-white">
                      {/* Column 1: Trechos */}
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-700 text-xs">{bp.trechos}</span>
                      </td>

                      {/* Column 2: Ponto KM */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5 justify-start">
                          {String(bp.pontoKm || "")
                            .split(/[,;|]+/)
                            .map((p) => p.trim())
                            .filter(Boolean)
                            .map((part, idx) => {
                              let displayVal = part;
                              if (!displayVal.toLowerCase().includes("km") && !isNaN(Number(displayVal.replace(/[^\d.-]/g, "")))) {
                                displayVal = displayVal + " km";
                              }
                              return (
                                <span 
                                  key={idx} 
                                  className="bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap inline-block shadow-xs font-mono"
                                >
                                  {displayVal}
                                </span>
                              );
                            })}
                        </div>
                      </td>

                      {/* Column 3: Observação */}
                      <td className="px-5 py-4 max-w-[280px]">
                        <div className="flex items-start gap-1.5 text-slate-600 font-medium text-xs leading-relaxed">
                          <Info size={13} className="text-slate-400 mt-0.5 shrink-0" />
                          <span>{bp.observacao || bp.motivo || ""}</span>
                        </div>
                      </td>

                      {/* Column 4: Local Inicial */}
                      <td className="px-5 py-4 text-slate-700 font-medium font-sans">
                        {bp.localInicial}
                      </td>

                      {/* Column 5: Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5 items-center">
                          {String(bp.status || "").toLowerCase() === "ativo" && currentUser?.permissions?.bypass?.editar && (
                            <button
                              onClick={() => {
                                const rawItem = rawBypasses.find(r => r.id === bp.id || r.ID === bp.id || r.idImoc === bp.id) || bp;
                                onStartFinalize?.(rawItem);
                              }}
                              className="p-1.5 bg-white hover:bg-emerald-50 border border-gray-200 text-emerald-600 hover:text-emerald-700 rounded-lg cursor-pointer flex items-center transition"
                              title="Finalizar bypass"
                            >
                              <CheckCircle2 size={13} />
                            </button>
                          )}
                          {currentUser?.permissions?.bypass?.editar && (
                            <button
                              onClick={() => handleEditClick(bp.id)}
                              className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900 rounded-lg cursor-pointer flex items-center transition"
                              title="Editar bypass"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                          {currentUser?.permissions?.bypass?.excluir && (
                            <button
                              onClick={() => handleDeleteClick(bp.id)}
                              className="p-1.5 bg-white hover:bg-rose-50 border border-gray-200 text-rose-500 hover:text-rose-600 rounded-lg cursor-pointer flex items-center transition"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-450 italic text-xs">
                      Nenhum bypass ou desvios encontrados para esta busca.
                    </td>
                  </tr>
                );
              })()}
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
                    Cadastro Rápido de Bypass
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
                  Cole abaixo a linha de dados de bypass copiada diretamente do Excel ou Google Sheets.
                  O sistema identificará de forma inteligente o Trecho (ex: <strong>JAGUARETAMA-DC-100 &lt;&gt; SERROTE VERDE-DC-100</strong>), Tamanho (ex: <strong>50 km</strong>), Dono/Rede (ex: <strong>DC Brisanet</strong>) e Localidade.
                </p>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                    Dados Copiados da Planilha:
                  </label>
                  <textarea
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    placeholder={`Cole aqui... Ex:
JAGUARETAMA-DC-100 <> SERROTE VERDE-DC-100 50 km DC Brisanet Jaguaretama`}
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
}
