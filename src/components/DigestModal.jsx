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
  const [reminderChecks, setReminderChecks] = useState(() =>
    Object.fromEntries((digest.reminders || []).map((_, i) => [i, true]))
  )
  // Analyst links for flags and todos
  const [flagAnalysts, setFlagAnalysts] = useState(() =>
    Object.fromEntries((digest.flags || []).map((f, i) => {
      const flagAnalystId = typeof f === 'string' ? '' : (f.analystId || '')
      return [i, flagAnalystId]
    }))
  )
  const [todoAnalysts, setTodoAnalysts] = useState(() =>
    Object.fromEntries((digest.todos || []).map((_, i) => [i, '']))
  )
  // Per-item project overrides (so user can fix wrong AI matches)
  const [projectOverrides, setProjectOverrides] = useState(() =>
    Object.fromEntries((digest.projectUpdates || []).map((u, i) => {
      const matched = (projects || []).find(p => p.id === u.id) ||
        (projects || []).find(p => p.name.toLowerCase().includes(u.name?.toLowerCase() || '___'))
      return [i, matched?.id || '']
    }))
  )
  const [applying, setApplying] = useState(false)

  const activeAnalysts = (analysts || []).filter(a => !a.pending)
  const activeProjects = (projects || []).filter(p => p.status !== 'done')

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
    Object.values(todoChecks).filter(Boolean).length +
    Object.values(reminderChecks).filter(Boolean).length

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
        // Use user override first, then AI match, then name fuzzy
        const overrideId = projectOverrides[i]
        const project = (overrideId && (projects || []).find(p => p.id === overrideId)) ||
          (projects || []).find(p => p.id === u.id) ||
          (projects || []).find(p => p.name.toLowerCase().includes(u.name?.toLowerCase() || '___'))
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
        const flagText = typeof f === 'string' ? f : f.text
        const linkedAnalystId = flagAnalysts[i] || null
        if (linkedAnalystId) {
          // Save as a concern note under the analyst
          promises.push(fetch(`/api/team/${linkedAnalystId}/notes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: `⚠️ ${flagText}`, mood: 'l', source: 'digest', meetingTitle }),
          }))
        } else {
          // No analyst linked — fall back to a high-priority todo
          promises.push(fetch('/api/todos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: flagText, priority: 'high' }),
          }))
        }
      })

      ;(digest.todos || []).forEach((t, i) => {
        if (!todoChecks[i]) return
        promises.push(fetch('/api/todos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, priority: 'normal', analystId: todoAnalysts[i] || null }),
        }))
      })

      ;(digest.reminders || []).forEach((r, i) => {
        if (!reminderChecks[i]) return
        promises.push(fetch('/api/reminders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: r }),
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

  const ProjectPicker = ({ value, onChange, suggestedName }) => {
    const matched = value && (projects || []).find(p => p.id === value)
    const isWrongGuess = !value && suggestedName
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            fontSize: 11, padding: '2px 6px', width: 'auto',
            color: value ? 'var(--text-primary)' : '#d97706',
            borderColor: !value ? '#d97706' : undefined,
          }}
        >
          <option value="">{suggestedName ? `⚠ "${suggestedName}" not found — pick project` : 'Link to project…'}</option>
          {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {matched && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→ {matched.name}</span>}
      </div>
    )
  }

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
            {digest.projectUpdates.map((u, i) => {
              const resolvedId = projectOverrides[i]
              const resolved = resolvedId && (projects || []).find(p => p.id === resolvedId)
              const aiGuessFound = !!(projects || []).find(p => p.id === u.id || p.name.toLowerCase().includes(u.name?.toLowerCase() || '___'))
              return (
                <div key={i} className="digest-item">
                  <input type="checkbox" checked={!!projectChecks[i]}
                    onChange={e => setProjectChecks(prev => ({ ...prev, [i]: e.target.checked }))} />
                  <div className="digest-item-content">
                    <div className="digest-item-name">
                      {resolved ? resolved.name : u.name}
                      {' '}{statusBadge(u.status)}
                      {!aiGuessFound && !resolvedId && (
                        <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600, marginLeft: 6 }}>⚠ no match</span>
                      )}
                    </div>
                    <div className="digest-item-note">{u.note}</div>
                    {projectChecks[i] && (
                      <ProjectPicker
                        value={resolvedId}
                        onChange={v => setProjectOverrides(prev => ({ ...prev, [i]: v }))}
                        suggestedName={!aiGuessFound ? u.name : null}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {(digest.flags || []).length > 0 && (
          <div className="digest-section">
            <div className="digest-section-title">⚠️ Flags — saved as concern note under analyst (link one below)</div>
            {digest.flags.map((f, i) => {
              const flagText = typeof f === 'string' ? f : f.text
              return (
                <div key={i} className="digest-item flag-item">
                  <input type="checkbox" checked={!!flagChecks[i]}
                    onChange={e => setFlagChecks(prev => ({ ...prev, [i]: e.target.checked }))} />
                  <div className="digest-item-content">
                    <div style={{ fontSize: 13 }}>{flagText}</div>
                    {flagChecks[i] && (
                      <AnalystPicker value={flagAnalysts[i]} onChange={v => setFlagAnalysts(prev => ({ ...prev, [i]: v }))} />
                    )}
                  </div>
                </div>
              )
            })}
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

        {(digest.reminders || []).length > 0 && (
          <div className="digest-section">
            <div className="digest-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📌 Standing reminders</span>
              <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: 10 }}>added to every brief until dismissed</span>
            </div>
            {digest.reminders.map((r, i) => (
              <div key={i} className="digest-item" style={{ background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <input type="checkbox" checked={!!reminderChecks[i]}
                  onChange={e => setReminderChecks(prev => ({ ...prev, [i]: e.target.checked }))} />
                <div className="digest-item-content">
                  <div style={{ fontSize: 13 }}>{r}</div>
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
