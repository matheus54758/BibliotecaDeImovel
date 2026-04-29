
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function findConflict() {
  const { data: devs } = await supabase.from('developments').select('id, title').limit(1)
  if (!devs || devs.length === 0) {
    console.log("Nenhum imóvel encontrado para testar.");
    return;
  }

  const id = devs[0].id;
  console.log(`Testando exclusão do imóvel: ${devs[0].title} (${id})`);

  const { error } = await supabase.from('developments').delete().eq('id', id);

  if (error) {
    console.log("❌ ERRO DETALHADO:");
    console.log("Mensagem:", error.message);
    console.log("Detalhe:", error.details);
    console.log("Dica (Hint):", error.hint);
    console.log("Código:", error.code);
  } else {
    console.log("✅ Excluído com sucesso via script (estranho, no navegador falhou).");
  }
}

findConflict()
