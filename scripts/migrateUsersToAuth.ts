import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

/**
 * SCRIPT DE MIGRAÇÃO EM MASSA: Tb_Users -> auth.users (Supabase Auth)
 * 
 * Executa a migração segura dos usuários existentes da tabela pública Tb_Users
 * para o sistema oficial de Autenticação do Supabase usando a Service Role Key.
 * Vincula cada perfil público ao seu respectivo auth_id (UUID).
 * 
 * Como executar:
 * SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role" npx tsx scripts/migrateUsersToAuth.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ezebjlodizcjozsjbweq.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ERRO CRÍTICO: Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não configurada.");
  console.error("Para acessar o auth.admin, utilize a 'service_role' key encontrada em:");
  console.error("Supabase Dashboard -> Project Settings -> API -> Project API keys -> service_role");
  console.error("\nUso:");
  console.error("SUPABASE_SERVICE_ROLE_KEY=\"sua_service_role_key\" npx tsx scripts/migrateUsersToAuth.ts\n");
  process.exit(1);
}

// Inicializa o cliente com privilégios administrativos
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateUsers() {
  console.log("==========================================================");
  console.log("🚀 INICIANDO MIGRAÇÃO EM MASSA: Tb_Users -> Supabase Auth");
  console.log(`📡 URL do Supabase: ${SUPABASE_URL}`);
  console.log("==========================================================\n");

  // 1. Busca todos os usuários cadastrados na tabela pública
  const { data: users, error: fetchError } = await supabaseAdmin
    .from("Tb_Users")
    .select("*");

  if (fetchError) {
    console.error("❌ Erro ao consultar a tabela Tb_Users:", fetchError.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("ℹ️ Nenhum usuário encontrado na tabela Tb_Users.");
    return;
  }

  console.log(`📋 Total de usuários encontrados na Tb_Users: ${users.length}\n`);

  let createdCount = 0;
  let linkedExistingCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const rawEmail = user.email || user.EMAIL || "";
    const email = String(rawEmail).trim().toLowerCase();
    const rawSenha = user.senha || user.SENHA;
    const userId = user.id;

    if (!email) {
      console.warn(`⚠️ Registro ID ${userId} ignorado: e-mail inválido ou em branco.`);
      errorCount++;
      continue;
    }

    // Se a senha estiver vazia ou for um marcador genérico, gera senha padrão segura de contingência
    let password = rawSenha;
    if (!password || password.trim() === "" || password === "OAuth/SupabaseAuthSecure") {
      password = `Mudar@${Math.floor(100000 + Math.random() * 900000)}`;
      console.log(`🔑 Usuário [${email}] sem senha válida. Atribuída senha temporária: ${password}`);
    }

    try {
      let authUserId: string | null = null;

      // 2. Criação silenciosa no Supabase Auth com email confirmado
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome: user.nome || "",
          sobrenome: user.sobrenome || "",
          nivel: user.nivel || "Assistente"
        }
      });

      if (createError) {
        // Trata caso o usuário já exista no auth.users
        if (createError.message.toLowerCase().includes("already") || createError.message.toLowerCase().includes("exists")) {
          console.log(`🔄 Usuário [${email}] já existia no Auth. Recuperando UUID...`);
          
          // Busca o usuário existente na listagem de usuários do Auth
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) {
            console.error(`❌ Erro ao listar usuários do Auth para vincular [${email}]:`, listError.message);
            errorCount++;
            continue;
          }

          const existingAuthUser = (listData?.users || []).find(
            (u: any) => (u.email || "").toLowerCase() === email
          );

          if (existingAuthUser) {
            authUserId = existingAuthUser.id;
            linkedExistingCount++;
          } else {
            console.error(`❌ Falha ao localizar UUID existente de [${email}].`);
            errorCount++;
            continue;
          }
        } else {
          console.error(`❌ Erro ao criar [${email}] no Supabase Auth:`, createError.message);
          errorCount++;
          continue;
        }
      } else if (createData?.user) {
        authUserId = createData.user.id;
        createdCount++;
        console.log(`✅ Usuário [${email}] criado no Auth com sucesso! (UUID: ${authUserId})`);
      }

      // 3. Atualiza o registro em Tb_Users com o auth_id gerado
      if (authUserId) {
        const { error: updateError } = await supabaseAdmin
          .from("Tb_Users")
          .update({ auth_id: authUserId })
          .eq("id", userId);

        if (updateError) {
          console.error(`⚠️ Erro ao atualizar auth_id na Tb_Users para [${email}]:`, updateError.message);
          errorCount++;
        } else {
          console.log(`🔗 Perfil Tb_Users (ID: ${userId}) vinculado ao auth_id: ${authUserId}`);
        }
      }
    } catch (err: any) {
      console.error(`💥 Exceção ao processar [${email}]:`, err.message || err);
      errorCount++;
    }
  }

  console.log("\n==========================================================");
  console.log("📊 RESUMO DA MIGRAÇÃO:");
  console.log(`   - Novos usuários criados no Auth: ${createdCount}`);
  console.log(`   - Usuários já existentes vinculados: ${linkedExistingCount}`);
  console.log(`   - Falhas/Erros: ${errorCount}`);
  console.log("==========================================================\n");
  console.log("Próximo passo de segurança:");
  console.log("Execute o script SQL para remover a coluna 'senha' da tabela Tb_Users:");
  console.log("ALTER TABLE \"Tb_Users\" DROP COLUMN IF EXISTS senha;\n");
}

migrateUsers().catch((err) => {
  console.error("Erro fatal na execução da migração:", err);
  process.exit(1);
});
