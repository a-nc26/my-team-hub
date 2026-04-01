import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const meetings = await prisma.meeting.findMany({
      include: {
        analysts: { include: { analyst: true } },
      },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(meetings)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const meeting = await prisma.meeting.create({
      data: {
        title: body.title,
        date: body.date ? new Date(body.date) : new Date(),
        notes: body.notes || '',
        digest: body.digest || 0,
        analysts: {
          create: (body.analystIds || []).map(id => ({ analystId: id })),
        },
      },
      include: {
        analysts: { include: { analyst: true } },
      },
    })
    return NextResponse.json(meeting, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
