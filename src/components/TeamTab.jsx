'use client'
import { useState } from 'react'
import AnalystCard from './AnalystCard'
import AnalystModal from './AnalystModal'

export default function TeamTab({ analysts, setAnalysts, meetings, loading, showToast }) {
  const [selected, setSelected] = useState(null)

  const active = analysts.filter(a => !a.pending)
  const thriving  = active.filter(a => a.mood === 'h').length
  const steady    = active.filter(a => a.mood === 'm').length
  const attention = active.filter(a => a.mood === 'l').length

  if (loading) return (
    <div>
      <div className="team-header"><div className="team-title">Team</div></div>
      <div className="team-grid">
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    </div>
  )

  return (
    <div>
      <div className="team-header">
        <div className="team-title">Team</div>
        <div className="team-stats">
          <span className="stat"><span className="stat-num stat-green">{thriving}</span> Thriving</span>
          <span className="stat"><span className="stat-num">{steady}</span> Steady</span>
          <span className="stat"><span className="stat-num stat-red">{attention}</span> Need attention</span>
        </div>
      </div>
      <div className="team-grid">
        {analysts.map((a, i) => (
          <AnalystCard key={a.id} analyst={a} index={i} onClick={() => setSelected(a)} />
        ))}
      </div>
      {selected && (
        <AnalystModal
          analyst={selected}
          meetings={meetings}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setAnalysts(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
            setSelected(prev => prev ? { ...prev, ...updated } : null)
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}
