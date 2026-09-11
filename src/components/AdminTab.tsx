import React, { useState, useMemo } from "react";
import { 
  User, 
  Plus, 
  Trash2, 
  Search, 
  Shield, 
  Settings, 
  Layers, 
  Activity, 
  Lock, 
  RefreshCw, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  Eye, 
  EyeOff,
  Bell,
  LayoutDashboard,
  AlertOctagon,
  Briefcase,
  Cable,
  Radio,
  FileSpreadsheet,
  UserCheck,
  Check,
  Save
} from "lucide-react";
import { UserConfig, DEFAULT_CARGO_PERMISSIONS } from "../types";
import { supabase } from "../supabaseClient";

interface AdminTabProps {
  usersList: UserConfig[];
  setUsersList: React.Dispatch<React.SetStateAction<UserConfig[]>>;
  formUser: UserConfig;
  setFormUser: (user: UserConfig) => void;
  setShowUserModal: (show: boolean) => void;
  postToSheets: (action: string, tabName: string, payload: any) => Promise<any>;
  setShowConfirmDeleteUserModal?: (show: boolean) => void;
  setUserToDelete?: (user: UserConfig | null) => void;
  setSuccessToast?: (message: string | null) => void;
}

export const AdminTab: React.FC<AdminTabProps> = ({
  usersList,
  setUsersList,
  formUser,
  setFormUser,
  setShowUserModal,
  postToSheets,
  setShowConfirmDeleteUserModal,
  setUserToDelete,
  setSuccessToast,
}) => {
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeConfigMode, setActiveConfigMode] = useState<"user" | "cargo">("user");

  // Taxonomy aligned with sidebar navigation
  const MODULE_GROUPS = [
    {
      id: "gestao_geral",
      title: "GESTÃO GERAL",
      modules: [
        { key: "avisos", label: "Painel de Avisos" },
        { key: "relatorio_periodico", label: "Relatório Semanal" },
        { key: "controle_incidentes", label: "Controle de Incidentes" }
      ]
    },
    {
      id: "incidentes_campo",
      title: "INCIDENTES & CAMPO",
      modules: [
        { key: "atenuacoes", label: "Atenuações" },
        { key: "testes_campo", label: "Testes de Campo" },
        { key: "atuacoes_geral", label: "Atuações" },
        { key: "troca_cabo", label: "Troca de Cabo" }
      ]
    },
    {
      id: "mapeamento_rede",
      title: "MAPEAMENTO DE REDE",
      modules: [
        { key: "bypass", label: "Bypass" }
      ]
    },
    {
      id: "externos",
      title: "EXTERNOS",
      modules: [
        { key: "entroncamentos", label: "Entroncamentos" },
        { key: "camada_optica", label: "Camada Óptica" },
        { key: "otdr", label: "Planejamento OTDR" }
      ]
    },
    {
      id: "administracao",
      title: "ADMINISTRAÇÃO",
      modules: [
        { key: "admin", label: "Gerenciar Usuários" }
      ]
    }
  ];

  // Flat list of modules
  const MODULES_LIST = MODULE_GROUPS.flatMap(g => g.modules.map(m => ({ key: m.key, label: `${g.title}: ${m.label}` })));

  const toggleCargoGroup = (groupModules: { key: string }[], checked: boolean) => {
    setCargoPermissions(prev => {
      const currentCargoPerms = { ...(prev[selectedCargo] || {}) };
      groupModules.forEach(mod => {
        if (mod.key === "admin" && selectedCargo !== "Administrador") {
          currentCargoPerms[mod.key] = { visualizar: checked, editar: false, excluir: false };
        } else {
          currentCargoPerms[mod.key] = { visualizar: checked, editar: checked, excluir: checked };
        }
      });
      const updated = { ...prev, [selectedCargo]: currentCargoPerms };
      localStorage.setItem("cbe_cargo_permissions", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleUserGroup = (groupModules: { key: string }[], checked: boolean) => {
    const updatedPerms = { ...(formUser.permissions || {}) };

    groupModules.forEach(mod => {
      if (mod.key === "admin" && formUser.email !== "contato@franciscogabriel.com.br" && !formUser.permissions?.admin?.visualizar) {
        updatedPerms[mod.key] = { visualizar: checked, editar: false, excluir: false };
      } else {
        updatedPerms[mod.key] = { visualizar: checked, editar: checked, excluir: checked };
      }
    });

    const updatedUser = { ...formUser, permissions: updatedPerms };
    // Atualiza apenas o estado local do formulário de edição; persistência definitiva apenas via handleSalvarPermissoes
    setFormUser(updatedUser);
  };

  const [selectedCargo, setSelectedCargo] = useState<string>("Assistente");
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);

  const [cargoPermissions, setCargoPermissions] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem("cbe_cargo_permissions");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing cargo permissions:", e);
    }
    
    // Utiliza os templates oficiais de permissões por cargo padronizados
    const initial: Record<string, any> = { ...DEFAULT_CARGO_PERMISSIONS };
    localStorage.setItem("cbe_cargo_permissions", JSON.stringify(initial));
    return initial;
  });

  // Filter users by search term (name, surname, or email)
  const filteredUsers = useMemo(() => {
    return usersList.filter((user) => {
      const term = userSearchTerm.toLowerCase().trim();
      if (!term) return true;
      const fullName = `${user.nome || ""} ${user.sobrenome || ""}`.toLowerCase();
      const email = (user.email || "").toLowerCase();
      return fullName.includes(term) || email.includes(term);
    });
  }, [usersList, userSearchTerm]);

  // Helper to generate initials
  const getInitials = (nome: string, sobrenome: string) => {
    const first = nome ? nome.charAt(0) : "";
    const last = sobrenome ? sobrenome.charAt(0) : "";
    return `${first}${last}`.toUpperCase() || "OP";
  };

  // Maps permissions keys to clean monochrome Lucide icons
  const getModuleIcon = (key: string) => {
    switch (key) {
      case "avisos":
        return <Bell className="w-4 h-4 text-gray-700" />;
      case "relatorio_periodico":
        return <LayoutDashboard className="w-4 h-4 text-gray-700" />;
      case "controle_incidentes":
        return <AlertOctagon className="w-4 h-4 text-gray-700" />;
      case "atenuacoes":
        return <Layers className="w-4 h-4 text-gray-700" />;
      case "testes_campo":
        return <Activity className="w-4 h-4 text-gray-700" />;
      case "atuacoes_geral":
        return <Briefcase className="w-4 h-4 text-gray-700" />;
      case "troca_cabo":
        return <Cable className="w-4 h-4 text-gray-700" />;
      case "bypass":
        return <Radio className="w-4 h-4 text-gray-700" />;
      case "entroncamentos":
        return <FileSpreadsheet className="w-4 h-4 text-gray-700" />;
      case "camada_optica":
        return <Layers className="w-4 h-4 text-gray-700" />;
      case "otdr":
        return <Activity className="w-4 h-4 text-gray-700" />;
      case "admin":
        return <UserCheck className="w-4 h-4 text-gray-700" />;
      default:
        return <Settings className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleSalvarPermissoes = async () => {
    if (!formUser.email) return;
    const cleanEmail = String(formUser.email).trim().toLowerCase();
    setIsSyncing(true);
    setSyncSuccess(false);

    try {
      // 1. Validação de Payload: garante formato estruturado do estado de permissões
      const permissionsState = typeof formUser.permissions === "string"
        ? JSON.parse(formUser.permissions)
        : (formUser.permissions || {});

      const permissoesJsonString = JSON.stringify(permissionsState);
      const novoCargo = formUser.nivel || "Assistente";

      // 2. SEPARAÇÃO DE FLUXO (CRIAR vs EDITAR):
      // Determina o targetId para atualização
      let targetId: number | null = null;
      const numericId = Number(formUser.id);
      if (!isNaN(numericId) && numericId > 0) {
        targetId = numericId;
      } else {
        // Se o id não for numérico (ex: "USR-xxxx"), localiza pelo email no Supabase
        const { data: existingRows, error: findError } = await supabase
          .from("Tb_Users")
          .select("id")
          .ilike("email", cleanEmail);

        if (findError) {
          console.error("Erro Supabase ao consultar usuário:", findError.message);
          if (setSuccessToast) {
            setSuccessToast(`❌ Erro ao consultar usuário no Supabase: ${findError.message}`);
          }
          alert(`Erro Supabase ao consultar usuário: ${findError.message}\n\nA sincronização foi abortada.`);
          setIsSyncing(false);
          return;
        }

        if (existingRows && existingRows.length > 0) {
          targetId = existingRows[0].id;
        }
      }

      // 3. REQUISIÇÃO SUPABASE PRIMEIRO (UPDATE vs INSERT):
      if (targetId) {
        // FLUXO DE EDIÇÃO: Substitui o .insert() cego por .update().eq('id', targetId)
        const { error } = await supabase
          .from("Tb_Users")
          .update({
            nivel: novoCargo,
            permissoes: permissoesJsonString,
            nome: formUser.nome || "",
            sobrenome: formUser.sobrenome || ""
          })
          .eq("id", targetId);

        // BLOQUEIO DE SINCRONIZAÇÃO EM CASCATA:
        // Se o Supabase falhar, ABORTA TUDO imediatamente e exibe o erro. NADA vai para o Google Sheets!
        if (error) {
          console.error("[Supabase Error] Falha ao atualizar usuário:", error.message);
          if (setSuccessToast) {
            setSuccessToast(`❌ Erro no Supabase: ${error.message}`);
          }
          alert(`Falha ao salvar no Supabase: ${error.message}\n\nA sincronização com a planilha foi abortada para proteger a integridade dos dados.`);
          setIsSyncing(false);
          return;
        }

        console.log(`[Supabase UPDATE] Usuário ${cleanEmail} (ID: ${targetId}) atualizado com sucesso em Tb_Users.`);
      } else {
        // FLUXO DE NOVO USUÁRIO: Upsert seguro respeitando cadastros existentes
        const { data: insData, error: insErr } = await supabase
          .from("Tb_Users")
          .upsert({
            email: cleanEmail,
            nome: formUser.nome || "",
            sobrenome: formUser.sobrenome || "",
            nivel: novoCargo,
            permissoes: permissoesJsonString,
            senha: formUser.senha || "OAuth/SupabaseAuthSecure"
          }, { onConflict: "email", ignoreDuplicates: true })
          .select("id")
          .maybeSingle();

        if (insErr) {
          console.error("[Supabase Error] Falha ao inserir novo usuário:", insErr.message);
          if (setSuccessToast) {
            setSuccessToast(`❌ Erro no Supabase ao cadastrar: ${insErr.message}`);
          }
          alert(`Falha ao cadastrar no Supabase: ${insErr.message}\n\nA sincronização com a planilha foi abortada.`);
          setIsSyncing(false);
          return;
        }

        if (insData?.id) {
          targetId = insData.id;
        }
        console.log(`[Supabase INSERT] Usuário ${cleanEmail} (ID: ${targetId}) criado com sucesso em Tb_Users.`);
      }

      // 4. SINCRONIA DE ESTADO LOCAL: Atualiza o estado React SOMENTE após confirmação de sucesso do Supabase
      const updatedUser: UserConfig = {
        ...formUser,
        id: targetId ? String(targetId) : formUser.id,
        nivel: novoCargo,
        email: cleanEmail,
        permissions: permissionsState
      };

      const updatedList = usersList.map(u => 
        String(u.email || "").trim().toLowerCase() === cleanEmail ? updatedUser : u
      );
      setUsersList(updatedList);
      localStorage.setItem("cbe_users_list", JSON.stringify(updatedList));
      setFormUser(updatedUser);

      // 5. SINCRONIZAÇÃO COM GOOGLE SHEETS: Disparada exclusivamente após o Supabase ser concluído com sucesso (!error)
      try {
        await postToSheets("update", "USERS", {
          ...updatedUser,
          email: cleanEmail,
          permissions: permissoesJsonString
        });
        console.log(`[Google Sheets Mirror] Sincronização secundária concluída para ${cleanEmail}.`);
      } catch (sheetsErr: any) {
        console.warn("[Google Sheets Mirror] Aviso: Falha ao espelhar na planilha no momento:", sheetsErr?.message || sheetsErr);
      }

      setSyncSuccess(true);
      if (setSuccessToast) {
        setSuccessToast(`✓ Cargo e permissões de ${updatedUser.nome || cleanEmail} salvos no Supabase com sucesso!`);
      }
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar permissões:", err);
      alert(`Falha ao salvar permissões: ${err.message || String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveUserPermissions = handleSalvarPermissoes;

  const handleCargoPermissionChange = (modKey: string, type: "visualizar" | "editar" | "excluir", checked: boolean) => {
    const updated = {
      ...cargoPermissions,
      [selectedCargo]: {
        ...cargoPermissions[selectedCargo],
        [modKey]: {
          ...cargoPermissions[selectedCargo][modKey],
          [type]: checked
        }
      }
    };
    setCargoPermissions(updated);
    localStorage.setItem("cbe_cargo_permissions", JSON.stringify(updated));
  };

  const handleApplyBulkPermissions = async () => {
    const defaultPerms = cargoPermissions[selectedCargo];
    if (!defaultPerms) return;

    const count = usersList.filter(u => u.nivel === selectedCargo).length;
    if (count === 0) {
      alert(`Nenhum usuário cadastrado possui o cargo "${selectedCargo}".`);
      return;
    }

    if (!confirm(`Deseja salvar e aplicar as permissões padrão para todos os ${count} colaboradores com o cargo "${selectedCargo}"?`)) {
      return;
    }

    setIsApplyingBulk(true);
    setBulkSuccess(false);

    try {
      const isSuperAdminEmail = (emailStr: string) => {
        const clean = String(emailStr || "").trim().toLowerCase();
        return clean === "francisco.gabriel@grupobrisanet.com.br" || clean === "contato@franciscogabriel.com.br";
      };

      // 1. UPDATE no Supabase (Tb_Users) para todos os colaboradores deste cargo com validação explícita
      const permissoesJsonString = JSON.stringify(defaultPerms);
      const { data: sbUsers, error: sbFetchErr } = await supabase
        .from("Tb_Users")
        .select("id, email, nivel");

      if (sbFetchErr) {
        console.error("Erro Supabase ao consultar grupo:", sbFetchErr.message);
        alert(`Erro Supabase ao consultar grupo: ${sbFetchErr.message}`);
        return;
      }

      if (sbUsers) {
        const targets = sbUsers.filter((u: any) => u.nivel === selectedCargo && !isSuperAdminEmail(u.email));
        for (const target of targets) {
          const { error: bulkUpdErr } = await supabase
            .from("Tb_Users")
            .update({ permissoes: permissoesJsonString })
            .eq("id", target.id)
            .select();

          if (bulkUpdErr) {
            console.error(`Erro Supabase ao salvar permissões para ${target.email}:`, bulkUpdErr.message);
            alert(`Erro Supabase ao salvar permissões para ${target.email}: ${bulkUpdErr.message}`);
            return;
          }
        }
        console.log(`[Supabase Source-of-Truth] Permissões do cargo ${selectedCargo} salvas para ${targets.length} usuários em Tb_Users.`);
      }

      // 2. Sincronia de Estado: Atualizar o state local e storage apenas após confirmação do Supabase
      const updatedList = usersList.map(user => {
        if (user.nivel === selectedCargo && !isSuperAdminEmail(user.email)) {
          return {
            ...user,
            permissions: { ...defaultPerms }
          };
        }
        return user;
      });

      setUsersList(updatedList);
      localStorage.setItem("cbe_users_list", JSON.stringify(updatedList));

      if (formUser.email && formUser.nivel === selectedCargo && !isSuperAdminEmail(formUser.email)) {
        setFormUser({
          ...formUser,
          permissions: { ...defaultPerms }
        });
      }

      // 3. Espelhamento secundário na Planilha (não-bloqueante)
      const usersToSync = usersList.filter(user => user.nivel === selectedCargo && !isSuperAdminEmail(user.email));
      for (const u of usersToSync) {
        try {
          await postToSheets("update", "USERS", {
            ...u,
            permissions: permissoesJsonString
          });
        } catch (e) {
          console.warn("[Sheets Mirror] Aviso de espelhamento:", e);
        }
      }

      setBulkSuccess(true);
      if (setSuccessToast) {
        setSuccessToast(`✓ Permissões do grupo ${selectedCargo} salvas no Supabase com sucesso!`);
      }
      setTimeout(() => setBulkSuccess(false), 3000);
    } catch (err: any) {
      console.error("Erro ao aplicar permissões do grupo:", err);
      alert(`Falha ao aplicar permissões do grupo: ${err.message || String(err)}`);
    } finally {
      setIsApplyingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="bg-white text-gray-800 p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1 text-left">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-[#FF5022] rounded-full inline-block"></span>
            Gerenciar Usuários e Permissões
          </h2>
          <p className="text-xs text-gray-500 font-medium font-sans">
            Cadastre novas contas de operadores e gerencie matrizes de permissão de visualização, edição e exclusão de demandas em tempo real • <span className="text-[#FF5022] font-bold">{usersList.length}</span> colaboradores cadastrados
          </p>
        </div>
        
        <button
          onClick={() => {
            const defaultPerms = cargoPermissions["Assistente"] || {
              avisos: { visualizar: true, editar: true, excluir: false },
              relatorio_periodico: { visualizar: false, editar: false, excluir: false },
              controle_incidentes: { visualizar: true, editar: false, excluir: false },
              atenuacoes: { visualizar: true, editar: true, excluir: false },
              testes_campo: { visualizar: true, editar: true, excluir: false },
              atuacoes_geral: { visualizar: false, editar: false, excluir: false },
              troca_cabo: { visualizar: false, editar: false, excluir: false },
              bypass: { visualizar: false, editar: false, excluir: false },
              entroncamentos: { visualizar: true, editar: false, excluir: false },
              camada_optica: { visualizar: true, editar: false, excluir: false },
              otdr: { visualizar: true, editar: false, excluir: false },
              admin: { visualizar: false, editar: false, excluir: false }
            };

            setFormUser({
              id: "",
              nome: "",
              sobrenome: "",
              email: "",
              dataNascimento: "",
              senha: "",
              nivel: "Assistente",
              permissions: defaultPerms,
              dataInsercao: ""
            });
            setShowUserModal(true);
          }}
          className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-[#FF5022] hover:bg-orange-600 text-white font-bold text-xs transition shadow-xs cursor-pointer font-sans border-none select-none shrink-0"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Criar Novo Usuário</span>
        </button>
      </div>

      {/* 2. Main Work Area (Two Columns) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 font-sans">
        {/* Left Column: Users List & Filter */}
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold font-mono text-gray-500 uppercase tracking-widest block">
              Colaboradores ({usersList.length})
            </span>
          </div>

          {/* User Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuário por nome ou email..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-200 focus:border-[#FF5022] rounded-xl py-2.5 pl-10 pr-4 text-xs font-sans text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#FF5022] transition shadow-2xs"
            />
            {userSearchTerm && (
              <button
                onClick={() => setUserSearchTerm("")}
                className="absolute right-3 top-3 text-[10px] font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Users Cards Container */}
          <div className="space-y-2 overflow-y-auto max-h-[580px] pr-1 scrollbar-thin">
            {filteredUsers.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-xs font-medium">
                Nenhum usuário correspondente encontrado.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = String(formUser.email || "").trim().toLowerCase() === String(user.email || "").trim().toLowerCase();
                const isSuperAdmin = user.email === "contato@franciscogabriel.com.br" || user.email === "francisco.gabriel@grupobrisanet.com.br";
                
                return (
                  <div
                    key={user.email}
                    onClick={() => {
                      setFormUser(user);
                      setActiveConfigMode("user");
                    }}
                    className={`p-4 rounded-xl transition-all duration-150 cursor-pointer flex justify-between items-center group ${
                      isSelected && activeConfigMode === "user"
                        ? "bg-gray-50 border-l-4 border-[#FF5022] border-y border-r border-gray-200 shadow-2xs"
                        : "bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar initials badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs select-none ${
                        isSelected && activeConfigMode === "user"
                          ? "bg-orange-50 text-[#FF5022] border border-orange-200" 
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}>
                        {getInitials(user.nome, user.sobrenome)}
                      </div>

                      <div className="space-y-0.5 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 leading-tight">
                            {user.nome} {user.sobrenome}
                          </span>
                          {user.permissions?.admin?.visualizar ? (
                            <span className="bg-orange-50 text-[#FF5022] border border-orange-200/60 px-1.5 py-0.5 rounded text-[8px] uppercase font-mono font-bold">
                              Admin
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded text-[8px] uppercase font-mono font-bold">
                              {user.nivel || "Operador"}
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] font-mono text-gray-500 truncate max-w-[160px] md:max-w-[190px]">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    
                    {/* Action buttons inside user list card */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {!isSuperAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormUser(user);
                            setShowUserModal(true);
                          }}
                          className="text-[11px] text-gray-600 hover:text-[#FF5022] hover:bg-orange-50 px-2 py-1 rounded-lg cursor-pointer font-bold transition"
                        >
                          Configurar
                        </button>
                      )}
                      {!isSuperAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (setShowConfirmDeleteUserModal && setUserToDelete) {
                              setUserToDelete(user);
                              setShowConfirmDeleteUserModal(true);
                            } else {
                              if (confirm(`Tem certeza de que deseja remover o usuário ${user.nome}?`)) {
                                const updated = usersList.filter(u => u.email !== user.email);
                                setUsersList(updated);
                                localStorage.setItem("cbe_users_list", JSON.stringify(updated));
                                postToSheets("delete", "USERS", user);
                                setFormUser({ id: "", nome: "", sobrenome: "", email: "", dataNascimento: "", senha: "", permissions: {} as any, dataInsercao: "" });
                              }
                            }
                          }}
                          className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg cursor-pointer transition"
                          title="Excluir Usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isSuperAdmin && (
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "text-[#FF5022] translate-x-0.5" : "text-gray-300"}`} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Permission Matrix Control Panel */}
        <div className="xl:col-span-2 p-6 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-6">
          {/* Subheader Switcher between Individual User and Cargo/Group setup */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-4 gap-3">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveConfigMode("user")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 -mb-[17px] ${
                  activeConfigMode === "user"
                    ? "text-[#FF5022] border-[#FF5022] bg-transparent"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <User className="w-4 h-4" />
                <span>Matriz do Usuário</span>
              </button>
              <button
                onClick={() => setActiveConfigMode("cargo")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 -mb-[17px] ${
                  activeConfigMode === "cargo"
                    ? "text-[#FF5022] border-[#FF5022] bg-transparent"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Privilégios do Grupo</span>
              </button>
            </div>
            
            {activeConfigMode === "cargo" ? (
              <span className="text-[11px] font-bold text-gray-500 font-mono uppercase tracking-wider">
                Ajuste Padrão de Grupos
              </span>
            ) : (
              formUser.email && (
                <span className="text-[11px] font-bold text-gray-500 font-mono uppercase tracking-wider">
                  Configurando: <b className="text-gray-800">{formUser.nome} {formUser.sobrenome}</b>
                </span>
              )
            )}
          </div>

          {activeConfigMode === "cargo" ? (
            /* CONFIG MODE: CARGO (ROLE) PERMISSIONS */
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-700 font-medium font-sans flex items-start gap-3">
                <Shield className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                <div className="text-left">
                  <b className="font-bold text-gray-900">Configuração de Permissões Padrão do Grupo ({selectedCargo}):</b>
                  <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                    Todos os integrantes do grupo <b className="text-gray-900 font-bold">{selectedCargo}</b> herdam estas permissões por padrão. 
                    Caso configure um usuário específico na tab "Matriz do Usuário", as definições individuais dele sobrepõem os padrões do grupo.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Selecionar Grupo / Cargo</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {["Administrador", "Coordenador", "Analista", "Assistente"].map((cargoName) => (
                      <button
                        key={cargoName}
                        onClick={() => setSelectedCargo(cargoName)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          selectedCargo === cargoName
                            ? "bg-[#FF5022] hover:bg-orange-600 text-white shadow-xs"
                            : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {cargoName}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApplyBulkPermissions}
                    disabled={isApplyingBulk}
                    className={`px-5 py-2.5 rounded-xl border font-bold text-xs font-sans transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                      bulkSuccess
                        ? "bg-[#FF5022] border-transparent text-white"
                        : "bg-[#FF5022] hover:bg-orange-600 border-transparent text-white"
                    } disabled:opacity-60`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isApplyingBulk ? "animate-spin" : ""}`} />
                    <span>
                      {isApplyingBulk ? "Salvando..." : bulkSuccess ? "Salvo com Sucesso!" : "Salvar"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold font-mono text-gray-500 uppercase tracking-widest block">
                    Matriz de Privilégios Padrão do Grupo: {selectedCargo}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Integrantes do grupo herdarão estes acessos automaticamente.
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                      <tr>
                        <th className="p-3.5 px-5">Painel / Módulo</th>
                        <th className="p-3.5 text-center w-[110px]">Visualizar</th>
                        <th className="p-3.5 text-center w-[120px]">Editar (Save/Up)</th>
                        <th className="p-3.5 text-center w-[110px]">Excluir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {MODULE_GROUPS.map((group) => {
                        const currentCargoMap = cargoPermissions[selectedCargo] || {};
                        const isGroupAllChecked = group.modules.every(m => currentCargoMap[m.key]?.visualizar && currentCargoMap[m.key]?.editar && currentCargoMap[m.key]?.excluir);
                        const isGroupAnyChecked = group.modules.some(m => currentCargoMap[m.key]?.visualizar || currentCargoMap[m.key]?.editar || currentCargoMap[m.key]?.excluir);

                        return (
                          <React.Fragment key={group.id}>
                            <tr className="bg-gray-50/80 border-y border-gray-200">
                              <td colSpan={4} className="p-2.5 px-5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
                                    {group.title}
                                  </span>
                                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs cursor-pointer hover:bg-gray-50 transition">
                                    <input
                                      type="checkbox"
                                      checked={isGroupAllChecked}
                                      ref={el => { if (el) el.indeterminate = !isGroupAllChecked && isGroupAnyChecked; }}
                                      onChange={(e) => toggleCargoGroup(group.modules, e.target.checked)}
                                      className="accent-[#FF5022] w-4 h-4 cursor-pointer"
                                    />
                                    <span>{isGroupAllChecked ? "Grupo Ativo" : isGroupAnyChecked ? "Grupo Parcial" : "Ativar Todo o Grupo"}</span>
                                  </label>
                                </div>
                              </td>
                            </tr>

                            {group.modules.map((mod) => {
                              const currentPerms = currentCargoMap[mod.key] || { visualizar: false, editar: false, excluir: false };

                              return (
                                <tr key={mod.key} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="p-3 px-5 flex items-center gap-3 pl-8">
                                    <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-200">
                                      {getModuleIcon(mod.key)}
                                    </div>
                                    <span className="font-sans font-medium text-gray-900 text-xs">
                                      {mod.label}
                                    </span>
                                  </td>

                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!currentPerms.visualizar}
                                      onChange={(e) => handleCargoPermissionChange(mod.key, "visualizar", e.target.checked)}
                                      className="accent-[#FF5022] w-5 h-5 cursor-pointer"
                                    />
                                  </td>

                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      disabled={mod.key === "admin" && selectedCargo !== "Administrador"}
                                      checked={!!currentPerms.editar}
                                      onChange={(e) => handleCargoPermissionChange(mod.key, "editar", e.target.checked)}
                                      className="accent-[#FF5022] w-5 h-5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                  </td>

                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      disabled={mod.key === "admin" && selectedCargo !== "Administrador"}
                                      checked={!!currentPerms.excluir}
                                      onChange={(e) => handleCargoPermissionChange(mod.key, "excluir", e.target.checked)}
                                      className="accent-[#FF5022] w-5 h-5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : formUser.email ? (
            /* CONFIG MODE: INDIVIDUAL USER PERMISSIONS */
            <>
              {/* Header Profile Info inside Permissions Box */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF5022] font-bold shadow-2xs select-none">
                    <User className="w-5 h-5 text-[#FF5022]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-gray-900">{formUser.nome} {formUser.sobrenome}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Criado: {formUser.dataInsercao || "Modo Local"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left sm:text-center shrink-0">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 select-none">Nível / Cargo</span>
                  <select
                    value={formUser.nivel || "Assistente"}
                    onChange={(e) => {
                      const newCargo = e.target.value;
                      setFormUser(prev => ({
                        ...prev,
                        nivel: newCargo
                      }));
                    }}
                    className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-[#FF5022] outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Coordenador">Coordenador</option>
                    <option value="Analista">Analista</option>
                    <option value="Assistente">Assistente</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 text-left sm:text-right shrink-0">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 select-none">Senha de Acesso</span>
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 p-1 px-3 rounded-xl shadow-2xs self-start sm:self-end">
                    <Lock className="w-3.5 h-3.5 text-[#FF5022] shrink-0" />
                    <span className="text-[11px] text-gray-700 font-mono font-bold select-none">
                      {showPassword ? formUser.senha : "••••••••"}
                    </span>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 hover:bg-gray-200 rounded transition text-gray-400 hover:text-gray-600 cursor-pointer ml-1 select-none"
                      title={showPassword ? "Ocultar senha" : "Ver senha"}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Matrix of permissions block */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-[11px] font-bold font-mono text-gray-500 uppercase tracking-widest block">
                    Matriz de Privilégios e Telas
                  </span>

                  {formUser.email === "contato@franciscogabriel.com.br" && (
                    <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 select-none">
                      <ShieldCheck className="w-3 h-3 text-[#FF5022]" />
                      Super Administrador Protegido
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                      <tr>
                        <th className="p-3.5 px-5">Painel / Módulo</th>
                        <th className="p-3.5 text-center w-[110px]">Visualizar</th>
                        <th className="p-3.5 text-center w-[120px]">Editar (Save/Up)</th>
                        <th className="p-3.5 text-center w-[110px]">Excluir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {MODULE_GROUPS.map((group) => {
                        const defaultCargoMap = cargoPermissions[formUser.nivel] || {};
                        const userPermsMap = formUser.permissions || {};
                        
                        const isGroupAllChecked = group.modules.every(m => {
                          const p = userPermsMap[m.key] || defaultCargoMap[m.key] || {};
                          return p.visualizar && p.editar && p.excluir;
                        });
                        const isGroupAnyChecked = group.modules.some(m => {
                          const p = userPermsMap[m.key] || defaultCargoMap[m.key] || {};
                          return p.visualizar || p.editar || p.excluir;
                        });

                        return (
                          <React.Fragment key={group.id}>
                            <tr className="bg-gray-50/80 border-y border-gray-200">
                              <td colSpan={4} className="p-2.5 px-5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
                                    {group.title}
                                  </span>
                                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs cursor-pointer hover:bg-gray-50 transition">
                                    <input
                                      type="checkbox"
                                      disabled={formUser.email === "contato@franciscogabriel.com.br"}
                                      checked={isGroupAllChecked}
                                      ref={el => { if (el) el.indeterminate = !isGroupAllChecked && isGroupAnyChecked; }}
                                      onChange={(e) => toggleUserGroup(group.modules, e.target.checked)}
                                      className="accent-[#FF5022] w-4 h-4 cursor-pointer disabled:opacity-40"
                                    />
                                    <span>{isGroupAllChecked ? "Grupo Ativo" : isGroupAnyChecked ? "Grupo Parcial" : "Ativar Todo o Grupo"}</span>
                                  </label>
                                </div>
                              </td>
                            </tr>

                            {group.modules.map((mod) => {
                              const userModPerms = formUser.permissions?.[mod.key];
                              const defaultCargoPerms = defaultCargoMap[mod.key] || { visualizar: false, editar: false, excluir: false };
                              const isSuperUser = formUser.email === "contato@franciscogabriel.com.br";
                              
                              const visValue = userModPerms && userModPerms.visualizar !== undefined
                                ? !!userModPerms.visualizar
                                : !!defaultCargoPerms.visualizar;

                              const ediValue = userModPerms && userModPerms.editar !== undefined
                                ? !!userModPerms.editar
                                : !!defaultCargoPerms.editar;

                              const excValue = userModPerms && userModPerms.excluir !== undefined
                                ? !!userModPerms.excluir
                                : !!defaultCargoPerms.excluir;

                              const updateActionPermission = (action: "visualizar" | "editar" | "excluir", checked: boolean) => {
                                const updatedPerms = { ...(formUser.permissions || {}) };
                                const currentObj = updatedPerms[mod.key] ? { ...updatedPerms[mod.key] } : { ...defaultCargoPerms };
                                currentObj[action] = checked;
                                updatedPerms[mod.key] = currentObj;

                                const updatedUser = { ...formUser, permissions: updatedPerms };
                                // Atualiza apenas o formulário de edição local; persistência oficial ocorre ao clicar em Salvar
                                setFormUser(updatedUser);
                              };

                              return (
                                <tr key={mod.key} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="p-3 px-5 flex items-center gap-3 pl-8">
                                    <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-200">
                                      {getModuleIcon(mod.key)}
                                    </div>
                                    <span className="font-sans font-medium text-gray-900 text-xs">
                                      {mod.label}
                                    </span>
                                  </td>

                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      disabled={isSuperUser}
                                      checked={visValue}
                                      onChange={(e) => updateActionPermission("visualizar", e.target.checked)}
                                      className="accent-[#FF5022] w-5 h-5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                  </td>

                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      disabled={isSuperUser || mod.key === "admin"}
                                      checked={ediValue}
                                      onChange={(e) => updateActionPermission("editar", e.target.checked)}
                                      className="accent-[#FF5022] w-5 h-5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                  </td>

                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      disabled={isSuperUser || mod.key === "admin"}
                                      checked={excValue}
                                      onChange={(e) => updateActionPermission("excluir", e.target.checked)}
                                      className="accent-[#FF5022] w-5 h-5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Bar at bottom with primary "Salvar" button */}
              {formUser.email !== "contato@franciscogabriel.com.br" && (
                <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans">
                  <span className="text-gray-500 font-medium text-[11px] text-left">
                    Altere os privilégios acima e clique em Salvar para sincronizar com as planilhas e banco de dados.
                  </span>
                  
                  <button
                    onClick={handleSaveUserPermissions}
                    disabled={isSyncing}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs font-sans transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                      syncSuccess
                        ? "bg-[#FF5022] text-white"
                        : "bg-[#FF5022] hover:bg-orange-600 text-white"
                    } disabled:opacity-60`}
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : syncSuccess ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Save className="w-4 h-4 text-white" />
                    )}
                    <span>
                      {isSyncing ? "Salvando..." : syncSuccess ? "Salvo com Sucesso!" : "Salvar"}
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty state when no user is selected */
            <div className="h-[520px] flex flex-col justify-center items-center text-center p-12 text-gray-400 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl select-none">
              <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-300 mb-4 shadow-2xs">
                <User className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 font-sans">Nenhum Usuário Selecionado</h4>
              <p className="text-xs text-gray-400 max-w-sm font-sans mt-1.5 leading-relaxed font-medium">
                Selecione um colaborador na lista ao lado para gerenciar suas credenciais de login e matriz de permissões.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
