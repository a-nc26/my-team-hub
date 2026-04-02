import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/projects/:id/assignments
// Body: { analystId, fieldValues }
export async function PUT(req, { params }) {
  try {
    const { analystId, fieldValues } = await req.json()
    const assignment = await prisma.projectAnalyst.upsert({
      where: { projectId_analystId: { projectId: params.id, analystId } },
      update: { fieldValues },
      create: { projectId: params.id, analystId, fieldValues },
    })
    return NextResponse.json(assignment)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
