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

  function handleSave({ meeting, digest, title }) {
    setMeetings(prev => [meeting, ...prev])
    setShowModal(false)
    if (digest) {
      setDigestData({ digest, title })
    }
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

      <div className="meetings-list">
        {meetings.map(m => {
          const isExpanded = expanded[m.id]
          const meetingAnalysts = m.analysts || []
          return (
            <div key={m.id} className="card meeting-card">
              <div className="meeting-top">
                <div>
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
                <div className="meeting-date">{fmt(m.date)}</div>
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
        })}
      </div>

      {showModal && (
        <MeetingModal
          analysts={analysts}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          showToast={showToast}
        />
      )}

      {digestData && (
        <DigestModal
          digest={digestData.digest}
          meetingTitle={digestData.title}
          analysts={analysts}
          projects={[]}
          onApply={handleApplyDigest}
          onClose={() => setDigestData(null)}
        />
      )}
    </div>
  )
}
