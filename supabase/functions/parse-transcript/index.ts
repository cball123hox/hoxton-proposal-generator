import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  console.log("Function invoked:", req.method, req.url)

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.error("No Authorization header")
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Auth verification failed:", authError?.message)
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Authenticated user:", user.id)

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not set")
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()
    const transcript = body?.transcript

    if (!transcript || typeof transcript !== "string") {
      return new Response(
        JSON.stringify({ error: "transcript is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Transcript received:", transcript.length, "characters")

    if (transcript.length > 50_000) {
      return new Response(
        JSON.stringify({ error: "transcript must be under 50,000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const systemPrompt = `You are a financial planning assistant for Hoxton Wealth. Given the following call transcript between a Hoxton advisor and a client, extract the following in professional, client-facing language written from the adviser's perspective to the client (as if the adviser is speaking directly to the client using 'you' and 'your'):

1. CURRENT SITUATION: A 2-4 sentence summary of the client's current financial position, life stage, and relevant circumstances. Write as if the adviser is summarising back to the client what was discussed.

2. MAIN OBJECTIVES: 3-5 bullet points describing the client's key financial goals and priorities. Write as 'you' statements from the adviser's perspective.

3. FOCUS AREAS: Bullet points listing the specific product areas or solutions to explore based on the conversation.

Keep language professional, clear, and suitable for a client-facing proposal. Do not include speculative advice or recommendations not discussed in the transcript.

Respond ONLY with valid JSON in this exact format:
{
  "situation": "...",
  "objectives": "...",
  "focus": "..."
}`

    console.log("Calling Anthropic API...")

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here is the call transcript to parse:\n\n${transcript}`,
          },
        ],
      }),
    })

    console.log("Anthropic response received:", anthropicRes.status)

    if (!anthropicRes.ok) {
      const errorBody = await anthropicRes.text()
      console.error("Anthropic API error:", anthropicRes.status, errorBody)
      let detail = `Anthropic API returned status ${anthropicRes.status}`
      try {
        const errJson = JSON.parse(errorBody)
        detail = errJson?.error?.message || detail
      } catch (_e) {
        // Not JSON
      }
      return new Response(
        JSON.stringify({ error: detail }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const anthropicData = await anthropicRes.json()
    const textContent = anthropicData.content?.find(
      (block: { type: string }) => block.type === "text"
    )

    if (!textContent?.text) {
      console.error("No text in Anthropic response:", JSON.stringify(anthropicData))
      return new Response(
        JSON.stringify({ error: "No text response from AI" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Parsing AI response...")

    // Parse the JSON from Claude's response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response as JSON", raw: textContent.text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.situation || !parsed.objectives || !parsed.focus) {
      return new Response(
        JSON.stringify({ error: "AI response missing required fields", raw: parsed }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Success — returning parsed context")

    return new Response(
      JSON.stringify({
        situation: parsed.situation,
        objectives: parsed.objectives,
        focus: parsed.focus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("parse-transcript error:", err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
