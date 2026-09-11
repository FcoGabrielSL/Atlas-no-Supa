import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Bell,
  Search,
  Plus,
  PlusCircle,
  Edit,
  Trash2,
  User,
  Calendar,
  Filter,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  RefreshCw,
  Mail,
  ChevronDown,
  Lock,
  Eye,
  UserCheck,
  Check,
  Clock,
  Shield,
  HelpCircle,
  List,
  Trello,
  Table,
  GraduationCap,
  BookOpen,
  Play,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  MessageSquare,
  Send
} from "lucide-react";
import { UserConfig } from "../types";
import { cn } from "../lib/utils";
import { supabase } from "../supabaseClient";
import { confirmarLeituraAvisoSupabase, insertComentarioAvisoSupabase } from "../services/supabaseDataService";

export interface ComentarioAviso {
  autor: string;
  data: string;
  texto: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: string;
  prioridade: string;
  destino: string;
  destinatarioEmail: string;
  destinatarioNome: string;
  destinatarioId?: string;
  autor: string;
  autorEmail?: string;
  dataCriacao: string;
  status?: string;
  lido?: string;
  lido_por?: string[];
  concluido_por?: string[];
  concluidoPor?: string;
  id_autor?: number;
  autor_dados?: { nome?: string; sobrenome?: string; email?: string } | null;
  comentarios?: ComentarioAviso[] | string;
}

// Helper para formatar data e hora no padrão brasileiro DD/MM/AAAA HH:mm
export const formatarDataHoraBR = (dateStr?: string): string => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const aaaa = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${aaaa} ${hh}:${min}`;
    }
  } catch (_) {}
  return dateStr;
};

// Helper para formatar array de comentários em texto plano legível para o Google Sheets: [DD/MM/AAAA HH:mm] Nome: Texto
export const formatarComentariosParaPlanilha = (comentarios: any): string => {
  if (!comentarios) return "";
  if (typeof comentarios === "string") return comentarios;
  if (!Array.isArray(comentarios) || comentarios.length === 0) return "";

  return comentarios
    .map((c: any) => {
      if (typeof c === "string") return c;
      const dataHora = formatarDataHoraBR(c.data) || c.data || "";
      const autor = (c.autor || "Operador").trim();
      const texto = (c.texto || "").trim();
      return dataHora ? `[${dataHora}] ${autor}: ${texto}` : `${autor}: ${texto}`;
    })
    .join("\n\n");
};

// Helper para parsear comentários de forma segura e resiliente (suporta Array, JSON string ou Texto Plano do Sheets)
export const parseComentarios = (raw: any): ComentarioAviso[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    // 1. Tenta interpretar como JSON
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      // Não é JSON, continua para parsear texto plano
    }

    // 2. Se for texto plano no padrão [DD/MM/AAAA HH:mm] Nome: Texto
    const regexBloco = /\[(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?)\]\s*([^:\n]+):\s*([\s\S]*?)(?=(?:\n\s*\n|\n)?\[\d{2}\/\d{2}\/\d{4}|$)/g;
    const items: ComentarioAviso[] = [];
    let match;
    while ((match = regexBloco.exec(trimmed)) !== null) {
      items.push({
        data: match[1].trim(),
        autor: match[2].trim(),
        texto: match[3].trim()
      });
    }

    if (items.length > 0) {
      return items;
    }

    // 3. Fallback: Se for texto livre com quebras duplas de linha (\n\n)
    const blocos = trimmed.split(/\n\s*\n/).filter(b => b.trim());
    if (blocos.length > 1) {
      return blocos.map(b => ({
        autor: "Planilha",
        data: "",
        texto: b.trim()
      }));
    }

    // 4. Texto simples de linha única ou livre
    return [{ autor: "Planilha", data: "", texto: trimmed }];
  }
  return [];
};

interface PainelAvisosProps {
  avisos: Aviso[];
  usersList: UserConfig[];
  currentUser: UserConfig;
  onAdd: (aviso: Omit<Aviso, "id" | "dataCriacao" | "autor">) => void;
  onEdit: (aviso: Aviso) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  isSaving: boolean;
}

// Helper para formatar datas no formato DD/MM/AAAA
const formatarDataBR = (dateStr?: string): string => {
  if (!dateStr) return "";
  const cleaned = dateStr.trim();
  if (!cleaned) return "";

  // Se já estiver em DD/MM/AAAA, retorna
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    return cleaned;
  }

  // Se for ISO da planilha do tipo YYYY-MM-DD...
  const yyyymmdd = cleaned.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) {
    const [y, m, d] = yyyymmdd.split('-');
    return `${d}/${m}/${y}`;
  }

  // Se for qualquer outra data válida
  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (err) {}

  return cleaned;
};

// Helper para converter string de data em objeto Date para comparação
const parseToDate = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  // Formato DD/MM/AAAA
  const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    return new Date(year, month, day);
  }

  // Formato YYYY-MM-DD
  const yyyymmdd = cleaned.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (_) {}

  return null;
};

// Funções utilitárias de limpeza de exibição (remoção de parênteses e e-mails)
const cleanOperatorLabel = (raw?: string): string => {
  if (!raw) return "";
  return raw.split('(')[0].trim();
};

const cleanTaskLabel = (raw?: string): string => {
  if (!raw) return "";
  return raw.replace(/\s*\(.*?\)\s*/g, '').trim();
};

// Componente Dropdown Menu de Ações para Avisos (Kanban e Modal)
interface AvisoDropdownMenuProps {
  item: Aviso;
  userStage: "pendente" | "lida" | "concluida";
  onLerEConcluir: (aviso: Aviso) => void;
  onManterEmAndamento: (aviso: Aviso) => void;
  onReverterConclusao: (aviso: Aviso) => void;
  className?: string;
  placement?: "down" | "up";
}

const AvisoDropdownMenu: React.FC<AvisoDropdownMenuProps> = ({
  item,
  userStage,
  onLerEConcluir,
  onManterEmAndamento,
  onReverterConclusao,
  className = "",
  placement = "up",
}) => {
  const [menuAberto, setMenuAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    };

    if (menuAberto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuAberto]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Botão Gatilho */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuAberto((prev) => !prev);
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
        aria-haspopup="true"
        aria-expanded={menuAberto}
      >
        <span className="flex items-center gap-1.5 truncate">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              userStage === "pendente"
                ? "bg-[#FF5022]"
                : userStage === "lida"
                ? "bg-blue-500"
                : "bg-green-600"
            }`}
          />
          <span className="text-gray-800">Ações</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 shrink-0 ${
            menuAberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Menu Suspenso (Drop-Up com largura mínima e sem quebra de linha) */}
      {menuAberto && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2"
          } left-0 min-w-[180px] w-max whitespace-nowrap bg-white border border-gray-200 rounded shadow-xl z-[9999] overflow-hidden py-1 divide-y divide-gray-100`}
        >
          {/* Se NÃO leu */}
          {userStage === "pendente" && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onLerEConcluir(item);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <CheckCircle className="w-4 h-4 text-[#FF5022] shrink-0" />
                <span>Ler e Concluir</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onManterEmAndamento(item);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Manter em Andamento</span>
              </button>
            </div>
          )}

          {/* Se JÁ LEU, mas NÃO concluiu */}
          {userStage === "lida" && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onLerEConcluir(item);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-green-700 font-medium flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <span>Concluir Aviso</span>
              </button>
            </div>
          )}

          {/* Se JÁ CONCLUIU */}
          {userStage === "concluida" && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onReverterConclusao(item);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-amber-700 font-medium flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Reverter para Andamento</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente Dropdown "Ações" (Outline Laranja) para o rodapé do Modal de Detalhes
interface ModalAcoesDropdownProps {
  item: Aviso;
  userStage: "pendente" | "lida" | "concluida";
  onMarkAsRead: (aviso: Aviso) => void;
  onFinalizarPendencia: (aviso: Aviso) => void;
  onLerEConcluir: (aviso: Aviso) => void;
  onReverterConclusao: (aviso: Aviso) => void;
  canClosePendency?: boolean;
  onClosePendency?: (aviso: Aviso) => void;
}

const ModalAcoesDropdown: React.FC<ModalAcoesDropdownProps> = ({
  item,
  userStage,
  onMarkAsRead,
  onFinalizarPendencia,
  onLerEConcluir,
  onReverterConclusao,
  canClosePendency,
  onClosePendency
}) => {
  const [menuAberto, setMenuAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    };
    if (menuAberto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuAberto]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Gatilho Ações (Outline Laranja) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuAberto((prev) => !prev);
        }}
        className="flex items-center justify-between gap-2 px-3.5 py-1.5 bg-white hover:bg-orange-50/60 border border-[#FF5022] text-[#FF5022] hover:text-[#e0451a] font-semibold text-xs rounded-md shadow-2xs transition-colors cursor-pointer"
        aria-haspopup="true"
        aria-expanded={menuAberto}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              userStage === "pendente"
                ? "bg-[#FF5022]"
                : userStage === "lida"
                ? "bg-blue-500"
                : "bg-green-600"
            }`}
          />
          <span>Ações</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#FF5022] transition-transform duration-200 shrink-0 ${
            menuAberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Menu Suspenso */}
      {menuAberto && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full mb-2 left-0 min-w-[210px] w-max whitespace-nowrap bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden py-1 divide-y divide-gray-100"
        >
          {/* Se não leu: Confirmar Leitura (Visto) */}
          {userStage === "pendente" && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onMarkAsRead(item);
                }}
                className="w-full text-left px-3.5 py-2 text-xs hover:bg-orange-50/80 text-gray-700 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Eye className="w-4 h-4 text-[#FF5022] shrink-0" />
                <span>Confirmar Leitura (Visto)</span>
              </button>
              {item.tipo === "Aviso" && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    onLerEConcluir(item);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs hover:bg-orange-50/80 text-gray-700 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Ler e Concluir</span>
                </button>
              )}
            </div>
          )}

          {/* Se leu, mas não finalizou (e for Particularidade/Tarefa): Finalizar Pendência */}
          {userStage === "lida" && (
            <div className="py-0.5">
              {item.tipo !== "Aviso" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    onFinalizarPendencia(item);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs hover:bg-emerald-50 text-emerald-700 font-medium flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Finalizar Pendência</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    onLerEConcluir(item);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs hover:bg-emerald-50 text-emerald-700 font-medium flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Concluir Aviso</span>
                </button>
              )}
            </div>
          )}

          {/* Se já finalizou: Reverter para Andamento */}
          {userStage === "concluida" && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onReverterConclusao(item);
                }}
                className="w-full text-left px-3.5 py-2 text-xs hover:bg-amber-50 text-amber-700 font-medium flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Reverter para Andamento</span>
              </button>
            </div>
          )}

          {/* Opção para autor/admin: Fechar Pendência (Concluir Fluxo) */}
          {canClosePendency && onClosePendency && (
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);
                  onClosePendency(item);
                }}
                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-100 text-slate-800 font-medium flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Lock className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Fechar Pendência (Concluir Fluxo)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- INSTRUCTOR MODE CONSTANTS ---
const generalTourSteps = [
  {
    title: "👋 Conhecendo o Painel de Avisos",
    content: "Seja bem-vindo ao modo instrutivo do Painel de Avisos! Esta página foi estruturada de forma cooperativa para dar total visibilidade sobre comunicados, alertas de rede e atribuições de trabalho para todo o time."
  },
  {
    title: "📊 Colunas Kanban e Progresso",
    content: "O painel suporta um Modo Kanban que divide os registros em colunas lógicas:\n\n• 🔴 Pendentes: Avisos pendentes de leitura ou tarefas que você ainda não executou.\n• 🔵 Lidas: Avisos e particularidades que você já confirmou leitura e estão ativas.\n• 🟢 Concluídas: Tarefas finalizadas e pendências técnicas resolvidas com sucesso."
  },
  {
    title: "🔍 Filtragem Avançada e Abas",
    content: "Você pode usar as abas segmentadas para focar no que importa:\n\n• Todas: Visão global.\n• Atribuídas a Mim: Apenas pendências que exigem a sua atenção direta.\n• Criadas por Mim: Útil para você auditar e fechar os alertas que publicou."
  },
  {
    title: "🎨 Graus de Prioridade e Cores",
    content: "Cada registro possui um destaque de prioridade na lateral esquerda:\n\n• 🟥 Crítica: Alertas de severidade máxima (exigem atenção e solução imediata).\n• 🟧 Alta: Pontos de atenção elevados.\n• 🟦 Média e Cinza / Baixa: Informações e rotinas padrão."
  }
];

const createTourSteps = [
  {
    title: "✍️ Cadastro de Novos Alertas",
    content: "Para cadastrar um comunicado ou pendência, clique no botão 'Novo Registro' no topo direito. O formulário se abrirá para preenchimento. Vamos ver os detalhes do formulário!"
  },
  {
    title: "📝 Campos Principais: Título e Conteúdo",
    content: "Dê um título direto (ex: 'Instabilidade no Backbone Mossoró') e descreva detalhadamente os requisitos ou canais afetados no campo de Conteúdo."
  },
  {
    title: "💡 Escolhendo o Tipo Correto",
    content: "A escolha do Tipo dita as regras de resolução:\n\n• 📌 Aviso: Informativo geral (conclui-se após visualização).\n• ⚡ Particularidade: Pendência de infraestrutura de rede (qualquer operador pode finalizar globalmente).\n• 🎯 Tarefa: Atividade com progresso individual de cada operador designado."
  },
  {
    title: "👥 Escopo e Destinatários",
    content: "Selecione o escopo apropriado:\n\n• Todos: Publica para o time inteiro.\n• Atribuir Individualmente: Direciona e notifica apenas o operador que você escolher."
  }
];

const actionTourSteps = [
  {
    title: "⚡ Ações de Leitura e Resolução",
    content: "O ciclo de vida de cada registro evolui conforme os operadores interagem com ele. Vamos aprender as ações principais!"
  },
  {
    title: "👁️ Confirmar Leitura (Visto)",
    content: "Sempre que houver um 'Aviso' pendente para você, clique no botão roxo 'Confirmar Leitura' para registrar visualização. Isso sinaliza para o criador que você tomou ciência."
  },
  {
    title: "✅ Finalizar Particularidades e Tarefas",
    content: "Para pendências ativas, use o botão verde 'Finalizar':\n\n• Particularidades: Clicar em finalizar resolve o ponto técnico de rede para toda a equipe de uma vez.\n• Tarefas: Clicar em finalizar marca a SUA pendência como resolvida. Se for coletiva, os outros destinatários continuam pendentes até concluírem."
  },
  {
    title: "🔒 Auditoria e Fechamento (Cadeado)",
    content: "Para registros individuais criados por você: após o operador destinatário concluir, o card ficará em estado 'Concluído' com um botão de cadeado 'Confirmar Fechamento'. Clicar nele tranca em definitivo a pendência."
  }
];

export const PainelAvisos: React.FC<PainelAvisosProps> = ({
  avisos,
  usersList,
  currentUser,
  onAdd,
  onEdit,
  onDelete,
  onRefresh,
  isSaving
}) => {
  // Filters & State
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterPrioridade, setFilterPrioridade] = useState<string>("todas");
  const [filterCriador, setFilterCriador] = useState<string>("todos");
  const [filterDataInicio, setFilterDataInicio] = useState<string>("");
  const [filterDataFim, setFilterDataFim] = useState<string>("");
  const [activeStatusTab, setActiveStatusTab] = useState<"todas" | "pendentes" | "lidas" | "concluidas">("todas");
  const [activeSegmentTab, setActiveSegmentTab] = useState<"all" | "assigned_to_me" | "individual" | "created_by_me">("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "sheets">("list");

  // Multi-step Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);

  // Instructor Mode States
  const [instructorMode, setInstructorMode] = useState(false);
  const [showInstructorCentral, setShowInstructorCentral] = useState(false);
  const [activeSimulationTab, setActiveSimulationTab] = useState<"dictionary" | "tours">("dictionary");
  const [tourType, setTourType] = useState<"general" | "create" | "action" | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);

  // Read list collapse state in details modal
  const [showReadTrackerList, setShowReadTrackerList] = useState(false);
  const [showTaskCompletionTrackerList, setShowTaskCompletionTrackerList] = useState(false);

  // Thread de Comentários no Modal de Detalhes
  const [novoComentarioTexto, setNovoComentarioTexto] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Form State
  const [formTitulo, setFormTitulo] = useState("");
  const [formConteudo, setFormConteudo] = useState("");
  const [formTipo, setFormTipo] = useState<"Aviso" | "Particularidade" | "Tarefa">("Aviso");
  const [formPrioridade, setFormPrioridade] = useState<"Baixa" | "Média" | "Alta" | "Crítica">("Média");
  const [formDestino, setFormDestino] = useState<"Todos" | "Individual">("Todos");
  const [selectedUserEmail, setSelectedUserEmail] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Finalization states
  const [showFinalizeCommentModal, setShowFinalizeCommentModal] = useState(false);
  const [finalizeComment, setFinalizeComment] = useState("");
  const [pendingFinalizeAviso, setPendingFinalizeAviso] = useState<Aviso | null>(null);
  const [finalizeActionType, setFinalizeActionType] = useState<"resolve" | "close" | "">("");

  // Compute active members for selection
  const activeMembersOnly = useMemo(() => {
    return usersList.filter(u => u.nome && u.email);
  }, [usersList]);

  // Current user's display name for author parsing
  const currentAuthorName = useMemo(() => {
    return `${currentUser.nome || "Usuário"} ${currentUser.sobrenome || ""}`.trim();
  }, [currentUser]);

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    return !!(
      currentUser.permissions?.admin?.visualizar ||
      currentUser.permissions?.admin?.editar ||
      currentUser.permissions?.admin?.excluir ||
      currentUser.permissions?.settings?.visualizar
    );
  }, [currentUser]);

  // Open Add Modal
  const openAdd = () => {
    setFormTitulo("");
    setFormConteudo("");
    setFormTipo("Aviso");
    setFormPrioridade("Média");
    setFormDestino("Todos");
    setSelectedUserEmail(activeMembersOnly[0]?.email || "");
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEdit = (aviso: Aviso) => {
    setSelectedAviso(aviso);
    setFormTitulo(aviso.titulo);
    setFormConteudo(aviso.conteudo);
    setFormTipo(aviso.tipo as any);
    setFormPrioridade(aviso.prioridade as any);
    setFormDestino(aviso.destino as any);
    setSelectedUserEmail(aviso.destinatarioEmail);
    setShowEditModal(true);
  };

  // Open Detail Modal
  const openDetail = (aviso: Aviso) => {
    setSelectedAviso(aviso);
    setShowReadTrackerList(false);
    setShowTaskCompletionTrackerList(false);
    setNovoComentarioTexto("");
    setShowDetailModal(true);
  };

  // Add Submit handler
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim() || !formConteudo.trim()) return;

    let destEmail = "Todos";
    let destNome = "Todos os Membros";

    if (formDestino === "Individual") {
      const targetUser = activeMembersOnly.find(u => u.email === selectedUserEmail);
      if (targetUser) {
        destEmail = targetUser.email;
        const rawName = `${targetUser.nome} ${targetUser.sobrenome || ""}`.trim();
        destNome = cleanOperatorLabel(rawName) || targetUser.email.split('@')[0];
      } else {
        destEmail = selectedUserEmail;
        destNome = cleanOperatorLabel(selectedUserEmail);
      }
    }

    // Injeção Obrigatória de id_autor do usuário ativo durante o insert
    const authorId = Number(currentUser?.id) || 1;
    const newAvisoId = "av-" + Math.floor(1000 + Math.random() * 9000);

    try {
      await supabase.from("Tb_Avisos").insert([{
        id_aviso: newAvisoId,
        titulo: formTitulo,
        descricao: formConteudo,
        tipo: formTipo,
        prioridade: formPrioridade,
        id_autor: authorId,
        status: "Aberto"
      }]);
    } catch (sbErr) {
      console.warn("[Supabase] Falha ao inserir Tb_Avisos no PainelAvisos:", sbErr);
    }

    onAdd({
      id: newAvisoId,
      titulo: formTitulo,
      conteudo: formConteudo,
      tipo: formTipo,
      prioridade: formPrioridade,
      destino: formDestino,
      destinatarioEmail: destEmail,
      destinatarioNome: destNome,
      id_autor: authorId
    } as any);

    setShowAddModal(false);
  };

  // Edit Submit handler
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAviso || !formTitulo.trim() || !formConteudo.trim()) return;

    let destEmail = "Todos";
    let destNome = "Todos os Membros";

    if (formDestino === "Individual") {
      const targetUser = activeMembersOnly.find(u => u.email === selectedUserEmail);
      if (targetUser) {
        destEmail = targetUser.email;
        const rawName = `${targetUser.nome} ${targetUser.sobrenome || ""}`.trim();
        destNome = cleanOperatorLabel(rawName) || targetUser.email.split('@')[0];
      } else {
        destEmail = selectedUserEmail;
        destNome = cleanOperatorLabel(selectedUserEmail);
      }
    }

    onEdit({
      ...selectedAviso,
      titulo: formTitulo,
      conteudo: formConteudo,
      tipo: formTipo,
      prioridade: formPrioridade,
      destino: formDestino,
      destinatarioEmail: destEmail,
      destinatarioNome: destNome
    });

    setShowEditModal(false);
    setSelectedAviso(null);
  };

  // Helper para obter o nome real do autor (autor_dados do join ou busca por id_autor em usersList)
  const getAuthorDisplayName = (aviso: Aviso): string => {
    if (aviso.autor_dados?.nome) {
      const sName = aviso.autor_dados.sobrenome ? ` ${aviso.autor_dados.sobrenome}` : "";
      return `${aviso.autor_dados.nome}${sName}`.trim();
    }
    if (aviso.id_autor && usersList && usersList.length > 0) {
      const found = usersList.find(u => Number(u.id) === Number(aviso.id_autor));
      if (found?.nome) {
        const sName = found.sobrenome ? ` ${found.sobrenome}` : "";
        return `${found.nome}${sName}`.trim();
      }
    }
    // Se aviso.autor tiver o formato "Operador #46", busca o usuário pelo ID 46
    if (aviso.autor && aviso.autor.includes("Operador #") && usersList && usersList.length > 0) {
      const match = aviso.autor.match(/\d+/);
      if (match) {
        const numId = Number(match[0]);
        const found = usersList.find(u => Number(u.id) === numId);
        if (found?.nome) {
          const sName = found.sobrenome ? ` ${found.sobrenome}` : "";
          return `${found.nome}${sName}`.trim();
        }
      }
    }
    return aviso.autor || "Sistema";
  };

  // Check if current user is the author of a notice
  const isNoticeAuthor = (aviso: Aviso) => {
    const authorDisplayName = getAuthorDisplayName(aviso).toLowerCase().trim();
    const curAuthor = currentAuthorName.toLowerCase().trim();
    if (authorDisplayName === curAuthor) return true;
    if ((aviso.autor || "").toLowerCase().trim() === curAuthor) return true;
    if (currentUser?.id && aviso.id_autor && Number(currentUser.id) === Number(aviso.id_autor)) return true;
    return false;
  };

  // Check if current user has permission to edit or delete
  const canEditOrDelete = (aviso: Aviso) => {
    return isAdmin || isNoticeAuthor(aviso);
  };

  // Check if a user has read this specific notice (com suporte prioritário a lido_por: UUIDs/emails)
  const hasUserReadNotice = (
    aviso: Aviso,
    userOrEmail: UserConfig | { id?: string | number; email?: string } | string
  ): boolean => {
    if (!aviso) return false;

    const targetId = typeof userOrEmail === "object" && userOrEmail?.id ? String(userOrEmail.id).trim() : "";
    const targetEmail = (typeof userOrEmail === "string" ? userOrEmail : userOrEmail?.email || "").toLowerCase().trim();

    // 1. Verificação prioritária pelo array lido_por (strings/UUIDs)
    if (Array.isArray(aviso.lido_por) && aviso.lido_por.length > 0) {
      const readById = targetId && aviso.lido_por.map(String).includes(targetId);
      const readByEmail = targetEmail && aviso.lido_por.map(e => String(e).trim().toLowerCase()).includes(targetEmail);
      if (readById || readByEmail) return true;
    }

    // 2. Retrocompatibilidade com campo legado 'lido'
    if (aviso.lido) {
      const rawLido = String(aviso.lido).trim();
      if (rawLido.startsWith("[") && rawLido.endsWith("]")) {
        try {
          const parsed = JSON.parse(rawLido);
          if (Array.isArray(parsed)) {
            if (targetId && parsed.map(String).includes(targetId)) return true;
            if (targetEmail && parsed.map(e => String(e).trim().toLowerCase()).includes(targetEmail)) return true;
          }
        } catch (_) {}
      }

      const readEmails = rawLido
        .split(",")
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

      if (readEmails.includes("sim") && (aviso.destino === "Individual" || !aviso.destino)) {
        if (!aviso.destinatarioEmail || targetEmail === aviso.destinatarioEmail.toLowerCase().trim()) {
          return true;
        }
      }

      if (targetEmail && readEmails.includes(targetEmail)) return true;
      if (targetId && readEmails.includes(targetId.toLowerCase())) return true;
    }

    return false;
  };

  // Check if a user has completed this specific task (Tarefa)
  const hasUserCompletedTask = (item: Aviso, email: string) => {
    const emailKey = email.toLowerCase().trim();
    if (!item.concluidoPor) return false;
    
    const completedEmails = item.concluidoPor
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
      
    return completedEmails.includes(emailKey);
  };

  // Função dedicada para atualização segura de status em Tb_Avisos (evita PATCH 409 e erros de colunas inexistentes)
  const updateStatus = async (avisoId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from("Tb_Avisos")
        .update({ status: novoStatus })
        .eq("id_aviso", avisoId);

      if (error) {
        console.warn("[updateStatus] Erro ao atualizar status no Supabase:", error);
      }
    } catch (err) {
      console.warn("[updateStatus] Falha no PATCH de Tb_Avisos:", err);
    }
  };

  // Action: Marcar como Lido / Confirmar Leitura (Recibo de Leitura via Tb_Destinacoes)
  const handleConfirmarLeitura = async (aviso: Aviso) => {
    const userId = currentUser?.id ? String(currentUser.id).trim() : "";
    const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : "";

    // Normaliza o array lido_por existente
    let currentLidoPor: string[] = [];
    if (Array.isArray(aviso.lido_por)) {
      currentLidoPor = [...aviso.lido_por.map(String)];
    } else if (aviso.lido && typeof aviso.lido === "string") {
      currentLidoPor = aviso.lido
        .split(",")
        .map(e => e.trim())
        .filter(e => e && !["não", "nao", "sim"].includes(e.toLowerCase()));
    }

    // Injeta o user.id e o user.email no array lido_por sem duplicidades
    if (userId && !currentLidoPor.some(val => val === userId)) {
      currentLidoPor.push(userId);
    }
    if (userEmail && !currentLidoPor.some(val => val.toLowerCase() === userEmail)) {
      currentLidoPor.push(userEmail);
    }

    // REGRA CRÍTICA DE ESTADO GLOBAL:
    // Se o aviso for para "Todos", o status global NÃO é alterado (mantém "Aberto" para não concluir para os outros).
    // Apenas se for aviso "Individual", o status pode mudar para "Visualizado".
    const newStatus = aviso.destino === "Todos"
      ? (aviso.status || "Aberto")
      : ((aviso.status || "Aberto") === "Aberto" ? "Visualizado" : aviso.status);

    const updated: Aviso = {
      ...aviso,
      lido_por: currentLidoPor,
      lido: currentLidoPor.join(","), // retrocompatibilidade para planilhas/tabelas
      status: newStatus
    };

    if (showDetailModal && selectedAviso?.id === aviso.id) {
      setSelectedAviso(updated);
    } else {
      setSelectedAviso(null);
      setShowDetailModal(false);
    }

    // 1. Persistência segura em Tb_Destinacoes com APENAS colunas existentes (id_aviso, id_user, tipo_destino, lido)
    try {
      const numericUserId = Number(currentUser?.id) || 0;
      if (numericUserId > 0) {
        await supabase
          .from("Tb_Destinacoes")
          .upsert(
            {
              id_aviso: aviso.id,
              id_user: numericUserId,
              tipo_destino: aviso.destino === "Individual" ? "Individual" : "Todos",
              lido: true
            },
            { onConflict: "id_aviso, id_user" }
          );
      } else if (userEmail) {
        await confirmarLeituraAvisoSupabase(aviso.id, userEmail);
      }
    } catch (destErr) {
      console.warn("[Tb_Destinacoes upsert warning]", destErr);
    }

    // 2. Atualização isolada de status em Tb_Avisos usando a chave primária correta (id_aviso)
    try {
      if (aviso.destino !== "Todos" && newStatus !== aviso.status) {
        await updateStatus(aviso.id, newStatus);
      }
    } catch (sbErr) {
      console.warn("[Tb_Avisos update status warning]", sbErr);
    }

    onEdit(updated);
  };

  const handleMarkAsRead = handleConfirmarLeitura;

  // Action: Ler e Concluir (Atualiza lido_por E concluido_por com user.id/email e move para Concluídas)
  const handleLerEConcluir = async (aviso: Aviso) => {
    const userId = currentUser?.id ? String(currentUser.id).trim() : "";
    const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : "";

    // 1. Array de lido_por
    let currentLidoPor: string[] = [];
    if (Array.isArray(aviso.lido_por)) {
      currentLidoPor = [...aviso.lido_por.map(String)];
    } else if (aviso.lido && typeof aviso.lido === "string") {
      currentLidoPor = aviso.lido
        .split(",")
        .map(e => e.trim())
        .filter(e => e && !["não", "nao", "sim"].includes(e.toLowerCase()));
    }
    if (userId && !currentLidoPor.includes(userId)) currentLidoPor.push(userId);
    if (userEmail && !currentLidoPor.some(e => e.toLowerCase() === userEmail)) currentLidoPor.push(userEmail);

    // 2. Array de concluido_por
    let currentConcluidoPor: string[] = [];
    if (Array.isArray(aviso.concluido_por)) {
      currentConcluidoPor = [...aviso.concluido_por.map(String)];
    } else if (aviso.concluidoPor) {
      const raw = String(aviso.concluidoPor).trim();
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) currentConcluidoPor = parsed.map(String);
        } catch (_) {}
      }
      if (currentConcluidoPor.length === 0) {
        currentConcluidoPor = raw.split(",").map(e => e.trim()).filter(Boolean);
      }
    }
    if (userId && !currentConcluidoPor.includes(userId)) currentConcluidoPor.push(userId);
    if (userEmail && !currentConcluidoPor.some(e => e.toLowerCase() === userEmail)) currentConcluidoPor.push(userEmail);

    const newStatus = aviso.destino === "Todos"
      ? (aviso.status || "Aberto")
      : "Concluído";

    const updated: Aviso = {
      ...aviso,
      lido_por: currentLidoPor,
      lido: currentLidoPor.join(","),
      concluido_por: currentConcluidoPor,
      concluidoPor: currentConcluidoPor.join(","),
      status: newStatus
    };

    if (showDetailModal && selectedAviso?.id === aviso.id) {
      setSelectedAviso(updated);
    } else {
      setSelectedAviso(null);
      setShowDetailModal(false);
    }

    try {
      const numericUserId = Number(currentUser?.id) || 0;
      if (numericUserId > 0) {
        await supabase
          .from("Tb_Destinacoes")
          .upsert(
            {
              id_aviso: aviso.id,
              id_user: numericUserId,
              tipo_destino: aviso.destino === "Individual" ? "Individual" : "Todos",
              lido: true
            },
            { onConflict: "id_aviso, id_user" }
          );
      } else if (userEmail) {
        await confirmarLeituraAvisoSupabase(aviso.id, userEmail);
      }
      if (aviso.destino !== "Todos" && newStatus !== aviso.status) {
        await updateStatus(aviso.id, newStatus);
      }
    } catch (sbErr) {
      console.warn("[Supabase] Aviso update ler e concluir:", sbErr);
    }

    onEdit(updated);
  };

  // Action: Reverter Conclusão (Remove o usuário de concluido_por e move de volta para Lidas / Em Andamento)
  const handleReverterConclusao = async (aviso: Aviso) => {
    const userId = currentUser?.id ? String(currentUser.id).trim() : "";
    const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : "";

    // 1. Array atual de concluido_por
    let currentConcluidoPor: string[] = [];
    if (Array.isArray(aviso.concluido_por)) {
      currentConcluidoPor = [...aviso.concluido_por.map(String)];
    } else if (aviso.concluidoPor) {
      const raw = String(aviso.concluidoPor).trim();
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) currentConcluidoPor = parsed.map(String);
        } catch (_) {}
      }
      if (currentConcluidoPor.length === 0) {
        currentConcluidoPor = raw.split(",").map(e => e.trim()).filter(Boolean);
      }
    }

    // 2. Filtra removendo o id e o email do usuário
    const novoArrayConcluido = currentConcluidoPor.filter(
      id => id !== userId && id.toLowerCase() !== userEmail
    );

    // 3. Garante que o usuário permaneça em lido_por (para que volte a figurar como lido / em andamento)
    let currentLidoPor: string[] = [];
    if (Array.isArray(aviso.lido_por)) {
      currentLidoPor = [...aviso.lido_por.map(String)];
    } else if (aviso.lido && typeof aviso.lido === "string") {
      currentLidoPor = aviso.lido
        .split(",")
        .map(e => e.trim())
        .filter(e => e && !["não", "nao", "sim"].includes(e.toLowerCase()));
    }
    if (userId && !currentLidoPor.includes(userId)) currentLidoPor.push(userId);
    if (userEmail && !currentLidoPor.some(e => e.toLowerCase() === userEmail)) currentLidoPor.push(userEmail);

    const newStatus = aviso.destino === "Todos"
      ? (aviso.status || "Aberto")
      : "Visualizado";

    const updated: Aviso = {
      ...aviso,
      concluido_por: novoArrayConcluido,
      concluidoPor: novoArrayConcluido.join(","),
      lido_por: currentLidoPor,
      lido: currentLidoPor.join(","),
      status: newStatus
    };

    if (showDetailModal && selectedAviso?.id === aviso.id) {
      setSelectedAviso(updated);
    } else {
      setSelectedAviso(null);
      setShowDetailModal(false);
    }

    try {
      if (aviso.destino !== "Todos" && newStatus !== aviso.status) {
        await updateStatus(aviso.id, newStatus);
      }
    } catch (sbErr) {
      console.warn("[Supabase] Aviso update reverter conclusao:", sbErr);
    }

    onEdit(updated);
  };

  // Action: Marcar como Resolvido / Concluído (Recipient of individual notice)
  const handleMarkAsResolved = (aviso: Aviso) => {
    setPendingFinalizeAviso(aviso);
    setFinalizeActionType("resolve");
    setFinalizeComment("");
    setShowFinalizeCommentModal(true);
  };

  const executeMarkAsResolved = async (aviso: Aviso, comment?: string) => {
    const userId = currentUser?.id ? String(currentUser.id).trim() : "";
    const userEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : "";

    // Array de concluído
    let currentConcluidoPor: string[] = [];
    if (Array.isArray(aviso.concluido_por)) {
      currentConcluidoPor = [...aviso.concluido_por.map(String)];
    } else if (aviso.concluidoPor) {
      const raw = String(aviso.concluidoPor).trim();
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) currentConcluidoPor = parsed.map(String);
        } catch (_) {}
      }
      if (currentConcluidoPor.length === 0) {
        currentConcluidoPor = raw.split(",").map(e => e.trim()).filter(Boolean);
      }
    }

    if (userId && !currentConcluidoPor.includes(userId)) {
      currentConcluidoPor.push(userId);
    }
    if (userEmail && !currentConcluidoPor.some(e => e.toLowerCase() === userEmail)) {
      currentConcluidoPor.push(userEmail);
    }

    // Array de lido (quem concluiu também leu)
    let currentLidoPor: string[] = [];
    if (Array.isArray(aviso.lido_por)) {
      currentLidoPor = [...aviso.lido_por.map(String)];
    } else if (aviso.lido && typeof aviso.lido === "string") {
      currentLidoPor = aviso.lido
        .split(",")
        .map(e => e.trim())
        .filter(e => e && !["não", "nao", "sim"].includes(e.toLowerCase()));
    }
    if (userId && !currentLidoPor.includes(userId)) {
      currentLidoPor.push(userId);
    }
    if (userEmail && !currentLidoPor.some(e => e.toLowerCase() === userEmail)) {
      currentLidoPor.push(userEmail);
    }

    let updatedConteudo = aviso.conteudo;
    const comentariosAtuais = parseComentarios(aviso.comentarios);
    let updatedComentarios = comentariosAtuais;
    if (comment && comment.trim() !== "") {
      const todayString = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      updatedConteudo = `${aviso.conteudo}\n\n💬 **Comentários de Finalização por ${currentAuthorName} em ${todayString}:**\n${comment.trim()}`;
      
      const novoComentario: ComentarioAviso = {
        autor: currentAuthorName,
        data: new Date().toISOString(),
        texto: `[Finalização] ${comment.trim()}`
      };
      updatedComentarios = [...comentariosAtuais, novoComentario];
    }

    // REGRA DE ESTADO ISOLADO:
    // Clicar em "Concluir" em aviso de grupo ("Todos") não altera o status global para não concluir para os demais.
    const newStatus = aviso.destino === "Todos"
      ? (aviso.status || "Aberto")
      : "Concluído";

    const updated: Aviso = {
      ...aviso,
      conteudo: updatedConteudo,
      comentarios: updatedComentarios,
      concluido_por: currentConcluidoPor,
      concluidoPor: currentConcluidoPor.join(","),
      lido_por: currentLidoPor,
      lido: currentLidoPor.join(","),
      status: newStatus
    };

    if (showDetailModal && selectedAviso?.id === aviso.id) {
      setSelectedAviso(updated);
    } else {
      setSelectedAviso(null);
      setShowDetailModal(false);
    }

    try {
      if (comment && comment.trim() !== "") {
        await insertComentarioAvisoSupabase(
          aviso.id,
          currentAuthorName,
          `[Finalização] ${comment.trim()}`
        ).catch(() => {});
      }
      if (aviso.destino !== "Todos" && newStatus !== aviso.status) {
        await updateStatus(aviso.id, newStatus);
      }
    } catch (sbErr) {
      console.warn("[Supabase] Aviso update mark as resolved:", sbErr);
    }

    onEdit(updated);
  };

  // Action: Fechar Pendência (Author of individual notice or Admin)
  const handleClosePendency = (aviso: Aviso) => {
    setPendingFinalizeAviso(aviso);
    setFinalizeActionType("close");
    setFinalizeComment("");
    setShowFinalizeCommentModal(true);
  };

  const executeClosePendency = async (aviso: Aviso, comment?: string) => {
    let updatedConteudo = aviso.conteudo;
    if (comment && comment.trim() !== "") {
      const todayString = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      updatedConteudo = `${aviso.conteudo}\n\n🔒 **Comentários de Fechamento por ${currentAuthorName} em ${todayString}:**\n${comment.trim()}`;
      try {
        await insertComentarioAvisoSupabase(
          aviso.id,
          currentAuthorName,
          `[Fechamento] ${comment.trim()}`
        ).catch(() => {});
      } catch (_) {}
    }

    const updated: Aviso = {
      ...aviso,
      conteudo: updatedConteudo,
      status: "Fechado"
    };
    setSelectedAviso(null);
    setShowDetailModal(false);

    try {
      await updateStatus(aviso.id, "Fechado");
    } catch (e) {}

    onEdit(updated);
  };

  // Action: Adicionar novo comentário na thread do aviso/particularidade
  const handleAddComment = async () => {
    if (!novoComentarioTexto.trim() || !selectedAviso) return;

    setIsSubmittingComment(true);

    const autorNome = currentUser?.nome
      ? `${currentUser.nome} ${currentUser.sobrenome || ""}`.trim()
      : (currentUser?.email ? currentUser.email.split("@")[0] : currentAuthorName || "Operador");

    const novoComentario: ComentarioAviso = {
      autor: autorNome,
      data: new Date().toISOString(),
      texto: novoComentarioTexto.trim()
    };

    const comentariosAtuais = parseComentarios(selectedAviso.comentarios);
    const arrayAtualizado = [...comentariosAtuais, novoComentario];

    // 1. Formatação para Texto Plano (Sheets): [DD/MM/AAAA HH:mm] Nome: Texto do comentário
    const stringFormatadaParaPlanilha = arrayAtualizado
      .map((c) => {
        const dataHora = formatarDataHoraBR(c.data) || new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const autor = (c.autor || "Operador").trim();
        const texto = (c.texto || "").trim();
        return `[${dataHora}] ${autor}: ${texto}`;
      })
      .join("\n\n");

    // 2. Persistência no Supabase (insere na tabela filha Tb_Comentarios com FK ON DELETE CASCADE e atualiza Tb_Avisos)
    try {
      await insertComentarioAvisoSupabase(selectedAviso.id, autorNome, novoComentarioTexto.trim());
      const { error: sbError } = await supabase
        .from("Tb_Avisos")
        .update({ comentarios: arrayAtualizado })
        .eq("id", selectedAviso.id);

      if (sbError) {
        console.warn("[Supabase] Tb_Avisos update comentarios warning:", sbError);
      }
    } catch (sbErr) {
      console.warn("[Supabase] Tb_Avisos update comentarios exception:", sbErr);
    }

    // 4. Atualização local do modal
    const updatedAviso: Aviso = {
      ...selectedAviso,
      comentarios: arrayAtualizado
    };

    setSelectedAviso(updatedAviso);
    setNovoComentarioTexto("");
    setIsSubmittingComment(false);

    // 5. Propagação para o App.tsx (atualiza estado global e cache local)
    onEdit(updatedAviso);
  };

  // Check if a user is coordinator or admin
  const isCoordenadorOrAdmin = useMemo(() => {
    // 1. If user is admin (has admin visualize or edit permissions) or role matches
    if (
      currentUser.permissions?.admin?.visualizar ||
      currentUser.nivel?.toLowerCase().includes("admin") ||
      currentUser.nivel?.toLowerCase().includes("coord")
    ) {
      return true;
    }
    // 2. Or if their email is specific coordinator/admin emails
    const emailLower = (currentUser.email || "").toLowerCase().trim();
    if (
      emailLower.includes("adm") || 
      emailLower.includes("coord") || 
      emailLower === "francisco@grupoasg.com.br" ||
      emailLower === "francisco.gabriel@grupobrisanet.com.br" ||
      emailLower === "contato@franciscogabriel.com.br"
    ) {
      return true;
    }
    return false;
  }, [currentUser]);

  // 2. Privacidade Absoluta em Avisos Individuais:
  // Se a categoria do aviso for "Individual", ele só pode ser retornado/exibido se o e-mail/ID
  // do usuário logado for igual ao do criador OU igual ao do destinatário.
  // Se não for nenhum dos dois, oculte o registro.
  const isNoticeVisible = (item: Aviso) => {
    const curEmail = (currentUser.email || "").toLowerCase().trim();
    const curId = currentUser.id ? String(currentUser.id).toLowerCase().trim() : "";

    if (item.destino === "Individual") {
      const destEmail = (item.destinatarioEmail || "").toLowerCase().trim();
      const destId = item.destinatarioId ? String(item.destinatarioId).toLowerCase().trim() : "";

      const authorEmail = (item.autorEmail || "").toLowerCase().trim();
      const authorName = (item.autor || "").toLowerCase().trim();
      const curAuthorName = currentAuthorName.toLowerCase().trim();

      const isDestinatario = (destEmail && destEmail === curEmail) || (destId && curId && destId === curId);
      const isCriador = (authorEmail && authorEmail === curEmail) || (authorName && authorName === curAuthorName);

      return isDestinatario || isCriador;
    }

    // Se o aviso for em grupo ("Todos"), é visível a todos
    return true;
  };

  const visibleAvisos = useMemo(() => {
    return avisos.filter(isNoticeVisible);
  }, [avisos, currentAuthorName, currentUser.email, currentUser.id]);

  // 3. Estágios de Leitura Individuais (Pendentes, Lidas, Concluídas):
  // - Vai para Concluídas: se aviso.concluido_por.includes(currentUser.id)
  // - Vai para Lidas: se aviso.lido_por.includes(currentUser.id) E não está em concluídas
  // - Vai para Pendentes: se não está presente em nenhum dos dois arrays
  const getAvisoUserStage = (item: Aviso, user: UserConfig): "pendente" | "lida" | "concluida" => {
    const userId = user.id ? String(user.id).trim() : "";
    const userEmail = user.email ? user.email.toLowerCase().trim() : "";

    // Concluídos
    let concluidoList: string[] = [];
    if (Array.isArray(item.concluido_por)) {
      concluidoList = item.concluido_por.map(String);
    } else if (item.concluidoPor) {
      const raw = String(item.concluidoPor).trim();
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) concluidoList = parsed.map(String);
        } catch (_) {}
      }
      if (concluidoList.length === 0) {
        concluidoList = raw.split(",").map(e => e.trim()).filter(Boolean);
      }
    }

    const isConcluido =
      (userId && concluidoList.includes(userId)) ||
      (userEmail && concluidoList.map(e => e.toLowerCase()).includes(userEmail)) ||
      (item.destino === "Individual" && (item.status === "Concluído" || item.status === "Fechado"));

    if (isConcluido) return "concluida";

    // Lidos
    let lidoList: string[] = [];
    if (Array.isArray(item.lido_por)) {
      lidoList = item.lido_por.map(String);
    } else if (item.lido) {
      const raw = String(item.lido).trim();
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) lidoList = parsed.map(String);
        } catch (_) {}
      }
      if (lidoList.length === 0) {
        lidoList = raw.split(",").map(e => e.trim()).filter(e => e && !["não", "nao", "sim"].includes(e.toLowerCase()));
      }
    }

    const isLido =
      (userId && lidoList.includes(userId)) ||
      (userEmail && lidoList.map(e => e.toLowerCase()).includes(userEmail)) ||
      (item.destino === "Individual" && (item.status === "Visualizado" || item.lido === "Sim"));

    if (isLido) return "lida";

    return "pendente";
  };

  // Autores / Criadores únicos para o filtro dinâmico
  const uniqueCriadores = useMemo(() => {
    const set = new Set<string>();
    visibleAvisos.forEach((a) => {
      const creator = getAuthorDisplayName(a);
      if (creator) {
        set.add(creator);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [visibleAvisos, usersList]);

  // Filter & Search Logic
  const filteredAvisos = useMemo(() => {
    return visibleAvisos.filter((item) => {
      // 0. Status Tab (Pendentes, Lidas, Concluídas, Todas)
      if (activeStatusTab !== "todas") {
        const userStage = getAvisoUserStage(item, currentUser);
        if (activeStatusTab === "pendentes" && userStage !== "pendente") return false;
        if (activeStatusTab === "lidas" && userStage !== "lida") return false;
        if (activeStatusTab === "concluidas" && userStage !== "concluida") return false;
      }

      const authorDisplayName = getAuthorDisplayName(item);

      // 1. Search Query
      const matchSearch =
        item.titulo.toLowerCase().includes(search.toLowerCase()) ||
        item.conteudo.toLowerCase().includes(search.toLowerCase()) ||
        authorDisplayName.toLowerCase().includes(search.toLowerCase()) ||
        item.autor.toLowerCase().includes(search.toLowerCase()) ||
        item.destinatarioNome.toLowerCase().includes(search.toLowerCase());

      // 2. Filter Type
      const matchTipo =
        filterTipo === "todos" || item.tipo.toLowerCase() === filterTipo.toLowerCase();

      // 3. Filter Criador (Dinâmico)
      const matchCriador =
        filterCriador === "todos" ||
        (authorDisplayName && authorDisplayName.toLowerCase().trim() === filterCriador.toLowerCase().trim()) ||
        (item.autor && item.autor.toLowerCase().trim() === filterCriador.toLowerCase().trim()) ||
        ((item as any).criado_por && String((item as any).criado_por).toLowerCase().trim() === filterCriador.toLowerCase().trim());

      // 4. Filter Priority
      const matchPrioridade =
        filterPrioridade === "todas" || item.prioridade.toLowerCase() === filterPrioridade.toLowerCase();

      // 5. Filter Data/Período
      const matchPeriodo = (() => {
        if (!filterDataInicio && !filterDataFim) return true;
        const itemDate = parseToDate(item.dataCriacao);
        if (!itemDate) return false;

        const compareTime = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

        if (filterDataInicio) {
          const start = parseToDate(filterDataInicio);
          if (start && compareTime < new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) {
            return false;
          }
        }

        if (filterDataFim) {
          const end = parseToDate(filterDataFim);
          if (end && compareTime > new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()) {
            return false;
          }
        }

        return true;
      })();

      return matchSearch && matchTipo && matchCriador && matchPrioridade && matchPeriodo;
    });
  }, [visibleAvisos, activeStatusTab, search, filterTipo, filterCriador, filterPrioridade, currentUser, filterDataInicio, filterDataFim]);

  // Tab Badge counts por status (Pendentes, Lidas, Concluídas, Todas)
  const statusCounts = useMemo(() => {
    let pendentes = 0;
    let lidas = 0;
    let concluidas = 0;

    visibleAvisos.forEach((item) => {
      const userStage = getAvisoUserStage(item, currentUser);
      if (userStage === "concluida") {
        concluidas++;
      } else if (userStage === "lida") {
        lidas++;
      } else {
        pendentes++;
      }
    });

    return {
      pendentes,
      lidas,
      concluidas,
      todas: visibleAvisos.length
    };
  }, [visibleAvisos, currentUser]);

  // Kanban columns computation
  const columnsData = useMemo(() => {
    const pendentes: Aviso[] = [];
    const lidas: Aviso[] = [];
    const concluidas: Aviso[] = [];

    filteredAvisos.forEach(item => {
      const userStage = getAvisoUserStage(item, currentUser);
      if (userStage === "concluida") {
        concluidas.push(item);
      } else if (userStage === "lida") {
        lidas.push(item);
      } else {
        pendentes.push(item);
      }
    });

    return { pendentes, lidas, concluidas };
  }, [filteredAvisos, currentUser]);

  // Statistics Calculation for Indicators
  const stats = useMemo(() => {
    const pendingVisible = visibleAvisos.filter(a => {
      const customStatus = (a.status || "Aberto").trim();
      const isConcluded = customStatus === "Concluído" || customStatus === "Concluido" || customStatus === "Fechado";
      if (isConcluded) return false;

      const alreadyRead = hasUserReadNotice(a, currentUser.email);
      if (alreadyRead || a.lido === "Sim" || customStatus === "Visualizado") {
        return false;
      }
      return true;
    });

    const total = pendingVisible.length;
    // Crítica + Alta
    const criticas = pendingVisible.filter(a => a.prioridade === "Crítica" || a.prioridade === "Alta").length;
    const particularidades = pendingVisible.filter(a => a.tipo === "Particularidade").length;
    const direcionadosAMim = pendingVisible.filter(a => a.destinatarioEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()).length;

    return { total, criticas, particularidades, direcionadosAMim };
  }, [visibleAvisos, currentUser.email]);

  // Reader list calculations for selected notice
  const readersInfo = useMemo(() => {
    if (!selectedAviso) return { readUsers: [], missingUsers: [] };

    if (selectedAviso.destino === "Individual") {
      const isRead = hasUserReadNotice(selectedAviso, selectedAviso.destinatarioEmail);
      const displayName = selectedAviso.destinatarioNome || selectedAviso.destinatarioEmail;
      
      return {
        readUsers: isRead ? [{ email: selectedAviso.destinatarioEmail, nome: displayName }] : [],
        missingUsers: !isRead ? [{ email: selectedAviso.destinatarioEmail, nome: displayName }] : []
      };
    }

    // Collective
    const readUsers: { email: string; nome: string }[] = [];
    const missingUsers: { email: string; nome: string }[] = [];

    activeMembersOnly.forEach(u => {
      const matches = hasUserReadNotice(selectedAviso, u);
      const desc = `${u.nome} ${u.sobrenome || ""}`.trim();
      if (matches) {
        readUsers.push({ email: u.email, nome: desc });
      } else {
        // Ignorar o próprio autor para não poluir
        if (u.email.toLowerCase().trim() !== selectedAviso.autor.toLowerCase().trim()) {
          missingUsers.push({ email: u.email, nome: desc });
        }
      }
    });

    return { readUsers, missingUsers };
  }, [selectedAviso, activeMembersOnly]);

  // Task completion calculations for selected task
  const taskCompletionInfo = useMemo(() => {
    if (!selectedAviso || selectedAviso.tipo !== "Tarefa") return { completedUsers: [], pendingUsers: [] };

    if (selectedAviso.destino === "Individual") {
      const completedEmails = selectedAviso.concluidoPor
        ? selectedAviso.concluidoPor.split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const isCompleted = completedEmails.includes(selectedAviso.destinatarioEmail.toLowerCase().trim());
      const displayName = selectedAviso.destinatarioNome || selectedAviso.destinatarioEmail;
      
      return {
        completedUsers: isCompleted ? [{ email: selectedAviso.destinatarioEmail, nome: displayName }] : [],
        pendingUsers: !isCompleted ? [{ email: selectedAviso.destinatarioEmail, nome: displayName }] : []
      };
    }

    // Collective
    const completedEmails = selectedAviso.concluidoPor
      ? selectedAviso.concluidoPor.split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
      : [];

    const completedUsers: { email: string; nome: string }[] = [];
    const pendingUsers: { email: string; nome: string }[] = [];

    activeMembersOnly.forEach(u => {
      const matches = completedEmails.includes(u.email.toLowerCase().trim());
      const desc = `${u.nome} ${u.sobrenome || ""}`.trim();
      if (matches) {
        completedUsers.push({ email: u.email, nome: desc });
      } else {
        pendingUsers.push({ email: u.email, nome: desc });
      }
    });

    return { completedUsers, pendingUsers };
  }, [selectedAviso, activeMembersOnly]);

  // Helper styles for Priority
  const getPriorityClasses = (p: string) => {
    switch (p) {
      case "Crítica":
        return {
          bg: "bg-rose-50 border-rose-200 text-rose-700",
          tagLabel: "Crítica",
          badge: "bg-rose-50 text-rose-700 border border-rose-200/70",
          itemBorder: ""
        };
      case "Alta":
        return {
          bg: "bg-orange-50 border-orange-200 text-[#FF5022]",
          tagLabel: "Alta",
          badge: "bg-orange-50 text-[#FF5022] border border-orange-200/70",
          itemBorder: ""
        };
      case "Média":
        return {
          bg: "bg-gray-100 border-gray-200 text-gray-700",
          tagLabel: "Média",
          badge: "bg-gray-100 text-gray-700",
          itemBorder: ""
        };
      default:
        return {
          bg: "bg-gray-100 border-gray-200 text-gray-700",
          tagLabel: "Baixa",
          badge: "bg-gray-100 text-gray-700",
          itemBorder: ""
        };
    }
  };

  // Helper to render tracking progress status
  const renderProgressTracker = (item: Aviso) => {
    if (item.destino !== "Individual") return null;

    const customStatus = (item.status || "Aberto").trim();
    const readerName = item.destinatarioNome || item.destinatarioEmail;
    const isRead = item.lido === "Sim" || customStatus === "Visualizado";
    const isConcluded = customStatus === "Concluído" || customStatus === "Concluido";
    const isClosed = customStatus === "Fechado";

    let statusText = "";
    let badgeStyles = "";

    if (isClosed) {
      statusText = "Finalizado & Fechado 🔒";
      badgeStyles = "bg-slate-100 text-slate-700 border-slate-300";
    } else if (isConcluded) {
      statusText = `${readerName} resolveu ✓ (Aguardando seu Fechamento)`;
      badgeStyles = "bg-emerald-50 text-emerald-805 border-emerald-300 animate-pulse";
    } else if (isRead) {
      statusText = `${readerName} leu / visualizou 👁️`;
      badgeStyles = "bg-blue-50 text-blue-800 border-blue-250";
    } else {
      statusText = `${readerName} ainda não leu ⏳`;
      badgeStyles = "bg-amber-50 text-amber-800 border-amber-250";
    }

    return (
      <div 
        className={`mt-2.5 p-2 bg-white border rounded-xl flex items-center justify-between text-[11px] font-bold gap-2 ${badgeStyles}`}
        onClick={(e) => {
          // Prevent opening detail modal when clicking tracker
          e.stopPropagation();
        }}
      >
        <span className="flex items-center gap-1.5 truncate">
          <UserCheck className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span className="truncate">Andamento: <strong>{statusText}</strong></span>
        </span>
        {isConcluded && canEditOrDelete(item) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClosePendency(item);
            }}
            className="px-2.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition text-[9px] font-extrabold cursor-pointer h-5 flex items-center shrink-0 border-none shadow-xs"
          >
            Fechar fluxo
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 animate-fade-in font-sans text-slate-800">
      {/* HEADER SECTION */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#FFF5F2] text-[#FF5022] rounded-xl border border-orange-100/60">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
                Painel de Avisos e Particularidades da Rede
              </h1>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Central cooperativa para informes, alertas de rede e acompanhamento de pendências.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            id="header-novo-registro"
            onClick={openAdd}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF5022] hover:bg-orange-600 text-white rounded-xl shadow-xs hover:shadow transition font-sans font-bold text-xs cursor-pointer",
              tourType === "create" && tourStep === 0 && "ring-4 ring-emerald-500 ring-offset-2 animate-pulse"
            )}
          >
            <Plus className="w-4 h-4" />
            Novo Registro
          </button>
        </div>
      </div>

      {/* INSTRUCTOR WELCOMING BANNER */}
      {instructorMode && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-emerald-100 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm border border-emerald-400">
              <GraduationCap className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-emerald-950 font-sans">
                🎓 Você está no Modo Instrutor do Painel de Avisos!
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed max-w-3xl">
                Este assistente interativo ensina você a ver avisos, cadastrar novos registros, confirmar leitura e finalizar tarefas de forma prática. Use os guias explicativos ou ative os simuladores!
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowInstructorCentral(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs text-xs font-bold font-sans transition cursor-pointer border-none"
            >
              Abrir Central de Ajuda
            </button>
            <button
              type="button"
              onClick={() => {
                setInstructorMode(false);
                setTourStep(null);
                setTourType(null);
              }}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold font-sans transition cursor-pointer"
            >
              Desativar Modo
            </button>
          </div>
        </div>
      )}

      {/* ABAS PRIMÁRIAS DE STATUS & SELETOR DE VISUALIZAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 px-1 pt-1">
        <div 
          id="filter-status-abas"
          className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar"
        >
          <button
            type="button"
            onClick={() => setActiveStatusTab("todas")}
            className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
              activeStatusTab === "todas"
                ? "border-[#FF5022] text-[#FF5022] font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
            }`}
          >
            <span>Todas</span>
            <span className="text-[11px] opacity-75 font-mono">({statusCounts.todas})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatusTab("pendentes")}
            className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
              activeStatusTab === "pendentes"
                ? "border-[#FF5022] text-[#FF5022] font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
            }`}
          >
            <span>Pendentes</span>
            <span className="text-[11px] opacity-75 font-mono">({statusCounts.pendentes})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatusTab("lidas")}
            className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
              activeStatusTab === "lidas"
                ? "border-[#FF5022] text-[#FF5022] font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
            }`}
          >
            <span>Lidas</span>
            <span className="text-[11px] opacity-75 font-mono">({statusCounts.lidas})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStatusTab("concluidas")}
            className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
              activeStatusTab === "concluidas"
                ? "border-[#FF5022] text-[#FF5022] font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
            }`}
          >
            <span>Concluídas</span>
            <span className="text-[11px] opacity-75 font-mono">({statusCounts.concluidas})</span>
          </button>
        </div>

        {/* View Mode Toggle como Abas Limpas */}
        <div 
          id="filter-viewmode"
          className={cn(
            "flex items-center gap-6 shrink-0 self-start sm:self-auto",
            tourType === "general" && tourStep === 1 && "ring-4 ring-emerald-500 ring-offset-1 bg-emerald-50 rounded-lg"
          )}
        >
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
              viewMode === "list"
                ? "border-[#FF5022] text-[#FF5022] font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
            }`}
            title="Visualização em Lista"
          >
            <List className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
              viewMode === "kanban"
                ? "border-[#FF5022] text-[#FF5022] font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
            }`}
            title="Quadro Kanban"
          >
            <Trello className="w-3.5 h-3.5" />
            <span>Quadro Kanban</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("sheets")}
            className={`pb-2.5 text-xs font-sans whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] bg-transparent ${
              viewMode === "sheets"
                ? "border-[#FF5022] text-[#FF5022] font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 font-medium"
            }`}
            title="Visualização em Formato Planilha (Google Sheets)"
          >
            <Table className="w-3.5 h-3.5" />
            <span>Planilha</span>
          </button>
        </div>
      </div>

      {/* FILTROS E BARRA DE BUSCA DIRETOS SOBRE O FUNDO */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por título, conteúdo, autor ou destinatário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022]/20 rounded-lg pl-10 pr-4 py-2 text-xs font-medium text-slate-700 placeholder-gray-400 focus:outline-none transition font-sans shadow-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Filter Type */}
          <div className="flex items-center gap-1">
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="bg-white border border-gray-200 hover:border-gray-300 focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022]/20 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none transition cursor-pointer font-sans shadow-xs"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="aviso">Pendências / Avisos</option>
              <option value="particularidade">Particularidades de Rede</option>
              <option value="tarefa">Tarefas Individuais/Coletivas</option>
            </select>
          </div>

          {/* Filter Criador (Dinâmico) */}
          <div className="flex items-center gap-1">
            <select
              value={filterCriador}
              onChange={(e) => setFilterCriador(e.target.value)}
              className="bg-white border border-gray-200 hover:border-gray-300 focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022]/20 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none transition cursor-pointer font-sans shadow-xs"
            >
              <option value="todos">Todos os Criadores</option>
              {uniqueCriadores.map((criador) => (
                <option key={criador} value={criador}>
                  {criador}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Período */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-slate-700 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <span className="text-gray-400">De</span>
              <input
                type="date"
                value={filterDataInicio}
                onChange={(e) => setFilterDataInicio(e.target.value)}
                className="bg-transparent border-none text-[11px] font-sans text-slate-700 focus:outline-none cursor-pointer p-0 w-[105px] h-5"
              />
              <span className="mx-0.5 text-gray-300">•</span>
              <span className="text-gray-400">Até</span>
              <input
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="bg-transparent border-none text-[11px] font-sans text-slate-700 focus:outline-none cursor-pointer p-0 w-[105px] h-5"
              />
              {(filterDataInicio || filterDataFim) && (
                <button
                  onClick={() => {
                    setFilterDataInicio("");
                    setFilterDataFim("");
                  }}
                  className="ml-1 p-0.5 text-gray-400 hover:text-[#FF5022] rounded transition cursor-pointer"
                  title="Limpar período"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NOTICES LIST FEED */}
      <div className="space-y-4">
        {filteredAvisos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
            <Bell className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
            <h3 className="text-base font-bold text-slate-700 mt-3 font-sans">Nenhum aviso ou particularidade</h3>
            <p className="text-xs text-slate-500 font-sans mt-1 max-w-sm mx-auto">
              Nenhum registro foi encontrado com os termos pesquisados ou filtros ativos nesta categoria.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAvisos.map((item, idx) => {
              const decor = getPriorityClasses(item.prioridade);
              const alreadyRead = hasUserReadNotice(item, currentUser.email);
              const customStatus = (item.status || "Aberto").trim();

              return (
                <div
                  key={item.id ? `${item.id}-${idx}` : `av-${idx}`}
                  onClick={() => openDetail(item)}
                  className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm hover:border-gray-200 hover:shadow transition cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header: badges padronizadas */}
                    <div className="flex items-center justify-between gap-2 pb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                          {cleanTaskLabel(item.tipo)}
                        </span>

                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${decor.badge}`}>
                          {item.prioridade}
                        </span>

                        {/* Lifecycle Status Badge for individual pendency */}
                        {item.destino === "Individual" && (
                          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                            {customStatus}
                          </span>
                        )}
                        
                        {/* Scope pill */}
                        <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                          {item.destino === "Todos" ? "# Coletivo" : "🔒 Individual"}
                        </span>
                      </div>

                      <span className="text-xs text-gray-400 font-mono flex items-center gap-1 font-medium shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatarDataBR(item.dataCriacao)}
                      </span>
                    </div>

                    {/* Title & snippet */}
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight leading-snug hover:text-[#FF5022] transition flex items-center gap-2">
                        {!alreadyRead && (
                          <span className="w-2 h-2 rounded-full bg-[#FF5022] block shrink-0" title="Aviso Não Lido!"></span>
                        )}
                        <span className="truncate">{item.titulo}</span>
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed font-sans line-clamp-2">
                        {item.conteudo}
                      </p>
                    </div>
                  </div>

                  {/* Tracking badge for progress */}
                  {renderProgressTracker(item)}

                  {/* Foot details */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500 font-sans font-medium">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-700 font-bold uppercase select-none">
                        {getAuthorDisplayName(item)[0] || "A"}
                      </div>
                      <span className="truncate">Por: <strong className="text-gray-700 font-semibold">{getAuthorDisplayName(item)}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.destino === "Individual" ? (
                        <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200/60 rounded font-sans">
                          Para: {cleanOperatorLabel(item.destinatarioNome)}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200/60 rounded font-sans">
                          Todos os Membros
                        </span>
                      )}

                      {((item.tipo === "Particularidade" && customStatus !== "Concluído" && customStatus !== "Fechado") ||
                        (item.tipo === "Tarefa" && !hasUserCompletedTask(item, currentUser.email) && customStatus !== "Concluído" && customStatus !== "Fechado")) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsResolved(item);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer border-none shadow-xs"
                          title={item.tipo === "Tarefa" ? "Finalizar Tarefa" : "Finalizar Particularidade"}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Finalizar
                        </button>
                      )}

                      {item.tipo === "Aviso" && (item.destino === "Todos" || item.destinatarioEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) && (
                        <div className="relative overflow-visible">
                          <AvisoDropdownMenu
                            item={item}
                            userStage={getAvisoUserStage(item, currentUser)}
                            onLerEConcluir={handleLerEConcluir}
                            onManterEmAndamento={handleMarkAsRead}
                            onReverterConclusao={handleReverterConclusao}
                            className="w-40 mt-0"
                          />
                        </div>
                      )}

                      {item.tipo === "Tarefa" ? (
                        hasUserCompletedTask(item, currentUser.email) ? (
                          <span className="text-xs text-emerald-600 font-medium select-none">
                            ✓ concluído
                          </span>
                        ) : alreadyRead ? (
                          <span className="text-xs text-gray-500 font-medium select-none">
                            👁️ lido
                          </span>
                        ) : (
                          <span className="text-xs text-[#FF5022] font-medium select-none">
                            pendente
                          </span>
                        )
                      ) : item.tipo === "Aviso" ? null : alreadyRead ? (
                        <span className="text-xs text-emerald-600 font-medium select-none">
                          ✓ lido
                        </span>
                      ) : (
                        <span className="text-xs text-[#FF5022] font-medium select-none">
                          pendente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === "kanban" ? (
          /* KANBAN BOARD VIEW COLORFUL */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Column 1: Pendentes */}
            <div 
              id="kanban-pendentes"
              className={cn(
                "bg-slate-50 border-[1.5px] border-slate-300 rounded-2xl p-4.5 space-y-4 shadow-xs min-h-[500px] transition-all",
                ((tourType === "action" && tourStep === 1) || (tourType === "general" && tourStep === 1)) && "ring-4 ring-rose-400 ring-offset-2 bg-rose-50/20"
              )}
            >
              <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Pendentes</h4>
                </div>
                <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-black font-mono border border-rose-200">
                  {columnsData.pendentes.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {columnsData.pendentes.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-10 font-sans">Tudo limpo! Nenhuma pendência a ser lida.</p>
                ) : (
                  columnsData.pendentes.map((item, idx) => {
                    const decor = getPriorityClasses(item.prioridade);
                    const alreadyRead = hasUserReadNotice(item, currentUser);
                    const isDirectedToMe = item.destinatarioEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();

                    return (
                      <div
                        key={item.id ? `${item.id}-${idx}` : `pen-${idx}`}
                        onClick={() => openDetail(item)}
                        className="bg-white border border-gray-100 hover:border-gray-200 rounded-lg p-4 shadow-sm hover:shadow transition cursor-pointer space-y-3 relative overflow-visible"
                      >
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                            {cleanTaskLabel(item.tipo)}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${decor.badge}`}>
                            {item.prioridade}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h5 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-[#FF5022] transition">{item.titulo}</h5>
                          <p className="text-xs text-gray-600 leading-normal line-clamp-2">{item.conteudo}</p>
                        </div>

                        {renderProgressTracker(item)}

                        <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium">
                          <span className="truncate">De: <strong className="text-gray-700 font-semibold">{getAuthorDisplayName(item).split(" ")[0]}</strong></span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium shrink-0">{item.destino === "Todos" ? "# Coletivo" : "🔒 Individual"}</span>
                        </div>

                        {/* Dropdown Menu de Ações para Avisos */}
                        {item.tipo === "Aviso" && (item.destino === "Todos" || isDirectedToMe) && (
                          <div className="mt-3 relative overflow-visible">
                            <AvisoDropdownMenu
                              item={item}
                              userStage={getAvisoUserStage(item, currentUser)}
                              onLerEConcluir={handleLerEConcluir}
                              onManterEmAndamento={handleMarkAsRead}
                              onReverterConclusao={handleReverterConclusao}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Column 2: Em Andamento */}
            <div 
              id="kanban-em-andamento"
              className={cn(
                "bg-slate-50 border-[1.5px] border-slate-300 rounded-2xl p-4.5 space-y-4 shadow-xs min-h-[500px] transition-all",
                ((tourType === "action" && tourStep === 3) || (tourType === "general" && tourStep === 1)) && "ring-4 ring-blue-400 ring-offset-2 bg-blue-50/20"
              )}
            >
              <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Em Andamento</h4>
                </div>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-850 rounded-full text-[10px] font-black font-mono border border-blue-200">
                  {columnsData.lidas.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {columnsData.lidas.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-10 font-sans">Nenhuma pendência em andamento.</p>
                ) : (
                  columnsData.lidas.map((item, idx) => {
                    const decor = getPriorityClasses(item.prioridade);
                    const customStatus = (item.status || "Aberto").trim();
                    const isDirectedToMe = item.destinatarioEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();

                    return (
                      <div
                        key={item.id ? `${item.id}-${idx}` : `lid-${idx}`}
                        onClick={() => openDetail(item)}
                        className="bg-white border border-gray-100 hover:border-gray-200 rounded-lg p-4 shadow-sm hover:shadow transition cursor-pointer space-y-3 relative overflow-visible"
                      >
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                            {cleanTaskLabel(item.tipo)}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${decor.badge}`}>
                            {item.prioridade}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h5 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-[#FF5022] transition">{item.titulo}</h5>
                          <p className="text-xs text-gray-600 leading-normal line-clamp-2">{item.conteudo}</p>
                        </div>

                        {renderProgressTracker(item)}

                        <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium">
                          <span className="truncate">Para: <strong className="text-gray-700 font-semibold">{cleanOperatorLabel(item.destinatarioNome).split(" ")[0]}</strong></span>
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 border border-blue-200/60 rounded text-xs font-medium flex items-center gap-0.5 select-none shrink-0">
                            👁️ Em Andamento
                          </span>
                        </div>

                        {/* Dropdown Menu de Ações para Avisos */}
                        {item.tipo === "Aviso" && (item.destino === "Todos" || isDirectedToMe) && (
                          <div className="mt-3 relative overflow-visible">
                            <AvisoDropdownMenu
                              item={item}
                              userStage={getAvisoUserStage(item, currentUser)}
                              onLerEConcluir={handleLerEConcluir}
                              onManterEmAndamento={handleMarkAsRead}
                              onReverterConclusao={handleReverterConclusao}
                            />
                          </div>
                        )}

                        {/* Interactive button inside Column 2 for quick resolution */}
                        {((item.tipo === "Particularidade" && customStatus !== "Concluído" && customStatus !== "Fechado") ||
                          (item.tipo === "Tarefa" && !hasUserCompletedTask(item, currentUser.email) && customStatus !== "Concluído" && customStatus !== "Fechado")) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsResolved(item);
                            }}
                            className="w-full mt-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs hover:shadow cursor-pointer border-none"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {item.tipo === "Tarefa" ? "Finalizar Tarefa" : "Finalizar Particularidade"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Column 3: Concluídas */}
            <div 
              id="kanban-concluidas"
              className={cn(
                "bg-slate-50 border-[1.5px] border-slate-300 rounded-2xl p-4.5 space-y-4 shadow-xs min-h-[500px] transition-all",
                ((tourType === "action" && tourStep === 4) || (tourType === "general" && tourStep === 1)) && "ring-4 ring-emerald-400 ring-offset-2 bg-emerald-50/20"
              )}
            >
              <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Concluídas</h4>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black font-mono border border-emerald-200">
                  {columnsData.concluidas.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {columnsData.concluidas.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-10 font-sans">Nenhuma finalizada ainda.</p>
                ) : (
                  columnsData.concluidas.map((item, idx) => {
                    const decor = getPriorityClasses(item.prioridade);
                    const customStatus = (item.status || "Aberto").trim();
                    const isDirectedToMe = item.destinatarioEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();

                    return (
                      <div
                        key={item.id ? `${item.id}-${idx}` : `cnc-${idx}`}
                        onClick={() => openDetail(item)}
                        className="bg-white border border-gray-100 hover:border-gray-200 rounded-lg p-4 shadow-xs hover:shadow transition cursor-pointer space-y-3 relative overflow-visible opacity-90 hover:opacity-100"
                      >
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                            {cleanTaskLabel(item.tipo)}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${decor.badge}`}>
                            {item.prioridade}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h5 className="text-xs font-semibold text-slate-800 line-through decoration-slate-400 leading-snug line-clamp-2">{item.titulo}</h5>
                          <p className="text-xs text-gray-400 leading-normal line-clamp-2">{item.conteudo}</p>
                        </div>

                        {renderProgressTracker(item)}

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                          <span>Para: <strong className="text-gray-700 font-semibold">{cleanOperatorLabel(item.destinatarioNome).split(" ")[0]}</strong></span>
                          <span className="text-emerald-700 font-bold uppercase flex items-center gap-0.5">✓ Finalizado</span>
                        </div>

                        {/* Dropdown Menu de Ações para Avisos */}
                        {item.tipo === "Aviso" && (item.destino === "Todos" || isDirectedToMe) && (
                          <div className="mt-3 relative overflow-visible">
                            <AvisoDropdownMenu
                              item={item}
                              userStage={getAvisoUserStage(item, currentUser)}
                              onLerEConcluir={handleLerEConcluir}
                              onManterEmAndamento={handleMarkAsRead}
                              onReverterConclusao={handleReverterConclusao}
                            />
                          </div>
                        )}

                        {/* Interactive button inside Column 3 for author closure */}
                        {item.destino === "Individual" && canEditOrDelete(item) && customStatus === "Concluído" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClosePendency(item);
                            }}
                            className="w-full mt-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs hover:shadow cursor-pointer border-none"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Confirmar Fechamento
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* SPREADSHEET (PLANILHA GOOGLE SHEETS STYLE) VIEW */
          <div className="bg-white border border-gray-300 shadow-xs rounded-sm overflow-hidden font-sans">
            {/* Sheet Formula / Action Bar */}
            <div className="bg-[#F8F9FA] border-b border-gray-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 select-none">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 bg-white border border-gray-300 px-2 py-0.5 rounded text-[11px] font-mono shadow-2xs">
                  fx
                </span>
                <span className="text-gray-400 text-[11px]">|</span>
                <span className="text-[11px] text-slate-500 italic">
                  Modo Planilha ativo • {filteredAvisos.length} registro(s) exibido(s)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
                  Pendente
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                  Concluído
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#FF5022] hover:bg-[#E04015] text-white font-bold text-[11px] px-2.5 py-1 rounded shadow-2xs flex items-center gap-1 transition cursor-pointer border-none"
                >
                  <Plus className="w-3 h-3 text-white" />
                  Nova Linha
                </button>
              </div>
            </div>

            {/* Scrollable Table Area */}
            <div className="overflow-x-auto max-w-full">
              <table className="w-full border-collapse text-left select-text">
                <thead>
                  {/* Google Sheets Column Letters (A, B, C, D, E, F, G) */}
                  <tr className="bg-[#2A2A2A] text-gray-300 text-[11px] font-medium border-b border-gray-700 select-none">
                    <th className="w-10 text-center border-r border-gray-700 py-0.5 bg-[#1E1E1E] text-gray-400 font-mono"></th>
                    <th className="border-r border-gray-700 text-center py-0.5 font-mono">A</th>
                    <th className="border-r border-gray-700 text-center py-0.5 font-mono">B</th>
                    <th className="border-r border-gray-700 text-center py-0.5 font-mono">C</th>
                    <th className="border-r border-gray-700 text-center py-0.5 font-mono">D</th>
                    <th className="border-r border-gray-700 text-center py-0.5 font-mono">E</th>
                    <th className="border-r border-gray-700 text-center py-0.5 font-mono">F</th>
                    <th className="text-center py-0.5 font-mono">G</th>
                  </tr>

                  {/* Main Graphite Table Header according to Design System */}
                  <tr className="bg-[#1E1E1E] text-white font-bold border border-gray-700 text-sm">
                    <th className="w-10 text-center border-r border-gray-700 py-1.5 bg-[#2A2A2A] text-gray-300 font-mono text-xs select-none">
                      1
                    </th>
                    <th className="border border-gray-700 px-3 py-1.5 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Solicitante</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </th>
                    <th className="border border-gray-700 px-3 py-1.5 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Destinatário</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </th>
                    <th className="border border-gray-700 px-3 py-1.5 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>ID DWDM</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </th>
                    <th className="border border-gray-700 px-3 py-1.5 whitespace-nowrap min-w-[220px]">
                      <div className="flex items-center justify-between gap-1">
                        <span>Titulo</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </th>
                    <th className="border border-gray-700 px-3 py-1.5 whitespace-nowrap text-center min-w-[120px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Concluído</span>
                        <Filter className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </th>
                    <th className="border border-gray-700 px-3 py-1.5 whitespace-nowrap min-w-[280px]">
                      <div className="flex items-center justify-between gap-1">
                        <span>Observação/ Resolução</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </th>
                    <th className="border border-gray-700 px-3 py-1.5 whitespace-nowrap text-center min-w-[170px]">
                      <span>Ações</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="text-sm font-sans divide-y divide-gray-200">
                  {filteredAvisos.map((item, index) => {
                    const customStatus = (item.status || "Pendente").trim();
                    const isConcluido = customStatus === "Concluído" || customStatus === "Concluido" || customStatus === "Fechado" || customStatus === "Solucionado";
                    const isPendente = !isConcluido;
                    const solicitanteNome = getAuthorDisplayName(item);
                    const destinatarioNome = item.destino === "Todos" 
                      ? "Todos" 
                      : (cleanOperatorLabel(item.destinatarioNome) || item.destinatarioEmail || "Individual");
                    const idDwdm = (item as any).idDwdm || (item as any)["ID DWDM"] || item.id || "";
                    const observacao = item.conteudo || (item as any).observacao || (item as any).resolucao || "";

                    return (
                      <tr 
                        key={item.id ? `${item.id}-${index}` : `av-tb-${index}`} 
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => openDetail(item)}
                      >
                        {/* Row Number */}
                        <td className="border border-gray-300 py-1 text-center bg-[#F8F9FA] text-xs text-gray-500 font-mono select-none">
                          {index + 2}
                        </td>

                        {/* Col A: Solicitante */}
                        <td className="border border-gray-300 px-2.5 py-1 text-sm text-gray-900 bg-white whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-800">{solicitanteNome}</span>
                            <ChevronDown className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </td>

                        {/* Col B: Destinatário (estilo dropdown com fundo rosa suave) */}
                        <td className="border border-gray-300 px-2 py-1 text-sm whitespace-nowrap bg-[#FCE4EC]">
                          <div className="flex items-center justify-between gap-2 text-rose-900 font-medium px-1">
                            <span>{destinatarioNome}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          </div>
                        </td>

                        {/* Col C: ID DWDM */}
                        <td className="border border-gray-300 px-2.5 py-1 text-sm text-gray-700 bg-white font-mono whitespace-nowrap">
                          {idDwdm || "-"}
                        </td>

                        {/* Col D: Titulo */}
                        <td className="border border-gray-300 px-2.5 py-1 text-sm font-semibold text-slate-900 bg-white">
                          <div className="flex items-center gap-1.5">
                            {!hasUserReadNotice(item, currentUser.email) && (
                              <span className="w-2 h-2 rounded-full bg-[#FF5022] shrink-0" title="Não lido"></span>
                            )}
                            <span className="truncate max-w-[260px]">{item.titulo}</span>
                          </div>
                        </td>

                        {/* Col E: Concluído (Status Condicional) */}
                        <td 
                          className="border border-gray-300 px-2 py-1 text-sm text-center bg-white whitespace-nowrap"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPendente) {
                              handleMarkAsResolved(item);
                            } else {
                              openDetail(item);
                            }
                          }}
                        >
                          {isPendente ? (
                            <span 
                              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-2 py-0.5 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                              title="Clique para concluir / alterar status"
                            >
                              <span>Pendente</span>
                              <ChevronDown className="w-3 h-3 text-white/90" />
                            </span>
                          ) : (
                            <span 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-2 py-0.5 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                              title="Concluído / Solucionado"
                            >
                              <span>Concluído</span>
                              <ChevronDown className="w-3 h-3 text-white/90" />
                            </span>
                          )}
                        </td>

                        {/* Col F: Observação/ Resolução */}
                        <td className="border border-gray-300 px-2.5 py-1 text-sm text-gray-700 bg-white">
                          <span className="truncate block max-w-md" title={observacao}>
                            {observacao || "-"}
                          </span>
                        </td>

                        {/* Col G: Ações Rápidas */}
                        <td 
                          className="border border-gray-300 px-2.5 py-1 text-sm bg-white whitespace-nowrap text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(item)}
                              className="px-2.5 py-1 text-xs font-semibold rounded border border-[#FF5022] text-[#FF5022] hover:bg-[#FF5022]/10 transition cursor-pointer"
                              title="Marcar como Lido"
                            >
                              Lido
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLerEConcluir(item)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-[#FF5022] hover:bg-[#E04015] text-white transition cursor-pointer border-none shadow-2xs"
                              title="Finalizar"
                            >
                              Finalizar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Empty Spreadsheet Rows for Authentic Google Sheets Grid Look */}
                  {[...Array(Math.max(4, 10 - filteredAvisos.length))].map((_, emptyIdx) => {
                    const rowNum = filteredAvisos.length + emptyIdx + 2;
                    return (
                      <tr key={`empty-${emptyIdx}`} className="h-7 bg-white">
                        <td className="border border-gray-300 text-center bg-[#F8F9FA] text-xs text-gray-400 font-mono select-none">
                          {rowNum}
                        </td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                        <td className="border border-gray-300 px-2 py-1"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Google Sheets Bottom Tab Bar */}
            <div className="bg-[#E8EAED] border-t border-gray-300 px-3 py-1 flex items-center justify-between text-xs text-gray-600 select-none">
              <div className="flex items-center gap-1">
                <div className="bg-white border-t-2 border-[#FF5022] border-x border-gray-300 px-4 py-1 text-slate-800 font-bold text-xs shadow-2xs rounded-t-sm flex items-center gap-2">
                  <span>AVISOS</span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </div>
              </div>
              <span className="text-[11px] text-gray-500">
                Total: {filteredAvisos.length} linhas preenchidas
              </span>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED DIALOG MODAL */}
      {showDetailModal && selectedAviso && (() => {
        const decor = getPriorityClasses(selectedAviso.prioridade);
        const alreadyRead = hasUserReadNotice(selectedAviso, currentUser.email);
        const customizable = canEditOrDelete(selectedAviso);
        const customStatus = (selectedAviso.status || "Aberto").trim();
        const isIndividual = selectedAviso.destino === "Individual";
        const isDirectedToMe = selectedAviso.destinatarioEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
        const canClosePendency = isIndividual && customizable && customStatus === "Concluído";

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-zoom-in">
              
              {/* Type colored header */}
              <div className={`p-4 border-b border-slate-100 flex items-center justify-between ${
                selectedAviso.tipo === "Particularidade" ? "bg-amber-50/40" :
                selectedAviso.tipo === "Tarefa" ? "bg-sky-50/40" :
                "bg-orange-50/20"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    selectedAviso.tipo === "Particularidade"
                      ? "bg-amber-100 text-amber-800"
                      : selectedAviso.tipo === "Tarefa"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {cleanTaskLabel(selectedAviso.tipo)}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full font-mono ${decor.badge}`}>
                    Prioridade {selectedAviso.prioridade}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    selectedAviso.destino === "Individual"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {selectedAviso.destino === "Individual" ? "🔒 Individual" : "# Coletivo"}
                  </span>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                    {selectedAviso.titulo}
                  </h3>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-slate-450 border-b border-slate-100 pb-3 font-sans font-medium">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      De: <strong className="text-slate-650">{getAuthorDisplayName(selectedAviso)}</strong>
                    </span>
                    <span>|</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Criado em: <strong className="text-slate-650">{formatarDataBR(selectedAviso.dataCriacao)}</strong>
                    </span>
                    {isIndividual && (
                      <>
                        <span>|</span>
                        <span className="flex items-center gap-1">
                          Para: <strong className="text-slate-650">{cleanOperatorLabel(selectedAviso.destinatarioNome)}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* TEXT CONTENT */}
                <div className="bg-slate-50 text-slate-705 p-5 rounded-xl border border-slate-200 leading-relaxed text-xs font-medium font-sans whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedAviso.conteudo}
                </div>

                {/* STEPPER PROGRESS TRACKER (Only for individual pendencies) */}
                {isIndividual && (
                  <div className="bg-slate-500/5 border border-slate-200 rounded-xl p-4.5 space-y-3.5">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#FF5022]" />
                      Ciclo de Acompanhamento da Pendência
                    </h5>

                    {/* Stepper Row UI */}
                    <div className="grid grid-cols-5 items-center relative gap-1.5 pt-2.5 pb-1">
                      {/* Line background */}
                      <div className="absolute left-[8%] right-[8%] h-0.5 bg-slate-200 top-[22%] z-0"></div>

                      {/* Step 1: Abro */}
                      <div className="flex flex-col items-center text-center z-10">
                        <div className="w-7 h-7 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-700 mt-1.5 block">ABRO</span>
                        <span className="text-[8px] font-mono text-slate-400 block break-all">Aberto</span>
                      </div>

                      {/* Step 2: Atribuo */}
                      <div className="flex flex-col items-center text-center z-10">
                        <div className="w-7 h-7 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-700 mt-1.5 block">ATRIBUO</span>
                        <span className="text-[8px] font-mono text-slate-400 block max-w-full truncate" title={cleanOperatorLabel(selectedAviso.destinatarioNome)}>{cleanOperatorLabel(selectedAviso.destinatarioNome).split(" ")[0]}</span>
                      </div>

                      {/* Step 3: Visualiza */}
                      {(() => {
                        const readEmails = selectedAviso.lido && selectedAviso.lido.toLowerCase().trim() !== "não" && selectedAviso.lido.toLowerCase().trim() !== "nao"
                          ? selectedAviso.lido.split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
                          : [];
                        const done = readEmails.includes("sim") || readEmails.includes(selectedAviso.destinatarioEmail?.toLowerCase().trim());
                        return (
                          <div className="flex flex-col items-center text-center z-10">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm transition-all duration-300 ${
                              done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                            }`}>
                              {done ? <Check className="w-3.5 h-3.5" /> : "3"}
                            </div>
                            <span className={`text-[9px] font-bold mt-1.5 block ${done ? "text-slate-700" : "text-slate-400"}`}>VISUALISA</span>
                            <span className="text-[8px] font-mono text-slate-400 block">
                              {done ? "Lido ✓" : "Não Lido"}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Step 4: Conclui */}
                      {(() => {
                        const done = customStatus === "Concluído" || customStatus === "Concluido" || customStatus === "Fechado";
                        return (
                          <div className="flex flex-col items-center text-center z-10">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm transition-all duration-300 ${
                              done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                            }`}>
                              {done ? <Check className="w-3.5 h-3.5" /> : "4"}
                            </div>
                            <span className={`text-[9px] font-bold mt-1.5 block ${done ? "text-slate-700" : "text-slate-400"}`}>CONCLUI</span>
                            <span className="text-[8px] font-mono text-slate-400 block">
                              {done ? "Resolvido ✓" : "Pendente"}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Step 5: Fecho */}
                      {(() => {
                        const done = customStatus === "Fechado";
                        return (
                          <div className="flex flex-col items-center text-center z-10">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm transition-all duration-300 ${
                              done ? "bg-slate-850 text-white" : "bg-slate-200 text-slate-500"
                            }`}>
                              {done ? <Lock className="w-3 h-3 text-white" /> : "5"}
                            </div>
                            <span className={`text-[9px] font-bold mt-1.5 block ${done ? "text-slate-700" : "text-slate-400 relative group"}`}>FECHO</span>
                            <span className="text-[8px] font-mono text-slate-400 block">
                              {done ? "Fechado 🔒" : "Em aberto"}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* SEÇÃO DE COMENTÁRIOS (THREAD) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 font-sans flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#FF5022]" />
                      <span>Comentários ({parseComentarios(selectedAviso.comentarios).length})</span>
                    </h5>
                    <span className="text-[10px] text-slate-400">Histórico de observações</span>
                  </div>

                  {/* Histórico de Comentários */}
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {parseComentarios(selectedAviso.comentarios).length === 0 ? (
                      <div className="text-center py-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                        Nenhum comentário registrado ainda.
                      </div>
                    ) : (
                      parseComentarios(selectedAviso.comentarios).map((comentario, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-md border border-gray-200/70 text-xs shadow-2xs">
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-slate-800 font-semibold">{comentario.autor || "Operador"}</strong>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {formatarDataHoraBR(comentario.data)}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{comentario.texto}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input de Comentário */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <textarea
                      value={novoComentarioTexto}
                      onChange={(e) => setNovoComentarioTexto(e.target.value)}
                      placeholder="Adicionar um comentário..."
                      rows={2}
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#FF5022] focus:border-[#FF5022] bg-white resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (novoComentarioTexto.trim() && !isSubmittingComment) {
                            handleAddComment();
                          }
                        }
                      }}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!novoComentarioTexto.trim() || isSubmittingComment}
                        onClick={handleAddComment}
                        className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold text-xs rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSubmittingComment ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* VISUALIZATION / FOLLOW-UP LISTS Accordion */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShowReadTrackerList(!showReadTrackerList)}
                    className="w-full bg-slate-50 hover:bg-slate-100 px-4.5 py-3 flex items-center justify-between text-xs font-bold text-slate-705 border-none cursor-pointer group"
                  >
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Eye className="w-4 h-4 text-[#FF5022]" />
                      Controle de Visualização e Leitura do Alerta
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-orange-50 text-[#FF5022] px-2 py-0.5 rounded-full border border-orange-200/50 font-mono font-medium">
                        Vistos: {readersInfo.readUsers.length} / Falta ver: {readersInfo.missingUsers.length}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showReadTrackerList ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {showReadTrackerList && (
                    <div className="p-4 bg-white border-t border-slate-150 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-48 overflow-y-auto">
                      {/* Read Users List */}
                      <div className="space-y-1.5">
                        <h6 className="font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1 pb-1 border-b border-emerald-50">
                          <Check className="w-3.5 h-3.5" />
                          Já Visualizaram ({readersInfo.readUsers.length})
                        </h6>
                        {readersInfo.readUsers.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">Nenhum membro viu ainda.</p>
                        ) : (
                          <div className="space-y-1">
                            {readersInfo.readUsers.map(user => (
                              <div key={user.email} className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-2 py-1 rounded">
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-white font-bold">✓</div>
                                <span className="text-slate-700 font-bold max-w-[80%] truncate" title={`${user.nome} (${user.email})`}>
                                  {user.nome}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Missing Users List */}
                      <div className="space-y-1.5">
                        <h6 className="font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1 pb-1 border-b border-amber-50">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Falta Visualizar ({readersInfo.missingUsers.length})
                        </h6>
                        {readersInfo.missingUsers.length === 0 ? (
                          <p className="text-[10px] text-emerald-600 font-black">✓ Todos os membros visualizaram!</p>
                        ) : (
                          <div className="space-y-1">
                            {readersInfo.missingUsers.map(user => (
                              <div key={user.email} className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-2 py-1 rounded">
                                <div className="w-3.5 h-3.5 rounded-full bg-slate-300 flex items-center justify-center text-[8px] text-slate-600 font-bold">!</div>
                                <span className="text-slate-600 font-medium max-w-[80%] truncate" title={`${user.nome} (${user.email})`}>
                                  {user.nome}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* TASK COMPLETION LISTS Accordion (Only for Tarefa) */}
                {selectedAviso.tipo === "Tarefa" && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-3">
                    <button
                      type="button"
                      onClick={() => setShowTaskCompletionTrackerList(!showTaskCompletionTrackerList)}
                      className="w-full bg-slate-50 hover:bg-slate-100 px-4.5 py-3 flex items-center justify-between text-xs font-bold text-slate-705 border-none cursor-pointer group"
                    >
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <CheckCircle className="w-4 h-4 text-sky-750" />
                        Acompanhamento de Finalização da Tarefa (Individual de cada Usuário)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200/50 font-mono font-extrabold">
                          Concluíram: {taskCompletionInfo.completedUsers.length} / Pendente: {taskCompletionInfo.pendingUsers.length}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTaskCompletionTrackerList ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {showTaskCompletionTrackerList && (
                      <div className="p-4 bg-white border-t border-slate-150 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-48 overflow-y-auto">
                        {/* Completed Users List */}
                        <div className="space-y-1.5">
                          <h6 className="font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1 pb-1 border-b border-emerald-50">
                            <Check className="w-3.5 h-3.5" />
                            Já Finalizaram ({taskCompletionInfo.completedUsers.length})
                          </h6>
                          {taskCompletionInfo.completedUsers.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">Ninguém finalizou ainda.</p>
                          ) : (
                            <div className="space-y-1">
                              {taskCompletionInfo.completedUsers.map(user => (
                                <div key={user.email} className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-2 py-1 rounded">
                                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-white font-bold">✓</div>
                                  <span className="text-slate-700 font-bold max-w-[80%] truncate" title={`${user.nome} (${user.email})`}>
                                    {user.nome}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Pending Users List */}
                        <div className="space-y-1.5">
                          <h6 className="font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1 pb-1 border-b border-amber-50">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Pendente de Finalizar ({taskCompletionInfo.pendingUsers.length})
                          </h6>
                          {taskCompletionInfo.pendingUsers.length === 0 ? (
                            <p className="text-[10px] text-emerald-600 font-black">✓ Todos os usuários já concluíram!</p>
                          ) : (
                            <div className="space-y-1">
                              {taskCompletionInfo.pendingUsers.map(user => (
                                <div key={user.email} className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-2 py-1 rounded">
                                  <div className="w-3.5 h-3.5 rounded-full bg-slate-300 flex items-center justify-center text-[8px] text-slate-600 font-bold">!</div>
                                  <span className="text-slate-600 font-medium max-w-[80%] truncate" title={`${user.nome} (${user.email})`}>
                                    {user.nome}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer holding action triggers */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                
                {/* ACTION CONTEXT INTERACTION: Dropdown de Ações Unificado */}
                <div className="flex items-center">
                  <ModalAcoesDropdown
                    item={selectedAviso}
                    userStage={getAvisoUserStage(selectedAviso, currentUser)}
                    onMarkAsRead={handleMarkAsRead}
                    onFinalizarPendencia={handleMarkAsResolved}
                    onLerEConcluir={handleLerEConcluir}
                    onReverterConclusao={handleReverterConclusao}
                    canClosePendency={canClosePendency}
                    onClosePendency={handleClosePendency}
                  />
                </div>

                {/* FOOTER ACTIONS EDIT/DELETE */}
                <div className="flex items-center gap-2 ml-auto">
                  {customizable ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDetailModal(false);
                          openEdit(selectedAviso);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded-lg text-xs font-bold text-slate-600 hover:text-[#FF5022] transition cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmId(selectedAviso.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 hover:bg-rose-50 border border-slate-205 hover:border-rose-220 rounded-lg text-[11px] font-bold text-slate-600 hover:text-rose-650 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded font-medium flex items-center gap-1 select-none">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Somente Leitura
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONFIRM DELETE OVERLAY MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-zoom-in text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="w-6 h-6 stroke-2" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 font-sans">Excluir este Registro?</h4>
              <p className="text-xs text-slate-500 font-sans leading-normal">
                Você está prestes a excluir este aviso/particularidade permanentemente do banco de dados. Esta ação não poderá ser desfeita.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                  setShowDetailModal(false);
                }}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                Excluir Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD VISUAL MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-zoom-in">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-orange-50/20">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
                <PlusCircle className="w-5 h-5 text-[#FF5022]" />
                Criar Registro de Informação / Alerta / Pendência
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">TÍTULO DO REGISTRO</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manutenção Preventiva - Posição Mossoró/Natal"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition leading-normal font-sans text-slate-800"
                />
              </div>

              {/* Grid: Type and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">TIPO DE REGISTRO</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-800"
                  >
                    <option value="Aviso">Pendências / Avisos</option>
                    <option value="Particularidade">Particularidade de Rede</option>
                    <option value="Tarefa">{cleanTaskLabel("Tarefa (Acompanhamento Individual)")}</option>
                  </select>
                  {instructorMode && (
                    <div className="mt-1.5 p-2 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-xl text-[10px] font-medium leading-relaxed">
                      {formTipo === "Aviso" && "📌 Aviso: Informativo de equipe. Os membros confirmam apenas visualização ('Visto')."}
                      {formTipo === "Particularidade" && "⚡ Particularidade: Pendência de infraestrutura. Qualquer operador técnico resolve globalmente."}
                      {formTipo === "Tarefa" && "🎯 Tarefa: Atribuição de trabalho. Cada membro designado deve clicar em finalizar por si próprio."}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">GRAU DE PRIORIDADE</label>
                  <select
                    value={formPrioridade}
                    onChange={(e) => setFormPrioridade(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-800"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                  {instructorMode && (
                    <div className="mt-1.5 p-2 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-xl text-[10px] font-medium leading-relaxed">
                      {formPrioridade === "Crítica" && "🚨 Crítica: Urgência máxima! Gera alerta piscante vermelho e exige providências imediatas."}
                      {formPrioridade === "Alta" && "⚠️ Alta: Incidente relevante. Priorize a leitura e execução o quanto antes."}
                      {formPrioridade === "Média" && "📋 Média: Pendências habituais e operacionais comuns do dia a dia."}
                      {formPrioridade === "Baixa" && "ℹ️ Baixa: Rotinas leves e lembretes não críticos para a operação."}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid Destinatário scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">DESTINATÁRIOS (ESCOPO)</label>
                  <select
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-800"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Individual">Individual</option>
                  </select>
                  {instructorMode && (
                    <div className="mt-1.5 p-2 bg-emerald-50 text-emerald-900 border border-emerald-150 rounded-xl text-[10px] font-medium leading-relaxed">
                      {formDestino === "Todos" && "👥 Todos: Todos os operadores da central receberão a notificação e poderão ver o registro."}
                      {formDestino === "Individual" && "🔒 Individual: Envia apenas para o operador selecionado ao lado. Somente ele verá o registro."}
                    </div>
                  )}
                </div>

                {formDestino === "Individual" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">ATRIBUIR PARA OPERADOR</label>
                    <select
                      value={selectedUserEmail}
                      onChange={(e) => setSelectedUserEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-805"
                    >
                      {activeMembersOnly.map(user => {
                        const rawName = `${user.nome || "Membro"} ${user.sobrenome || ""}`.trim();
                        const displayName = cleanOperatorLabel(rawName) || user.email.split('@')[0];
                        return (
                          <option key={user.id} value={user.email}>
                            {displayName}
                          </option>
                        );
                      })}
                      {activeMembersOnly.length === 0 && (
                        <option value="">Sem usuários cadastrados</option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Content text fields */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">CONTEÚDO DO AVISO / REQUISITOS DA PENDÊNCIA</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Escreva detalhadamente o aviso, canais afetados ou instruções de emergência..."
                  value={formConteudo}
                  onChange={(e) => setFormConteudo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition leading-relaxed font-sans text-slate-800"
                ></textarea>
              </div>

              {/* Actions submit block */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl hover:border-slate-300 transition text-xs font-bold text-slate-500 font-sans cursor-pointer text-center disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={cn(
                    "flex-1 px-4 py-2.5 bg-[#FF5022] hover:bg-orange-600 text-white rounded-xl shadow-sm transition text-xs font-bold font-sans cursor-pointer text-center border-none",
                    isSaving && "opacity-55 cursor-not-allowed"
                  )}
                >
                  {isSaving ? "Publicando..." : "Publicar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VISUAL MODAL */}
      {showEditModal && selectedAviso && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-zoom-in">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-orange-50/20">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
                <Edit className="w-5 h-5 text-[#FF5022]" />
                Editar Registro de Informação #{selectedAviso.id}
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedAviso(null);
                }}
                className="p-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-455 hover:text-slate-655 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">TÍTULO DO REGISTRO</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manutenção Preventiva - Posição Mossoró"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition leading-normal font-sans text-slate-800"
                />
              </div>

              {/* Grid: Type and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">TIPO DE REGISTRO</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-800"
                  >
                    <option value="Aviso">Pendências / Avisos</option>
                    <option value="Particularidade">Particularidade de Rede</option>
                    <option value="Tarefa">{cleanTaskLabel("Tarefa (Acompanhamento Individual)")}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">GRAU DE PRIORIDADE</label>
                  <select
                    value={formPrioridade}
                    onChange={(e) => setFormPrioridade(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-800"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>
              </div>

              {/* Grid Destinatário scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">DESTINATÁRIOS (ESCOPO)</label>
                  <select
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-800"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>

                {formDestino === "Individual" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">ATRIBUIR PARA OPERADOR</label>
                    <select
                      value={selectedUserEmail}
                      onChange={(e) => setSelectedUserEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition cursor-pointer font-sans text-slate-805"
                    >
                      {activeMembersOnly.map(user => {
                        const rawName = `${user.nome || "Membro"} ${user.sobrenome || ""}`.trim();
                        const displayName = cleanOperatorLabel(rawName) || user.email.split('@')[0];
                        return (
                          <option key={user.id} value={user.email}>
                            {displayName}
                          </option>
                        );
                      })}
                      {activeMembersOnly.length === 0 && (
                        <option value="">Sem usuários cadastrados</option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Content markup fields */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider font-mono">CONTEÚDO DO AVISO / REQUISITOS DA PENDÊNCIA</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Escreva detalhadamente o aviso..."
                  value={formConteudo}
                  onChange={(e) => setFormConteudo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#FF5022] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition leading-relaxed font-sans text-slate-800"
                ></textarea>
              </div>

              {/* Actions edit submit block */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedAviso(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl hover:border-slate-300 transition text-xs font-bold text-slate-500 font-sans cursor-pointer text-center disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={cn(
                    "flex-1 px-4 py-2.5 bg-[#FF5022] hover:bg-orange-600 text-white rounded-xl shadow-sm transition text-xs font-bold font-sans cursor-pointer text-center border-none",
                    isSaving && "opacity-55 cursor-not-allowed"
                  )}
                >
                  {isSaving ? "Salvando..." : "Salvar Mudanças"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINALIZE/CLOSE WITH COMMENT MODAL */}
      {showFinalizeCommentModal && pendingFinalizeAviso && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in" id="finalize-comment-modal">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-zoom-in">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/10">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                {finalizeActionType === "resolve" ? "Finalizar Particularidade" : "Fechar Pendência (Concluir Fluxo)"}
              </h3>
              <button
                onClick={() => {
                  setShowFinalizeCommentModal(false);
                  setPendingFinalizeAviso(null);
                  setFinalizeComment("");
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 font-sans text-left">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Item Selecionado:</span>
                <p className="text-sm font-bold text-slate-800 mt-1">{pendingFinalizeAviso.titulo}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{pendingFinalizeAviso.conteudo}</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 font-sans">
                  Adicione um comentário (Opções de resolução/observação):
                </label>
                <textarea
                  value={finalizeComment}
                  onChange={(e) => setFinalizeComment(e.target.value)}
                  placeholder="Ex: Particularidade devidamente sanada. Fibra normalizada e verificado tráfego estabilizado."
                  className="w-full min-h-[100px] text-xs p-3 bg-slate-50 border border-slate-200 focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022]/20 rounded-xl transition font-sans placeholder-slate-400 outline-none resize-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowFinalizeCommentModal(false);
                  setPendingFinalizeAviso(null);
                  setFinalizeComment("");
                }}
                className="px-4 py-2 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-300 bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (finalizeActionType === "resolve") {
                    executeMarkAsResolved(pendingFinalizeAviso, finalizeComment);
                  } else if (finalizeActionType === "close") {
                    executeClosePendency(pendingFinalizeAviso, finalizeComment);
                  }
                  setShowFinalizeCommentModal(false);
                  setPendingFinalizeAviso(null);
                  setFinalizeComment("");
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition cursor-pointer border-none"
              >
                Confirmar e Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOUR STEP NAVIGATION CARD */}
      {instructorMode && tourType && tourStep !== null && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 p-5 z-[200] animate-zoom-in font-sans">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-1.5">
              <span className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg">
                <GraduationCap className="w-4 h-4 animate-bounce" />
              </span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                {tourType === "general" && "Guia de Reconhecimento"}
                {tourType === "create" && "Simulador de Cadastro"}
                {tourType === "action" && "Simulador de Resolução"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
              Passo {tourStep + 1} de {
                tourType === "general" ? generalTourSteps.length :
                tourType === "create" ? createTourSteps.length :
                actionTourSteps.length
              }
            </span>
          </div>

          <div className="py-4 space-y-2">
            <h4 className="text-sm font-bold text-slate-50 leading-snug">
              {tourType === "general" ? generalTourSteps[tourStep].title :
               tourType === "create" ? createTourSteps[tourStep].title :
               actionTourSteps[tourStep].title}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {tourType === "general" ? generalTourSteps[tourStep].content :
               tourType === "create" ? createTourSteps[tourStep].content :
               actionTourSteps[tourStep].content}
            </p>

            {/* Simulated Action Assistance Buttons */}
            {tourType === "create" && tourStep === 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(true);
                  setTourStep(1);
                }}
                className="mt-2 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 border-none shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Simular Clique: Abrir Cadastro
              </button>
            )}

            {tourType === "create" && tourStep === 1 && (
              <div className="mt-2.5 p-2.5 bg-slate-800/60 rounded-xl space-y-1.5 border border-slate-700/50">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Dica de Prática:</span>
                <p className="text-[10px] text-slate-300 leading-normal">
                  Mude os campos na janela aberta para ler as explicações em tempo real de cada tipo e prioridade de registro!
                </p>
              </div>
            )}

            {tourType === "create" && tourStep === 2 && (
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setTourStep(3);
                }}
                className="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 border border-slate-700"
              >
                Simular Cancelamento / Conclusão
              </button>
            )}

            {tourType === "action" && tourStep === 0 && (
              <div className="mt-2.5 p-2.5 bg-slate-800/60 rounded-xl space-y-1.5 border border-slate-700/50 text-[10px] text-slate-300">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Dica de Fluxo:</span>
                Utilizamos o Modo Kanban para este guia. Qualquer registro se move da esquerda (não lido) para a direita conforme progredimos.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3.5 mt-1">
            <button
              type="button"
              onClick={() => {
                setTourStep(null);
                setTourType(null);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 font-bold transition cursor-pointer"
            >
              Sair
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={tourStep === 0}
                onClick={() => setTourStep(prev => prev !== null ? prev - 1 : null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300 transition cursor-pointer disabled:cursor-not-allowed border-none"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const maxSteps = 
                    tourType === "general" ? generalTourSteps.length :
                    tourType === "create" ? createTourSteps.length :
                    actionTourSteps.length;
                  
                  if (tourStep === maxSteps - 1) {
                    setTourStep(null);
                    setTourType(null);
                  } else {
                    // Specific automated step triggers
                    if (tourType === "create" && tourStep === 0) {
                      setShowAddModal(true);
                    }
                    setTourStep(prev => prev !== null ? prev + 1 : null);
                  }
                }}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 border-none shadow-sm"
              >
                {tourStep === (
                  tourType === "general" ? generalTourSteps.length - 1 :
                  tourType === "create" ? createTourSteps.length - 1 :
                  actionTourSteps.length - 1
                ) ? "Concluir" : "Próximo"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELP CENTER & CONCEPTS DICTIONARY MODAL */}
      {showInstructorCentral && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[250] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-zoom-in font-sans">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/20">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight font-sans">
                    Central do Instrutor • Painel de Avisos
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Aprenda e simule as ações e conceitos fundamentais do sistema.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructorCentral(false)}
                className="p-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-slate-100 bg-slate-50 px-6 gap-2">
              <button
                type="button"
                onClick={() => setActiveSimulationTab("tours")}
                className={cn(
                  "px-4 py-3 text-xs font-bold font-sans transition-all border-b-2 cursor-pointer flex items-center gap-1.5",
                  activeSimulationTab === "tours" 
                    ? "border-emerald-500 text-emerald-700" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <Play className="w-3.5 h-3.5" />
                Guias e Simuladores Práticos
              </button>
              <button
                type="button"
                onClick={() => setActiveSimulationTab("concepts")}
                className={cn(
                  "px-4 py-3 text-xs font-bold font-sans transition-all border-b-2 cursor-pointer flex items-center gap-1.5",
                  activeSimulationTab === "concepts" 
                    ? "border-emerald-500 text-emerald-700" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Dicionário de Conceitos
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto text-xs text-slate-700 space-y-5">
              {activeSimulationTab === "tours" ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-sans leading-relaxed">
                    Selecione um simulador ou guia interativo abaixo para ativar as marcações visuais na tela e obter explicações passo a passo:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                    {/* General Tour Card */}
                    <div className="border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/10 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 transition-all shadow-xs">
                      <div className="space-y-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          1
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 font-sans">Tour Geral do Painel</h4>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Reconheça a estrutura da página, os segmentadores, filtros de email e alternância de visualização.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTourType("general");
                          setTourStep(0);
                          setShowInstructorCentral(false);
                          setInstructorMode(true);
                        }}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[11px] rounded-xl transition cursor-pointer border-none shadow-xs text-center"
                      >
                        Iniciar Tour
                      </button>
                    </div>

                    {/* Create Tour Card */}
                    <div className="border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/10 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 transition-all shadow-xs">
                      <div className="space-y-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          2
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 font-sans">Criar e Catalogar</h4>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Aprenda a cadastrar avisos técnicos, particularidades de rede ou tarefas individuais passo a passo.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTourType("create");
                          setTourStep(0);
                          setShowInstructorCentral(false);
                          setInstructorMode(true);
                        }}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[11px] rounded-xl transition cursor-pointer border-none shadow-xs text-center"
                      >
                        Iniciar Simulador
                      </button>
                    </div>

                    {/* Action Tour Card */}
                    <div className="border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/10 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 transition-all shadow-xs">
                      <div className="space-y-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          3
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 font-sans">Ações e Resoluções</h4>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Entenda o ciclo de ler, marcar visto, registrar resoluções e fechar fluxos como operador ou autor.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTourType("action");
                          setTourStep(0);
                          setShowInstructorCentral(false);
                          setInstructorMode(true);
                          setViewMode("kanban"); // Forces Kanban for action tour
                        }}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[11px] rounded-xl transition cursor-pointer border-none shadow-xs text-center"
                      >
                        Iniciar Simulador
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-sans leading-relaxed">
                    Entenda as particularidades de cada tipo de registro do sistema para evitar confusões de operação:
                  </p>

                  <div className="space-y-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        📌 O que é um "Aviso"?
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-3.5">
                        Informativos gerais ou pendências leves de equipe. Exemplo: "Troca de turno antecipada" ou "Procedimento de almoço". 
                        Os membros interagem clicando em **"Visto"** para confirmar leitura, mudando o status pessoal de Pendente para Lido.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        ⚡ O que é uma "Particularidade de Rede"?
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-3.5">
                        Incidentes técnicos de infraestrutura que afetam toda a rede. Exemplo: "Fibra rompida entre Natal e Mossoró". 
                        Qualquer operador técnico que restabeleça a fibra pode **finalizar** a particularidade com comentários técnicos. 
                        Ao finalizá-la, ela é resolvida para **todos** na central simultaneamente.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        🎯 O que é uma "Tarefa"?
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-3.5">
                        Diferente das particularidades, uma tarefa é um acompanhamento individualizado. Exemplo: "Limpeza da bancada", "Checklist do gerador". 
                        Se enviada para todos, **cada usuário da central deve finalizar a sua própria tarefa** individualmente. 
                        O status de visto e finalizado permanece isolado por operador até que ele conclua suas próprias ações.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                        <span className="w-2 h-2 rounded-full bg-[#FF5022]"></span>
                        🔄 Visualizar vs. Finalizar vs. Fechar
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-3.5">
                        - **Visualizar (Confirmar Leitura):** Move o item para a aba/coluna "Lidas". <br />
                        - **Finalizar / Resolver:** Declara que a pendência técnica ou tarefa foi cumprida. O item vai para a coluna "Concluídas". <br />
                        - **Fechar Fluxo:** Exclusivo do criador do registro. Permite dar o veredito final e arquivar a pendência com segurança.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4.5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowInstructorCentral(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-sans transition cursor-pointer border-none"
              >
                Entendido, fechar Central
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
