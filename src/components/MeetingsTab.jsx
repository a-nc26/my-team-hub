'use client'
import { useState } from 'react'
import MeetingModal from './MeetingModal'
import DigestModal from './DigestModal'

function fmt(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MeetingsTab({ meetings, setMeetings, analysts, setAnalysts, setProjects, setTodos, loading, showToast }) {
  const [showModal, setShowModal] = useState(false)
  const [digestData, setDigestData] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  function handleSave({ meeting, digest, title }) {
    setMeetings(prev => [meeting, ...prev])
    setShowModal(false)
    if (digest) setDigestData({ digest, title })
  }

  async function handleApplyDigest() {
    const [a, p, td] = await Promise.all([
      fetch('/api/team').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/todos').then(r => r.json()),
    ])
    setAnalysts(Array.isArray(a) ? a : [])
    setProjects(Array.isArray(p) ? p : [])
    setTodos(Array.isArray(td) ? td : [])
    setDigestData(null)
  }

  async function deleteMeeting(id) {
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setMeetings(prev => prev.filter(m => m.id !== id))
      setConfirmDelete(null)
    } catch (e) { showToast(e.message) }
  }

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">Meetings</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Log meeting</button>
      </div>

      {meetings.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          No meetings logged yet. Click '+ Log meeting' to start.
        </div>
      )}

      {meetings.length > 0 && (() => {
        const oneOnOnes = meetings.filter(m => (m.analysts || []).length === 1)
        const teamMeetings = meetings.filter(m => (m.analysts || []).length !== 1)

        const renderCard = m => {
          const isExpanded = expanded[m.id]
          const meetingAnalysts = m.analysts || []
          return (
            <div key={m.id} className="card meeting-card">
              <div className="meeting-top">
                <div style={{ flex: 1 }}>
                  <div className="meeting-title">{m.title}</div>
                  <div className="meeting-tags">
                    {meetingAnalysts.length > 0
                      ? meetingAnalysts.map(ma => (
                          <span key={ma.analystId} className="badge badge-blue">{ma.analyst?.name || ''}</span>
                        ))
                      : <span className="badge badge-gray">Team</span>
                    }
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div className="meeting-date">{fmt(m.date)}</div>
                  {confirmDelete === m.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteMeeting(m.id)}>Delete</button>
                      <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-tertiary)', fontSize: 15 }}
                      onClick={() => setConfirmDelete(m.id)} title="Delete meeting">✕</button>
                  )}
                </div>
              </div>
              {m.digest > 0 && (
                <div className="meeting-digest-bar">AI digest · {m.digest} updates applied</div>
              )}
              {m.notes && (
                <>
                  <div className={`meeting-notes ${isExpanded ? 'expanded' : 'collapsed'}`}>{m.notes}</div>
                  <button className="meeting-expand-btn" onClick={() => setExpanded(prev => ({ ...prev, [m.id]: !isExpanded }))}>
                    {isExpanded ? 'Show less ↑' : 'Show more ↓'}
                  </button>
                </>
              )}
            </div>
          )
        }

        return (
          <>
            {oneOnOnes.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                  1:1s — {oneOnOnes.length}
                </div>
                <div className="meetings-list">{oneOnOnes.map(renderCard)}</div>
              </div>
            )}
            {teamMeetings.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                  Team — {teamMeetings.length}
                </div>
                <div className="meetings-list">{teamMeetings.map(renderCard)}</div>
              </div>
            )}
          </>
        )
      })()}

      {showModal && (
        <MeetingModal analysts={analysts} onSave={handleSave} onClose={() => setShowModal(false)} showToast={showToast} />
      )}
      {digestData && (
        <DigestModal digest={digestData.digest} meetingTitle={digestData.title} analysts={analysts} projects={[]}
          onApply={handleApplyDigest} onClose={() => setDigestData(null)} />
      )}
    </div>
  )
}
