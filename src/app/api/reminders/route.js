import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const KEY = 'standing_reminders'

async function getReminders() {
  const row = await prisma.settings.findUnique({ where: { key: KEY } })
  if (!row) return []
  try { return JSON.parse(row.value) } catch { return [] }
}

export async function GET() {
  try {
    return NextResponse.json(await getReminders())
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const reminders = await getReminders()
    const newReminder = {
      id: Date.now().toString(),
      text: text.trim(),
      addedAt: new Date().toISOString().slice(0, 10),
    }
    reminders.push(newReminder)
    await prisma.settings.upsert({
      where:  { key: KEY },
      update: { value: JSON.stringify(reminders) },
      create: { key: KEY, value: JSON.stringify(reminders) },
    })
    return NextResponse.json(newReminder, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json()
    const reminders = await getReminders()
    const filtered = reminders.filter(r => r.id !== id)
    await prisma.settings.upsert({
      where:  { key: KEY },
      update: { value: JSON.stringify(filtered) },
      create: { key: KEY, value: JSON.stringify(filtered) },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
