import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const reviews = await prisma.settings.findMany({
      where: { key: { startsWith: 'weekly_review_' } },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    })
    return NextResponse.json(reviews.map(r => ({ ...r, value: JSON.parse(r.value) })))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { weekStart } = await req.json()
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 })

    // Date range for this week
    const start = new Date(weekStart + 'T00:00:00')
    const end   = new Date(start)
    end.setDate(start.getDate() + 7)

    const [analysts, projects, notes, todos, meetings] = await Promise.all([
      prisma.analyst.findMany({ where: { pending: false } }),
      prisma.project.findMany({
        include: { projectNotes: { where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'asc' } } },
      }),
      prisma.note.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: { analyst: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.todo.findMany({
        where: { updatedAt: { gte: start, lt: end } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.meeting.findMany({
        where: { date: { gte: start.toISOString().slice(0,10), lte: end.toISOString().slice(0,10) } },
        include: { participants: true },
        orderBy: { date: 'asc' },
      }),
    ])

    // Build context
    const moodSummary = analysts.map(a => {
      const analystNotes = notes.filter(n => n.analystId === a.id)
      const moods = analystNotes.map(n => n.mood).filter(Boolean)
      const lastMood = moods.at(-1) || a.mood
      const moodLabel = m => m === 'h' ? 'thriving' : m === 'l' ? 'needs attention' : 'steady'
      return `${a.name}: ${moodLabel(lastMood)}${analystNotes.length ? ` (${analystNotes.length} notes this week)` : ''}`
    }).join('\n')

    const projectSummary = projects.map(p => {
      const updates = p.projectNotes.map(n => n.text).join('; ')
      return `${p.name} [${p.status}]${updates ? ': ' + updates : ': no updates'}`
    }).join('\n')

    const todoSummary = `${todos.filter(t => t.done).length} completed, ${todos.filter(t => !t.done && t.priority === 'high').length} high-priority open`
    const meetingSummary = meetings.length > 0 ? meetings.map(m => `${m.date}: ${m.title} (${m.participants?.length || 0} people)`).join('\n') : 'No meetings recorded'

    const anthropic = new Anthropic({ apiKey: key })
    const response  = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Write a concise weekly review for a Trust & Safety team lead. Week of ${weekStart}.

TEAM MOOD:
${moodSummary}

PROJECTS:
${projectSummary}

TODOS: ${todoSummary}

MEETINGS:
${meetingSummary}

Write 3 short sections (2-3 sentences each):
1. **Team** — who had a notable week (good or tough), any patterns
2. **Work** — what moved forward, what's stuck, key wins
3. **Next week** — top 2-3 priorities to focus on

Be direct and specific. Under 120 words total.`,
      }],
    })

    const summary = response.content[0].text.trim()
    const settingsKey = `weekly_review_${weekStart}`
    const value = JSON.stringify({ weekStart, summary, generatedAt: new Date().toISOString() })

    await prisma.settings.upsert({
      where:  { key: settingsKey },
      update: { value },
      create: { key: settingsKey, value },
    })

    return NextResponse.json({ weekStart, summary, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[review]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
