import React, { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Calendar, 
  TrendingUp, 
  Activity, 
  Award,
  Info 
} from "lucide-react";
import { motion } from "motion/react";

interface RelatorioMensalTabProps {
  filteredRelatorios: any[];
  currentUser: any;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}

export const RelatorioMensalTab: React.FC<RelatorioMensalTabProps> = ({
  filteredRelatorios,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const totalReports = filteredRelatorios.length;
  
  const lastActiveMonth = useMemo(() => {
    if (filteredRelatorios.length === 0) return "Nenhum";
    return filteredRelatorios[0]["MÊS"] || "Mês Corrente";
  }, [filteredRelatorios]);

  // Filter reports
  const displayRecords = useMemo(() => {
    return filteredRelatorios.filter((item) => {
      const query = searchTerm.toLowerCase();
      return (
        String(item["MÊS"] || "").toLowerCase().includes(query) ||
        String(item["DESTAQUES TÉCNICOS"] || "").toLowerCase().includes(query) ||
        String(item["PRINCIPAIS EVENTOS"] || "").toLowerCase().includes(query)
      );
    });
  }, [filteredRelatorios, searchTerm]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 text-slate-800 font-sans"
    >
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-emerald-500 rounded-full inline-block"></span>
            Relatório Mensal de Operações
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Indicadores consolidados de desempenho técnico, marcos de rede e relatórios do comitê CBE local.
          </p>
        </div>
        {currentUser?.permissions?.relatorio_mensal?.editar && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-550 hover:bg-emerald-600 bg-emerald-500 text-white font-extrabold text-xs transition cursor-pointer border-none shadow-md shadow-emerald-500/10 shrink-0"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Inserir Relatório</span>
          </button>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between select-none p-1">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Consolidados</span>
            <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800 font-mono tracking-tight">{totalReports}</span>
            <span className="text-xs text-slate-400 font-medium font-sans">arquivados</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between select-none p-1">
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase font-mono">Último Mês Ativo</span>
            <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-600 font-sans tracking-tight">{lastActiveMonth}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between select-none p-1">
            <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase font-mono">Status Impressão</span>
            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-black text-indigo-600 font-mono tracking-tight">CBE</span>
            <span className="text-xs text-slate-400 font-medium font-sans">sincronizado</span>
          </div>
        </div>
      </div>

      {/* Database Search Filter */}
      <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between select-none">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por mês ou destaques..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 placeholder-slate-450 pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
        </div>
        <div className="text-slate-400 text-xs font-mono">
          Indicadores do comitê local de qualidade de fibra ({displayRecords.length} meses)
        </div>
      </div>

      {/* Reports Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayRecords.length === 0 ? (
          <div className="col-span-1 lg:col-span-2 p-12 text-center text-slate-500 border border-dashed border-slate-200 bg-white rounded-2xl font-sans">
            Nenhum relatório consolidado mensal inserido ou correspondente.
          </div>
        ) : (
          displayRecords.map((item) => (
            <motion.div
              layout
              key={item.id}
              className="p-6 bg-white rounded-2xl border border-slate-200 relative shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg block w-max">
                      {item["MÊS"]}
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-2 font-mono">
                      Criação: {item["DATA CRIAÇÃO"] || "N/A"}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {currentUser?.permissions?.relatorio_mensal?.editar && (
                      <button
                        onClick={() => onEdit(item)}
                        className="p-1 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 hover:text-slate-900 text-[10.5px] font-mono cursor-pointer transition flex items-center gap-1"
                      >
                        <Edit size={11} className="text-slate-400" />
                        <span>Editar</span>
                      </button>
                    )}
                    {currentUser?.permissions?.relatorio_mensal?.excluir && (
                      <button
                        onClick={() => onDelete(item)}
                        className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-500 border border-slate-200 cursor-pointer transition flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4 text-xs mt-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500 flex items-center gap-1 mb-1">
                      <Award className="w-3.5 h-3.5 text-indigo-500" />
                      Destaques Técnicos
                    </span>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line font-medium text-[11.5px]">
                      {item["DESTAQUES TÉCNICOS"]}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full">
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500 flex items-center gap-1 mb-1">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      Principais Eventos
                    </span>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line font-medium text-[11.5px]">
                      {item["PRINCIPAIS EVENTOS"]}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};
