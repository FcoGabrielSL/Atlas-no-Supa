import React, { useMemo, useState, useEffect } from "react";
import { ChevronRight, Calendar, ArrowUpDown, ChevronLeft, RefreshCw, BarChart2, CheckCircle2, TrendingUp, Sparkles, Building2, Ticket } from "lucide-react";
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
  Line,
  Legend,
  LabelList
} from "recharts";
import { motion } from "motion/react";
import { DashboardData } from "../types";
import { cn } from "../lib/utils";

interface RelatorioSemanalProps {
  data: DashboardData;
  stats?: any;
  searchTerm?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const ATENUACOES_COLORS = ["#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2"];
const ATUACOES_COLORS = ["#FF5022", "#2563eb", "#1E1E1E", "#0284c7", "#64748b"];

const parseDate = (dStr: string | undefined): Date | null => {
  if (!dStr) return null;
  const dStrClean = String(dStr).trim();
  if (dStrClean.includes("/")) {
    const parts = dStrClean.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, day);
      }
    }
  }
  if (dStrClean.includes("-")) {
    const cleanStr = dStrClean.split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month - 1, day);
        }
      } else {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month - 1, day);
        }
      }
    }
  }
  const d = new Date(dStrClean);
  if (!isNaN(d.getTime())) return d;
  return null;
};

const checkDateInRange = (
  dateStr: string, 
  selectedPeriod: number | "custom", 
  customRange: { start: string; end: string }
): boolean => {
  if (selectedPeriod === 0) return true; // All time
  if (!dateStr) return false;
  const date = parseDate(dateStr);
  if (!date || isNaN(date.getTime())) return false;

  if (selectedPeriod === "custom") {
    if (!customRange.start && !customRange.end) return true;
    const start = customRange.start ? parseDate(customRange.start) : null;
    const end = customRange.end ? parseDate(customRange.end) : null;
    
    if (start && date < start) return false;
    if (end) {
      const endInclusive = new Date(end);
      endInclusive.setHours(23, 59, 59, 999);
      if (date > endInclusive) return false;
    }
    return true;
  }

  const today = new Date();
  if (selectedPeriod === 1) {
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= (selectedPeriod as number);
};

interface PioraItem {
  data: string;
  db: number;
  descricao: string;
}

const parsePiorasFromItem = (detalhamento?: string, piorasField?: string): PioraItem[] => {
  const pioras: PioraItem[] = [];
  const pioraRegex = /Piora:\s*\[\s*([^,\]]+)\s*,\s*([\d.,]+)\s*dB\s*,\s*([^\]]*)\s*\]/gi;
  let pMatch;
  
  if (detalhamento) {
    while ((pMatch = pioraRegex.exec(detalhamento)) !== null) {
      pioras.push({
        data: pMatch[1]?.trim() || '',
        db: parseFloat(pMatch[2]?.replace(',', '.') || '0'),
        descricao: pMatch[3]?.trim() || ''
      });
    }
  }
  
  if (piorasField) {
    const parts = piorasField.split(" | ");
    for (const part of parts) {
      if (!part.trim()) continue;
      const pRegex = /Piora:\s*\[\s*([^,\]]+)\s*,\s*([\d.,]+)\s*dB\s*,\s*([^\]]*)\s*\]/i;
      const match = pRegex.exec(part);
      if (match) {
        pioras.push({
          data: match[1]?.trim() || '',
          db: parseFloat(match[2]?.replace(',', '.') || '0'),
          descricao: match[3]?.trim() || ''
        });
      } else {
        // Fallback for non-matching strings (might not have dB value, so db = 0)
        let data = '';
        let descricao = part.trim();
        const dateMatch = part.match(/^\[([^\]]+)\]/);
        if (dateMatch) {
          data = dateMatch[1];
          descricao = part.replace(/^\[([^\]]+)\]\s*(?:-\s*)?/, '').trim();
        }
        pioras.push({
          data,
          db: 0,
          descricao
        });
      }
    }
  }
  return pioras;
};

const matchesSearch = (a: any, term: string) => {
  if (!term) return true;
  const rede = a.rede || "";
  const trecho = a.trecho || "";
  const status = a.status || "";
  return String(rede).toLowerCase().includes(term.toLowerCase()) ||
         String(trecho).toLowerCase().includes(term.toLowerCase()) ||
         String(status).toLowerCase().includes(term.toLowerCase());
};

export default function RelatorioSemanal({ data, searchTerm = "", onRefresh, isLoading = false }: RelatorioSemanalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number | "custom">(7); // Default to last 7 days
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Sorting states
  const [sortAtenuacoes, setSortAtenuacoes] = useState<"asc" | "desc" | null>(null);
  const [sortAtuacoes, setSortAtuacoes] = useState<"asc" | "desc" | null>(null);
  
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
    try {
      if (!data) return { atenuacoes: [], atuacoes: [], atenuacoesFinalizadas: [] };
      
      const now = new Date();
      const referenceDate = now;
      
      const filterByDate = (dateStr: string) => {
        if (selectedPeriod === 0) return true; // All time
        if (!dateStr) return false;
        const date = parseDate(dateStr);
        if (!date || isNaN(date.getTime())) return false;

        if (selectedPeriod === "custom") {
          if (!customRange.start && !customRange.end) return true;
          const start = customRange.start ? parseDate(customRange.start) : null;
          const end = customRange.end ? parseDate(customRange.end) : null;
          
          if (start && date < start) return false;
          if (end) {
            const endInclusive = new Date(end);
            endInclusive.setHours(23, 59, 59, 999);
            if (date > endInclusive) return false;
          }
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

      const filteredAtuacoes = (data.atuacoes || []).filter(a => {
        if (!a) return false;
        const dateMatch = filterByDate(a.dataAbertura);
        const companyVal = a.empresas || "";
        const companyMatch = !selectedCompany || companyVal === selectedCompany;
        
        const rede = a.rede || "";
        const trecho = a.trecho || "";
        const term = searchTerm || "";
        
        const searchMatch = !term || 
          String(rede).toLowerCase().includes(term.toLowerCase()) ||
          String(trecho).toLowerCase().includes(term.toLowerCase()) ||
          String(companyVal).toLowerCase().includes(term.toLowerCase());
        return dateMatch && companyMatch && searchMatch;
      });

      const filteredAtenuacoes = (data.atenuacoes || []).filter(a => {
        if (!a) return false;
        const dateMatch = filterByDate(a.dataAbertura);
        
        // Check if there is any piora in the period
        let hasPioraInPeriod = false;
        const pioras = parsePiorasFromItem(a.detalhamento, a.pioras);
        for (const p of pioras) {
          if (p.data && filterByDate(p.data)) {
            hasPioraInPeriod = true;
            break;
          }
        }

        const rede = a.rede || "";
        const trecho = a.trecho || "";
        const status = a.status || "";
        const term = searchTerm || "";
        
        const searchMatch = !term || 
          String(rede).toLowerCase().includes(term.toLowerCase()) ||
          String(trecho).toLowerCase().includes(term.toLowerCase()) ||
          String(status).toLowerCase().includes(term.toLowerCase());
        return (dateMatch || hasPioraInPeriod) && searchMatch;
      });

      const filteredAtenuacoesFinalizadas = (data.atenuacoes || []).filter(a => {
        if (!a) return false;
        const status = String(a.status || "").toUpperCase();
        if (status !== "CONCLUÍDO" && status !== "FECHADO" && status !== "CONCLUIDO") return false;
        const dateMatch = filterByDate(a.dataConclusao || a.dataAbertura); // fallback to open date
        const rede = a.rede || "";
        const trecho = a.trecho || "";
        const term = searchTerm || "";
        
        const searchMatch = !term || 
          String(rede).toLowerCase().includes(term.toLowerCase()) ||
          String(trecho).toLowerCase().includes(term.toLowerCase());
        return dateMatch && searchMatch;
      });

      return {
        atenuacoes: filteredAtenuacoes,
        atenuacoesFinalizadas: filteredAtenuacoesFinalizadas,
        atuacoes: filteredAtuacoes
      };
    } catch (e) {
      console.error("Error in filteredData useMemo", e);
      return { atenuacoes: [], atuacoes: [], atenuacoesFinalizadas: [] };
    }
  }, [data, selectedPeriod, customRange, selectedCompany, searchTerm]);

  // Chart Data Calculations
  const atenuacoesSummaryData = useMemo(() => {
    try {
      if (!filteredData?.atenuacoes) return { chart: [], total: 0, open: 0, resolved: 0 };
      
      const testCalls = filteredData.atenuacoes.filter(a => {
        if (!a) return false;
        const type = (a.tipoChamado || "").toUpperCase().trim();
        return type === "TESTES" || type === "TESTE";
      });
      
      const open = testCalls.filter(a => (a.status || "").toUpperCase() !== "CONCLUÍDO" && (a.status || "").toUpperCase() !== "FECHADO").length;
      const resolved = testCalls.length - open;

      return {
        chart: [
          { name: "Abertos", value: open, color: "#ef4444" },
          { name: "Finalizados", value: resolved, color: "#4f46e5" }
        ],
        total: testCalls.length,
        open,
        resolved
      };
    } catch (e) {
      console.error("Error in atenuacoesSummaryData useMemo", e);
      return { chart: [], total: 0, open: 0, resolved: 0 };
    }
  }, [filteredData]);

  const hasAtenuacoesSummaryData = atenuacoesSummaryData.total > 0;

  const piorasInPeriod = useMemo(() => {
    try {
      if (!data?.atenuacoes) return [];
      const result: { data: string; db: number; descricao: string; parsedDate: Date; ticketId: string }[] = [];
      
      data.atenuacoes.forEach(a => {
        if (!a) return;
        // Apply search filter if there is one
        if (!matchesSearch(a, searchTerm)) return;

        const pioras = parsePiorasFromItem(a.detalhamento, a.pioras);
        pioras.forEach(p => {
          if (!p.data) return;
          const parsed = parseDate(p.data);
          if (parsed && !isNaN(parsed.getTime())) {
            const isInRange = checkDateInRange(p.data, selectedPeriod, customRange);
            if (isInRange) {
              result.push({
                ...p,
                parsedDate: parsed,
                ticketId: a.idImoc || ''
              });
            }
          }
        });
      });
      return result;
    } catch (e) {
      console.error("Error in piorasInPeriod useMemo", e);
      return [];
    }
  }, [data, selectedPeriod, customRange, searchTerm]);

  const formatDateBR = (dStr: string | undefined): string => {
    if (!dStr) return "";
    const parsed = parseDate(dStr);
    if (!parsed || isNaN(parsed.getTime())) return String(dStr);
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const historicoPeriodo = useMemo(() => {
    try {
      const list: {
        tipo: "A" | "T" | "P";
        data: string;
        dataObj: Date;
        idImoc: string;
        trecho: string;
      }[] = [];

      // Add atenuacoes opening in period
      filteredData?.atenuacoes?.forEach(a => {
        if (!a) return;
        if (a.dataAbertura && checkDateInRange(a.dataAbertura, selectedPeriod, customRange)) {
          const isTeste = (a.tipoChamado || "").toUpperCase().trim() === "TESTES" || (a.tipoChamado || "").toUpperCase().trim() === "TESTE";
          const parsed = parseDate(a.dataAbertura);
          if (parsed && !isNaN(parsed.getTime())) {
            list.push({
              tipo: isTeste ? "T" : "A",
              data: a.dataAbertura,
              dataObj: parsed,
              idImoc: a.idImoc || "",
              trecho: a.trecho || ""
            });
          }
        }
      });

      // Add pioras in period
      piorasInPeriod.forEach(p => {
        const atenuacaoObj = data?.atenuacoes?.find(a => a && a.idImoc === p.ticketId);
        list.push({
          tipo: "P",
          data: p.data,
          dataObj: p.parsedDate,
          idImoc: p.ticketId,
          trecho: atenuacaoObj?.trecho || ""
        });
      });

      // Sort by date descending
      return list.sort((a, b) => b.dataObj.getTime() - a.dataObj.getTime());
    } catch (e) {
      console.error("Error calculating historicoPeriodo", e);
      return [];
    }
  }, [filteredData, piorasInPeriod, data, selectedPeriod, customRange]);

  const getAtenuacaoLossInPeriod = (a: any) => {
    if (!a) return 0;
    let sum = 0;
    if (a.dataAbertura && checkDateInRange(a.dataAbertura, selectedPeriod, customRange)) {
      sum += Number(a.perdas) || 0;
    }
    const pioras = parsePiorasFromItem(a.detalhamento, a.pioras);
    pioras.forEach(p => {
      if (p.data && checkDateInRange(p.data, selectedPeriod, customRange)) {
        sum += Number(p.db) || 0;
      }
    });
    return sum;
  };

  const atenuacoesGanhosTimelineData = useMemo(() => {
    try {
      const days: Record<string, { name: string, atenuacoes: number, ganhos: number }> = {};
      const now = new Date();
      
      let startDate: Date;
      let endDate: Date = now;

      if (selectedPeriod === "custom") {
        startDate = customRange.start ? new Date(customRange.start + "T00:00:00") : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = customRange.end ? new Date(customRange.end + "T23:59:59") : now;
      } else if (selectedPeriod === 0) {
        const allDates = [
          ...(data?.atenuacoes || []).map(a => a?.dataAbertura),
          ...(data?.atuacoes || []).map(a => a?.dataAbertura)
        ].filter(Boolean).map(parseDate).filter((d): d is Date => d !== null && !isNaN(d.getTime()));
        
        startDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : now;
      } else {
        const daysBack = typeof selectedPeriod === "number" ? selectedPeriod : 7;
        startDate = new Date(now.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);
      }

      const tempDate = new Date(startDate);
      tempDate.setHours(0, 0, 0, 0);
      const finalDate = new Date(endDate);
      finalDate.setHours(23, 59, 59, 999);

      let loopCounter = 0;
      while (tempDate <= finalDate) {
        if (loopCounter > 366) {
          // Safe fuse: prevent freezing the browser thread if max and min dates are years apart
          break;
        }
        const dayStr = tempDate.toLocaleDateString("pt-BR");
        days[dayStr] = { name: dayStr, atenuacoes: 0, ganhos: 0 };
        tempDate.setDate(tempDate.getDate() + 1);
        loopCounter++;
      }
      
      filteredData?.atenuacoes?.forEach(a => {
        if (!a || !a.dataAbertura) return;
        const parsed = parseDate(a.dataAbertura);
        if (!parsed) return;
        const dayStr = parsed.toLocaleDateString("pt-BR");
        if (days[dayStr]) {
          days[dayStr].atenuacoes += Number(a.perdas) || 0;
        }
      });

      piorasInPeriod.forEach(p => {
        const dayStr = p.parsedDate.toLocaleDateString("pt-BR");
        if (days[dayStr]) {
          days[dayStr].atenuacoes += Number(p.db) || 0;
        }
      });

      filteredData?.atuacoes?.forEach(a => {
        if (!a || !a.dataAbertura) return;
        const parsed = parseDate(a.dataAbertura);
        if (!parsed) return;
        const dayStr = parsed.toLocaleDateString("pt-BR");
        if (days[dayStr]) {
          days[dayStr].ganhos += Number(a.totalGanhos) || 0;
        }
      });
      
      return Object.values(days).sort((a, b) => {
        const dateA = parseDate(a.name) || new Date(0);
        const dateB = parseDate(b.name) || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });
    } catch (e) {
      console.error("Error in atenuacoesGanhosTimelineData", e);
      return [];
    }
  }, [data, filteredData, selectedPeriod, customRange, piorasInPeriod]);

  const hasAtenuacoesGanhosTimelineData = atenuacoesGanhosTimelineData.length > 0;

  const maxChartDbValue = useMemo(() => {
    try {
      if (!atenuacoesGanhosTimelineData || atenuacoesGanhosTimelineData.length === 0) return 5;
      let maxVal = 0;
      atenuacoesGanhosTimelineData.forEach(item => {
        const valA = Number(item.atenuacoes) || 0;
        const valG = Number(item.ganhos) || 0;
        if (valA > maxVal) maxVal = valA;
        if (valG > maxVal) maxVal = valG;
      });
      return Math.max(5, Math.ceil(maxVal * 1.3));
    } catch (e) {
      console.error("Error calculating maxChartDbValue", e);
      return 10;
    }
  }, [atenuacoesGanhosTimelineData]);

  const atuacoesTipoData = useMemo(() => {
    try {
      const counts: Record<string, number> = {};
      filteredData?.atuacoes?.forEach(a => {
        if (!a) return;
        const type = (a.tipoChamado || "").toUpperCase();
        let label = (type === "POS ROMPIMENTO" || type === "PÓS ROMPIMENTO") ? "Pós rompimento" : 
                     type === "TRECHO" ? "Trecho" : a.tipoChamado;
        label = label?.trim() || "Não Informado";
        counts[label] = (counts[label] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    } catch (e) {
      console.error("Error in atuacoesTipoData", e);
      return [];
    }
  }, [filteredData]);

  const hasAtuacoesTipoData = atuacoesTipoData.length > 0;

  const atuacoesMotivoData = useMemo(() => {
    try {
      const counts: Record<string, number> = {};
      filteredData?.atuacoes?.forEach(a => {
        if (!a) return;
        const raw = (a.motivo || "").toLowerCase().trim();
        if (raw) {
          const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
          counts[formatted] = (counts[formatted] || 0) + 1;
        }
      });
      return Object.entries(counts).map(([name, value]) => ({ name, Total: value }));
    } catch (e) {
      console.error("Error in atuacoesMotivoData", e);
      return [];
    }
  }, [filteredData]);

  const hasAtuacoesMotivoData = atuacoesMotivoData.length > 0;

  const empresasAtuaramData = useMemo(() => {
    try {
      if (!data) return [];
      
      const countsInPeriod: Record<string, number> = {};
      (data?.atuacoes || []).forEach(a => {
        if (!a) return;
        const date = parseDate(a.dataAbertura);
        if (!date) return;
        
        let dateMatch = false;
        const refDate = new Date();
        
        if (selectedPeriod === "custom") {
          const start = customRange.start ? new Date(customRange.start + "T00:00:00") : null;
          const end = customRange.end ? new Date(customRange.end + "T23:59:59") : null;
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

        if (dateMatch && a.empresas) {
          countsInPeriod[a.empresas] = (countsInPeriod[a.empresas] || 0) + 1;
        }
      });

      return Object.entries(countsInPeriod).sort((a, b) => b[1] - a[1]);
    } catch (e) {
      console.error("Error in empresasAtuaramData", e);
      return [];
    }
  }, [data, selectedPeriod, customRange]);

  const sortedAtenuacoes = useMemo(() => {
    try {
      if (!filteredData) return [];
      const items = [...filteredData.atenuacoes];
      if (sortAtenuacoes === "asc") {
        return items.sort((a, b) => getAtenuacaoLossInPeriod(a) - getAtenuacaoLossInPeriod(b));
      } else if (sortAtenuacoes === "desc") {
        return items.sort((a, b) => getAtenuacaoLossInPeriod(b) - getAtenuacaoLossInPeriod(a));
      }
      return items;
    } catch (e) {
      console.error("Error in sortedAtenuacoes", e);
      return [];
    }
  }, [filteredData, sortAtenuacoes, selectedPeriod, customRange]);

  const sortedAtuacoesTable = useMemo(() => {
    try {
      if (!filteredData) return [];
      const items = [...filteredData.atuacoes];
      if (sortAtuacoes === "asc") {
        return items.sort((a, b) => (Number(a.totalGanhos) || 0) - (Number(b.totalGanhos) || 0));
      } else if (sortAtuacoes === "desc") {
        return items.sort((a, b) => (Number(b.totalGanhos) || 0) - (Number(a.totalGanhos) || 0));
      }
      return items;
    } catch (e) {
      console.error("Error in sortedAtuacoesTable", e);
      return [];
    }
  }, [filteredData, sortAtuacoes]);

  // Financial/KPI calculations
  const stats = useMemo(() => {
    try {
      if (!filteredData) return { totalPerdas: 0, totalGanhos: 0, totalAtenuacoes: 0, abertas: 0, fechadas: 0, totalAtuacoes: 0 };
      const basePerdas = filteredData.atenuacoes.reduce((acc, curr) => {
        if (curr?.dataAbertura && checkDateInRange(curr.dataAbertura, selectedPeriod, customRange)) {
          return acc + (Number(curr?.perdas) || 0);
        }
        return acc;
      }, 0);
      const sumPioras = piorasInPeriod.reduce((acc, curr) => acc + (Number(curr?.db) || 0), 0);
      const totalPerdas = basePerdas + sumPioras;

      const totalGanhos = filteredData.atuacoes.reduce((acc, curr) => acc + (Number(curr?.totalGanhos) || 0), 0);
      
      const totalAtenuacoes = filteredData.atenuacoes.filter(curr => 
        curr?.dataAbertura && checkDateInRange(curr.dataAbertura, selectedPeriod, customRange)
      ).length;

      const abertas = filteredData.atenuacoes.filter(a => 
        a && 
        (a.status || "").toUpperCase() !== "CONCLUÍDO" && 
        (a.status || "").toUpperCase() !== "FECHADO" &&
        a.dataAbertura && 
        checkDateInRange(a.dataAbertura, selectedPeriod, customRange)
      ).length;

      const fechadas = filteredData.atenuacoesFinalizadas.length;
      const totalAtuacoes = filteredData.atuacoes.length;
      
      return {
        totalPerdas,
        totalGanhos,
        totalAtenuacoes,
        abertas,
        fechadas,
        totalAtuacoes
      };
    } catch (e) {
      console.error("Error in stats useMemo", e);
      return { totalPerdas: 0, totalGanhos: 0, totalAtenuacoes: 0, abertas: 0, fechadas: 0, totalAtuacoes: 0 };
    }
  }, [filteredData, selectedPeriod, customRange, piorasInPeriod]);

  const statsBreakdown = useMemo(() => {
    try {
      if (!filteredData) return { total: [], abertos: [], fechados: [], atuacoes: [] };
      
      const getBreakdown = (items: any[]) => {
        const counts: Record<string, number> = {};
        items.forEach(a => {
          if (!a) return;
          const type = (a.tipoChamado || "").toUpperCase();
          let label = (type === "POS ROMPIMENTO" || type === "PÓS ROMPIMENTO") ? "Pós rompimento" : 
                       type === "TRECHO" ? "Trecho" : a.tipoChamado;
          label = label?.trim() || "Outros";
          counts[label] = (counts[label] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      };

      const allItems = (filteredData.atenuacoes || []).filter(curr => 
        curr?.dataAbertura && checkDateInRange(curr.dataAbertura, selectedPeriod, customRange)
      );
      const abertosItems = allItems.filter(a => a && (a.status || "").toUpperCase() !== "CONCLUÍDO" && (a.status || "").toUpperCase() !== "FECHADO");
      const fechadosItems = filteredData.atenuacoesFinalizadas || [];

      return {
        total: getBreakdown(allItems),
        abertos: getBreakdown(abertosItems),
        fechados: getBreakdown(fechadosItems),
        atuacoes: getBreakdown(filteredData.atuacoes || [])
      };
    } catch (e) {
      console.error("Error in statsBreakdown", e);
      return { total: [], abertos: [], fechados: [], atuacoes: [] };
    }
  }, [filteredData, selectedPeriod, customRange]);

  const globalOpenStats = useMemo(() => {
    try {
      if (!data) return { total: 0, breakdown: "" };
      
      const openTickets = (data?.atenuacoes || []).filter(a => {
        if (!a) return false;
        const isAberto = (a.status || "").toUpperCase() !== "CONCLUÍDO" && (a.status || "").toUpperCase() !== "FECHADO";
        const type = (a.tipoChamado || "").toUpperCase().trim();
        const isTeste = type === "TESTES" || type === "TESTE";
        return isAberto && !isTeste;
      });
      const total = openTickets.length;
      
      const counts: Record<string, number> = {};
      openTickets.forEach(a => {
        if (!a) return;
        const type = (a.tipoChamado || "").toUpperCase();
        let label = (type === "POS ROMPIMENTO" || type === "PÓS ROMPIMENTO") ? "pós rompimento" : 
                     type === "TRECHO" ? "trecho" : a.tipoChamado;
        label = label?.trim().toLowerCase() || "não informado";
        counts[label] = (counts[label] || 0) + 1;
      });

      const breakdownStr = Object.entries(counts)
        .map(([name, value]) => `${value} ${name}`)
        .join(" | ");

      return { total, breakdown: total > 0 ? `( ${breakdownStr} )` : "" };
    } catch (e) {
      console.error("Error in globalOpenStats", e);
      return { total: 0, breakdown: "" };
    }
  }, [data]);

  const periods = [
    { label: "Hoje", value: 1 },
    { label: "Últimos 7 dias", value: 7 },
    { label: "Últimos 15 dias", value: 15 },
    { label: "Últimos 30 dias", value: 30 },
    { label: "Todo o período", value: 0 },
    { label: "Personalizado", value: "custom" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Top Header Card — Adapted strictly to the soft light theme */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs relative">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-[#FF5022]/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-wrap items-center gap-4 text-slate-800">
          <div className="p-2.5 bg-[#FFF5F2] text-[#FF5022] rounded-xl border border-[#FFD1C5]">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight font-sans text-slate-900">Relatório Periódico</h2>
            <p className="text-xs text-slate-500">Indicadores consolidados de atenuações, saldo de potência em dB e atuações de rede.</p>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-2 text-xs font-bold font-sans text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 self-center">
            <span className="w-2 h-2 bg-[#FF5022] rounded-full animate-pulse"></span>
            Abertos: <strong className="text-[#FF5022] font-extrabold">{globalOpenStats.total}</strong>
            {globalOpenStats.breakdown && (
              <span className="text-[10px] text-slate-400 font-medium pl-1 hidden lg:inline">
                {globalOpenStats.breakdown}
              </span>
            )}
          </div>
        </div>
        
        <div className="relative flex items-center gap-2 w-full md:w-auto">
          {selectedCompany && (
            <button 
              onClick={() => setSelectedCompany(null)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Building2 className="w-3.5 h-3.5" />
              Empresa: {selectedCompany} ✕
            </button>
          )}
          
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Calendar size={14} className="text-slate-500" />
              <span>
                {periods.find(p => p.value === selectedPeriod)?.label || "Selecionar período"}
              </span>
              <ChevronRight size={14} className={cn("transition-transform text-slate-400", isDropdownOpen ? "rotate-90" : "")} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-slate-250 py-2.5 z-50 text-slate-800">
                {periods.map((period) => (
                  <button
                    key={period.value}
                    onClick={() => {
                      setSelectedPeriod(period.value as any);
                      if (period.value !== "custom") {
                        setIsDropdownOpen(false);
                      }
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${
                      selectedPeriod === period.value ? "font-bold text-[#FF5022] bg-[#FFF5F2]" : "text-slate-600"
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
                
                {selectedPeriod === "custom" && (
                  <div className="px-4 py-3 border-t border-slate-100 mt-2 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Início</label>
                      <input 
                        type="date" 
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-[#FF5022] outline-none"
                        value={customRange.start}
                        onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label>
                      <input 
                        type="date" 
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-[#FF5022] outline-none"
                        value={customRange.end}
                        onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                      />
                    </div>
                    <button 
                      onClick={() => setIsDropdownOpen(false)}
                      className="w-full bg-[#FF5022] hover:bg-[#e0451a] text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Aplicar Filtro
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {onRefresh && (
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              title="Sincronizar dados"
              className="flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-300 p-2.5 rounded-xl transition cursor-pointer text-slate-600 hover:text-slate-900 shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#FF5022]" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Row — Minimalist design aligned with Brisanet Design System */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Resumo de Potência */}
        {(() => {
          const saldo = Number(((stats?.totalGanhos || 0) - (stats?.totalPerdas || 0)).toFixed(1));
          let saldoColor = "text-[#1E1E1E]";
          let saldoPrefix = "";
          let formattedSaldo = "0,0";

          if (saldo > 0) {
            saldoColor = "text-green-600";
            saldoPrefix = "+";
            formattedSaldo = saldo.toFixed(1).replace(".", ",");
          } else if (saldo < 0) {
            saldoColor = "text-[#FF5022]";
            saldoPrefix = "-";
            formattedSaldo = Math.abs(saldo).toFixed(1).replace(".", ",");
          } else {
            saldoColor = "text-[#1E1E1E]";
            saldoPrefix = "";
            formattedSaldo = "0,0";
          }

          return (
            <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs min-h-44 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition duration-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumo de potência</p>
                  <span className="text-[9px] font-semibold text-slate-400">Saldo líquido real (dB)</span>
                </div>
                <div className="text-right">
                  <h4 className={cn("text-4xl font-extrabold tracking-tighter leading-none font-sans", saldoColor)}>
                    {saldoPrefix}{formattedSaldo}
                  </h4>
                </div>
              </div>
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between py-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-gray-700">Atenuações registradas</span>
                  <span className="text-xs font-bold text-gray-900">-{ (stats?.totalPerdas || 0).toFixed(1).replace(".", ",") } dB</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-gray-700">Atuações e ganhos</span>
                  <span className="text-xs font-bold text-gray-900">+{ (stats?.totalGanhos || 0).toFixed(1).replace(".", ",") } dB</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Card 2: Total de chamados */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs min-h-44 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de chamados</p>
              <span className="text-[9px] font-semibold text-slate-400">Período selecionado</span>
            </div>
            <h4 className="text-4xl font-extrabold text-[#1E1E1E] tracking-tighter leading-none font-sans">{stats?.totalAtenuacoes || 0}</h4>
          </div>
          <div className="mt-auto space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {statsBreakdown.total.length > 0 ? (
              statsBreakdown.total.map((item, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 flex items-center justify-between text-[10px] font-medium">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-bold text-gray-900">{item.value}</span>
                </div>
              ))
            ) : (
              <span className="text-[10px] text-slate-400 italic">Sem chamados</span>
            )}
          </div>
        </div>

        {/* Card 3: Chamados finalizados */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs min-h-44 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chamados Finalizados</p>
              <span className="text-[9px] font-semibold text-slate-400">No período</span>
            </div>
            <h4 className="text-4xl font-extrabold text-[#1E1E1E] tracking-tighter leading-none font-sans">{stats?.fechadas || 0}</h4>
          </div>
          <div className="mt-auto space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {statsBreakdown.fechados.length > 0 ? (
              statsBreakdown.fechados.map((item, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 flex items-center justify-between text-[10px] font-medium">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-bold text-gray-900">{item.value}</span>
                </div>
              ))
            ) : (
              <span className="text-[10px] text-slate-400 italic">Sem conclusões no período</span>
            )}
          </div>
        </div>

        {/* Card 4: Total de atuações */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs min-h-44 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Atuações</p>
              <span className="text-[9px] font-semibold text-slate-400">Marcos de rede</span>
            </div>
            <h4 className="text-4xl font-extrabold text-[#1E1E1E] tracking-tighter leading-none font-sans">{stats?.totalAtuacoes || 0}</h4>
          </div>
          <div className="mt-auto space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {statsBreakdown.atuacoes.length > 0 ? (
              statsBreakdown.atuacoes.map((item, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 flex items-center justify-between text-[10px] font-medium">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-bold text-gray-900">{item.value}</span>
                </div>
              ))
            ) : (
              <span className="text-[10px] text-slate-400 italic">Sem atuações</span>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Column 1: Atenuações / Testes Proporcionais & Tabela Completa */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-1.5 text-sm font-sans">
            <Ticket className="w-4 h-4 text-[#FF5022]" />
            Vistos e Atenuações Técnicas por Trecho
          </h3>
          
          <div className="flex flex-col md:flex-row gap-6 mb-4">
            <div className="w-full md:w-[45%] border-r border-slate-100 pr-0 md:pr-4 flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 block">Chamados de Teste</span>
              
              {hasAtenuacoesSummaryData ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-end text-[10px]">
                      <span className="font-bold text-slate-500">Status comparativo</span>
                      <span className="text-slate-400 italic">Total: {atenuacoesSummaryData.total}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-[#FF5022] transition-all duration-350" 
                        style={{ width: `${atenuacoesSummaryData.total > 0 ? (atenuacoesSummaryData.open / atenuacoesSummaryData.total) * 100 : 0}%` }}
                        title={`Abertos: ${atenuacoesSummaryData.open}`}
                      />
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-350" 
                        style={{ width: `${atenuacoesSummaryData.total > 0 ? (atenuacoesSummaryData.resolved / atenuacoesSummaryData.total) * 100 : 0}%` }}
                        title={`Resolvidos: ${atenuacoesSummaryData.resolved}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#FF5022] shrink-0" />
                        <span className="text-[9px] font-bold text-gray-700 uppercase">Abertos</span>
                      </div>
                      <span className="text-lg font-extrabold text-[#1E1E1E]">{atenuacoesSummaryData.open}</span>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[9px] font-bold text-gray-700 uppercase">Finalizados</span>
                      </div>
                      <span className="text-lg font-extrabold text-[#1E1E1E]">{atenuacoesSummaryData.resolved}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-tight">
                    Dos chamados de teste do período, <strong className="text-[#FF5022] font-extrabold">{Math.round((atenuacoesSummaryData.open / atenuacoesSummaryData.total) * 100) || 0}%</strong> estão pendentes de visto.
                  </p>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-400 text-[11px] font-semibold italic text-center border border-dashed border-slate-200 bg-slate-50/50 rounded-xl px-2">
                  Não houve registros de chamados de testes
                </div>
              )}
            </div>

            <div className="w-full md:w-[55%] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Destaques - Perdas por Trecho</span>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <th className="p-1.5 text-left font-sans">Trecho</th>
                      <th 
                        className="p-1.5 text-right cursor-pointer hover:bg-slate-200 transition-colors group font-sans whitespace-nowrap"
                        onClick={() => setSortAtenuacoes(prev => prev === "desc" ? "asc" : "desc")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          Perdas (dB)
                          <ArrowUpDown size={11} className={cn("transition-colors", sortAtenuacoes ? "text-[#FF5022]" : "text-slate-400")} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sortedAtenuacoes.length > 0 ? (
                      sortedAtenuacoes.slice((pageAtenuacoes - 1) * ITEMS_PER_PAGE, pageAtenuacoes * ITEMS_PER_PAGE).map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-1.5 font-medium truncate max-w-[150px]">{a.trecho}</td>
                          <td className="p-1.5 text-right font-bold text-slate-900 whitespace-nowrap">
                            {((a.tipoChamado || "").toUpperCase().trim() === "TESTES" || (a.tipoChamado || "").toUpperCase().trim() === "TESTE") ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-[10px] font-black" title="Chamado de Teste">T</span>
                            ) : (
                              `${getAtenuacaoLossInPeriod(a).toFixed(2).replace(".", ",")} dB`
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-slate-400 italic">Nenhum registro encontrado</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Atenuacoes */}
              {sortedAtenuacoes.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">
                    {pageAtenuacoes}/{Math.ceil(sortedAtenuacoes.length / ITEMS_PER_PAGE)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setPageAtenuacoes(prev => Math.max(1, prev - 1))}
                      disabled={pageAtenuacoes === 1}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={12} className="text-slate-600" />
                    </button>
                    <button 
                      onClick={() => setPageAtenuacoes(prev => Math.min(Math.ceil(sortedAtenuacoes.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={pageAtenuacoes === Math.ceil(sortedAtenuacoes.length / ITEMS_PER_PAGE)}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={12} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Performance Histórica Atenuações vs Ganhos */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-1.5 text-sm font-sans">
            <TrendingUp className="w-4 h-4 text-[#FF5022]" />
            Performance de Atenuações vs Ganhos (dB)
          </h3>
          <div className="h-60 mt-auto w-full min-w-0" style={{ minHeight: "240px" }}>
            {hasAtenuacoesGanhosTimelineData ? (
              <ResponsiveContainer width="100%" height={240} minWidth={0} debounce={50}>
                <ComposedChart data={atenuacoesGanhosTimelineData}>
                  <defs>
                    <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF5022" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#FF5022" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={9} stroke="#94a3b8" />
                  <YAxis 
                    fontSize={9} 
                    stroke="#94a3b8"
                    tickFormatter={(value) => `${value} dB`} 
                    domain={[0, maxChartDbValue]}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [`${(Number(value) || 0).toFixed(1)} dB`, name]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#1e293b", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                  />
                  <Legend verticalAlign="top" height={32} iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="atenuacoes" fill="#FF5022" radius={[4, 4, 0, 0]} name="Atenuações (dB)" fillOpacity={0.85}>
                    <LabelList 
                      dataKey="atenuacoes" 
                      position="insideTop" 
                      fill="#fff" 
                      fontSize={9} 
                      formatter={(v: any) => {
                        const num = Number(v);
                        if (isNaN(num) || num === 0) return "";
                        return `${num.toString().replace(".", ",")} dB`;
                      }} 
                    />
                  </Bar>
                  <Line type="monotone" dataKey="ganhos" stroke="#2563eb" strokeWidth={2.5} name="Atuações e ganhos (dB)" dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}>
                    <LabelList 
                      dataKey="ganhos" 
                      position="top" 
                      fontSize={9} 
                      offset={12} 
                      formatter={(v: any) => {
                        const num = Number(v);
                        if (isNaN(num) || num === 0) return "";
                        return `${num.toFixed(1).replace(".", ",")} dB`;
                      }} 
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-semibold italic text-[11px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Sem registros suficientes no período
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Classificação das Atuações */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-1.5 text-sm font-sans">
            <Building2 className="w-4 h-4 text-emerald-600" />
            Classificação das Atuações de Rede Realizadas
          </h3>
          
          <div className="flex flex-col md:flex-row gap-6 mb-4">
            <div className="w-full md:w-[45%] border-r border-slate-100 pr-0 md:pr-4 flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Tipos de Atuações</span>
              
              {hasAtuacoesTipoData ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-end text-[10px]">
                      <span className="font-bold text-slate-500">Distribuição</span>
                      <span className="text-slate-400 italic">Total: {stats?.totalAtuacoes || 0}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {atuacoesTipoData.map((item, idx) => (
                        <div 
                          key={idx}
                          className="h-full transition-all duration-300"
                          style={{ 
                            width: `${(stats?.totalAtuacoes && stats.totalAtuacoes > 0) ? (item.value / stats.totalAtuacoes) * 100 : 0}%`,
                            backgroundColor: ATUACOES_COLORS[idx % ATUACOES_COLORS.length] 
                          }}
                          title={`${item.name}: ${item.value}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {atuacoesTipoData.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate max-w-[110px]">
                          <div 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: ATUACOES_COLORS[idx % ATUACOES_COLORS.length] }} 
                          />
                          <span className="text-[9px] font-bold text-slate-500 uppercase truncate">{item.name}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-400 text-[11px] font-semibold italic text-center border border-dashed border-slate-200 bg-slate-50/50 rounded-xl px-2">
                  Não houve atuações no período
                </div>
              )}
            </div>

            <div className="w-full md:w-[55%] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Ganhos de Potência por Trecho</span>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <th className="p-1.5 text-left font-sans">Trecho</th>
                      <th 
                        className="p-1.5 text-right cursor-pointer hover:bg-slate-200 transition-colors group font-sans whitespace-nowrap"
                        onClick={() => setSortAtuacoes(prev => prev === "desc" ? "asc" : "desc")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          Ganhos (dB)
                          <ArrowUpDown size={11} className={cn("transition-colors", sortAtuacoes ? "text-emerald-700" : "text-slate-400")} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sortedAtuacoesTable.length > 0 ? (
                      sortedAtuacoesTable.slice((pageAtuacoes - 1) * ITEMS_PER_PAGE, pageAtuacoes * ITEMS_PER_PAGE).map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-1.5 font-medium truncate max-w-[150px]">{a.trecho}</td>
                          <td className="p-1.5 text-right font-bold text-slate-900 whitespace-nowrap">
                            {`${Number(a.totalGanhos || 0).toFixed(2).replace(".", ",")} dB`}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-slate-400 italic">Sem registros encontrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Atuacoes */}
              {sortedAtuacoesTable.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">
                    {pageAtuacoes}/{Math.ceil(sortedAtuacoesTable.length / ITEMS_PER_PAGE)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setPageAtuacoes(prev => Math.max(1, prev - 1))}
                      disabled={pageAtuacoes === 1}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={12} className="text-slate-600" />
                    </button>
                    <button 
                      onClick={() => setPageAtuacoes(prev => Math.min(Math.ceil(sortedAtuacoesTable.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={pageAtuacoes === Math.ceil(sortedAtuacoesTable.length / ITEMS_PER_PAGE)}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={12} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 4: Motivos das Atuações (Horizontal BarChart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-1.5 text-sm font-sans">
            <Sparkles className="w-4 h-4 text-[#FF5022]" />
            Principais Motivos e Diagnósticos de Atuações
          </h3>
          <div className="h-60 mt-auto w-full min-w-0" style={{ minHeight: "240px" }}>
            {hasAtuacoesMotivoData ? (
              <ResponsiveContainer width="100%" height={240} minWidth={0} debounce={50}>
                <BarChart 
                  layout="vertical" 
                  data={atuacoesMotivoData}
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" fontSize={9} stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" fontSize={9} stroke="#94a3b8" width={90} />
                  <Tooltip 
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#1e293b", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                  />
                  <Bar dataKey="Total" fill="#FF5022" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="Total" position="right" fontSize={9} offset={8} fill="#1e293b" fontStyle="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-semibold italic text-[11px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Sem atuações classificadas no período
              </div>
            )}
          </div>
        </div>

        {/* Column 5: Tabela de Chamados do Período */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5 text-sm font-sans">
              <span className="w-2.5 h-4 bg-[#FF5022] rounded-sm inline-block"></span>
              Histórico Detalhado do Período
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="p-2 w-8">Tipo</th>
                    <th className="p-2">Data</th>
                    <th className="p-2">ID IMOC</th>
                    <th className="p-2">Trecho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {historicoPeriodo && historicoPeriodo.length > 0 ? (
                    historicoPeriodo.slice((pageTabelaChamados - 1) * ITEMS_PER_PAGE, pageTabelaChamados * ITEMS_PER_PAGE).map((item, i) => {
                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2">
                            {item.tipo === "T" ? (
                              <span className="flex items-center justify-center w-5 h-5 bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-[10px] font-black" title="Teste">T</span>
                            ) : item.tipo === "P" ? (
                              <span className="flex items-center justify-center w-5 h-5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-black" title="Piora">P</span>
                            ) : (
                              <span className="flex items-center justify-center w-5 h-5 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-[10px] font-black" title="Atenuação">A</span>
                            )}
                          </td>
                          <td className="p-2 text-slate-500 font-medium whitespace-nowrap">{formatDateBR(item.data)}</td>
                          <td className="p-2 font-mono text-xs">
                            {item.idImoc ? (
                              <a
                                href={`https://saski.brisanet.net.br/chamado/${item.idImoc}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-800 font-medium transition-colors hover:text-[#FF5022] hover:underline cursor-pointer"
                                title={`Abrir chamado #${item.idImoc} no Saski`}
                              >
                                {item.idImoc}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-2 font-medium text-slate-900 truncate max-w-[180px]">{item.trecho}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic">Zero chamados registrados no cronograma</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Tabela Chamados */}
          {historicoPeriodo && historicoPeriodo.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase">
                Página {pageTabelaChamados} de {Math.ceil(historicoPeriodo.length / ITEMS_PER_PAGE)}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setPageTabelaChamados(prev => Math.max(1, prev - 1))}
                  disabled={pageTabelaChamados === 1}
                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={12} className="text-slate-600" />
                </button>
                <button 
                  onClick={() => setPageTabelaChamados(prev => Math.min(Math.ceil(historicoPeriodo.length / ITEMS_PER_PAGE), prev + 1))}
                  disabled={pageTabelaChamados === Math.ceil(historicoPeriodo.length / ITEMS_PER_PAGE)}
                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronRight size={12} className="text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Column 6: Empresas Atuantes e suas atuações */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5 text-sm font-sans">
              <span className="w-2.5 h-4 bg-teal-500 rounded-sm inline-block"></span>
              Atuações de Terceiros e Provedores
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="p-2">Empresa Atuante</th>
                    <th className="p-2 text-right">Qtd Atuações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {empresasAtuaramData.length > 0 ? (
                    empresasAtuaramData.slice((pageEmpresas - 1) * ITEMS_PER_PAGE, pageEmpresas * ITEMS_PER_PAGE).map(([name, value], i) => (
                      <tr 
                        key={i} 
                        className={cn(
                          "hover:bg-slate-50 cursor-pointer transition-colors",
                          selectedCompany === name ? "bg-[#FFF5F2]" : ""
                        )}
                        onClick={() => setSelectedCompany(selectedCompany === name ? null : name)}
                      >
                        <td className={cn(
                          "p-2 font-semibold text-slate-800",
                          selectedCompany === name ? "text-[#FF5022] underline font-extrabold" : ""
                        )}>
                          {name}
                        </td>
                        <td className="p-2 text-right text-slate-505 font-mono font-bold">{value}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-slate-400 italic">Nenhum dado de provedor ativado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {/* Pagination Empresas */}
            {empresasAtuaramData.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase">
                  Página {pageEmpresas} de {Math.ceil(empresasAtuaramData.length / ITEMS_PER_PAGE)}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setPageEmpresas(prev => Math.max(1, prev - 1))}
                    disabled={pageEmpresas === 1}
                    className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={12} className="text-slate-600" />
                  </button>
                  <button 
                    onClick={() => setPageEmpresas(prev => Math.min(Math.ceil(empresasAtuaramData.length / ITEMS_PER_PAGE), prev + 1))}
                    disabled={pageEmpresas === Math.ceil(empresasAtuaramData.length / ITEMS_PER_PAGE)}
                    className="p-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronRight size={12} className="text-slate-600" />
                  </button>
                </div>
              </div>
            )}

            {selectedCompany && (
              <div className="mt-3 text-[10px] text-slate-450 italic bg-amber-50 rounded-lg p-2 border border-amber-100 flex items-center justify-between">
                <span>Filtrando dados para a empresa <strong>{selectedCompany}</strong>.</span>
                <button onClick={() => setSelectedCompany(null)} className="font-bold underline text-amber-800 ml-1">Excluir filtro</button>
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
