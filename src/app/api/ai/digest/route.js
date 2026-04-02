import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

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
    const { transcript } = body

    // Fetch full context from DB server-side
    const [analysts, projects, meetings, todos] = await Promise.all([
      prisma.analyst.findMany({
        include: {
          notes: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.project.findMany({
        include: { analysts: { include: { analyst: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.meeting.findMany({
        include: { analysts: { include: { analyst: true } } },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      prisma.todo.findMany({
        where: { done: false },
        include: { analyst: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Build rich context string
    const analystContext = analysts.map(a => {
      const recentNotes = a.notes.map(n =>
        `    [${new Date(n.createdAt).toLocaleDateString()}] (${n.mood === 'h' ? 'positive' : n.mood === 'l' ? 'concern' : 'neutral'}${n.source === 'digest' ? ', from meeting' : ''}): ${n.text}`
      ).join('\n')
      return `- ${a.name} (id:${a.id}, ${a.role}, mood:${a.mood === 'h' ? 'Thriving' : a.mood === 'l' ? 'Needs Attention' : 'Steady'})${a.pending ? ' [PENDING - not started yet]' : ''}${recentNotes ? '\n  Recent notes:\n' + recentNotes : ''}`
    }).join('\n')

    const projectContext = projects.map(p => {
      const names = p.analysts.map(pa => pa.analyst?.name).filter(Boolean).join(', ')
      return `- ${p.name} (id:${p.id}, type:${p.type}, status:${p.status})${names ? ' — ' + names : ''}${p.notes ? '\n  Notes: ' + p.notes.slice(0, 200) : ''}`
    }).join('\n')

    const meetingContext = meetings.slice(0, 15).map(m => {
      const names = m.analysts.map(ma => ma.analyst?.name).filter(Boolean).join(', ')
      return `- [${new Date(m.date).toLocaleDateString()}] "${m.title}"${names ? ' (with: ' + names + ')' : ''}: ${m.notes?.slice(0, 300) || ''}...`
    }).join('\n')

    const todoContext = todos.map(t =>
      `- ${t.text}${t.analyst ? ' [re: ' + t.analyst.name + ']' : ''} (${t.priority} priority)`
    ).join('\n')

    const fullContext = `
TEAM MEMBERS:
${analystContext || 'None'}

PROJECTS:
${projectContext || 'None'}

RECENT MEETING HISTORY (last 15):
${meetingContext || 'No meetings yet'}

OPEN ACTION ITEMS:
${todoContext || 'None'}
`.trim()

    const client = new Anthropic({ apiKey: key })

    const prompt = `You are a management assistant helping a team manager extract structured insights from a meeting.

You have full context of the team's history below. Use it to:
- Recognize patterns (e.g. someone has been blocked for multiple meetings)
- Connect action items to previous commitments
- Reference relevant project context
- Notice when something contradicts or follows up on previous notes

FULL TEAM CONTEXT:
${fullContext}

NEW MEETING TRANSCRIPT/NOTES:
"${transcript}"

Extract updates in this exact JSON format. Return ONLY valid JSON, no markdown fences, no explanation:
{
  "analystUpdates": [
    { "id": "analyst_id_from_context", "name": "first name only", "note": "1-2 sentence summary referencing any relevant history", "mood": "h|m|l|null" }
  ],
  "projectUpdates": [
    { "id": "project_id_from_context_or_null", "name": "project name", "status": "active|review|done|blocked|null", "note": "what was said, noting any status changes" }
  ],
  "flags": ["urgent things the manager needs to know — especially if this is a recurring issue"],
  "todos": ["clear action items for the manager, noting if this was previously raised"]
}

Rules:
- Only include entries where you found clear signal in the transcript
- Use the analyst/project ids from the context above when you can match them
- mood: h=positive/energised/progress, l=stressed/blocked/struggling, null=neutral
- flags: someone leaving, recurring blocker, deadline risk, interpersonal issue
- todos: action items for the manager — flag if similar items appeared in previous meetings
- If nothing found for a category return an empty array`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')

    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
