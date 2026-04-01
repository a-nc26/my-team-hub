import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req, { params }) {
  try {
    const body = await req.json()
    const { analystIds, ...fields } = body
    const meeting = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        ...fields,
        ...(fields.date ? { date: new Date(fields.date) } : {}),
        updatedAt: new Date(),
        ...(analystIds
          ? {
              analysts: {
                deleteMany: {},
                create: analystIds.map(id => ({ analystId: id })),
              },
            }
          : {}),
      },
      include: { analysts: { include: { analyst: true } } },
    })
    return NextResponse.json(meeting)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.meeting.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
