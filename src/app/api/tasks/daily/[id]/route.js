import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req, { params }) {
  try {
    const body = await req.json()
    const data = {}
    if (body.task           !== undefined) data.task           = body.task
    if (body.status         !== undefined) data.status         = body.status
    if (body.forDate        !== undefined) data.forDate        = body.forDate
    if (body.completionNote !== undefined) data.completionNote = body.completionNote

    const updated = await prisma.dailyTask.update({
      where: { id: params.id },
      data,
      include: { analyst: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.dailyTask.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
