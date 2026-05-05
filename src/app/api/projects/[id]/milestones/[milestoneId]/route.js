import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req, { params }) {
  try {
    const body = await req.json()
    const data = {}
    if (body.title   !== undefined) data.title   = body.title
    if (body.dueDate !== undefined) data.dueDate  = body.dueDate
    if (body.done    !== undefined) data.done     = body.done
    const updated = await prisma.projectMilestone.update({
      where: { id: params.milestoneId },
      data,
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.projectMilestone.delete({ where: { id: params.milestoneId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
