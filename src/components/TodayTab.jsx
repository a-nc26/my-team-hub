'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr()    { return toDateStr(new Date()) }
function fromDateStr(s) { return new Date(s + 'T12:00:00') } // noon avoids tz-shift

// Get Monday of the week containing the given date string
function getWeekMonday(dateStr) {
  const d = fromDateStr(dateStr)
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return toDateStr(d)
}

// Return 7 YYYY-MM-DD strings Mon→Sun starting from monday
function getWeekDays(monday) {
  const days = []
  const base = fromDateStr(monday)
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    days.push(toDateStr(d))
  }
  return days
}

function shiftWeek(monday, delta) {
  const d = fromDateStr(monday)
  d.setDate(d.getDate() + delta * 7)
  return toDateStr(d)
}

function fmtDayBtn(dateStr) {
  const d = fromDateStr(dateStr)
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    day:     d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function fmtEventTime(start) {
  if (!start) return ''
  if (start.allDay) return 'All day'
  if (start.iso) {
    try { return new Date(start.iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
    catch (_) { return '' }
  }
  return ''
}

// ── TaskItem — single task row with completion note flow ──────────────────────
function TaskItem({ task, onComplete, onReactivate, onDelete }) {
  const [completing, setCompleting] = useState(false)
  const [note,       setNote]       = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (completing) inputRef.current?.focus() }, [completing])

  function handleCheck() {
    if (task.status === 'done') { onReactivate(task) }
    else { setCompleting(true) }
  }

  function handleConfirm() {
    onComplete(task, note.trim())
    setCompleting(false)
    setNote('')
  }

  function handleCancel() { setCompleting(false); setNote('') }

  return (
    <div style={{ marginBottom: 6 }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onChange={handleCheck}
          style={{ marginTop: 3, cursor: 'pointer', flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: 13, lineHeight: 1.4,
            color:          task.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)',
            textDecoration: task.status === 'done' ? 'line-through' : 'none',
          }}>
            {task.task}
          </span>
          {task.status === 'blocked' && (
            <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 10 }}>blocked</span>
          )}
          {/* Completion note shown on done tasks */}
          {task.status === 'done' && task.completionNote && (
            <div style={{
              marginTop: 3, fontSize: 11, color: 'var(--text-secondary)',
              fontStyle: 'italic', lineHeight: 1.4,
              padding: '3px 6px', background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--border-light)',
            }}>
              ✓ {task.completionNote}
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(task)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, opacity: 0.5, padding: '0 2px', flexShrink: 0 }}
          title="Delete"
        >✕</button>
      </div>

      {/* Completion note input */}
      {completing && (
        <div style={{
          marginTop: 6, marginLeft: 20,
          padding: '8px 10px',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5, fontWeight: 500 }}>
            What did you do? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <input
              ref={inputRef}
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleCancel() }}
              placeholder="Quick note on what was done…"
              style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>Done</button>
            <button className="btn btn-sm" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function TodayTab({ analysts, showToast, calendarUrl, onOpenSettings }) {
  const today                             = todayStr()
  const [selectedDate, setSelectedDate]   = useState(today)
  const [weekMonday,   setWeekMonday]     = useState(() => getWeekMonday(today))
  const [tasks,        setTasks]          = useState([])
  const [calendarData, setCalendarData]   = useState({ events: [], prepNotes: {}, configured: false })
  const [chatLog,      setChatLog]        = useState([])
  const [chatInput,    setChatInput]      = useState('')
  const [sending,      setSending]        = useState(false)
  const [loadingTasks, setLoadingTasks]   = useState(true)
  const [loadingCal,   setLoadingCal]     = useState(false)
  const [addingFor,    setAddingFor]      = useState(null)
  const [addText,      setAddText]        = useState('')
  const chatBottomRef                     = useRef(null)

  // Fetch tasks for selected date
  const fetchTasks = useCallback(async (date) => {
    setLoadingTasks(true)
    try {
      const res  = await fetch(`/api/tasks/daily?date=${date}`)
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : (data.todayTasks || []))
    } catch (e) { showToast('Failed to load tasks') }
    finally { setLoadingTasks(false) }
  }, [showToast])

  // Fetch calendar for selected date (re-runs when date or calendarUrl changes)
  const fetchCalendar = useCallback(async (date) => {
    setLoadingCal(true)
    try {
      const res  = await fetch(`/api/calendar/today?date=${date}`)
      const data = await res.json()
      setCalendarData(data)
    } catch (_) { /* non-fatal */ }
    finally { setLoadingCal(false) }
  }, [])

  useEffect(() => { fetchTasks(selectedDate)    }, [selectedDate, fetchTasks])
  useEffect(() => { fetchCalendar(selectedDate) }, [selectedDate, calendarUrl, fetchCalendar])
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatLog])

  // ── Task CRUD ───────────────────────────────────────────────────────────────
  async function handleAddTask(analystId) {
    if (!addText.trim()) return
    try {
      const res = await fetch('/api/tasks/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analystId, task: addText.trim(), forDate: selectedDate }),
      })
      if (!res.ok) throw new Error('Failed to add task')
      const created = await res.json()
      setTasks(prev => [...prev, created])
      setAddText(''); setAddingFor(null)
    } catch (e) { showToast(e.message) }
  }

  async function handleComplete(task, completionNote) {
    try {
      const res = await fetch(`/api/tasks/daily/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done', completionNote: completionNote || null }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } catch (e) { showToast(e.message) }
  }

  async function handleReactivate(task) {
    try {
      const res = await fetch(`/api/tasks/daily/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', completionNote: null }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } catch (e) { showToast(e.message) }
  }

  async function handleDelete(task) {
    try {
      await fetch(`/api/tasks/daily/${task.id}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.id !== task.id))
    } catch (e) { showToast(e.message) }
  }

  // ── Chat ────────────────────────────────────────────────────────────────────
  async function handleSendChat() {
    if (!chatInput.trim() || sending) return
    const message = chatInput.trim()
    setChatInput('')
    setChatLog(prev => [...prev, { role: 'user', content: message }])
    setSending(true)
    try {
      const currentTasks = tasks.map(t => ({
        id: t.id, analystId: t.analystId,
        analystName: t.analyst?.name || t.analystId,
        task: t.task, status: t.status, forDate: t.forDate,
      }))
      const res  = await fetch('/api/tasks/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, currentTasks, forDate: selectedDate }),
      })
      if (!res.ok) throw new Error('Chat failed')
      const data = await res.json()
      // Refresh tasks for current date after chat applies updates
      fetchTasks(selectedDate)
      setChatLog(prev => [...prev, { role: 'assistant', content: data.reply || 'Done.' }])
    } catch (e) {
      showToast(e.message)
      setChatLog(prev => [...prev, { role: 'assistant', content: 'Error: ' + e.message }])
    } finally { setSending(false) }
  }

  // ── Week navigation ─────────────────────────────────────────────────────────
  const weekDays = getWeekDays(weekMonday)

  function selectDate(date) {
    setSelectedDate(date)
    // If date is outside current displayed week, shift week view
    if (!weekDays.includes(date)) setWeekMonday(getWeekMonday(date))
  }

  const activeAnalysts = analysts.filter(a => !a.pending)

  // ── Render ─────────────────────────────────────────────────────────────────
  const fmtSelected = fromDateStr(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  const isToday = selectedDate === today

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Week date picker ── */}
      <div className="card" style={{ marginBottom: '1rem', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Prev week */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekMonday(w => shiftWeek(w, -1))}
            style={{ fontSize: 16, padding: '2px 8px' }}
          >‹</button>

          {/* Day buttons */}
          <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
            {weekDays.map(date => {
              const { weekday, day } = fmtDayBtn(date)
              const isSelected = date === selectedDate
              const isTodayDate = date === today
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-light)',
                    background: isSelected ? 'var(--accent-blue)' : isTodayDate ? 'var(--bg-tertiary)' : 'transparent',
                    color: isSelected ? '#fff' : isTodayDate ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer', flexShrink: 0, minWidth: 58,
                    fontWeight: isTodayDate ? 600 : 400,
                  }}
                >
                  <span style={{ fontSize: 11, opacity: isSelected ? 0.85 : 0.7 }}>{weekday}</span>
                  <span style={{ fontSize: 13 }}>{day.split(' ')[1]}</span>
                  {isTodayDate && (
                    <span style={{ fontSize: 9, marginTop: 1, opacity: 0.8 }}>Today</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Next week */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekMonday(w => shiftWeek(w, 1))}
            style={{ fontSize: 16, padding: '2px 8px' }}
          >›</button>

          {/* Jump to today */}
          {selectedDate !== today && (
            <button
              className="btn btn-sm"
              onClick={() => { setSelectedDate(today); setWeekMonday(getWeekMonday(today)) }}
              style={{ fontSize: 12, flexShrink: 0 }}
            >
              Jump to today
            </button>
          )}
        </div>
      </div>

      <div className="tab-header" style={{ marginBottom: '0.75rem' }}>
        <div className="tab-title">{fmtSelected}{isToday ? ' · Today' : ''}</div>
      </div>

      {/* ── Calendar section ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="section-label" style={{ margin: 0 }}>📅 Calendar</div>
          {!calendarData.configured && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--accent-blue)' }}
              onClick={onOpenSettings}
            >
              Connect calendar →
            </button>
          )}
        </div>

        {loadingCal ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : !calendarData.configured ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            No calendar connected. Paste your Google Calendar ICS URL in Settings to see your meetings here.
          </div>
        ) : calendarData.events.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No events on this day.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {calendarData.events.map((ev, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '8px 10px',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, minWidth: 68, flexShrink: 0, paddingTop: 1 }}>
                  {fmtEventTime(ev.start)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ev.title}</div>
                  {ev.location && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>📍 {ev.location}</div>}
                  {calendarData.prepNotes?.[ev.title] && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', marginTop: 4,
                      padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                      borderLeft: '2px solid var(--accent-blue)',
                      background: 'rgba(59,130,246,0.06)',
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
        Task Board
        {loadingTasks && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8, fontSize: 11 }}>Loading…</span>}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
        gap: '0.75rem', marginBottom: '1.5rem',
      }}>
        {activeAnalysts.map(analyst => {
          const analystTasks = tasks.filter(t => t.analystId === analyst.id)
          const isAdding     = addingFor === analyst.id
          const doneCt  = analystTasks.filter(t => t.status === 'done').length
          const activeCt = analystTasks.filter(t => t.status !== 'done').length

          return (
            <div key={analyst.id} className="card" style={{ padding: '12px 14px' }}>
              {/* Analyst header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{analyst.name}</div>
                {analystTasks.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {activeCt} open{doneCt > 0 ? `, ${doneCt} done` : ''}
                  </span>
                )}
              </div>

              {/* Task list */}
              {analystTasks.length === 0 && !isAdding && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>No tasks</div>
              )}
              <div style={{ marginBottom: 6 }}>
                {analystTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onReactivate={handleReactivate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              {/* Inline add */}
              {isAdding ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    autoFocus
                    value={addText}
                    onChange={e => setAddText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  handleAddTask(analyst.id)
                      if (e.key === 'Escape') { setAddingFor(null); setAddText('') }
                    }}
                    placeholder="Task description…"
                    style={{ fontSize: 12, padding: '4px 8px', width: '100%', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAddTask(analyst.id)} disabled={!addText.trim()}>Add</button>
                    <button className="btn btn-sm" onClick={() => { setAddingFor(null); setAddText('') }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '2px 0' }}
                  onClick={() => { setAddingFor(analyst.id); setAddText('') }}
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
        <div className="section-label" style={{ marginBottom: 4 }}>💬 Update via chat</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Type naturally — "Jade is done with X, Celine is now on Y, Marcus is blocked"
        </div>

        {chatLog.length > 0 && (
          <div style={{
            maxHeight: 200, overflowY: 'auto', marginBottom: 10,
            border: '0.5px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
            padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {chatLog.slice(-10).map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                  fontSize: 13, lineHeight: 1.4,
                  background: msg.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                  color:      msg.role === 'user' ? '#fff' : 'var(--text-primary)',
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
            placeholder={`Update tasks for ${fmtSelected}…`}
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
