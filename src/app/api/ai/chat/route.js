import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured — add it to .env.local' },
      { status: 503 }
    )
  }
  try {
    const body = await req.json()
    const client = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: body.systemPrompt || 'You are a helpful management coach.',
      messages: body.messages || [],
    })
    return NextResponse.json(response)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
