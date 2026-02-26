import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const { token, session_token } = await req.json()

    if (!token || !session_token) {
      return jsonResponse({ error: "Token and session_token required" }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Look up the link
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("proposal_links")
      .select("id, proposal_id, allow_download, is_active, expires_at, recipient_name, recipient_email")
      .eq("token", token)
      .single()

    if (linkErr || !link) {
      return jsonResponse({ error: "Invalid link" }, 404)
    }

    if (!link.is_active) {
      return jsonResponse({ error: "Link has been revoked" }, 403)
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return jsonResponse({ error: "Link has expired" }, 403)
    }

    if (!link.allow_download) {
      return jsonResponse({ error: "Download not permitted for this link" }, 403)
    }

    // Validate session token
    const { data: otp } = await supabaseAdmin
      .from("link_otps")
      .select("session_expires_at")
      .eq("link_id", link.id)
      .eq("session_token", session_token)
      .eq("is_used", true)
      .gte("session_expires_at", new Date().toISOString())
      .limit(1)
      .single()

    if (!otp) {
      return jsonResponse({ error: "Invalid or expired session" }, 401)
    }

    // Get the proposal's pdf_path
    const { data: proposal } = await supabaseAdmin
      .from("proposals")
      .select("pdf_path, client_name")
      .eq("id", link.proposal_id)
      .single()

    if (!proposal?.pdf_path) {
      return jsonResponse({ error: "No PDF available for this proposal" }, 404)
    }

    // Generate signed URL using service role (1 hour expiry)
    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from("proposals")
      .createSignedUrl(proposal.pdf_path, 3600)

    if (signErr || !signedData?.signedUrl) {
      console.error("Signed URL error:", signErr)
      return jsonResponse({ error: "Failed to generate download URL" }, 500)
    }

    // Log 'downloaded' proposal event
    await supabaseAdmin.from("proposal_events").insert({
      proposal_id: link.proposal_id,
      event_type: "downloaded",
      event_data: {
        recipient_name: link.recipient_name,
        recipient_email: link.recipient_email,
      },
    }).then(() => {}, () => {}) // fire-and-forget

    return jsonResponse({
      url: signedData.signedUrl,
      filename: `${(proposal.client_name || "proposal").replace(/[^a-zA-Z0-9\-_]/g, "_")}.pdf`,
    })
  } catch (err) {
    console.error("Edge function error:", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
