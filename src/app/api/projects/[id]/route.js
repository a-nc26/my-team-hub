import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req, { params }) {
  try {
    const body = await req.json()
    const { assignments, analystIds, ...fields } = body

    // Resolve assignments from either format
    const resolvedAssignments = assignments ||
      (analystIds ? analystIds.map(id => ({ analystId: id, fieldValues: {} })) : null)

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...fields,
        updatedAt: new Date(),
        ...(resolvedAssignments != null ? {
          analysts: {
            deleteMany: {},
            create: resolvedAssignments.map(a => ({
              analystId:   a.analystId,
              fieldValues: a.fieldValues || {},
            })),
          },
        } : {}),
      },
      include: { analysts: { include: { analyst: true } } },
    })
    return NextResponse.json(project)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.project.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
