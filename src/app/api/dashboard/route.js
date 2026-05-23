import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(now.getDate() - 14)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)

    const [analysts, projects, todos, recentNotes, projectNotes] = await Promise.all([
      prisma.analyst.findMany({
        where: { pending: false },
        include: {
          projects: { include: { project: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.project.findMany({
        include: {
          projectNotes: { orderBy: { createdAt: 'desc' }, take: 1 },
          analysts:     { include: { analyst: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.todo.findMany({
        where: { done: false },
        include: { analyst: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      }),
      // Last 14 days of notes for sparklines
      prisma.note.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        include: { analyst: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Last 7 days of project notes for staleness
      prisma.projectNote.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { projectId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Build mood history per analyst (last 14 days, one point per day)
    const today = new Date()
    const moodHistory = {}
    for (const analyst of analysts) {
      const days = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        // Find most recent note on or before this day
        const note = recentNotes
          .filter(n => n.analystId === analyst.id && n.createdAt.toISOString().slice(0, 10) <= dateStr)
          .at(-1)
        days.push({ date: dateStr, mood: note?.mood || null })
      }
      moodHistory[analyst.id] = days
    }

    // Days since last note per analyst — use all notes (not just recent)
    const allRecentNotesByAnalyst = {}
    for (const note of recentNotes) {
      if (!allRecentNotesByAnalyst[note.analystId] || note.createdAt > allRecentNotesByAnalyst[note.analystId]) {
        allRecentNotesByAnalyst[note.analystId] = note.createdAt
      }
    }
    // For analysts with no recent notes, look further back
    const analystsMissingNotes = analysts.filter(a => !allRecentNotesByAnalyst[a.id]).map(a => a.id)
    const lastNoteDate = { ...allRecentNotesByAnalyst }
    if (analystsMissingNotes.length > 0) {
      for (const analystId of analystsMissingNotes) {
        const oldNote = await prisma.note.findFirst({
          where: { analystId, createdAt: { lt: fourteenDaysAgo } },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
        if (oldNote) lastNoteDate[analystId] = oldNote.createdAt
      }
    }

    // Project staleness (days since last note or update)
    const projectLastActivity = {}
    for (const pn of projectNotes) {
      if (!projectLastActivity[pn.projectId] || pn.createdAt > projectLastActivity[pn.projectId]) {
        projectLastActivity[pn.projectId] = pn.createdAt
      }
    }

    const daysSince = (date) => {
      if (!date) return null
      return Math.floor((now - new Date(date)) / (1000 * 60 * 60 * 24))
    }

    // Enrich analysts
    const enrichedAnalysts = analysts.map(a => ({
      id:            a.id,
      name:          a.name,
      initials:      a.initials,
      role:          a.role,
      color:         a.color,
      mood:          a.mood,
      moodHistory:   moodHistory[a.id] || [],
      daysSinceNote: daysSince(lastNoteDate[a.id]),
      currentProject: a.projects[0]?.project?.name || null,
    }))

    // Enrich projects
    const enrichedProjects = projects.map(p => ({
      id:           p.id,
      name:         p.name,
      type:         p.type,
      status:       p.status,
      lastNote:     p.projectNotes[0]?.text || null,
      lastNoteDate: p.projectNotes[0]?.createdAt || null,
      daysSinceActivity: daysSince(projectLastActivity[p.id] || p.updatedAt),
      analysts:     (p.analysts || []).map(a => ({ id: a.analyst.id, name: a.analyst.name, initials: a.analyst.initials, color: a.analyst.color })),
    }))

    // Stats
    const active     = enrichedAnalysts.filter(a => a.mood)
    const thriving   = active.filter(a => a.mood === 'h').length
    const steady     = active.filter(a => a.mood === 'm').length
    const attention  = active.filter(a => a.mood === 'l').length
    const notSeen    = enrichedAnalysts.filter(a => a.daysSinceNote === null || a.daysSinceNote > 5).length
    const healthPct  = active.length > 0 ? Math.round(((thriving + steady) / active.length) * 100) : null

    const atRiskProjects = enrichedProjects.filter(p =>
      p.status !== 'done' && (p.status === 'blocked' || (p.daysSinceActivity !== null && p.daysSinceActivity > 7))
    )
    const highTodos = todos.filter(t => t.priority === 'high')

    return NextResponse.json({
      analysts:        enrichedAnalysts,
      projects:        enrichedProjects,
      todos,
      stats: {
        teamSize:     enrichedAnalysts.length,
        thriving,
        steady,
        attention,
        notSeen,
        healthPct,
        atRiskCount:  atRiskProjects.length,
        highTodoCount: highTodos.length,
        activeProjects: enrichedProjects.filter(p => p.status === 'active' || p.status === 'review').length,
      },
      atRiskProjects,
      highTodos: highTodos.slice(0, 5),
    })
  } catch (e) {
    console.error('[dashboard]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
