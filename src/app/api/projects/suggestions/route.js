import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const row = await prisma.settings.findUnique({ where: { key: 'slack_suggestions' } })
    if (!row) return NextResponse.json({ items: [] })
    const data = JSON.parse(row.value)
    // Auto-expire after 2 days
    const daysSince = (Date.now() - new Date(data.date).getTime()) / 86400000
    if (daysSince > 2) {
      await prisma.settings.delete({ where: { key: 'slack_suggestions' } })
      return NextResponse.json({ items: [] })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function DELETE() {
  try {
    await prisma.settings.deleteMany({ where: { key: 'slack_suggestions' } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
