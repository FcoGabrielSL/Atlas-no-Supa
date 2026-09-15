import { supabase } from "../supabaseClient";
import { 
  EntroncamentoRow, 
  CamadaOpticaRow, 
  OtdrRow, 
  AtenuacoesRow, 
  TestesCampoRow, 
  BypassRow, 
  TrocaCaboRow, 
  AtuacoesRow, 
  RelatorioMensalRow, 
  UserConfig 
} from "../types";
import { Aviso, ComentarioAviso, parseComentarios } from "../components/PainelAvisos";

// ==============================================================================
// 1. HELPERS DE MAPERAMENTO ENTRE TABELAS POSTGRES E INTERFACES REACT
// Garante 100% de integridade e compatibilidade com a UI existente (Pixel-Perfect)
// ==============================================================================

export function mapEntroncamentoFromDB(row: any, index?: number): EntroncamentoRow {
  const rawId = String(row.id_entroncamento || row.id || row.oper_id || row.operId || "").trim();
  const tA = String(row.trecho_a || row["TRECHO A"] || "").trim();
  const tB = String(row.trecho_b || row["TRECHO B"] || "").trim();
  const fallbackSignature = `ent-${tA ? tA.replace(/\s+/g, "_") : "row"}-${index !== undefined ? index : Math.random().toString(36).substr(2, 7)}`;
  const finalId = rawId || fallbackSignature;
  const operId = String(row.oper_id || row.operId || rawId || (index !== undefined ? `ENT-${String(index + 1).padStart(3, "0")}` : "ENT-001")).trim();

  const respNome =
    row.responsaveis?.[0]?.user?.nome ||
    row.responsaveis?.[0]?.responsavel?.nome ||
    row.responsavel ||
    row["RESPONSÁVEL "] ||
    "";

  const mappedHistorico = Array.isArray(row.historico)
    ? row.historico.map((h: any) => ({
        id: h.id_historico || h.id,
        id_historico: h.id_historico || h.id,
        id_entroncamento: h.id_entroncamento,
        descricao: h.descricao || h.conteudo || "",
        created_at: h.created_at || h.data_ocorrencia || "",
        data_ocorrencia: h.data_ocorrencia,
        tipo_registro: h.tipo_registro,
        id_autor: h.id_autor,
        nome_autor: h.nome_autor || h.autor?.nome || (h.id_autor ? `Usuário #${h.id_autor}` : "Usuário"),
        autor: h.autor
      }))
    : [];

  return {
    id: finalId,
    ID: finalId,
    operId: operId,
    "TRECHO A": tA,
    "TRECHO B": tB,
    "TRECHO C": row.trecho_c || row["TRECHO C"] || "",
    "TRECHO D ": row.trecho_d || row["TRECHO D "] || "",
    LOCALIZAÇÃO: row.localizacao || row.LOCALIZAÇÃO || "",
    TIPO: row.tipo || row.TIPO || "CAIXA",
    "PROVEDOR ": row.provedor || row["PROVEDOR "] || "",
    AÇÕES: row.acoes || row.AÇÕES || row.descricao_objetivo || "",
    STATUS: row.status || row.STATUS || "Pendente",
    "RESPONSÁVEL ": respNome || (row.id_responsavel_principal ? String(row.id_responsavel_principal) : ""),
    PRAZO: row.prazo || row.PRAZO || "",
    "DATA BACKUP": row.data_backup || row["DATA BACKUP"] || "",
    OBSERVAÇÕES: row.observacoes || row.OBSERVAÇÕES || row.acoes || row.descricao_objetivo || "",
    DESCRIÇÃO: row.descricao || row.DESCRIÇÃO || row.descricao_objetivo || "",
    DATA: row.data || row.DATA || row.data_solicitacao || "",
    "DATA DE CONCLUSÃO": row.data_conclusao || row["DATA DE CONCLUSÃO"] || "",
    responsaveis: row.responsaveis || [],
    historico: mappedHistorico
  } as any;
}

export function mapEntroncamentoToDB(item: Partial<EntroncamentoRow>) {
  const idVal = String(item.id || item.operId || (item as any)?.ID || "").trim();
  return {
    id_entroncamento: idVal,
    trecho_a: item["TRECHO A"] || "",
    trecho_b: item["TRECHO B"] || "",
    trecho_c: item["TRECHO C"] || null,
    trecho_d: item["TRECHO D "] || null,
    localizacao: item.LOCALIZAÇÃO || null,
    tipo: item.TIPO || "CAIXA",
    provedor: item["PROVEDOR "] || null,
    descricao_objetivo: item.DESCRIÇÃO || item.OBSERVAÇÕES || item.AÇÕES || "",
    status: item.STATUS || "Pendente",
    prazo: item.PRAZO || null,
    data_backup: item["DATA BACKUP"] || null,
    data_conclusao: item["DATA DE CONCLUSÃO"] || null,
    data_solicitacao: item.DATA || null
  };
}

export function mapCamadaOpticaFromDB(row: any, index?: number): CamadaOpticaRow {
  const rawId = String(row.id_camada || row.id || row.ID || "").trim();
  const trechoStr = String(row.trecho || row.TRECHO || "").trim();
  const fallbackSignature = `co-${trechoStr ? trechoStr.replace(/\s+/g, "_") : "row"}-${index !== undefined ? index : Math.random().toString(36).substr(2, 7)}`;
  const finalId = rawId || fallbackSignature;

  return {
    id: finalId,
    TRECHO: trechoStr,
    STATUS: row.status || row.STATUS || "Pendente",
    INFORMAÇÃO: row.informacao || row.INFORMAÇÃO || "",
    HISTORICO: row.historico_texto || row.historico || row.HISTORICO || "",
    "RESPONSÁVEL ": row.responsavel || row["RESPONSÁVEL "] || "",
    PRAZO: row.prazo || row.PRAZO || "",
    "DATA BACKUP": row.data_backup || row["DATA BACKUP"] || "",
    DATA: row.data || row.DATA || "",
    OBSERVAÇÕES: row.observacoes || row.OBSERVAÇÕES || "",
    "Cronograma de Cobranças": row.cronograma_cobrancas || row["Cronograma de Cobranças"] || row.observacoes || "",
    LOCALIZAÇÃO: row.localizacao || row.LOCALIZAÇÃO || "",
    "DATA DE CONCLUSÃO": row.data_conclusao || row["DATA DE CONCLUSÃO"] || "",
    ...(Array.isArray(row.historico) ? { historico_items: row.historico } : {})
  } as any;
}

export function mapCamadaOpticaToDB(item: Partial<CamadaOpticaRow>) {
  return {
    id: String(item.id || ""),
    trecho: item.TRECHO || "",
    status: item.STATUS || "Pendente",
    informacao: item.INFORMAÇÃO || "",
    historico: typeof item.HISTORICO === "string" ? item.HISTORICO : "",
    responsavel: item["RESPONSÁVEL "] || "",
    prazo: item.PRAZO || "",
    data_backup: item["DATA BACKUP"] || "",
    data: item.DATA || "",
    observacoes: item.OBSERVAÇÕES || "",
    cronograma_cobrancas: item["Cronograma de Cobranças"] || item.OBSERVAÇÕES || "",
    localizacao: item.LOCALIZAÇÃO || "",
    data_conclusao: item["DATA DE CONCLUSÃO"] || "",
    updated_at: new Date().toISOString()
  };
}

export function mapAvisoFromDB(row: any, index?: number): Aviso {
  let comentarios: ComentarioAviso[] = [];
  const rawComentarios = (Array.isArray(row.Tb_Comentarios) && row.Tb_Comentarios.length > 0)
    ? row.Tb_Comentarios
    : (Array.isArray(row.comentarios) && row.comentarios.length > 0 ? row.comentarios : null);

  if (Array.isArray(rawComentarios)) {
    comentarios = rawComentarios.map((c: any) => ({
      id: c.id_comentario || c.id,
      id_comentario: c.id_comentario || c.id,
      id_autor: c.id_autor || c.id_user,
      id_user: c.id_autor || c.id_user,
      autor: c.autor || (c.id_autor ? `Operador #${c.id_autor}` : "Operador"),
      data: c.data || c.created_at || new Date().toISOString(),
      created_at: c.created_at || c.data || new Date().toISOString(),
      texto: c.texto || "",
      tipo_acao: c.tipo_acao || "Comentário",
      is_finalizacao: c.tipo_acao === "Finalização" || (typeof c.texto === "string" && c.texto.includes("[Finalização]"))
    }));
  } else if (row.comentarios) {
    comentarios = parseComentarios(row.comentarios);
  }

  const rawId = String(row.id_aviso || row.id || row.ID || "").trim();
  const finalId = rawId || `av-${index !== undefined ? index + 1 : Math.random().toString(36).substr(2, 7)}`;

  const rawAuthorName = row.autor_dados?.nome
    ? `${row.autor_dados.nome}${row.autor_dados.sobrenome ? " " + row.autor_dados.sobrenome : ""}`.trim()
    : (row.autor || (row.id_autor ? `Operador #${row.id_autor}` : "Sistema"));

  const destinacoesRaw = Array.isArray(row.destinacoes) ? row.destinacoes : [];
  const lidosSet = new Set<string>();
  if (Array.isArray(row.lido_por)) {
    row.lido_por.forEach((id: any) => lidosSet.add(String(id)));
  }
  destinacoesRaw.forEach((d: any) => {
    if (d.lido && d.id_user !== undefined && d.id_user !== null) {
      lidosSet.add(String(d.id_user));
    }
  });

  return {
    id: finalId,
    titulo: row.titulo || "",
    conteudo: row.descricao || row.conteudo || "",
    tipo: row.tipo || "Aviso",
    prioridade: row.prioridade || "Média",
    destino: row.destino || "Todos",
    destinatarioNome: row.destinatario_nome || row.destinatarioNome || "Todos os Membros",
    destinatarioEmail: row.destinatario_email || row.destinatarioEmail || "Todos",
    destinatarioId: row.destinatario_id || row.destinatarioId || "",
    autor: rawAuthorName,
    autorEmail: row.autor_dados?.email || row.autor_email || row.autorEmail || "",
    dataCriacao: row.data_criacao || row.created_at || row.dataCriacao || "",
    status: row.status || "Aberto",
    lido: row.lido || "Não",
    lido_por: Array.from(lidosSet),
    concluidoPor: row.concluido_por || row.concluidoPor || "",
    comentarios: comentarios,
    Tb_Comentarios: row.Tb_Comentarios || comentarios,
    id_autor: row.id_autor ? Number(row.id_autor) : undefined,
    autor_dados: row.autor_dados,
    destinacoes: destinacoesRaw
  } as any;
}

export function mapAvisoToDB(aviso: Partial<Aviso>, currentUserId?: number | string) {
  const idVal = String(aviso.id || "").trim();
  const authorId = Number((aviso as any).id_autor || currentUserId) || 1;
  return {
    id_aviso: idVal || ("av-" + Math.floor(1000 + Math.random() * 9000)),
    titulo: aviso.titulo || "",
    descricao: aviso.conteudo || "",
    tipo: aviso.tipo || "Aviso",
    prioridade: aviso.prioridade || "Média",
    id_autor: authorId,
    status: aviso.status || "Aberto"
  };
}

// ==============================================================================
// 2. BUSCAS DIRETAS AO SUPABASE USANDO DEEP JOINS
// ==============================================================================

export async function fetchEntroncamentosFromSupabase(): Promise<EntroncamentoRow[]> {
  try {
    const { data, error } = await supabase
      .from("Tb_Entroncamentos")
      .select(`
        *,
        responsaveis:Tb_Entroncamento_Responsaveis(*, responsavel:Tb_Responsaveis(*)),
        historico:Tb_Entroncamentos_Historico(*, autor:Tb_Users(*))
      `)
      .eq("categoria", "Físico")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[Supabase] fetchEntroncamentosFromSupabase warning:", error);
      const { data: fallbackData } = await supabase
        .from("Tb_Entroncamentos")
        .select("*, historico:Tb_Entroncamentos_Historico(*)")
        .eq("categoria", "Físico")
        .order("created_at", { ascending: false });
      return (fallbackData || []).map((row, idx) => mapEntroncamentoFromDB(row, idx));
    }
    return (data || []).map((row, idx) => mapEntroncamentoFromDB(row, idx));
  } catch {
    return [];
  }
}

export async function fetchCamadaOpticaFromSupabase(): Promise<CamadaOpticaRow[]> {
  try {
    // Busca os registros de Camada Óptica na Tb_Entroncamentos filtrando por categoria
    const { data, error } = await supabase
      .from("Tb_Entroncamentos")
      .select(`
        *,
        responsaveis:Tb_Entroncamento_Responsaveis(*, responsavel:Tb_Responsaveis(*)),
        historico:Tb_Entroncamentos_Historico(*, autor:Tb_Users(*))
      `)
      .eq("categoria", "Camada Óptica")
      .order("created_at", { ascending: false });

    if (error) {
      const { data: fallbackData } = await supabase
        .from("Tb_Entroncamentos")
        .select("*, historico:Tb_Entroncamentos_Historico(*)")
        .eq("categoria", "Camada Óptica")
        .order("created_at", { ascending: false });
      return (fallbackData || []).map((row, idx) => mapCamadaOpticaFromDB(row, idx));
    }
    return (data || []).map((row, idx) => mapCamadaOpticaFromDB(row, idx));
  } catch {
    return [];
  }
}

export async function fetchAvisosFromSupabase(): Promise<Aviso[]> {
  try {
    const { data, error } = await supabase
      .from('Tb_Avisos')
      .select(`
        *,
        destinacoes:Tb_Destinacoes(*, user:Tb_Users(id, nome, sobrenome, email)),
        Tb_Comentarios(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("[fetchAvisosFromSupabase] Join with user/comments failed, trying fallback:", error);
      const { data: fallbackData, error: fbError } = await supabase
        .from('Tb_Avisos')
        .select(`
          *,
          destinacoes:Tb_Destinacoes(*),
          Tb_Comentarios(*)
        `)
        .order('created_at', { ascending: false });

      if (fbError) {
        console.warn("[fetchAvisosFromSupabase] Fallback query failed:", fbError);
        return [];
      }
      return (fallbackData || []).map((row, idx) => mapAvisoFromDB(row, idx));
    }

    return (data || []).map((row, idx) => mapAvisoFromDB(row, idx));
  } catch (err) {
    console.error("[fetchAvisosFromSupabase] Exception:", err);
    return [];
  }
}

export const fetchAvisos = fetchAvisosFromSupabase;

// Rotinas para tabelas não homologadas no Supabase (gerenciadas via Google Sheets / cache local)
export async function fetchOtdrFromSupabase(): Promise<OtdrRow[]> {
  return [];
}

export async function fetchAtenuacoesFromSupabase(): Promise<AtenuacoesRow[]> {
  return [];
}

export async function fetchTestesCampoFromSupabase(): Promise<TestesCampoRow[]> {
  return [];
}

export async function fetchBypassFromSupabase(): Promise<BypassRow[]> {
  return [];
}

export async function fetchTrocaCaboFromSupabase(): Promise<TrocaCaboRow[]> {
  return [];
}

export async function fetchAtuacoesFromSupabase(): Promise<AtuacoesRow[]> {
  return [];
}

export async function fetchRelatorioMensalFromSupabase(): Promise<RelatorioMensalRow[]> {
  return [];
}

export async function fetchUsersFromSupabase(): Promise<UserConfig[]> {
  const { data, error } = await supabase
    .from("Tb_Users")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("[Supabase] Erro ao buscar Tb_Users:", error);
    return [];
  }
  return (data || []).map((u: any) => ({
    id: String(u.id),
    auth_id: u.auth_id,
    nome: u.nome || "",
    sobrenome: u.sobrenome || "",
    email: (u.email || "").toLowerCase().trim(),
    dataNascimento: u.data_nascimento || "",
    dataInsercao: u.data_insercao || u.created_at || "",
    nivel: u.nivel || "Assistente",
    role: u.role || "Operador",
    permissions: typeof u.permissoes === "string" ? JSON.parse(u.permissoes) : (u.permissoes || {})
  }));
}

// Busca unificada e paralela estritamente focada nas tabelas homologadas do Supabase
export async function fetchAllDataFromSupabase() {
  const [
    entroncamentos,
    camadaOptica,
    avisos,
    users
  ] = await Promise.all([
    fetchEntroncamentosFromSupabase().catch(() => []),
    fetchCamadaOpticaFromSupabase().catch(() => []),
    fetchAvisosFromSupabase().catch(() => []),
    fetchUsersFromSupabase().catch(() => [])
  ]);

  return {
    entroncamentos,
    camadaOptica,
    avisos,
    otdr: [],
    atenuacoes: [],
    testesCampo: [],
    bypass: [],
    trocaCabo: [],
    atuacoes: [],
    relatorioMensal: [],
    users
  };
}

// ==============================================================================
// 3. OPERAÇÕES CRUD NO SUPABASE (INSERT / UPDATE / DELETE / UPSERT)
// ==============================================================================

// --- ENTRONCAMENTOS ---
export async function insertEntroncamentoSupabase(item: EntroncamentoRow): Promise<void> {
  const dbData = mapEntroncamentoToDB(item);
  const { error } = await supabase.from("Tb_Entroncamentos").insert([dbData]);
  if (error) {
    console.error("[Supabase] Falha ao inserir Entroncamento:", error);
    throw error;
  }
}

export async function updateEntroncamentoSupabase(id: string, item: Partial<EntroncamentoRow>): Promise<void> {
  const dbData = mapEntroncamentoToDB(item as EntroncamentoRow);
  const { error } = await supabase.from("Tb_Entroncamentos").update(dbData).eq("id_entroncamento", id);
  if (error) {
    console.error("[Supabase] Falha ao atualizar Entroncamento:", error);
    throw error;
  }
}

export async function deleteEntroncamentoSupabase(id: string): Promise<void> {
  const { error } = await supabase.from("Tb_Entroncamentos").delete().eq("id_entroncamento", id);
  if (error) {
    console.error("[Supabase] Falha ao excluir Entroncamento:", error);
    throw error;
  }
}

export async function insertEntroncamentoHistoricoSupabase(
  id_entroncamento: string,
  autor: string,
  acao: string,
  detalhes: string,
  status_anterior?: string,
  status_novo?: string
): Promise<void> {
  const { error } = await supabase.from("Tb_Entroncamentos_Historico").insert([{
    id_entroncamento,
    autor,
    acao,
    detalhes,
    status_anterior,
    status_novo,
    data: new Date().toISOString()
  }]);
  if (error) {
    console.warn("[Supabase] Erro ao gravar histórico de entroncamento:", error);
  }
}

// --- CAMADA ÓPTICA ---
export async function insertCamadaOpticaSupabase(item: CamadaOpticaRow): Promise<void> {
  const dbData = mapCamadaOpticaToDB(item);
  const { error } = await supabase.from("Tb_CamadaOptica").insert([dbData]);
  if (error) throw error;
}

export async function updateCamadaOpticaSupabase(id: string, item: Partial<CamadaOpticaRow>): Promise<void> {
  const dbData = mapCamadaOpticaToDB(item as CamadaOpticaRow);
  const { error } = await supabase.from("Tb_CamadaOptica").update(dbData).eq("id", id);
  if (error) throw error;
}

export async function deleteCamadaOpticaSupabase(id: string): Promise<void> {
  const { error } = await supabase.from("Tb_CamadaOptica").delete().eq("id", id);
  if (error) throw error;
}

// --- AVISOS ---
export async function insertAvisoSupabase(aviso: Aviso, currentUserId?: number | string): Promise<void> {
  const dbData = mapAvisoToDB(aviso, currentUserId);
  const { error } = await supabase.from("Tb_Avisos").insert([dbData]);
  if (error) throw error;

  // Se houver comentários iniciais, insere na tabela filha Tb_Comentarios
  if (Array.isArray(aviso.comentarios) && aviso.comentarios.length > 0) {
    const commentsToInsert = aviso.comentarios.map(c => ({
      id_aviso: aviso.id,
      autor: c.autor || "Sistema",
      data: c.data || new Date().toISOString(),
      texto: c.texto || ""
    }));
    try {
      await supabase.from("Tb_Comentarios").insert(commentsToInsert);
    } catch (e) {
      console.warn("[Supabase] Aviso comentarios initial insert warning:", e);
    }
  }
}

export async function updateAvisoSupabase(id: string, aviso: Partial<Aviso>): Promise<void> {
  const updatePayload: Record<string, any> = {};
  if (aviso.titulo !== undefined) updatePayload.titulo = aviso.titulo;
  if (aviso.conteudo !== undefined) updatePayload.descricao = aviso.conteudo;
  if (aviso.tipo !== undefined) updatePayload.tipo = aviso.tipo;
  if (aviso.prioridade !== undefined) updatePayload.prioridade = aviso.prioridade;
  if (aviso.status !== undefined) updatePayload.status = aviso.status;
  // Nunca sobregrava id_autor a menos que seja um número positivo válido
  if ((aviso as any).id_autor && Number((aviso as any).id_autor) > 0) {
    updatePayload.id_autor = Number((aviso as any).id_autor);
  }
  const { error } = await supabase.from("Tb_Avisos").update(updatePayload).eq("id_aviso", id);
  if (error) throw error;
}

export async function deleteAvisoSupabase(id: string): Promise<void> {
  const { error } = await supabase.from("Tb_Avisos").delete().eq("id_aviso", id);
  if (error) throw error;
}

// --- COMENTÁRIOS DE AVISOS (TABELA FILHA Tb_Comentarios) ---
export async function insertComentarioAvisoSupabase(
  id_aviso: string,
  autor: string,
  texto: string,
  id_autor?: number | string,
  tipo_acao: string = 'Comentário'
): Promise<any> {
  const isFinalizacao = tipo_acao === 'Finalização' || texto.includes('[Finalização]');
  const actionType = isFinalizacao ? 'Finalização' : (tipo_acao === 'Fechamento' || texto.includes('[Fechamento]') ? 'Fechamento' : tipo_acao);
  const payload: any = {
    id_aviso,
    texto,
    created_at: new Date().toISOString(),
    tipo_acao: actionType
  };
  if (id_autor !== undefined && id_autor !== null && !isNaN(Number(id_autor))) {
    payload.id_autor = Number(id_autor);
  }
  const { data, error } = await supabase.from("Tb_Comentarios").insert([payload]).select();
  if (error) {
    console.warn("[Supabase] Falha ao inserir com id_autor em Tb_Comentarios, tentando fallback básico:", error);
    const { data: d2, error: err2 } = await supabase.from("Tb_Comentarios").insert([{
      id_aviso,
      texto,
      created_at: new Date().toISOString(),
      tipo_acao: actionType
    }]).select();
    if (err2) {
      console.error("[Supabase] Erro ao inserir Tb_Comentarios:", err2);
    }
    return d2?.[0];
  }
  return data?.[0];
}

export async function updateComentarioAvisoSupabase(
  id_comentario: number | string,
  texto: string
): Promise<void> {
  const { error } = await supabase
    .from("Tb_Comentarios")
    .update({ texto })
    .eq("id_comentario", id_comentario);
  if (error) {
    console.warn("[Supabase] Erro ao atualizar comentário em Tb_Comentarios:", error);
  }
}

export async function deleteComentarioAvisoSupabase(
  id_comentario: number | string
): Promise<void> {
  const { error } = await supabase
    .from("Tb_Comentarios")
    .delete()
    .eq("id_comentario", id_comentario);
  if (error) {
    console.warn("[Supabase] Erro ao deletar comentário de Tb_Comentarios:", error);
  }
}

// --- CONFIRMAÇÃO DE LEITURA SEGURA (Tb_Destinacoes com Upsert e ID Numérico de Tb_Users) ---
export async function confirmarLeituraAvisoSupabase(
  id_aviso: string,
  userEmail: string,
  options?: { concluido?: boolean }
): Promise<{ success: boolean; numericUserId?: number }> {
  try {
    const cleanEmail = (userEmail || "").trim().toLowerCase();
    if (!cleanEmail) {
      console.warn("[confirmarLeituraAviso] Email do usuário ausente.");
      return { success: false };
    }

    // 1. Busca o ID REAL e NUMÉRICO na Tb_Users (não usa Regex!)
    const { data: userRecord, error: userError } = await supabase
      .from("Tb_Users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (userError || !userRecord?.id) {
      console.warn(`[confirmarLeituraAviso] Usuário ${cleanEmail} não encontrado em Tb_Users.`, userError);
      return { success: false };
    }

    const numericUserId = Number(userRecord.id);
    if (isNaN(numericUserId)) {
      console.error("[confirmarLeituraAviso] ID de usuário não é numérico:", userRecord.id);
      return { success: false };
    }

    // 2. Executa o UPSERT seguro na Tb_Destinacoes com conflito composto (id_aviso, id_user)
    // Envia EXCLUSIVAMENTE as colunas existentes na tabela para evitar erro 400 Bad Request
    const { error: upsertError } = await supabase
      .from("Tb_Destinacoes")
      .upsert(
        {
          id_aviso,
          id_user: numericUserId,
          tipo_destino: "Todos",
          lido: true
        },
        { onConflict: "id_aviso, id_user" }
      );

    if (upsertError) {
      console.error("[confirmarLeituraAviso] Falha no upsert em Tb_Destinacoes:", upsertError);
      return { success: false };
    }

    return { success: true, numericUserId };
  } catch (err) {
    console.error("[confirmarLeituraAviso] Exceção:", err);
    return { success: false };
  }
}

// --- DEMAIS TABELAS CRUD GENÉRICO SUPABASE ---
export async function insertGenericSupabase(table: string, data: any): Promise<void> {
  const { error } = await supabase.from(table).insert([data]);
  if (error) throw error;
}

export async function updateGenericSupabase(table: string, id: string, data: any): Promise<void> {
  const { error } = await supabase.from(table).update(data).eq("id", id);
  if (error) throw error;
}

export async function deleteGenericSupabase(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
