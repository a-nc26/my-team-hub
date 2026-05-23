import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHANNEL_ID = 'C0AR19S2MD0' // #team-gts

/**
 * POST /api/projects/slack-sync-now
 *
 * Reads recent messages from #team-gts using SLACK_BOT_TOKEN,
 * then delegates to the existing slack-project-sync endpoint for analysis.
 */
export async function POST() {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'SLACK_BOT_TOKEN not configured. Add it to your Vercel environment variables.' },
      { status: 503 }
    )
  }

  try {
    // Fetch last 40 messages from #team-gts
    const slackRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&limit=40`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const slackData = await slackRes.json()
    if (!slackData.ok) {
      return NextResponse.json({ error: `Slack error: ${slackData.error}` }, { status: 502 })
    }

    // Build user map from messages (batch profile lookups)
    const userIds = [...new Set(slackData.messages.filter(m => m.user).map(m => m.user))]
    const userMap = {}
    await Promise.all(userIds.map(async uid => {
      try {
        const r = await fetch(`https://slack.com/api/users.info?user=${uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const d = await r.json()
        if (d.ok) userMap[uid] = d.user.profile?.display_name || d.user.profile?.real_name || d.user.name
      } catch {}
    }))

    // Format messages as readable strings
    const messages = slackData.messages
      .filter(m => m.text?.trim())
      .map(m => `${userMap[m.user] || m.user || 'unknown'}: ${m.text}`)
      .reverse() // chronological order

    if (messages.length === 0) {
      return NextResponse.json({ ok: true, total: 0, digest: { analystUpdates: [], projectUpdates: [], flags: [], todos: [] } })
    }

    // Delegate to AI analysis
    const syncRes = await fetch(
      new URL('/api/n8n/slack-project-sync', process.env.NEXT_PUBLIC_APP_URL || 'https://app-three-lac-75.vercel.app').toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, channel: 'team-gts' }),
      }
    )
    const result = await syncRes.json()
    return NextResponse.json({
      ok:     result.ok,
      total:  result.total || 0,
      digest: result.digest || { analystUpdates: [], projectUpdates: [], flags: [], todos: [] },
      error:  result.error,
    })
  } catch (e) {
    console.error('[slack-sync-now]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
