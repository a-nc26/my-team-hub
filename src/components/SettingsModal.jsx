'use client'
import { useState } from 'react'

export default function SettingsModal({ settings, onSave, onClose }) {
  const [name, setName] = useState(settings.managerName || '')
  const [title, setTitle] = useState(settings.managerTitle || 'Team Lead')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerName: name, managerTitle: title }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      onSave(updated)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ width: 380 }}>
        <div className="modal-header">
          <div className="modal-title">Your profile</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label>Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Avi Lurie" />
        </div>
        <div className="form-group">
          <label>Your title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Team Lead" />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
