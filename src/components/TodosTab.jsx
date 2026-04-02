'use client'
import { useState } from 'react'

const PRIORITY_COLORS = { high: 'badge-red', normal: 'badge-gray', low: 'badge-gray' }

function fmt(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TodosTab({ todos, setTodos, analysts, loading, showToast }) {
  const [text, setText] = useState('')
  const [analystId, setAnalystId] = useState('')
  const [priority, setPriority] = useState('normal')
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)

  async function addTodo() {
    if (!text.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), analystId: analystId || null, priority }),
      })
      if (!res.ok) throw new Error('Failed to add todo')
      const todo = await res.json()
      setTodos(prev => [todo, ...prev])
      setText(''); setAnalystId(''); setPriority('normal')
    } catch (e) { showToast(e.message) } finally { setAdding(false) }
  }

  async function toggleDone(todo) {
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !todo.done }),
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

  const visible = todos.filter(t => {
    if (filter === 'open') return !t.done
    if (filter === 'done') return t.done
    return true
  })

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">My To-Dos</div>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="todos-add-row">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="Add a to-do..." />
          <select value={analystId} onChange={e => setAnalystId(e.target.value)} style={{ width: 140 }}>
            <option value="">No person</option>
            {analysts.filter(a => !a.pending).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: 110 }}>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <button className="btn btn-primary" onClick={addTodo} disabled={adding || !text.trim()}>Add</button>
        </div>
      </div>

      {visible.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon">✅</div>You're all caught up.</div>
      )}

      {visible.length > 0 && (
        <div className="card">
          <div className="todo-list">
            {visible.map(t => (
              <div key={t.id} className="todo-item">
                <input type="checkbox" className="todo-checkbox" checked={t.done} onChange={() => toggleDone(t)} />
                <div style={{ flex: 1 }}>
                  <div className={`todo-text${t.done ? ' done' : ''}`}>{t.text}</div>
                  <div className="todo-tags">
                    {t.analyst && <span className="badge badge-blue">{t.analyst.name}</span>}
                    {t.priority !== 'normal' && <span className={`badge ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>}
                    <span className="text-sm text-muted">{fmt(t.createdAt)}</span>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-tertiary)', fontSize: 15, opacity: 0.6 }}
                  onClick={() => deleteTodo(t.id)} title="Delete">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
