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

/** SHA-256 hash a string, return hex */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Generate a random 6-digit code */
function generateOtpCode(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(arr[0] % 1000000).padStart(6, "0")
}

/** Send OTP email via Resend API (falls back to console.log) */
async function sendOtpEmail(
  to: string,
  code: string,
  clientName: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f7f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#033839;padding:28px 32px;text-align:center;">
          <img src="https://www.hoxtonwealth.com/wp-content/themes/developer/assets/img/hoxton-wealth-logo.svg" alt="Hoxton Wealth" height="32" style="height:32px;" />
        </td></tr>
        <tr><td style="padding:36px 32px 16px;">
          <h1 style="margin:0 0 8px;font-size:22px;color:#033839;font-weight:600;">Your verification code</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#527C7E;line-height:1.5;">
            Enter this code to view the proposal for <strong>${clientName}</strong>.
          </p>
          <div style="background:#f0f7f6;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#033839;font-family:'Courier New',monospace;">${code}</span>
          </div>
          <p style="margin:0;font-size:13px;color:#527C7E;line-height:1.5;">
            This code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #D7E5E3;">
          <p style="margin:0;font-size:12px;color:#527C7E;text-align:center;">
            Hoxton Wealth &mdash; Trusted financial advice, worldwide.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!resendApiKey) {
    console.log(`[OTP FALLBACK] Code for ${to}: ${code}`)
    return true
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hoxton Wealth <proposals@notifications.hoxtonwealth.com>",
        to: [to],
        subject: `Your verification code for ${clientName}'s proposal`,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`Resend API error: ${res.status} ${err}`)
      // Fall back to logging
      console.log(`[OTP FALLBACK] Code for ${to}: ${code}`)
    }

    return true
  } catch (err) {
    console.error("Email send failed:", err)
    console.log(`[OTP FALLBACK] Code for ${to}: ${code}`)
    return true
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const { action, token, code, session_token } = await req.json()

    // Use service role to bypass RLS for lookups
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // ── SEND OTP ──
    if (action === "send_otp") {
      if (!token) {
        return jsonResponse({ error: "Token required" }, 400)
      }

      // Look up the link
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("proposal_links")
        .select(
          "id, proposal_id, recipient_email, recipient_name, is_active, expires_at"
        )
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

      // Rate limit: max 10 OTPs per link per hour (tighten to 3-5 for production)
      const oneHourAgo = new Date(
        Date.now() - 60 * 60 * 1000
      ).toISOString()
      const { count: recentCount } = await supabaseAdmin
        .from("link_otps")
        .select("id", { count: "exact", head: true })
        .eq("link_id", link.id)
        .gte("created_at", oneHourAgo)

      if (recentCount !== null && recentCount >= 10) {
        return jsonResponse(
          { error: "Too many code requests. Please try again later." },
          429
        )
      }

      // Get client name for the email
      const { data: proposal } = await supabaseAdmin
        .from("proposals")
        .select("client_name")
        .eq("id", link.proposal_id)
        .single()

      const clientName = proposal?.client_name || "your adviser"

      // Generate and hash OTP
      const otpCode = generateOtpCode()
      const hashedCode = await sha256(otpCode)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      // Store hashed OTP
      const { error: insertErr } = await supabaseAdmin
        .from("link_otps")
        .insert({
          link_id: link.id,
          code: hashedCode,
          expires_at: expiresAt,
        })

      if (insertErr) {
        console.error("Insert OTP error:", insertErr)
        return jsonResponse({ error: "Failed to generate code" }, 500)
      }

      // Send email
      await sendOtpEmail(link.recipient_email, otpCode, clientName)

      return jsonResponse({ success: true, expires_in: 600 })
    }

    // ── VERIFY OTP ──
    if (action === "verify_otp") {
      if (!token || !code) {
        return jsonResponse({ error: "Token and code required" }, 400)
      }

      // Look up link
      const { data: link } = await supabaseAdmin
        .from("proposal_links")
        .select("id")
        .eq("token", token)
        .single()

      if (!link) {
        return jsonResponse({ error: "Invalid link" }, 404)
      }

      // Find the latest unused, non-expired OTP for this link
      const { data: otp } = await supabaseAdmin
        .from("link_otps")
        .select("*")
        .eq("link_id", link.id)
        .eq("is_used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (!otp) {
        return jsonResponse(
          {
            verified: false,
            error: "Code expired. Please request a new one.",
          },
          200
        )
      }

      // Check max attempts
      if (otp.attempts >= 5) {
        return jsonResponse(
          {
            verified: false,
            error: "Too many failed attempts. Please request a new code.",
          },
          200
        )
      }

      // Compare hashed code
      const hashedInput = await sha256(code)

      if (hashedInput !== otp.code) {
        // Increment attempts
        await supabaseAdmin
          .from("link_otps")
          .update({ attempts: otp.attempts + 1 })
          .eq("id", otp.id)

        const remaining = 4 - otp.attempts // 5 max, 0-indexed after this attempt
        return jsonResponse({
          verified: false,
          error: "Invalid code. Please try again.",
          attempts_remaining: Math.max(remaining, 0),
        })
      }

      // Success — generate session token
      const sessionToken = crypto.randomUUID()
      const sessionExpiresAt = new Date(
        Date.now() + 2 * 60 * 60 * 1000
      ).toISOString()

      await supabaseAdmin
        .from("link_otps")
        .update({
          is_used: true,
          session_token: sessionToken,
          session_expires_at: sessionExpiresAt,
        })
        .eq("id", otp.id)

      return jsonResponse({
        verified: true,
        session_token: sessionToken,
        expires_at: sessionExpiresAt,
      })
    }

    // ── VALIDATE SESSION ──
    if (action === "validate_session") {
      if (!token || !session_token) {
        return jsonResponse({ valid: false })
      }

      // Look up link
      const { data: link } = await supabaseAdmin
        .from("proposal_links")
        .select("id")
        .eq("token", token)
        .single()

      if (!link) {
        return jsonResponse({ valid: false })
      }

      // Check for valid session
      const { data: otp } = await supabaseAdmin
        .from("link_otps")
        .select("session_expires_at")
        .eq("link_id", link.id)
        .eq("session_token", session_token)
        .eq("is_used", true)
        .gte("session_expires_at", new Date().toISOString())
        .limit(1)
        .single()

      return jsonResponse({ valid: !!otp })
    }

    return jsonResponse({ error: "Invalid action" }, 400)
  } catch (err) {
    console.error("Edge function error:", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
