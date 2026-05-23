'use client'
import { useState } from 'react'
import AnalystCard from './AnalystCard'
import AnalystModal from './AnalystModal'
import DigestModal from './DigestModal'

export default function TeamTab({ analysts, setAnalysts, meetings, todos, setTodos, projects, setProjects, loading, showToast }) {
  const [selected,    setSelected]    = useState(null)
  const [syncing,     setSyncing]     = useState(false)
  const [slackDigest, setSlackDigest] = useState(null)

  async function handleSlackSync() {
    setSyncing(true)
    try {
      const res  = await fetch('/api/projects/slack-sync-now', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        showToast(data.error)
      } else if (data.total > 0) {
        setSlackDigest(data.digest)
      } else {
        showToast('Slack synced — nothing new to surface')
      }
    } catch (e) {
      showToast('Slack sync failed: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleMoodChange(id, mood) {
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      const updated = await res.json()
      setAnalysts(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a))
    } catch (e) { showToast(e.message) }
  }

  const active    = analysts.filter(a => !a.pending)
  const thriving  = active.filter(a => a.mood === 'h').length
  const steady    = active.filter(a => a.mood === 'm').length
  const attention = active.filter(a => a.mood === 'l').length

  if (loading) return (
    <div>
      <div className="team-header"><div className="team-title">Team</div><div /></div>
      <div className="team-grid">
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    </div>
  )

  return (
    <div>
      <div className="team-header">
        <div className="team-title">Team</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="team-stats">
            <span className="stat"><span className="stat-num stat-green">{thriving}</span> Thriving</span>
            <span className="stat"><span className="stat-num">{steady}</span> Steady</span>
            <span className="stat"><span className="stat-num stat-red">{attention}</span> Need attention</span>
          </div>
          <button
            className="btn"
            onClick={handleSlackSync}
            disabled={syncing}
            title="Pull latest #team-gts messages and surface updates"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px', opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? '⏳' : '💬'} {syncing ? 'Syncing…' : 'Sync Slack'}
          </button>
        </div>
      </div>

      <div className="team-grid">
        {analysts.map((a, i) => (
          <AnalystCard key={a.id} analyst={a} index={i} onClick={() => setSelected(a)} onMoodChange={mood => handleMoodChange(a.id, mood)} />
        ))}
      </div>

      {selected && (
        <AnalystModal
          analyst={selected}
          meetings={meetings}
          todos={todos}
          setTodos={setTodos}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            const id = updated.id || selected?.id
            setAnalysts(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a))
            setSelected(prev => prev ? { ...prev, ...updated } : null)
          }}
          showToast={showToast}
        />
      )}

      {slackDigest && (
        <DigestModal
          digest={slackDigest}
          meetingTitle="Slack #team-gts"
          analysts={analysts}
          projects={projects || []}
          onApply={async () => {
            setSlackDigest(null)
            showToast('Slack updates applied ✓')
            // Refresh analysts to reflect mood/note changes
            try {
              const res  = await fetch('/api/team')
              const data = await res.json()
              if (Array.isArray(data)) setAnalysts(data)
            } catch {}
          }}
          onClose={() => setSlackDigest(null)}
        />
      )}
    </div>
  )
}
