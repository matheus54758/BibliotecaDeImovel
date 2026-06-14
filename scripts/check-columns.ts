
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function checkColumns() {
  const { data, error } = await supabase.from('developments').select('*').limit(1);
  
  if (error) {
    console.error("Error fetching developments:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Existing columns in 'developments':");
    console.log(Object.keys(data[0]));
  } else {
    console.log("No developments found to check columns.");
  }
}

checkColumns();
