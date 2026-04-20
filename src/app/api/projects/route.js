import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        analysts: { include: { analyst: true } },
        projectNotes: { orderBy: { createdAt: 'desc' } },
      },
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
    // assignments: [{ analystId, fieldValues: {} }] OR legacy analystIds: []
    const assignments = body.assignments ||
      (body.analystIds || []).map(id => ({ analystId: id, fieldValues: {} }))

    const defaultFields = [
      { id: 'harmArea', label: 'Harm Area', type: 'text' },
      { id: 'amount',   label: 'Amount',    type: 'number' },
    ]

    const project = await prisma.project.create({
      data: {
        name:      body.name,
        type:      body.type || 'google',
        status:    body.status || 'active',
        notes:     body.notes || '',
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate:   body.endDate   ? new Date(body.endDate)   : null,
        fieldDefs: body.fieldDefs ?? defaultFields,
        analysts: {
          create: assignments.map(a => ({
            analystId:   a.analystId,
            fieldValues: a.fieldValues || {},
          })),
        },
      },
      include: {
        analysts: { include: { analyst: true } },
        projectNotes: { orderBy: { createdAt: 'desc' } },
      },
    })
    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
