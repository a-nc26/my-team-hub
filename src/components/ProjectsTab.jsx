'use client'
import { useState, useCallback } from 'react'

const STATUS_BADGE   = { active: 'badge-blue', review: 'badge-purple', done: 'badge-green', blocked: 'badge-red' }
const STATUS_LABELS  = { active: 'Active', review: 'In Review', done: 'Done', blocked: 'Blocked' }
const DEFAULT_FIELDS = [
  { id: 'harmArea', label: 'Harm Area', type: 'text' },
  { id: 'amount',   label: 'Amount',    type: 'number' },
]

// ── Analyst picker + per-analyst fields table ─────────────────────────────────
function AssignmentEditor({ assignments, setAssignments, analysts, fieldDefs }) {
  const available = analysts.filter(a => !a.pending)
  const assignedIds = new Set(assignments.map(a => a.analystId))

  function addAnalyst(id) {
    if (assignedIds.has(id)) return
    setAssignments(prev => [...prev, { analystId: id, fieldValues: {} }])
  }

  function removeAnalyst(id) {
    setAssignments(prev => prev.filter(a => a.analystId !== id))
  }

  function setField(analystId, fieldId, value) {
    setAssignments(prev => prev.map(a =>
      a.analystId === analystId
        ? { ...a, fieldValues: { ...a.fieldValues, [fieldId]: value } }
        : a
    ))
  }

  return (
    <div>
      {/* Dropdown to add analyst */}
      <select
        value=""
        onChange={e => { if (e.target.value) addAnalyst(e.target.value) }}
        style={{ marginBottom: 10 }}
      >
        <option value="">+ Add analyst to project…</option>
        {available.filter(a => !assignedIds.has(a.id)).map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      {assignments.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Analyst</th>
                {fieldDefs.map(f => <th key={f.id} style={thStyle}>{f.label}</th>)}
                <th style={{ ...thStyle, width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const analyst = analysts.find(x => x.id === a.analystId)
                return (
                  <tr key={a.analystId}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{analyst?.name || a.analystId}</span>
                    </td>
                    {fieldDefs.map(f => (
                      <td key={f.id} style={tdStyle}>
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={a.fieldValues?.[f.id] || ''}
                          onChange={e => setField(a.analystId, f.id, e.target.value)}
                          placeholder={f.label}
                          style={{ width: '100%', padding: '4px 6px', fontSize: 12 }}
                        />
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <button className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '2px 6px' }}
                        onClick={() => removeAnalyst(a.analystId)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid var(--border-light)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '6px 8px', borderBottom: '0.5px solid var(--border-light)', verticalAlign: 'middle' }

// ── Project comments ──────────────────────────────────────────────────────────
function ProjectComments({ project, onNoteAdded, showToast }) {
  const [text,    setText]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(null)
  const notes = project.projectNotes || []

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Failed to save comment')
      const note = await res.json()
      onNoteAdded(project.id, note)
      setText('')
    } catch (e) { showToast(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(noteId) {
    setDeleting(noteId)
    try {
      await fetch(`/api/projects/${project.id}/notes?noteId=${noteId}`, { method: 'DELETE' })
      onNoteAdded(project.id, null, noteId)
    } catch (e) { showToast(e.message) }
    finally { setDeleting(null) }
  }

  function fmtTime(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 8 }}>
        💬 Comments {notes.length > 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({notes.length})</span>}
      </div>

      {notes.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {notes.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border-light)', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{n.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtTime(n.createdAt)}</div>
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                disabled={deleting === n.id}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, opacity: 0.5, padding: '2px 4px', flexShrink: 0 }}
                title="Delete comment">✕</button>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>No comments yet.</div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAdd()}
          placeholder="Add a comment or update…"
          style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving || !text.trim()}>
          {saving ? '…' : 'Add'}
        </button>
      </div>
    </div>
  )
}

// ── Project form (create / edit) ──────────────────────────────────────────────
function toDateInput(val) {
  if (!val) return ''
  return new Date(val).toISOString().split('T')[0]
}

function ProjectForm({ initial, analysts, onSave, onCancel }) {
  const [name,        setName]        = useState(initial?.name   || '')
  const [type,        setType]        = useState(initial?.type   || 'google')
  const [status,      setStatus]      = useState(initial?.status || 'active')
  const [notes,       setNotes]       = useState(initial?.notes  || '')
  const [startDate,   setStartDate]   = useState(toDateInput(initial?.startDate))
  const [endDate,     setEndDate]     = useState(toDateInput(initial?.endDate))
  const [fieldDefs,   setFieldDefs]   = useState(initial?.fieldDefs  ?? DEFAULT_FIELDS)
  const [assignments, setAssignments] = useState(() => {
    if (initial?.analysts?.length) {
      return initial.analysts.map(pa => ({
        analystId:   pa.analystId,
        fieldValues: pa.fieldValues || {},
      }))
    }
    return []
  })
  const [saving, setSaving] = useState(false)
  const [newFieldLabel, setNewFieldLabel] = useState('')

  function addCustomField() {
    if (!newFieldLabel.trim()) return
    const id = newFieldLabel.toLowerCase().replace(/\s+/g, '_')
    setFieldDefs(prev => [...prev, { id, label: newFieldLabel.trim(), type: 'text' }])
    setNewFieldLabel('')
  }

  function removeField(id) {
    setFieldDefs(prev => prev.filter(f => f.id !== id))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name, type, status, notes, startDate: startDate || null, endDate: endDate || null, fieldDefs, assignments })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Project name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Q2 Safety Evaluation" />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="google">Google</option>
            <option value="side">Side project</option>
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="review">In Review</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div className="form-group">
          <label>Start date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>End date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Field definitions */}
      <div className="section-label" style={{ marginBottom: 6 }}>Analyst fields</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {fieldDefs.map(f => (
          <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: 12 }}>
            {f.label}
            <button onClick={() => removeField(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
          </span>
        ))}
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomField()}
            placeholder="Add field…"
            style={{ width: 120, padding: '3px 8px', fontSize: 12 }} />
          <button className="btn btn-sm" onClick={addCustomField} disabled={!newFieldLabel.trim()}>+</button>
        </div>
      </div>

      {/* Analyst assignments */}
      <div className="section-label" style={{ marginBottom: 6 }}>Analyst assignments</div>
      <AssignmentEditor
        assignments={assignments}
        setAssignments={setAssignments}
        analysts={analysts}
        fieldDefs={fieldDefs}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Assignment table (read-only view inside project card) ──────────────────────
function AssignmentTable({ project, analysts }) {
  const fieldDefs = project.fieldDefs || DEFAULT_FIELDS
  const assignments = project.analysts || []
  if (assignments.length === 0) return null
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>Analyst</th>
            {fieldDefs.map(f => <th key={f.id} style={thStyle}>{f.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {assignments.map(pa => {
            const analyst = analysts.find(a => a.id === pa.analystId) || pa.analyst
            return (
              <tr key={pa.analystId}>
                <td style={tdStyle}><span style={{ fontWeight: 500 }}>{analyst?.name || '—'}</span></td>
                {fieldDefs.map(f => (
                  <td key={f.id} style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                    {pa.fieldValues?.[f.id] || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function ProjectsTab({ projects, setProjects, analysts, loading, showToast }) {
  const [showForm,     setShowForm]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [expanded,     setExpanded]     = useState({})

  // Called when a note is added (note = new note object) or deleted (note = null, noteId provided)
  const handleNoteChange = useCallback((projectId, note, deletedNoteId) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p
      if (deletedNoteId) {
        return { ...p, projectNotes: (p.projectNotes || []).filter(n => n.id !== deletedNoteId) }
      }
      return { ...p, projectNotes: [note, ...(p.projectNotes || [])] }
    }))
  }, [setProjects])

  async function handleCreate(data) {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create project')
      const created = await res.json()
      setProjects(prev => [created, ...prev])
      setShowForm(false)
    } catch (e) { showToast(e.message) }
  }

  async function handleUpdate(data) {
    try {
      const res = await fetch(`/api/projects/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update project')
      const updated = await res.json()
      setProjects(prev => prev.map(x => x.id === updated.id ? updated : x))
      setEditing(null)
    } catch (e) { showToast(e.message) }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setProjects(prev => prev.filter(p => p.id !== id))
      setConfirmDelete(null)
    } catch (e) { showToast(e.message) }
  }

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">Projects</div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add project</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label" style={{ marginBottom: 12 }}>New project</div>
          <ProjectForm analysts={analysts} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {projects.length === 0 && !showForm && (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          No projects yet — add your Google projects and side work here.
        </div>
      )}

      <div className="projects-list">
        {projects.map(p => (
          <div key={p.id} className="card">
            {editing?.id === p.id ? (
              <ProjectForm initial={editing} analysts={analysts} onSave={handleUpdate} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <div className="project-title-row">
                  <span className="project-name">{p.name}</span>
                  <span className={`badge ${p.type === 'google' ? 'badge-blue' : 'badge-gray'}`}>
                    {p.type === 'google' ? 'Google' : 'Side'}
                  </span>
                  <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {(p.projectNotes?.length > 0) && !expanded[p.id] && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 2 }}>
                        💬 {p.projectNotes.length}
                      </span>
                    )}
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                      {expanded[p.id] ? 'Hide ▲' : 'Details ▼'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Edit</button>
                    {confirmDelete === p.id ? (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
                        <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text-tertiary)', fontSize: 15, opacity: 0.6 }}
                        onClick={() => setConfirmDelete(p.id)} title="Delete">✕</button>
                    )}
                  </div>
                </div>
                {(p.startDate || p.endDate) && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <span>📅</span>
                    {p.startDate && <span>{new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    {p.startDate && p.endDate && <span>→</span>}
                    {p.endDate && <span>{new Date(p.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    {p.startDate && p.endDate && (() => {
                      const days = Math.round((new Date(p.endDate) - new Date(p.startDate)) / 86400000)
                      return days > 0 ? <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>· {days}d</span> : null
                    })()}
                  </div>
                )}
                {p.notes && <div className="project-notes-preview">{p.notes}</div>}
                {expanded[p.id] && (
                  <>
                    <AssignmentTable project={p} analysts={analysts} />
                    <ProjectComments
                      project={p}
                      onNoteAdded={handleNoteChange}
                      showToast={showToast}
                    />
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
