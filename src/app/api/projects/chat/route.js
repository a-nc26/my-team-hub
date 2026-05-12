import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic()

const TOOLS = [
  {
    name: 'list_projects',
    description: 'Get all current projects with their names, IDs, status, milestones, and recent updates. Call this first whenever the user refers to a project by name.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_project',
    description: 'Create a new project. Gather the project name before calling. Ask about type, deadline, and status if not mentioned — but don\'t block on it, use sensible defaults.',
    input_schema: {
      type: 'object',
      properties: {
        name:      { type: 'string', description: 'Project name' },
        type:      { type: 'string', enum: ['google', 'side'], description: 'google = Google project, side = side/other work' },
        status:    { type: 'string', enum: ['active', 'review', 'blocked', 'hold', 'done'] },
        notes:     { type: 'string', description: 'Brief description or context' },
        startDate: { type: 'string', description: 'YYYY-MM-DD or omit' },
        endDate:   { type: 'string', description: 'Deadline in YYYY-MM-DD or omit' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_project',
    description: 'Update an existing project — change name, status, notes, or dates. Use list_projects first to get the project ID.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project\'s ID from list_projects' },
        name:      { type: 'string' },
        type:      { type: 'string', enum: ['google', 'side'] },
        status:    { type: 'string', enum: ['active', 'review', 'blocked', 'hold', 'done'] },
        notes:     { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM-DD, or empty string to clear' },
        endDate:   { type: 'string', description: 'YYYY-MM-DD, or empty string to clear' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'add_milestone',
    description: 'Add a milestone checkpoint to a project.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title:     { type: 'string', description: 'e.g. "Draft review complete"' },
        dueDate:   { type: 'string', description: 'YYYY-MM-DD or omit' },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'add_update',
    description: 'Log a progress update or note on a project.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        note:      { type: 'string', description: 'The progress note text' },
      },
      required: ['projectId', 'note'],
    },
  },
]

async function runTool(name, input) {
  switch (name) {
    case 'list_projects': {
      const ps = await prisma.project.findMany({
        include: {
          analysts: { include: { analyst: true } },
          projectNotes: { orderBy: { createdAt: 'desc' }, take: 2 },
          milestones:   { orderBy: { dueDate: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return ps.map(p => ({
        id:        p.id,
        name:      p.name,
        type:      p.type,
        status:    p.status,
        notes:     p.notes,
        startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
        endDate:   p.endDate?.toISOString().slice(0, 10)   ?? null,
        analysts:  p.analysts.map(a => a.analyst.name),
        milestones: p.milestones.map(m => ({
          id: m.id, title: m.title, dueDate: m.dueDate, done: m.done,
        })),
        recentUpdates: p.projectNotes.map(n => ({ text: n.text, date: n.createdAt })),
      }))
    }

    case 'create_project': {
      const defaultFields = [
        { id: 'harmArea', label: 'Harm Area', type: 'text' },
        { id: 'amount',   label: 'Amount',    type: 'number' },
      ]
      const p = await prisma.project.create({
        data: {
          name:      input.name,
          type:      input.type || 'google',
          status:    input.status || 'active',
          notes:     input.notes || '',
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate:   input.endDate   ? new Date(input.endDate)   : null,
          fieldDefs: defaultFields,
        },
        include: {
          analysts:     { include: { analyst: true } },
          projectNotes: { orderBy: { createdAt: 'desc' } },
          milestones:   { orderBy: { dueDate: 'asc' } },
        },
      })
      return { success: true, project: p }
    }

    case 'update_project': {
      const { projectId, ...fields } = input
      const data = { updatedAt: new Date() }
      if (fields.name   !== undefined) data.name   = fields.name
      if (fields.type   !== undefined) data.type   = fields.type
      if (fields.status !== undefined) data.status = fields.status
      if (fields.notes  !== undefined) data.notes  = fields.notes
      if (fields.startDate !== undefined)
        data.startDate = fields.startDate ? new Date(fields.startDate) : null
      if (fields.endDate !== undefined)
        data.endDate = fields.endDate ? new Date(fields.endDate) : null
      const p = await prisma.project.update({
        where: { id: projectId },
        data,
        include: {
          analysts:     { include: { analyst: true } },
          projectNotes: { orderBy: { createdAt: 'desc' } },
          milestones:   { orderBy: { dueDate: 'asc' } },
        },
      })
      return { success: true, project: p }
    }

    case 'add_milestone': {
      const m = await prisma.projectMilestone.create({
        data: {
          projectId: input.projectId,
          title:     input.title,
          dueDate:   input.dueDate || null,
        },
      })
      return { success: true, milestone: m }
    }

    case 'add_update': {
      const n = await prisma.projectNote.create({
        data: {
          projectId: input.projectId,
          text:      input.note,
          mentionedAnalystIds: [],
        },
      })
      return { success: true, note: n }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

export async function POST(req) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const apiMessages = [...messages]
    let finalText = ''
    let actionsCount = 0

    // Agentic loop — max 8 rounds to avoid runaway calls
    for (let i = 0; i < 8; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: `You are a project management assistant for a Trust & Safety team lead. Today is ${today}.

You help create, update, and track projects conversationally. Rules:
- When the user mentions a project by name, call list_projects to get its ID first.
- Ask short follow-up questions naturally if key info is missing (e.g. "What's the deadline?").
- Don't ask for things you can default (type defaults to google, status defaults to active).
- After taking an action, confirm briefly what you did. Be concise.
- For status: active = in progress, review = waiting for feedback, blocked = something's stopping it, hold = paused, done = complete.
- For type: google = Google project, side = side/internal work.`,
        tools: TOOLS,
        messages: apiMessages,
      })

      if (response.stop_reason === 'end_turn') {
        finalText = response.content.find(b => b.type === 'text')?.text || ''
        break
      }

      if (response.stop_reason === 'tool_use') {
        const toolBlocks = response.content.filter(b => b.type === 'tool_use')
        apiMessages.push({ role: 'assistant', content: response.content })

        const results = []
        for (const block of toolBlocks) {
          const result = await runTool(block.name, block.input)
          if (block.name !== 'list_projects') actionsCount++
          results.push({
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          })
        }
        apiMessages.push({ role: 'user', content: results })
      }
    }

    return NextResponse.json({ message: finalText, actionsCount })
  } catch (e) {
    console.error('[projects/chat]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
