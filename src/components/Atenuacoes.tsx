import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle2, Plus, PlusCircle, X, AlertCircle, RefreshCw, Pencil, Trash2, Copy, Info, ChevronDown, ChevronUp, Filter, Activity, TrendingDown, Search, Briefcase, FileText, Check, FileSpreadsheet, Clipboard, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Atenuacao, Bypass, SimuladorItem, Atuacao } from '../types';

const formatDateInput = (val: string): string => {
  const clean = val.replace(/\D/g, "");
  if (clean.length <= 2) return clean;
  if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
};

const formatToLocalDate = (dateVal: string | undefined | null): string => {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (!str) return '';
  
  // If the date is already in DD/MM/YYYY format, return it
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }
  
  // Try parsing ISO/UTC stamp
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
    // raw fallback
  }
  return str;
};

interface AtenuacoesProps {
  filteredAtenuacoes: Atenuacao[];
  bypasses: Bypass[];
  simuladorData: SimuladorItem[];
  redeTrechoOptions: { rede: string, trecho: string }[];
  onAdd?: (newRecord: Atenuacao) => Promise<boolean>;
  onEdit?: (record: Atenuacao, originalIdImoc?: string) => Promise<boolean>;
  onDelete?: (idImoc: string) => Promise<boolean>;
  onStartFinalize?: (item: Atenuacao) => void;
  isSaving?: boolean;
  allAtuacoes?: Atuacao[];
  onEditAtuacao?: (record: any) => Promise<boolean>;
  onDeleteAtuacao?: (id: string) => Promise<boolean>;
  currentUser?: any;
  onQuickImportDirect?: (record: any) => Promise<boolean>;
}

export default function Atenuacoes({ 
  filteredAtenuacoes, 
  bypasses,
  simuladorData,
  redeTrechoOptions,
  onAdd, 
  onEdit, 
  onDelete, 
  onStartFinalize,
  isSaving,
  allAtuacoes,
  onEditAtuacao,
  onDeleteAtuacao,
  currentUser,
  onQuickImportDirect
}: AtenuacoesProps) {
  const [originalIdImoc, setOriginalIdImoc] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPioraModalOpen, setIsPioraModalOpen] = useState(false);
  
  // Local edit/delete states for Pioras and Atuacoes
  const [editingPiora, setEditingPiora] = useState<{ item: Atenuacao; originalIdx: number; data: string; db: number; descricao: string } | null>(null);
  const [deletingPiora, setDeletingPiora] = useState<{ item: Atenuacao; originalIdx: number; db: number } | null>(null);
  const [editingAtuacao, setEditingAtuacao] = useState<Atuacao | null>(null);
  const [deletingAtuacao, setDeletingAtuacao] = useState<Atuacao | null>(null);
  
  // Estados para Cadastro Rápido
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState("");

  const parseQuickAtenuacao = (text: any) => {
    if (!text || typeof text !== "string") return null;
    const parts = text.split('\t').map(p => p.trim());
    if (parts.length >= 6) {
      return {
        idImoc: parts[1] || '',
        status: parts[0] || 'ABERTO',
        tipoChamado: parts[2] || 'TRECHO',
        sla: '24h',
        complexidade: parts[3] || 'Fácil',
        dataAbertura: parts[4] || new Date().toLocaleDateString('pt-BR'),
        trecho: parts[5] || '',
        perdas: parseFloat(parts[6] || '0') || 0,
        detalhamento: parts[7] || '',
        pioras: '',
        dataConclusao: ''
      };
    }
    
    // Heuristic parsing:
    let status = "ABERTO";
    if (/aberto|open/i.test(text)) status = "ABERTO";
    else if (/fechado|concluido|closed|concluída/i.test(text)) status = "FECHADO";

    let tipoChamado = "TRECHO";
    if (/equipamento/i.test(text)) tipoChamado = "EQUIPAMENTO";

    const idMatch = text.match(/\b\d{5,8}\b/);
    const idImoc = idMatch ? idMatch[0] : "";

    const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    const dataAbertura = dateMatch ? dateMatch[0] : new Date().toLocaleDateString('pt-BR');

    let trechoVal = "";
    const trechoMatch = text.match(/([A-Z0-9_-]+\s*<>\s*[A-Z0-9_-]+)/i);
    if (trechoMatch) {
      trechoVal = trechoMatch[0];
    }

    let perdas = 0;
    const dbMatch = text.match(/([\d.,]+)\s*dB/i);
    if (dbMatch) {
      perdas = parseFloat(dbMatch[1].replace(",", ".")) || 0;
    } else {
      const floatMatch = text.match(/\b\d+([.,]\d+)?\b/g);
      if (floatMatch) {
        for (const val of floatMatch) {
          if (val.includes(",") || val.includes(".")) {
            perdas = parseFloat(val.replace(",", ".")) || 0;
            break;
          }
        }
      }
    }

    let complexidade = "Crítico";
    if (/não crítico|nao critico/i.test(text)) complexidade = "Não Crítico";
    else if (/médio|medio/i.test(text)) complexidade = "Médio";
    else if (/crítico|critico/i.test(text)) complexidade = "Crítico";

    let detalhamentoVal = "";
    const quoteMatch = text.match(/"([^"]+)"/s);
    if (quoteMatch) {
      detalhamentoVal = quoteMatch[1];
    } else {
      const localIdx = text.indexOf("Local:");
      if (localIdx !== -1) {
        detalhamentoVal = text.substring(localIdx).trim();
      }
    }

    let redeVal = "BACKBONE";
    const redeMatch = text.match(/\b([A-Z0-9]{3,5}-[A-Z0-9]{3,5})\b/i);
    if (redeMatch) {
      redeVal = redeMatch[0].toUpperCase();
    }

    return {
      idImoc,
      status,
      tipoChamado,
      sla: "24h",
      complexidade,
      dataAbertura,
      dataConclusao: "",
      rede: redeVal,
      trecho: trechoVal,
      perdas,
      detalhamento: detalhamentoVal,
      pioras: ""
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
      const parsed = parseQuickAtenuacao(quickImportText);
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
  const [pioraItem, setPioraItem] = useState<Atenuacao | null>(null);
  const [pioraData, setPioraData] = useState({
    data: new Date().toLocaleDateString('pt-BR'),
    db: '',
    descricao: ''
  });
  
  // States para o Relatório Dinâmico
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportItem, setReportItem] = useState<Atenuacao | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const handleOpenPioraModal = (item: Atenuacao) => {
    setPioraItem(item);
    setPioraData({
      data: new Date().toLocaleDateString('pt-BR'),
      db: '',
      descricao: ''
    });
    setIsPioraModalOpen(true);
  };

  const handleSavePiora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pioraItem) return;

    const valDb = parseFloat(pioraData.db.replace(',', '.'));
    if (isNaN(valDb) || valDb <= 0) {
      alert("Por favor, insira um valor válido de dB maior que zero.");
      return;
    }

    // Format new worsening string: "Piora: [DD/MM/AAAA, X.XX dB, Descricao]"
    const formattedDate = pioraData.data || new Date().toLocaleDateString('pt-BR');
    const newPioraString = `Piora: [${formattedDate}, ${valDb.toFixed(2)} dB, ${pioraData.descricao}]`;
    
    // Concatenate to previous worsens in pioras field if they exist
    const currentPioras = pioraItem.pioras ? pioraItem.pioras.trim() : '';
    const updatedPioras = currentPioras ? currentPioras + " | " + newPioraString : newPioraString;
    
    // Add to existing perdas (coluna I)
    const newPerdas = Number(pioraItem.perdas || 0) + valDb;

    const updatedItem: Atenuacao = {
      ...pioraItem,
      perdas: Number(newPerdas.toFixed(2)),
      pioras: updatedPioras
    };

    const success = await onEdit?.(updatedItem) || false;
    if (success) {
      setIsPioraModalOpen(false);
    }
  };

  const handleConfirmEditPiora = async () => {
    if (!editingPiora) return;
    const { item, originalIdx, data, db, descricao } = editingPiora;
    
    // Parse parts of item.pioras
    const parts = (item.pioras || "").split(" | ");
    if (originalIdx < 0 || originalIdx >= parts.length) return;
    
    // Calculate new perdas
    const oldPioraStr = parts[originalIdx];
    const pRegex = /Piora:\s*\[\s*([^,\]]+)\s*,\s*([\d.,]+)\s*dB\s*,\s*([^\]]*)\s*\]/i;
    const match = pRegex.exec(oldPioraStr);
    const oldDb = match ? parseFloat(match[2]?.replace(',', '.') || '0') : 0;
    
    // Create new piora string
    const newPioraStr = `Piora: [${data}, ${db.toFixed(2)} dB, ${descricao}]`;
    parts[originalIdx] = newPioraStr;
    const updatedPioras = parts.join(" | ");
    
    const dbDiff = db - oldDb;
    const newPerdas = Number(item.perdas || 0) + dbDiff;
    
    const updatedItem: Atenuacao = {
      ...item,
      perdas: Number(Math.max(0, newPerdas).toFixed(2)),
      pioras: updatedPioras
    };
    
    const success = await onEdit?.(updatedItem) || false;
    if (success) {
      setEditingPiora(null);
    }
  };

  const handleConfirmDeletePiora = async () => {
    if (!deletingPiora) return;
    const { item, originalIdx, db } = deletingPiora;
    
    const parts = (item.pioras || "").split(" | ");
    if (originalIdx < 0 || originalIdx >= parts.length) return;
    
    // Remove the piora at originalIdx
    parts.splice(originalIdx, 1);
    const updatedPioras = parts.join(" | ");
    
    const newPerdas = Number(item.perdas || 0) - db;
    
    const updatedItem: Atenuacao = {
      ...item,
      perdas: Number(Math.max(0, newPerdas).toFixed(2)),
      pioras: updatedPioras
    };
    
    const success = await onEdit?.(updatedItem) || false;
    if (success) {
      setDeletingPiora(null);
    }
  };

  const handleConfirmEditAtuacao = async () => {
    if (!editingAtuacao) return;
    const success = await onEditAtuacao?.(editingAtuacao) || false;
    if (success) {
      setEditingAtuacao(null);
    }
  };

  const handleConfirmDeleteAtuacao = async () => {
    if (!deletingAtuacao) return;
    const success = await onDeleteAtuacao?.(deletingAtuacao.idImoc) || false;
    if (success) {
      setDeletingAtuacao(null);
    }
  };

  const [redeSearch, setRedeSearch] = useState('');
  const [trechoSearch, setTrechoSearch] = useState('');
  const [smartPasteText, setSmartPasteText] = useState('');
  const [smartPasteFeedback, setSmartPasteFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showRedeSuggestions, setShowRedeSuggestions] = useState(false);
  const [showTrechoSuggestions, setShowTrechoSuggestions] = useState(false);
  const [isTypingRede, setIsTypingRede] = useState(false);
  const [isTypingTrecho, setIsTypingTrecho] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedCorrelations, setExpandedCorrelations] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<string[]>(['ABERTO']);
  const [complexityFilter, setComplexityFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [simuladorFilter, setSimuladorFilter] = useState<string[]>([]);
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);

  const [textSearch, setTextSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toggleFilter = (current: string[], value: string, setter: (val: string[]) => void) => {
    if (value === 'TODOS') {
      setter([]);
      return;
    }
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };
  const [detalhesRX, setDetalhesRX] = useState<{ km: string; db: string }[]>([{ km: '', db: '' }]);
  const [detalhesTX, setDetalhesTX] = useState<{ km: string; db: string }[]>([{ km: '', db: '' }]);
  const [valLocal, setValLocal] = useState('');
  const [valTamanho, setValTamanho] = useState('');
  const [pasteBlock, setPasteBlock] = useState('');

  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<Partial<Atenuacao>>({
    status: 'ABERTO',
    tipoChamado: 'TRECHO',
    sla: 'Médio',
    dataAbertura: new Date().toLocaleDateString('pt-BR'),
    perdas: 0,
    detalhamento: ''
  });

  // Function to build the concatenated detail string
  const updateDetalhamento = (local?: string, tamanho?: string, rx?: typeof detalhesRX, tx?: typeof detalhesTX) => {
    const l = local !== undefined ? local : valLocal;
    const t = tamanho !== undefined ? tamanho : valTamanho;
    const rxList = (rx || detalhesRX).filter(i => i.km && i.db).map(i => `${i.km} km (${i.db} dB)`).join(' / ');
    const txList = (tx || detalhesTX).filter(i => i.km && i.db).map(i => `${i.km} km (${i.db} dB)`).join(' / ');
    
    let str = `Local: ${l} | Tamanho do Trecho: ${t} KM`;
    if (rxList) str += ` RX → ${rxList}`;
    if (txList) str += ` TX → ${txList}`;
    
    setFormData(prev => ({ ...prev, detalhamento: str }));
    if (local !== undefined) setValLocal(local);
    if (tamanho !== undefined) setValTamanho(tamanho);
  };

  const handlePasteDetalhamento = (text: string) => {
    if (!text.trim()) return;
    const parsed = parseDetalhamento(text) as any;
    if (!parsed || !parsed.sites || parsed.sites.length === 0) return;

    const primarySite = parsed.sites[0];
    const pLocal = primarySite.local || '';
    const pTamanho = primarySite.tamanho ? primarySite.tamanho.replace(',', '.') : '';
    
    // Map rxData and txData back to state arrays of { km, db }
    const rxList = primarySite.rxData && primarySite.rxData.length > 0
      ? primarySite.rxData.map((d: any) => ({ km: d.km.toString(), db: d.db.toString() }))
      : [{ km: '', db: '' }];
      
    const txList = primarySite.txData && primarySite.txData.length > 0
      ? primarySite.txData.map((d: any) => ({ km: d.km.toString(), db: d.db.toString() }))
      : [{ km: '', db: '' }];

    setDetalhesRX(rxList);
    setDetalhesTX(txList);
    setValLocal(pLocal);
    setValTamanho(pTamanho);

    // Calc total losses summing Rx and Tx
    const rxSum = rxList.reduce((acc: number, curr: any) => acc + (parseFloat(curr.db.replace(',', '.')) || 0), 0);
    const txSum = txList.reduce((acc: number, curr: any) => acc + (parseFloat(curr.db.replace(',', '.')) || 0), 0);
    const totalLosses = rxSum + txSum;

    setFormData(prev => {
      let str = `Local: ${pLocal} | Tamanho do Trecho: ${pTamanho} KM`;
      const rxStr = rxList.filter((i: any) => i.km && i.db).map((i: any) => `${i.km} km (${i.db} dB)`).join(' / ');
      const txStr = txList.filter((i: any) => i.km && i.db).map((i: any) => `${i.km} km (${i.db} dB)`).join(' / ');
      if (rxStr) str += ` RX → ${rxStr}`;
      if (txStr) str += ` TX → ${txStr}`;

      return {
        ...prev,
        perdas: parseFloat(totalLosses.toFixed(2)) || 0,
        detalhamento: str
      };
    });
  };

  const handleSmartPasteTicket = (text: any) => {
    if (!text || typeof text !== "string") {
      setSmartPasteFeedback(null);
      return;
    }
    setSmartPasteText(text);
    if (!text.trim()) {
      setSmartPasteFeedback(null);
      return;
    }

    try {
      // 1. Extract ID from link or plain text
      const idMatch = text.match(/chamado\/(\d+)/i) || text.match(/id\s*chamado:\s*(\d+)/i);
      const parsedId = idMatch ? idMatch[1] : (text.match(/\b\d{5,8}\b/) ? text.match(/\b\d{5,8}\b/)![0] : "");

      // 2. Extract Date from "Aberto em"
      const dateMatch = text.match(/Aberto\s+em:\s*\*?\s*(\d{2}\/\d{2}\/\d{2,4})/i) || text.match(/Aberto\s+em\s+(\d{2}\/\d{2}\/\d{2,4})/i);
      let parsedDate = "";
      if (dateMatch) {
        const rawDate = dateMatch[1];
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          let day = parts[0].trim();
          let month = parts[1].trim();
          let year = parts[2].trim();
          if (year.length === 2) {
            year = "20" + year;
          }
          parsedDate = `${day}/${month}/${year}`;
        } else {
          parsedDate = rawDate;
        }
      }

      // Extract match of raw "<>" pattern for fallback reporting
      const trechoMatch = text.match(/([A-Z0-9_áéíóúâêîôûãõç.-]+\s*<>\s*[A-Z0-9_áéíóúâêîôûãõç.-]+)/i);

      // 3. Extract Trecho and Rede from title with advanced scoring / fuzzy matching
      const normalizeWord = (w: string) => {
        return w
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // remove accents
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, ""); // keep alphanumeric
      };

      const isNumeric = (str: string) => /^\d+$/.test(str);

      // Helper to tokenize a string into clean keywords
      const getTokens = (str: string) => {
        const cleaned = str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase();
        return cleaned
          .split(/[^A-Z0-9]+/)
          .filter(token => {
            return (
              token &&
              token.length >= 3 &&
              !["ATENUACAO", "CHAMADO", "TITULO", "IMOC", "DWDM", "BRISANET", "CATEGORIA", "SETOR", "ABERTO", "CRIADO"].includes(token)
            );
          });
      };

      // Helper to compute match score between two individual tokens
      const getTokenMatchScore = (t1: string, t2: string): number => {
        const weight = isNumeric(t1) ? 2 : 15;
        if (t1 === t2) return weight;
        if (t1.length >= 4 && t2.length >= 4) {
          if (t1.startsWith(t2) || t2.startsWith(t1) || t1.includes(t2) || t2.includes(t1)) {
            return isNumeric(t1) ? 1 : Math.round(weight * 0.7);
          }
        }
        return 0;
      };

      let parsedRede = "";
      let parsedTrecho = "";
      let foundMatch = false;

      // Find the title line first (or line containing "<>")
      const lines = text.split('\n');
      let titleLine = "";
      for (const line of lines) {
        if (/T[íi]tulo:/i.test(line) || line.includes("<>") || line.includes("< >")) {
          titleLine = line;
          break;
        }
      }
      if (!titleLine && lines.length > 0) {
        titleLine = lines[0];
      }

      // If we found a title line, let's try to split by `<>` or `< >` to score both endpoints separately
      const splitMatch = titleLine.split(/<>\s*|< >\s*/);
      let tokensA: string[] = [];
      let tokensB: string[] = [];
      let isTwoSided = false;

      if (splitMatch.length >= 2) {
        const partA = splitMatch[0].replace(/.*T[íi]tulo:\s*/i, "").replace(/.*Atenua[cç][aã]o\s*/i, "").trim();
        const partB = splitMatch[1].trim();
        tokensA = getTokens(partA);
        tokensB = getTokens(partB);
        if (tokensA.length > 0 && tokensB.length > 0) {
          isTwoSided = true;
        }
      }

      // If not two-sided, fallback to tokenizing the entire title line or the full text
      const allTokens = isTwoSided ? [] : getTokens(titleLine || text);

      // Score all options to find the best match
      let bestScore = 0;
      let bestOption: { rede: string; trecho: string } | null = null;

      for (const option of redeTrechoOptions) {
        const optionTokens = getTokens(option.trecho);
        let score = 0;

        if (isTwoSided) {
          // Both sides A and B must match at least one word in the option, ideally
          let scoreA = 0;
          let scoreB = 0;

          for (const tA of tokensA) {
            let maxT = 0;
            for (const oT of optionTokens) {
              const s = getTokenMatchScore(tA, oT);
              if (s > maxT) maxT = s;
            }
            scoreA += maxT;
          }

          for (const tB of tokensB) {
            let maxT = 0;
            for (const oT of optionTokens) {
              const s = getTokenMatchScore(tB, oT);
              if (s > maxT) maxT = s;
            }
            scoreB += maxT;
          }

          // Total score is sum of both endpoints
          score = scoreA + scoreB;

          // Huge bonus if both sides have at least one non-numeric (alphabetic) token matched
          const hasA_AlphaMatch = tokensA.some(tA => !isNumeric(tA) && optionTokens.some(oT => !isNumeric(oT) && getTokenMatchScore(tA, oT) > 0));
          const hasB_AlphaMatch = tokensB.some(tB => !isNumeric(tB) && optionTokens.some(oT => !isNumeric(oT) && getTokenMatchScore(tB, oT) > 0));
          if (hasA_AlphaMatch && hasB_AlphaMatch) {
            score += 100;
          }
        } else {
          // One-sided fallback scoring
          for (const token of allTokens) {
            for (const oT of optionTokens) {
              score += getTokenMatchScore(token, oT);
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestOption = option;
        }
      }

      // Require a minimum threshold of matching score
      // An exact city match or prefix match is sufficient
      const minThreshold = isTwoSided ? 100 : 10;
      if (bestOption && bestScore >= minThreshold) {
        parsedRede = bestOption.rede;
        parsedTrecho = bestOption.trecho;
        foundMatch = true;
      }

      // Apply what we found
      setFormData(prev => {
        const updated = { ...prev };
        if (parsedId) updated.idImoc = parsedId;
        if (parsedDate) updated.dataAbertura = parsedDate;
        if (parsedRede) updated.rede = parsedRede;
        if (parsedTrecho) updated.trecho = parsedTrecho;
        return updated;
      });

      if (parsedRede) {
        setRedeSearch(parsedRede);
      }
      if (parsedTrecho) {
        setTrechoSearch(parsedTrecho);
      }

      // Setup user feedback message
      let feedbackMsg = "Campos identificados:";
      const identified: string[] = [];
      if (parsedId) identified.push(`ID IMOC (${parsedId})`);
      if (parsedDate) identified.push(`Data (${parsedDate})`);
      if (foundMatch) {
        identified.push(`Trecho: "${parsedTrecho}" na Rede: "${parsedRede}"`);
      } else {
        // If we extracted a trecho but it wasn't matched in options, we can still fill it in the form
        if (trechoMatch) {
          const extractedTrecho = trechoMatch[1].trim();
          setFormData(prev => ({ ...prev, trecho: extractedTrecho }));
          setTrechoSearch(extractedTrecho);
          identified.push(`Trecho: "${extractedTrecho}" (Não localizado nas redes conhecidas)`);
        }
      }

      if (identified.length > 0) {
        setSmartPasteFeedback({
          type: foundMatch ? 'success' : 'info',
          message: `Identificado: ${identified.join(', ')}`
        });
      } else {
        setSmartPasteFeedback({
          type: 'error',
          message: 'Não foi possível encontrar campos conhecidos. Cole o bloco formatado completo.'
        });
      }
    } catch (e: any) {
      setSmartPasteFeedback({
        type: 'error',
        message: 'Erro ao processar colagem: ' + e.message
      });
    }
  };

  const parseDetalhamento = (text?: string, piorasField?: string) => {
    if (!text && !piorasField) return null;
    
    // Normalize text (handle both → and ->)
    const normalizedText = (text || '').replace(/→/g, '->');

    // Parse any "Piora: [data, value, desc]" entries from the text or piorasField
    const pioras: { data: string; db: number; descricao: string; source?: string; originalIdx?: number }[] = [];
    const pioraRegex = /Piora:\s*\[\s*([^,\]]+)\s*,\s*([\d.,]+)\s*dB\s*,\s*([^\]]*)\s*\]/gi;
    let pMatch;
    
    if (text) {
      let idx = 0;
      while ((pMatch = pioraRegex.exec(text)) !== null) {
        pioras.push({
          source: 'detalhamento',
          originalIdx: idx++,
          data: pMatch[1]?.trim() || '',
          db: parseFloat(pMatch[2]?.replace(',', '.') || '0'),
          descricao: pMatch[3]?.trim() || ''
        });
      }
    }
    
    if (piorasField) {
      const parts = piorasField.split(" | ");
      parts.forEach((part, idx) => {
        if (!part.trim()) return;
        const pRegex = /Piora:\s*\[\s*([^,\]]+)\s*,\s*([\d.,]+)\s*dB\s*,\s*([^\]]*)\s*\]/i;
        const match = pRegex.exec(part);
        if (match) {
          pioras.push({
            source: 'pioras',
            originalIdx: idx,
            data: match[1]?.trim() || '',
            db: parseFloat(match[2]?.replace(',', '.') || '0'),
            descricao: match[3]?.trim() || ''
          });
        } else {
          // It's a non-matching format like: "[DD/MM/AAAA HH:MM] - Descricao"
          let data = '';
          let descricao = part.trim();
          const dateMatch = part.match(/^\[([^\]]+)\]/);
          if (dateMatch) {
            data = dateMatch[1];
            descricao = part.replace(/^\[([^\]]+)\]\s*(?:-\s*)?/, '').trim();
          }
          pioras.push({
            source: 'pioras',
            originalIdx: idx,
            data,
            db: 0,
            descricao
          });
        }
      });
    }
    const totalPiorasSum = pioras.reduce((acc, p) => acc + p.db, 0);
    
    // Split by "Local:" but keep the delimiter to parse multiple sites
    // We split by "Local:" followed by anything that doesn't include "Local:"
    const siteParts = normalizedText.split(/(?=Local:)/i).filter(p => p.trim().length > 0);
    
    const parseSingleSite = (part: string) => {
      const normalized = part.trim();
      
      // Extract Local
      let local = '';
      const localMatch = normalized.match(/Local:\s*([^|\r\n]+)/i);
      if (localMatch) local = localMatch[1].trim();
      
      // Extract Tamanho
      let tamanhoNum = 0;
      const tamanhoMatch = normalized.match(/(?:Tamanho do Trecho|Tamanho):\s*([\d.,]+)\s*KM/i);
      if (tamanhoMatch) tamanhoNum = parseFloat(tamanhoMatch[1].replace(',', '.'));
      
      // Extract RX, TX or F1, F2 patterns
      let rxData: { text: string; db: number; km: number }[] = [];
      let txData: { text: string; db: number; km: number }[] = [];
      let fieldData: { text: string; db: number; km: number; label?: string }[] = [];
      let isFieldTest = false;

      // Standard RX/TX patterns (support "RX ->" or "RX:")
      const rxMatch = normalized.match(/RX\s*(?:->|:)(?:(?!(?:RX\s*(?:->|:)|TX\s*(?:->|:)|F\d+\s*->|Fibra\s*\d+\s*:)).)+/gi);
      const txMatch = normalized.match(/TX\s*(?:->|:)(?:(?!(?:RX\s*(?:->|:)|TX\s*(?:->|:)|F\d+\s*->|Fibra\s*\d+\s*:)).)+/gi);

      if (rxMatch) {
        rxMatch.forEach(matchText => {
          const content = matchText.includes('->') ? matchText.split('->')[1] : matchText.split(':')[1] || '';
          const points = content.split(/[\/]|(?:\s+e\s+)/i).map(s => {
            const trimmed = s.trim();
            if (!trimmed) return null;
            // Matches: (1.5 dB), 1.5dB, 1.5 dB, 5.7KM, (5.7 KM), 6.1 KM - 0.7dB
            const dbRegex = /([\d.,]+)\s*dB/i;
            const kmRegex = /([\d.,]+)\s*km/i;
            const dbM = trimmed.match(dbRegex);
            const kmM = trimmed.match(kmRegex);
            const dbVal = dbM ? parseFloat(dbM[1].replace(',', '.')) : 0;
            const kmVal = kmM ? parseFloat(kmM[1].replace(',', '.')) : 0;
            if (dbVal === 0 && kmVal === 0) return null;
            return { text: trimmed, db: dbVal, km: kmVal };
          }).filter((d): d is { text: string; db: number; km: number } => d !== null);
          rxData.push(...points);
        });
      }
      
      if (txMatch) {
        txMatch.forEach(matchText => {
          const content = matchText.includes('->') ? matchText.split('->')[1] : matchText.split(':')[1] || '';
          const points = content.split(/[\/]|(?:\s+e\s+)/i).map(s => {
            const trimmed = s.trim();
            if (!trimmed) return null;
            const dbRegex = /([\d.,]+)\s*dB/i;
            const kmRegex = /([\d.,]+)\s*km/i;
            const dbM = trimmed.match(dbRegex);
            const kmM = trimmed.match(kmRegex);
            const dbVal = dbM ? parseFloat(dbM[1].replace(',', '.')) : 0;
            const kmVal = kmM ? parseFloat(kmM[1].replace(',', '.')) : 0;
            if (dbVal === 0 && kmVal === 0) return null;
            return { text: trimmed, db: dbVal, km: kmVal };
          }).filter((d): d is { text: string; db: number; km: number } => d !== null);
          txData.push(...points);
        });
      }

      // Field Test patterns (F1 ->, Fibra XX:, etc.)
      const fieldGroups: { label: string; points: {text: string, db: number, km: number}[]; sum: number; count: number }[] = [];
      
      // Look for F1 ->, F2 -> patterns
      const arrowFieldParts = normalized.match(/F\d+\s*->(?:(?!(?:F\d+\s*->|RX\s*->|TX\s*->|Fibra\s*\d+\s*:)).)+/gi);
      // Look for Fibra 25: patterns
      const colonFieldParts = normalized.match(/Fibra\s*\d+\s*:(?:(?!(?:F\d+\s*->|RX\s*->|TX\s*->|Fibra\s*\d+\s*:)).)+/gi);
      
      const allFieldParts = [...(arrowFieldParts || []), ...(colonFieldParts || [])];

      if (allFieldParts.length > 0) {
        isFieldTest = true;
        allFieldParts.forEach(part => {
          const arrowLabelMatch = part.match(/(F\d+)\s*->/i);
          const colonLabelMatch = part.match(/Fibra\s*(\d+)\s*:/i);
          
          let label = 'F';
          let fiberNum = '';
          
          if (arrowLabelMatch) {
            label = arrowLabelMatch[1].toUpperCase();
            fiberNum = label.replace('F', '');
          } else if (colonLabelMatch) {
            fiberNum = colonLabelMatch[1];
            label = `F${fiberNum}`;
          }
          
          const displayLabel = `F${fiberNum} (Fibra ${fiberNum})`;
          
          // Split by separator '->' or ':' then by '/' or ' e '
          const contentPart = part.includes('->') ? part.split('->')[1] : part.split(':')[1] || '';
          
          // Improved point splitting (handles "/", " e ", and simple spaces if multiple measurements exist)
          const points = contentPart.split(/[\/]|(?:\s+e\s+)/i).map(s => {
            const trimmed = s.trim();
            if (!trimmed) return null;
            
            // Try to find db and km with or without parentheses
            // Matches: (1.5 dB), 1.5dB, 1.5 dB, 5.7KM, (5.7 KM)
            const dbMatch = trimmed.match(/([\d.,]+)\s*dB/i) || trimmed.match(/\(([\d.,]+)\s*dB\)/i);
            const kmMatch = trimmed.match(/([\d.,]+)\s*km/i) || trimmed.match(/\(([\d.,]+)\s*km\)/i);
            
            const dbValue = dbMatch ? parseFloat(dbMatch[1].replace(',', '.')) : 0;
            const kmValue = kmMatch ? parseFloat(kmMatch[1].replace(',', '.')) : 0;
            
            if (dbValue === 0 && kmValue === 0) return null;
            
            return { text: trimmed, db: dbValue, km: kmValue };
          }).filter((d): d is { text: string; db: number; km: number } => d !== null);

          if (points.length > 0) {
            const groupSum = points.reduce((acc, curr) => acc + curr.db, 0);
            fieldGroups.push({
              label: displayLabel,
              points: points,
              sum: groupSum,
              count: points.length
            });
            fieldData.push(...points.map(p => ({ ...p, label: displayLabel })));
          }
        });
      }

      const rxSumNum = rxData.reduce((acc, curr) => acc + curr.db, 0);
      const txSumNum = txData.reduce((acc, curr) => acc + curr.db, 0);
      const fieldSumNum = fieldData.reduce((acc, curr) => acc + curr.db, 0);
      const totalSumNum = rxSumNum + txSumNum + fieldSumNum;
      const totalPoints = rxData.length + txData.length + fieldData.length;

      return {
        local,
        tamanhoNum,
        rxData,
        txData,
        fieldData,
        fieldGroups,
        rxSumNum,
        txSumNum,
        fieldSumNum,
        totalSumNum,
        totalPoints,
        isFieldTest,
        rawPart: part
      };
    };

    const parsedSites = siteParts.map(parseSingleSite);
    
    if (parsedSites.length === 0) return { raw: text };

    // Use the first site as the primary reference for general stats
    const primary = parsedSites[0];
    
    // Bilateral Correlation Logic
    const correlations: { 
      siteA: string; 
      siteB: string; 
      matches: { pointA: any; pointB: any; diffKm: number; type: string }[] 
    }[] = [];

    if (parsedSites.length >= 2) {
      for (let i = 0; i < parsedSites.length; i++) {
        for (let j = i + 1; j < parsedSites.length; j++) {
          const siteA = parsedSites[i];
          const siteB = parsedSites[j];
          
          if (Math.abs(siteA.tamanhoNum - siteB.tamanhoNum) > 5) continue; // Must be somewhat same length trecho
          
          const totalLen = (siteA.tamanhoNum + siteB.tamanhoNum) / 2;
          const matches: any[] = [];
          const tolerance = 2.0; // 2km tolerance for technical reserve

          // Helper to find matches between two lists of points
          const findMatches = (listA: any[], listB: any[], type: string) => {
            listA.forEach(pa => {
              listB.forEach(pb => {
                // dA should be approx (TotalLen - dB)
                const targetKm = totalLen - pb.km;
                const diff = Math.abs(pa.km - targetKm);
                if (diff <= tolerance) {
                  matches.push({ pointA: pa, pointB: pb, diffKm: diff, type });
                }
              });
            });
          };

          findMatches(siteA.rxData, siteB.txData, 'RX/TX');
          findMatches(siteA.txData, siteB.rxData, 'TX/RX');
          findMatches(siteA.fieldData, siteB.fieldData, 'CAMPO');
          
          if (matches.length > 0) {
            correlations.push({
              siteA: siteA.local,
              siteB: siteB.local,
              matches
            });
          }
        }
      }
    }

    // Combined stats for complexity
    const allParsedKms = parsedSites.flatMap(s => [
      ...s.rxData.map(d => d.km), 
      ...s.txData.map(d => d.km), 
      ...s.fieldData.map(d => d.km)
    ]).filter(km => km > 0).sort((a, b) => a - b);

    const clusters: number[] = [];
    allParsedKms.forEach(km => {
      const clusterIndex = clusters.findIndex(c => Math.abs(c - km) <= 0.8);
      if (clusterIndex === -1) clusters.push(km);
    });

    const totalPointsAcrossSites = parsedSites.reduce((acc, s) => acc + s.totalPoints, 0);
    const totalSumAcrossSites = parsedSites.reduce((acc, s) => acc + s.totalSumNum, 0) + totalPiorasSum;
    const workZones = clusters.length;

    let complexity: 'Fácil' | 'Médio' | 'Difícil' = 'Médio';
    if ((totalPointsAcrossSites <= 3 && workZones <= 1) || totalSumAcrossSites <= 1.5) complexity = 'Fácil';
    else if (totalPointsAcrossSites > 7 || workZones > 4) complexity = 'Difícil';
    else if (totalPointsAcrossSites <= 5 && workZones <= 2) complexity = 'Médio';
    else complexity = 'Difícil';

    return {
      sites: parsedSites.map(s => ({
        local: s.local,
        tamanho: s.tamanhoNum.toLocaleString('pt-BR'),
        rxData: s.rxData,
        txData: s.txData,
        fieldData: s.fieldData,
        rx: s.rxData.map(d => d.text),
        tx: s.txData.map(d => d.text),
        fieldDataGrouped: s.fieldGroups,
        rxCount: s.rxData.length,
        txCount: s.txData.length,
        fieldCount: s.fieldData.length,
        rxSum: s.rxSumNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        txSum: s.txSumNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalSum: s.totalSumNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        isFieldTest: s.isFieldTest
      })),
      correlations,
      local: primary.local, 
      tamanho: primary.tamanhoNum.toLocaleString('pt-BR'),
      rxCount: primary.rxData.length,
      txCount: primary.txData.length,
      totalSum: (primary.totalSumNum + totalPiorasSum).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalPoints: totalPointsAcrossSites,
      complexity,
      workZones,
      isFieldTest: parsedSites.some(s => s.isFieldTest),
      isBilateral: parsedSites.length > 1,
      pioras,
      totalPiorasSum
    };
  };

  const getBypassForPoint = (trecho: string, siteLocal: string, km: number) => {
    if (!bypasses || bypasses.length === 0 || km === 0) return null;
    
    const normalizeLocal = (s: string) => (s || '').trim().replace(/-DC-\d+/gi, '').replace(/\s+/g, '').toUpperCase();
    const normalizeTrecho = (s: string) => {
      const parts = (s || '').split(/[<>\-]|>>|--/).map(p => p.trim().replace(/-DC-\d+/gi, '').replace(/\d+/g, '').toUpperCase()).filter(p => p.length > 2).sort();
      return parts.join('');
    };

    const nTrecho = normalizeTrecho(trecho);
    const nLocal = normalizeLocal(siteLocal);
    
    return bypasses.find(b => {
      const bT = normalizeTrecho(b.trechos);
      const bL = normalizeLocal(b.localInicial);
      
      // Handle multiple KMs in one string like "17 e 36 km"
      const kmsInBypass = b.pontoKm.match(/([\d.,]+)/g) || [];
      const kmMatches = kmsInBypass.some(kStr => {
        const bK = parseFloat(kStr.replace(',', '.'));
        return !isNaN(bK) && Math.abs(bK - km) <= 0.8;
      });

      const trechoMatch = bT !== '' && (bT === nTrecho || bT.includes(nTrecho) || nTrecho.includes(bT));
      const localMatch = bL !== '' && (nLocal.includes(bL) || bL.includes(nLocal));

      return trechoMatch && localMatch && kmMatches;
    });
  };

  const getSimuladorInfo = (ticketTrecho: string) => {
    if (!simuladorData || simuladorData.length === 0) return [];
    
    // Deeper normalization to handle "LAVRAS-DC-100" vs "LAVRAS(TX)"
    const normalizeStr = (s: string) => s.toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\(TX\)|\(RX\)/g, "") // Remove common simulator suffixes
      .replace(/-DC-\d+/gi, "")      // Remove station codes
      .replace(/[^A-Z]/g, " ")       // Keep only letters to find city names
      .trim();
    
    const ticketParts = ticketTrecho.split(/[<>\-]|>>|--/)
      .map(p => normalizeStr(p).replace(/\s/g, "")) // Remove internal spaces for lookup
      .filter(p => p.length > 2);
    
    if (ticketParts.length < 2) return [];

    return simuladorData.filter(item => {
      const simTrechoRaw = normalizeStr(item.trechoSimulador || "");
      const simParts = simTrechoRaw.split(/\s+/).filter(p => p.length > 2);
      
      // A match is found if both cities from the ticket are mentioned in the simulator row
      return ticketParts.every(tp => 
        simParts.some(sp => sp.includes(tp) || tp.includes(sp))
      );
    });
  };


  const getDbmStyle = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    if (isNaN(num)) return { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200', textInverse: 'text-slate-200' };
    
    // Round for precise comparison (matching the 2 decimal display)
    const rounded = Math.round(num * 100) / 100;
    
    if (rounded < -20) return { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', bgSolid: 'bg-rose-600', textInverse: 'text-rose-50' };
    if (rounded === -20) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bgSolid: 'bg-amber-500', textInverse: 'text-amber-50' };
    return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', bgSolid: 'bg-emerald-600', textInverse: 'text-emerald-50' };
  };

  const formatDbm = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  };

  const toggleRow = (idImoc: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(idImoc)) {
      newExpanded.delete(idImoc);
    } else {
      newExpanded.add(idImoc);
    }
    setExpandedRows(newExpanded);
  };

  const handleOpenModal = (mode: 'add' | 'edit', item?: Atenuacao) => {
    setModalMode(mode);
    setPasteBlock('');
    setSmartPasteText('');
    setSmartPasteFeedback(null);
    if (item) {
      setFormData(item);
      setOriginalIdImoc(item.idImoc || '');
      setRedeSearch(item.rede || '');
      setTrechoSearch(item.trecho || '');
      setIsTypingRede(false);
      setIsTypingTrecho(false);

      const parsed = parseDetalhamento(item.detalhamento) as any;
      if (parsed && parsed.sites && parsed.sites.length > 0) {
        const primarySite = parsed.sites[0];
        setValLocal(parsed.local || '');
        const rawTamanho = parsed.tamanho ? parsed.tamanho.replace(',', '.') : '';
        setValTamanho(rawTamanho);
        
        const rxList = (primarySite.rxData && primarySite.rxData.length > 0)
          ? primarySite.rxData.map((d: any) => ({ km: d.km.toString(), db: d.db.toString() }))
          : [{ km: '', db: '' }];
          
        const txList = (primarySite.txData && primarySite.txData.length > 0)
          ? primarySite.txData.map((d: any) => ({ km: d.km.toString(), db: d.db.toString() }))
          : [{ km: '', db: '' }];
          
        setDetalhesRX(rxList);
        setDetalhesTX(txList);
      } else {
        setValLocal('');
        setValTamanho('');
        setDetalhesRX([{ km: '', db: '' }]);
        setDetalhesTX([{ km: '', db: '' }]);
      }
    } else {
      setFormData({
        status: 'ABERTO',
        tipoChamado: 'TRECHO',
        sla: 'Médio',
        dataAbertura: new Date().toLocaleDateString('pt-BR'),
        perdas: 0,
        detalhamento: ''
      });
      setValLocal('');
      setValTamanho('');
      setDetalhesRX([{ km: '', db: '' }]);
      setDetalhesTX([{ km: '', db: '' }]);
      setRedeSearch('');
      setTrechoSearch('');
      setIsTypingRede(false);
      setIsTypingTrecho(false);
    }
    setIsModalOpen(true);
  };

  const uniqueRedes = Array.from(new Set(redeTrechoOptions.map(o => o.rede))).sort();
  const filteredRedes = (redeSearch === '' || !isTypingRede)
    ? uniqueRedes 
    : uniqueRedes.filter(r => r.toLowerCase().includes(redeSearch.toLowerCase()));
  
  const allTrechos = useMemo(() => {
    const rawActive = (formData.rede || '').trim().toUpperCase();
    const activeRede = rawActive.replace(/-\d+(?=\s|\b|$|\()/g, "").replace(/\s*<>\s*/g, " <> ").trim();
    const options = activeRede
      ? redeTrechoOptions.filter(o => {
          const optRede = o.rede.trim().toUpperCase().replace(/-\d+(?=\s|\b|$|\()/g, "").replace(/\s*<>\s*/g, " <> ").trim();
          return optRede === activeRede;
        })
      : redeTrechoOptions;
    const targetOptions = options.length > 0 ? options : redeTrechoOptions;
    return Array.from(new Set(targetOptions.map(o => o.trecho))).sort();
  }, [redeTrechoOptions, formData.rede]);
    
  const filteredTrechos = (trechoSearch === '' || !isTypingTrecho)
    ? allTrechos
    : allTrechos.filter(t => t.toLowerCase().includes(trechoSearch.toLowerCase()));

  const calculateDays = (start: string, end?: string) => {
    if (!start) return 0;
    const cleanStart = formatToLocalDate(start);
    const [d, m, y] = cleanStart.split('/').map(Number);
    const startDate = new Date(y, m - 1, d);
    
    let endDate = new Date();
    if (end) {
      const cleanEnd = formatToLocalDate(end);
      const [ed, em, ey] = cleanEnd.split('/').map(Number);
      endDate = new Date(ey, em - 1, ed);
    }
    
    const diffTime = endDate.getTime() - startDate.getTime();
    if (isNaN(diffTime)) return 0;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const displayAtenuacoes = useMemo(() => {
    return filteredAtenuacoes.filter(a => {
      // 0. Base Filter: Exclude TESTES from this view (they have their own page)
      const itemType = (a.tipoChamado || '').toString().trim().toUpperCase();
      if (itemType === 'TESTES') return false;

      // 1. Text Search Input (by ID IMOC, Trecho, or Rede)
      if (textSearch.trim() !== '') {
        const query = textSearch.trim().toLowerCase();
        const matchesId = String(a.idImoc || '').toLowerCase().includes(query);
        const matchesTrecho = String(a.trecho || '').toLowerCase().includes(query);
        const matchesRede = String(a.rede || '').toLowerCase().includes(query);
        if (!matchesId && !matchesTrecho && !matchesRede) return false;
      }

      // 2. Date Period/Range Filter (Data Abertura of format DD/MM/YYYY)
      if (startDate || endDate) {
        if (!a.dataAbertura) return false;
        try {
          const cleanDate = formatToLocalDate(a.dataAbertura);
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
          console.error("Erro ao formatar data no filtro de período:", e);
        }
      }

      // 3. Status Filter
      if (statusFilter.length > 0) {
        const itemStatus = (a.status || '').toString().trim().toUpperCase();
        const matchesStatus = statusFilter.some(s => s.trim().toUpperCase() === itemStatus);
        if (!matchesStatus) return false;
      }

      // 4. Type Filter
      if (typeFilter.length > 0) {
        const matchesType = typeFilter.some(t => t.trim().toUpperCase() === itemType);
        if (!matchesType) return false;
      }

      // 5. Complexity Filter
      if (complexityFilter.length > 0) {
        if (itemType !== 'TESTES') {
          const details = parseDetalhamento(a.detalhamento, a.pioras);
          const itemComplexity = (details && 'complexity' in details) ? details.complexity : 'Indeterminado';
          const matchesComplexity = complexityFilter.some(c => 
            c.trim().toUpperCase() === itemComplexity.trim().toUpperCase()
          );
          if (!matchesComplexity) return false;
        }
      }

      // 6. Simulador Filter
      if (simuladorFilter.length > 0) {
        const simMatches = getSimuladorInfo(a.trecho);
        if (simMatches.length === 0) return false; // Hide if no simulator data matches a selected state
        
        const bestSim = simMatches[0];
        const val = typeof bestSim.valorPorCanal === 'number' ? bestSim.valorPorCanal : parseFloat(String(bestSim.valorPorCanal || "0").replace(',', '.'));
        if (isNaN(val)) return false;

        const rounded = Math.round(val * 100) / 100;
        let itemStatus = '';
        if (rounded < -20) itemStatus = 'CRÍTICO';
        else if (rounded === -20) itemStatus = 'ALINHAMENTO';
        else itemStatus = 'CONFORME';

        if (!simuladorFilter.includes(itemStatus)) return false;
      }

      return true;
    });
  }, [filteredAtenuacoes, statusFilter, typeFilter, complexityFilter, simuladorFilter, textSearch, startDate, endDate]);

  const callTypes = useMemo(() => {
    const defaults = ['TRECHO', 'POS ROMPIMENTO', 'CH - SWAP'];
    const fromData = Array.from(new Set(
      filteredAtenuacoes
        .map(a => (a.tipoChamado || '').toString().trim().toUpperCase())
        .filter(t => t && t.length > 0 && t !== 'TESTES')
    ));
    
    // Sort combined types, keeping defaults first if possible or just sorting all
    const combined = Array.from(new Set([...defaults, ...fromData])).sort();
    return combined;
  }, [filteredAtenuacoes]);

  const totalLossPoints = displayAtenuacoes.reduce((acc, curr) => {
    const details = parseDetalhamento(curr.detalhamento, curr.pioras);
    if (!details || 'raw' in details) return acc;
    return acc + (details.totalPoints || 0);
  }, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 text-slate-800 font-sans"
    >
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-blue-500 rounded-full inline-block"></span>
            Atenuações de Redes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Verifique e registre as perdas excessivas de potência óptica, atenuações e degradações nos links de fibra monitorados.
          </p>
        </div>
        {currentUser?.permissions?.atenuacoes?.editar && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenModal('add')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold transition cursor-pointer select-none shrink-0"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Novo Registro</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total de Chamados</p>
              <p className="text-2xl font-black text-slate-800">{displayAtenuacoes.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <RefreshCw className="text-blue-600" size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pontos de Perda Mapeados</p>
              <p className="text-2xl font-black text-rose-600">{totalLossPoints}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl">
              <AlertCircle className="text-rose-600" size={24} />
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
                onClick={() => setStatusFilter(['ABERTO'])}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 border",
                  statusFilter.length === 1 && statusFilter[0] === 'ABERTO'
                    ? "bg-amber-500/10 text-amber-700 border-amber-500/20 shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Demandas Abertas
              </button>
              <button
                onClick={() => setStatusFilter(['FECHADO'])}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 border",
                  statusFilter.length === 1 && statusFilter[0] === 'FECHADO'
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

          {/* 2. Busca e Período (Demais Filtros) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                placeholder="Buscar por ID IMOC, Trecho ou Rede..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 placeholder-slate-400 bg-slate-50/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 font-mono">Início:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 bg-slate-50/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 font-mono">Fim:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:border-blue-500 bg-slate-50/50"
              />
              {(startDate || endDate || textSearch || statusFilter.length > 0 || complexityFilter.length > 0 || typeFilter.length > 0) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setTextSearch('');
                    setStatusFilter([]);
                    setComplexityFilter([]);
                    setTypeFilter([]);
                  }}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                  title="Limpar todos os filtros"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* 3. Filtros Avançados / Dropdowns da página */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mr-2 border-r pr-4 border-slate-200">
              <Filter size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Filtros Avançados</span>
            </div>

            {/* Complexity Filter */}
            <div className="relative">
              <button 
                onClick={() => setActiveFilterMenu(activeFilterMenu === 'complexity' ? null : 'complexity')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                  complexityFilter.length > 0 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                    : "bg-slate-55 border-slate-200 text-slate-600 hover:bg-slate-105"
                )}
              >
                Complexidade: {complexityFilter.length === 0 ? 'Todas' : `${complexityFilter.length} selecionadas`}
                <ChevronDown size={14} className={cn("transition-transform", activeFilterMenu === 'complexity' && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {activeFilterMenu === 'complexity' && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setActiveFilterMenu(null)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 space-y-1"
                    >
                      {(['Fácil', 'Médio', 'Difícil', 'Indeterminado'] as const).map(c => (
                        <button
                          key={c}
                          onClick={() => toggleFilter(complexityFilter, c, setComplexityFilter)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors",
                            complexityFilter.includes(c) ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {c}
                          {complexityFilter.includes(c) && <CheckCircle2 size={14} />}
                        </button>
                      ))}
                      {complexityFilter.length > 0 && (
                        <button 
                          onClick={() => setComplexityFilter([])}
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

            {/* Type Filter */}
            <div className="relative">
              <button 
                onClick={() => setActiveFilterMenu(activeFilterMenu === 'type' ? null : 'type')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                  typeFilter.length > 0 
                    ? "bg-slate-900 border-slate-800 text-white" 
                    : "bg-slate-55 border-slate-200 text-slate-600 hover:bg-slate-105"
                )}
              >
                Tipo: {typeFilter.length === 0 ? 'Todos' : `${typeFilter.length} selecionados`}
                <ChevronDown size={14} className={cn("transition-transform", activeFilterMenu === 'type' && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {activeFilterMenu === 'type' && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setActiveFilterMenu(null)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 space-y-1 max-h-[300px] overflow-y-auto"
                    >
                      {callTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => toggleFilter(typeFilter, t, setTypeFilter)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors",
                            typeFilter.includes(t) ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {t}
                          {typeFilter.includes(t) && <CheckCircle2 size={14} />}
                        </button>
                      ))}
                      {typeFilter.length > 0 && (
                        <button 
                          onClick={() => setTypeFilter([])}
                          className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider pt-2 border-t border-slate-50 mt-1 sticky bottom-0 bg-white"
                        >
                          Limpar Filtro
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {(statusFilter.length > 0 || complexityFilter.length > 0 || typeFilter.length > 0) && (
              <button 
                onClick={() => {
                  setStatusFilter([]);
                  setComplexityFilter([]);
                  setTypeFilter([]);
                }}
                className="ml-auto text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
              >
                <X size={14} />
                Limpar Todos
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h3 className="font-bold text-slate-800">Lista Completa de Atenuações</h3>
            <p className="text-sm text-slate-500">Monitoramento de perdas de sinal por trecho</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 font-medium hidden sm:block">{displayAtenuacoes.length} registros encontrados</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Status / Abertura</th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trecho / Tipo</th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">ID IMOC / Atuações</th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Perdas</th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {displayAtenuacoes.map((item, idx) => {
                const isExpanded = expandedRows.has(item.idImoc);
                const details = parseDetalhamento(item.detalhamento, item.pioras);
                return (
                  <React.Fragment key={`${item.idImoc}-${idx}`}>
                    <tr className={cn(
                      "hover:bg-slate-50 transition-colors group cursor-pointer",
                      isExpanded && "bg-blue-50/30"
                    )} onClick={() => toggleRow(item.idImoc)}>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <span className={cn(
                            "flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-[10px] font-black",
                            item.status === 'ABERTO' ? "bg-amber-100/80 text-amber-800" : "bg-emerald-100/80 text-emerald-800"
                          )}>
                            {item.status === 'ABERTO' ? <Clock size={10} /> : <CheckCircle2 size={10} />}
                            {item.status}
                          </span>
                          <span className="text-xs font-bold text-slate-600 block leading-none">
                            {formatToLocalDate(item.dataAbertura)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block leading-none">
                            {calculateDays(item.dataAbertura, item.status === 'FECHADO' ? item.dataConclusao : undefined)} dias
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-700 block leading-tight max-w-[280px]" title={item.trecho}>
                            {item.trecho}
                          </span>
                          <span className="inline-block text-[10px] font-black text-indigo-750 bg-indigo-50/85 border border-indigo-100/40 px-1.5 py-0.5 rounded uppercase tracking-wide">
                            {item.tipoChamado}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <span className="font-mono text-xs font-black text-slate-600 block leading-none">
                            {item.idImoc}
                          </span>
                          {(() => {
                            const itemAtuacoes = (allAtuacoes || []).filter(a => 
                              String(a.idImoc || '').trim() === String(item.idImoc || '').trim()
                            );
                            const countAtuacoes = itemAtuacoes.length;
                            return (
                              <span className={cn(
                                "inline-block text-[10px] font-bold px-1.5 py-0.5 rounded leading-none select-none",
                                countAtuacoes > 0 ? "bg-indigo-55/70 text-indigo-700 font-black" : "bg-slate-100 text-slate-400 font-medium"
                              )}>
                                {countAtuacoes} {countAtuacoes === 1 ? 'atuação' : 'atuações'}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs font-black text-rose-600 whitespace-nowrap">{item.perdas} dB</span>
                          {details && 'totalPoints' in details && (details as any).totalPoints > 0 && (
                            <span 
                              className="flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full bg-slate-100 text-[9px] font-black text-slate-400 border border-slate-200" 
                              title={`${(details as any).totalPoints} ${(details as any).totalPoints === 1 ? 'evento identificado' : 'eventos identificados'}`}
                            >
                              {(details as any).totalPoints}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 box-border">
                          <button 
                            onClick={() => toggleRow(item.idImoc)}
                            className={cn(
                              "p-1 rounded-lg transition-colors cursor-pointer",
                              isExpanded ? "text-blue-600 bg-blue-100/80" : "text-slate-400 hover:text-blue-500 hover:bg-slate-100"
                            )}
                            title="Ver Detalhes"
                          >
                            <Info size={14} />
                          </button>
                          {currentUser?.permissions?.atenuacoes?.editar && (
                            <>
                              <button 
                                onClick={() => handleOpenModal('edit', item)}
                                className="p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => handleOpenPioraModal(item)}
                                className="p-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Inserir Piora"
                              >
                                <TrendingDown size={14} />
                              </button>
                              {item.status !== "FECHADO" && (
                                <button 
                                  onClick={() => {
                                    onStartFinalize?.(item);
                                  }}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Finalizar"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                            </>
                          )}
                          {currentUser?.permissions?.atenuacoes?.excluir && (
                            <button 
                              onClick={() => onDelete?.(item.idImoc)}
                              className="p-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-0 bg-slate-50/50">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="py-4 space-y-4">
                                {(() => {
                                  const detailsObj = parseDetalhamento(item.detalhamento, item.pioras);
                                  const pioras = detailsObj && 'pioras' in detailsObj ? (detailsObj as any).pioras : [];
                                  
                                  return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Acréscimo de Perdas Card */}
                                      <div className="bg-gradient-to-br from-rose-50/40 to-rose-100/20 border border-rose-100 rounded-2xl p-4 shadow-xs flex items-center justify-between font-sans">
                                        <div className="space-y-1 select-none">
                                          <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider font-semibold">Acréscimo de Perdas Atual (Pioras)</p>
                                          <p className="text-xl font-bold text-rose-700 tracking-tight font-sans">
                                            +{pioras.reduce((acc: number, p: any) => acc + (p.db || 0), 0).toFixed(2).replace('.', ',')} <span className="text-xs font-bold">dB</span>
                                          </p>
                                          <p className="text-[9px] font-bold text-slate-450">
                                            Soma de {pioras.length} {pioras.length === 1 ? 'piora' : 'pioras'}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleOpenPioraModal(item)}
                                            title="Registrar nova piora"
                                            className="px-2.5 py-1.5 transition text-[9px] font-black uppercase text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 cursor-pointer flex items-center gap-1 shrink-0 select-none shadow-xs"
                                          >
                                            <PlusCircle className="w-3 px-1" />
                                            <span>Inserir Piora</span>
                                          </button>
                                          <div className="bg-rose-500/10 p-2 rounded-xl shrink-0">
                                            <AlertCircle className="text-rose-500" size={18} />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Geração de Relatórios Card */}
                                      <div className="bg-gradient-to-br from-indigo-50/60 to-indigo-100/20 border border-indigo-100 rounded-2xl p-4 shadow-xs flex items-center justify-between font-sans">
                                        <div className="space-y-1 select-none">
                                          <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider font-semibold">Consolidado e Relatórios</p>
                                          <p className="text-[11px] text-slate-500 font-medium select-none max-w-[200px] leading-tight mt-0.5">
                                            Conciliação final de perdas, ganhos e relatórios em texto padrão.
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => {
                                            setReportItem(item);
                                            setIsReportModalOpen(true);
                                          }}
                                          className="bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-[10px] uppercase px-3 py-2 rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none select-none"
                                        >
                                          <FileText size={12} />
                                          <span>Gerar Relatório</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="w-full">
                                  {(() => {
                                    const details = parseDetalhamento(item.detalhamento);
                                    if (!details) return (
                                      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 italic text-center">
                                        Nenhum detalhamento de pontos de medição disponível para este chamado.
                                      </div>
                                    );

                                    if ('raw' in details) return (
                                      <div className="bg-white border border-slate-200 rounded-2xl p-4">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Detalhamento Geral</p>
                                        <p className="text-sm text-slate-700">{details.raw}</p>
                                      </div>
                                    );

                                    const sitesCount = details.sites?.length || 0;
                                    const hasCorrelations = details.isBilateral && details.correlations?.length > 0;
                                    
                                    let gridColsClass = "grid-cols-1";
                                    if (sitesCount === 2 && hasCorrelations) {
                                      gridColsClass = "grid-cols-1 lg:grid-cols-3";
                                    } else if (sitesCount === 2 || hasCorrelations) {
                                      gridColsClass = "grid-cols-1 lg:grid-cols-2";
                                    } else {
                                      gridColsClass = "grid-cols-1";
                                    }

                                    return (
                                      <div className={cn("grid gap-4 w-full", gridColsClass)}>
                                        {/* Loop through each test point/site */}
                                        {details.sites.map((site: any, sIdx: number) => (
                                          <div key={sIdx} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between">
                                            {/* Compact Site Header with Badges */}
                                            <div className="flex flex-col gap-2 bg-slate-50/75 p-3 rounded-xl border border-slate-100">
                                              <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                <span className="text-xs font-black text-slate-800 tracking-tight uppercase line-clamp-1" title={site.local}>
                                                  Ponto: {site.local || 'Não informado'}
                                                </span>
                                              </div>
                                              
                                              <div className="flex flex-wrap items-center gap-1 text-[10px] font-extrabold select-none">
                                                <span className="bg-slate-100 border border-slate-200/60 text-slate-600 px-2 py-0.5 rounded-md">
                                                  Tamanho: {site.tamanho ? `${site.tamanho} KM` : 'N/I'}
                                                </span>
                                                <span className="bg-amber-50 border border-amber-100/60 text-amber-700 px-2 py-0.5 rounded-md">
                                                  Conclusão: {formatToLocalDate(item.dataConclusao) || 'Pendente'}
                                                </span>
                                                {site.isFieldTest && (
                                                  <span className="bg-indigo-100 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                                    CAMPO
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Site Losses (Inline Lists) */}
                                            <div className="flex-1 space-y-3 pt-1">
                                              {/* Field Data Grouped */}
                                              {site.fieldDataGrouped && site.fieldDataGrouped.length > 0 && site.fieldDataGrouped.map((group: any, gIdx: number) => (
                                                <div key={gIdx} className="bg-slate-50/40 border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                                                  <div className="flex items-center justify-between text-[10px] select-none">
                                                    <span className="font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate max-w-[140px]" title={group.label}>
                                                      <span className="w-1 h-1 rounded-full bg-indigo-600" />
                                                      {group.label}
                                                    </span>
                                                    <span className="font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md text-[9px] shrink-0">
                                                      {group.count} pts | {group.sum.toFixed(1)} dB
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1">
                                                    {group.points.map((pt: any, pIdx: number) => {
                                                      const pointObj = typeof pt === 'string' ? { text: pt, km: 0 } : pt;
                                                      const bp = getBypassForPoint(item.trecho, site.local, pointObj.km);
                                                      return (
                                                        <span 
                                                          key={pIdx} 
                                                          title={bp ? `Bypass Detectado: ${bp.observacao}` : undefined}
                                                          className={cn(
                                                            "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center gap-0.5 whitespace-nowrap",
                                                            bp 
                                                              ? "bg-blue-600 text-white border-blue-400" 
                                                              : "bg-indigo-50 text-indigo-700 border-indigo-100/50"
                                                          )}
                                                        >
                                                          {bp && <Activity size={7} />}
                                                          {pointObj.text}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              ))}

                                              {/* RX Losses */}
                                              {site.rxData && site.rxData.length > 0 && (
                                                <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                                                  <div className="flex items-center justify-between text-[10px] select-none">
                                                    <span className="font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate max-w-[140px]">
                                                      <span className="w-1 h-1 rounded-full bg-blue-500" />
                                                      Perdas RX
                                                    </span>
                                                    <span className="font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md text-[9px] shrink-0">
                                                      {site.rxCount} pts | {site.rxSum} dB
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1">
                                                    {site.rxData.map((pt: any, rIdx: number) => {
                                                      const bp = getBypassForPoint(item.trecho, site.local, pt.km);
                                                      return (
                                                        <span 
                                                          key={rIdx} 
                                                          title={bp ? `Bypass Detectado: ${bp.observacao}` : undefined}
                                                          className={cn(
                                                            "px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-0.5 whitespace-nowrap",
                                                            bp 
                                                              ? "bg-blue-600 text-white border-blue-400" 
                                                              : "bg-blue-50 text-blue-700 border-blue-100"
                                                          )}
                                                        >
                                                          {bp && <Activity size={7} />}
                                                          {pt.text}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}

                                              {/* TX Losses */}
                                              {site.txData && site.txData.length > 0 && (
                                                <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                                                  <div className="flex items-center justify-between text-[10px] select-none">
                                                    <span className="font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate max-w-[140px]">
                                                      <span className="w-1 h-1 rounded-full bg-rose-500" />
                                                      Perdas TX
                                                    </span>
                                                    <span className="font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md text-[9px] shrink-0">
                                                      {site.txCount} pts | {site.txSum} dB
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1">
                                                    {site.txData.map((pt: any, tIdx: number) => {
                                                      const bp = getBypassForPoint(item.trecho, site.local, pt.km);
                                                      return (
                                                        <span 
                                                          key={tIdx} 
                                                          title={bp ? `Bypass Detectado: ${bp.observacao}` : undefined}
                                                          className={cn(
                                                            "px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-0.5 whitespace-nowrap",
                                                            bp 
                                                              ? "bg-blue-600 text-white border-blue-400" 
                                                              : "bg-rose-50 text-rose-705 border-rose-100"
                                                          )}
                                                        >
                                                          {bp && <Activity size={7} />}
                                                          {pt.text}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}

                                        {/* Bilateral Correlation Analysis inside the same dynamic grid layout */}
                                        {hasCorrelations && (() => {
                                          const isCorrExpanded = !!expandedCorrelations[item.idImoc];
                                          return (
                                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
                                              {/* Toggle Header */}
                                              <button 
                                                onClick={() => setExpandedCorrelations(prev => ({
                                                  ...prev,
                                                  [item.idImoc]: !isCorrExpanded
                                                }))}
                                                className="w-full text-left p-3.5 bg-gradient-to-r from-indigo-700 to-purple-800 hover:from-indigo-800 hover:to-purple-900 text-white flex items-center justify-between cursor-pointer border-none font-sans select-none animate-none"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <RefreshCw className={cn("text-indigo-200", isCorrExpanded && "animate-spin-slow")} size={14} />
                                                  <div className="leading-none">
                                                    <h4 className="font-bold text-xs">Pontos Recíprocos</h4>
                                                    <span className="text-[9px] text-indigo-300 uppercase font-black tracking-wider leading-none">
                                                      {isCorrExpanded ? 'Aberto' : 'Clique para ver'}
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <span className="text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded-full select-none">
                                                    {details.correlations.length} pts
                                                  </span>
                                                  {isCorrExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                </div>
                                              </button>

                                              {/* Body area */}
                                              <div className="flex-1 bg-[#0b0f24] min-h-[140px] flex flex-col justify-between">
                                                {isCorrExpanded ? (
                                                  <div className="p-3 space-y-2 text-white max-h-[220px] overflow-y-auto font-mono text-[10px]">
                                                    {details.correlations.map((corr: any, cIdx: number) => (
                                                      <div key={cIdx} className="bg-white/5 rounded-lg p-2 border border-white/5 space-y-1.5">
                                                        <div className="flex items-center justify-between text-[8px] text-indigo-300 font-sans border-b border-white/5 pb-1">
                                                          <span className="truncate max-w-[90px]" title={corr.siteA}>{corr.siteA}</span>
                                                          <span>⇄</span>
                                                          <span className="truncate max-w-[90px]" title={corr.siteB}>{corr.siteB}</span>
                                                        </div>
                                                        <div className="space-y-1">
                                                          {corr.matches.map((m: any, mIdx: number) => (
                                                            <div key={mIdx} className="flex items-center justify-between bg-white/5 p-1 rounded hover:bg-white/10 transition-all text-[9.5px]">
                                                              <span className="font-bold truncate max-w-[70px] text-slate-100" title={m.pointA.text}>{m.pointA.text}</span>
                                                              <span className="text-[8px] font-black bg-emerald-400 text-emerald-950 px-1 py-0.5 rounded-full shrink-0 scale-90" title={`Diferença: ${m.diffKm.toFixed(2)} km`}>
                                                                Δ{m.diffKm.toFixed(1)}k
                                                              </span>
                                                              <span className="font-bold truncate max-w-[70px] text-slate-100" title={m.pointB.text}>{m.pointB.text}</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-slate-400 space-y-1.5">
                                                    <span className="text-[11px] font-bold text-indigo-300">Análise de Correlações</span>
                                                    <p className="text-[9px] text-slate-500 max-w-[160px] leading-snug">Visualização otimizada de eventos entre os sites de medição.</p>
                                                    <button 
                                                      onClick={() => setExpandedCorrelations(prev => ({ ...prev, [item.idImoc]: true }))}
                                                      className="text-[9px] text-indigo-400 hover:text-white underline font-sans border-none bg-transparent cursor-pointer font-bold select-none"
                                                    >
                                                      Expandir Análise
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Bypass Section */}
                                {(() => {
                                  const normalize = (s: string) => (s || '').replace(/\s+/g, '').replace(/<>/g, '').replace(/>>/g, '').toUpperCase();
                                  const itemBypasses = (bypasses || []).filter(b => {
                                    const bT = normalize(b.trechos);
                                    const iT = normalize(item.trecho);
                                    return bT !== '' && iT !== '' && (bT === iT || bT.includes(iT) || iT.includes(bT));
                                  });

                                  if (itemBypasses.length === 0) return null;

                                  return (
                                    <div className="col-span-4 mt-2">
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <div className="p-1 bg-blue-100 rounded-lg">
                                          <Activity size={14} className="text-blue-600" />
                                        </div>
                                        <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Bypasses Identificados no Trecho</h4>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {itemBypasses.map((bp, bIdx) => (
                                          <div key={bIdx} className="bg-gradient-to-r from-blue-50 to-white border border-blue-100 rounded-xl p-4 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
                                            <div className="absolute top-0 right-0">
                                              <span className="text-[8px] font-black bg-blue-600 text-white px-2.5 py-0.5 rounded-bl-lg tracking-wider">BYPASS ATIVO</span>
                                            </div>
                                            
                                            <div className="flex items-start gap-3">
                                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                                                <Activity size={16} className="text-blue-600" />
                                              </div>
                                              <div className="space-y-0.5">
                                                <div className="flex flex-wrap items-baseline gap-x-1 text-xs">
                                                  <span className="text-slate-500 text-[11px]">Local inicial em</span>
                                                  <span className="font-extrabold text-slate-800 text-[11px]">{bp.localInicial}</span>
                                                  <span className="text-slate-500 text-[11px]">tem a</span>
                                                  <span className="font-extrabold text-blue-700 text-[11px]">{bp.pontoKm}</span>
                                                  <span className="text-slate-500 text-[11px]">o bypass que é</span>
                                                </div>
                                                <p className="text-sm font-extrabold text-slate-900 tracking-tight">
                                                  {bp.observacao || 'Informação não detalhada'}
                                                </p>
                                                {bp.direcao && (
                                                  <div className="flex items-center gap-1 mt-0.5 text-[9px] font-bold text-slate-400">
                                                    <span className="text-blue-450">●</span> DIREÇÃO: {bp.direcao}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {(() => {
                                  const detailsObj = parseDetalhamento(item.detalhamento, item.pioras);
                                  const pioras = detailsObj && 'pioras' in detailsObj ? (detailsObj as any).pioras : [];
                                  const itemAtuacoes = (allAtuacoes || []).filter(a => 
                                    String(a.idImoc || '').trim() === String(item.idImoc || '').trim()
                                  );

                                  return (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-sans">
                                        {/* COLUNA ESQUERDA: HISTÓRICO DE PIORAS NO TRECHO */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                                          <div className="flex items-center justify-between pb-1 border-b border-slate-200 font-sans">
                                            <div className="flex items-center gap-2">
                                              <TrendingDown className="text-rose-500" size={14} />
                                              <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-wider font-mono">
                                                Histórico de Pioras no Trecho (Acréscimos)
                                              </h4>
                                            </div>
                                            <button
                                              onClick={() => handleOpenPioraModal(item)}
                                              title="Registrar nova piora"
                                              className="text-rose-600 hover:text-white hover:bg-rose-500 px-2.5 py-1 text-[9px] uppercase font-black tracking-wider rounded-xl border border-rose-500/30 transition duration-200 cursor-pointer flex items-center gap-1"
                                            >
                                              <PlusCircle className="w-3 h-3 text-rose-500 group-hover:text-white" />
                                              <span>Nova Piora</span>
                                            </button>
                                          </div>
                                          
                                          <div className="max-h-60 overflow-y-auto pr-1 space-y-3 font-mono text-[11px]">
                                            {pioras.length === 0 ? (
                                              <p className="text-slate-400 italic text-[10px] pl-1 pt-1 font-sans">
                                                Nenhuma piora ou atenuação acrescida registrada.
                                              </p>
                                            ) : (
                                              <div className="relative border-l border-slate-200 pl-3.5 py-1 space-y-3">
                                                {pioras.map((p: any, pIdx: number) => {
                                                  return (
                                                    <div key={pIdx} className="relative group/piora text-left">
                                                      <span className="absolute -left-[19.5px] top-1.5 w-2 h-2 rounded-full border border-white bg-rose-500 shadow-sm shadow-rose-500/40"></span>
                                                      
                                                      <div className="space-y-0.5">
                                                        <div className="flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap font-sans">
                                                          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                                                            {formatToLocalDate(p.data) || 'Sem data'}
                                                          </span>
                                                          
                                                          <div className="flex items-center gap-2">
                                                            {p.db > 0 ? (
                                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-50 text-rose-600 border border-rose-100 uppercase select-none">
                                                                +{p.db.toFixed(2).replace('.', ',')} dB
                                                              </span>
                                                            ) : (
                                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-600 border border-amber-100 uppercase select-none">
                                                                Reg
                                                              </span>
                                                            )}

                                                            {/* Edit & Delete Action Buttons (only for those stored in piorasField) */}
                                                            {p.source === 'pioras' && (
                                                              <div className="flex items-center gap-0.5 opacity-40 group-hover/piora:opacity-100 transition">
                                                                <button
                                                                  onClick={() => setEditingPiora({ item, originalIdx: p.originalIdx, data: p.data, db: p.db, descricao: p.descricao })}
                                                                  className="p-0.5 rounded text-teal-600 hover:bg-teal-50 hover:text-teal-700 transition cursor-pointer border-none bg-transparent"
                                                                  title="Editar piora"
                                                                >
                                                                  <Edit className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                  onClick={() => setDeletingPiora({ item, originalIdx: p.originalIdx, db: p.db })}
                                                                  className="p-0.5 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer border-none bg-transparent"
                                                                  title="Excluir piora"
                                                                >
                                                                  <Trash2 className="w-3 h-3" />
                                                                </button>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                        
                                                        <div className="text-slate-700 text-xs leading-relaxed font-sans font-medium whitespace-pre-wrap">
                                                          <div className="flex items-start gap-1">
                                                            <span className="text-slate-400 font-bold font-mono text-[10px] select-none shrink-0">• Motivo:</span>
                                                            <span>{p.descricao || 'Sem descrição'}</span>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* COLUNA DIREITA: HISTÓRICO DE ATUAÇÕES E ATAS DE CAMPO */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                                          <div className="flex items-center justify-between pb-1 border-b border-slate-200 font-sans">
                                            <div className="flex items-center gap-2">
                                              <Briefcase className="text-indigo-600" size={14} />
                                              <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-wider font-mono">
                                                Histórico de Atuações em Campo
                                              </h4>
                                            </div>
                                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-mono border border-indigo-100">
                                              {itemAtuacoes.length} {itemAtuacoes.length === 1 ? 'reg' : 'regs'}
                                            </span>
                                          </div>
                                          
                                          <div className="max-h-60 overflow-y-auto pr-1 space-y-3 font-mono text-[11px]">
                                            {itemAtuacoes.length === 0 ? (
                                              <p className="text-slate-400 italic text-[10px] pl-1 pt-1 font-sans">
                                                Nenhuma atuação em campo registrada para este IMOC.
                                              </p>
                                            ) : (
                                              <div className="relative border-l border-slate-200 pl-3.5 py-1 space-y-3">
                                                {itemAtuacoes.map((at, atIdx) => {
                                                  return (
                                                    <div key={atIdx} className="relative group/atuacao text-left">
                                                      <span className="absolute -left-[19.5px] top-1.5 w-2 h-2 rounded-full border border-white bg-indigo-500 shadow-sm shadow-indigo-500/40"></span>
                                                      
                                                      <div className="space-y-0.5">
                                                        <div className="flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap font-sans">
                                                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                                            {formatToLocalDate(at.dataAbertura || at.data) || 'Sem data'} - {at.empresas || 'BRISANET'}
                                                          </span>
                                                          
                                                          <div className="flex items-center gap-2">
                                                            <span className={cn(
                                                              "px-1.5 py-0.5 rounded text-[9px] font-semibold border uppercase tracking-wider select-none",
                                                              String(at.status).toUpperCase().includes("CONCLU") || String(at.status).toUpperCase().includes("SUCCESS")
                                                                ? "text-emerald-700 border-emerald-100 bg-emerald-50"
                                                                : "text-amber-700 border-amber-100 bg-amber-50"
                                                            )}>
                                                              {at.status || 'Ativo'}
                                                            </span>

                                                            {/* Edit & Delete Action Buttons for Atuacoes */}
                                                            <div className="flex items-center gap-0.5 opacity-40 group-hover/atuacao:opacity-100 transition">
                                                              <button
                                                                onClick={() => setEditingAtuacao(at)}
                                                                className="p-0.5 rounded text-teal-600 hover:bg-teal-50 hover:text-teal-700 transition cursor-pointer border-none bg-transparent"
                                                                title="Editar atuação"
                                                              >
                                                                <Edit className="w-3 h-3" />
                                                              </button>
                                                              <button
                                                                onClick={() => setDeletingAtuacao(at)}
                                                                className="p-0.5 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer border-none bg-transparent"
                                                                title="Excluir atuação"
                                                              >
                                                                <Trash2 className="w-3 h-3" />
                                                              </button>
                                                            </div>
                                                          </div>
                                                        </div>
                                                        
                                                        <div className="text-slate-700 text-xs leading-relaxed font-sans font-medium whitespace-pre-wrap">
                                                          {at.motivo && (
                                                            <div className="flex items-start gap-1">
                                                              <span className="text-slate-400 font-bold font-mono text-[10px] select-none shrink-0">• Ação:</span>
                                                              <span>{at.motivo}</span>
                                                            </div>
                                                          )}
                                                        </div>

                                                        <div className="text-slate-600 text-xs font-sans font-medium mt-0.5 flex items-center gap-1 pb-0.5">
                                                          <span className="text-slate-400 font-bold font-mono text-[10px] select-none">• Ganho:</span>{' '}
                                                          <span className="text-emerald-600 font-bold font-mono">
                                                            -{Number(at.totalGanhos || 0).toFixed(2).replace('.', ',')} dB
                                                          </span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registro */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <h3 className="text-lg font-bold text-slate-800">
                  {modalMode === 'add' ? 'Novo Registro de Atenuação' : 'Editar Registro'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form className="p-6 space-y-4 max-h-[85vh] overflow-y-auto" onSubmit={async (e) => {
                e.preventDefault();
                let success = false;
                if (modalMode === 'edit') {
                  success = await onEdit?.(formData as Atenuacao, originalIdImoc) || false;
                } else {
                  success = await onAdd?.(formData as Atenuacao) || false;
                }
                if (success) setIsModalOpen(false);
              }}>
                {/* Painel de Colagem Inteligente do Chamado */}
                <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-indigo-800 uppercase flex items-center gap-1.5">
                      <Clipboard className="w-3.5 h-3.5 text-indigo-600" />
                      Colagem Inteligente do Chamado
                    </label>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold font-mono uppercase tracking-wide">Auto-Detectar</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    Cole as informações do chamado (título, link, data/hora) para preencher automaticamente o <strong>ID IMOC</strong>, a <strong>Data de Abertura</strong>, a <strong>Rede</strong> e o <strong>Trecho</strong>.
                  </p>
                  <textarea
                    rows={3}
                    className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder-slate-400 font-mono text-slate-700 leading-relaxed"
                    placeholder="Cole o bloco do chamado aqui...&#10;Ex: Título: Atenuaçao Camaçari-100<>Alagoinha-100&#10;Aberto em: 06/07/26 às 17:17:51&#10;Link: ...chamado/640832"
                    value={smartPasteText}
                    onChange={(e) => handleSmartPasteTicket(e.target.value)}
                  />
                  {smartPasteFeedback && (
                    <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                      smartPasteFeedback.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800 font-sans' 
                        : smartPasteFeedback.type === 'error'
                        ? 'bg-rose-50 border-rose-100 text-rose-800 font-sans'
                        : 'bg-amber-50 border-amber-100 text-amber-900 font-sans'
                    }`}>
                      <div className="mt-0.5 font-bold shrink-0">
                        {smartPasteFeedback.type === 'success' ? '✓' : smartPasteFeedback.type === 'error' ? '✗' : '⚠'}
                      </div>
                      <span className="font-medium">{smartPasteFeedback.message}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">ID IMOC</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Ex: 581234"
                      value={formData.idImoc || ''}
                      onChange={(e) => setFormData({...formData, idImoc: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="ABERTO" className="text-slate-900 bg-white">ABERTO</option>
                      <option value="FECHADO" className="text-slate-900 bg-white">FECHADO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Chamado</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={formData.tipoChamado || ''}
                      onChange={(e) => setFormData({...formData, tipoChamado: e.target.value})}
                    >
                      <option value="TRECHO" className="text-slate-900 bg-white">TRECHO</option>
                      <option value="POS ROMPIMENTO" className="text-slate-900 bg-white">POS ROMPIMENTO</option>
                      <option value="CH - SWAP" className="text-slate-900 bg-white">CH - SWAP</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">SLA</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={formData.sla || ''}
                      onChange={(e) => setFormData({...formData, sla: e.target.value})}
                    >
                      <option value="Muito Baixo" className="text-slate-900 bg-white">Muito Baixo</option>
                      <option value="Baixo" className="text-slate-900 bg-white">Baixo</option>
                      <option value="Médio" className="text-slate-900 bg-white">Médio</option>
                      <option value="Alto" className="text-slate-900 bg-white">Alto</option>
                      <option value="Crítico" className="text-slate-900 bg-white">Crítico</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase">Rede</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Pesquisar ou digitar rede..."
                    value={redeSearch}
                    onChange={(e) => {
                      setRedeSearch(e.target.value);
                      setFormData({...formData, rede: e.target.value});
                      setShowRedeSuggestions(true);
                      setIsTypingRede(true);
                    }}
                    onFocus={() => {
                      setShowRedeSuggestions(true);
                      setIsTypingRede(false);
                    }}
                    onClick={() => {
                      setShowRedeSuggestions(true);
                      setIsTypingRede(false);
                    }}
                    onBlur={() => setTimeout(() => setShowRedeSuggestions(false), 200)}
                  />
                  {showRedeSuggestions && (filteredRedes.length > 0 || (redeSearch.trim() !== '' && !uniqueRedes.map(u => u.toLowerCase()).includes(redeSearch.toLowerCase().trim()))) && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {filteredRedes.map(r => (
                        <button
                          key={r}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                          onClick={() => {
                            setFormData({...formData, rede: r, trecho: ''});
                            setRedeSearch(r);
                            setTrechoSearch('');
                            setShowRedeSuggestions(false);
                            setIsTypingRede(false);
                          }}
                        >
                          {r}
                        </button>
                      ))}
                      {redeSearch.trim() !== '' && !uniqueRedes.map(u => u.toLowerCase()).includes(redeSearch.toLowerCase().trim()) && (
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 border-t border-slate-100 transition-colors"
                          onClick={() => {
                            const newRede = redeSearch.trim().toUpperCase();
                            setFormData({...formData, rede: newRede, trecho: ''});
                            setRedeSearch(newRede);
                            setTrechoSearch('');
                            setShowRedeSuggestions(false);
                            setIsTypingRede(false);
                          }}
                        >
                          ✨ Criar Rede: "{redeSearch.trim().toUpperCase()}"
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase">Trecho</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Pesquisar ou digitar trecho..."
                    value={trechoSearch}
                    onChange={(e) => {
                      setTrechoSearch(e.target.value);
                      setFormData({...formData, trecho: e.target.value});
                      setShowTrechoSuggestions(true);
                      setIsTypingTrecho(true);
                    }}
                    onFocus={() => {
                      setShowTrechoSuggestions(true);
                      setIsTypingTrecho(false);
                    }}
                    onClick={() => {
                      setShowTrechoSuggestions(true);
                      setIsTypingTrecho(false);
                    }}
                    onBlur={() => setTimeout(() => setShowTrechoSuggestions(false), 200)}
                  />
                  {showTrechoSuggestions && (filteredTrechos.length > 0 || (trechoSearch.trim() !== '' && !allTrechos.map(u => u.toLowerCase()).includes(trechoSearch.toLowerCase().trim()))) && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {filteredTrechos.map(t => (
                        <button
                          key={t}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                          onClick={() => {
                            setFormData({...formData, trecho: t});
                            setTrechoSearch(t);
                            setShowTrechoSuggestions(false);
                            setIsTypingTrecho(false);
                            
                            // Automatically update rede based on selected trecho if possible
                            const match = redeTrechoOptions.find(o => o.trecho === t);
                            if (match && formData.rede !== match.rede) {
                              setFormData(prev => ({...prev, rede: match.rede, trecho: t}));
                              setRedeSearch(match.rede);
                              setIsTypingRede(false);
                            }
                          }}
                        >
                          {t}
                        </button>
                      ))}
                      {trechoSearch.trim() !== '' && !allTrechos.map(u => u.toLowerCase()).includes(trechoSearch.toLowerCase().trim()) && (
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 border-t border-slate-100 transition-colors"
                          onClick={() => {
                            const newTrecho = trechoSearch.trim().toUpperCase();
                            setFormData({...formData, trecho: newTrecho});
                            setTrechoSearch(newTrecho);
                            setShowTrechoSuggestions(false);
                            setIsTypingTrecho(false);
                          }}
                        >
                          ✨ Criar Trecho: "{trechoSearch.trim().toUpperCase()}"
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data Abertura</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="DD/MM/AAAA"
                      value={formData.dataAbertura || ''}
                      onChange={(e) => setFormData({...formData, dataAbertura: formatDateInput(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Perdas (dB)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Ex: 1.5"
                      value={formData.perdas === undefined || formData.perdas === null || isNaN(formData.perdas) ? "" : formData.perdas}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData({...formData, perdas: undefined});
                        } else {
                          const parsed = parseFloat(val);
                          setFormData({...formData, perdas: isNaN(parsed) ? 0 : parsed});
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase px-1">Construtor de Detalhamento</label>
                    <Info size={14} className="text-blue-400" />
                  </div>

                  {/* Paste Box for rapid parsing */}
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-blue-700 uppercase flex items-center gap-1">
                        <Copy size={12} className="text-blue-600" /> Área de Colagem Rápida
                      </label>
                      <span className="text-[9px] text-blue-500 font-medium font-mono">Auto-detecta perdas, local, trecho</span>
                    </div>
                    <textarea
                      rows={2}
                      className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all placeholder-slate-400 font-mono"
                      placeholder="Cole o bloco do detalhamento aqui...&#10;Ex: Local: Campina-dc-100 | Tamanho: 69 KM..."
                      value={pasteBlock}
                      onChange={(e) => {
                        setPasteBlock(e.target.value);
                        handlePasteDetalhamento(e.target.value);
                      }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Local / Estação</label>
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Ex: ARARIPINA-DC-100"
                        value={valLocal}
                        onChange={(e) => updateDetalhamento(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Tamanho do Trecho (KM)</label>
                      <input 
                        type="number"
                        step="0.001"
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Ex: 44.600"
                        value={valTamanho}
                        onChange={(e) => updateDetalhamento(undefined, e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* RX Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-bold text-blue-600 uppercase">Perdas RX</label>
                        <button 
                          type="button"
                          onClick={() => setDetalhesRX([...detalhesRX, { km: '', db: '' }])}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {detalhesRX.map((item, id) => (
                          <div key={id} className="flex gap-2">
                            <input 
                              placeholder="km"
                              className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs"
                              value={item.km}
                              onChange={(e) => {
                                const newRX = [...detalhesRX];
                                newRX[id].km = e.target.value;
                                setDetalhesRX(newRX);
                                updateDetalhamento(undefined, undefined, newRX);
                              }}
                            />
                            <input 
                              placeholder="dB"
                              className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs"
                              value={item.db}
                              onChange={(e) => {
                                const newRX = [...detalhesRX];
                                newRX[id].db = e.target.value;
                                setDetalhesRX(newRX);
                                updateDetalhamento(undefined, undefined, newRX);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TX Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-bold text-rose-600 uppercase">Perdas TX</label>
                        <button 
                          type="button"
                          onClick={() => setDetalhesTX([...detalhesTX, { km: '', db: '' }])}
                          className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {detalhesTX.map((item, id) => (
                          <div key={id} className="flex gap-2">
                            <input 
                              placeholder="km"
                              className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs"
                              value={item.km}
                              onChange={(e) => {
                                const newTX = [...detalhesTX];
                                newTX[id].km = e.target.value;
                                setDetalhesTX(newTX);
                                updateDetalhamento(undefined, undefined, undefined, newTX);
                              }}
                            />
                            <input 
                              placeholder="dB"
                              className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs"
                              value={item.db}
                              onChange={(e) => {
                                const newTX = [...detalhesTX];
                                newTX[id].db = e.target.value;
                                setDetalhesTX(newTX);
                                updateDetalhamento(undefined, undefined, undefined, newTX);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200 line-clamp-2" title={formData.detalhamento}>
                    <span className="font-bold text-slate-600 not-italic">Prévia: </span>
                    {formData.detalhamento || 'Preencha os campos acima para gerar o detalhamento automático...'}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className={cn(
                      "flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2",
                      isSaving && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      modalMode === 'edit' ? 'Salvar Alterações' : 'Salvar Registro'
                    )}
                  </button>
                </div>
                
                <p className="text-[10px] text-slate-400 text-center">
                  Os dados serão sincronizados com a planilha do Google Drive.
                </p>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Inserir Piora */}
      <AnimatePresence>
        {isPioraModalOpen && pioraItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPioraModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <TrendingDown className="text-amber-600" size={20} />
                  <h3 className="text-lg font-bold text-slate-800">Inserir Piora no Trecho</h3>
                </div>
                <button 
                  onClick={() => setIsPioraModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form className="p-6 space-y-4 font-sans" onSubmit={handleSavePiora}>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs text-slate-600 space-y-1.5">
                  <p><span className="font-bold text-slate-700">Chamado / ID IMOC:</span> {pioraItem.idImoc}</p>
                  <p><span className="font-bold text-slate-700">Trecho:</span> {pioraItem.trecho}</p>
                  <p><span className="font-bold text-slate-700">Perdas Atuais:</span> {pioraItem.perdas} dB</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data da Piora</label>
                    <input 
                      type="text" 
                      required
                      placeholder="DD/MM/AAAA"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      value={pioraData.data}
                      onChange={(e) => setPioraData({...pioraData, data: formatDateInput(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valor da Piora (dB)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      placeholder="Ex: 1.50"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      value={pioraData.db}
                      onChange={(e) => setPioraData({...pioraData, db: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição / Observações</label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="Descreva o motivo ou detalhes da piora instalada..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-all"
                    value={pioraData.descricao}
                    onChange={(e) => setPioraData({...pioraData, descricao: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsPioraModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all font-sans"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl text-sm font-black transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2 font-sans"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Piora'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Piora */}
      <AnimatePresence>
        {editingPiora && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPiora(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden text-left"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <Edit className="text-teal-600" size={20} />
                  <h3 className="text-lg font-bold text-slate-800">Editar Piora</h3>
                </div>
                <button 
                  onClick={() => setEditingPiora(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 font-sans">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data da Piora</label>
                    <input 
                      type="text" 
                      required
                      placeholder="DD/MM/AAAA"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      value={editingPiora.data}
                      onChange={(e) => setEditingPiora({...editingPiora, data: formatDateInput(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valor da Piora (dB)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      placeholder="Ex: 1.50"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      value={editingPiora.db}
                      onChange={(e) => setEditingPiora({...editingPiora, db: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição / Observações</label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="Descreva o motivo..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none transition-all"
                    value={editingPiora.descricao}
                    onChange={(e) => setEditingPiora({...editingPiora, descricao: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setEditingPiora(null)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all font-sans"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmEditPiora}
                    disabled={isSaving}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-xl text-sm font-black transition-all shadow-lg shadow-teal-200 flex items-center justify-center gap-2 font-sans cursor-pointer"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Mudanças'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Deletar Piora */}
      <AnimatePresence>
        {deletingPiora && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingPiora(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 text-center space-y-4 font-sans">
                <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                  <Trash2 size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Excluir Piora?</h3>
                  <p className="text-xs text-slate-500">
                    Você tem certeza que deseja excluir esta piora? O valor de {deletingPiora.db.toFixed(2).replace('.', ',')} dB será subtraído do total de perdas do chamado.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setDeletingPiora(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
                  >
                    Não, Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmDeletePiora}
                    disabled={isSaving}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-rose-200 cursor-pointer"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Editar Atuação em Campo */}
      <AnimatePresence>
        {editingAtuacao && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingAtuacao(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden text-left"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <Briefcase className="text-teal-600" size={20} />
                  <h3 className="text-lg font-bold text-slate-800">Editar Atuação em Campo</h3>
                </div>
                <button 
                  onClick={() => setEditingAtuacao(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 font-sans">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data da Atuação</label>
                    <input 
                      type="text" 
                      required
                      placeholder="DD/MM/AAAA"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      value={editingAtuacao.dataAbertura || editingAtuacao.data || ""}
                      onChange={(e) => setEditingAtuacao({...editingAtuacao, dataAbertura: formatDateInput(e.target.value), data: formatDateInput(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Ganho obtido (dB)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      placeholder="Ex: 2.30"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      value={editingAtuacao.totalGanhos || 0}
                      onChange={(e) => setEditingAtuacao({...editingAtuacao, totalGanhos: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Empresa Executora</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      value={editingAtuacao.empresas || ""}
                      onChange={(e) => setEditingAtuacao({...editingAtuacao, empresas: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      value={editingAtuacao.status || ""}
                      onChange={(e) => setEditingAtuacao({...editingAtuacao, status: e.target.value})}
                    >
                      <option value="ATIVO">ATIVO</option>
                      <option value="CONCLUÍDO">CONCLUÍDO</option>
                      <option value="SALA DE CRISE">SALA DE CRISE</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ação / Motivo / Descrição</label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="Descreva a atuação de campo..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none transition-all"
                    value={editingAtuacao.motivo || ""}
                    onChange={(e) => setEditingAtuacao({...editingAtuacao, motivo: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setEditingAtuacao(null)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all font-sans"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmEditAtuacao}
                    disabled={isSaving}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-xl text-sm font-black transition-all shadow-lg shadow-teal-200 flex items-center justify-center gap-2 font-sans cursor-pointer"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Mudanças'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Deletar Atuação em Campo */}
      <AnimatePresence>
        {deletingAtuacao && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingAtuacao(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 text-center space-y-4 font-sans">
                <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                  <Trash2 size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Excluir Atuação em Campo?</h3>
                  <p className="text-xs text-slate-500">
                    Você tem certeza que deseja excluir esta atuação? Essa ação é permanente e removerá o registro do banco de dados.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setDeletingAtuacao(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
                  >
                    Não, Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmDeleteAtuacao}
                    disabled={isSaving}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-rose-200 cursor-pointer"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Relatório Gerado */}
      <AnimatePresence>
        {isReportModalOpen && reportItem && (() => {
          const detailsObj = parseDetalhamento(reportItem.detalhamento, reportItem.pioras);
          const pioras = detailsObj && 'pioras' in detailsObj ? (detailsObj as any).pioras : [];
          const itemAtuacoes = (allAtuacoes || []).filter(a => 
            String(a.idImoc || '').trim() === String(reportItem.idImoc || '').trim()
          );
          const initialLoss = Number(reportItem.perdas || 0);
          const totalPioras = pioras.reduce((acc: number, p: any) => acc + Number(p.db || 0), 0);
          const totalGanhos = itemAtuacoes.reduce((acc: number, at: any) => acc + Number(at.totalGanhos || 0), 0);
          const finalLoss = initialLoss + totalPioras - totalGanhos;

          const reportText = `*** RELATÓRIO DO CHAMADO DE ATENUAÇÃO (ID IMOC: ${reportItem.idImoc}) ***
Trecho: ${reportItem.trecho}
Rede: ${reportItem.rede}
Status: ${reportItem.status}
Abertura: ${formatToLocalDate(reportItem.dataAbertura) || 'Sem data'}

Chamado aberto com perda de atenuação física inicial de ${initialLoss.toFixed(2).replace('.', ',')} dB.

${pioras.length > 0 
  ? `HISTÓRICO DE PIORAS NO TRECHO (Acréscimos):` + pioras.map((p: any) => `\n  • Dia ${formatToLocalDate(p.data) || 'Sem data'}: piora de ${Number(p.db).toFixed(2).replace('.', ',')} dB - ${p.descricao || 'Sem descrição'}`).join('')
  : `HISTÓRICO DE PIORAS NO TRECHO: Sem registros de piora.`}

${itemAtuacoes.length > 0 
  ? `HISTÓRICO DE ATUAÇÕES EM CAMPO (Reduções):` + itemAtuacoes.map((at: any) => `\n  • Dia ${formatToLocalDate(at.dataAbertura || at.data) || 'Sem data'} por ${at.empresas || 'BRISANET'}: ${at.status || 'CONCLUÍDO'} com ganho de ${Number(at.totalGanhos || 0).toFixed(2).replace('.', ',')} dB${at.motivo ? ` (${at.motivo})` : ''}`).join('')
  : `HISTÓRICO DE ATUAÇÕES EM CAMPO: Sem registros de atuação.`}

CONCILIAÇÃO FINAL DE PERDAS:
  • Perda Inicial Registrada: ${initialLoss.toFixed(2).replace('.', ',')} dB
  • Acréscimos de Perda (Pioras): +${totalPioras.toFixed(2).replace('.', ',')} dB
  • Reduções de Perda (Ganhos): -${totalGanhos.toFixed(2).replace('.', ',')} dB
  =========================================
  => PERDA FINAL CALCULADA: ${Math.max(0, finalLoss).toFixed(2).replace('.', ',')} dB`;

          const copyToClipboard = () => {
            navigator.clipboard.writeText(reportText);
            setCopiedReport(true);
            setTimeout(() => {
              setCopiedReport(false);
            }, 2000);
          };

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsReportModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="text-indigo-650" size={22} />
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Mini Relatório do Chamado</h3>
                  </div>
                  <button 
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                  {/* Resumo da Conciliação */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/65">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Perda Inicial</p>
                      <p className="text-base font-black text-slate-800">{initialLoss.toFixed(2).replace('.', ',')} dB</p>
                    </div>
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/80 pt-2 md:pt-0 md:pl-4">
                      <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Total Pioras (+)</p>
                      <p className="text-base font-black text-rose-600">+{totalPioras.toFixed(2).replace('.', ',')} dB</p>
                    </div>
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/80 pt-2 md:pt-0 md:pl-4">
                      <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Total Ganhos (-)</p>
                      <p className="text-base font-black text-emerald-600">-{totalGanhos.toFixed(2).replace('.', ',')} dB</p>
                    </div>
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/80 pt-2 md:pt-0 md:pl-4 bg-indigo-50 border-indigo-100 rounded-xl p-2.5">
                      <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Perda Calculada</p>
                      <p className="text-lg font-black text-indigo-700">{Math.max(0, finalLoss).toFixed(2).replace('.', ',')} dB</p>
                    </div>
                  </div>

                  {/* Visual Timeline Details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex items-center justify-between">
                      <span>Metadados & Cronologia</span>
                      <span className="text-[10px] font-normal text-slate-400 normal-case font-mono">{reportItem.trecho}</span>
                    </h4>
                    
                    <div className="bg-slate-900 border border-slate-950 rounded-2xl p-5 shadow-inner relative overflow-hidden font-mono text-[11px] text-slate-200 space-y-4 max-h-60 overflow-y-auto">
                      <div className="flex items-start gap-2 border-b border-slate-800 pb-2">
                        <span className="text-emerald-400 font-bold shrink-0">[ABERTURA]</span>
                        <p>Chamado ID <span className="text-indigo-400 font-bold">{reportItem.idImoc}</span> aberto em <span className="text-amber-400 font-bold">{formatToLocalDate(reportItem.dataAbertura) || 'Sem data'}</span> com <span className="text-rose-400 font-bold">{initialLoss} dB</span> de atenuação física inicial.</p>
                      </div>

                      {pioras.map((p: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 border-b border-slate-800 pb-2">
                          <span className="text-rose-500 font-bold shrink-0">[PIORA]</span>
                          <p>Dia <span className="text-slate-400">{formatToLocalDate(p.data) || 'Sem data'}</span>: piora de <span className="text-rose-400 font-bold">+{p.db} dB</span> devido a <span className="text-slate-300">{p.descricao || 'perda no trecho'}</span>.</p>
                        </div>
                      ))}

                      {itemAtuacoes.map((at: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 border-b border-slate-800 pb-2">
                          <span className="text-indigo-400 font-bold shrink-0">[ATUAÇÃO]</span>
                          <p>Dia <span className="text-slate-400">{formatToLocalDate(at.dataAbertura || at.data) || 'Sem data'}</span> por <span className="text-indigo-300 font-bold">{at.empresas || 'BRISANET'}</span>: concluiu como <span className="text-emerald-400 font-bold">{at.status || 'CONCLUÍDO'}</span> obtendo <span className="text-emerald-400 font-bold">-{at.totalGanhos || 0} dB</span> de ganhos{at.motivo ? ` (${at.motivo})` : ''}.</p>
                        </div>
                      ))}

                      <div className="pt-2 flex items-center justify-between text-xs text-white font-bold font-sans">
                        <span>CONCILIAÇÃO FINAL CONCLUÍDA</span>
                        <span className="text-indigo-300">{Math.max(0, finalLoss).toFixed(2).replace('.', ',')} dB final</span>
                      </div>
                    </div>
                  </div>

                  {/* Text Area for copy */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase">Texto do Relatório Formatado</label>
                      <button 
                        type="button"
                        onClick={copyToClipboard}
                        className={cn(
                          "text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all outline-none",
                          copiedReport 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                            : "bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-700 cursor-pointer"
                        )}
                      >
                        {copiedReport ? (
                          <>
                            <Check size={12} />
                            <span>Copiado com Sucesso!</span>
                          </>
                        ) : (
                          <>
                            <FileText size={12} />
                            <span>Copiar Texto Formatado</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    <textarea
                      readOnly
                      value={reportText}
                      rows={8}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs font-mono text-slate-700 focus:ring-0 outline-none resize-none leading-relaxed select-all"
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex gap-4 bg-slate-50/50 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all font-sans cursor-pointer"
                  >
                    Fechar Relatório
                  </button>
                  <button 
                    type="button"
                    onClick={copyToClipboard}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 font-sans cursor-pointer"
                  >
                    <Check size={18} />
                    <span>{copiedReport ? 'Texto Copiado!' : 'Copiar Relatório'}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

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
                    Cadastro Rápido de Atenuações
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
                  Cole abaixo a linha de dados de atenuação copiada diretamente do Excel ou Google Sheets.
                  O sistema identificará de forma inteligente o ID (ex: <strong>258851</strong>), Trecho (ex: <strong>CAPELA-DC-100 &lt;&gt; MACEIO-DC-200</strong>), Perdas, Sla, Complexidade e Detalhes.
                </p>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                    Dados Copiados da Planilha:
                  </label>
                  <textarea
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    placeholder={`Cole aqui... Ex:
ABERTO TRECHO 258851 Critico 23/07/2024 CSF-MCO CAPELA-DC-100 <> MACEIO-DC-200 3 "Local: CAPELA-DC-100 | Tamanho do Trecho: 79 km"`}
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
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
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
