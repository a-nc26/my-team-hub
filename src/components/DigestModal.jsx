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
  const [applying, setApplying] = useState(false)

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

  async function apply() {
    setApplying(true)
    try {
      const promises = []

      ;(digest.analystUpdates || []).forEach((u, i) => {
        if (!analystChecks[i]) return
        const analyst = analysts.find(a =>
          a.name.toLowerCase().includes(u.name?.toLowerCase()) ||
          u.name?.toLowerCase().includes(a.name.toLowerCase().split(' ')[0])
        ) || (u.id ? analysts.find(a => a.id === u.id) : null)
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
        const project = projects.find(p => p.name.toLowerCase().includes(u.name?.toLowerCase())) ||
          (u.id ? projects.find(p => p.id === u.id) : null)
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
          body: JSON.stringify({ text: f, priority: 'high' }),
        }))
      })

      ;(digest.todos || []).forEach((t, i) => {
        if (!todoChecks[i]) return
        promises.push(fetch('/api/todos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, priority: 'normal' }),
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

  const total = Object.values({...analystChecks,...projectChecks,...flagChecks,...todoChecks}).filter(Boolean).length

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
                <input type="checkbox" checked={!!analystChecks[i]} onChange={e => setAnalystChecks(prev => ({...prev,[i]:e.target.checked}))} />
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
                <input type="checkbox" checked={!!projectChecks[i]} onChange={e => setProjectChecks(prev => ({...prev,[i]:e.target.checked}))} />
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
            <div className="digest-section-title">⚠️ Flags</div>
            {digest.flags.map((f, i) => (
              <div key={i} className="digest-item flag-item">
                <input type="checkbox" checked={!!flagChecks[i]} onChange={e => setFlagChecks(prev => ({...prev,[i]:e.target.checked}))} />
                <div className="digest-item-content"><div style={{ fontSize: 13 }}>{f}</div></div>
              </div>
            ))}
          </div>
        )}

        {(digest.todos || []).length > 0 && (
          <div className="digest-section">
            <div className="digest-section-title">Suggested to-dos</div>
            {digest.todos.map((t, i) => (
              <div key={i} className="digest-item todo-item">
                <input type="checkbox" checked={!!todoChecks[i]} onChange={e => setTodoChecks(prev => ({...prev,[i]:e.target.checked}))} />
                <div className="digest-item-content"><div style={{ fontSize: 13 }}>{t}</div></div>
              </div>
            ))}
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
