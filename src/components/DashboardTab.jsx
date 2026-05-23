'use client'
import { useState, useEffect } from 'react'

// ── Mood sparkline (inline SVG, 14 days) ─────────────────────────────────────
function Sparkline({ history }) {
  if (!history?.length) return null
  const W = 56, H = 18
  const moodVal = m => m === 'h' ? 1 : m === 'm' ? 0.5 : m === 'l' ? 0 : null
  const points = history.map((d, i) => ({ x: (i / (history.length - 1)) * W, y: moodVal(d.mood) }))
  const filled = points.filter(p => p.y !== null)
  if (filled.length < 2) return null
  // Fill gaps by carrying forward last known value
  let last = filled[0]?.y ?? 0.5
  const resolved = points.map(p => {
    if (p.y !== null) { last = p.y; return p }
    return { ...p, y: last, faded: true }
  })
  const toSVG = p => `${p.x},${H - p.y * (H - 2) - 1}`
  const d = `M ${resolved.map(toSVG).join(' L ')}`
  const lastMood = history.filter(h => h.mood).at(-1)?.mood
  const color = lastMood === 'h' ? '#1D9E75' : lastMood === 'l' ? '#E24B4A' : '#4A90D9'

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      {resolved.map((p, i) => p.y !== null && (
        <circle key={i} cx={p.x} cy={H - p.y * (H - 2) - 1} r={i === resolved.length - 1 ? 2.5 : 0} fill={color} />
      ))}
    </svg>
  )
}

// ── Analyst mini-card ─────────────────────────────────────────────────────────
const COLORS = ['#e03131','#2f9e44','#1971c2','#e8590c','#7048e8','#0c8599','#c2255c','#5c940d','#862e9c','#0b7285']
function AnalystMiniCard({ analyst, onClick }) {
  const color = COLORS[analyst.color % COLORS.length] || COLORS[0]
  const moodLabel = analyst.mood === 'h' ? 'Thriving' : analyst.mood === 'l' ? 'Needs attention' : 'Steady'
  const moodColor = analyst.mood === 'h' ? 'var(--accent-green)' : analyst.mood === 'l' ? 'var(--accent-red)' : 'var(--text-tertiary)'
  const lastSeen = analyst.daysSinceNote === null ? 'Never' : analyst.daysSinceNote === 0 ? 'Today' : analyst.daysSinceNote === 1 ? 'Yesterday' : `${analyst.daysSinceNote}d ago`
  const notSeen = analyst.daysSinceNote === null || analyst.daysSinceNote > 5

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: 'var(--bg-primary)',
        border: `1px solid ${analyst.mood === 'l' ? 'var(--accent-red-bg)' : 'var(--border-light)'}`,
        cursor: 'pointer', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
    >
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: color + '22', color, border: `1.5px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
      }}>
        {analyst.initials}
      </div>

      {/* Name + project */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {analyst.name}
          {notSeen && <span title={`Last note: ${lastSeen}`} style={{ fontSize: 10, color: 'var(--accent-amber)', fontWeight: 500 }}>• {lastSeen}</span>}
        </div>
        {analyst.currentProject && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            {analyst.currentProject}
          </div>
        )}
      </div>

      {/* Sparkline */}
      <div style={{ flexShrink: 0 }}>
        <Sparkline history={analyst.moodHistory} />
        <div style={{ fontSize: 9, color: moodColor, textAlign: 'center', marginTop: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {analyst.mood ? moodLabel : '—'}
        </div>
      </div>
    </div>
  )
}

// ── Metric tile ───────────────────────────────────────────────────────────────
function MetricTile({ label, value, sub, accent, icon, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-primary)', border: `1px solid var(--border-light)`,
        borderRadius: 10, padding: '16px 18px',
        borderTop: `3px solid ${accent}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
        </div>
        <span style={{ fontSize: 22, opacity: 0.4 }}>{icon}</span>
      </div>
    </div>
  )
}

// ── At-risk project row ───────────────────────────────────────────────────────
function RiskRow({ project }) {
  const isBlocked  = project.status === 'blocked'
  const isStale    = project.daysSinceActivity > 7
  const tag        = isBlocked ? { label: 'Blocked', color: '#E24B4A', bg: '#FCEBEB' } : { label: `${project.daysSinceActivity}d no update`, color: '#d97706', bg: '#fef3c7' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
        background: tag.bg, color: tag.color, flexShrink: 0,
      }}>{tag.label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, fontWeight: 500 }}>{project.name}</span>
      {project.analysts?.length > 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {project.analysts.map(a => a.initials || a.name.split(' ').map(w=>w[0]).join('')).join(', ')}
        </span>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardTab({ settings, onNavigate, analysts: propAnalysts, showToast }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const name    = settings?.managerName?.split(' ')[0] || 'there'
  const now     = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div className="skeleton" style={{ height: 32, width: 280, marginBottom: 24, borderRadius: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="skeleton" style={{ height: 360, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 360, borderRadius: 10 }} />
      </div>
    </div>
  )

  if (!data || data.error || !data.stats) return (
    <div style={{ padding: '2rem', color: 'var(--text-secondary)', fontSize: 14 }}>
      {data?.error ? `Error loading dashboard: ${data.error}` : 'Loading…'}
    </div>
  )

  const { stats, atRiskProjects, highTodos } = data
  const sortedAnalysts = [...(data.analysts || [])].sort((a, b) => {
    // Sort: l first, then by daysSinceNote desc (most neglected first), then h/m
    const moodScore = m => m === 'l' ? 0 : m === 'm' ? 1 : m === 'h' ? 2 : 3
    if (moodScore(a.mood) !== moodScore(b.mood)) return moodScore(a.mood) - moodScore(b.mood)
    return (b.daysSinceNote ?? 999) - (a.daysSinceNote ?? 999)
  })

  return (
    <div style={{ padding: '0 0 2rem' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '20px 0 18px',
        borderBottom: '1px solid var(--border-light)',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {greeting}, {name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>{dateStr}</div>
      </div>

      {/* ── Metric tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricTile
          label="Team Health"
          value={stats.healthPct !== null ? `${stats.healthPct}%` : '—'}
          sub={`${stats.thriving} thriving · ${stats.steady} steady · ${stats.attention} at-risk`}
          accent="#1D9E75"
          icon="👥"
          onClick={() => onNavigate('team')}
        />
        <MetricTile
          label="Need Attention"
          value={stats.attention + (stats.notSeen > 0 ? ` +${stats.notSeen}` : '')}
          sub={stats.attention > 0 ? `${stats.attention} low mood` : stats.notSeen > 0 ? `${stats.notSeen} not checked in` : 'All good'}
          accent={stats.attention > 0 ? '#E24B4A' : '#1D9E75'}
          icon="⚠️"
          onClick={() => onNavigate('team')}
        />
        <MetricTile
          label="Projects at Risk"
          value={stats.atRiskCount}
          sub={`${stats.activeProjects} active total`}
          accent={stats.atRiskCount > 0 ? '#EF9F27' : '#1D9E75'}
          icon="📁"
          onClick={() => onNavigate('projects')}
        />
        <MetricTile
          label="High-Pri Todos"
          value={stats.highTodoCount}
          sub="Need action today"
          accent={stats.highTodoCount > 2 ? '#E24B4A' : stats.highTodoCount > 0 ? '#EF9F27' : '#1D9E75'}
          icon="📋"
          onClick={() => onNavigate('todos')}
        />
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Team pulse */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
              Team Pulse
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('team')} style={{ fontSize: 11 }}>
              View all →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedAnalysts.map(a => (
              <AnalystMiniCard key={a.id} analyst={a} onClick={() => onNavigate('team')} />
            ))}
            {sortedAnalysts.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>No analysts yet</div>
            )}
          </div>
        </div>

        {/* Right column: at-risk + todos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* At-risk projects */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                Projects Needing Attention
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('projects')} style={{ fontSize: 11 }}>View all →</button>
            </div>
            {atRiskProjects.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>✓ All projects on track</div>
            ) : (
              atRiskProjects.map(p => <RiskRow key={p.id} project={p} />)
            )}
          </div>

          {/* High-priority todos */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                High-Priority Todos
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('todos')} style={{ fontSize: 11 }}>View all →</button>
            </div>
            {highTodos.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>✓ Nothing urgent</div>
            ) : highTodos.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#FCEBEB', color: '#E24B4A', flexShrink: 0, marginTop: 1 }}>HIGH</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.text}</span>
                {t.analyst && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto', flexShrink: 0 }}>{t.analyst.name.split(' ')[0]}</span>}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
