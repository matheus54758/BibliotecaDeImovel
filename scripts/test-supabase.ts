import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function testConnection() {
  console.log('🚀 Iniciando teste de conexão CLI...');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados no .env.local');
    process.exit(1);
  }

  console.log(`🔗 Conectando a: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Test auth session
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('❌ Erro na Auth:', authError.message);
    } else {
      console.log('✅ Conexão com Auth API: OK');
    }

    // Test database access (select from a public table)
    const { data: dbData, error: dbError } = await supabase
      .from('builders')
      .select('count')
      .limit(1);

    if (dbError) {
      // Se a tabela não existir ainda ou der erro de permissão
      console.log('⚠️  Aviso na Database:', dbError.message);
      console.log('   (Isso pode ser normal se o RLS estiver ativo ou a tabela estiver vazia)');
    } else {
      console.log('✅ Conexão com Database: OK');
    }

    console.log('\n✨ Teste concluído!');
  } catch (err: any) {
    console.error('💥 Erro fatal:', err.message);
    process.exit(1);
  }
}

testConnection();
