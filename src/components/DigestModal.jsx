'use client'
import { useState } from 'react'

export default function DigestModal({ digest, analysts, projects, meetingTitle, onApply, onClose }) {
  const [analystChecks, setAnalystChecks] = useState(() =>
    Object.fromEntries((digest.analystUpdates || []).map((_, i) => [i, true]))
  )
  const [projectChecks, setProjectChecks] = useState(() =>
    Object.fromEntries((digest.projectUpdates || []).map((_, i) => [i, true]))
  )
  const [flagChecks, setFlagChecks] = useState(() =>
    Object.fromEntries((digest.flags || []).map((_, i) => [i, true]))
  )
  const [todoChecks, setTodoChecks] = useState(() =>
    Object.fromEntries((digest.todos || []).map((_, i) => [i, true]))
  )
  // Analyst links for flags and todos
  const [flagAnalysts, setFlagAnalysts] = useState(() =>
    Object.fromEntries((digest.flags || []).map((_, i) => [i, '']))
  )
  const [todoAnalysts, setTodoAnalysts] = useState(() =>
    Object.fromEntries((digest.todos || []).map((_, i) => [i, '']))
  )
  const [applying, setApplying] = useState(false)

  const activeAnalysts = (analysts || []).filter(a => !a.pending)

  const moodBadge = m => {
    if (m === 'h') return <span className="badge badge-green">Thriving</span>
    if (m === 'l') return <span className="badge badge-red">Needs attention</span>
    if (m === 'm') return <span className="badge badge-gray">Steady</span>
    return null
  }

  const statusBadge = s => {
    const map = { active: 'badge-blue', review: 'badge-purple', done: 'badge-green', blocked: 'badge-red' }
    if (!s) return null
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s}</span>
  }

  // Count separately to avoid key collision
  const total =
    Object.values(analystChecks).filter(Boolean).length +
    Object.values(projectChecks).filter(Boolean).length +
    Object.values(flagChecks).filter(Boolean).length +
    Object.values(todoChecks).filter(Boolean).length

  async function apply() {
    setApplying(true)
    try {
      const promises = []

      ;(digest.analystUpdates || []).forEach((u, i) => {
        if (!analystChecks[i]) return
        const analyst = analysts.find(a => a.id === u.id) ||
          analysts.find(a =>
            a.name.toLowerCase().includes(u.name?.toLowerCase()) ||
            u.name?.toLowerCase().includes(a.name.toLowerCase().split(' ')[0])
          )
        if (!analyst) return
        if (u.mood && u.mood !== 'null') {
          promises.push(fetch(`/api/team/${analyst.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mood: u.mood }),
          }))
        }
        if (u.note) {
          promises.push(fetch(`/api/team/${analyst.id}/notes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: u.note, mood: u.mood || 'm', source: 'digest', meetingTitle }),
          }))
        }
      })

      ;(digest.projectUpdates || []).forEach((u, i) => {
        if (!projectChecks[i]) return
        const project = (projects || []).find(p => p.id === u.id) ||
          (projects || []).find(p => p.name.toLowerCase().includes(u.name?.toLowerCase()))
        if (!project) return
        const update = {}
        if (u.status && u.status !== 'null') update.status = u.status
        if (u.note) update.notes = (project.notes ? project.notes + '\n' : '') + u.note
        if (Object.keys(update).length > 0) {
          promises.push(fetch(`/api/projects/${project.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          }))
        }
      })

      ;(digest.flags || []).forEach((f, i) => {
        if (!flagChecks[i]) return
        promises.push(fetch('/api/todos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: f, priority: 'high', analystId: flagAnalysts[i] || null }),
        }))
      })

      ;(digest.todos || []).forEach((t, i) => {
        if (!todoChecks[i]) return
        promises.push(fetch('/api/todos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, priority: 'normal', analystId: todoAnalysts[i] || null }),
        }))
      })

      await Promise.all(promises)
      onApply()
    } catch (e) {
      console.error(e)
    } finally {
      setApplying(false)
    }
  }

  const AnalystPicker = ({ value, onChange }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ fontSize: 11, padding: '2px 6px', width: 'auto', marginTop: 4, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
    >
      <option value="">Link to analyst…</option>
      {activeAnalysts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">AI Digest Results</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {(digest.analystUpdates || []).length > 0 && (
          <div className="digest-section">
            <div className="digest-section-title">Analyst updates</div>
            {digest.analystUpdates.map((u, i) => (
              <div key={i} className="digest-item">
                <input type="checkbox" checked={!!analystChecks[i]}
                  onChange={e => setAnalystChecks(prev => ({ ...prev, [i]: e.target.checked }))} />
                <div className="digest-item-content">
                  <div className="digest-item-name">{u.name} {u.mood && u.mood !== 'null' && moodBadge(u.mood)}</div>
                  <div className="digest-item-note">{u.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(digest.projectUpdates || []).length > 0 && (
          <div className="digest-section">
            <div className="digest-section-title">Project updates</div>
            {digest.projectUpdates.map((u, i) => (
              <div key={i} className="digest-item">
                <input type="checkbox" checked={!!projectChecks[i]}
                  onChange={e => setProjectChecks(prev => ({ ...prev, [i]: e.target.checked }))} />
                <div className="digest-item-content">
                  <div className="digest-item-name">{u.name} {statusBadge(u.status)}</div>
                  <div className="digest-item-note">{u.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(digest.flags || []).length > 0 && (
          <div className="digest-section">
            <div className="digest-section-title">⚠️ Flags — will be added as high-priority to-dos</div>
            {digest.flags.map((f, i) => (
              <div key={i} className="digest-item flag-item">
                <input type="checkbox" checked={!!flagChecks[i]}
                  onChange={e => setFlagChecks(prev => ({ ...prev, [i]: e.target.checked }))} />
                <div className="digest-item-content">
                  <div style={{ fontSize: 13 }}>{f}</div>
                  {flagChecks[i] && (
                    <AnalystPicker value={flagAnalysts[i]} onChange={v => setFlagAnalysts(prev => ({ ...prev, [i]: v }))} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {(digest.todos || []).length > 0 && (
          <div className="digest-section">
            <div className="digest-section-title">Suggested to-dos</div>
            {digest.todos.map((t, i) => (
              <div key={i} className="digest-item todo-item">
                <input type="checkbox" checked={!!todoChecks[i]}
                  onChange={e => setTodoChecks(prev => ({ ...prev, [i]: e.target.checked }))} />
                <div className="digest-item-content">
                  <div style={{ fontSize: 13 }}>{t}</div>
                  {todoChecks[i] && (
                    <AnalystPicker value={todoAnalysts[i]} onChange={v => setTodoAnalysts(prev => ({ ...prev, [i]: v }))} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {total === 0 && (
          <div className="empty-state" style={{ padding: '1rem 0' }}>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Select at least one item to apply.</div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close without applying</button>
          <button className="btn btn-primary" onClick={apply} disabled={applying || total === 0}>
            {applying ? <><span className="spinner" /> Applying…</> : `Apply selected (${total})`}
          </button>
        </div>
      </div>
    </div>
  )
}
