import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// service_role キーで動作する管理用クライアント。
// RLS を bypass するため、必ずサーバーサイド（Route Handler）からのみ使用すること。
// クライアントコンポーネントから import してはいけない。
let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return client
}
