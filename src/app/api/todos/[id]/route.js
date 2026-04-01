import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req, { params }) {
  try {
    const body = await req.json()
    const data = { ...body }
    if (body.done === true) data.completedAt = new Date()
    if (body.done === false) data.completedAt = null
    const todo = await prisma.todo.update({
      where: { id: params.id },
      data,
      include: { analyst: true },
    })
    return NextResponse.json(todo)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.todo.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
