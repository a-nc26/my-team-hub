import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req, { params }) {
  try {
    const notes = await prisma.projectNote.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(notes)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req, { params }) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const note = await prisma.projectNote.create({
      data: { text: text.trim(), projectId: params.id },
    })
    return NextResponse.json(note, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    const { searchParams } = new URL(req.url)
    const noteId = searchParams.get('noteId')
    if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })
    await prisma.projectNote.delete({ where: { id: noteId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
