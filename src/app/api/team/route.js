import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const analysts = await prisma.analyst.findMany({
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { name: 'asc' },
    })
    // pending analysts last
    const sorted = [
      ...analysts.filter(a => !a.pending),
      ...analysts.filter(a => a.pending),
    ]
    return NextResponse.json(sorted)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const count = await prisma.analyst.count()
    const analyst = await prisma.analyst.create({
      data: {
        name: body.name,
        initials: body.initials || body.name.slice(0, 2).toUpperCase(),
        role: body.role || 'Analyst',
        color: count % 7,
        mood: body.mood || 'm',
        pending: body.pending || false,
      },
    })
    return NextResponse.json(analyst, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
