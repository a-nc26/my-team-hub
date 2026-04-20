'use client'
import { useState } from 'react'

export default function SettingsModal({ settings, onSave, onClose }) {
  const [name,        setName]        = useState(settings.managerName  || '')
  const [title,       setTitle]       = useState(settings.managerTitle || 'Team Lead')
  const [calendarUrl, setCalendarUrl] = useState(settings.calendarUrl  || '')
  const [saving,      setSaving]      = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerName:  name,
          managerTitle: title,
          ...(calendarUrl.trim() ? { calendarUrl: calendarUrl.trim() } : {}),
        }),
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
      <div className="modal-box" style={{ width: 420 }}>
        <div className="modal-header">
          <div className="modal-title">Settings</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="section-label" style={{ marginBottom: 10 }}>Your profile</div>
        <div className="form-group">
          <label>Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Avi Lurie" />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>Your title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Team Lead" />
        </div>

        <div className="section-label" style={{ marginBottom: 10 }}>Calendar integration</div>
        <div className="form-group">
          <label>Google Calendar ICS URL</label>
          <input
            value={calendarUrl}
            onChange={e => setCalendarUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5, lineHeight: 1.5 }}>
            In Google Calendar → click ⚙️ next to your calendar → Settings → scroll to{' '}
            <strong>"Secret address in iCal format"</strong> → copy that URL here.
            This lets the Today's Board show your meetings + AI prep notes.
          </div>
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
