'use client'
import { useState, useEffect } from 'react'

function getWeekMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

function fmtWeek(monday) {
  const start = new Date(monday + 'T12:00:00')
  const end   = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function formatReview(text) {
  // Render markdown-style bold and sections
  return text.split('\n').map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return <p key={i} style={{ margin: '0 0 8px', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: bold }} />
  })
}

export default function ReviewTab({ analysts, projects, settings, showToast }) {
  const [reviews,    setReviews]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(null) // week string being generated
  const [activeWeek, setActiveWeek] = useState(null)

  const thisMonday = getWeekMonday(new Date())
  // Build list of last 8 weeks to offer
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(thisMonday + 'T12:00:00')
    d.setDate(d.getDate() - i * 7)
    return d.toISOString().slice(0, 10)
  })

  useEffect(() => {
    fetch('/api/review')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setReviews(data)
          if (data.length > 0) setActiveWeek(data[0].value.weekStart)
          else setActiveWeek(weeks[1]) // default to last week
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function generate(weekStart) {
    setGenerating(weekStart)
    try {
      const res  = await fetch('/api/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      setReviews(prev => {
        const filtered = prev.filter(r => r.value.weekStart !== weekStart)
        return [{ key: `weekly_review_${weekStart}`, value: data }, ...filtered]
          .sort((a, b) => b.value.weekStart.localeCompare(a.value.weekStart))
      })
      setActiveWeek(weekStart)
    } catch (e) {
      showToast('Failed to generate review: ' + e.message)
    } finally {
      setGenerating(null)
    }
  }

  const activeReview = reviews.find(r => r.value.weekStart === activeWeek)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Weekly Review</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>AI-generated summaries of each week</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => generate(activeWeek || weeks[1])}
          disabled={!!generating}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {generating ? <><span className="spinner" /> Generating…</> : '✦ Generate Review'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>

        {/* Week list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {weeks.map(w => {
            const has     = reviews.find(r => r.value.weekStart === w)
            const isThis  = w === thisMonday
            const isActive = w === activeWeek
            return (
              <button
                key={w}
                onClick={() => setActiveWeek(w)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                  background: isActive ? 'var(--accent-blue)' : 'var(--bg-primary)',
                  color: isActive ? '#fff' : 'var(--text-primary)',
                  border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-light)'}`,
                  cursor: 'pointer', transition: 'all 0.1s',
                  opacity: !has && !isThis ? 0.6 : 1,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {isThis ? 'This week' : `Week of ${new Date(w + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: isActive ? 0.8 : 0.6 }}>
                  {has ? '✓ Generated' : generating === w ? '⏳ Generating…' : 'Not yet generated'}
                </div>
              </button>
            )
          })}
        </div>

        {/* Review content */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 24, minHeight: 300 }}>
          {loading ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          ) : activeReview ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {fmtWeek(activeReview.value.weekStart)}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                {formatReview(activeReview.value.summary)}
              </div>
              <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
                Generated {new Date(activeReview.value.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}
                <button
                  onClick={() => generate(activeWeek)}
                  disabled={!!generating}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 11, padding: 0 }}
                >
                  Regenerate
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No review yet for this week</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
                Generate a summary of {activeWeek ? fmtWeek(activeWeek) : 'this week'}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => generate(activeWeek || weeks[1])}
                disabled={!!generating}
              >
                {generating ? 'Generating…' : 'Generate now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
