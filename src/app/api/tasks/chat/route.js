import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

function getTodayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getTomorrowStr() {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function resolveDate(forDate) {
  if (!forDate || forDate === 'today') return getTodayStr()
  if (forDate === 'tomorrow') return getTomorrowStr()
  return forDate
}

export async function POST(req) {
  try {
    const { message, currentTasks, forDate } = await req.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    const allAnalysts = await prisma.analyst.findMany({
      select: { id: true, name: true },
    })

    const today = getTodayStr()
    const tomorrow = getTomorrowStr()

    const taskBoard = (currentTasks || []).map(t =>
      `- ${t.analystName || t.analystId} | ${t.task} | status: ${t.status} | date: ${t.forDate}`
    ).join('\n') || '(empty)'

    const analystList = allAnalysts.map(a => `${a.name} (id: ${a.id})`).join(', ')

    const systemPrompt = `You are a task board assistant for a team lead managing analysts. Parse the user's message and return structured task updates as JSON. Be precise with analyst name matching (case-insensitive, partial match ok). Today is ${today}, tomorrow is ${tomorrow}.`

    const userMsg = `Current task board:\n${taskBoard}\n\nAll analysts: ${analystList}\n\nUser message: "${message}"\n\nReturn JSON with this exact structure:\n{\n  "updates": [\n    { "analystId": "...", "analystName": "...", "action": "set_task|mark_done|mark_blocked|mark_active|remove", "task": "...", "forDate": "today|tomorrow|YYYY-MM-DD" }\n  ],\n  "reply": "Brief confirmation like 'Updated: Celine → Q2 eval, Jade marked done'"\n}\n\nRules:\n- action "set_task" creates or replaces the task for that analyst on that date\n- action "mark_done/mark_blocked/mark_active" updates status of existing task\n- action "remove" deletes the task\n- forDate defaults to "today" unless message specifies tomorrow or a date\n- Match analyst names case-insensitively, partial match ok (e.g. "Jade" matches "Jade Smith")\n- Only return updates that are clearly requested`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    })

    const raw = response.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ updatedTasks: currentTasks, tomorrowTasks: [], reply: raw })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const updates = parsed.updates || []
    const reply = parsed.reply || 'Done.'

    // Apply updates to DB
    for (const update of updates) {
      const dateStr = resolveDate(update.forDate)
      const analystId = update.analystId

      if (update.action === 'set_task') {
        // Find existing task for this analyst on this date
        const existing = await prisma.dailyTask.findFirst({
          where: { analystId, forDate: dateStr },
        })
        if (existing) {
          await prisma.dailyTask.update({
            where: { id: existing.id },
            data: { task: update.task, status: 'active' },
          })
        } else {
          await prisma.dailyTask.create({
            data: { analystId, task: update.task, forDate: dateStr, status: 'active' },
          })
        }
      } else if (update.action === 'mark_done' || update.action === 'mark_blocked' || update.action === 'mark_active') {
        const statusMap = { mark_done: 'done', mark_blocked: 'blocked', mark_active: 'active' }
        const existing = await prisma.dailyTask.findFirst({
          where: { analystId, forDate: dateStr },
        })
        if (existing) {
          await prisma.dailyTask.update({
            where: { id: existing.id },
            data: { status: statusMap[update.action] },
          })
        }
      } else if (update.action === 'remove') {
        const existing = await prisma.dailyTask.findFirst({
          where: { analystId, forDate: dateStr },
        })
        if (existing) {
          await prisma.dailyTask.delete({ where: { id: existing.id } })
        }
      }
    }

    // Fetch fresh task lists
    const [updatedTodayTasks, updatedTomorrowTasks] = await Promise.all([
      prisma.dailyTask.findMany({
        where: { forDate: today },
        include: { analyst: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.dailyTask.findMany({
        where: { forDate: tomorrow },
        include: { analyst: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    return NextResponse.json({
      updatedTasks: updatedTodayTasks,
      tomorrowTasks: updatedTomorrowTasks,
      reply,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
