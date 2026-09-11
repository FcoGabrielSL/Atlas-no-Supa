export interface EntroncamentoRow {
  "TRECHO A": string;
  "TRECHO B": string;
  "TRECHO C": string;
  "TRECHO D ": string;
  LOCALIZAÇÃO: string;
  TIPO: string;
  "PROVEDOR ": string;
  AÇÕES: string;
  STATUS: string;
  "RESPONSÁVEL ": string;
  PRAZO: string;
  "DATA BACKUP": string;
  OBSERVAÇÕES: string;
  DESCRIÇÃO?: string;
  DATA?: string;
  "DATA DE CONCLUSÃO"?: string;
  id: string;
  operId?: string;
  ID?: string;
  responsavel?: string;
  responsaveis?: any[];
  historico?: any[];
  isLocal?: boolean;
}

export interface CamadaOpticaRow {
  TRECHO: string;
  STATUS: string;
  INFORMAÇÃO: string;
  HISTORICO: string;
  "RESPONSÁVEL "?: string;
  PRAZO?: string;
  "DATA BACKUP"?: string;
  DATA?: string;
  OBSERVAÇÕES?: string;
  "Cronograma de Cobranças"?: string;
  LOCALIZAÇÃO?: string;
  "DATA DE CONCLUSÃO"?: string;
  id: string;
  isLocal?: boolean;
}

export interface OtdrRow {
  TRECHO: string;
  "ONDE TEM"?: string;
  "ONDE PRECISA"?: string;
  "TAMANHO KM"?: string;
  STATUS: string;
  "OBSERVAÇÃO "?: string;
  OBSERVAÇÃO?: string;
  Planejamento?: string;
  "Data de abertura"?: string;
  "data estimada"?: string;
  "data de conclusão"?: string;
  id: string;
  isLocal?: boolean;
}

export interface AtenuacoesRow {
  id: string;
  Status: string;
  "Tipo de chamados": string;
  "Id Imoc": string;
  Sla: string;
  Complexidade?: string;
  "Data de abertura": string;
  "Data de conclusão": string;
  Rede: string;
  Trecho: string;
  Percas: string | number;
  Detalhamento: string;
  Pioras: string;
  isLocal?: boolean;
}

export interface TestesCampoRow {
  id: string;
  "ID"?: string;
  "ABERTURA"?: string;
  "TRECHOS PARA REALIZAR TESTES"?: string;
  "LOCALIDADE"?: string;
  "CONCLUÍDO"?: string;
  "SLA"?: string;
  "DATA PREVISTA"?: string;
  "OBSERVAÇÃO"?: string;

  // Backwards compatibility keys
  "LOCAL/TRECHO"?: string;
  STATUS?: string; 
  "TIPO DE TESTE"?: string;
  TÉCNICO?: string;
  "DATA DO TESTE"?: string;
  OBSERVAÇÕES?: string;
  
  isLocal?: boolean;
}

export interface BypassRow {
  id: string;
  "DISPOSITIVO/TRECHO": string;
  "TRECHOS"?: string;
  "PONTO (KM)"?: string;
  "OBSERVAÇÃO"?: string;
  "LOCAL INICIAL"?: string;
  "TRECHOS ROTA DESVIO"?: string;
  STATUS: string; // "Ativo" | "Desativado"
  "MOTIVO BYPASS": string;
  "RESPONSÁVEL ": string;
  "DATA INICIO": string;
  "PREVISÃO NORMALIZAÇÃO": string;
  isLocal?: boolean;
}

export interface RelatorioMensalRow {
  id: string;
  MÊS: string;
  "TOTAL INCIDENTES": string;
  "SLA MENSAL": string;
  "GANHOS ACUMULADOS": string;
  "DESTAQUES TÉCNICOS": string;
  "PRINCIPAIS EVENTOS": string;
  isLocal?: boolean;
}

export interface AtuacoesRow {
  id: string;
  Trecho: string;
  "Tipo de Atuação": string;
  Técnico: string;
  Status: string;
  Data: string;
  Detalhes: string;
  "Coordenadas Recebidas"?: string;
  isLocal?: boolean;
}

export interface Atuacao {
  idImoc: string;
  idDwdm: string;
  rede: string;
  trecho: string;
  tipoChamado: string;
  empresas: string;
  motivo: string;
  status: string;
  totalGanhos: number;
  dataAbertura: string;
  data?: string;
  recebeuCoordenadas?: boolean;
}

export interface Atenuacao {
  idImoc: string;
  status: string;
  tipoChamado: string;
  sla: string;
  complexidade?: string;
  dataAbertura: string;
  dataConclusao?: string;
  rede: string;
  trecho: string;
  perdas: string | number;
  detalhamento: string;
  pioras: string;
}

export interface Bypass {
  id: string;
  trechos: string;
  localInicial: string;
  pontoKm: string;
  motivo: string;
  status: string;
  previsaoNormalizacao?: string;
  responsavel?: string;
  observacao?: string;
  direcao?: string;
}

export interface SimuladorItem {
  id?: string;
  trechoSimulador: string;
  valorPorCanal: number | string;
}

export interface UserPermissions {
  visualizar: boolean;
  editar: boolean;
  excluir: boolean;
}

export interface UserConfig {
  id: string;
  auth_id?: string;
  nome: string;
  sobrenome: string;
  email: string;
  dataNascimento: string;
  senha?: string;
  dataInsercao: string;
  nivel?: string;
  role?: string;
  permissions: {
    [key: string]: UserPermissions;
  };
}

export const DEFAULT_CARGO_PERMISSIONS: Record<string, Record<string, UserPermissions>> = {
  Administrador: {
    entroncamentos: { visualizar: true, editar: true, excluir: true },
    camada_optica: { visualizar: true, editar: true, excluir: true },
    otdr: { visualizar: true, editar: true, excluir: true },
    atenuacoes: { visualizar: true, editar: true, excluir: true },
    testes_campo: { visualizar: true, editar: true, excluir: true },
    bypass: { visualizar: true, editar: true, excluir: true },
    relatorio_mensal: { visualizar: true, editar: true, excluir: true },
    atuacoes_geral: { visualizar: true, editar: true, excluir: true },
    troca_cabo: { visualizar: true, editar: true, excluir: true },
    controle_incidentes: { visualizar: true, editar: true, excluir: true },
    avisos: { visualizar: true, editar: true, excluir: true },
    relatorio_periodico: { visualizar: true, editar: true, excluir: true },
    settings: { visualizar: true, editar: true, excluir: true },
    admin: { visualizar: true, editar: true, excluir: true }
  },
  Coordenador: {
    entroncamentos: { visualizar: true, editar: true, excluir: false },
    camada_optica: { visualizar: true, editar: true, excluir: false },
    otdr: { visualizar: true, editar: true, excluir: false },
    atenuacoes: { visualizar: true, editar: true, excluir: false },
    testes_campo: { visualizar: true, editar: true, excluir: false },
    bypass: { visualizar: true, editar: true, excluir: false },
    relatorio_mensal: { visualizar: true, editar: true, excluir: false },
    atuacoes_geral: { visualizar: true, editar: true, excluir: false },
    troca_cabo: { visualizar: true, editar: true, excluir: false },
    controle_incidentes: { visualizar: true, editar: true, excluir: false },
    avisos: { visualizar: true, editar: true, excluir: false },
    relatorio_periodico: { visualizar: true, editar: true, excluir: false },
    settings: { visualizar: false, editar: false, excluir: false },
    admin: { visualizar: false, editar: false, excluir: false }
  },
  Analista: {
    entroncamentos: { visualizar: true, editar: false, excluir: false },
    camada_optica: { visualizar: true, editar: false, excluir: false },
    otdr: { visualizar: true, editar: false, excluir: false },
    atenuacoes: { visualizar: true, editar: true, excluir: false },
    testes_campo: { visualizar: true, editar: true, excluir: false },
    bypass: { visualizar: true, editar: true, excluir: false },
    relatorio_mensal: { visualizar: false, editar: false, excluir: false },
    atuacoes_geral: { visualizar: true, editar: true, excluir: false },
    troca_cabo: { visualizar: true, editar: false, excluir: false },
    controle_incidentes: { visualizar: true, editar: true, excluir: false },
    avisos: { visualizar: true, editar: true, excluir: false },
    relatorio_periodico: { visualizar: false, editar: false, excluir: false },
    settings: { visualizar: false, editar: false, excluir: false },
    admin: { visualizar: false, editar: false, excluir: false }
  },
  Assistente: {
    entroncamentos: { visualizar: true, editar: false, excluir: false },
    camada_optica: { visualizar: true, editar: false, excluir: false },
    otdr: { visualizar: true, editar: false, excluir: false },
    atenuacoes: { visualizar: true, editar: true, excluir: false },
    testes_campo: { visualizar: true, editar: true, excluir: false },
    bypass: { visualizar: true, editar: false, excluir: false },
    relatorio_mensal: { visualizar: false, editar: false, excluir: false },
    atuacoes_geral: { visualizar: true, editar: false, excluir: false },
    troca_cabo: { visualizar: false, editar: false, excluir: false },
    controle_incidentes: { visualizar: true, editar: false, excluir: false },
    avisos: { visualizar: true, editar: false, excluir: false },
    relatorio_periodico: { visualizar: false, editar: false, excluir: false },
    settings: { visualizar: false, editar: false, excluir: false },
    admin: { visualizar: false, editar: false, excluir: false }
  },
  Visitante: {
    entroncamentos: { visualizar: false, editar: false, excluir: false },
    camada_optica: { visualizar: false, editar: false, excluir: false },
    otdr: { visualizar: false, editar: false, excluir: false },
    atenuacoes: { visualizar: false, editar: false, excluir: false },
    testes_campo: { visualizar: false, editar: false, excluir: false },
    bypass: { visualizar: false, editar: false, excluir: false },
    relatorio_mensal: { visualizar: false, editar: false, excluir: false },
    atuacoes_geral: { visualizar: false, editar: false, excluir: false },
    troca_cabo: { visualizar: false, editar: false, excluir: false },
    controle_incidentes: { visualizar: false, editar: false, excluir: false },
    avisos: { visualizar: true, editar: false, excluir: false },
    relatorio_periodico: { visualizar: false, editar: false, excluir: false },
    settings: { visualizar: false, editar: false, excluir: false },
    admin: { visualizar: false, editar: false, excluir: false }
  }
};

export const defaultPermissions = DEFAULT_CARGO_PERMISSIONS;

export interface DashboardData {
  atenuacoes: Atenuacao[];
  atuacoes: Atuacao[];
}

export interface TrocaCaboRow {
  id: string; // react / internally mapped to "ID" or similar unique key
  STATUS: string;
  ID: string;
  DATA: string;
  "TRECHO ": string;
  Descricao: string;
  "Site A": string;
  "Abordagem A": string;
  "Qt de Caixas A ": string;
  "Site B": string;
  "Abordagem B": string;
  "Qt de Caixas B": string;
  conclusao: string;
  "data conclusao": string;
  isLocal?: boolean;
}
