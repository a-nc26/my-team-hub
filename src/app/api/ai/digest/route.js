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
    const { transcript, title = '', analystIds = [] } = body

    // Fetch full context from DB server-side
    const [analysts, projects, allMeetings, todos] = await Promise.all([
      prisma.analyst.findMany({
        include: {
          notes: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.project.findMany({
        include: {
          analysts: { include: { analyst: true } },
          projectNotes: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.meeting.findMany({
        include: { analysts: { include: { analyst: true } } },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      prisma.todo.findMany({
        where: { done: false },
        include: { analyst: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // ── Build analyst-specific recent history ─────────────────────────────────
    // Surface the last 3-4 meetings specifically with these analysts
    // so Claude knows exactly what was covered and what's pending
    let specificHistory = ''
    if (analystIds.length > 0) {
      const analystIdSet = new Set(analystIds)

      // Meetings involving any of these analysts (excluding this session)
      const relevantMeetings = allMeetings
        .filter(m => m.analysts.some(ma => analystIdSet.has(ma.analystId)))
        .slice(0, 4)

      if (relevantMeetings.length > 0) {
        specificHistory = `\nRECENT MEETING HISTORY WITH THESE ANALYSTS (last ${relevantMeetings.length} meetings — use this to avoid repeating suggestions and to track follow-through):\n`
        specificHistory += relevantMeetings.map(m => {
          const names = m.analysts.map(ma => ma.analyst?.name).filter(Boolean).join(', ')
          const date = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          const notes = m.notes?.slice(0, 400) || ''
          const digestNote = m.pendingDigest ? ' [had AI digest]' : ''
          return `- [${date}] "${m.title}"${names ? ' (with: ' + names + ')' : ''}${digestNote}\n  ${notes}${notes.length === 400 ? '…' : ''}`
        }).join('\n')
        specificHistory += '\n'
      }

      // Open todos linked to these analysts
      const linkedTodos = todos.filter(t => t.analystId && analystIdSet.has(t.analystId))
      if (linkedTodos.length > 0) {
        specificHistory += `\nOPEN ACTION ITEMS LINKED TO THESE ANALYSTS:\n`
        specificHistory += linkedTodos.map(t => `- [${t.priority}] ${t.text}`).join('\n')
        specificHistory += '\n'
      }

      // Their current notes/mood
      const relevantAnalysts = analysts.filter(a => analystIdSet.has(a.id))
      if (relevantAnalysts.length > 0) {
        specificHistory += `\nCURRENT STATE OF THESE ANALYSTS:\n`
        specificHistory += relevantAnalysts.map(a => {
          const mood = a.mood === 'h' ? 'Thriving' : a.mood === 'l' ? 'Needs Attention' : 'Steady'
          const notes = a.notes.slice(0, 3).map(n => {
            const d = new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const sentiment = n.mood === 'h' ? 'positive' : n.mood === 'l' ? 'concern' : 'neutral'
            return `    [${d}] (${sentiment}): ${n.text}`
          }).join('\n')
          return `- ${a.name} — currently: ${mood}\n${notes || '  No recent notes'}`
        }).join('\n')
        specificHistory += '\n'
      }
    }

    // Build broader team context string
    const analystContext = analysts.map(a => {
      const recentNotes = a.notes.map(n =>
        `    [${new Date(n.createdAt).toLocaleDateString()}] (${n.mood === 'h' ? 'positive' : n.mood === 'l' ? 'concern' : 'neutral'}${n.source === 'digest' ? ', from meeting' : ''}): ${n.text}`
      ).join('\n')
      return `- ${a.name} (id:${a.id}, ${a.role}, mood:${a.mood === 'h' ? 'Thriving' : a.mood === 'l' ? 'Needs Attention' : 'Steady'})${a.pending ? ' [PENDING - not started yet]' : ''}${recentNotes ? '\n  Recent notes:\n' + recentNotes : ''}`
    }).join('\n')

    const projectContext = projects.map(p => {
      const names = p.analysts.map(pa => pa.analyst?.name).filter(Boolean).join(', ')
      const lastComment = p.projectNotes?.[0]
      return `- ${p.name} (id:${p.id}, type:${p.type}, status:${p.status})${names ? ' — ' + names : ''}${p.notes ? '\n  Notes: ' + p.notes.slice(0, 150) : ''}${lastComment ? '\n  Last update: ' + lastComment.text.slice(0, 100) : ''}`
    }).join('\n')

    // General meeting context (broader history)
    const meetingContext = allMeetings.slice(0, 10).map(m => {
      const names = m.analysts.map(ma => ma.analyst?.name).filter(Boolean).join(', ')
      return `- [${new Date(m.date).toLocaleDateString()}] "${m.title}"${names ? ' (with: ' + names + ')' : ''}: ${m.notes?.slice(0, 200) || ''}...`
    }).join('\n')

    const todoContext = todos.map(t =>
      `- ${t.text}${t.analyst ? ' [re: ' + t.analyst.name + ']' : ''} (${t.priority} priority)`
    ).join('\n')

    // Build meeting type line from analystIds
    let meetingTypeLine = 'MEETING TYPE: General / team meeting'
    if (analystIds.length === 1) {
      const matchedAnalyst = analysts.find(a => a.id === analystIds[0])
      meetingTypeLine = `MEETING TYPE: 1:1 with ${matchedAnalyst ? matchedAnalyst.name : analystIds[0]}`
    } else if (analystIds.length >= 2) {
      const names = analystIds.map(id => {
        const a = analysts.find(a => a.id === id)
        return a ? a.name : id
      }).join(', ')
      meetingTypeLine = `MEETING TYPE: Group meeting with ${names}`
    }

    const client = new Anthropic({ apiKey: key })

    const prompt = `You are a management assistant helping a team lead extract structured insights from a meeting. The person reading this output IS the manager — write everything as if speaking directly to them, never in third person.

You have full context of the team's history below. Use it to:
- Recognize patterns (e.g. someone has been blocked for multiple meetings)
- Connect action items to previous commitments — flag if something was promised before and not done
- Reference relevant project context, including recent project updates
- Notice when something contradicts or follows up on previous notes
- AVOID suggesting action items that are already in the open action items list

${meetingTypeLine}
${specificHistory ? '\n' + specificHistory.trim() : ''}

FULL TEAM CONTEXT (for reference):
TEAM MEMBERS:
${analystContext || 'None'}

PROJECTS:
${projectContext || 'None'}

RECENT MEETING HISTORY (broader, last 10):
${meetingContext || 'No meetings yet'}

ALL OPEN ACTION ITEMS:
${todoContext || 'None'}

NEW MEETING TRANSCRIPT/NOTES:
"${transcript}"

Extract updates in this exact JSON format. Return ONLY valid JSON, no markdown fences, no explanation:
{
  "analystUpdates": [
    { "id": "analyst_id_from_context", "name": "first name only", "note": "1-2 sentence summary referencing any relevant history or patterns", "mood": "h|m|l|null" }
  ],
  "projectUpdates": [
    { "id": "project_id_from_context_or_null", "name": "project name", "status": "active|review|done|blocked|null", "note": "what was said, noting any status changes or connection to prior project comments" }
  ],
  "flags": [{ "text": "urgent fact-based statement", "analystId": "analyst_id_from_context_if_mentioned_or_null" }],
  "todos": ["direct action items written as commands, e.g. 'Follow up with Jade on X' not 'Make sure Avi does X'. Never mention the manager by name. Do not duplicate items already in the open action items list."]
}

Rules:
- Only include entries where you found clear signal in the transcript
- Use the analyst/project ids from the context above when you can match them
- mood: h=positive/energised/progress, l=stressed/blocked/struggling, null=neutral
- flags: someone leaving, recurring blocker, deadline risk, interpersonal issue — written as facts, not instructions
- flags: always try to match the analyst mentioned by name and include their id from the context. If no specific analyst is mentioned, use null.
- todos: write as direct imperatives ("Follow up with...", "Schedule...", "Review...") — never "Avi should..." or "Make sure Avi..."
- todos: check the open action items list — do not create duplicates of items already tracked
- If this is a recurring 1:1, reference what's changed since the last meeting with this person
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
