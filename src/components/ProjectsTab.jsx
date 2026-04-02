'use client'
import { useState } from 'react'

const STATUS_BADGE  = { active: 'badge-blue', review: 'badge-purple', done: 'badge-green', blocked: 'badge-red' }
const STATUS_LABELS = { active: 'Active', review: 'In Review', done: 'Done', blocked: 'Blocked' }

const DEFAULT_FIELDS = [
  { id: 'prompts',    label: 'Prompt Count', type: 'number'  },
  { id: 'ptype',     label: 'Prompt Type',  type: 'text'    },
  { id: 'abuseArea', label: 'Abuse Area',   type: 'text'    },
]

// ── Field definition editor ──────────────────────────────────────────────────
function FieldDefEditor({ fieldDefs, onChange }) {
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType]   = useState('text')

  function addField() {
    if (!newLabel.trim()) return
    const id = newLabel.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    onChange([...fieldDefs, { id, label: newLabel.trim(), type: newType }])
    setNewLabel(''); setNewType('text')
  }

  function removeField(id) {
    onChange(fieldDefs.filter(f => f.id !== id))
  }

  function renameField(id, label) {
    onChange(fieldDefs.map(f => f.id === id ? { ...f, label } : f))
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="section-label" style={{ marginBottom: 6 }}>Columns</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {fieldDefs.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '3px 8px' }}>
            <input
              value={f.label}
              onChange={e => renameField(f.id, e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 12, width: Math.max(60, f.label.length * 8), padding: 0, color: 'var(--text-primary)' }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>{f.type}</span>
            <button className="btn btn-ghost btn-sm" style={{ padding: '0 2px', fontSize: 12, opacity: 0.5 }} onClick={() => removeField(f.id)}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addField()}
          placeholder="New column name..." style={{ flex: 1, fontSize: 12 }} />
        <select value={newType} onChange={e => setNewType(e.target.value)} style={{ width: 90, fontSize: 12 }}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
        </select>
        <button className="btn btn-sm" onClick={addField} disabled={!newLabel.trim()}>+ Add</button>
      </div>
    </div>
  )
}

// ── Analyst breakdown table ───────────────────────────────────────────────────
function AnalystBreakdown({ project, allAnalysts, onAssignmentChange }) {
  const fieldDefs = project.fieldDefs || DEFAULT_FIELDS
  const assigned  = project.analysts || []

  function getVal(pa, fieldId) {
    return (pa.fieldValues || {})[fieldId] ?? ''
  }

  async function handleCellChange(analystId, fieldId, value) {
    const pa = assigned.find(a => a.analystId === analystId)
    const current = pa?.fieldValues || {}
    const updated = { ...current, [fieldId]: value }
    try {
      await fetch(`/api/projects/${project.id}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analystId, fieldValues: updated }),
      })
      onAssignmentChange(analystId, updated)
    } catch (e) { console.error(e) }
  }

  if (assigned.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>No analysts assigned yet — add them in Edit.</div>
  }

  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Analyst</th>
            {fieldDefs.map(f => (
              <th key={f.id} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assigned.map(pa => (
            <tr key={pa.analystId} style={{ borderBottom: '0.5px solid var(--border-light)' }}>
              <td style={{ padding: '6px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {pa.analyst?.name || '—'}
              </td>
              {fieldDefs.map(f => (
                <td key={f.id} style={{ padding: '4px 6px' }}>
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={getVal(pa, f.id)}
                    onChange={e => handleCellChange(pa.analystId, f.id, e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, width: '100%', minWidth: 80, padding: '3px 4px', borderRadius: 4, color: 'var(--text-primary)' }}
                    onFocus={e => e.target.style.background = 'var(--bg-secondary)'}
                    onBlur={e => e.target.style.background = 'transparent'}
                    placeholder="—"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Project form ──────────────────────────────────────────────────────────────
function ProjectForm({ initial, analysts, onSave, onCancel }) {
  const [name,        setName]        = useState(initial?.name || '')
  const [type,        setType]        = useState(initial?.type || 'google')
  const [status,      setStatus]      = useState(initial?.status || 'active')
  const [notes,       setNotes]       = useState(initial?.notes || '')
  const [analystInput,setAnalystInput] = useState(
    initial?.analysts?.map(pa => pa.analyst?.name || '').filter(Boolean).join(', ') || ''
  )
  const [fieldDefs,   setFieldDefs]   = useState(initial?.fieldDefs || DEFAULT_FIELDS)
  const [saving,      setSaving]      = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const names      = analystInput.split(',').map(s => s.trim()).filter(Boolean)
    const analystIds = names.map(n => analysts.find(a => a.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean)
    try {
      await onSave({ name, type, status, notes, analystIds, fieldDefs })
    } finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div className="form-group"><label>Project name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Q2 Ads Safety Review" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
      </div>
      <div className="form-group"><label>Analysts (comma-separated)</label>
        <input value={analystInput} onChange={e => setAnalystInput(e.target.value)} placeholder="Jade, Celine, Shira" />
      </div>
      <div className="form-group"><label>Notes</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <FieldDefEditor fieldDefs={fieldDefs} onChange={setFieldDefs} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function ProjectsTab({ projects, setProjects, analysts, loading, showToast }) {
  const [showForm,     setShowForm]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [expanded,     setExpanded]     = useState({})
  const [confirmDelete,setConfirmDelete] = useState(null)

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleAssignmentChange(projectId, analystId, fieldValues) {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p
      return {
        ...p,
        analysts: p.analysts.map(pa =>
          pa.analystId === analystId ? { ...pa, fieldValues } : pa
        ),
      }
    }))
  }

  async function handleCreate(data) {
    try {
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed to create project')
      const p = await res.json()
      setProjects(prev => [p, ...prev])
      setShowForm(false)
    } catch (e) { showToast(e.message) }
  }

  async function handleUpdate(data) {
    try {
      const res = await fetch(`/api/projects/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed to update project')
      const p = await res.json()
      setProjects(prev => prev.map(x => x.id === p.id ? { ...p, fieldDefs: data.fieldDefs } : x))
      setEditing(null)
    } catch (e) { showToast(e.message) }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete project')
      setProjects(prev => prev.filter(p => p.id !== id))
      setConfirmDelete(null)
    } catch (e) { showToast(e.message) }
  }

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">Projects</div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditing(null) }}>+ Add project</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label">New project</div>
          <ProjectForm analysts={analysts} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {projects.length === 0 && !showForm && (
        <div className="empty-state"><div className="empty-state-icon">📂</div>No projects yet.</div>
      )}

      <div className="projects-list">
        {projects.map(p => (
          <div key={p.id} className="card">
            {editing?.id === p.id ? (
              <>
                <div className="section-label">Edit project</div>
                <ProjectForm initial={editing} analysts={analysts} onSave={handleUpdate} onCancel={() => setEditing(null)} />
              </>
            ) : (
              <>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="project-name" style={{ cursor: 'pointer', flex: 1 }} onClick={() => toggleExpand(p.id)}>
                    {p.name}
                  </span>
                  <span className={`badge ${p.type === 'google' ? 'badge-blue' : 'badge-gray'}`}>{p.type === 'google' ? 'Google' : 'Side'}</span>
                  <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>{STATUS_LABELS[p.status] || p.status}</span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(p); setShowForm(false) }}>Edit</button>
                    {confirmDelete === p.id ? (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
                        <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}
                        onClick={() => setConfirmDelete(p.id)}>✕</button>
                    )}
                  </div>
                </div>

                {/* Analyst summary */}
                {p.analysts?.length > 0 && (
                  <div className="project-analysts" style={{ marginTop: 4 }}>
                    {p.analysts.map(pa => pa.analyst?.name).filter(Boolean).join(', ')}
                  </div>
                )}
                {p.notes && <div className="project-notes-preview">{p.notes}</div>}

                {/* Expandable breakdown */}
                <button
                  className="meeting-expand-btn"
                  style={{ marginTop: 6 }}
                  onClick={() => toggleExpand(p.id)}>
                  {expanded[p.id] ? 'Hide breakdown ↑' : `Show analyst breakdown ↓`}
                </button>

                {expanded[p.id] && (
                  <AnalystBreakdown
                    project={p}
                    allAnalysts={analysts}
                    onAssignmentChange={(analystId, fieldValues) => handleAssignmentChange(p.id, analystId, fieldValues)}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
