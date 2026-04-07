import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tools = await prisma.tool.findMany({
      include: { analyst: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tools)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const tool = await prisma.tool.create({
      data: {
        name: body.name,
        description: body.description || null,
        url: body.url || null,
        status: body.status || 'active',
        category: body.category || null,
        analystId: body.analystId || null,
      },
      include: { analyst: true },
    })
    return NextResponse.json(tool, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
