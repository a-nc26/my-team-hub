import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic()

/**
 * POST /api/n8n/slack-project-sync
 *
 * Called by n8n at end-of-day (or on demand) with Slack messages.
 * Analyzes messages for project-relevant content and:
 *   - Auto-applies high-confidence (≥0.9) updates directly as project notes
 *   - Stores lower-confidence suggestions for manual review in the app
 *
 * Body: { messages: string | string[], channel?: string }
 * Optional header: x-api-key (matches N8N_API_KEY env var if set)
 *
 * Returns: { ok, analyzed, applied, pending, suggestions }
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
      return NextResponse.json({ ok: true, analyzed: 0, applied: 0, pending: 0, suggestions: [] })
    }

    // Fetch current projects for context
    const projects = await prisma.project.findMany({
      include: {
        milestones:   { orderBy: { dueDate: 'asc' } },
        projectNotes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })

    const projectContext = projects.length > 0
      ? projects.map(p => `- "${p.name}" | status: ${p.status} | id: ${p.id}`).join('\n')
      : '(no projects yet)'

    const today = new Date().toISOString().slice(0, 10)

    // Fetch team members for analyst context
    const teamMembers = await prisma.analyst.findMany({ select: { id: true, name: true }, where: { pending: false } })
    const analystContext = teamMembers.length > 0
      ? teamMembers.map(a => `- "${a.name}" [id:${a.id}]`).join('\n')
      : '(none)'

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: `You analyze Slack messages to extract actionable updates for a Trust & Safety team lead.
Today: ${today}

Current projects:
${projectContext}

Team members:
${analystContext}

Extract items that are clearly work-relevant: progress updates, blockers, status changes, milestones reached, or team member status (absent, done with something, blocked).
Ignore purely social messages and off-topic conversation.

Return ONLY a valid JSON array:
[{
  "relatedTo": "project" | "analyst",
  "projectId": "<matched project id or null>",
  "projectName": "<matched project name or null>",
  "analystId": "<matched analyst id or null>",
  "analystName": "<analyst name or null>",
  "type": "update" | "status" | "milestone" | "new" | "analyst",
  "content": "<concise 1-2 sentence summary>",
  "confidence": <0.6–1.0>,
  "suggestedStatus": "<active|review|blocked|hold|done, only when type=status>"
}]

- relatedTo="analyst" when primarily about a person (absent, done with personal task, availability)
- relatedTo="project" for project progress, blockers, status changes
- Match by name similarity
- Only include confidence >= 0.6. Return [] if nothing relevant.`,
      messages: [{
        role: 'user',
        content: `Slack messages from #${body.channel || 'general'}:\n\n${rawMessages}`,
      }],
    })

    const text = response.content.find(b => b.type === 'text')?.text || '[]'
    let suggestions = []
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      suggestions = JSON.parse(cleaned)
      if (!Array.isArray(suggestions)) suggestions = []
    } catch {
      suggestions = []
    }

    // Auto-apply high-confidence items (>=0.9) with a known project
    const applied = []
    for (const s of suggestions) {
      if (s.confidence < 0.9 || !s.projectId) continue
      try {
        if (s.type === 'update' || s.type === 'milestone') {
          await prisma.projectNote.create({
            data: {
              projectId: s.projectId,
              text: `[Slack] ${s.content}`,
              mentionedAnalystIds: [],
            },
          })
          applied.push(s)
        } else if (s.type === 'status' && s.suggestedStatus) {
          await prisma.project.update({
            where: { id: s.projectId },
            data: { status: s.suggestedStatus, updatedAt: new Date() },
          })
          applied.push(s)
        }
      } catch (err) {
        console.error('[slack-sync] auto-apply failed:', err.message)
      }
    }

    // Store pending (lower-confidence) suggestions for the UI
    const pending = suggestions.filter(s => !applied.includes(s))
    if (pending.length > 0) {
      await prisma.settings.upsert({
        where:  { key: 'slack_suggestions' },
        update: { value: JSON.stringify({ date: today, channel: body.channel, items: pending }) },
        create: { key: 'slack_suggestions', value: JSON.stringify({ date: today, channel: body.channel, items: pending }) },
      })
    }

    return NextResponse.json({
      ok: true,
      analyzed: suggestions.length,
      applied:  applied.length,
      pending:  pending.length,
      suggestions,
    })
  } catch (e) {
    console.error('[slack-project-sync]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
