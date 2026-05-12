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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `You analyze Slack messages to extract project-relevant updates for a Trust & Safety team.
Today: ${today}

Current projects:
${projectContext}

Extract only items that clearly relate to work progress: blockers, status changes, milestones reached, deadlines mentioned, or meaningful updates.
Ignore casual conversation, off-topic messages, and social messages.

Return ONLY a valid JSON array with this shape:
[{
  "projectId": "<id from list above, or null if unknown/new>",
  "projectName": "<matched or inferred name>",
  "type": "update|status|milestone|new",
  "content": "<concise summary of the update, 1-2 sentences>",
  "confidence": <0.0 to 1.0>,
  "suggestedStatus": "<active|review|blocked|hold|done, only for type=status>"
}]

Types:
- update: progress note to log
- status: project status changed (include suggestedStatus)
- milestone: a checkpoint was reached
- new: a brand new project was mentioned

Only include items with confidence >= 0.6. Return [] if nothing relevant.`,
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
