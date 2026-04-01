import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req, { params }) {
  try {
    const notes = await prisma.note.findMany({
      where: { analystId: params.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(notes)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req, { params }) {
  try {
    const body = await req.json()
    const note = await prisma.note.create({
      data: {
        text: body.text,
        mood: body.mood || 'm',
        source: body.source || 'manual',
        meetingTitle: body.meetingTitle || null,
        analystId: params.id,
      },
    })
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
