import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 }

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: { analyst: true },
      orderBy: { createdAt: 'desc' },
    })
    const sorted = todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    })
    return NextResponse.json(sorted)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const todo = await prisma.todo.create({
      data: {
        text: body.text,
        group: body.group || null,
        analystId: body.analystId || null,
        priority: body.priority || 'normal',
      },
      include: { analyst: true },
    })
    return NextResponse.json(todo, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
