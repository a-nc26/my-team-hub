import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic()

/**
 * POST /api/n8n/slack-project-sync
 *
 * Analyzes Slack messages and returns a digest for review (analyst updates,
 * project updates, flags, todos). No auto-applying — everything goes through
 * the UI review modal.
 *
 * Body: { messages: string | string[], channel?: string }
 * Optional header: x-api-key (matches N8N_API_KEY env var if set)
 *
 * Returns: { ok, digest: { analystUpdates, projectUpdates, flags, todos } }
 */
export async function POST(req) {
  try {
    // Optional API key auth
    const apiKey = req.headers.get('x-api-key')
    if (process.env.N8N_API_KEY && apiKey !== process.env.N8N_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const rawMessages = Array.isArray(body.messages)
      ? body.messages.join('\n\n---\n\n')
      : (body.messages || '')

    if (!rawMessages.trim()) {
      return NextResponse.json({ ok: true, digest: { analystUpdates: [], projectUpdates: [], flags: [], todos: [] } })
    }

    // Fetch current projects for context
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const projectContext = projects.length > 0
      ? projects.map(p => `- "${p.name}" | status: ${p.status} | id: ${p.id}`).join('\n')
      : '(no projects yet)'

    const today = new Date().toISOString().slice(0, 10)

    // Fetch team members for context
    const teamMembers = await prisma.analyst.findMany({
      select: { id: true, name: true },
      where: { pending: false },
    })
    const analystContext = teamMembers.length > 0
      ? teamMembers.map(a => `- "${a.name}" [id:${a.id}]`).join('\n')
      : '(none)'

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: `You analyze Slack messages to extract actionable updates for a Trust & Safety team lead.
Today: ${today}

Current projects:
${projectContext}

Team members:
${analystContext}

IMPORTANT: Messages may contain unresolved Slack user IDs (e.g. "U08PK6H44D6:") where the name lookup failed.
Try to match them to team members by context clues — what projects they mention, their writing style, or if their name appears elsewhere.

Extract everything work-relevant from the messages. Be thorough.

Return ONLY a valid JSON object with these four arrays:
{
  "analystUpdates": [
    {
      "name": "<analyst name, best match from team list>",
      "id": "<matched analyst id or null>",
      "mood": "h | m | l | null",
      "note": "<concise 1-2 sentence summary of what's notable>"
    }
  ],
  "projectUpdates": [
    {
      "name": "<project name>",
      "id": "<matched project id or null>",
      "status": "<active | review | blocked | hold | done | null>",
      "note": "<concise 1-2 sentence update>"
    }
  ],
  "flags": [
    { "text": "<concern, blocker, or risk the team lead needs to know>", "analystId": "<analyst id if linked, else null>" }
  ],
  "todos": [
    "<specific action the team lead should take>"
  ]
}

Rules:
- analystUpdates: someone shares their work status, is OOO, expresses difficulty, or has mood-relevant signal (burnout, excitement, frustration, achievement)
- mood "h" = thriving/positive/energised, "m" = steady/neutral, "l" = struggling/blocked/stressed
- projectUpdates: any project progress, milestone, completion, or blocker mentioned
- flags: blockers, risks, or interpersonal concerns requiring team lead attention
- todos: concrete actions the team lead should take based on the messages
- Return empty arrays [] for sections with nothing relevant — don't invent things
- Match project names loosely (e.g. "Agents Debate" matches "Agentic Debates Pilot")
- Only include what's genuinely useful — skip pure social chat`,
      messages: [{
        role: 'user',
        content: `Slack messages from #${body.channel || 'general'}:\n\n${rawMessages}`,
      }],
    })

    const text = response.content.find(b => b.type === 'text')?.text || '{}'
    let digest = { analystUpdates: [], projectUpdates: [], flags: [], todos: [] }
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      digest = {
        analystUpdates: parsed.analystUpdates || [],
        projectUpdates: parsed.projectUpdates || [],
        flags:          (parsed.flags || []).map(f => typeof f === 'string' ? { text: f, analystId: null } : f),
        todos:          parsed.todos || [],
      }
    } catch {
      // keep empty digest on parse failure
    }

    const total = digest.analystUpdates.length + digest.projectUpdates.length + digest.flags.length + digest.todos.length

    return NextResponse.json({ ok: true, digest, total })
  } catch (e) {
    console.error('[slack-project-sync]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
