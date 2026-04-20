'use client'
import { useState, useEffect, useRef } from 'react'

function todayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function tomorrowStr() {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function fmtEventTime(start) {
  if (!start) return ''
  if (start.allDay) return 'All day'
  if (start.iso) {
    try {
      return new Date(start.iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } catch (_) { return '' }
  }
  return ''
}

const ANALYST_COLORS = [
  'var(--accent-blue)',
  '#a855f7',
  '#f97316',
  '#10b981',
  '#f43f5e',
  '#06b6d4',
  '#84cc16',
  '#f59e0b',
]

export default function TodayTab({ analysts, showToast }) {
  const [todayTasks, setTodayTasks] = useState([])
  const [tomorrowTasks, setTomorrowTasks] = useState([])
  const [viewDate, setViewDate] = useState('today')
  const [calendarData, setCalendarData] = useState({ events: [], prepNotes: {}, configured: false })
  const [chatLog, setChatLog] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addingFor, setAddingFor] = useState(null) // analystId currently showing inline add input
  const [addText, setAddText] = useState('')
  const [addingDate, setAddingDate] = useState('today')
  const chatBottomRef = useRef(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [tasksRes, calRes] = await Promise.all([
          fetch('/api/tasks/daily'),
          fetch('/api/calendar/today'),
        ])
        const tasksData = await tasksRes.json()
        const calData = await calRes.json()
        setTodayTasks(tasksData.todayTasks || [])
        setTomorrowTasks(tasksData.tomorrowTasks || [])
        setCalendarData(calData)
      } catch (e) {
        showToast('Failed to load board data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLog])

  const activeTasks = viewDate === 'today' ? todayTasks : tomorrowTasks

  async function handleToggleDone(task) {
    const newStatus = task.status === 'done' ? 'active' : 'done'
    try {
      const res = await fetch(`/api/tasks/daily/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      if (viewDate === 'today') {
        setTodayTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      } else {
        setTomorrowTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      }
    } catch (e) { showToast(e.message) }
  }

  async function handleDeleteTask(task) {
    try {
      await fetch(`/api/tasks/daily/${task.id}`, { method: 'DELETE' })
      if (viewDate === 'today') {
        setTodayTasks(prev => prev.filter(t => t.id !== task.id))
      } else {
        setTomorrowTasks(prev => prev.filter(t => t.id !== task.id))
      }
    } catch (e) { showToast(e.message) }
  }

  async function handleAddTask(analystId) {
    if (!addText.trim()) return
    const forDate = addingDate === 'today' ? todayStr() : tomorrowStr()
    try {
      const res = await fetch('/api/tasks/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analystId, task: addText.trim(), forDate }),
      })
      if (!res.ok) throw new Error('Failed to add task')
      const created = await res.json()
      if (forDate === todayStr()) {
        setTodayTasks(prev => [...prev, created])
      } else {
        setTomorrowTasks(prev => [...prev, created])
      }
      setAddText('')
      setAddingFor(null)
    } catch (e) { showToast(e.message) }
  }

  async function handleSendChat() {
    if (!chatInput.trim() || sending) return
    const message = chatInput.trim()
    setChatInput('')
    setChatLog(prev => [...prev, { role: 'user', content: message }])
    setSending(true)
    try {
      const currentTasks = [...todayTasks, ...tomorrowTasks].map(t => ({
        id: t.id,
        analystId: t.analystId,
        analystName: t.analyst?.name || t.analystId,
        task: t.task,
        status: t.status,
        forDate: t.forDate,
      }))
      const res = await fetch('/api/tasks/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, currentTasks, forDate: viewDate }),
      })
      if (!res.ok) throw new Error('Chat failed')
      const data = await res.json()
      if (data.updatedTasks) setTodayTasks(data.updatedTasks)
      if (data.tomorrowTasks) setTomorrowTasks(data.tomorrowTasks)
      setChatLog(prev => [...prev, { role: 'assistant', content: data.reply || 'Done.' }])
    } catch (e) {
      showToast(e.message)
      setChatLog(prev => [...prev, { role: 'assistant', content: 'Error: ' + e.message }])
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="empty-state">Loading board…</div>

  const activeAnalysts = analysts.filter(a => !a.pending)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Date toggle */}
      <div className="tab-header">
        <div className="tab-title">Today's Board</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`btn btn-sm${viewDate === 'today' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setViewDate('today')}
          >
            Today
          </button>
          <button
            className={`btn btn-sm${viewDate === 'tomorrow' ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setViewDate('tomorrow')}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* ── Calendar section ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label" style={{ marginBottom: 10 }}>
          Calendar — {viewDate === 'today' ? 'Today' : 'Tomorrow'}
        </div>
        {!calendarData.configured ? (
          <div className="empty-state" style={{ padding: '12px 0' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
              No calendar connected.{' '}
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 13, color: 'var(--accent-blue)', padding: '0 2px' }}
                onClick={() => {}}
              >
                Add ICS URL in Settings
              </button>
            </span>
          </div>
        ) : calendarData.events.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No events today.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {calendarData.events.map((ev, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '8px 10px',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                alignItems: 'flex-start',
              }}>
                <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, minWidth: 70, flexShrink: 0, paddingTop: 1 }}>
                  {fmtEventTime(ev.start)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{ev.title}</div>
                  {ev.location && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>📍 {ev.location}</div>
                  )}
                  {calendarData.prepNotes?.[ev.title] && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', marginTop: 4,
                      padding: '4px 8px', background: 'var(--accent-blue-bg, rgba(59,130,246,0.08))',
                      borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--accent-blue)',
                    }}>
                      {calendarData.prepNotes[ev.title]}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Task board ── */}
      <div className="section-label" style={{ marginBottom: 10 }}>
        Task Board — {viewDate === 'today' ? todayStr() : tomorrowStr()}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        {activeAnalysts.map((analyst, idx) => {
          const tasks = activeTasks.filter(t => t.analystId === analyst.id)
          const color = ANALYST_COLORS[analyst.color % ANALYST_COLORS.length] || ANALYST_COLORS[idx % ANALYST_COLORS.length]
          const isAdding = addingFor === analyst.id
          return (
            <div key={analyst.id} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: color, flexShrink: 0,
                }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{analyst.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{tasks.length}</div>
              </div>

              {tasks.length === 0 && !isAdding && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>No tasks</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                {tasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={task.status === 'done'}
                      onChange={() => handleToggleDone(task)}
                      style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{
                      flex: 1, fontSize: 13, lineHeight: 1.4,
                      color: task.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      textDecoration: task.status === 'done' ? 'line-through' : 'none',
                    }}>
                      {task.task}
                      {task.status === 'blocked' && (
                        <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 10 }}>blocked</span>
                      )}
                    </span>
                    <button
                      onClick={() => handleDeleteTask(task)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-tertiary)', fontSize: 13, opacity: 0.5,
                        padding: '0 2px', flexShrink: 0, lineHeight: 1,
                      }}
                      title="Delete task"
                    >✕</button>
                  </div>
                ))}
              </div>

              {isAdding ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    autoFocus
                    value={addText}
                    onChange={e => setAddText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTask(analyst.id)
                      if (e.key === 'Escape') { setAddingFor(null); setAddText('') }
                    }}
                    placeholder="Task description…"
                    style={{ fontSize: 12, padding: '4px 8px', width: '100%', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={addingDate}
                      onChange={e => setAddingDate(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 6px', flex: 1 }}
                    >
                      <option value="today">Today</option>
                      <option value="tomorrow">Tomorrow</option>
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAddTask(analyst.id)} disabled={!addText.trim()}>Add</button>
                    <button className="btn btn-sm" onClick={() => { setAddingFor(null); setAddText('') }}>✕</button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '2px 4px', marginTop: 2 }}
                  onClick={() => { setAddingFor(analyst.id); setAddText(''); setAddingDate(viewDate) }}
                >
                  + Add task
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Task chat ── */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 4 }}>Update via chat</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Type naturally — "Jade is done with X, Celine is now on Y"
        </div>

        {chatLog.length > 0 && (
          <div style={{
            maxHeight: 240, overflowY: 'auto', marginBottom: 10,
            border: '0.5px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
            padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {chatLog.slice(-10).map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                  fontSize: 13, lineHeight: 1.4,
                  background: msg.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
            placeholder="e.g. Jade finished her eval, Celine is now blocked on review…"
            style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
            disabled={sending}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSendChat}
            disabled={sending || !chatInput.trim()}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
