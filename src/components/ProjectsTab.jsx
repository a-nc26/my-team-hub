'use client'
import { useState } from 'react'

const STATUS_BADGE = {
  active: 'badge-blue',
  review: 'badge-purple',
  done: 'badge-green',
  blocked: 'badge-red',
}
const STATUS_LABELS = { active: 'Active', review: 'In Review', done: 'Done', blocked: 'Blocked' }

function ProjectForm({ initial, analysts, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.type || 'google')
  const [status, setStatus] = useState(initial?.status || 'active')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [analystInput, setAnalystInput] = useState(
    initial?.analysts?.map(pa => pa.analyst?.name || pa.name || '').join(', ') || ''
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const names = analystInput.split(',').map(s => s.trim()).filter(Boolean)
    const analystIds = names.map(n => {
      const match = analysts.find(a => a.name.toLowerCase() === n.toLowerCase())
      return match?.id
    }).filter(Boolean)
    try {
      await onSave({ name, type, status, notes, analystIds })
    } finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="form-group"><label>Project name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Q2 Google Ads Analysis" /></div>
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
      <div className="form-group"><label>Analysts (comma-separated)</label><input value={analystInput} onChange={e => setAnalystInput(e.target.value)} placeholder="Celine, Emily" /></div>
      <div className="form-group"><label>Notes</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

export default function ProjectsTab({ projects, setProjects, analysts, loading, showToast }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

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
      setProjects(prev => prev.map(x => x.id === p.id ? p : x))
      setEditing(null)
    } catch (e) { showToast(e.message) }
  }

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">Projects</div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add project</button>
      </div>

      {showForm && <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-label">New project</div>
        <ProjectForm analysts={analysts} onSave={handleCreate} onCancel={() => setShowForm(false)} />
      </div>}

      {projects.length === 0 && !showForm && (
        <div className="empty-state"><div className="empty-state-icon">📂</div>No projects yet — add your Google projects and side work here.</div>
      )}

      <div className="projects-list">
        {projects.map(p => (
          <div key={p.id} className="card project-card">
            {editing?.id === p.id ? (
              <ProjectForm initial={p} analysts={analysts} onSave={handleUpdate} onCancel={() => setEditing(null)} />
            ) : (
              <div className="project-main">
                <div className="project-title-row">
                  <span className="project-name">{p.name}</span>
                  <span className={`badge ${p.type === 'google' ? 'badge-blue' : 'badge-gray'}`}>{p.type === 'google' ? 'Google' : 'Side'}</span>
                  <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>{STATUS_LABELS[p.status] || p.status}</span>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(p)}>Edit</button>
                </div>
                {p.analysts?.length > 0 && (
                  <div className="project-analysts">{p.analysts.map(pa => pa.analyst?.name || '').filter(Boolean).join(', ')}</div>
                )}
                {p.notes && <div className="project-notes-preview">{p.notes}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
