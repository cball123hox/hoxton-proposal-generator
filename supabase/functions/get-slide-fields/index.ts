import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405)
    }

    // ── Auth: verify caller is logged in ──

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401)
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      console.error("[get-slide-fields] Auth failed:", authError?.message)
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    // Service-role client — bypasses RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // ── Parse body ──

    const body = await req.json()
    const { slideType, parentId } = body

    if (!slideType || !["intro", "product"].includes(slideType)) {
      return jsonResponse({ error: "slideType must be 'intro' or 'product'" }, 400)
    }

    if (!parentId) {
      return jsonResponse({ error: "parentId is required" }, 400)
    }

    const table = slideType === "intro" ? "intro_slides" : "product_slides"
    const parentKey = slideType === "intro" ? "intro_pack_id" : "module_id"

    // ── Query ──

    const { data: slides, error } = await supabase
      .from(table)
      .select("*")
      .eq(parentKey, parentId)
      .order("slide_number")

    if (error) {
      console.error(`[get-slide-fields] SELECT error:`, error)
      return jsonResponse({ error: error.message }, 500)
    }

    console.log(`[get-slide-fields] Returned ${(slides || []).length} slides from ${table} for ${parentKey}=${parentId}`)

    return jsonResponse({ slides: slides || [] })
  } catch (err) {
    console.error("[get-slide-fields] Exception:", err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
