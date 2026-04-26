import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/n8n/daily-briefing
 *
 * Returns a morning briefing with team status, active projects, and open todos.
 * Reads the last 7 briefing logs so Claude avoids repeating the same points.
 * Saves every briefing to BriefingLog for future memory.
 * Hit this from n8n on a daily cron schedule (e.g. 8am) and pipe emailHtml to Send Email.
 */

const MOOD_LABEL  = { h: 'Thriving', m: 'Steady', l: 'Needs Attention' }
const MOOD_ICON   = { h: '🟢', m: '🟡', l: '🔴' }
const STATUS_ICON = { active: '🔵', review: '🟣', done: '✅', blocked: '🔴' }

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(d) {
  if (!d) return null
  const diff = Math.round((new Date(d) - new Date()) / 86400000)
  return diff
}

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })

  try {
    const [analysts, projects, todos, settings, pastBriefings, recentlyDone] = await Promise.all([
      prisma.analyst.findMany({
        where: { pending: false },
        include: { notes: { orderBy: { createdAt: 'desc' }, take: 3 } },
        orderBy: { name: 'asc' },
      }),
      prisma.project.findMany({
        where: { status: { not: 'done' } },
        include: {
          analysts: { include: { analyst: true } },
          projectNotes: { orderBy: { createdAt: 'desc' }, take: 2 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.todo.findMany({
        where: { done: false },
        include: { analyst: true },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.settings.findMany(),
      // Recently completed todos (last 24h) — so Claude knows what was just resolved
      prisma.todo.findMany({
        where: { done: true, completedAt: { gte: new Date(Date.now() - 86400000) } },
        include: { analyst: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
      // Last 7 briefings for historical awareness
      prisma.briefingLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 7,
      }),
    ])

    const managerName = settings.find(s => s.key === 'managerName')?.value || 'there'
    const firstName   = managerName.split(' ')[0]
    const today       = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    // Build context for Claude
    const teamContext = analysts.map(a => {
      const lastNote = a.notes[0]
      return `- ${a.name} (${MOOD_LABEL[a.mood] || 'Steady'})${lastNote ? ': last note: "' + lastNote.text.slice(0, 120) + '"' : ''}`
    }).join('\n')

    const projectContext = projects.map(p => {
      const names    = p.analysts.map(pa => pa.analyst?.name).filter(Boolean).join(', ')
      const due      = p.endDate ? `due ${fmtDate(p.endDate)}` : ''
      const daysLeft = p.endDate ? daysUntil(p.endDate) : null
      const urgency  = daysLeft !== null && daysLeft <= 2 ? ' ⚠️ DUE SOON' : ''
      const lastNote = p.projectNotes?.[0]
      const noteSnip = lastNote ? ` | last update: "${lastNote.text.slice(0, 100)}"` : ''
      return `- ${p.name} [${p.status}]${due ? ' ' + due : ''}${urgency}${names ? ' — ' + names : ''}${noteSnip}`
    }).join('\n')

    const todoContext = todos.map(t =>
      `- [${t.priority}] ${t.text}${t.analyst ? ' (re: ' + t.analyst.name + ')' : ''}`
    ).join('\n')

    const recentlyDoneContext = recentlyDone.length > 0
      ? recentlyDone.map(t =>
          `- ✓ ${t.text}${t.completionNote ? ': "' + t.completionNote + '"' : ''}${t.analyst ? ' (re: ' + t.analyst.name + ')' : ''}`
        ).join('\n')
      : null

    // Build past briefings context — so Claude can avoid repeating itself
    const historyContext = pastBriefings.length > 0
      ? pastBriefings.map(b => {
          const date = new Date(b.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          return `[${date}]\n${b.summary}`
        }).join('\n\n---\n\n')
      : null

    // Ask Claude for a short, sharp morning briefing
    const client = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are writing a morning briefing for ${managerName}, a team lead. Today is ${today}.
Write directly to them using "you". Be concise and direct — this is a quick morning read, not a report.
3-4 sentences max per section. Flag anything urgent. Use plain prose, no bullet lists in the output.

${historyContext ? `RECENT PAST BRIEFINGS (last ${pastBriefings.length} days — read these carefully):
${historyContext}

IMPORTANT: Do NOT repeat points already covered in recent briefings unless the situation has materially changed or become more urgent. If something is resolved or no longer relevant, do not mention it. Prioritise NEW developments and what has actually changed since the last briefing.

` : ''}TEAM STATE (today):
${teamContext || 'No active analysts.'}

ACTIVE PROJECTS (today):
${projectContext || 'No active projects.'}

OPEN TO-DOS (${todos.length} total, ${todos.filter(t => t.priority === 'high').length} high priority):
${todoContext || 'None.'}
${recentlyDoneContext ? `\nCOMPLETED IN THE LAST 24H (for context — do not re-flag these):\n${recentlyDoneContext}` : ''}

Write a morning briefing with three short sections:
1. Team pulse — who needs attention today, noting any changes since recent briefings
2. Projects — what to keep an eye on, anything due soon or newly flagged
3. Focus — the 2-3 most important things to do today based on the todos and context

Keep the whole thing under 150 words. Warm but direct tone.`,
      }],
    })

    const summary = response.content[0].text.trim()

    // ── Save this briefing to the log for future memory ───────────────────────
    const needsAttention = analysts.filter(a => a.mood === 'l')
    const highTodos      = todos.filter(t => t.priority === 'high')
    const dueSoon        = projects.filter(p => p.endDate && daysUntil(p.endDate) <= 3 && daysUntil(p.endDate) >= 0)

    // Fire-and-forget — don't block the response
    prisma.briefingLog.create({
      data: {
        summary,
        counts: { analysts: analysts.length, projects: projects.length, todos: todos.length, highTodos: highTodos.length },
        flags: {
          needsAttention: needsAttention.map(a => a.name),
          dueSoon: dueSoon.map(p => p.name),
          highTodoCount: highTodos.length,
        },
      },
    }).catch(console.error)

    // ── HTML email ────────────────────────────────────────────────────────────
    const teamRows = analysts.map(a => {
      const lastNote = a.notes[0]
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:500">${MOOD_ICON[a.mood] || '🟡'} ${a.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">${MOOD_LABEL[a.mood] || 'Steady'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px">${lastNote ? lastNote.text.slice(0, 100) + (lastNote.text.length > 100 ? '…' : '') : '—'}</td>
      </tr>`
    }).join('')

    const projectRows = projects.map(p => {
      const names    = p.analysts.map(pa => pa.analyst?.name).filter(Boolean).join(', ')
      const daysLeft = p.endDate ? daysUntil(p.endDate) : null
      const dueBadge = daysLeft !== null
        ? daysLeft <= 0
          ? `<span style="background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:4px;font-size:11px">Overdue</span>`
          : daysLeft <= 3
            ? `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:11px">${daysLeft}d left</span>`
            : `<span style="color:#6b7280;font-size:12px">${fmtDate(p.endDate)}</span>`
        : ''
      const lastNote = p.projectNotes?.[0]
      const noteHtml = lastNote
        ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">💬 ${lastNote.text.slice(0, 90)}${lastNote.text.length > 90 ? '…' : ''}</div>`
        : ''
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:500">${STATUS_ICON[p.status] || '🔵'} ${p.name}${noteHtml}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">${names || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${dueBadge}</td>
      </tr>`
    }).join('')

    const todoItems = todos.slice(0, 10).map(t => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6">
        <span style="font-size:11px;padding:2px 6px;border-radius:4px;flex-shrink:0;margin-top:2px;${t.priority === 'high' ? 'background:#fee2e2;color:#dc2626' : 'background:#f3f4f6;color:#6b7280'}">${t.priority}</span>
        <span style="font-size:14px;color:#111827">${t.text}${t.analyst ? `<span style="color:#6b7280;font-size:12px"> · ${t.analyst.name}</span>` : ''}</span>
      </div>`).join('')

    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;background:#fff">

  <!-- Header -->
  <div style="border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px">
    <div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Morning Briefing</div>
    <h1 style="margin:0;font-size:22px">Good morning, ${firstName} 👋</h1>
    <div style="color:#6b7280;font-size:14px;margin-top:4px">${today}</div>
  </div>

  ${needsAttention.length > 0 || dueSoon.length > 0 || highTodos.length > 0 ? `
  <!-- Alerts -->
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px">
    <div style="font-weight:600;font-size:13px;color:#92400e;margin-bottom:6px">⚠️ Heads up</div>
    ${needsAttention.map(a => `<div style="font-size:13px;color:#78350f;margin-bottom:3px">🔴 ${a.name} needs attention</div>`).join('')}
    ${dueSoon.map(p => `<div style="font-size:13px;color:#78350f;margin-bottom:3px">📅 ${p.name} is due ${fmtDate(p.endDate)}</div>`).join('')}
    ${highTodos.length > 0 ? `<div style="font-size:13px;color:#78350f">${highTodos.length} high-priority to-do${highTodos.length > 1 ? 's' : ''} open</div>` : ''}
  </div>` : ''}

  <!-- AI Summary -->
  <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px">
    <div style="font-weight:600;font-size:13px;color:#0369a1;margin-bottom:8px">🤖 AI Morning Brief</div>
    <div style="font-size:14px;color:#0c4a6e;line-height:1.7;white-space:pre-wrap">${summary}</div>
  </div>

  <!-- Team -->
  <h2 style="font-size:15px;color:#374151;margin:0 0 10px">👥 Team (${analysts.length})</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <thead><tr style="background:#f9fafb">
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Name</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Status</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Last note</th>
    </tr></thead>
    <tbody>${teamRows}</tbody>
  </table>

  <!-- Projects -->
  <h2 style="font-size:15px;color:#374151;margin:0 0 10px">📁 Active Projects (${projects.length})</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <thead><tr style="background:#f9fafb">
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Project</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Analysts</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Due</th>
    </tr></thead>
    <tbody>${projectRows}</tbody>
  </table>

  <!-- Todos -->
  <h2 style="font-size:15px;color:#374151;margin:0 0 10px">✅ Open To-Dos (${todos.length})</h2>
  <div style="margin-bottom:24px">${todoItems}${todos.length > 10 ? `<div style="font-size:12px;color:#9ca3af;margin-top:8px">+ ${todos.length - 10} more in the app</div>` : ''}</div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;display:flex;justify-content:space-between">
    <span>My Team Hub · Daily Briefing</span>
    <a href="https://my-team-hub-mu.vercel.app" style="color:#6b7280">Open app →</a>
  </div>
</body></html>`

    const emailText = [
      `Good morning, ${firstName} — ${today}`,
      '',
      summary,
      '',
      `TEAM (${analysts.length})`,
      ...analysts.map(a => `${MOOD_ICON[a.mood]} ${a.name}: ${MOOD_LABEL[a.mood] || 'Steady'}`),
      '',
      `PROJECTS (${projects.length} active)`,
      ...projects.map(p => `${p.name} [${p.status}]${p.endDate ? ' · due ' + fmtDate(p.endDate) : ''}`),
      '',
      `TO-DOS (${todos.length} open)`,
      ...todos.slice(0, 10).map(t => `[${t.priority}] ${t.text}`),
    ].join('\n')

    return NextResponse.json({ summary, emailHtml, emailText, counts: { analysts: analysts.length, projects: projects.length, todos: todos.length, highTodos: highTodos.length } })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
