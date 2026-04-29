
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugDelete() {
  console.log('Searching for development "Tapes"...')
  const { data: devs, error: findError } = await supabase
    .from('developments')
    .select('id, title')
    .ilike('title', '%Tapes%')

  if (findError) {
    console.error('Error finding dev:', findError)
    return
  }

  if (!devs || devs.length === 0) {
    console.log('Development "Tapes" not found.')
    return
  }

  const id = devs[0].id
  console.log(`Found "Tapes" with ID: ${id}`)

  console.log('Attempting to delete related images...')
  const { error: imgError } = await supabase.from('development_images').delete().eq('development_id', id)
  if (imgError) console.error('Error deleting images:', imgError)
  else console.log('Images deleted (or none existed).')

  console.log('Attempting to delete related amenities...')
  const { error: amenError } = await supabase.from('amenities').delete().eq('development_id', id)
  if (amenError) console.error('Error deleting amenities:', amenError)
  else console.log('Amenities deleted (or none existed).')

  console.log('Attempting to delete development...')
  const { error: devError } = await supabase.from('developments').delete().eq('id', id)
  
  if (devError) {
    console.error('❌ FAILED TO DELETE DEVELOPMENT:', devError)
    console.error('Status:', devError.code)
    console.error('Message:', devError.message)
    console.error('Hint:', devError.hint)
  } else {
    console.log('✅ SUCCESSFULLY DELETED "Tapes"')
  }
}

debugDelete()
