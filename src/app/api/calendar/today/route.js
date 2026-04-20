import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

function parseICSDate(value, keyPart) {
  // Handle DATE-only (all-day): 20240420
  if (!/T/.test(value)) {
    const y = value.slice(0,4), m = value.slice(4,6), d = value.slice(6,8)
    return { date: `${y}-${m}-${d}`, allDay: true }
  }
  // Handle TZID in key part
  const tzMatch = keyPart.match(/TZID=([^;:]+)/)
  const dateStr = value.slice(0,8), timeStr = value.slice(9,15)
  const y = dateStr.slice(0,4), mo = dateStr.slice(4,6), d = dateStr.slice(6,8)
  const h = timeStr.slice(0,2), min = timeStr.slice(2,4), s = timeStr.slice(4,6)
  if (value.endsWith('Z')) {
    return { iso: `${y}-${mo}-${d}T${h}:${min}:${s}Z`, allDay: false }
  }
  // Local time (assume it's in user's local context, store as-is)
  return { iso: `${y}-${mo}-${d}T${h}:${min}:${s}`, allDay: false, tz: tzMatch?.[1] || 'local' }
}

function parseICS(icsText) {
  // ICS line unfolding (lines that start with space/tab are continuations)
  const text = icsText.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n')
  const events = []
  let current = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line === 'BEGIN:VEVENT') { current = {} }
    else if (line === 'END:VEVENT' && current) { events.push(current); current = null }
    else if (current) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const keyPart = line.slice(0, colonIdx)
      const key = keyPart.split(';')[0].toUpperCase()
      const value = line.slice(colonIdx + 1)
      if (key === 'SUMMARY') current.title = value.replace(/\\,/g, ',').replace(/\\n/g, ' ')
      else if (key === 'DTSTART') current.start = parseICSDate(line.slice(colonIdx + 1), keyPart)
      else if (key === 'DTEND') current.end = parseICSDate(line.slice(colonIdx + 1), keyPart)
      else if (key === 'DESCRIPTION') current.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').slice(0, 300)
      else if (key === 'LOCATION') current.location = value.replace(/\\,/g, ',')
      else if (key === 'STATUS') current.cancelled = value === 'CANCELLED'
    }
  }
  return events
}

function getTodayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getEventDateStr(event) {
  if (!event.start) return null
  if (event.start.allDay) return event.start.date
  if (event.start.iso) return event.start.iso.slice(0, 10)
  return null
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date') // YYYY-MM-DD, defaults to today

    const setting = await prisma.settings.findFirst({ where: { key: 'calendarUrl' } })

    if (!setting?.value) {
      return NextResponse.json({ events: [], configured: false })
    }

    const calendarUrl = setting.value
    let icsText
    try {
      const resp = await fetch(calendarUrl)
      if (!resp.ok) throw new Error(`Calendar fetch failed: ${resp.status}`)
      icsText = await resp.text()
    } catch (e) {
      return NextResponse.json({ events: [], configured: true, error: e.message })
    }

    const allEvents = parseICS(icsText)
    const targetDate = dateParam || getTodayStr()

    const todayEvents = allEvents
      .filter(e => !e.cancelled && getEventDateStr(e) === targetDate)
      .sort((a, b) => {
        const aTime = a.start?.iso || a.start?.date || ''
        const bTime = b.start?.iso || b.start?.date || ''
        return aTime.localeCompare(bTime)
      })

    // Fetch analyst context: last 3 notes per analyst
    const analysts = await prisma.analyst.findMany({
      select: {
        id: true,
        name: true,
        notes: {
          orderBy: { date: 'desc' },
          take: 3,
          select: { text: true, date: true, mood: true },
        },
      },
    })

    // Generate prep notes via Claude if there are events
    let prepNotes = {}
    if (todayEvents.length > 0) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const meetingsList = todayEvents.map(e => {
          const time = e.start?.allDay ? 'All day' : (e.start?.iso ? new Date(e.start.iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '')
          return `- "${e.title}" at ${time}${e.description ? ` (${e.description.slice(0, 100)})` : ''}`
        }).join('\n')

        const analystContext = analysts.map(a => {
          if (!a.notes.length) return null
          return `${a.name}: ${a.notes.map(n => n.text.slice(0, 80)).join(' | ')}`
        }).filter(Boolean).join('\n')

        const analystNames = analysts.map(a => a.name).join(', ')

        const userMsg = `Today's meetings:\n${meetingsList}\n\nAnalyst context (recent notes):\n${analystContext || 'No notes available'}\n\nAnalysts: ${analystNames}\n\nFor each meeting, provide 1 sentence of prep if there's relevant analyst context, otherwise null. Return JSON array: [{"meetingTitle": "...", "prep": "..." | null}]`

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 400,
          system: 'You help a team lead prepare for their meetings. Be very brief.',
          messages: [{ role: 'user', content: userMsg }],
        })

        const raw = response.content[0].text.trim()
        const jsonMatch = raw.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          for (const item of parsed) {
            if (item.prep) prepNotes[item.meetingTitle] = item.prep
          }
        }
      } catch (_) {
        // prep notes are best-effort — don't fail the whole response
      }
    }

    return NextResponse.json({ events: todayEvents, prepNotes, configured: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
