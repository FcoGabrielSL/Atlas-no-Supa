import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  AlertCircle, 
  Network, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  ChevronRight,
  Info,
  UserPlus,
  User,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SupabaseAuthScreenProps {
  onAuthSuccess: (user: any) => void;
  allowedUsers?: any[];
  onRegisterUser?: (userData: any) => Promise<boolean>;
  isLoadingAllowedUsers?: boolean;
}

export const SupabaseAuthScreen: React.FC<SupabaseAuthScreenProps> = ({ 
  onAuthSuccess, 
  allowedUsers = [],
  onRegisterUser,
  isLoadingAllowedUsers = false
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);

  // Estados adicionais para modo de Registro (Primeiro Acesso)
  const [isSignUp, setIsSignUp] = useState(false);
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [matchedUser, setMatchedUser] = useState<any | null>(null);

  // Efeito para buscar o usuário pré-cadastrado na Matriz de Operadores
  React.useEffect(() => {
    const checkEmail = email.trim().toLowerCase();
    if (!checkEmail) {
      setMatchedUser(null);
      return;
    }

    // 1. Tentar primeiro na lista síncrona recebida via props
    const found = (allowedUsers || []).find(
      (u: any) => String(u.email || "").trim().toLowerCase() === checkEmail
    );

    if (found) {
      setMatchedUser(found);
      if (found.nome) setNome(found.nome);
      if (found.sobrenome) setSobrenome(found.sobrenome);
      if (found.dataNascimento || found.data_nasc) {
        let rawDate = found.dataNascimento || found.data_nasc;
        if (rawDate.includes("-") && !rawDate.includes("/")) {
          const parts = rawDate.split("-");
          if (parts.length === 3) {
            rawDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        setDataNascimento(rawDate);
      }
    } else {
      // 2. Se não estiver no cache local/allowedUsers, fazemos uma verificação assíncrona contra a API Express `/api/users/check-email`
      let active = true;

      const checkViaServer = async () => {
        try {
          const res = await fetch(`/api/users/check-email?email=${encodeURIComponent(checkEmail)}`);
          if (res.ok && active) {
            const result = await res.json();
            if (result.success && result.authorized && result.user) {
              setMatchedUser(result.user);
              if (result.user.nome) setNome(result.user.nome);
              if (result.user.sobrenome) setSobrenome(result.user.sobrenome);
              if (result.user.dataNascimento) {
                let rawDate = result.user.dataNascimento;
                if (rawDate.includes("-") && !rawDate.includes("/")) {
                  const parts = rawDate.split("-");
                  if (parts.length === 3) {
                    rawDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                  }
                }
                setDataNascimento(rawDate);
              }
              return;
            }
          }
        } catch (e) {
          console.warn("Falha de rede ao escanear matriz de operadores em tempo real:", e);
        }

        // Se falhar de vez na API também, aplica os fallbacks estáticos locais de admin (Exclusivo Francisco Gabriel)
        if (active) {
          const isSuperAdminEmail = checkEmail === "francisco.gabriel@grupobrisanet.com.br" || checkEmail === "contato@franciscogabriel.com.br";
          if (isSuperAdminEmail) {
            setMatchedUser({
              nome: "Francisco",
              sobrenome: "Gabriel",
              nivel: "Administrador (Admin)",
              permissions: {
                admin: { visualizar: true, editar: true, excluir: true }
              }
            });
          } else {
            setMatchedUser(null);
          }
        }
      };

      checkViaServer();
      return () => {
        active = false;
      };
    }
  }, [email, allowedUsers]);

  // Recommendations of permissions for user levels (Nível de Usuário)
  const roleRecommendations = [
    {
      roleName: "Administrador (Admin)",
      badge: "Full Access",
      color: "bg-amber-500/10 border-amber-500/30 text-amber-400Class",
      textColor: "text-amber-400",
      description: "Controle total da infraestrutura de dados e configuração de rede.",
      permissions: [
        "Acesso irrestrito a todas as abas e painéis",
        "Configuração de conexões de planilhas e backup",
        "Controle de Matriz de Permissões de outros usuários",
        "Inserção, edição e exclusão de registros e usuários"
      ]
    },
    {
      roleName: "Coordenador de Operações",
      badge: "Gestão Operacional",
      color: "bg-purple-500/10 border-purple-500/30 text-purple-400Class",
      textColor: "text-purple-400",
      description: "Gestores e supervisores responsáveis por planejar ações táticas.",
      permissions: [
        "Acesso para gerenciar operadores, analistas e assistentes",
        "Acesso de edição para Planos de Ação (Backbone, OTDR, Camada)",
        "Visualização de todas as abas técnicas e relatórios do sistema",
        "Controle restrito de exclusão e edição sob hierarquia"
      ]
    },
    {
      roleName: "Analista",
      badge: "Análise de Redes",
      color: "bg-sky-500/10 border-sky-500/30 text-sky-400Class",
      textColor: "text-sky-450",
      description: "Profissionais responsáveis por analisar enlaces e perdas ópticas.",
      permissions: [
        "Criação e edição de incidentes locais (Atenuações, Testes de Campo)",
        "Submissão de bypasses ópticos planejados",
        "Análise e preenchimento de ordens e relatórios mensais",
        "Acesso apenas para visualização de configurações administrativas"
      ]
    },
    {
      roleName: "Assistente",
      badge: "Suporte Operacional",
      color: "bg-slate-500/10 border-slate-505/30 text-slate-400Class",
      textColor: "text-slate-400",
      description: "Suporte operante e registro burocrático de atenuações.",
      permissions: [
        "Acesso estritamente de visualização inicial de painéis técnicos",
        "Monitoramento do dashboard de perdas e planos",
        "Auxílio no preenchimento básico sob controle",
        "Sem capacidade de escrita crítica ou exclusão direta no núcleo"
      ]
    }
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const checkEmail = email.trim().toLowerCase();

    if (password !== confirmPassword) {
      setErrorMessage("As senhas não coincidem.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage("A senha deve ter no mínimo 6 caracteres.");
      setIsLoading(false);
      return;
    }

    let normalizedBirth = dataNascimento.trim();
    if (normalizedBirth.includes("/")) {
      const parts = normalizedBirth.split("/");
      if (parts.length === 3) {
        normalizedBirth = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    try {
      // 1. SELECT prévio na Tb_Users buscando pelo e-mail digitado
      const { data: tbUsers, error: tbQueryError } = await supabase
        .from("Tb_Users")
        .select("*")
        .ilike("email", checkEmail)
        .order("id", { ascending: true });

      if (tbQueryError) {
        console.error("Erro ao consultar Tb_Users no Primeiro Acesso:", tbQueryError);
        throw new Error("Erro de comunicação com a base de dados. Tente novamente.");
      }

      // Se não encontrar o e-mail: aborte com "E-mail não localizado na Matriz. Solicite acesso ao Administrador"
      if (!tbUsers || tbUsers.length === 0) {
        setErrorMessage("E-mail não localizado na Matriz. Solicite acesso ao Administrador");
        setIsLoading(false);
        return;
      }

      const matchedTbUser = tbUsers[0];

      // Se encontrar e a conta já estiver vinculada (ex: tiver um auth_id ou senha cadastrada):
      // aborte com "Esta conta já está ativa. Por favor, faça o login padrão."
      const hasAuthId = Boolean(matchedTbUser.auth_id && String(matchedTbUser.auth_id).trim() !== "");
      const hasSenha = Boolean(
        matchedTbUser.senha &&
        String(matchedTbUser.senha).trim() !== "" &&
        matchedTbUser.senha !== "OAuth/SupabaseAuthSecure"
      );

      if (hasAuthId || hasSenha) {
        setErrorMessage("Esta conta já está ativa. Por favor, faça o login padrão.");
        setIsLoading(false);
        return;
      }

      // Se encontrar e estiver vazia/pendente: prossiga com o signUp no Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: checkEmail,
        password: password,
        options: {
          data: {
            nome: nome.trim() || matchedTbUser.nome || "",
            sobrenome: sobrenome.trim() || matchedTbUser.sobrenome || "",
            data_nascimento: normalizedBirth || matchedTbUser.data_nasc || ""
          }
        }
      });

      if (signUpError) {
        if (
          signUpError.message.includes("User already registered") ||
          signUpError.message.includes("already exists")
        ) {
          setErrorMessage("Esta conta já está ativa. Por favor, faça o login padrão.");
          setIsLoading(false);
          return;
        }
        throw new Error(signUpError.message || "Erro ao criar credenciais no Supabase Auth.");
      }

      const authUserId = signUpData?.user?.id;
      if (!authUserId) {
        throw new Error("Não foi possível obter a confirmação do Supabase Auth.");
      }

      // Executa um UPDATE na tabela Tb_Users (where email = email_digitado), vinculando a coluna auth_id com o UUID retornado pelo Supabase Auth
      const updatePayload: any = {
        auth_id: authUserId
      };
      if (nome.trim()) updatePayload.nome = nome.trim();
      if (sobrenome.trim()) updatePayload.sobrenome = sobrenome.trim();
      if (normalizedBirth) updatePayload.data_nasc = normalizedBirth;

      const { error: updateTbError } = await supabase
        .from("Tb_Users")
        .update(updatePayload)
        .ilike("email", checkEmail);

      if (updateTbError) {
        console.error("Aviso ao atualizar auth_id na Tb_Users:", updateTbError);
      }

      // Atualiza lista em memória se callback fornecido (sem duplicar no banco)
      if (onRegisterUser) {
        await onRegisterUser({
          id: String(matchedTbUser.id),
          auth_id: authUserId,
          nome: nome.trim() || matchedTbUser.nome || "",
          sobrenome: sobrenome.trim() || matchedTbUser.sobrenome || "",
          email: checkEmail,
          dataNascimento: normalizedBirth || matchedTbUser.data_nasc || "",
          senha: "",
          nivel: matchedTbUser.nivel || "Assistente"
        });
      }

      setSuccessMessage("✓ Conta ativada com sucesso! Sua senha corporativa foi configurada. Por favor, faça o login padrão.");
      setIsSignUp(false);
      // Limpa campos específicos do cadastro
      setNome("");
      setSobrenome("");
      setDataNascimento("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMessage(err.message || "Erro desconhecido ao registrar usuário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const checkEmail = email.trim().toLowerCase();

    try {
      // Fonte de verdade exclusiva do login: Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: checkEmail,
        password: password
      });

      if (error) {
        // Exibe mensagens amigáveis baseadas no erro do Supabase
        if (
          error.message.includes("Invalid login credentials") ||
          error.message.includes("invalid_credentials")
        ) {
          // Interceptação de Erro no Login (Conta Pendente)
          try {
            const { data: tbUsers, error: tbCheckError } = await supabase
              .from("Tb_Users")
              .select("id, email, auth_id")
              .ilike("email", checkEmail);

            if (!tbCheckError && tbUsers && tbUsers.length > 0) {
              const matchedTb = tbUsers[0];
              // Se o e-mail existir na tabela, mas a conta não possui auth_id (ou está pendente de ativação)
              if (!matchedTb.auth_id || String(matchedTb.auth_id).trim() === "") {
                throw new Error("Conta localizada, mas pendente de ativação. Por favor, clique em 'Primeiro Acesso' abaixo para gerar sua senha corporativa.");
              }
            }
          } catch (checkErr: any) {
            if (checkErr.message && checkErr.message.includes("Conta localizada, mas pendente de ativação")) {
              throw checkErr;
            }
            console.warn("Aviso ao verificar status em Tb_Users no login:", checkErr);
          }

          throw new Error("E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.");
        } else if (error.message.includes("Email not confirmed")) {
          throw new Error("E-mail ainda não confirmado. Verifique sua caixa de entrada.");
        } else {
          throw new Error(error.message || "Falha ao autenticar com o Supabase.");
        }
      }

      if (data?.user) {
        setSuccessMessage("Sessão autenticada com sucesso! Redirecionando...");
        setTimeout(() => {
          onAuthSuccess(data.user);
        }, 500);
      } else {
        throw new Error("Não foi possível iniciar a sessão. Tente novamente.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro desconhecido ao autenticar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-100 text-gray-900 flex flex-col justify-center items-center p-4 md:p-8 relative overflow-x-hidden font-sans">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch z-10 animate-fadeIn">
        
        {/* Left Side: Brand presentation (Grafite #1E1E1E) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 md:p-8 bg-[#1E1E1E] rounded-3xl border border-neutral-800 shadow-xl relative text-white">
          
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF5022]/15 border border-[#FF5022]/30 flex items-center justify-center text-[#FF5022] font-extrabold shadow-sm">
                <Network className="w-5 h-5 text-[#FF5022]" />
              </div>
              <div>
                <h1 className="text-sm font-black text-white tracking-widest font-mono">MDD ÓPTICO</h1>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">CONEXÃO CONCENTRADA DE FIBRAS</span>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-white leading-tight font-sans">
                Controle de Enlaces e Análise de Demanda DWDM
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed font-sans font-medium">
                Console corporativo profissional de gerenciamento focado na redução de atenuação no Backbone de Fibra Óptica Nordeste.
              </p>
            </div>

            {/* Quick security notice */}
            <div className="bg-black/40 p-4 rounded-2xl border border-neutral-800 text-[11px] leading-relaxed text-gray-300 space-y-2 font-sans">
              <div className="flex gap-2 text-[#FF5022] font-bold items-center font-mono uppercase text-[9.5px]">
                <ShieldCheck className="w-4 h-4 text-[#FF5022]" />
                Acesso Restrito
              </div>
              <p>
                Os cadastros e atribuições de cargo (<strong className="text-white">Coordenador, Analista ou Assistente</strong>) 
                são realizados exclusivamente pela equipe administrativa via painel de controle. Solicite suas credenciais diretamente ao seu coordenador.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-800 flex items-center justify-between text-[11px] text-gray-400 font-mono mt-6">
            <span>Atlas Backbone</span>
            <span className="text-emerald-400 flex items-center gap-1.5 font-sans font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistemas Operacionais
            </span>
          </div>

        </div>

        {/* Right Side: Auth Form (Login or SignUp) - Light Theme Card */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-xl relative space-y-6 text-gray-800">
            
            <div className="text-left space-y-1">
              {isSignUp ? (
                <>
                  <h2 className="text-lg font-black text-[#FF5022] font-sans uppercase tracking-wider flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-[#FF5022]" />
                    Registro de Primeiro Acesso
                  </h2>
                  <p className="text-xs text-gray-500 font-sans">Crie suas credenciais de operador no Supabase para acessar a malha.</p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-black text-[#FF5022] font-sans uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-5 h-5 text-[#FF5022]" />
                    Identificação do Operador
                  </h2>
                  <p className="text-xs text-gray-500 font-sans">Insira seu e-mail de domínio corporativo para acessar a malha.</p>
                </>
              )}
            </div>

            {/* Success and Error Indicators */}
            <AnimatePresence mode="wait">
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-sm rounded-r-xl flex items-start gap-2.5 font-medium leading-relaxed shadow-xs"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span>{errorMessage}</span>
                    {errorMessage.includes("pendente de ativação") && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(true);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="self-start text-[11px] text-red-800 hover:text-[#FF5022] font-bold underline cursor-pointer bg-transparent border-none p-0 mt-0.5 transition-colors"
                      >
                        → Clique aqui para ir ao Primeiro Acesso
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {successMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-3 text-sm rounded-r-xl flex items-start gap-2.5 font-medium leading-relaxed shadow-xs"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {isSignUp ? (
              /* REGISTRATION FORM */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Nome</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Francisco"
                        className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-sans"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Sobrenome</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Gabriel"
                        className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-sans"
                        value={sobrenome}
                        onChange={(e) => setSobrenome(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Data de Nascimento *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-mono text-left font-medium"
                      value={dataNascimento}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.length > 8) value = value.slice(0, 8);
                        if (value.length > 4) {
                          value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
                        } else if (value.length > 2) {
                          value = `${value.slice(0, 2)}/${value.slice(2)}`;
                        }
                        setDataNascimento(value);
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 block leading-tight mt-1">Digite no formato DD/MM/AAAA (ex: 25/05/1995)</span>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Email Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="seu.nome@grupobrisanet.com.br"
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-sans"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  {email.trim().includes("@") && (
                    <div className="mt-1">
                      {isLoadingAllowedUsers ? (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-[10px] text-orange-700 font-mono flex items-center gap-1.5 animate-pulse">
                          <CheckCircle className="w-3.5 h-3.5 text-orange-600" />
                          <span>⌛ Sincronizando Matriz de Operadores... Por favor, aguarde.</span>
                        </div>
                      ) : matchedUser ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[10px] text-emerald-700 font-mono flex items-center gap-1.5 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>
                            ✓ Operador localizado pré-cadastrado como: <strong className="underline">{matchedUser.nivel}</strong>. Pode definir sua senha!
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Senha Secreta</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-mono"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Confirmar Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-mono"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 py-3 rounded-xl bg-[#FF5022] hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 border-none shadow-md shadow-orange-500/20 font-sans"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Concluir Cadastro</span>
                      <ChevronRight className="w-4.5 h-4.5 text-white" />
                    </>
                  )}
                </button>

                <div className="pt-4 border-t border-gray-200 text-center font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-gray-600 hover:text-[#FF5022] font-bold bg-transparent border-none cursor-pointer transition-colors"
                  >
                    Já possui conta? Fazer Login
                  </button>
                </div>
              </form>
            ) : (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Email Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="seu.nome@grupobrisanet.com.br"
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-sans"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-[11px] font-bold font-mono text-gray-700 uppercase tracking-wider">Senha Secreta</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-10 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5022] focus:ring-1 focus:ring-[#FF5022] font-mono"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-6 py-3 rounded-xl bg-[#FF5022] hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 border-none shadow-md shadow-orange-500/20 font-sans"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Autenticar no Sistema</span>
                      <ChevronRight className="w-4.5 h-4.5 text-white" />
                    </>
                  )}
                </button>

                <div className="pt-4 border-t border-gray-200 text-center font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-gray-600 hover:text-[#FF5022] font-bold bg-transparent border-none cursor-pointer transition-colors"
                  >
                    Novo por aqui? Criar conta de Primeiro Acesso
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
