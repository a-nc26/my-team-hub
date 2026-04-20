'use client'
import { useState, useRef, useEffect } from 'react'

const PRIORITY_COLORS = { high: 'badge-red', normal: 'badge-gray', low: 'badge-gray' }

function fmt(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Single todo row ────────────────────────────────────────────────────────────
function TodoItem({ t, onComplete, onUncomplete, onDelete }) {
  const [completing, setCompleting] = useState(false)
  const [note, setNote]             = useState('')
  const inputRef                    = useRef(null)

  useEffect(() => {
    if (completing) inputRef.current?.focus()
  }, [completing])

  function handleCheckbox() {
    if (t.done) {
      onUncomplete(t)
    } else {
      setCompleting(true)
    }
  }

  function handleConfirm() {
    onComplete(t, note.trim())
    setCompleting(false)
    setNote('')
  }

  function handleCancel() {
    setCompleting(false)
    setNote('')
  }

  return (
    <div className="todo-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
        <input
          type="checkbox"
          className="todo-checkbox"
          checked={t.done}
          onChange={handleCheckbox}
          style={{ marginTop: 3 }}
        />
        <div style={{ flex: 1 }}>
          <div className={`todo-text${t.done ? ' done' : ''}`}>{t.text}</div>
          <div className="todo-tags">
            {t.analyst && <span className="badge badge-blue">{t.analyst.name}</span>}
            {t.priority !== 'normal' && <span className={`badge ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>}
            <span className="text-sm text-muted">{fmt(t.createdAt)}</span>
            {t.done && t.completedAt && (
              <span className="text-sm text-muted">· done {fmt(t.completedAt)}</span>
            )}
          </div>
          {/* Completion note display (on done todos) */}
          {t.done && t.completionNote && (
            <div style={{
              marginTop: 4, fontSize: 12, color: 'var(--text-secondary)',
              padding: '4px 8px', background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--border-light)',
              fontStyle: 'italic', lineHeight: 1.4,
            }}>
              ✓ {t.completionNote}
            </div>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--text-tertiary)', fontSize: 15, opacity: 0.6, flexShrink: 0 }}
          onClick={() => onDelete(t.id)}
          title="Delete"
        >✕</button>
      </div>

      {/* Completion note input — slides in when checkbox is clicked */}
      {completing && (
        <div style={{
          marginTop: 8, marginLeft: 28,
          padding: '10px 12px',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
            What did you do? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={inputRef}
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirm()
                if (e.key === 'Escape') handleCancel()
              }}
              placeholder="e.g. Sent the summary doc to the team, scheduled follow-up…"
              style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>
              Mark done
            </button>
            <button className="btn btn-sm" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Group section ──────────────────────────────────────────────────────────────
function GroupSection({ label, todos, collapsed, onToggle, onComplete, onUncomplete, onDelete }) {
  const open = todos.filter(t => !t.done).length
  const done = todos.filter(t => t.done).length
  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.1rem 0', userSelect: 'none' }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', transition: 'transform .2s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>
          {open} open{done > 0 ? `, ${done} done` : ''}
        </span>
      </div>
      {!collapsed && (
        <div className="todo-list" style={{ marginTop: '0.5rem' }}>
          {todos.map(t => (
            <TodoItem
              key={t.id}
              t={t}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function TodosTab({ todos, setTodos, analysts, loading, showToast }) {
  const [text,        setText]        = useState('')
  const [group,       setGroup]       = useState('')
  const [customGroup, setCustomGroup] = useState('')
  const [analystId,   setAnalystId]   = useState('')
  const [priority,    setPriority]    = useState('normal')
  const [filter,      setFilter]      = useState('open')
  const [adding,      setAdding]      = useState(false)
  const [collapsed,   setCollapsed]   = useState({})

  const existingGroups = [...new Set(todos.map(t => t.group).filter(Boolean))].sort()
  const resolvedGroup  = group === '__new__' ? customGroup.trim() : group

  async function addTodo() {
    if (!text.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          group: resolvedGroup || null,
          analystId: analystId || null,
          priority,
        }),
      })
      if (!res.ok) throw new Error('Failed to add to-do')
      const todo = await res.json()
      setTodos(prev => [todo, ...prev])
      setText(''); setAnalystId(''); setPriority('normal')
      setGroup(''); setCustomGroup('')
    } catch (e) { showToast(e.message) } finally { setAdding(false) }
  }

  // Mark done — with optional completion note
  async function completeTodo(todo, completionNote) {
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true, completionNote: completionNote || null }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
    } catch (e) { showToast(e.message) }
  }

  // Un-do — immediate, no note needed
  async function uncompleteTodo(todo) {
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: false, completionNote: null }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
    } catch (e) { showToast(e.message) }
  }

  async function deleteTodo(id) {
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setTodos(prev => prev.filter(t => t.id !== id))
    } catch (e) { showToast(e.message) }
  }

  const filtered = todos.filter(t => {
    if (filter === 'open') return !t.done
    if (filter === 'done') return t.done
    return true
  })

  const groups = {}
  filtered.forEach(t => {
    const key = t.group || '__personal__'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })

  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (a === '__personal__') return 1
    if (b === '__personal__') return -1
    return a.localeCompare(b)
  })

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">My To-Dos</div>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="open">Open</option>
          <option value="done">Done</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Add form */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="todos-add-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="Add a to-do..."
            style={{ flex: '1 1 200px' }}
          />
          <select value={group} onChange={e => setGroup(e.target.value)} style={{ width: 140 }}>
            <option value="">No group</option>
            {existingGroups.map(g => <option key={g} value={g}>{g}</option>)}
            <option value="__new__">+ New group…</option>
          </select>
          {group === '__new__' && (
            <input
              value={customGroup}
              onChange={e => setCustomGroup(e.target.value)}
              placeholder="Group name…"
              style={{ width: 130 }}
              autoFocus
            />
          )}
          <select value={analystId} onChange={e => setAnalystId(e.target.value)} style={{ width: 130 }}>
            <option value="">No person</option>
            {analysts.filter(a => !a.pending).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: 100 }}>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={addTodo}
            disabled={adding || !text.trim() || (group === '__new__' && !customGroup.trim())}
          >
            Add
          </button>
        </div>
      </div>

      {groupKeys.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon">✅</div>You're all caught up.</div>
      )}

      {groupKeys.map(key => (
        <GroupSection
          key={key}
          label={key === '__personal__' ? 'Personal / General' : key}
          todos={groups[key]}
          collapsed={!!collapsed[key]}
          onToggle={() => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))}
          onComplete={completeTodo}
          onUncomplete={uncompleteTodo}
          onDelete={deleteTodo}
        />
      ))}
    </div>
  )
}
