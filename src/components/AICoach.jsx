'use client'
import { useState, useRef, useEffect } from 'react'

function buildSystemPrompt(analysts, projects, meetings, todos, settings) {
  const analystList = analysts.map(a => {
    if (a.pending) return `- ${a.name}: not yet started`
    const last = a.notes?.[0]
    return `- ${a.name} (${a.role}): mood=${a.mood === 'h' ? 'Thriving' : a.mood === 'l' ? 'Needs Attention' : 'Steady'}${last ? `, last note: "${last.text.slice(0, 80)}..."` : ''}`
  }).join('\n')

  const projectList = projects.map(p => {
    const names = p.analysts?.map(pa => pa.analyst?.name).filter(Boolean).join(', ')
    return `- ${p.name} (${p.type}, ${p.status})${names ? ': ' + names : ''}`
  }).join('\n')

  const recentMeetings = meetings.slice(0, 3).map(m => {
    const names = m.analysts?.map(ma => ma.analyst?.name).filter(Boolean).join(', ')
    return `- ${m.title} (${new Date(m.date).toLocaleDateString()})${names ? ' — ' + names : ''}: ${m.notes?.slice(0, 200) || ''}...`
  }).join('\n')

  const openTodos = todos.filter(t => !t.done).map(t =>
    `- ${t.text}${t.analyst ? ' [' + t.analyst.name + ']' : ''} (${t.priority})`
  ).join('\n')

  const managerName = settings?.managerName || 'the manager'
  const managerTitle = settings?.managerTitle || 'Team Lead'

  return `You are an experienced management coach. You are speaking directly TO ${managerName}, a ${managerTitle}. Always use "you" — never refer to them by name or in third person (never say "${managerName.split(' ')[0]} should..." — say "you should..."). Be specific, direct, and practical. Reference team members by first name. Keep responses concise — 3-5 sentences max unless asked for more detail.

MANAGER: ${managerName} (${managerTitle})

CURRENT TEAM STATE:
ANALYSTS:
${analystList || 'No analysts yet.'}

PROJECTS:
${projectList || 'No projects yet.'}

RECENT MEETINGS (last 3):
${recentMeetings || 'No meetings logged yet.'}

OPEN TO-DOS:
${openTodos || 'No open to-dos.'}`
}

const QUICK_ASKS = [
  'Who needs a check-in?',
  'Team snapshot',
  'What should I focus on this week?',
  'Project risks?',
  'How do I onboard my new analyst?',
]

export default function AICoach({ analysts, projects, meetings, todos, settings, showToast }) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('coach-history') || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    localStorage.setItem('coach-history', JSON.stringify(messages.slice(-40)))
  }, [messages])

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')
    const next = [...messages, { role: 'user', content: userMsg }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          systemPrompt: buildSystemPrompt(analysts, projects, meetings, todos, settings),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'AI request failed')
      }
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'No response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      showToast(e.message)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-coach">
      <div className="ai-header">
        <div className="ai-title">AI team coach</div>
        <div className="ai-subtitle">Ask anything about your team.</div>
      </div>

      <div className="chat-window">
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 'auto', textAlign: 'center' }}>
            Ask me anything about your team, projects, or how to be a better manager.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === 'user' ? 'user' : 'ai'}`}>
            <div className="chat-label">{m.role === 'user' ? 'You' : 'AI coach'}</div>
            <div className={`chat-bubble ${m.role === 'user' ? 'user' : 'ai'}`}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg ai">
            <div className="chat-label">AI coach</div>
            <div className="chat-bubble ai">
              <span className="typing-dot">●</span>{' '}
              <span className="typing-dot">●</span>{' '}
              <span className="typing-dot">●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && send()}
          placeholder="Ask anything..."
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()}>Send</button>
        <button className="btn" onClick={() => { setMessages([]); localStorage.removeItem('coach-history') }} disabled={loading}>Clear history</button>
      </div>

      <div className="quick-asks">
        {QUICK_ASKS.map(q => (
          <button key={q} className="quick-ask-btn" onClick={() => send(q)} disabled={loading}>{q}</button>
        ))}
      </div>
    </div>
  )
}
