import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured — add it to .env.local' },
      { status: 503 }
    )
  }
  try {
    const body = await req.json()
    const { transcript, teamSnapshot } = body
    const client = new Anthropic({ apiKey: key })

    const prompt = `You are a management assistant helping a team manager extract structured insights from meeting notes.

CURRENT TEAM STATE:
${teamSnapshot}

MEETING TRANSCRIPT/NOTES:
"${transcript}"

Extract updates in this exact JSON format. Return ONLY valid JSON, no markdown fences, no explanation:
{
  "analystUpdates": [
    { "id": "analyst_id", "name": "first name only", "note": "1-2 sentence summary", "mood": "h|m|l|null" }
  ],
  "projectUpdates": [
    { "id": "project_id_or_null", "name": "project name", "status": "active|review|done|blocked|null", "note": "what was said" }
  ],
  "flags": ["urgent thing 1", "urgent thing 2"],
  "todos": ["action item 1", "action item 2"]
}

Rules:
- Only include entries where you found clear signal in the transcript
- analystUpdates: only include analysts explicitly mentioned; use their id from the team state if available
- mood: h=positive/energized/progress, l=stressed/blocked/struggling, null=neutral or unclear
- flags: urgent things the manager needs to know (someone leaving, deadline at risk, conflict)
- todos: clear action items for the manager specifically
- If nothing found for a category, return an empty array`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    let raw = response.content[0].text.trim()
    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
