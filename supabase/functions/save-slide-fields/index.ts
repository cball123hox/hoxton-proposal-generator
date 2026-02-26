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

    // ── Auth: verify the caller is a logged-in system_admin ──

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
      console.error("[save-slide-fields] Auth failed:", authError?.message)
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    // Service-role client — bypasses RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Verify role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "system_admin") {
      return jsonResponse({ error: "Forbidden — system_admin role required" }, 403)
    }

    // ── Parse body ──

    const body = await req.json()
    const { slideType, slideId, editableFields, parentId, slideNumber, imagePath } = body

    console.log("[save-slide-fields] Request:", JSON.stringify({ slideType, slideId, parentId, slideNumber, fieldCount: editableFields?.length }))

    if (!slideType || !["intro", "product", "closing"].includes(slideType)) {
      return jsonResponse({ error: "slideType must be 'intro', 'product', or 'closing'" }, 400)
    }

    if (!Array.isArray(editableFields)) {
      return jsonResponse({ error: "editableFields must be an array" }, 400)
    }

    const tableMap: Record<string, string> = {
      intro: "intro_slides",
      product: "product_slides",
      closing: "closing_slides",
    }
    const parentKeyMap: Record<string, string> = {
      intro: "intro_pack_id",
      product: "module_id",
      closing: "closing_pack_id",
    }
    const table = tableMap[slideType]
    const parentKey = parentKeyMap[slideType]
    const slideTypeValue = editableFields.length > 0 ? "editable" : "static"

    // ── Save ──

    if (slideId) {
      // UPDATE existing row by explicit ID
      console.log(`[save-slide-fields] UPDATE ${table} SET editable_fields (${editableFields.length} fields) WHERE id = ${slideId}`)

      const { data, error } = await supabase
        .from(table)
        .update({ editable_fields: editableFields, slide_type: slideTypeValue })
        .eq("id", slideId)
        .select("*")
        .single()

      if (error) {
        console.error(`[save-slide-fields] UPDATE error:`, error)
        return jsonResponse({ error: error.message, code: error.code }, 500)
      }

      console.log(`[save-slide-fields] UPDATE success — id: ${data.id}, fields: ${Array.isArray(data.editable_fields) ? data.editable_fields.length : 'N/A'}`)
      return jsonResponse({ data })
    }

    // ── No slideId — find existing row by parent + slide_number, or INSERT ──

    if (!parentId || !slideNumber) {
      return jsonResponse({ error: "parentId and slideNumber required when slideId is null" }, 400)
    }

    // Check for existing rows (may have duplicates from the INSERT bug)
    const { data: existingRows, error: findErr } = await supabase
      .from(table)
      .select("id, created_at")
      .eq(parentKey, parentId)
      .eq("slide_number", slideNumber)
      .order("created_at", { ascending: true })

    if (findErr) {
      console.error(`[save-slide-fields] Find existing error:`, findErr)
    }

    if (existingRows && existingRows.length > 0) {
      // Row(s) already exist — clean up duplicates and UPDATE the oldest one
      const keepId = existingRows[0].id

      if (existingRows.length > 1) {
        const dupeIds = existingRows.slice(1).map((r: { id: string }) => r.id)
        console.log(`[save-slide-fields] Cleaning up ${dupeIds.length} duplicate rows for ${parentKey}=${parentId}, slide_number=${slideNumber}`)
        await supabase.from(table).delete().in("id", dupeIds)
      }

      console.log(`[save-slide-fields] UPDATE existing row ${keepId} (found via ${parentKey}=${parentId}, slide_number=${slideNumber})`)

      const { data, error } = await supabase
        .from(table)
        .update({ editable_fields: editableFields, slide_type: slideTypeValue })
        .eq("id", keepId)
        .select("*")
        .single()

      if (error) {
        console.error(`[save-slide-fields] UPDATE (by lookup) error:`, error)
        return jsonResponse({ error: error.message, code: error.code }, 500)
      }

      console.log(`[save-slide-fields] UPDATE success — id: ${data.id}, fields: ${Array.isArray(data.editable_fields) ? data.editable_fields.length : 'N/A'}`)
      return jsonResponse({ data })
    }

    // No existing row — INSERT
    const insertPayload = {
      [parentKey]: parentId,
      slide_number: slideNumber,
      title: `Slide ${slideNumber}`,
      slide_type: slideTypeValue,
      image_path: imagePath || "",
      editable_fields: editableFields,
    }

    console.log(`[save-slide-fields] INSERT into ${table}:`, JSON.stringify(insertPayload))

    const { data, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select("*")
      .single()

    if (error) {
      console.error(`[save-slide-fields] INSERT error:`, error)
      return jsonResponse({ error: error.message, code: error.code }, 500)
    }

    console.log(`[save-slide-fields] INSERT success — id: ${data.id}`)
    return jsonResponse({ data })
  } catch (err) {
    console.error("[save-slide-fields] Exception:", err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
