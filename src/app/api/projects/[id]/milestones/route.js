import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req, { params }) {
  try {
    const { title, dueDate } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const milestone = await prisma.projectMilestone.create({
      data: { projectId: params.id, title: title.trim(), dueDate: dueDate || null },
    })
    return NextResponse.json(milestone, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
