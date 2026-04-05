'use client'
import { useState, useEffect, useRef } from 'react'
import { detectSpeakers } from '@/lib/transcript'

export default function MeetingModal({ analysts, onSave, onClose, showToast }) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [speakers, setSpeakers] = useState([])
  const [selectedAnalystId, setSelectedAnalystId] = useState('')
  const [saving, setSaving] = useState(false)
  const [digesting, setDigesting] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (notes.trim()) setSpeakers(detectSpeakers(notes, analysts))
      else setSpeakers([])
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [notes, analysts])

  const activeAnalystIds = () => {
    const fromSpeakers = speakers.filter(s => s.active && s.analyst).map(s => s.analyst.id)
    if (fromSpeakers.length > 0) return fromSpeakers
    if (selectedAnalystId) return [selectedAnalystId]
    return []
  }

  async function handleSave(withDigest = false) {
    if (!title.trim()) { showToast('Please add a title'); return }
    const analystIds = activeAnalystIds()

    if (withDigest) {
      setDigesting(true)
      try {
        // Save meeting first
        const meeting = await saveMeeting(analystIds, 0)
        // Run digest
        const res = await fetch('/api/ai/digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: notes }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Digest failed')
        }
        const digestResult = await res.json()
        // Save digest as pending on the meeting — not applied yet
        await fetch(`/api/meetings/${meeting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingDigest: digestResult }),
        })
        onSave({ meeting: { ...meeting, pendingDigest: digestResult }, digest: null })
        showToast('Meeting saved — AI suggestions are ready to review')
      } catch (e) {
        showToast(e.message)
        setDigesting(false)
      }
    } else {
      setSaving(true)
      try {
        const meeting = await saveMeeting(analystIds, 0)
        onSave({ meeting, digest: null })
      } catch (e) {
        showToast(e.message)
      } finally { setSaving(false) }
    }
  }

  async function saveMeeting(analystIds, digest) {
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, notes, analystIds, digest, date: new Date().toISOString() }),
    })
    if (!res.ok) throw new Error('Failed to save meeting')
    return res.json()
  }

  const toggleSpeaker = (idx) => {
    setSpeakers(prev => prev.map((s, i) => i === idx ? { ...s, active: !s.active } : s))
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">Log a meeting</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly 1:1 — Jade" />
        </div>

        <div className="form-group">
          <label>Notes / Transcript</label>
          <textarea
            rows={8}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={`Paste your notes or transcript here...\n\nSpeaker names are detected automatically, e.g:\n  Celine: I finished the Q2 analysis...\n  Jade: I'm blocked on data access...`}
          />
        </div>

        {speakers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="text-sm text-muted" style={{ marginBottom: 6 }}>Detected speakers — click to toggle:</div>
            <div className="speaker-chips">
              {speakers.map((s, i) => (
                <span
                  key={i}
                  className={`speaker-chip ${s.analyst ? 'matched' : 'unmatched'}${!s.active ? ' inactive' : ''}`}
                  onClick={() => toggleSpeaker(i)}
                >
                  {s.raw}{s.analyst ? ' ✓' : ' (no match)'}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Link to analyst (fallback)</label>
          <select value={selectedAnalystId} onChange={e => setSelectedAnalystId(e.target.value)}>
            <option value="">Whole team / unlinked</option>
            {analysts.filter(a => !a.pending).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => handleSave(false)} disabled={saving || digesting}>
            {saving ? 'Saving…' : 'Save notes only'}
          </button>
          <button className="btn btn-amber" onClick={() => handleSave(true)} disabled={saving || digesting}>
            {digesting ? <><span className="spinner" /> Analyzing…</> : 'Save + AI digest'}
          </button>
        </div>
      </div>
    </div>
  )
}
