import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req, { params }) {
  try {
    const body = await req.json()
    const tool = await prisma.tool.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.url !== undefined && { url: body.url }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.analystId !== undefined && { analystId: body.analystId || null }),
      },
      include: { analyst: true },
    })
    return NextResponse.json(tool)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.tool.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
