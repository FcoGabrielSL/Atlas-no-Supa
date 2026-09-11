import React, { useMemo, useState, useEffect } from 'react';
import { ChevronRight, Calendar, ArrowUpDown, ChevronLeft } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Line,
  Legend,
  LabelList
} from 'recharts';
import { motion } from 'motion/react';
import { DashboardData } from '../types';
import { cn } from '../lib/utils';

interface RelatorioSemanalProps {
  data: DashboardData;
  stats: any;
  searchTerm?: string;
}

const ATENUACOES_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];
const ATUACOES_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

export default function RelatorioSemanal({ data, stats: initialStats, searchTerm = '' }: RelatorioSemanalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number | 'custom'>(7); // Default to last 7 days
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Sorting states
  const [sortAtenuacoes, setSortAtenuacoes] = useState<'asc' | 'desc' | null>(null);
  const [sortAtuacoes, setSortAtuacoes] = useState<'asc' | 'desc' | null>(null);
  
  // Company filter state
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Pagination states
  const [pageAtenuacoes, setPageAtenuacoes] = useState(1);
  const [pageAtuacoes, setPageAtuacoes] = useState(1);
  const [pageTabelaChamados, setPageTabelaChamados] = useState(1);
  const [pageEmpresas, setPageEmpresas] = useState(1);
  const ITEMS_PER_PAGE = 6;
  
  // Reset all pagination pages when filters or sorts change
  useEffect(() => {
    setPageAtenuacoes(1);
    setPageAtuacoes(1);
    setPageTabelaChamados(1);
    setPageEmpresas(1);
  }, [selectedPeriod, customRange, selectedCompany, searchTerm, sortAtenuacoes, sortAtuacoes]);

  const filteredData = useMemo(() => {
    if (!data) return { atenuacoes: [], atuacoes: [] };
    
    const now = new Date();
    const referenceDate = now;
    
    const filterByDate = (dateStr: string) => {
      if (selectedPeriod === 0) return true; // All time
      if (!dateStr) return false;
      const [day, month, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);

      if (selectedPeriod === 'custom') {
        if (!customRange.start && !customRange.end) return true;
        const start = customRange.start ? new Date(customRange.start + 'T00:00:00') : null;
        const end = customRange.end ? new Date(customRange.end + 'T23:59:59') : null;
        
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      }

      const today = new Date();
      if (selectedPeriod === 1) {
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
      }

      const diffTime = Math.abs(referenceDate.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= (selectedPeriod as number);
    };

    const filteredAtuacoes = data.atuacoes.filter(a => {
      const dateMatch = filterByDate(a.dataAbertura);
      const companyMatch = !selectedCompany || a.empresas === selectedCompany;
      const searchMatch = !searchTerm || 
        a.rede.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.trecho.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.empresas.toLowerCase().includes(searchTerm.toLowerCase());
      return dateMatch && companyMatch && searchMatch;
    });

    const filteredAtenuacoes = data.atenuacoes.filter(a => {
      // Filter strictly by opening date for the majority of the report
      const dateMatch = filterByDate(a.dataAbertura);
      
      const searchMatch = !searchTerm || 
        a.rede.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.trecho.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.status.toLowerCase().includes(searchTerm.toLowerCase());
      return dateMatch && searchMatch;
    });

    const filteredAtenuacoesFinalizadas = data.atenuacoes.filter(a => {
      // Special set for the "Finalized" KPI: filter by conclusion date
      if (a.status !== 'FECHADO' || !a.dataConclusao) return false;
      const dateMatch = filterByDate(a.dataConclusao);
      
      const searchMatch = !searchTerm || 
        a.rede.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.trecho.toLowerCase().includes(searchTerm.toLowerCase());
      return dateMatch && searchMatch;
    });

    return {
      atenuacoes: filteredAtenuacoes,
      atenuacoesFinalizadas: filteredAtenuacoesFinalizadas,
      atuacoes: filteredAtuacoes
    };
  }, [data, selectedPeriod, customRange, selectedCompany, searchTerm]);

  // Chart Data Calculations (Moved to top level to follow Rules of Hooks)
  const atenuacoesSummaryData = useMemo(() => {
    if (!filteredData?.atenuacoes) return { chart: [], total: 0, testes: 0, abertos: 0, fechados: 0 };
    
    // Filter specifically for TESTES type as requested for the summary
    const allAtenuacoes = filteredData.atenuacoes;
    const testCalls = allAtenuacoes.filter(a => {
      const type = (a.tipoChamado || "").toUpperCase().trim();
      return type === 'TESTES' || type === 'TESTE';
    });
    
    const abertos = testCalls.filter(a => a.status === 'ABERTO').length;
    const fechados = testCalls.filter(a => a.status === 'FECHADO').length;

    return {
      chart: [
        { name: 'Abertos', value: abertos, color: '#f43f5e' }, // rose-500
        { name: 'Finalizados', value: fechados, color: '#4f46e5' } // indigo-600
      ],
      total: testCalls.length,
      abertos,
      fechados
    };
  }, [filteredData]);

  const hasAtenuacoesSummaryData = atenuacoesSummaryData.total > 0;

  const atenuacoesGanhosTimelineData = useMemo(() => {
    const days: Record<string, { name: string, atenuacoes: number, ganhos: number }> = {};
    const now = new Date();
    
    // Determine start and end date for the timeline
    let startDate: Date;
    let endDate: Date = now;

    if (selectedPeriod === 'custom') {
      startDate = customRange.start ? new Date(customRange.start + 'T00:00:00') : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = customRange.end ? new Date(customRange.end + 'T23:59:59') : now;
    } else if (selectedPeriod === 0) {
      // For "All time", calculate range from data
      const allDates = [
        ...data.atenuacoes.map(a => a.dataAbertura),
        ...data.atuacoes.map(a => a.dataAbertura)
      ].filter(Boolean).map(d => {
        const [day, month, year] = d.split('/').map(Number);
        return new Date(year, month - 1, day);
      }).filter(d => !isNaN(d.getTime()));
      
      startDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : now;
    } else {
      startDate = new Date(now.getTime() - (selectedPeriod as number - 1) * 24 * 60 * 60 * 1000);
    }

    // Initialize all days in the range with zeros
    const tempDate = new Date(startDate);
    tempDate.setHours(0, 0, 0, 0);
    const finalDate = new Date(endDate);
    finalDate.setHours(23, 59, 59, 999);

    while (tempDate <= finalDate) {
      const dayStr = tempDate.toLocaleDateString('pt-BR');
      days[dayStr] = { name: dayStr, atenuacoes: 0, ganhos: 0 };
      tempDate.setDate(tempDate.getDate() + 1);
    }
    
    // Fill with data
    filteredData?.atenuacoes?.forEach(a => {
      if (!a.dataAbertura) return;
      if (days[a.dataAbertura]) {
        days[a.dataAbertura].atenuacoes += Number(a.perdas) || 0;
      }
    });

    filteredData?.atuacoes?.forEach(a => {
      if (!a.dataAbertura) return;
      if (days[a.dataAbertura]) {
        days[a.dataAbertura].ganhos += Number(a.totalGanhos) || 0;
      }
    });
    
    return Object.values(days).sort((a, b) => {
      const [dayA, monthA, yearA] = a.name.split('/').map(Number);
      const [dayB, monthB, yearB] = b.name.split('/').map(Number);
      return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
    });
  }, [data, filteredData, selectedPeriod, customRange]);

  const hasAtenuacoesGanhosTimelineData = atenuacoesGanhosTimelineData.length > 0;

  const atuacoesTipoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData?.atuacoes?.forEach(a => {
      const type = (a.tipoChamado || "").toUpperCase();
      let label = (type === 'POS ROMPIMENTO' || type === 'PÓS ROMPIMENTO') ? 'Pós rompimento' : 
                   type === 'TRECHO' ? 'Trecho' : a.tipoChamado;
      label = label?.trim() || 'Não Informado';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const hasAtuacoesTipoData = atuacoesTipoData.length > 0;

  const atuacoesMotivoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData?.atuacoes?.forEach(a => {
      const raw = (a.motivo || "").toLowerCase().trim();
      if (raw) {
        const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
        counts[formatted] = (counts[formatted] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, Total: value }));
  }, [filteredData]);

  const hasAtuacoesMotivoData = atuacoesMotivoData.length > 0;

  const empresasAtuaramData = useMemo(() => {
    if (!filteredData) return [];
    
    // We want the list of companies to be affected by the period filter
    // but not strictly the company selection itself (otherwise the list disappears when one is selected)
    const counts: Record<string, number> = {};
    filteredData.atuacoes.forEach(a => {
      counts[a.empresas] = (counts[a.empresas] || 0) + 1;
    });
    
    // However, if a company is selected, we want to see it in context of all companies in that period
    // So we actually benefit from seeing the counts of all companies within the selected PERIOD.
    // If we use filteredData.atuacoes, and selectedCompany is set, filteredData.atuacoes only has that company.
    
    // Correct approach: Calculate counts for all companies matching the CURRENT PERIOD.
    const countsInPeriod: Record<string, number> = {};
    data?.atuacoes?.forEach(a => {
      const date = new Date(a.dataAbertura.split('/').reverse().join('-') + 'T00:00:00');
      let dateMatch = false;
      const refDate = new Date();
      
      if (selectedPeriod === 'custom') {
        const start = customRange.start ? new Date(customRange.start + 'T00:00:00') : null;
        const end = customRange.end ? new Date(customRange.end + 'T23:59:59') : null;
        dateMatch = (!start || date >= start) && (!end || date <= end);
      } else if (selectedPeriod === 1) {
        dateMatch = date.getDate() === refDate.getDate() &&
                    date.getMonth() === refDate.getMonth() &&
                    date.getFullYear() === refDate.getFullYear();
      } else if (selectedPeriod === 0) {
        dateMatch = true;
      } else {
        const diffTime = Math.abs(refDate.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        dateMatch = diffDays <= (selectedPeriod as number);
      }

      if (dateMatch) {
        countsInPeriod[a.empresas] = (countsInPeriod[a.empresas] || 0) + 1;
      }
    });

    return Object.entries(countsInPeriod).sort((a, b) => b[1] - a[1]);
  }, [data, selectedPeriod, customRange]);

  const sortedAtenuacoes = useMemo(() => {
    if (!filteredData) return [];
    const items = [...filteredData.atenuacoes];
    if (sortAtenuacoes === 'asc') {
      return items.sort((a, b) => (Number(a.perdas) || 0) - (Number(b.perdas) || 0));
    } else if (sortAtenuacoes === 'desc') {
      return items.sort((a, b) => (Number(b.perdas) || 0) - (Number(a.perdas) || 0));
    }
    return items;
  }, [filteredData, sortAtenuacoes]);

  const sortedAtuacoesTable = useMemo(() => {
    if (!filteredData) return [];
    const items = [...filteredData.atuacoes];
    if (sortAtuacoes === 'asc') {
      return items.sort((a, b) => (Number(a.totalGanhos) || 0) - (Number(b.totalGanhos) || 0));
    } else if (sortAtuacoes === 'desc') {
      return items.sort((a, b) => (Number(b.totalGanhos) || 0) - (Number(a.totalGanhos) || 0));
    }
    return items;
  }, [filteredData, sortAtuacoes]);

  // Financial/KPI calculations
  const stats = useMemo(() => {
    if (!filteredData || !initialStats) return initialStats;
    const totalPerdas = filteredData.atenuacoes.reduce((acc, curr) => acc + (Number(curr.perdas) || 0), 0);
    const totalGanhos = filteredData.atuacoes.reduce((acc, curr) => acc + (Number(curr.totalGanhos) || 0), 0);
    const abertas = filteredData.atenuacoes.filter(a => a.status === 'ABERTO').length;
    // Finalized count now uses the conclusion-date-filtered set
    const fechadas = filteredData.atenuacoesFinalizadas.length;
    const totalAtuacoes = filteredData.atuacoes.length;
    
    return {
      ...initialStats,
      totalPerdas,
      totalGanhos,
      totalAtenuacoes: filteredData.atenuacoes.length, // Only opened in period
      abertas,
      fechadas,
      totalAtuacoes
    };
  }, [filteredData, initialStats]);

  const statsBreakdown = useMemo(() => {
    if (!filteredData) return { total: [], abertos: [], fechados: [], atuacoes: [] };
    
    const getBreakdown = (items: any[]) => {
      const counts: Record<string, number> = {};
      items.forEach(a => {
        const type = (a.tipoChamado || "").toUpperCase();
        let label = (type === 'POS ROMPIMENTO' || type === 'PÓS ROMPIMENTO') ? 'Pós rompimento' : 
                     type === 'TRECHO' ? 'Trecho' : a.tipoChamado;
        label = label?.trim() || 'Outros';
        counts[label] = (counts[label] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    };

    const allItems = filteredData.atenuacoes;
    const abertosItems = allItems.filter(a => a.status === 'ABERTO');
    const fechadosItems = filteredData.atenuacoesFinalizadas;

    return {
      total: getBreakdown(allItems),
      abertos: getBreakdown(abertosItems),
      fechados: getBreakdown(fechadosItems),
      atuacoes: getBreakdown(filteredData.atuacoes)
    };
  }, [filteredData]);

  const globalOpenStats = useMemo(() => {
    if (!data) return { total: 0, breakdown: "" };
    
    const openTickets = data?.atenuacoes?.filter(a => {
      const isAberto = a.status === 'ABERTO';
      const type = (a.tipoChamado || "").toUpperCase().trim();
      const isTeste = type === 'TESTES' || type === 'TESTE';
      return isAberto && !isTeste;
    }) || [];
    const total = openTickets.length;
    
    const counts: Record<string, number> = {};
    openTickets.forEach(a => {
      const type = (a.tipoChamado || "").toUpperCase();
      let label = (type === 'POS ROMPIMENTO' || type === 'PÓS ROMPIMENTO') ? 'pós rompimento' : 
                   type === 'TRECHO' ? 'trecho' : a.tipoChamado;
      label = label?.trim().toLowerCase() || 'não informado';
      counts[label] = (counts[label] || 0) + 1;
    });

    const breakdownStr = Object.entries(counts)
      .map(([name, value]) => `${value} ${name}`)
      .join(' | ');

    return { total, breakdown: total > 0 ? `( ${breakdownStr} )` : "" };
  }, [data]);

  const periods = [
    { label: 'Hoje', value: 1 },
    { label: 'Últimos 7 dias', value: 7 },
    { label: 'Últimos 15 dias', value: 15 },
    { label: 'Últimos 30 dias', value: 30 },
    { label: 'Todo o período', value: 0 },
    { label: 'Personalizado', value: 'custom' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-6"
    >
      {/* Top Header Bar from Screenshot */}
      <div className="bg-teal-700 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-8">
          <h2 className="text-2xl font-bold tracking-tight uppercase">Relatório Semanal</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium opacity-80 whitespace-nowrap">Abertos:</span>
            <span className="text-2xl font-bold">{globalOpenStats.total}</span>
            {globalOpenStats.breakdown && (
              <span className="text-xs font-bold text-white border-l border-white/20 pl-4 ml-2">
                {globalOpenStats.breakdown}
              </span>
            )}
          </div>
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-2">
            {selectedCompany && (
              <button 
                onClick={() => setSelectedCompany(null)}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors border border-white/20"
              >
                EMPRESA: {selectedCompany} ✕
              </button>
            )}
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
            >
              <Calendar size={16} />
              <span className="text-sm font-medium">
                {periods.find(p => p.value === selectedPeriod)?.label || 'Selecionar período'}
              </span>
              <ChevronRight size={16} className={isDropdownOpen ? "-rotate-90" : "rotate-90"} />
            </button>
          </div>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-slate-800">
              {periods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => {
                    setSelectedPeriod(period.value as any);
                    if (period.value !== 'custom') {
                      setIsDropdownOpen(false);
                    }
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                    selectedPeriod === period.value ? 'font-bold text-teal-700 bg-teal-50' : ''
                  }`}
                >
                  {period.label}
                </button>
              ))}
              
              {selectedPeriod === 'custom' && (
                <div className="px-4 py-3 border-t border-slate-100 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Início</label>
                    <input 
                      type="date" 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none"
                      value={customRange.start}
                      onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label>
                    <input 
                      type="date" 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none"
                      value={customRange.end}
                      onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                  <button 
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-full bg-teal-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    Aplicar Filtro
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Row from Screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-600 text-white p-5 rounded-xl shadow-sm min-h-44 flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-bold text-white tracking-wider opacity-90 pt-1">Resumo de potência (dB):</p>
            <div className="text-right">
              <p className="text-[9px] font-bold text-white/60 mb-[-2px]">Saldo líquido</p>
              <h4 className={`text-6xl font-bold tracking-tighter leading-none ${((stats?.totalGanhos || 0) - (stats?.totalPercas || 0)) >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                {((stats?.totalGanhos || 0) - (stats?.totalPercas || 0)).toFixed(1).replace('.', ',')}
              </h4>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex items-center justify-between py-2">
              <span className="text-[10px] font-bold tracking-wide">Total de atenuações</span>
              <span className="text-lg font-bold text-rose-400">-{ (stats?.totalPerdas || 0).toFixed(1).replace('.', ',') } dB</span>
            </div>
            <div className="border-t border-white/10"></div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[10px] font-bold tracking-wide">Total de ganhos</span>
              <span className="text-lg font-bold text-teal-400">+{ (stats?.totalGanhos || 0).toFixed(1).replace('.', ',') } dB</span>
            </div>
          </div>
        </div>
        <div className="bg-orange-600 p-5 rounded-xl shadow-sm min-h-44 flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-start mb-5">
            <p className="text-[10px] font-bold text-white tracking-wider opacity-90 pt-1">Total de chamados:</p>
            <h4 className="text-7xl font-bold text-white tracking-tighter leading-none">{stats?.totalAtenuacoes || 0}</h4>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            {statsBreakdown.total.map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white tracking-wide">{item.name}</span>
                <span className="text-sm font-black text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-indigo-600 p-5 rounded-xl shadow-sm min-h-44 flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-start mb-5">
            <p className="text-[10px] font-bold text-white tracking-wider opacity-90 pt-1">Chamados finalizados:</p>
            <h4 className="text-7xl font-bold text-white tracking-tighter leading-none">{stats?.fechadas || 0}</h4>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            {statsBreakdown.fechados.map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white tracking-wide">{item.name}</span>
                <span className="text-sm font-black text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-teal-600 p-5 rounded-xl shadow-sm min-h-44 flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-start mb-5">
            <p className="text-[10px] font-bold text-white tracking-wider opacity-90 pt-1">Total de atuações:</p>
            <h4 className="text-7xl font-bold text-white tracking-tighter leading-none">{stats?.totalAtuacoes || 0}</h4>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            {statsBreakdown.atuacoes.map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white tracking-wide">{item.name}</span>
                <span className="text-sm font-black text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atenuacoes Donut + Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            Status dos chamados de teste e atenuações:
          </h3>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-[40%] border-r border-slate-100 pr-0 md:pr-6 flex flex-col justify-center py-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 text-center md:text-left">Chamados de testes</p>
              
              {hasAtenuacoesSummaryData ? (
                <div className="space-y-8">
                  {/* Progress Bar Container */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Proporção de status</span>
                      <span className="text-[10px] font-medium text-slate-400 italic">Total: {atenuacoesSummaryData.total}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      <div 
                        className="h-full bg-rose-500 transition-all duration-500 ease-out"
                        style={{ width: `${(atenuacoesSummaryData.abertos / atenuacoesSummaryData.total) * 100}%` }}
                      />
                      <div 
                        className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                        style={{ width: `${(atenuacoesSummaryData.fechados / atenuacoesSummaryData.total) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Detailed Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Abertos</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{atenuacoesSummaryData.abertos}</span>
                        <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">chamados</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-600" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Finalizados</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{atenuacoesSummaryData.fechados}</span>
                        <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">chamados</span>
                      </div>
                    </div>
                  </div>

                  {/* Percentage Helper */}
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    Atualmente, <span className="text-rose-500 font-bold">{Math.round((atenuacoesSummaryData.abertos / atenuacoesSummaryData.total) * 100) || 0}%</span> dos chamados de teste estão pendentes de finalização.
                  </p>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-400 text-xs font-medium italic text-center border-2 border-dashed border-slate-100 rounded-xl">
                  Sem dados de testes
                </div>
              )}
            </div>
            <div className="w-full md:w-[60%]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Chamados de atenuação</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="p-2 text-left">Trecho</th>
                    <th 
                      className="p-2 text-right cursor-pointer hover:bg-slate-200 transition-colors group"
                      onClick={() => setSortAtenuacoes(prev => prev === 'desc' ? 'asc' : 'desc')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        (dB)
                        <ArrowUpDown size={12} className={cn("transition-colors", sortAtenuacoes ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600")} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedAtenuacoes.slice((pageAtenuacoes - 1) * ITEMS_PER_PAGE, pageAtenuacoes * ITEMS_PER_PAGE).map((a, i) => (
                    <tr key={i}>
                      <td className="p-2 text-slate-600 font-medium">{a.trecho}</td>
                      <td className="p-2 text-right font-bold text-slate-800 whitespace-nowrap">
                        {((a.tipoChamado || "").toUpperCase().trim() === 'TESTES' || (a.tipoChamado || "").toUpperCase().trim() === 'TESTE') ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 bg-teal-100 text-teal-700 rounded-full text-[10px]" title="Chamado de Teste">T</span>
                        ) : (
                          (a.perdas || 0).toString().replace('.', ',')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Pagination Atenuacoes */}
              {sortedAtenuacoes.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Página {pageAtenuacoes} de {Math.ceil(sortedAtenuacoes.length / ITEMS_PER_PAGE)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setPageAtenuacoes(prev => Math.max(1, prev - 1))}
                      disabled={pageAtenuacoes === 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={14} className="text-slate-600" />
                    </button>
                    <button 
                      onClick={() => setPageAtenuacoes(prev => Math.min(Math.ceil(sortedAtenuacoes.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={pageAtenuacoes === Math.ceil(sortedAtenuacoes.length / ITEMS_PER_PAGE)}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={14} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Atenuacoes e Ganhos Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 text-sm">Performance histórica de atenuações vs ganhos</h3>
          <div className="h-64">
            {hasAtenuacoesGanhosTimelineData ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={atenuacoesGanhosTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis 
                    fontSize={10} 
                    tickFormatter={(value) => `${value} dB`} 
                    domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax * 1.5))]}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [`${(Number(value) || 0).toFixed(1)} dB`, name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="atenuacoes" fill="#ef4444" radius={[4, 4, 0, 0]} name="Total de perdas">
                    <LabelList dataKey="atenuacoes" position="insideTop" fill="#fff" fontSize={10} offset={5} formatter={(v: any) => (!v || v === 0) ? '' : `${v.toString().replace('.', ',')} dB`} />
                  </Bar>
                  <Line type="monotone" dataKey="ganhos" stroke="#3b82f6" strokeWidth={2} name="Total de ganhos" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}>
                    <LabelList dataKey="ganhos" position="top" fontSize={10} offset={12} formatter={(v: any) => (!v || v === 0) ? '' : `${(Number(v) || 0).toFixed(1).replace('.', ',')} dB`} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">
                Sem dados para serem exibidos
              </div>
            )}
          </div>
        </div>

        {/* Ganhos Donut + Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            Classificação das atuações realizadas:
          </h3>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-[40%] border-r border-slate-100 pr-0 md:pr-6 flex flex-col justify-center py-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 text-center md:text-left">Categorias de atuação</p>
              
              {hasAtuacoesTipoData ? (
                <div className="space-y-6">
                  {/* Linear Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Distribuição proporcional</span>
                      <span className="text-[10px] font-medium text-slate-400 italic">Total: {stats?.totalAtuacoes || 0}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      {atuacoesTipoData.map((item, idx) => (
                        <div 
                          key={idx}
                          className="h-full transition-all duration-500 ease-out"
                          style={{ 
                            width: `${(item.value / (stats?.totalAtuacoes || 1)) * 100}%`,
                            backgroundColor: ATUACOES_COLORS[idx % ATUACOES_COLORS.length] 
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Detail Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {atuacoesTipoData.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: ATUACOES_COLORS[idx % ATUACOES_COLORS.length] }} 
                          />
                          <span className="text-[9px] font-bold text-slate-400 truncate max-w-[80px]">{item.name}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-slate-800">{item.value}</span>
                          <span className="text-[8px] text-slate-400 font-medium">un</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-400 text-xs font-medium italic text-center border-2 border-dashed border-slate-100 rounded-xl">
                  Sem dados de atuações
                </div>
              )}
            </div>
            <div className="w-full md:w-[60%]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Desempenho por trecho de atuação</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="p-2 text-left">Trecho</th>
                    <th 
                      className="p-2 text-right cursor-pointer hover:bg-slate-200 transition-colors group"
                      onClick={() => setSortAtuacoes(prev => prev === 'desc' ? 'asc' : 'desc')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        (dB)
                        <ArrowUpDown size={12} className={cn("transition-colors", sortAtuacoes ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedAtuacoesTable.slice((pageAtuacoes - 1) * ITEMS_PER_PAGE, pageAtuacoes * ITEMS_PER_PAGE).map((a, i) => (
                    <tr key={i}>
                      <td className="p-2 text-slate-600 font-medium">{a.trecho}</td>
                      <td className="p-2 text-right font-bold text-slate-800 whitespace-nowrap">
                        {((a.tipoChamado || "").toUpperCase().trim() === 'TESTES' || (a.tipoChamado || "").toUpperCase().trim() === 'TESTE') ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 bg-teal-100 text-teal-700 rounded-full text-[10px]" title="Chamado de Teste">T</span>
                        ) : (
                          (a.totalGanhos || 0).toString().replace('.', ',')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Atuacoes */}
              {sortedAtuacoesTable.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Página {pageAtuacoes} de {Math.ceil(sortedAtuacoesTable.length / ITEMS_PER_PAGE)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setPageAtuacoes(prev => Math.max(1, prev - 1))}
                      disabled={pageAtuacoes === 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={14} className="text-slate-600" />
                    </button>
                    <button 
                      onClick={() => setPageAtuacoes(prev => Math.min(Math.ceil(sortedAtuacoesTable.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={pageAtuacoes === Math.ceil(sortedAtuacoesTable.length / ITEMS_PER_PAGE)}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={14} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Atuacoes e Conclusoes Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Atuações e conclusões:</h3>
          <div className="h-64">
            {hasAtuacoesMotivoData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical" 
                  data={atuacoesMotivoData}
                  margin={{ left: 120 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={10} />
                  <YAxis dataKey="name" type="category" fontSize={10} width={110} />
                  <Tooltip />
                  <Bar dataKey="Total" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="Total" position="right" fontSize={10} offset={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">
                Sem dados para serem exibidos
              </div>
            )}
          </div>
        </div>

        {/* Tabela dos chamados */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="font-bold text-slate-800 mb-4">Tabela dos chamados:</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="p-2 w-8"></th>
                  <th className="p-2">Data</th>
                  <th className="p-2">ID</th>
                  <th className="p-2">Trecho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData?.atenuacoes.slice((pageTabelaChamados - 1) * ITEMS_PER_PAGE, pageTabelaChamados * ITEMS_PER_PAGE).map((a, i) => {
                  const isTeste = (a.tipoChamado || "").toUpperCase().trim() === 'TESTES' || (a.tipoChamado || "").toUpperCase().trim() === 'TESTE';
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2">
                        {isTeste ? (
                          <span className="flex items-center justify-center w-5 h-5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold" title="Teste">T</span>
                        ) : (
                          <span className="flex items-center justify-center w-5 h-5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold" title="Atenuação">A</span>
                        )}
                      </td>
                      <td className="p-2 text-slate-600">{a.dataAbertura}</td>
                      <td className="p-2 text-slate-600">{a.idImoc}</td>
                      <td className="p-2 text-slate-800 font-medium">
                        {a.trecho}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Tabela Chamados */}
          {filteredData?.atenuacoes && filteredData.atenuacoes.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-[10px] text-slate-400 font-medium">
                Página {pageTabelaChamados} de {Math.ceil(filteredData.atenuacoes.length / ITEMS_PER_PAGE)}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setPageTabelaChamados(prev => Math.max(1, prev - 1))}
                  disabled={pageTabelaChamados === 1}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} className="text-slate-600" />
                </button>
                <button 
                  onClick={() => setPageTabelaChamados(prev => Math.min(Math.ceil(filteredData.atenuacoes.length / ITEMS_PER_PAGE), prev + 1))}
                  disabled={pageTabelaChamados === Math.ceil(filteredData.atenuacoes.length / ITEMS_PER_PAGE)}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} className="text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Empresas que atuaram */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Empresas que atuaram:</h3>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="p-2">Empresa</th>
                <th className="p-2 text-right">Quantidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empresasAtuaramData.slice((pageEmpresas - 1) * ITEMS_PER_PAGE, pageEmpresas * ITEMS_PER_PAGE).map(([name, value], i) => (
                <tr 
                  key={i} 
                  className={cn(
                    "hover:bg-slate-50 cursor-pointer transition-colors",
                    selectedCompany === name ? "bg-teal-50" : ""
                  )}
                  onClick={() => setSelectedCompany(selectedCompany === name ? null : name)}
                >
                  <td className={cn(
                    "p-2 font-medium",
                    selectedCompany === name ? "text-teal-700 font-bold" : "text-slate-800"
                  )}>
                    {name}
                  </td>
                  <td className="p-2 text-right text-slate-600">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Empresas */}
          {empresasAtuaramData.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-[10px] text-slate-400 font-medium">
                Página {pageEmpresas} de {Math.ceil(empresasAtuaramData.length / ITEMS_PER_PAGE)}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setPageEmpresas(prev => Math.max(1, prev - 1))}
                  disabled={pageEmpresas === 1}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} className="text-slate-600" />
                </button>
                <button 
                  onClick={() => setPageEmpresas(prev => Math.min(Math.ceil(empresasAtuaramData.length / ITEMS_PER_PAGE), prev + 1))}
                  disabled={pageEmpresas === Math.ceil(empresasAtuaramData.length / ITEMS_PER_PAGE)}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} className="text-slate-600" />
                </button>
              </div>
            </div>
          )}

          {selectedCompany && (
            <div className="mt-4 text-[10px] text-slate-400 italic">
              * Filtrando dados para a empresa <strong>{selectedCompany}</strong>. Clique novamente para limpar.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
