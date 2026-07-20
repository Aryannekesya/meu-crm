import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rtzvognftifjxugmurlf.supabase.co'
const supabaseKey = 'sb_publishable_-AMh8xP7A1Ysq7gAwdioSw_o5Z6Zx_s'

export const supabase = createClient(supabaseUrl, supabaseKey)