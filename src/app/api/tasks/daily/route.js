import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getTodayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getTomorrowStr() {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')

    if (date) {
      const tasks = await prisma.dailyTask.findMany({
        where: { forDate: date },
        include: { analyst: true },
        orderBy: { createdAt: 'asc' },
      })
      return NextResponse.json(tasks)
    }

    // No date param: return today + tomorrow
    const today = getTodayStr()
    const tomorrow = getTomorrowStr()
    const [todayTasks, tomorrowTasks] = await Promise.all([
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
    return NextResponse.json({ todayTasks, tomorrowTasks })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { analystId, task, forDate, status } = await req.json()
    if (!analystId || !task?.trim() || !forDate) {
      return NextResponse.json({ error: 'analystId, task, forDate required' }, { status: 400 })
    }
    const created = await prisma.dailyTask.create({
      data: { analystId, task: task.trim(), forDate, status: status || 'active' },
      include: { analyst: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
