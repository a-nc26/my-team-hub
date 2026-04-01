'use client'
import { useState } from 'react'

const COLORS = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FAECE7', color: '#993C1D' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FBEAF0', color: '#993556' },
  { bg: '#EAF3DE', color: '#3B6D11' },
]

function fmt(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AnalystModal({ analyst, onClose, onUpdate, showToast }) {
  const [name, setName] = useState(analyst.name)
  const [role, setRole] = useState(analyst.role || '')
  const [mood, setMood] = useState(analyst.mood || 'm')
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState(analyst.notes || [])
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)

  const c = COLORS[analyst.color ?? 0]

  async function saveMood(newMood) {
    setMood(newMood)
    try {
      const res = await fetch(`/api/team/${analyst.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: newMood }),
      })
      if (!res.ok) throw new Error('Failed to save mood')
      onUpdate({ mood: newMood })
    } catch (e) { showToast(e.message) }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch(`/api/team/${analyst.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onUpdate({ name, role })
      onClose()
    } catch (e) { showToast(e.message) } finally { setSaving(false) }
  }

  async function addNote() {
    if (!noteText.trim()) return
    try {
      const res = await fetch(`/api/team/${analyst.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: noteText.trim(), mood }),
      })
      if (!res.ok) throw new Error('Failed to save note')
      const created = await res.json()
      setNotes(prev => [created, ...prev])
      onUpdate({ notes: [created, ...notes] })
      setNoteText('')
    } catch (e) { showToast(e.message) }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      if (noteText.trim()) {
        if (!window.confirm('You have unsaved notes. Close anyway?')) return
      }
      onClose()
    }
  }

  const moodLabel = m => m === 'h' ? 'Thriving' : m === 'l' ? 'Needs attention' : 'Steady'

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-analyst-header">
            <div className="avatar avatar-lg" style={{ background: c.bg, color: c.color }}>{analyst.initials}</div>
            <div style={{ flex: 1 }}>
              {editingName
                ? <input className="analyst-name-input" value={name} onChange={e => setName(e.target.value)} onBlur={() => setEditingName(false)} autoFocus />
                : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{name}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(true)} title="Edit name">✏️</button>
                  </div>
              }
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role / focus area..." style={{ marginTop: 4, fontSize: 12 }} />
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {analyst.pending ? (
          <div className="pending-info">🗓 Joining soon — set up their profile when they start.</div>
        ) : (
          <>
            <div className="section-label">Status</div>
            <div className="mood-selector">
              {['h','m','l'].map(m => (
                <button key={m}
                  className={`mood-btn${mood === m ? ` active-${m === 'h' ? 'green' : m === 'l' ? 'red' : 'amber'}` : ''}`}
                  onClick={() => saveMood(m)}>
                  {moodLabel(m)}
                </button>
              ))}
            </div>
          </>
        )}

        <hr className="divider" />
        <div className="section-label">Add a note</div>
        <div className="form-group">
          <textarea
            rows={3}
            placeholder="Wins, concerns, growth areas, observations..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!noteText.trim()}>Save note</button>

        {notes.length > 0 && (
          <>
            <hr className="divider" />
            <div className="section-label">Note history</div>
            <div className="notes-history">
              {notes.map(n => (
                <div key={n.id} className={`note-item mood-${n.mood || 'm'}`}>
                  <div className="note-meta">
                    <span>{fmt(n.date || n.createdAt)}</span>
                    <span>{moodLabel(n.mood)}</span>
                    {n.source === 'digest' && <span className="badge badge-blue" style={{ fontSize: 10 }}>via digest</span>}
                    {n.meetingTitle && <span>· {n.meetingTitle}</span>}
                  </div>
                  <div>{n.text}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
