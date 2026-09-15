import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  X, 
  RefreshCw, 
  Pencil, 
  Trash2, 
  Copy, 
  Clipboard,
  Search, 
  Calendar, 
  CheckCircle2, 
  ChevronDown, 
  Filter, 
  MapPin, 
  FileText, 
  PlusCircle, 
  Check, 
  Tag, 
  Building2, 
  Map,
  FileSpreadsheet,
  AlertTriangle,
  Layers,
  Clock,
  Pause,
  Play
} from 'lucide-react';
import { Atuacao } from '../types';
import { cn } from '../lib/utils';

interface AtuacoesProps {
  filteredAtuacoes: Atuacao[];
  redeTrechoOptions: { rede: string, trecho: string }[];
  currentUser?: any;
  onAdd?: (newRecord: Atuacao) => Promise<boolean>;
  onEdit?: (record: Atuacao, originalIdImoc?: string) => Promise<boolean>;
  onDelete?: (idImoc: string) => Promise<boolean>;
  onStartFinalize?: (item: Atuacao) => void;
  onRefresh?: () => Promise<void> | void;
  isSaving?: boolean;
  onQuickImportDirect?: (record: any) => Promise<boolean>;
  isSyncPaused?: boolean;
  onToggleSyncPause?: () => void;
  pendingSyncCount?: number;
}

// Helpers for Date Formatting (exact visual parity with Atenuacoes)
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

// Help Toggle List States
function toggleFilter<T>(current: T[], value: T, setter: (val: T[]) => void) {
  if (current.includes(value)) {
    setter(current.filter(v => v !== value));
  } else {
    setter([...current, value]);
  }
}

export default function Atuacoes({ 
  filteredAtuacoes, 
  redeTrechoOptions,
  currentUser,
  onAdd, 
  onEdit, 
  onDelete, 
  onStartFinalize,
  onRefresh,
  isSaving,
  onQuickImportDirect,
  isSyncPaused,
  onToggleSyncPause,
  pendingSyncCount
}: AtuacoesProps) {
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState("");

  const parseQuickAtuacoes = (text: any) => {
    if (!text || typeof text !== "string") return null;
    const parts = text.split('\t').map(p => p.trim());
    if (parts.length >= 8) {
      return {
        tipo: parts[0] || 'TRECHO',
        idChamado: parts[1] || '',
        idImoc: parts[2] || '',
        dataAbertura: parts[3] || new Date().toLocaleDateString('pt-BR'),
        trecho: parts[4] || '',
        perdas: parseFloat(parts[5] || '0') || 0,
        responsavel: parts[6] || '',
        status: parts[7] || 'CONCLUÍDA'
      };
    }

    let tipo = "TRECHO";
    if (/equipamento/i.test(text)) tipo = "EQUIPAMENTO";

    const idMatches = text.match(/\b\d{5,8}\b/g) || [];
    const idChamado = idMatches[0] || "";
    const idImoc = idMatches[1] || "";

    const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    const dataAbertura = dateMatch ? dateMatch[0] : new Date().toLocaleDateString('pt-BR');

    let trecho = "";
    const trechoMatch = text.match(/([A-Z0-9_-]+\s*<>\s*[A-Z0-9_-]+)/i);
    if (trechoMatch) {
      trecho = trechoMatch[0];
    }

    let perdas = 0;
    const numMatch = text.match(/\b\d+([.,]\d+)\b/);
    if (numMatch) {
      perdas = parseFloat(numMatch[0].replace(",", ".")) || 0;
    } else {
      const partsAfterTrecho = trecho ? text.split(trecho)[1] : text;
      const partWords = partsAfterTrecho.trim().split(/\s+/);
      for (const w of partWords) {
        const val = parseFloat(w.replace(",", "."));
        if (!isNaN(val) && val > 0 && val < 50) {
          perdas = val;
          break;
        }
      }
    }

    let responsavel = "VELOO";
    if (/veloo/i.test(text)) responsavel = "VELOO";
    else if (/brisas|brisanet/i.test(text)) responsavel = "BRISANET";
    else {
      const coMatch = text.match(/\b(VELOO|BRISANET|TELECOM|PROTEC)\b/i);
      if (coMatch) responsavel = coMatch[0].toUpperCase();
    }

    let status = "CONCLUÍDA";
    if (/pendente|aberto/i.test(text)) status = "PENDENTE";

    let redeVal = "BACKBONE";
    const redeMatch = text.match(/\b([A-Z0-9]{3,5}-[A-Z0-9]{3,5})\b/i);
    if (redeMatch) {
      redeVal = redeMatch[0].toUpperCase();
    }

    return {
      tipo,
      idChamado,
      idImoc,
      dataAbertura,
      rede: redeVal,
      trecho,
      perdas,
      responsavel,
      status
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
      const parsed = parseQuickAtuacoes(quickImportText);
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

  const [originalIdImoc, setOriginalIdImoc] = useState<string>('');
  // Filters & State Visuals
  const [textSearch, setTextSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeFilterMenu, setActiveFilterMenu] = useState<'status' | 'tipo' | 'coordenadas' | 'empresa' | null>(null);

  // Selected multi filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [coordenadasFilter, setCoordenadasFilter] = useState<string>('TODAS'); // 'TODAS' | 'COORD_SIM' | 'COORD_NAO'
  const [empresaFilter, setEmpresaFilter] = useState<string[]>([]);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'duplicate'>('add');
  const [formData, setFormData] = useState<Partial<Atuacao>>({
    status: 'EM ANDAMENTO',
    tipoChamado: '',
    empresas: '',
    dataAbertura: formatToLocalDate(new Date().toLocaleDateString('pt-BR')),
    totalGanhos: 0,
    recebeuCoordenadas: false
  });

  const [redeSearch, setRedeSearch] = useState('');
  const [trechoSearch, setTrechoSearch] = useState('');
  const [showRedeSuggestions, setShowRedeSuggestions] = useState(false);
  const [showTrechoSuggestions, setShowTrechoSuggestions] = useState(false);
  const [isTypingRede, setIsTypingRede] = useState(false);
  const [isTypingTrecho, setIsTypingTrecho] = useState(false);

  // Form feedback
  const [dateError, setDateError] = useState(false);

  // Suggestions lists mapping
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

  // Dynamic values derived from raw data to fill menus
  const dynamicCompanies = useMemo(() => {
    return Array.from(new Set(filteredAtuacoes.map(a => (a.empresas || '').trim().toUpperCase()).filter(Boolean))).sort();
  }, [filteredAtuacoes]);

  const dynamicTipos = useMemo(() => {
    return Array.from(new Set(filteredAtuacoes.map(a => (a.tipoChamado || '').trim().toUpperCase()).filter(Boolean))).sort();
  }, [filteredAtuacoes]);

  // Main UI Data filtering and search calculations
  const displayAtuacoes = useMemo(() => {
    return filteredAtuacoes.filter(item => {
      // 1. Text Search Input (ID IMOC, ID DWDM, Trecho, Rede, Empresa, Motivo)
      if (textSearch.trim() !== '') {
        const query = textSearch.trim().toLowerCase();
        const matchesId = String(item.idImoc || '').toLowerCase().includes(query);
        const matchesDwdm = String(item.idDwdm || '').toLowerCase().includes(query);
        const matchesTrecho = String(item.trecho || '').toLowerCase().includes(query);
        const matchesRede = String(item.rede || '').toLowerCase().includes(query);
        const matchesEmpresa = String(item.empresas || '').toLowerCase().includes(query);
        const matchesMotivo = String(item.motivo || '').toLowerCase().includes(query);
        
        if (!matchesId && !matchesDwdm && !matchesTrecho && !matchesRede && !matchesEmpresa && !matchesMotivo) {
          return false;
        }
      }

      // 2. Date/Period Filter matching DD/MM/AAAA - Filtering items concluded in the selected period
      if (startDate || endDate) {
        const dateStr = item.dataAbertura || item.data;
        if (!dateStr) return false;
        try {
          const cleanDate = formatToLocalDate(dateStr);
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

          // Check if item was concluded in this period
          const st = (item.status || '').toString().trim().toUpperCase();
          if (st !== 'CONCLUÍDA' && st !== 'CONCLUIDA') {
            return false;
          }
        } catch (e) {
          console.error("Erro no filtro de datas:", e);
        }
      }

      // 3. Status filter
      if (statusFilter.length > 0) {
        const st = (item.status || 'CONCLUÍDA').toString().trim().toUpperCase();
        if (!statusFilter.includes(st)) return false;
      }

      // 4. Tipo de Chamado Filter
      if (tipoFilter.length > 0) {
        const tp = (item.tipoChamado || 'TRECHO').toString().trim().toUpperCase();
        if (!tipoFilter.includes(tp)) return false;
      }

      // 5. Coordenadas Filter
      if (coordenadasFilter !== 'TODAS') {
        const isTrue = !!item.recebeuCoordenadas;
        if (coordenadasFilter === 'COORD_SIM' && !isTrue) return false;
        if (coordenadasFilter === 'COORD_NAO' && isTrue) return false;
      }

      // 6. Empresa Filter
      if (empresaFilter.length > 0) {
        const emp = (item.empresas || '').toString().trim().toUpperCase();
        if (!empresaFilter.includes(emp)) return false;
      }

      return true;
    });
  }, [filteredAtuacoes, textSearch, startDate, endDate, statusFilter, tipoFilter, coordenadasFilter, empresaFilter]);

  const [copiedCoordsNotice, setCopiedCoordsNotice] = useState(false);

  const handleCopyPendingCoordinatesCobranca = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const pendingItems = filteredAtuacoes.filter(a => !a.recebeuCoordenadas);
    
    if (pendingItems.length === 0) {
      alert("Nenhum chamado com coordenadas pendentes no momento.");
      return;
    }

    let text = `*Por gentileza, verificar e enviar as coordenadas dos seguintes chamados em atuação: (${pendingItems.length})*\n\n`;
    
    pendingItems.forEach(item => {
      const id = item.idDwdm || item.idImoc || "Sem ID";
      const data = item.dataAbertura || item.data || "—";
      const trecho = item.trecho || "Não informado";
      const rede = item.rede ? ` (${item.rede})` : "";
      
      text += `*ID:* ${id} | *Data:* ${data}\n> *Título:* ${trecho}${rede}\n\n`;
    });

    text = text.trim();
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    setCopiedCoordsNotice(true);
    setTimeout(() => setCopiedCoordsNotice(false), 3000);
  };

  // Statistics KPIs (Based on filteredAtuacoes for interactive card filtering)
  const stats = useMemo(() => {
    const total = filteredAtuacoes.length;
    
    const emAndamento = filteredAtuacoes.filter(a => {
      const s = (a.status || '').trim().toUpperCase();
      return s === 'EM ANDAMENTO' || s === 'PENDENTE';
    }).length;

    const concluidas = filteredAtuacoes.filter(a => {
      const s = (a.status || '').trim().toUpperCase();
      return s === 'CONCLUÍDA' || s === 'CONCLUÍDO' || s === 'CONCLUIDO' || s === 'CONCLUIDA';
    }).length;

    const pendentesCoordsCount = filteredAtuacoes.filter(a => !a.recebeuCoordenadas).length;

    const comCoords = filteredAtuacoes.filter(a => !!a.recebeuCoordenadas).length;

    const ganhosTotais = filteredAtuacoes.reduce((acc, curr) => acc + (Number(curr.totalGanhos) || 0), 0);

    return {
      total,
      emAndamento,
      concluidas,
      pendentesCoordsCount,
      comCoords,
      ganhosTotais
    };
  }, [filteredAtuacoes]);

  // Smart Paste State for Ticket
  const [smartPasteText, setSmartPasteText] = useState('');
  const [smartPasteFeedback, setSmartPasteFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

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
      // 1. Extract ID Chamado / ID IMOC from link or text
      const idMatch = text.match(/chamado\/(\d+)/i) || 
                      text.match(/id\s*chamado:\s*(\d+)/i) || 
                      text.match(/id\s*imoc:\s*(\d+)/i) ||
                      text.match(/chamado:\s*(\d+)/i);
      const parsedId = idMatch ? idMatch[1] : (text.match(/\b\d{5,8}\b/) ? text.match(/\b\d{5,8}\b/)![0] : "");

      // 2. Extract Date from "Aberto em"
      const dateMatch = text.match(/Aberto\s+em:\s*\*?\s*(\d{2}\/\d{2}\/\d{2,4})/i) || 
                        text.match(/Aberto\s+em\s+(\d{2}\/\d{2}\/\d{2,4})/i) ||
                        text.match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
      let parsedDate = "";
      if (dateMatch) {
        const rawDate = dateMatch[1];
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          let day = parts[0].trim().padStart(2, '0');
          let month = parts[1].trim().padStart(2, '0');
          let year = parts[2].trim();
          if (year.length === 2) {
            year = "20" + year;
          }
          parsedDate = `${day}/${month}/${year}`;
        } else {
          parsedDate = rawDate;
        }
      }

      // 3. Extract Criado por / Autor
      const creatorMatch = text.match(/Criado\s+por:\s*\*?\s*([^\n\r*]+)/i);
      const parsedCreator = creatorMatch ? creatorMatch[1].trim() : "";

      // 4. Extract Category / Tipo Chamado (only if explicitly found)
      let parsedTipo = "";
      if (/rompimento/i.test(text)) {
        parsedTipo = "POS ROMPIMENTO";
      } else if (/teste/i.test(text)) {
        parsedTipo = "TESTES";
      }

      // 5. Extract Trecho and Rede with fuzzy scoring against redeTrechoOptions
      const isNumeric = (str: string) => /^\d+$/.test(str);

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
              !["ATENUACAO", "CHAMADO", "TITULO", "IMOC", "DWDM", "BRISANET", "CATEGORIA", "SETOR", "ABERTO", "CRIADO", "INFORMACOES"].includes(token)
            );
          });
      };

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

      const trechoMatch = text.match(/([A-Z0-9_áéíóúâêîôûãõç.-]+\s*<>\s*[A-Z0-9_áéíóúâêîôûãõç.-]+)/i);

      let parsedRede = "";
      let parsedTrecho = "";
      let foundMatch = false;

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

      const splitMatch = titleLine.split(/<>\s*|< >\s*/);
      let tokensA: string[] = [];
      let tokensB: string[] = [];
      let isTwoSided = false;

      if (splitMatch.length >= 2) {
        const partA = splitMatch[0].replace(/.*T[íi]tulo:\s*/i, "").replace(/.*Atenua[cç][aã]o\s*/i, "").replace(/.*DWDM:\s*/i, "").trim();
        const partB = splitMatch[1].trim();
        tokensA = getTokens(partA);
        tokensB = getTokens(partB);
        if (tokensA.length > 0 && tokensB.length > 0) {
          isTwoSided = true;
        }
      }

      const allTokens = isTwoSided ? [] : getTokens(titleLine || text);

      let bestScore = 0;
      let bestOption: { rede: string; trecho: string } | null = null;

      for (const option of redeTrechoOptions) {
        const optionTokens = getTokens(option.trecho);
        let score = 0;

        if (isTwoSided) {
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

          score = scoreA + scoreB;

          const hasA_AlphaMatch = tokensA.some(tA => !isNumeric(tA) && optionTokens.some(oT => !isNumeric(oT) && getTokenMatchScore(tA, oT) > 0));
          const hasB_AlphaMatch = tokensB.some(tB => !isNumeric(tB) && optionTokens.some(oT => !isNumeric(oT) && getTokenMatchScore(tB, oT) > 0));
          if (hasA_AlphaMatch && hasB_AlphaMatch) {
            score += 100;
          }
        } else {
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

      const minThreshold = isTwoSided ? 100 : 10;
      if (bestOption && bestScore >= minThreshold) {
        parsedRede = bestOption.rede;
        parsedTrecho = bestOption.trecho;
        foundMatch = true;
      }

      if (!foundMatch && trechoMatch) {
        parsedTrecho = trechoMatch[1].trim();
        if (tokensA.length > 0) {
          for (const option of redeTrechoOptions) {
            const optTokens = getTokens(option.trecho);
            const matchesA = tokensA.some(tA => !isNumeric(tA) && optTokens.some(oT => getTokenMatchScore(tA, oT) > 10));
            if (matchesA) {
              parsedRede = option.rede;
              break;
            }
          }
        }
      }

      // Apply detected values
      setFormData(prev => {
        const updated = { ...prev };
        if (parsedId) updated.idDwdm = parsedId;
        if (parsedDate) updated.dataAbertura = parsedDate;
        if (parsedRede) updated.rede = parsedRede;
        if (parsedTrecho) updated.trecho = parsedTrecho;
        if (parsedTipo) updated.tipoChamado = parsedTipo;
        if (parsedCreator && !updated.motivo) {
          updated.motivo = `Criado por: ${parsedCreator}`;
        }
        return updated;
      });

      if (parsedRede) {
        setRedeSearch(parsedRede);
      }
      if (parsedTrecho) {
        setTrechoSearch(parsedTrecho);
      }

      const identified: string[] = [];
      if (parsedId) identified.push(`ID DWDM (${parsedId})`);
      if (parsedDate) identified.push(`Data (${parsedDate})`);
      if (foundMatch) {
        identified.push(`Trecho: "${parsedTrecho}" na Rede: "${parsedRede}"`);
      } else if (parsedTrecho) {
        identified.push(`Trecho: "${parsedTrecho}"${parsedRede ? ` na Rede: "${parsedRede}"` : ' (Rede a selecionar)'}`);
      }
      if (parsedTipo) identified.push(`Tipo: "${parsedTipo}"`);

      if (identified.length > 0) {
        setSmartPasteFeedback({
          type: foundMatch ? 'success' : 'info',
          message: `Identificado: ${identified.join(', ')}`
        });
      } else {
        setSmartPasteFeedback({
          type: 'error',
          message: 'Não foi possível encontrar campos conhecidos no texto colado.'
        });
      }

    } catch (e: any) {
      setSmartPasteFeedback({
        type: 'error',
        message: 'Erro ao processar colagem: ' + e.message
      });
    }
  };

  // Helper to open modal
  const handleOpenModal = (mode: 'add' | 'edit' | 'duplicate', item?: Atuacao) => {
    setModalMode(mode);
    setDateError(false);
    setSmartPasteText('');
    setSmartPasteFeedback(null);
    if (item) {
      setFormData({
        ...item,
        dataAbertura: formatToLocalDate(item.dataAbertura),
        recebeuCoordenadas: !!item.recebeuCoordenadas
      });
      setOriginalIdImoc(item.idImoc || '');
      setRedeSearch(item.rede || '');
      setTrechoSearch(item.trecho || '');
      setIsTypingRede(false);
      setIsTypingTrecho(false);
    } else {
      setFormData({
        status: 'EM ANDAMENTO',
        tipoChamado: '',
        empresas: '',
        dataAbertura: formatToLocalDate(new Date().toLocaleDateString('pt-BR')),
        totalGanhos: 0,
        recebeuCoordenadas: false
      });
      setRedeSearch('');
      setTrechoSearch('');
      setIsTypingRede(false);
      setIsTypingTrecho(false);
    }
    setIsModalOpen(true);
  };

  // Helper date validator on form submit
  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dateStr = formData.dataAbertura || "";
    const cleanDate = formatToLocalDate(dateStr);
    
    // Validate date format DD/MM/AAAA
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
      setDateError(true);
      return;
    }
    
    const parts = cleanDate.split('/');
    const d = Number(parts[0]);
    const m = Number(parts[1]);
    const y = Number(parts[2]);
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) {
      setDateError(true);
      return;
    }

    setDateError(false);
    const preparedData: Atuacao = {
      idImoc: String(formData.idImoc || '').trim().toUpperCase(),
      idDwdm: String(formData.idDwdm || '').trim().toUpperCase(),
      rede: String(formData.rede || '').trim().toUpperCase(),
      trecho: String(formData.trecho || '').trim(),
      tipoChamado: String(formData.tipoChamado || '').trim().toUpperCase(),
      empresas: String(formData.empresas || '').trim().toUpperCase(),
      motivo: String(formData.motivo || '').trim(),
      status: String(formData.status || 'EM ANDAMENTO').trim().toUpperCase(),
      totalGanhos: Number(formData.totalGanhos) || 0,
      dataAbertura: cleanDate,
      recebeuCoordenadas: !!formData.recebeuCoordenadas
    };

    let success = false;
    if (modalMode === 'edit') {
      success = await onEdit?.(preparedData, originalIdImoc) || false;
    } else {
      success = await onAdd?.(preparedData) || false;
    }

    if (success) {
      if (onRefresh) {
        await onRefresh();
      }
      setIsModalOpen(false);
    }
  };

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
            <span className="w-2.5 h-6 bg-slate-900 rounded-full inline-block"></span>
            Atuações em Campo
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhe e configure as ordens de serviço, reparos físicos de fibra, realinhamentos e correções executadas por equipes técnicas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentUser?.permissions?.atuacoes_geral?.editar && (
            <button
              onClick={() => handleOpenModal('add')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold transition cursor-pointer select-none shrink-0"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Registrar Atuação</span>
            </button>
          )}
        </div>
      </div>

      {/* CARDS DE FILTRO INTERATIVOS (Substituem os botões legados de filtro) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 select-none">
        {/* Card 1: Total de Atuações */}
        <div 
          onClick={() => {
            setStatusFilter([]);
            setCoordenadasFilter('TODAS');
          }}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-xs",
            statusFilter.length === 0 && coordenadasFilter === 'TODAS'
              ? "bg-slate-900 border-slate-900 text-white ring-2 ring-slate-900/30"
              : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:shadow-sm"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusFilter.length === 0 && coordenadasFilter === 'TODAS' ? "text-slate-300" : "text-slate-400")}>
              Total Atuações
            </span>
            <div className={cn("p-2 rounded-xl", statusFilter.length === 0 && coordenadasFilter === 'TODAS' ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600")}>
              <Layers size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black">{stats.total}</p>
            <p className={cn("text-[10px] mt-0.5 font-medium", statusFilter.length === 0 && coordenadasFilter === 'TODAS' ? "text-slate-300 font-bold" : "text-slate-500")}>
              {statusFilter.length === 0 && coordenadasFilter === 'TODAS' ? '✓ Filtro Ativo' : 'Clique para ver todas'}
            </p>
          </div>
        </div>

        {/* Card 2: Demandas Abertas / Em Andamento */}
        <div 
          onClick={() => {
            setStatusFilter(['EM ANDAMENTO', 'PENDENTE']);
            setCoordenadasFilter('TODAS');
          }}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-xs",
            statusFilter.length === 2 && statusFilter.includes('EM ANDAMENTO') && statusFilter.includes('PENDENTE') && coordenadasFilter === 'TODAS'
              ? "bg-amber-500 text-slate-950 border-amber-500 ring-2 ring-amber-500/30 font-semibold"
              : "bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:shadow-sm"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusFilter.length === 2 && statusFilter.includes('EM ANDAMENTO') && statusFilter.includes('PENDENTE') && coordenadasFilter === 'TODAS' ? "text-slate-900" : "text-slate-400")}>
              Demandas Abertas
            </span>
            <div className={cn("p-2 rounded-xl", statusFilter.length === 2 && statusFilter.includes('EM ANDAMENTO') && statusFilter.includes('PENDENTE') && coordenadasFilter === 'TODAS' ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-600")}>
              <Clock size={18} className="animate-pulse" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black">{stats.emAndamento}</p>
            <p className={cn("text-[10px] mt-0.5 font-medium", statusFilter.length === 2 && statusFilter.includes('EM ANDAMENTO') && statusFilter.includes('PENDENTE') && coordenadasFilter === 'TODAS' ? "text-slate-900 font-bold" : "text-slate-500")}>
              {statusFilter.length === 2 && statusFilter.includes('EM ANDAMENTO') && statusFilter.includes('PENDENTE') && coordenadasFilter === 'TODAS' ? '✓ Filtro Ativo' : 'Em andamento ou pendentes'}
            </p>
          </div>
        </div>

        {/* Card 3: Concluídas */}
        <div 
          onClick={() => {
            setStatusFilter(['CONCLUÍDA']);
            setCoordenadasFilter('TODAS');
          }}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-xs",
            statusFilter.length === 1 && statusFilter[0] === 'CONCLUÍDA' && coordenadasFilter === 'TODAS'
              ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-600/30"
              : "bg-white border-slate-200 text-slate-800 hover:border-emerald-300 hover:shadow-sm"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusFilter.length === 1 && statusFilter[0] === 'CONCLUÍDA' && coordenadasFilter === 'TODAS' ? "text-emerald-100" : "text-slate-400")}>
              Concluídas
            </span>
            <div className={cn("p-2 rounded-xl", statusFilter.length === 1 && statusFilter[0] === 'CONCLUÍDA' && coordenadasFilter === 'TODAS' ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-600")}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black">{stats.concluidas}</p>
            <p className={cn("text-[10px] mt-0.5 font-medium", statusFilter.length === 1 && statusFilter[0] === 'CONCLUÍDA' && coordenadasFilter === 'TODAS' ? "text-emerald-100 font-bold" : "text-slate-500")}>
              {statusFilter.length === 1 && statusFilter[0] === 'CONCLUÍDA' && coordenadasFilter === 'TODAS' ? '✓ Filtro Ativo' : 'Demandas finalizadas'}
            </p>
          </div>
        </div>

        {/* Card 4: Coordenadas Pendentes com Botão de Copiar Cobrança */}
        <div 
          onClick={() => {
            setCoordenadasFilter('COORD_NAO');
            setStatusFilter([]);
          }}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-xs",
            coordenadasFilter === 'COORD_NAO'
              ? "bg-rose-600 text-white border-rose-600 ring-2 ring-rose-600/30"
              : "bg-white border-slate-200 text-slate-800 hover:border-rose-300 hover:shadow-sm"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", coordenadasFilter === 'COORD_NAO' ? "text-rose-100" : "text-slate-400")}>
              Coord. Pendentes
            </span>
            <div className={cn("p-1.5 rounded-xl", coordenadasFilter === 'COORD_NAO' ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-600")}>
              <MapPin size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-1">
              <p className={cn("text-2xl font-black", coordenadasFilter === 'COORD_NAO' ? "text-white" : "text-rose-600")}>{stats.pendentesCoordsCount}</p>
              
              {/* Botão Copiar Cobrança */}
              <button
                onClick={handleCopyPendingCoordinatesCobranca}
                title="Copiar lista de cobrança de coordenadas pendentes para o WhatsApp"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-xs border shrink-0",
                  coordenadasFilter === 'COORD_NAO'
                    ? "bg-white text-rose-700 border-white hover:bg-rose-50"
                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                )}
              >
                {copiedCoordsNotice ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copiedCoordsNotice ? "Copiado!" : "Copiar Cobrança"}</span>
              </button>
            </div>
            <p className={cn("text-[10px] mt-1 font-medium", coordenadasFilter === 'COORD_NAO' ? "text-rose-100 font-bold" : "text-slate-500")}>
              {coordenadasFilter === 'COORD_NAO' ? '✓ Filtro Ativo' : 'Sem coordenadas salvas'}
            </p>
          </div>
        </div>

        {/* Card 5: Ganhos Acumulados */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Ganhos Acumulados
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Tag size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-amber-500">+{stats.ganhosTotais.toFixed(2).replace('.', ',')} dB</p>
            <p className="text-[10px] mt-0.5 font-medium text-slate-500">Total acumulado no período</p>
          </div>
        </div>
      </div>

      {/* PAINEL DE BUSCA E FILTROS COMPLEMENTARES */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 select-none">

        {/* 2. Busca e Período */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              placeholder="Buscar ID IMOC, ID DWDM, Trecho, Rede, Motivo, Empresa..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 placeholder-slate-400 bg-slate-50/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 font-mono">Início:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50/50 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 font-mono">Fim:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50/50 focus:outline-none focus:border-blue-500"
            />
            {(startDate || endDate || textSearch || statusFilter.length > 0 || tipoFilter.length > 0 || coordenadasFilter !== 'TODAS' || empresaFilter.length > 0) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setTextSearch('');
                  setStatusFilter([]);
                  setTipoFilter([]);
                  setCoordenadasFilter('TODAS');
                  setEmpresaFilter([]);
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

          {/* Status Secundário Dropdown (Caso o usuário queira ver um status específico) */}
          <div className="relative">
            <button 
              onClick={() => setActiveFilterMenu(activeFilterMenu === 'status' ? null : 'status')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                statusFilter.length > 0 
                  ? "bg-blue-55 border-blue-200 text-blue-700" 
                  : "bg-slate-55 border-slate-200 text-slate-600 hover:bg-slate-105"
              )}
            >
              Status: {statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} selecionados`}
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
                    {['CONCLUÍDA', 'EM ANDAMENTO', 'PENDENTE', 'CANCELADO'].map(st => (
                      <button
                        key={st}
                        onClick={() => toggleFilter(statusFilter, st, setStatusFilter)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors bg-white",
                          statusFilter.includes(st) ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {st}
                        {statusFilter.includes(st) && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                    {statusFilter.length > 0 && (
                      <button 
                        onClick={() => setStatusFilter([])}
                        className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider pt-2 border-t mt-1"
                      >
                        Limpar Filtro
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Tipo de Chamado Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setActiveFilterMenu(activeFilterMenu === 'tipo' ? null : 'tipo')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                tipoFilter.length > 0 
                  ? "bg-purple-55 border-purple-200 text-purple-700" 
                  : "bg-slate-55 border-slate-200 text-slate-600 hover:bg-slate-105"
              )}
            >
              Tipo: {tipoFilter.length === 0 ? 'Todos' : `${tipoFilter.length} selecionados`}
              <ChevronDown size={14} className={cn("transition-transform", activeFilterMenu === 'tipo' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeFilterMenu === 'tipo' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActiveFilterMenu(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 space-y-1"
                  >
                    {Array.from(new Set([...['TRECHO', 'POS ROMPIMENTO', 'TESTES'], ...dynamicTipos])).map(tp => (
                      <button
                        key={tp}
                        onClick={() => toggleFilter(tipoFilter, tp, setTipoFilter)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors bg-white",
                          tipoFilter.includes(tp) ? "bg-purple-50 text-purple-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {tp}
                        {tipoFilter.includes(tp) && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                    {tipoFilter.length > 0 && (
                      <button 
                        onClick={() => setTipoFilter([])}
                        className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider pt-2 border-t mt-1"
                      >
                        Limpar Filtro
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Coordenadas Recebidas Filter Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setActiveFilterMenu(activeFilterMenu === 'coordenadas' ? null : 'coordenadas')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                coordenadasFilter !== 'TODAS'
                  ? "bg-indigo-55 border-indigo-200 text-indigo-700" 
                  : "bg-slate-55 border-slate-200 text-slate-600 hover:bg-slate-105"
              )}
            >
              Coordenadas: {coordenadasFilter === 'TODAS' ? 'Todas' : coordenadasFilter === 'COORD_SIM' ? 'Recebido' : 'Pendente'}
              <ChevronDown size={14} className={cn("transition-transform", activeFilterMenu === 'coordenadas' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeFilterMenu === 'coordenadas' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActiveFilterMenu(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 space-y-1"
                  >
                    {[
                      { value: 'TODAS', label: 'Todas' },
                      { value: 'COORD_SIM', label: 'Com Coordenadas Mapeadas' },
                      { value: 'COORD_NAO', label: 'Sem Coordenadas Mapeadas' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setCoordenadasFilter(opt.value);
                          setActiveFilterMenu(null);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors bg-white",
                          coordenadasFilter === opt.value ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {opt.label}
                        {coordenadasFilter === opt.value && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Empresa Filter Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setActiveFilterMenu(activeFilterMenu === 'empresa' ? null : 'empresa')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                empresaFilter.length > 0 
                  ? "bg-amber-55 border-amber-200 text-amber-700" 
                  : "bg-slate-55 border-slate-200 text-slate-600 hover:bg-slate-105"
              )}
            >
              Empresa: {empresaFilter.length === 0 ? 'Todas' : `${empresaFilter.length} selecionadas`}
              <ChevronDown size={14} className={cn("transition-transform", activeFilterMenu === 'empresa' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeFilterMenu === 'empresa' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActiveFilterMenu(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 max-h-64 overflow-y-auto space-y-1"
                  >
                    {Array.from(new Set([...['BRISANET', 'TELECOM', 'EMPRETECOR'], ...dynamicCompanies])).map(emp => (
                      <button
                        key={emp}
                        onClick={() => toggleFilter(empresaFilter, emp, setEmpresaFilter)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors bg-white",
                          empresaFilter.includes(emp) ? "bg-amber-50 text-amber-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {emp}
                        {empresaFilter.includes(emp) && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                    {empresaFilter.length > 0 && (
                      <button 
                        onClick={() => setEmpresaFilter([])}
                        className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider pt-2 border-t mt-1 bg-white"
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

      {/* Main Table Interface (Matching the elegance of Atenuacoes) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
              <Map className="text-indigo-500" size={20} />
              Histórico Geral de Atuações em Campo
            </h3>
            <p className="text-xs text-slate-400 font-medium">Lista de correções e mitigação de perdas por atenuação</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-450 font-semibold hidden sm:block">{displayAtuacoes.length} registros encontrados</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest">Data / Tipo</th>
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest">ID (DWDM / IMOC)</th>
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest">Rede / Trecho</th>
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest">Empresa Executora</th>
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest">Motivo / Descrição</th>
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest">Status / Coordenadas</th>
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest text-right">Ganhos</th>
                <th className="px-5 py-4 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <AnimatePresence>
                {displayAtuacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-400 bg-slate-50/50">
                      Nenhum registro de atuação encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  displayAtuacoes.map((item, idx) => {
                    const formattedDate = formatToLocalDate(item.dataAbertura || item.data);
                    return (
                      <motion.tr 
                        key={`${item.idImoc}-${item.idDwdm}-${item.dataAbertura}-${idx}`} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* Data / Tipo */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-500 font-mono">
                              {formattedDate || 'Sem Data'}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider font-mono mt-0.5">
                              {item.tipoChamado || 'TRECHO'}
                            </span>
                          </div>
                        </td>

                        {/* ID (DWDM / IMOC) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-extrabold text-slate-900 font-mono">
                              DWDM: {item.idDwdm || 'Sem DWDM'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono font-semibold mt-0.5">
                              IMOC: {item.idImoc || 'Indefinido'}
                            </span>
                          </div>
                        </td>

                        {/* Rede / Trecho */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col max-w-xs">
                            <span className="text-xs font-bold text-slate-700 tracking-tight">
                              {item.trecho || 'Sem trecho mapeado'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                              {item.rede || 'FIBRA'}
                            </span>
                          </div>
                        </td>

                        {/* Empresa */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-xs font-semibold text-slate-650 bg-slate-100 px-2 py-1 rounded border border-slate-150">
                            {item.empresas || 'BRISANET'}
                          </span>
                        </td>

                        {/* Motivo */}
                        <td className="px-5 py-4">
                          <p className="text-xs text-slate-500 font-medium line-clamp-2 max-w-xs">
                            {item.motivo || '-'}
                          </p>
                        </td>

                        {/* Status / Coordenadas */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            {(() => {
                              const st = (item.status || 'CONCLUÍDA').toString().trim().toUpperCase();
                              const isDone = st === 'CONCLUÍDA' || st === 'CONCLUÍDO' || st === 'CONCLUIDO';
                              const isPending = st === 'PENDENTE' || st === 'ABERTO';
                              return (
                                <span className={cn(
                                  "px-2 px-1 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border",
                                  isDone 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                    : isPending
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                )}>
                                  {st}
                                </span>
                              );
                            })()}

                            {item.recebeuCoordenadas ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250/30 px-2 py-0.5 rounded">
                                <MapPin size={10} className="fill-emerald-100" />
                                Coord. Recebido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-rose-600 bg-rose-50 border border-rose-250/30 px-2 py-0.5 rounded italic">
                                Coordenada Pendente
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Ganhos */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <span className="text-xs font-bold text-emerald-650 font-mono">
                            +{Number(item.totalGanhos || 0).toFixed(2).replace('.', ',')} dB
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.status !== "CONCLUÍDA" && item.status !== "CONCLUIDA" && item.status !== "SOLUCIONADO" && currentUser?.permissions?.atuacoes_geral?.editar && (
                              <button 
                                onClick={() => onStartFinalize?.(item)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 rounded-lg transition-colors cursor-pointer"
                                title="Finalizar"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            {currentUser?.permissions?.atuacoes_geral?.editar && (
                              <button 
                                onClick={() => handleOpenModal('edit', item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar Atuação"
                              >
                                <Pencil size={15} />
                              </button>
                            )}

                            {currentUser?.permissions?.atuacoes_geral?.excluir && (
                              <button 
                                onClick={() => {
                                  if (onDelete) {
                                    onDelete(item.idImoc);
                                  }
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-colors cursor-pointer"
                                title="Excluir Atuação"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registry (Parity with Atenuacoes with smart Autocompletes + validation limits) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden text-slate-800"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-white">
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                    {modalMode === 'add' ? 'Novo Registro de Atuação' : 
                     modalMode === 'edit' ? 'Editar Registro de Atuação' : 'Duplicar Registro de Atuação'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Informe as características técnicas da manutenção executada</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={validateAndSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                
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
                    Cole o bloco de informações do chamado para preencher automaticamente o <strong>ID IMOC</strong>, a <strong>Data</strong>, a <strong>Rede</strong> e o <strong>Trecho</strong>.
                  </p>
                  <textarea
                    rows={3}
                    className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder-slate-400 font-mono text-slate-700 leading-relaxed"
                    placeholder="Cole o bloco do chamado aqui...&#10;Ex: ✨ Título: ATENUAÇÃO DWDM: Aracaju-DC-500 <> Pacatuba-DC-100&#10;📆 Aberto em: 23/07/26 às 11:31:22&#10;🔗 Link: https://saski.brisanet.net.br/chamado/651353"
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

                {/* 1. Tipo and ID IMOC / DWDM row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Tipo <span className="text-red-500">*</span></label>
                    <select 
                      required
                      className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all cursor-pointer"
                      value={formData.tipoChamado || ''}
                      onChange={(e) => setFormData({...formData, tipoChamado: e.target.value})}
                    >
                      <option value="" disabled>Selecione o tipo...</option>
                      <option value="TRECHO">TRECHO</option>
                      <option value="POS ROMPIMENTO">POS ROMPIMENTO</option>
                      <option value="TESTES">TESTES</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Status</label>
                    <select 
                      required
                      className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all cursor-pointer"
                      value={formData.status || 'EM ANDAMENTO'}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                      <option value="CONCLUÍDA">CONCLUÍDA</option>
                      <option value="PENDENTE">PENDENTE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">ID DWDM <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-300 focus:border-slate-500 outline-none transition-all"
                      placeholder="Ex: 651353"
                      value={formData.idDwdm || ''}
                      onChange={(e) => setFormData({...formData, idDwdm: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">ID IMOC</label>
                      <span className="text-[9px] text-slate-400 font-medium italic">(Opcional)</span>
                    </div>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-300 focus:border-slate-500 outline-none transition-all"
                      placeholder="Ex: 581234"
                      value={formData.idImoc || ''}
                      onChange={(e) => setFormData({...formData, idImoc: e.target.value})}
                    />
                  </div>
                </div>

                {/* 2. Rede (with autocomplete) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Rede <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-300 focus:border-slate-500 outline-none transition-all"
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
                      onBlur={() => setTimeout(() => setShowRedeSuggestions(false), 250)}
                    />
                    {showRedeSuggestions && (filteredRedes.length > 0 || (redeSearch.trim() !== '' && !uniqueRedes.map(u => u.toLowerCase()).includes(redeSearch.toLowerCase().trim()))) && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {filteredRedes.map(r => (
                          <button
                            key={r}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-800 font-semibold bg-white block border-b border-slate-50"
                            onClick={() => {
                              setFormData({...formData, rede: r});
                              setRedeSearch(r);
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
                            className="w-full text-left px-3 py-2 text-xs text-blue-600 font-bold hover:bg-blue-50 bg-white block border-t border-slate-100"
                            onClick={() => {
                              const newRede = redeSearch.trim().toUpperCase();
                              setFormData({...formData, rede: newRede});
                              setRedeSearch(newRede);
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

                  {/* Empresa */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Empresa Executora <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-300 focus:border-slate-500 outline-none transition-all"
                      placeholder="Ex: BRISANET ou EQUIPE_X"
                      value={formData.empresas || ''}
                      onChange={(e) => setFormData({...formData, empresas: e.target.value})}
                    />
                  </div>
                </div>

                {/* 3. Trecho */}
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Trecho <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-300 focus:border-slate-500 outline-none transition-all"
                    placeholder="Pesquisar ou digitar trechos de fibra..."
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
                    onBlur={() => setTimeout(() => setShowTrechoSuggestions(false), 250)}
                  />
                  {showTrechoSuggestions && (filteredTrechos.length > 0 || (trechoSearch.trim() !== '' && !allTrechos.map(u => u.toLowerCase()).includes(trechoSearch.toLowerCase().trim()))) && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredTrechos.map(t => (
                        <button
                          key={t}
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-800 font-semibold bg-white block border-b border-slate-50"
                          onClick={() => {
                            setFormData({...formData, trecho: t});
                            setTrechoSearch(t);
                            setShowTrechoSuggestions(false);
                            setIsTypingTrecho(false);
                            
                            // Autocompleta rede correspondente do trecho se aplicavel
                            const match = redeTrechoOptions.find(o => o.trecho === t);
                            if (match) {
                              setFormData(prev => ({...prev, rede: match.rede}));
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
                          className="w-full text-left px-3 py-2 text-xs text-blue-600 font-bold hover:bg-blue-50 bg-white block border-t border-slate-100"
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

                {/* 4. Motivo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Motivo / Descrição <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-300 focus:border-slate-500 outline-none transition-all"
                    placeholder="Ex: FIBRA EXPOSTA RESOLVIDA / SUBSTITUIÇÃO DE FUSÃO"
                    value={formData.motivo || ''}
                    onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                  />
                </div>

                {/* 5. Data with MASCARA and totalGanhos dB */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Data <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      maxLength={10}
                      className={cn(
                        "w-full bg-slate-50 text-slate-900 border rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 outline-none transition-all font-mono",
                        dateError 
                          ? "border-rose-500 focus:ring-rose-200" 
                          : "border-slate-250 focus:ring-slate-300 focus:border-slate-500"
                      )}
                      placeholder="DD/MM/AAAA"
                      value={formData.dataAbertura || ''}
                      onChange={(e) => {
                        const maskedDate = formatDateInput(e.target.value);
                        setFormData({...formData, dataAbertura: maskedDate});
                        setDateError(false);
                      }}
                    />
                    {dateError && (
                      <span className="text-[10px] text-rose-500 font-bold block">Digite uma data válida no formato DD/MM/AAAA</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Ganhos de Atenuação (dB)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      className="w-full bg-slate-50 text-slate-900 border border-slate-250 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-slate-300 focus:border-slate-500 outline-none transition-all font-mono"
                      placeholder="Ex: 1,5"
                      value={formData.totalGanhos === undefined || formData.totalGanhos === null || isNaN(formData.totalGanhos) ? "" : formData.totalGanhos}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData({...formData, totalGanhos: undefined});
                        } else {
                          const parsed = parseFloat(val);
                          setFormData({...formData, totalGanhos: isNaN(parsed) ? 0 : parsed});
                        }
                      }}
                    />
                  </div>
                </div>

                {/* 6. COORDENADAS RECEBIDAS CHECKBOX / TOGGER */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <label htmlFor="checkbox-coords" className="text-xs font-extrabold text-slate-700 uppercase tracking-wide cursor-pointer flex items-center gap-1.5 select-none">
                      <MapPin size={14} className="text-indigo-500" />
                      Coordenadas Recebidas?
                    </label>
                    <p className="text-[10px] text-slate-400 font-medium">Marque se as coordenadas georreferenciadas já foram fornecidas.</p>
                  </div>
                  <div>
                    <input 
                      id="checkbox-coords"
                      type="checkbox"
                      className="w-5 h-5 rounded text-blue-600 border-slate-350 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                      checked={!!formData.recebeuCoordenadas}
                      onChange={(e) => setFormData({...formData, recebeuCoordenadas: e.target.checked})}
                    />
                  </div>
                </div>

                {/* Submits and dismisses */}
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl text-xs font-bold text-slate-450 border border-slate-200 hover:bg-slate-100 transition-all bg-white cursor-pointer uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className={cn(
                      "flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-blue-150 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider",
                      isSaving && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      modalMode === 'edit' ? 'Salvar Alterações' : 'Registrar Atuação'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
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
                    Cadastro Rápido de Atuações em Campo
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
                  Cole abaixo a linha de dados de atuação copiada diretamente do Excel ou Google Sheets.
                  O sistema identificará de forma inteligente o Tipo, ID Chamado (ex: <strong>571302</strong>), ID IMOC (ex: <strong>592384</strong>), Data (ex: <strong>22/04/2026</strong>), Trecho (ex: <strong>AGUAS BELAS-DC-100 &lt;&gt; MATA GRANDE-DC-100</strong>), Perdas, Responsável e Status.
                </p>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                    Dados Copiados da Planilha:
                  </label>
                  <textarea
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    placeholder={`Cole aqui... Ex:
TRECHO 571302 592384 22/04/2026 CRU-SDR AGUAS BELAS-DC-100 <> MATA GRANDE-DC-100 1,5 VELOO CONCLUÍDA CONCLUÍDA`}
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
