import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: { analysts: { include: { analyst: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const project = await prisma.project.create({
      data: {
        name: body.name,
        type: body.type || 'google',
        status: body.status || 'active',
        notes: body.notes || '',
        analysts: {
          create: (body.analystIds || []).map(id => ({ analystId: id })),
        },
      },
      include: { analysts: { include: { analyst: true } } },
    })
    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
