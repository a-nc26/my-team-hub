'use client'

const COLORS = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FAECE7', color: '#993C1D' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FBEAF0', color: '#993556' },
  { bg: '#EAF3DE', color: '#3B6D11' },
]

function MoodDots({ mood }) {
  const count = mood === 'h' ? 5 : mood === 'l' ? 1 : 3
  const cls = mood === 'h' ? 'filled-green' : mood === 'l' ? 'filled-red' : 'filled-blue'
  return (
    <div className="mood-dots">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`mood-dot${i <= count ? ' ' + cls : ''}`} />
      ))}
    </div>
  )
}

const MOOD_COLOR = { h: '#16a34a', m: '#9ca3af', l: '#dc2626' }

function MoodSparkline({ notes }) {
  if (!notes || notes.length < 2) return null
  const recent = notes.slice(0, 5).reverse()
  const lastNote = notes[0]
  const dateLabel = lastNote?.createdAt
    ? new Date(lastNote.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>trend</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {recent.map((n, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: MOOD_COLOR[n.mood] || MOOD_COLOR.m,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        {dateLabel && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{dateLabel}</span>
        )}
      </div>
    </div>
  )
}

export default function AnalystCard({ analyst, index, onClick }) {
  const c = COLORS[analyst.color ?? index % 7]
  const lastNote = analyst.notes?.[0]
  const badge = analyst.pending
    ? <span className="badge badge-amber">Joining soon</span>
    : analyst.mood === 'h'
      ? <span className="badge badge-green">Thriving</span>
      : analyst.mood === 'l'
        ? <span className="badge badge-red">Needs attention</span>
        : <span className="badge badge-gray">Steady</span>

  return (
    <div className={`card analyst-card${analyst.pending ? ' pending' : ''}`} onClick={onClick}>
      <div className="card-top">
        <div className="avatar" style={{ background: c.bg, color: c.color }}>{analyst.initials}</div>
        <div>
          <div className="card-name">{analyst.name}</div>
          <div className="card-role">{analyst.role}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>{badge}</div>
      </div>
      {!analyst.pending && <MoodDots mood={analyst.mood} />}
      {!analyst.pending && <MoodSparkline notes={analyst.notes} />}
      {lastNote && <div className="card-note-preview">{lastNote.text}</div>}
    </div>
  )
}
