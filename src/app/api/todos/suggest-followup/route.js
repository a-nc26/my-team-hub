import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req) {
  try {
    const { todoText, completionNote, analystId } = await req.json()

    if (!todoText || !completionNote) {
      return NextResponse.json({ needsFollowup: false, suggestion: null })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 100,
      system: `You are a team lead assistant. Detect if a completed task implies a follow-up action is needed.
Return ONLY valid JSON: {"needsFollowup": true/false, "suggestion": "Short follow-up task text" | null}
Suggestion must be a concrete actionable task under 10 words, or null.
Look for signals like: waiting for a reply, scheduled something for later, sent something pending review, left a message, blocked on someone, promised to check back, or anything incomplete.`,
      messages: [{
        role: 'user',
        content: `Task: "${todoText}"\nCompletion note: "${completionNote}"\n\nDoes this imply a follow-up action is needed?`
      }],
    })

    const raw = response.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json({
        needsFollowup: !!parsed.needsFollowup,
        suggestion: parsed.suggestion || null,
      })
    }

    return NextResponse.json({ needsFollowup: false, suggestion: null })
  } catch (e) {
    // Best-effort — never block the completion flow
    return NextResponse.json({ needsFollowup: false, suggestion: null })
  }
}
