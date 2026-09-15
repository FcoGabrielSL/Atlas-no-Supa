import React, { useState, useMemo, useRef } from "react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { 
  FileText, 
  Copy, 
  Check, 
  X, 
  CalendarRange, 
  Clock, 
  Building2, 
  Filter, 
  ChevronRight,
  ChevronDown,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Layers,
  FileSpreadsheet
} from "lucide-react";
import { CamadaOpticaRow } from "../types";

interface RelatorioGerencialCamadaOpticaProps {
  isOpen: boolean;
  onClose: () => void;
  camadaOptica: CamadaOpticaRow[];
  selectedPeriod: string;
  periodStartDate?: string;
  periodEndDate?: string;
  formatRouteTitle: (a: string, b?: string, c?: string, d?: string) => any;
  normalizeStatus: (status: string) => string;
  parseTimelineLogs: (logsStr: string) => any[];
  formatSheetDate: (dateStr: string) => string;
  isDeadlineExpired: (prazo: string, status: string) => boolean;
  onPeriodChange?: (period: string, start?: string, end?: string) => void;
  initialFilterMode?: "todos" | "abertos" | "fechados";
  initialAtasMode?: "todas" | "ultima" | "sem_atas";
}

export const RelatorioGerencialCamadaOptica: React.FC<RelatorioGerencialCamadaOpticaProps> = ({
  isOpen,
  onClose,
  camadaOptica,
  selectedPeriod: initialPeriod,
  periodStartDate: initialStartDate = "",
  periodEndDate: initialEndDate = "",
  formatRouteTitle,
  normalizeStatus,
  parseTimelineLogs,
  formatSheetDate,
  isDeadlineExpired,
  onPeriodChange,
  initialFilterMode = "todos",
  initialAtasMode = "todas",
}) => {
  // Ref para o container do documento a ser convertido em PDF via html2canvas + jsPDF
  const reportDocumentRef = useRef<HTMLDivElement>(null);

  // Estado de carregamento durante a geração do PDF
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Modo de exibição das atas: "todas" | "ultima" | "sem_atas"
  const [atasMode, setAtasMode] = useState<"todas" | "ultima" | "sem_atas">(initialAtasMode || "todas");

  // Estado e referência para o menu Dropdown de geração de relatório
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estado local para permitir refinamento de período sem sair do relatório
  const [period, setPeriod] = useState<string>(initialPeriod || "30dias");
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);

  // Modo de visualização dos blocos: "todos" | "abertos" | "fechados"
  const [filterMode, setFilterMode] = useState<"todos" | "abertos" | "fechados">(initialFilterMode || "todos");
  const [copied, setCopied] = useState<boolean>(false);

  // Fecha o dropdown ao clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  // Sincroniza se as props mudarem
  React.useEffect(() => {
    if (initialPeriod) setPeriod(initialPeriod);
    if (initialStartDate !== undefined) setStartDate(initialStartDate);
    if (initialEndDate !== undefined) setEndDate(initialEndDate);
    if (initialFilterMode) setFilterMode(initialFilterMode);
    if (initialAtasMode) setAtasMode(initialAtasMode);
  }, [initialPeriod, initialStartDate, initialEndDate, initialFilterMode, initialAtasMode, isOpen]);

  // Função para converter strings de data para objeto Date
  const parseDate = (dStr: any): Date | null => {
    if (!dStr) return null;
    const clean = String(dStr).trim();
    if (!clean || clean === "-" || clean === "—" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "a definir") {
      return null;
    }

    // Formato DD/MM/YYYY ou DD-MM-YYYY
    const dmyMatch = clean.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1970 && year < 2100) {
        return new Date(year, month, day);
      }
    }

    // Formato YYYY-MM-DD
    const ymdMatch = clean.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1970 && year < 2100) {
        return new Date(year, month, day);
      }
    }

    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  };

  // Determina se o status é fechado (Solucionado, Concluído ou Finalizado)
  const isFechado = (rawStatus: any): boolean => {
    if (!rawStatus) return false;
    const raw = typeof rawStatus === "string" ? rawStatus : (rawStatus["STATUS"] || rawStatus["status"] || "");
    const norm = normalizeStatus(raw);
    return norm === "Solucionado" || norm === "Concluído" || norm === "Finalizado";
  };

  // Extrai data de abertura / cadastro do chamado
  const getCreatedDate = (item: any): Date | null => {
    const candidates = [
      item["DATA"],
      item["Data"],
      item["DATA_CADASTRO"],
      item["DATA CADASTRO"],
      item["DATA DE ABERTURA"],
      item["data_abertura"],
      item["createdAt"],
      item["created_at"],
      item["DATA BACKUP"]
    ];

    for (const c of candidates) {
      if (c) {
        const d = parseDate(c);
        if (d) return d;
      }
    }

    // Se não tiver coluna explícita, tenta obter a data mais antiga registrada nas atas
    const rawTimeline = item["AÇÕES"] || item["ACOES"] || item["OBSERVAÇÕES"] || item["OBSERVACOES"] || "";
    const logs = parseTimelineLogs(rawTimeline);
    if (logs && logs.length > 0) {
      for (const log of logs) {
        if (log.date && log.date !== "Histórico" && log.date !== "Registro") {
          const d = parseDate(log.date);
          if (d) return d;
        }
      }
    }

    return null;
  };

  // Extrai data de conclusão do chamado
  const getCompletionDate = (item: any): Date | null => {
    if (!isFechado(item)) return null;

    const candidates = [
      item["DATA DE CONCLUSÃO"],
      item["DATA DE RESOLUÇÃO"],
      item["DATA CONCLUSÃO"],
      item["DATA_CONCLUSAO"],
      item["DATA_RESOLUCAO"],
      item["data_resolucao"],
      item["data_conclusao"],
      item["data de conclusão"]
    ];

    for (const c of candidates) {
      if (c) {
        const d = parseDate(c);
        if (d) return d;
      }
    }

    // Procura por tag [CONCLUSÃO] no histórico
    const textFields = [item["AÇÕES"], item["ACOES"], item["OBSERVAÇÕES"], item["OBSERVACOES"]];
    for (const tf of textFields) {
      if (tf) {
        const text = String(tf);
        const match = text.match(/\[(CONCLUSÃO|CONCLUSAO|SOLUÇÃO|SOLUCAO|CONCLUÍDO|FINALIZADO)\][\s\S]*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})/i);
        if (match && match[2]) {
          const d = parseDate(match[2]);
          if (d) return d;
        }
      }
    }

    return null;
  };

  // 1. Cálculo dos Limites do Período
  const { rangeStart, rangeEnd, startFormatted, endFormatted } = useMemo(() => {
    const now = new Date();
    let rStart: Date;
    let rEnd: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === "hoje") {
      rStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === "7dias") {
      rStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      rStart.setHours(0, 0, 0, 0);
    } else if (period === "30dias") {
      rStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      rStart.setHours(0, 0, 0, 0);
    } else if (period === "este_mes") {
      rStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === "custom") {
      rStart = startDate ? (parseDate(startDate) || new Date(0)) : new Date(0);
      rStart.setHours(0, 0, 0, 0);
      if (endDate) {
        const parsedEnd = parseDate(endDate) || new Date();
        parsedEnd.setHours(23, 59, 59, 999);
        rEnd = parsedEnd;
      }
    } else {
      // "all" -> Todo o histórico
      rStart = new Date(now.getFullYear() - 5, 0, 1, 0, 0, 0, 0);
    }

    const formatD = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    return {
      rangeStart: rStart,
      rangeEnd: rEnd,
      startFormatted: formatD(rStart),
      endFormatted: formatD(rEnd)
    };
  }, [period, startDate, endDate]);

  const emissionDateFormatted = useMemo(() => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
  }, []);

  // Extrai atas de um chamado que ocorreram dentro do período
  const getAtasInPeriod = (item: any) => {
    const rawTimeline = item["AÇÕES"] || item["ACOES"] || item["OBSERVAÇÕES"] || item["OBSERVACOES"] || "";
    const logs = parseTimelineLogs(rawTimeline);
    if (!logs || logs.length === 0) return [];

    const mappedLogs = logs
      .filter((log: any) => {
        if (!log.date || log.date === "Histórico" || log.date === "Registro") {
          return false;
        }
        const d = parseDate(log.date);
        if (!d) return false;
        return d >= rangeStart && d <= rangeEnd;
      })
      .map((log: any) => {
        let author = log.author || "";
        let content = log.content || "";

        const authorMatch = content.match(/(?:•\s*por|registrado por|por:?)\s+([A-Za-zÀ-ÿ\s]+?)(?:\n|$|\s*•)/i);
        if (authorMatch && authorMatch[1]) {
          author = authorMatch[1].trim();
        }

        content = content
          .replace(/^\[ATA\/ALINHAMENTO\]\s*/i, "")
          .replace(/^\[ALTERAÇÃO DE PRAZO\]\s*/i, "")
          .replace(/^\[ALTERACAO_DE_PRAZO\]\s*/i, "")
          .trim();

        const pDate = parseDate(log.date);

        return {
          date: log.date,
          parsedDate: pDate,
          author: author || "Sistema",
          content
        };
      });

    // Ordenação estrita descendente por data para garantir que atas[0] seja a ata mais recente
    mappedLogs.sort((a: any, b: any) => {
      const timeA = a.parsedDate ? a.parsedDate.getTime() : 0;
      const timeB = b.parsedDate ? b.parsedDate.getTime() : 0;
      return timeB - timeA;
    });

    return mappedLogs;
  };

  // QUERY PRINCIPAL E PROCESSAMENTO:
  // Traz todos os chamados movimentados ou abertos/fechados no período, independentemente do status atual.
  const { filteredRecords, chamadosAbertos, chamadosFechados, reportKpis } = useMemo(() => {
    const recordsWithMeta = camadaOptica.map((item) => {
      const createdD = getCreatedDate(item);
      const isCreatedInPeriod = createdD ? (createdD >= rangeStart && createdD <= rangeEnd) : false;
      const atasInPeriod = getAtasInPeriod(item);
      const hasAtasInPeriod = atasInPeriod.length > 0;
      const closedD = getCompletionDate(item);
      const isClosedInPeriod = closedD ? (closedD >= rangeStart && closedD <= rangeEnd) : false;
      const normStatus = normalizeStatus(item["STATUS"] || "Pendente");
      const fechado = isFechado(normStatus);

      return {
        item,
        createdD,
        isCreatedInPeriod,
        atasInPeriod,
        hasAtasInPeriod,
        closedD,
        isClosedInPeriod,
        fechado,
        normStatus
      };
    });

    // Query principal sem restrição de status: traz todos os chamados pertinentes ao período
    const periodRecords = period === "all"
      ? recordsWithMeta
      : recordsWithMeta.filter((r) => r.isCreatedInPeriod || r.hasAtasInPeriod || r.isClosedInPeriod);

    // Agrupamento estrito conforme diretrizes:
    // Bloco 1: Chamados Abertos (status Pendente ou Em andamento)
    const abertos = periodRecords.filter((r) => {
      if (r.normStatus === "Sem solução") return false; // Sem solução é considerado Concluído/Fechado
      return r.normStatus === "Pendente" || r.normStatus === "Em andamento" || !r.fechado;
    });

    // Bloco 2: Chamados Fechados (status Solucionado, Concluído, Finalizado ou Sem solução)
    const fechados = periodRecords.filter((r) => {
      return r.normStatus === "Solucionado" || r.normStatus === "Concluído" || r.normStatus === "Finalizado" || r.normStatus === "Sem solução" || r.fechado;
    });

    // Agregações executivas
    const totalGeral = periodRecords.length;
    const totalAbertos = abertos.length;
    const totalFechados = fechados.length;

    const abertosNoPeriodo = periodRecords.filter((r) => r.isCreatedInPeriod).length;
    const fechadosNoPeriodo = periodRecords.filter((r) => r.fechado && (r.isClosedInPeriod || r.hasAtasInPeriod || r.isCreatedInPeriod)).length;

    const movimentadosNoPeriodo = periodRecords.filter((r) => r.hasAtasInPeriod).length;
    const semMovimentacao = periodRecords.filter((r) => !r.hasAtasInPeriod).length;

    // Quebra exata dos 4 status
    let solucionadosCount = 0;
    let emAndamentoCount = 0;
    let pendentesCount = 0;
    let semSolucaoCount = 0;

    periodRecords.forEach((r) => {
      if (r.normStatus === "Solucionado" || r.normStatus === "Concluído" || r.normStatus === "Finalizado") {
        solucionadosCount++;
      } else if (r.normStatus === "Sem solução") {
        semSolucaoCount++;
      } else if (r.normStatus === "Em andamento") {
        emAndamentoCount++;
      } else {
        pendentesCount++;
      }
    });

    return {
      filteredRecords: periodRecords,
      chamadosAbertos: abertos,
      chamadosFechados: fechados,
      reportKpis: {
        totalGeral,
        totalAbertos,
        totalFechados,
        abertosNoPeriodo,
        fechadosNoPeriodo,
        movimentadosNoPeriodo,
        semMovimentacao,
        solucionadosCount,
        emAndamentoCount,
        pendentesCount,
        semSolucaoCount
      }
    };
  }, [camadaOptica, rangeStart, rangeEnd, period]);

  const isSummarized = atasMode === "ultima" || atasMode === "sem_atas";

  // Função assíncrona para gerar e baixar o relatório em PDF via html2canvas e jsPDF
  // Suporta relatório Completo, Resumido ou Sem Atas, sanitiza cores modernas oklch() e evita fatiamento de cards e atas
  const handleGeneratePDF = async (targetAtasMode?: "todas" | "ultima" | "sem_atas") => {
    const element = reportDocumentRef.current;
    if (!element || isGeneratingPdf) return;

    const activeAtasMode = targetAtasMode || atasMode;
    setIsGeneratingPdf(true);
    if (targetAtasMode && targetAtasMode !== atasMode) {
      setAtasMode(targetAtasMode);
    }

    // Aguarda ciclo de renderização do React para atualizar o DOM com o modo selecionado
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Garante que o html2canvas no escopo global e no bundle seja o html2canvas-pro com suporte a oklab/oklch
    if (typeof window !== "undefined") {
      (window as any).html2canvas = html2canvas;
    }

    // Helper para converter com segurança qualquer valor CSS de cor (incluindo oklab, oklch, color-mix) para rgb/rgba
    const parseColorToRgb = (colorStr: string): string => {
      if (!colorStr || typeof colorStr !== "string") return "#1E1E1E";
      const trimmed = colorStr.trim();
      if (
        !trimmed.includes("oklch") &&
        !trimmed.includes("oklab") &&
        !trimmed.includes("color-mix") &&
        !trimmed.includes("color(")
      ) {
        return colorStr;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return "#1E1E1E";

        // O browser moderno entende oklab e oklch perfeitamente no CanvasRenderingContext2D
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#ffffff";
        ctx.fillStyle = trimmed;
        ctx.fillRect(0, 0, 1, 1);

        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a < 255) {
          const alpha = (a / 255).toFixed(2);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgb(${r}, ${g}, ${b})`;
      } catch {
        return "#1E1E1E";
      }
    };

    try {
      // 1. Definição do nome do arquivo dinamicamente com sufixo de formato e escopo
      const cleanStart = startFormatted.replace(/\//g, "-");
      const cleanEnd = endFormatted.replace(/\//g, "-");
      const modeSuffix = activeAtasMode === "sem_atas" ? "_sem_atas" : activeAtasMode === "ultima" ? "_resumido" : "_completo";
      const scopeSuffix = filterMode === "todos" ? "" : `_${filterMode}`;
      const fileName = cleanStart === cleanEnd
        ? `relatorio_camada_optica_${cleanStart}${scopeSuffix}${modeSuffix}.pdf`
        : `relatorio_camada_optica_${cleanStart}_a_${cleanEnd}${scopeSuffix}${modeSuffix}.pdf`;

      // 2. Configuração do html2pdf.js com trava temporária de largura (800px - proporção exata de A4) e padding simétrico
      const element = reportDocumentRef.current || document.getElementById("relatorio-camada-optica-documento");
      if (!element) return;

      // Trava temporariamente a largura do DOM e estabelece padding perfeitamente simétrico de 24px
      const prevWidth = element.style.width;
      const prevMaxWidth = element.style.maxWidth;
      const prevPadding = element.style.padding;
      const prevBoxSizing = element.style.boxSizing;

      element.style.width = "800px";
      element.style.maxWidth = "800px";
      element.style.padding = "24px";
      element.style.boxSizing = "border-box";

      const opt = {
        margin: [10, 10, 15, 10] as [number, number, number, number],
        filename: fileName,
        image: { type: "jpeg" as const, quality: 1 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: 800,       // Trava a captura do canvas estritamente em 800px sem sobras à direita
          windowWidth: 800, // Alinha o viewport do html2canvas rigorosamente em 800px
          onclone: (clonedDoc: Document) => {
            const styleClean = clonedDoc.createElement("style");
            styleClean.innerHTML = `
              * {
                box-shadow: none !important;
                text-shadow: none !important;
                filter: none !important;
                -webkit-filter: none !important;
                --tw-shadow: 0 0 #0000 !important;
                --tw-shadow-colored: 0 0 #0000 !important;
                --tw-ring-shadow: 0 0 #0000 !important;
                --tw-ring-color: transparent !important;
                --tw-ring-offset-shadow: 0 0 #0000 !important;
              }
              .pdf-card, .incident-card {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                display: block !important;
              }
              @media print {
                .pdf-card, .incident-card {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  display: block !important;
                }
              }
            `;
            clonedDoc.head.appendChild(styleClean);

            const styleTags = clonedDoc.querySelectorAll("style");
            styleTags.forEach((s) => {
              if (
                s.textContent &&
                (s.textContent.includes("oklch") ||
                  s.textContent.includes("oklab") ||
                  s.textContent.includes("color-mix"))
              ) {
                s.textContent = s.textContent
                  .replace(/oklch\([^)]+\)/gi, (match) => parseColorToRgb(match))
                  .replace(/oklab\([^)]+\)/gi, (match) => parseColorToRgb(match));
              }
            });

            const target = clonedDoc.getElementById("relatorio-camada-optica-documento");
            if (target) {
              target.style.width = "800px";
              target.style.maxWidth = "800px";
              target.style.padding = "24px";
              target.style.boxSizing = "border-box";
              target.style.margin = "0 auto";
            }
          }
        },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
        pagebreak: { mode: ["avoid-all", "css", "legacy"], avoid: [".pdf-card", ".incident-card"] }
      };

      // 3. Executa a geração do PDF via engine do html2pdf.js e restaura o estilo original do DOM
      try {
        await html2pdf().set(opt).from(element).save();
      } finally {
        element.style.width = prevWidth;
        element.style.maxWidth = prevMaxWidth;
        element.style.padding = prevPadding;
        element.style.boxSizing = prevBoxSizing;
      }
    } catch (err) {
      console.error("Falha ao gerar o PDF do relatório:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Função para copiar o relatório em formato de texto estruturado para área de transferência
  const handleCopyReport = () => {
    let text = `====================================================\n`;
    text += `RELATÓRIO GERENCIAL DE CAMADA ÓPTICA\n`;
    text += `Período Analisado: ${startFormatted} - ${endFormatted}\n`;
    text += `Data de Emissão: ${emissionDateFormatted}\n`;
    text += `====================================================\n\n`;

    text += `RESUMO EXECUTIVO:\n`;
    text += `• Total de Trechos Analisados: ${reportKpis.totalGeral}\n`;
    text += `• Chamados Abertos: ${reportKpis.totalAbertos}\n`;
    text += `• Chamados Fechados: ${reportKpis.totalFechados}\n`;
    text += `• Abertos no Período: ${reportKpis.abertosNoPeriodo}\n`;
    text += `• Fechados no Período: ${reportKpis.fechadosNoPeriodo}\n`;
    text += `• Movimentados no Período: ${reportKpis.movimentadosNoPeriodo}\n`;
    text += `• Sem Movimentação: ${reportKpis.semMovimentacao}\n\n`;

    text += `QUEBRA POR ESTÁGIO:\n`;
    text += `• Pendente: ${reportKpis.pendentesCount}\n`;
    text += `• Em Andamento: ${reportKpis.emAndamentoCount}\n`;
    text += `• Sem Solução: ${reportKpis.semSolucaoCount}\n`;
    text += `• Solucionado / Concluído: ${reportKpis.solucionadosCount}\n\n`;

    text += `1. CHAMADOS ABERTOS (Total: ${chamadosAbertos.length})\n`;
    text += `(Pendente, Em Andamento e Sem Solução)\n`;
    text += `----------------------------------------------------\n`;

    if (chamadosAbertos.length === 0) {
      text += `Nenhum chamado aberto registrado no período.\n\n`;
    } else {
      chamadosAbertos.forEach((recordMeta, idx) => {
        const item = recordMeta.item;
        const id = item.ID || item.operId || `REC-${item.id}`;
        
        
        
        const status = item["STATUS"] || "Pendente";
        const prazo = item["PRAZO"] ? formatSheetDate(item["PRAZO"]) : "ND";

        text += `\n[${idx + 1}] ${id}: ${item["TRECHO"] || "ND"}\n`;
        text += `    Status: ${status} | Previsão: ${prazo}\n`;

        if (recordMeta.atasInPeriod.length > 0) {
          text += `    Atas no Período:\n`;
          recordMeta.atasInPeriod.forEach((ata: any) => {
            text += `      • [${ata.date}] (${ata.author}): ${ata.content.replace(/\n/g, " ")}\n`;
          });
        } else {
          text += `    (Sem atas para o incidente no período selecionado)\n`;
        }
      });
      text += `\n`;
    }

    text += `2. CHAMADOS FECHADOS / CONCLUÍDOS (Total: ${chamadosFechados.length})\n`;
    text += `(Solucionados e Concluídos)\n`;
    text += `----------------------------------------------------\n`;

    if (chamadosFechados.length === 0) {
      text += `Nenhum chamado fechado ou concluído registrado no período.\n\n`;
    } else {
      chamadosFechados.forEach((recordMeta, idx) => {
        const item = recordMeta.item;
        const id = item.ID || item.operId || `REC-${item.id}`;
        
        
        
        const status = item["STATUS"] || "Solucionado";
        const concD = recordMeta.closedD ? formatSheetDate(recordMeta.closedD.toISOString()) : (item["PRAZO"] ? formatSheetDate(item["PRAZO"]) : "Concluído");

        text += `\n[${idx + 1}] ${id}: ${item["TRECHO"] || "ND"}\n`;
        text += `    Status: ${status} | Conclusão: ${concD}\n`;

        if (recordMeta.atasInPeriod.length > 0) {
          text += `    Atas no Período:\n`;
          recordMeta.atasInPeriod.forEach((ata: any) => {
            text += `      • [${ata.date}] (${ata.author}): ${ata.content.replace(/\n/g, " ")}\n`;
          });
        } else {
          text += `    (Incidente concluído / solucionado no período selecionado)\n`;
        }
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Helper para renderizar os cards individuais de chamado (utilizado em ambos os blocos)
  const renderIncidentCard = (metaRecord: any, index: number, type: "aberto" | "fechado") => {
    const item = metaRecord.item;
    const id = item.ID || item.operId || `REC-${item.id}`;
    
    const status = item["STATUS"] || (type === "fechado" ? "Solucionado" : "Pendente");
    const prazoRaw = item["PRAZO"];
    const prazoFormatted = prazoRaw ? formatSheetDate(prazoRaw) : "ND";
    const isExpired = prazoRaw ? isDeadlineExpired(prazoRaw, status) : false;
    const atas = metaRecord.atasInPeriod;
    const info = item["INFORMAÇÃO"] || "";

    // Lógica condicional: "sem_atas" (nenhuma) | "ultima" (apenas 1) | "todas" (todas do período)
    const displayAtas = atasMode === "sem_atas" ? [] : atasMode === "ultima" ? atas.slice(0, 1) : atas;

    return (
      <div 
        key={`relatorio-card-${id}-${index}`}
        className="pdf-card incident-card bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg overflow-hidden mb-4 block"
        style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
      >
        {/* Linha 1: [ID]: [ROTA] + Metadados (Status e Previsão) */}
        <div className="bg-[#F3F4F6] px-4 py-2.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E5E7EB] min-h-[38px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-[#374151] bg-[#FFFFFF] border border-[#D1D5DB] rounded px-1.5 py-0.5 text-[10px] shrink-0 font-bold">
              {id}
            </span>
            <span className="break-words whitespace-normal text-[#1E1E1E] leading-normal font-bold">{item["TRECHO"] || "ND"}</span>
            <span className="text-[10px] font-mono text-[#9CA3AF] font-normal shrink-0 ml-1">
              #{index + 1}
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0 bg-white px-3 py-1 rounded-md border border-gray-200">
            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#9CA3AF] font-medium text-[10px] uppercase">Status:</span>
              <div className="inline-flex items-center gap-1.5 font-bold text-[#1E1E1E]">
                <span 
                  className={`w-2 h-2 rounded-full shrink-0 block m-0 p-0 ${
                    type === "fechado" || metaRecord.fechado || metaRecord.normStatus === "Sem solução"
                      ? "bg-[#10B981]"
                      : metaRecord.normStatus === "Em andamento"
                        ? "bg-[#FBBF24]"
                        : "bg-[#FF5022]"
                  }`} 
                />
                <span className="leading-none m-0 p-0 text-[11px]">{status}</span>
              </div>
            </div>

            {/* Previsão ou Conclusão */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#9CA3AF] font-medium text-[10px] uppercase">
                {type === "fechado" ? "Conclusão:" : "Previsão:"}
              </span>
              <span className={`font-bold text-[11px] ${isExpired && type !== "fechado" ? "text-[#FF5022]" : "text-[#1E1E1E]"}`}>
                {prazoFormatted}
                {isExpired && type !== "fechado" && " (Vencido)"}
              </span>
            </div>
          </div>
        </div>

        {/* Linha 2: Descrição (Info) */}
        {info && info !== "ND" && info !== "-" && (
          <div className="px-4 py-3 bg-[#FFFFFF] border-b border-[#F3F4F6]">
            <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-wrap break-words">
              <strong className="text-gray-900 mr-1">Descrição:</strong> {info}
            </p>
          </div>
        )}

        {/* Sub-loop de Atas */}
        {atasMode !== "sem_atas" && (
          <div className="px-4 py-3 bg-[#FAFAFA] block">
            {displayAtas && displayAtas.length > 0 ? (
              <div className="block space-y-2.5">
                {displayAtas.map((ata: any, ataIdx: number) => (
                  <div
                    key={`ata-${id}-${ataIdx}`}
                    className={`ata-item border-l-4 ${
                      type === "fechado" || metaRecord.normStatus === "Sem solução" ? "border-[#10B981] bg-[#F0FDF4]" : "border-[#FF5022] bg-[#FFF7ED]"
                    } p-2.5 text-xs rounded-r block border border-l-4 border-y-transparent border-r-transparent`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium text-[#6B7280] mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold ${type === "fechado" ? "text-[#047857]" : "text-[#FF5022]"} font-mono`}>
                          {ata.date}
                        </span>
                        <span>•</span>
                        <span>por <strong className="text-[#374151]">{ata.author}</strong></span>
                        {atasMode === "ultima" && (
                          <span className="text-[10px] bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-mono font-bold ml-1">
                            Última Atualização
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[#374151] leading-relaxed whitespace-pre-wrap break-words text-xs pr-1">
                      {ata.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-2 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50">
                <p className="text-gray-400 italic text-xs">
                  {type === "fechado" ? "Incidente concluído no período (Sem histórico de atas registrado)" : "Sem atas registradas para o incidente no período selecionado"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Container Principal do Modal */}
      <div 
        id="relatorio-camada-optica-modal"
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none"
      >
        {/* Barra de Ferramentas Superior (Oculta na impressão) */}
        <div className="bg-gray-900 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FF5022]" />
            <span className="text-sm font-bold tracking-wide">Painel de Exportação & Visualização</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Período Rápido */}
            <div className="flex items-center gap-1.5 bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-700 text-xs">
              <CalendarRange className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  onPeriodChange?.(e.target.value, startDate, endDate);
                }}
                className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="hoje" className="bg-gray-900 text-white">Hoje</option>
                <option value="7dias" className="bg-gray-900 text-white">Últimos 7 Dias</option>
                <option value="30dias" className="bg-gray-900 text-white">Últimos 30 Dias</option>
                <option value="este_mes" className="bg-gray-900 text-white">Mês Atual</option>
                <option value="custom" className="bg-gray-900 text-white">Personalizado...</option>
                <option value="all" className="bg-gray-900 text-white">Todo o Histórico</option>
              </select>

              {period === "custom" && (
                <div className="flex items-center gap-1 pl-2 border-l border-gray-700">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      onPeriodChange?.("custom", e.target.value, endDate);
                    }}
                    className="bg-gray-900 border border-gray-700 text-white text-[11px] rounded px-1.5 py-0.5"
                  />
                  <span className="text-gray-400 text-[10px]">até</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      onPeriodChange?.("custom", startDate, e.target.value);
                    }}
                    className="bg-gray-900 border border-gray-700 text-white text-[11px] rounded px-1.5 py-0.5"
                  />
                </div>
              )}
            </div>

            {/* Alternador de Visualização dos Blocos */}
            <div className="flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-700 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("todos")}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  filterMode === "todos"
                    ? "bg-white text-gray-900 font-bold shadow-2xs"
                    : "text-gray-300 hover:text-white"
                }`}
                title="Exibir ambos os blocos (Abertos e Fechados)"
              >
                Todos ({reportKpis.totalGeral})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("abertos")}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  filterMode === "abertos"
                    ? "bg-[#FF5022] text-white font-bold shadow-2xs"
                    : "text-gray-300 hover:text-white"
                }`}
                title="Filtrar apenas chamados abertos"
              >
                Abertos ({reportKpis.totalAbertos})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("fechados")}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  filterMode === "fechados"
                    ? "bg-emerald-600 text-white font-bold shadow-2xs"
                    : "text-gray-300 hover:text-white"
                }`}
                title="Filtrar apenas chamados fechados"
              >
                Fechados ({reportKpis.totalFechados})
              </button>
            </div>

            {/* Copiar Texto Estruturado */}
            <button
              type="button"
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              title="Copiar relatório formatado para a área de transferência"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-300" />}
              <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
            </button>

            {/* Dropdown de Geração de Relatório / PDF via html2canvas + jsPDF */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="btn-dropdown-gerar-relatorio"
                disabled={isGeneratingPdf}
                onClick={() => setDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF5022] hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold rounded-lg transition border-none ${
                  isGeneratingPdf ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                }`}
                title="Opções de exportação em PDF"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Gerar Relatório</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`} />
                  </>
                )}
              </button>

              {dropdownOpen && !isGeneratingPdf && (
                <div 
                  id="dropdown-menu-exportacao"
                  className="absolute right-0 mt-1.5 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                >
                  <div className="px-3 py-1.5 border-b border-gray-800 text-[10px] font-semibold text-gray-400 uppercase font-mono tracking-wider">
                    Formato de Exportação em PDF
                  </div>

                  <button
                    type="button"
                    id="btn-exportar-completo"
                    onClick={() => {
                      setDropdownOpen(false);
                      handleGeneratePDF("todas");
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-gray-800 transition flex items-start gap-2.5 text-white group cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[#FF5022] mt-0.5 shrink-0 group-hover:scale-110 transition" />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Relatório Completo</span>
                        <span className="text-[10px] bg-orange-950 text-orange-400 px-1.5 py-0.2 rounded font-mono">Padrão</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Exporta todas as atas e movimentações do período.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-exportar-resumido"
                    onClick={() => {
                      setDropdownOpen(false);
                      handleGeneratePDF("ultima");
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-gray-800 transition flex items-start gap-2.5 text-white group cursor-pointer border-t border-gray-800"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0 group-hover:scale-110 transition" />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Relatório Resumido</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded font-mono">Diretoria</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Exporta apenas a última atualização (ata mais recente) de cada chamado.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-exportar-sem-atas"
                    onClick={() => {
                      setDropdownOpen(false);
                      handleGeneratePDF("sem_atas");
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-gray-800 transition flex items-start gap-2.5 text-white group cursor-pointer border-t border-gray-800"
                  >
                    <Layers className="w-4 h-4 text-sky-400 mt-0.5 shrink-0 group-hover:scale-110 transition" />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Relatório Sem Atas</span>
                        <span className="text-[10px] bg-sky-950 text-sky-400 px-1.5 py-0.2 rounded font-mono font-bold">Enxuto</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Exporta apenas os cards dos trechos, sem exibir atas ou histórico.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
              title="Fechar relatório"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo Rolar do Relatório (Design Minimalista Grafite & Laranja) capturado para o PDF */}
        <div 
          ref={reportDocumentRef}
          id="relatorio-camada-optica-documento"
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-[#FFFFFF] text-left font-sans text-[#1E1E1E] w-full block print:overflow-visible print:p-4"
        >
          
          {/* Cabeçalho Executivo do Relatório */}
          <div className="border-b border-[#E5E7EB] pb-5">
            <div className="flex justify-between items-end gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-[#FF5022] inline-block shrink-0" />
                  <span className="text-xs font-bold tracking-widest text-[#FF5022] uppercase font-mono">
                    BRISANET TELECOMUNICAÇÕES • DWDM
                  </span>
                </div>
                <h1 className="text-[28px] font-extrabold text-[#1E1E1E] tracking-tight leading-tight">
                  Relatório Gerencial de Camada Óptica
                </h1>
                <p className="text-xs text-[#6B7280] font-medium mt-1">
                  Período Analisado: <strong className="text-[#1F2937]">{startFormatted}</strong> até <strong className="text-[#1F2937]">{endFormatted}</strong> | Data de Emissão: <strong className="text-[#1F2937]">{emissionDateFormatted}</strong>
                </p>
              </div>

              {/* Tag de Período Ativo */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-right shrink-0">
                <span className="text-[10px] text-[#9CA3AF] block font-mono uppercase">Escopo</span>
                <span className="text-xs font-bold text-[#1F2937] block">
                  {period === "all" ? "Histórico Completo" : `${startFormatted} - ${endFormatted}`}
                </span>
                <span className="text-[10px] font-semibold text-[#FF5022] block font-mono mt-0.5">
                  {isSummarized ? "Resumido (Última Ata)" : "Completo (Todas as Atas)"}
                </span>
              </div>
            </div>
          </div>

          {/* Grid de 3 Cards Superiores (KPIs) */}
          <div className="grid grid-cols-3 gap-4">
            {/* 1. TOTAL DE TRECHOS */}
            <div className="kpi-card bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-4">
              <span className="text-xs font-semibold text-[#6B7280] font-mono tracking-wider uppercase block mb-1">
                Total de Trechos
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-[32px] font-extrabold text-[#1E1E1E] tracking-tight leading-none">
                  {reportKpis.totalGeral}
                </span>
                <span className="text-xs font-medium text-[#9CA3AF]">
                  {reportKpis.movimentadosNoPeriodo} movimentados
                </span>
              </div>
            </div>

            {/* 2. CHAMADOS ABERTOS */}
            <div className="kpi-card bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-4">
              <span className="text-xs font-semibold text-[#FF5022] font-mono tracking-wider uppercase block mb-1">
                Chamados Abertos
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-[32px] font-extrabold text-[#FF5022] tracking-tight leading-none">
                  {reportKpis.totalAbertos}
                </span>
                <span className="text-xs font-medium text-[#6B7280]">
                  Pendente / Andamento
                </span>
              </div>
            </div>

            {/* 3. CHAMADOS FECHADOS */}
            <div className="kpi-card bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-4">
              <span className="text-xs font-semibold text-[#059669] font-mono tracking-wider uppercase block mb-1">
                Chamados Fechados
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-[32px] font-extrabold text-[#059669] tracking-tight leading-none">
                  {reportKpis.totalFechados}
                </span>
                <span className="text-xs font-medium text-[#059669] font-semibold">
                  Solucionados / Concluídos
                </span>
              </div>
            </div>
          </div>

          {/* Painel de Resumo Detalhado (Borda Esquerda Grafite Escuro) */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] border-l-4 border-l-[#1F2937] rounded-xl p-5 block w-full">
            <div className="text-xs font-bold text-[#374151] tracking-wider uppercase font-mono mb-3">
              Resumo Operacional do Período
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
              {/* Abertos no Período */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-[#6B7280] font-mono uppercase block">Abertos no Período</span>
                <span className="text-lg font-bold text-[#111827]">{reportKpis.abertosNoPeriodo}</span>
              </div>

              {/* Fechados no Período */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-[#6B7280] font-mono uppercase block">Fechados no Período</span>
                <span className="text-lg font-bold text-[#059669]">{reportKpis.fechadosNoPeriodo}</span>
              </div>

              {/* Movimentados */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-[#6B7280] font-mono uppercase block">Movimentados</span>
                <span className="text-lg font-bold text-[#FF5022]">{reportKpis.movimentadosNoPeriodo}</span>
              </div>

              {/* Sem Movimentação */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-[#6B7280] font-mono uppercase block">Sem Movimentação</span>
                <span className="text-lg font-bold text-[#4B5563]">{reportKpis.semMovimentacao}</span>
              </div>

              {/* Quebra: Pendente */}
              <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l sm:pl-3 border-[#E5E7EB] pt-2 sm:pt-0">
                <span className="text-[11px] font-medium text-[#6B7280] font-mono uppercase block">Pendente</span>
                <span className="text-lg font-bold text-[#D97706]">{reportKpis.pendentesCount}</span>
              </div>

              {/* Quebra: Em Andamento */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-[#6B7280] font-mono uppercase block">Em Andamento</span>
                <span className="text-lg font-bold text-[#0284C7]">{reportKpis.emAndamentoCount}</span>
              </div>
            </div>

            {/* Segunda linha de detalhes por estágio */}
            <div className="mt-4 pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center gap-6 text-xs text-[#4B5563]">
              <div>
                <span className="font-semibold text-[#374151]">Solucionados:</span>{" "}
                <span className="text-[#059669] font-bold">{reportKpis.solucionadosCount}</span>
              </div>
              <div>
                <span className="font-semibold text-[#374151]">Sem Solução:</span>{" "}
                <span className="text-[#E11D48] font-bold">{reportKpis.semSolucaoCount}</span>
              </div>
              <div className="text-[#9CA3AF] text-[11px]">
                Critério: Cadastrados no período, com atas movimentadas ou concluídos no intervalo.
              </div>
            </div>
          </div>

          {/* BLOCO 1: Chamados Abertos (Pendente, Em Andamento e Sem Solução) */}
          {(filterMode === "todos" || filterMode === "abertos") && (
            <div className="block w-full mb-6">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2 mb-4">
                <h2 className="text-lg font-bold text-[#FF5022] flex items-center gap-2">
                  <span>1. Chamados Abertos</span>
                  <span className="text-xs font-semibold text-[#374151] bg-[#FFEDD5] rounded-full px-2.5 py-0.5 font-mono">
                    {chamadosAbertos.length} {chamadosAbertos.length === 1 ? "chamado" : "chamados"}
                  </span>
                </h2>
                <span className="text-xs text-[#9CA3AF] font-mono hidden sm:inline">
                  Demandas em acompanhamento / não concluídas
                </span>
              </div>

              {chamadosAbertos.length === 0 ? (
                <div className="text-center py-8 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                  <AlertCircle className="w-7 h-7 text-[#9CA3AF] mx-auto mb-1.5" />
                  <p className="text-sm font-semibold text-[#374151]">
                    Nenhum chamado aberto encontrado para o período selecionado.
                  </p>
                </div>
              ) : (
                <div className="block w-full">
                  {chamadosAbertos.map((metaRecord, index) => renderIncidentCard(metaRecord, index, "aberto"))}
                </div>
              )}
            </div>
          )}

          {/* BLOCO 2: Chamados Fechados / Concluídos */}
          {(filterMode === "todos" || filterMode === "fechados") && (
            <div className="block w-full mb-6">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2 mb-4">
                <h2 className="text-lg font-bold text-[#059669] flex items-center gap-2">
                  <span>2. Chamados Concluídos / Solucionados</span>
                  <span className="text-xs font-semibold text-[#065F46] bg-[#D1FAE5] rounded-full px-2.5 py-0.5 font-mono">
                    {chamadosFechados.length} {chamadosFechados.length === 1 ? "chamado" : "chamados"}
                  </span>
                </h2>
                <span className="text-xs text-[#9CA3AF] font-mono hidden sm:inline">
                  Demandas finalizadas no período
                </span>
              </div>

              {chamadosFechados.length === 0 ? (
                <div className="text-center py-8 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                  <CheckCircle2 className="w-7 h-7 text-[#9CA3AF] mx-auto mb-1.5" />
                  <p className="text-sm font-semibold text-[#374151]">
                    Nenhum chamado fechado ou concluído encontrado para o período selecionado.
                  </p>
                </div>
              ) : (
                <div className="block w-full">
                  {chamadosFechados.map((metaRecord, index) => renderIncidentCard(metaRecord, index, "fechado"))}
                </div>
              )}
            </div>
          )}

          {/* Rodapé institucional */}
          <div className="pt-6 border-t border-[#E5E7EB] text-center text-xs text-[#9CA3AF] font-mono block w-full">
            Documento gerado automaticamente pelo Sistema de Controle Operacional de Redes • Brisanet Telecomunicações S.A.
          </div>

        </div>
      </div>
    </div>
  );
};
