'use client'
import { useState } from 'react'

const STATUS_BADGE = {
  'active':         { cls: 'badge-green',  label: 'Active' },
  'in-development': { cls: 'badge-amber',  label: 'In Development' },
  'deprecated':     { cls: 'badge-gray',   label: 'Deprecated' },
}

const EMPTY_FORM = { name: '', description: '', url: '', status: 'active', category: '', analystId: '' }

function ToolCard({ tool, analysts, onUpdate, onDelete, showToast }) {
  const [editing, setEditing]       = useState(false)
  const [form, setForm]             = useState(tool)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving]         = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tools/${tool.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      onUpdate(updated)
      setEditing(false)
    } catch (e) { showToast(e.message) } finally { setSaving(false) }
  }

  async function del() {
    try {
      const res = await fetch(`/api/tools/${tool.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      onDelete(tool.id)
    } catch (e) { showToast(e.message) }
  }

  const badge = STATUS_BADGE[tool.status] || STATUS_BADGE['active']

  if (editing) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tool name" />
          <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
          <input value={form.url || ''} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="URL / link" />
          <input value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Category (e.g. Automation, Dashboard)" />
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ flex: 1 }}>
              <option value="active">Active</option>
              <option value="in-development">In Development</option>
              <option value="deprecated">Deprecated</option>
            </select>
            <select value={form.analystId || ''} onChange={e => setForm(f => ({ ...f, analystId: e.target.value }))} style={{ flex: 1 }}>
              <option value="">No builder</option>
              {analysts.filter(a => !a.pending).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" onClick={() => { setEditing(false); setForm(tool) }}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {tool.url
                ? <a href={tool.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{tool.name} ↗</a>
                : tool.name
              }
            </span>
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
            {tool.category && <span className="badge badge-gray">{tool.category}</span>}
            {tool.analyst && <span className="badge badge-blue">{tool.analyst.name}</span>}
          </div>
          {tool.description && (
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tool.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} title="Edit">✏️</button>
          {confirmDelete ? (
            <>
              <button className="btn btn-danger btn-sm" onClick={del}>Delete</button>
              <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-tertiary)', fontSize: 15 }}
              onClick={() => setConfirmDelete(true)} title="Delete">✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ToolsTab({ tools, setTools, analysts, loading, showToast }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [adding, setAdding]     = useState(false)
  const [filter, setFilter]     = useState('all')

  async function addTool() {
    if (!form.name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/tools', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to add tool')
      const created = await res.json()
      setTools(prev => [created, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (e) { showToast(e.message) } finally { setAdding(false) }
  }

  const filtered = filter === 'all' ? tools : tools.filter(t => t.status === filter)

  // Group by category
  const groups = {}
  filtered.forEach(t => {
    const key = t.category || 'Uncategorized'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  const groupKeys = Object.keys(groups).sort((a, b) => a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b))

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">Tools</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="in-development">In Development</option>
            <option value="deprecated">Deprecated</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ Add tool'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>New tool</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tool name *" autoFocus />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="URL / link" />
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Category (e.g. Automation, Dashboard, Script)" />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ flex: 1 }}>
                <option value="active">Active</option>
                <option value="in-development">In Development</option>
                <option value="deprecated">Deprecated</option>
              </select>
              <select value={form.analystId} onChange={e => setForm(f => ({ ...f, analystId: e.target.value }))} style={{ flex: 1 }}>
                <option value="">No builder</option>
                {analysts.filter(a => !a.pending).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={addTool} disabled={adding || !form.name.trim()}>
                {adding ? 'Adding…' : 'Add tool'}
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔧</div>
          No tools yet. Add the first one!
        </div>
      )}

      {groupKeys.map(key => (
        <div key={key} style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            {key} — {groups[key].length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {groups[key].map(tool => (
              <ToolCard
                key={tool.id}
                tool={tool}
                analysts={analysts}
                onUpdate={updated => setTools(prev => prev.map(t => t.id === updated.id ? updated : t))}
                onDelete={id => setTools(prev => prev.filter(t => t.id !== id))}
                showToast={showToast}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
