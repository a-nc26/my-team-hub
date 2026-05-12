'use client'
import { useState, useCallback, useRef, useEffect } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  google:   { label: 'Google',   color: '#4285f4', bg: '#e8f0fe' },
  research: { label: 'Research', color: '#9333ea', bg: '#f5f3ff' },
  eval:     { label: 'Eval',     color: '#ea580c', bg: '#fff7ed' },
  external: { label: 'External', color: '#0891b2', bg: '#ecfeff' },
  side:     { label: 'Side',     color: '#6b7280', bg: '#f3f4f6' },
  personal: { label: 'Personal', color: '#059669', bg: '#ecfdf5' },
}
const STATUS_CONFIG = {
  active:  { label: 'Active',    color: '#16a34a', bg: '#dcfce7' },
  review:  { label: 'In Review', color: '#2563eb', bg: '#dbeafe' },
  blocked: { label: 'Blocked',   color: '#dc2626', bg: '#fee2e2' },
  hold:    { label: 'On Hold',   color: '#d97706', bg: '#fef3c7' },
  done:    { label: 'Done',      color: '#6b7280', bg: '#f3f4f6' },
}
const ANALYST_COLORS = ['#e03131','#2f9e44','#1971c2','#e8590c','#7048e8','#0c8599','#c2255c','#5c940d','#862e9c','#0b7285']

// ── Project Chat Panel ────────────────────────────────────────────────────────
function ProjectChatPanel({ onClose, onProjectsChanged }) {
  const WELCOME = "Hi! I can help you manage your projects conversationally. Try:\n• \"Add a new Google project called X, deadline June 15\"\n• \"Mark the Agent Debate project as In Review\"\n• \"Add a milestone to X: draft done by May 20\"\n• \"Log an update on Y: data collection complete\""
  const [display, setDisplay] = useState([{ role: 'assistant', content: WELCOME }])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const apiHistory = useRef([])
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [display])
  useEffect(() => { inputRef.current?.focus() }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const userMsg = { role: 'user', content: text }
    const newHistory = [...apiHistory.current, userMsg]
    apiHistory.current = newHistory
    setDisplay(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res  = await fetch('/api/projects/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const assistantMsg = { role: 'assistant', content: data.message }
      apiHistory.current = [...newHistory, assistantMsg]
      setDisplay(prev => [...prev, assistantMsg])
      if (data.actionsCount > 0) onProjectsChanged()
    } catch (e) {
      setDisplay(prev => [...prev, { role: 'assistant', content: `Something went wrong: ${e.message}` }])
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
      background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-light)',
      display: 'flex', flexDirection: 'column', zIndex: 1050,
      boxShadow: '-6px 0 32px rgba(0,0,0,0.13)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '0.5px solid var(--border-light)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>💬</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Project Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Chat to create or update projects</div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: 'var(--text-tertiary)', padding: '4px 8px', lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {display.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '88%',
              padding: '9px 12px',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
              background: m.role === 'user' ? 'var(--accent-blue, #3b82f6)' : 'var(--bg-secondary, #f5f5f5)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
              border: m.role === 'assistant' ? '0.5px solid var(--border-light)' : 'none',
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '9px 14px', borderRadius: '4px 14px 14px 14px',
              background: 'var(--bg-secondary)', border: '0.5px solid var(--border-light)',
              color: 'var(--text-tertiary)', fontSize: 13,
            }}>Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 14px', borderTop: '0.5px solid var(--border-light)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Add a project, update status, add a milestone…"
          rows={2}
          disabled={loading}
          style={{
            flex: 1, resize: 'none', padding: '8px 10px', fontSize: 13,
            border: '0.5px solid var(--border-light)', borderRadius: 8,
            lineHeight: 1.4, fontFamily: 'inherit', background: 'var(--bg-secondary)',
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          padding: '8px 14px', borderRadius: 8, border: 'none',
          background: 'var(--accent-blue, #3b82f6)', color: '#fff',
          fontWeight: 600, fontSize: 13, alignSelf: 'flex-end',
          cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          opacity: loading || !input.trim() ? 0.5 : 1,
        }}>Send</button>
      </div>
    </div>
  )
}

// ── Slack Suggestions Banner ──────────────────────────────────────────────────
function SlackSuggestionsBanner({ suggestions, projects, analysts, onApply, onDismiss, onDismissAll }) {
  const [applying, setApplying] = useState(null)

  async function apply(s) {
    setApplying(s)
    await onApply(s)
    setApplying(null)
  }

  const TYPE_ICON  = { update: '📝', status: '🔄', milestone: '🏁', new: '✨', analyst: '👤' }
  const TYPE_LABEL = { update: 'Update', status: 'Status change', milestone: 'Milestone', new: 'New project', analyst: 'Analyst note' }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid #3b82f6', borderLeft: '3px solid #3b82f6',
      borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Slack suggestions</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#dbeafe',
          padding: '1px 7px', borderRadius: 10,
        }}>{suggestions.length}</span>
        <button onClick={onDismissAll} style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'var(--text-tertiary)',
        }}>Dismiss all</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map((s, i) => {
          const matched = projects.find(p => p.id === s.projectId)
          const matchedAnalyst = analysts?.find(a => a.name?.toLowerCase().includes(s.analystName?.toLowerCase() || '___'))
          const isAnalyst = s.relatedTo === 'analyst'
          const accentColor = isAnalyst ? '#059669' : '#2563eb'
          const confPct = Math.round((s.confidence || 0) * 100)

          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              gap: '0 8px', alignItems: 'center',
              padding: '9px 11px', borderRadius: 6,
              background: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-light)',
              borderLeft: `2px solid ${accentColor}`,
            }}>
              <div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px',
                    color: accentColor, background: isAnalyst ? '#ecfdf5' : '#dbeafe',
                    padding: '1px 5px', borderRadius: 3,
                  }}>{TYPE_ICON[s.type] || ''} {TYPE_LABEL[s.type] || s.type}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isAnalyst ? (s.analystName || 'Team member') : (matched?.name || s.projectName)}
                  </span>
                  <span style={{ fontSize: 10, color: confPct >= 85 ? '#16a34a' : confPct >= 70 ? '#d97706' : 'var(--text-tertiary)' }}>
                    {confPct}% match
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{s.content}</div>
              </div>
              <button onClick={() => apply(s)} disabled={applying === s} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: accentColor, color: '#fff',
                fontSize: 11, fontWeight: 600,
                cursor: applying === s ? 'not-allowed' : 'pointer',
                opacity: applying === s ? 0.6 : 1, whiteSpace: 'nowrap',
              }}>{applying === s ? '…' : 'Apply'}</button>
              <button onClick={() => onDismiss(s)} style={{
                padding: '4px 6px', borderRadius: 6, border: '0.5px solid var(--border-light)',
                background: 'none', cursor: 'pointer', fontSize: 13,
                color: 'var(--text-tertiary)', lineHeight: 1,
              }}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const STATUS_BADGE   = { active: 'badge-blue', review: 'badge-purple', done: 'badge-green', blocked: 'badge-red', hold: 'badge-gray' }
const STATUS_LABELS  = { active: 'Active', review: 'In Review', done: 'Done', blocked: 'Blocked', hold: 'On Hold' }
const STATUS_ICONS   = { active: '🟢', review: '🔵', blocked: '🔴', hold: '⏸️', done: '✅' }
const STATUS_ORDER   = ['active', 'review', 'blocked', 'hold', 'done']
const DEFAULT_FIELDS = [
  { id: 'harmArea', label: 'Harm Area', type: 'text' },
  { id: 'amount',   label: 'Amount',    type: 'number' },
]

// ── Analyst picker + per-analyst fields table ─────────────────────────────────
function AssignmentEditor({ assignments, setAssignments, analysts, fieldDefs }) {
  const available = analysts.filter(a => !a.pending)
  const assignedIds = new Set(assignments.map(a => a.analystId))

  function addAnalyst(id) {
    if (assignedIds.has(id)) return
    setAssignments(prev => [...prev, { analystId: id, fieldValues: {} }])
  }

  function removeAnalyst(id) {
    setAssignments(prev => prev.filter(a => a.analystId !== id))
  }

  function setField(analystId, fieldId, value) {
    setAssignments(prev => prev.map(a =>
      a.analystId === analystId
        ? { ...a, fieldValues: { ...a.fieldValues, [fieldId]: value } }
        : a
    ))
  }

  return (
    <div>
      {/* Dropdown to add analyst */}
      <select
        value=""
        onChange={e => { if (e.target.value) addAnalyst(e.target.value) }}
        style={{ marginBottom: 10 }}
      >
        <option value="">+ Add analyst to project…</option>
        {available.filter(a => !assignedIds.has(a.id)).map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      {assignments.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Analyst</th>
                {fieldDefs.map(f => <th key={f.id} style={thStyle}>{f.label}</th>)}
                <th style={{ ...thStyle, width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const analyst = analysts.find(x => x.id === a.analystId)
                return (
                  <tr key={a.analystId}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{analyst?.name || a.analystId}</span>
                    </td>
                    {fieldDefs.map(f => (
                      <td key={f.id} style={tdStyle}>
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={a.fieldValues?.[f.id] || ''}
                          onChange={e => setField(a.analystId, f.id, e.target.value)}
                          placeholder={f.label}
                          style={{ width: '100%', padding: '4px 6px', fontSize: 12 }}
                        />
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <button className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '2px 6px' }}
                        onClick={() => removeAnalyst(a.analystId)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid var(--border-light)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '6px 8px', borderBottom: '0.5px solid var(--border-light)', verticalAlign: 'middle' }

// ── MentionInput — input with @-mention dropdown ──────────────────────────────
function MentionInput({ value, onChange, onSubmit, analysts, placeholder }) {
  const inputRef = useRef(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const filtered = analysts.filter(a =>
    !a.pending && a.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
  )

  function handleChange(e) {
    const val = e.target.value
    onChange(val)

    const cursor = e.target.selectionStart
    // Find the last '@' before cursor
    const before = val.slice(0, cursor)
    const atIdx = before.lastIndexOf('@')
    if (atIdx !== -1 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
      const query = before.slice(atIdx + 1)
      if (!/\s/.test(query)) {
        setMentionStart(atIdx)
        setMentionQuery(query)
        setShowDropdown(true)
        return
      }
    }
    setShowDropdown(false)
    setMentionQuery('')
    setMentionStart(null)
  }

  function insertMention(name) {
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + 1 + mentionQuery.length)
    const newVal = before + '@' + name + ' ' + after
    onChange(newVal)
    setShowDropdown(false)
    setMentionQuery('')
    setMentionStart(null)
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + name.length + 2
        inputRef.current.focus()
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setShowDropdown(false); return }
    if (e.key === 'Enter' && !e.shiftKey && !showDropdown) { onSubmit(); return }
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ width: '100%', padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }}
      />
      {showDropdown && filtered.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
          background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          zIndex: 100, minWidth: 160, maxHeight: 180, overflowY: 'auto',
        }}>
          {filtered.map(a => (
            <button
              key={a.id}
              onMouseDown={e => { e.preventDefault(); insertMention(a.name) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 12px', fontSize: 13, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-primary)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              @{a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Render comment text with @Name highlighted in blue
function CommentText({ text, analysts }) {
  const names = analysts.map(a => a.name)
  if (names.length === 0) return <span>{text}</span>

  const pattern = new RegExp(`(@(?:${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g')
  const parts = text.split(pattern)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('@') && names.includes(part.slice(1))) {
          return <span key={i} style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{part}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// ── Project updates (inline feed, always visible) ─────────────────────────────
function ProjectUpdates({ project, onNoteAdded, showToast }) {
  const [text,     setText]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef(null)
  const notes = project.projectNotes || []

  function fmtDate(d) {
    const date = new Date(d)
    const now  = new Date()
    const diff = Math.floor((now - date) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const note = await res.json()
      onNoteAdded(project.id, note)
      setText('')
    } catch (e) { showToast(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(noteId) {
    try {
      await fetch(`/api/projects/${project.id}/notes?noteId=${noteId}`, { method: 'DELETE' })
      onNoteAdded(project.id, null, noteId)
    } catch (e) { showToast(e.message) }
  }

  const preview = expanded ? notes : notes.slice(0, 3)

  return (
    <div style={{ marginTop: 8 }}>
      {notes.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 6 }}>
          Updates <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>({notes.length})</span>
        </div>
      )}

      {/* Quick add */}
      <div style={{ display: 'flex', gap: 6, marginBottom: notes.length > 0 ? 6 : 0 }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Log an update… (Enter to save)"
          style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
        />
        {text.trim() && (
          <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>
            {saving ? '…' : 'Add'}
          </button>
        )}
      </div>

      {/* Feed */}
      {preview.map(n => (
        <div key={n.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '5px 0', borderTop: '0.5px solid var(--border-light)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0, paddingTop: 2, minWidth: 52, textAlign: 'right' }}>
            {fmtDate(n.createdAt)}
          </span>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{n.text}</span>
          <button
            onClick={() => handleDelete(n.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, opacity: 0.4, padding: '0 2px', flexShrink: 0 }}
            title="Delete">✕</button>
        </div>
      ))}

      {notes.length > 3 && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '3px 0', marginTop: 2 }}
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? '▴ Show less' : `▾ Show all ${notes.length} updates`}
        </button>
      )}
    </div>
  )
}

// ── Project comments ──────────────────────────────────────────────────────────
function ProjectComments({ project, onNoteAdded, showToast, analysts }) {
  const [text,    setText]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(null)
  const notes = project.projectNotes || []

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Failed to save comment')
      const note = await res.json()
      onNoteAdded(project.id, note)
      setText('')
    } catch (e) { showToast(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(noteId) {
    setDeleting(noteId)
    try {
      await fetch(`/api/projects/${project.id}/notes?noteId=${noteId}`, { method: 'DELETE' })
      onNoteAdded(project.id, null, noteId)
    } catch (e) { showToast(e.message) }
    finally { setDeleting(null) }
  }

  function fmtTime(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 8 }}>
        💬 Comments {notes.length > 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({notes.length})</span>}
      </div>

      {notes.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {notes.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border-light)', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  <CommentText text={n.text} analysts={analysts || []} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtTime(n.createdAt)}</div>
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                disabled={deleting === n.id}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, opacity: 0.5, padding: '2px 4px', flexShrink: 0 }}
                title="Delete comment">✕</button>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>No comments yet.</div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <MentionInput
          value={text}
          onChange={setText}
          onSubmit={handleAdd}
          analysts={analysts || []}
          placeholder="Add a comment or update… (type @ to mention)"
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving || !text.trim()}>
          {saving ? '…' : 'Add'}
        </button>
      </div>
    </div>
  )
}

// ── Project form (create / edit) ──────────────────────────────────────────────
function toDateInput(val) {
  if (!val) return ''
  return new Date(val).toISOString().split('T')[0]
}

function ProjectForm({ initial, analysts, onSave, onCancel }) {
  const [name,        setName]        = useState(initial?.name   || '')
  const [type,        setType]        = useState(initial?.type   || 'google')
  const [status,      setStatus]      = useState(initial?.status || 'active')
  const [notes,       setNotes]       = useState(initial?.notes  || '')
  const [startDate,   setStartDate]   = useState(toDateInput(initial?.startDate))
  const [endDate,     setEndDate]     = useState(toDateInput(initial?.endDate))
  const [fieldDefs,   setFieldDefs]   = useState(initial?.fieldDefs  ?? DEFAULT_FIELDS)
  const [assignments, setAssignments] = useState(() => {
    if (initial?.analysts?.length) {
      return initial.analysts.map(pa => ({
        analystId:   pa.analystId,
        fieldValues: pa.fieldValues || {},
      }))
    }
    return []
  })
  const [saving, setSaving] = useState(false)
  const [newFieldLabel, setNewFieldLabel] = useState('')

  function addCustomField() {
    if (!newFieldLabel.trim()) return
    const id = newFieldLabel.toLowerCase().replace(/\s+/g, '_')
    setFieldDefs(prev => [...prev, { id, label: newFieldLabel.trim(), type: 'text' }])
    setNewFieldLabel('')
  }

  function removeField(id) {
    setFieldDefs(prev => prev.filter(f => f.id !== id))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name, type, status, notes, startDate: startDate || null, endDate: endDate || null, fieldDefs, assignments })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Project name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Q2 Safety Evaluation" />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="google">🔷 Google</option>
            <option value="research">🔬 Research</option>
            <option value="eval">📊 Eval</option>
            <option value="external">🤝 External</option>
            <option value="side">⚡ Side</option>
            <option value="personal">👤 Personal</option>
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="review">In Review</option>
            <option value="blocked">Blocked</option>
            <option value="hold">On Hold</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="form-group">
          <label>Start date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>End date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Field definitions */}
      <div className="section-label" style={{ marginBottom: 6 }}>Analyst fields</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {fieldDefs.map(f => (
          <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', fontSize: 12 }}>
            {f.label}
            <button onClick={() => removeField(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
          </span>
        ))}
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomField()}
            placeholder="Add field…"
            style={{ width: 120, padding: '3px 8px', fontSize: 12 }} />
          <button className="btn btn-sm" onClick={addCustomField} disabled={!newFieldLabel.trim()}>+</button>
        </div>
      </div>

      {/* Analyst assignments */}
      <div className="section-label" style={{ marginBottom: 6 }}>Analyst assignments</div>
      <AssignmentEditor
        assignments={assignments}
        setAssignments={setAssignments}
        analysts={analysts}
        fieldDefs={fieldDefs}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Assignment table (read-only view inside project card) ──────────────────────
function AssignmentTable({ project, analysts }) {
  const fieldDefs = project.fieldDefs || DEFAULT_FIELDS
  const assignments = project.analysts || []
  if (assignments.length === 0) return null
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>Analyst</th>
            {fieldDefs.map(f => <th key={f.id} style={thStyle}>{f.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {assignments.map(pa => {
            const analyst = analysts.find(a => a.id === pa.analystId) || pa.analyst
            return (
              <tr key={pa.analystId}>
                <td style={tdStyle}><span style={{ fontWeight: 500 }}>{analyst?.name || '—'}</span></td>
                {fieldDefs.map(f => (
                  <td key={f.id} style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                    {pa.fieldValues?.[f.id] || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Project milestones ────────────────────────────────────────────────────────
function ProjectMilestones({ project, onUpdate, showToast }) {
  const [milestones, setMilestones]   = useState(project.milestones || [])
  const [adding,     setAdding]       = useState(false)
  const [newTitle,   setNewTitle]     = useState('')
  const [newDate,    setNewDate]      = useState('')
  const [editingId,  setEditingId]    = useState(null)
  const [editTitle,  setEditTitle]    = useState('')
  const [editDate,   setEditDate]     = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  // keep local milestones in sync if project prop changes
  useEffect(() => { setMilestones(project.milestones || []) }, [project.milestones])

  const today = new Date().toISOString().slice(0, 10)

  async function addMilestone() {
    if (!newTitle.trim()) return
    try {
      const res = await fetch(`/api/projects/${project.id}/milestones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), dueDate: newDate || null }),
      })
      if (!res.ok) throw new Error('Failed to add milestone')
      const m = await res.json()
      const updated = [...milestones, m].sort((a, b) => (a.dueDate || '9') > (b.dueDate || '9') ? 1 : -1)
      setMilestones(updated)
      onUpdate(project.id, { milestones: updated })
      setNewTitle(''); setNewDate(''); setAdding(false)
    } catch (e) { showToast(e.message) }
  }

  async function toggleDone(m) {
    try {
      const res = await fetch(`/api/projects/${project.id}/milestones/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !m.done }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      const next = milestones.map(x => x.id === m.id ? updated : x)
      setMilestones(next)
      onUpdate(project.id, { milestones: next })
    } catch (e) { showToast(e.message) }
  }

  async function saveEdit(m) {
    try {
      const res = await fetch(`/api/projects/${project.id}/milestones/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), dueDate: editDate || null }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      const next = milestones.map(x => x.id === m.id ? updated : x)
        .sort((a, b) => (a.dueDate || '9') > (b.dueDate || '9') ? 1 : -1)
      setMilestones(next)
      onUpdate(project.id, { milestones: next })
      setEditingId(null)
    } catch (e) { showToast(e.message) }
  }

  async function deleteMilestone(m) {
    try {
      await fetch(`/api/projects/${project.id}/milestones/${m.id}`, { method: 'DELETE' })
      const next = milestones.filter(x => x.id !== m.id)
      setMilestones(next)
      onUpdate(project.id, { milestones: next })
    } catch (e) { showToast(e.message) }
  }

  function fmtDate(d) {
    if (!d) return null
    const [y, mo, day] = d.split('-')
    return new Date(y, mo - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const open     = milestones.filter(m => !m.done)
  const done     = milestones.filter(m => m.done)
  const overdue  = open.filter(m => m.dueDate && m.dueDate < today)

  return (
    <div style={{ marginTop: 10 }}>
      {milestones.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
            Milestones
          </span>
          {overdue.length > 0 && (
            <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
              {overdue.length} overdue
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{done.length}/{milestones.length}</span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 6px' }}
            onClick={() => setAdding(a => !a)}
          >+ Add</button>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addMilestone(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); setNewDate('') } }}
            placeholder="e.g. Submit first draft"
            style={{ flex: '1 1 180px', padding: '4px 8px', fontSize: 12 }}
          />
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            style={{ width: 130, padding: '4px 6px', fontSize: 12 }}
          />
          <button className="btn btn-primary btn-sm" onClick={addMilestone} disabled={!newTitle.trim()}>Add</button>
          <button className="btn btn-sm" onClick={() => { setAdding(false); setNewTitle(''); setNewDate('') }}>✕</button>
        </div>
      )}

      {/* Milestone list */}
      {milestones.length === 0 && !adding && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '0', marginBottom: 4 }}
          onClick={() => setAdding(true)}
        >+ Add a milestone</button>
      )}

      <div style={{ width: '100%' }}>
        {[...open, ...done].map(m => {
          const isOverdue = !m.done && m.dueDate && m.dueDate < today
          if (editingId === m.id) {
            return (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 6px', padding: '4px 0', alignItems: 'center' }}>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(m); if (e.key === 'Escape') setEditingId(null) }}
                  style={{ padding: '3px 6px', fontSize: 12, gridColumn: '1' }}
                  autoFocus
                />
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ width: 120, padding: '3px 6px', fontSize: 12 }} />
                <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => saveEdit(m)}>Save</button>
                <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            )
          }
          return (
            <div key={m.id} style={{
              display: 'grid',
              gridTemplateColumns: '16px 1fr auto auto auto',
              gap: '0 8px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '0.5px solid var(--border-light)',
              width: '100%',
              opacity: m.done ? 0.55 : 1,
            }}>
              <input type="checkbox" checked={m.done} onChange={() => toggleDone(m)} style={{ cursor: 'pointer', margin: 0 }} />
              <span style={{
                fontSize: 12, lineHeight: 1.4, minWidth: 0,
                wordBreak: 'break-word',
                textDecoration: m.done ? 'line-through' : 'none',
                color: m.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
              }}>
                {m.title}
              </span>
              <span style={{
                fontSize: 11, whiteSpace: 'nowrap',
                color: isOverdue ? '#dc2626' : 'var(--text-tertiary)',
                fontWeight: isOverdue ? 600 : 400,
              }}>
                {m.dueDate ? `${isOverdue ? '⚠ ' : ''}${fmtDate(m.dueDate)}` : ''}
              </span>
              <button onClick={() => { setEditingId(m.id); setEditTitle(m.title); setEditDate(m.dueDate || '') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 11, opacity: 0.6, padding: '0 2px' }}
                title="Edit">✏️</button>
              <button onClick={() => deleteMilestone(m)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, opacity: 0.5, padding: '0 2px' }}
                title="Delete">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Project edit modal ────────────────────────────────────────────────────────
function ProjectEditModal({ project, analysts, onSave, onClose }) {
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }
  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-box" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 600, fontSize: 15 }}>Edit project</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProjectForm initial={project} analysts={analysts} onSave={onSave} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}

// ── Status section (collapsible group of projects by status) ──────────────────
function StatusSection({ status, projects, expanded, setExpanded, onEdit, confirmDelete, setConfirmDelete, analysts, handleDelete, handleNoteChange, onProjectUpdate, showToast, sectionCollapsed, onToggleSection }) {
  if (projects.length === 0) return null
  const label = STATUS_LABELS[status] || status
  const icon  = STATUS_ICONS[status]  || '📁'

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Section header */}
      <div
        onClick={onToggleSection}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          padding: '7px 4px', userSelect: 'none', marginBottom: 6,
          borderBottom: sectionCollapsed ? 'none' : '0.5px solid var(--border-light)',
          paddingBottom: sectionCollapsed ? 7 : 10,
        }}
      >
        <span style={{
          fontSize: 10, color: 'var(--text-tertiary)', display: 'inline-block',
          transition: 'transform .15s', transform: sectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>▾</span>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
          background: STATUS_CONFIG[status]?.color || 'var(--text-tertiary)',
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1px' }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: STATUS_CONFIG[status]?.color || 'var(--text-tertiary)',
          background: STATUS_CONFIG[status]?.bg || 'var(--bg-secondary)',
          padding: '1px 7px', borderRadius: 10,
        }}>{projects.length}</span>
      </div>

      {!sectionCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map(p => {
            const tc = TYPE_CONFIG[p.type] || TYPE_CONFIG.side
            const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.active
            const milestoneCount = p.milestones?.length || 0
            const doneMilestones = p.milestones?.filter(m => m.done).length || 0
            const lastNote = p.projectNotes?.[0]
            const daysLeft = p.endDate ? Math.round((new Date(p.endDate) - new Date()) / 86400000) : null

            return (
              <div key={p.id} style={{
                background: 'var(--bg-card)',
                border: '0.5px solid var(--border-light)',
                borderLeft: `3px solid ${tc.color}`,
                borderRadius: 'var(--radius)',
                padding: '11px 14px',
              }}>
                {/* Row 1: type chip · status pill · actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                    color: tc.color, background: tc.bg, padding: '2px 6px', borderRadius: 3,
                  }}>{tc.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.2px',
                    color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: 10,
                  }}>{sc.label}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, padding: '3px 8px' }}
                      onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                      {expanded[p.id] ? '▲ Less' : '▾ Details'}
                    </button>
                    <button className="btn btn-ghost btn-sm"
                      style={{ fontSize: 13, padding: '3px 6px' }}
                      onClick={() => onEdit(p)} title="Edit">✏️</button>
                    {confirmDelete === p.id ? (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
                        <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text-tertiary)', fontSize: 15, padding: '3px 6px', opacity: 0.5 }}
                        onClick={() => setConfirmDelete(p.id)} title="Delete">✕</button>
                    )}
                  </div>
                </div>

                {/* Row 2: project name */}
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 7 }}>
                  {p.name}
                </div>

                {/* Row 3: analyst avatars + dates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  {p.analysts?.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      {p.analysts.slice(0, 7).map(pa => {
                        const a = analysts.find(x => x.id === pa.analystId) || pa.analyst
                        if (!a) return null
                        const color = ANALYST_COLORS[(a.color || 0) % ANALYST_COLORS.length]
                        return (
                          <div key={pa.analystId} title={a.name} style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: color, color: '#fff',
                            fontSize: 9, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1.5px solid var(--bg-card)',
                          }}>{a.initials}</div>
                        )
                      })}
                      {p.analysts.length > 7 && (
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>+{p.analysts.length - 7}</div>
                      )}
                    </div>
                  )}
                  {(p.startDate || p.endDate) && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      <span>📅</span>
                      {p.startDate && <span>{new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      {p.startDate && p.endDate && <span>→</span>}
                      {p.endDate && <span style={{ color: daysLeft !== null && daysLeft < 7 && daysLeft >= 0 ? '#dc2626' : 'inherit' }}>
                        {new Date(p.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>}
                      {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>· {daysLeft}d left</span>
                      )}
                      {daysLeft !== null && daysLeft < 0 && (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>· Overdue</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Row 4: description (1 line, truncated) */}
                {p.notes && (
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}>{p.notes}</div>
                )}

                {/* Bottom summary strip (collapsed only) */}
                {!expanded[p.id] && (milestoneCount > 0 || lastNote) && (
                  <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    paddingTop: 7, marginTop: 4,
                    borderTop: '0.5px solid var(--border-light)',
                    fontSize: 11, color: 'var(--text-tertiary)',
                  }}>
                    {milestoneCount > 0 && (
                      <span style={{
                        fontWeight: 600, whiteSpace: 'nowrap',
                        color: doneMilestones === milestoneCount ? '#16a34a' : 'var(--text-tertiary)',
                      }}>
                        ✓ {doneMilestones}/{milestoneCount}
                      </span>
                    )}
                    {lastNote && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        💬 {lastNote.text.slice(0, 90)}
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded: milestones + updates + assignments */}
                {expanded[p.id] && (
                  <div style={{ borderTop: '0.5px solid var(--border-light)', marginTop: 8, paddingTop: 8 }}>
                    <ProjectMilestones project={p} onUpdate={onProjectUpdate} showToast={showToast} />
                    <ProjectUpdates project={p} onNoteAdded={handleNoteChange} showToast={showToast} analysts={analysts} />
                    <AssignmentTable project={p} analysts={analysts} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function ProjectsTab({ projects, setProjects, analysts, loading, showToast }) {
  const [showForm,         setShowForm]         = useState(false)
  const [editing,          setEditing]          = useState(null)
  const [confirmDelete,    setConfirmDelete]     = useState(null)
  const [expanded,         setExpanded]         = useState({})
  const [sectionCollapsed, setSectionCollapsed] = useState({ done: true, hold: false })
  const [showChat,         setShowChat]         = useState(false)
  const [slackSuggestions, setSlackSuggestions] = useState([])

  // Load Slack suggestions on mount
  useEffect(() => {
    fetch('/api/projects/suggestions')
      .then(r => r.json())
      .then(d => { if (d.items?.length) setSlackSuggestions(d.items) })
      .catch(() => {})
  }, [])

  // Re-fetch all projects (called after chat actions)
  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) setProjects(await res.json())
    } catch {}
  }, [setProjects])

  // Called when milestones change on a project
  const handleProjectUpdate = useCallback((projectId, patch) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...patch } : p))
  }, [setProjects])

  // Called when a note is added (note = new note object) or deleted (note = null, noteId provided)
  const handleNoteChange = useCallback((projectId, note, deletedNoteId) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p
      if (deletedNoteId) {
        return { ...p, projectNotes: (p.projectNotes || []).filter(n => n.id !== deletedNoteId) }
      }
      return { ...p, projectNotes: [note, ...(p.projectNotes || [])] }
    }))
  }, [setProjects])

  async function handleCreate(data) {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create project')
      const created = await res.json()
      setProjects(prev => [created, ...prev])
      setShowForm(false)
    } catch (e) { showToast(e.message) }
  }

  async function handleUpdate(data) {
    try {
      const res = await fetch(`/api/projects/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update project')
      const updated = await res.json()
      setProjects(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x))
      setEditing(null)
    } catch (e) { showToast(e.message) }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setProjects(prev => prev.filter(p => p.id !== id))
      setConfirmDelete(null)
    } catch (e) { showToast(e.message) }
  }

  async function applySlackSuggestion(s) {
    try {
      if (s.type === 'update' || s.type === 'milestone') {
        if (!s.projectId) return
        await fetch(`/api/projects/${s.projectId}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `[Slack] ${s.content}` }),
        })
        setSlackSuggestions(prev => prev.filter(x => x !== s))
        await refreshProjects()
        showToast('Update applied')
      } else if (s.type === 'status' && s.projectId && s.suggestedStatus) {
        await fetch(`/api/projects/${s.projectId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: s.suggestedStatus }),
        })
        setSlackSuggestions(prev => prev.filter(x => x !== s))
        await refreshProjects()
        showToast(`Status updated to ${s.suggestedStatus}`)
      } else if (s.type === 'new') {
        // Open the form — user can review before creating
        setShowForm(true)
        setSlackSuggestions(prev => prev.filter(x => x !== s))
        showToast('Fill in the new project details below')
      } else {
        setSlackSuggestions(prev => prev.filter(x => x !== s))
      }
    } catch (e) { showToast(e.message) }
  }

  async function dismissAllSuggestions() {
    setSlackSuggestions([])
    await fetch('/api/projects/suggestions', { method: 'DELETE' }).catch(() => {})
  }

  if (loading) return <div className="empty-state">Loading…</div>

  return (
    <div>
      <div className="tab-header">
        <div className="tab-title">Projects</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowChat(c => !c)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            💬 Chat
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add project</button>
        </div>
      </div>

      {/* Slack suggestions banner */}
      {slackSuggestions.length > 0 && (
        <SlackSuggestionsBanner
          suggestions={slackSuggestions}
          projects={projects}
          analysts={analysts}
          onApply={applySlackSuggestion}
          onDismiss={s => setSlackSuggestions(prev => {
            const next = prev.filter(x => x !== s)
            if (next.length === 0) fetch('/api/projects/suggestions', { method: 'DELETE' }).catch(() => {})
            return next
          })}
          onDismissAll={dismissAllSuggestions}
        />
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-label" style={{ marginBottom: 12 }}>New project</div>
          <ProjectForm analysts={analysts} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {projects.length === 0 && !showForm && (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          No projects yet — add your Google projects and side work here.
        </div>
      )}

      {STATUS_ORDER.map(status => {
        const group = projects.filter(p => (p.status || 'active') === status)
        return (
          <StatusSection
            key={status}
            status={status}
            projects={group}
            expanded={expanded}
            setExpanded={setExpanded}
            onEdit={p => setEditing(p)}
            confirmDelete={confirmDelete}
            setConfirmDelete={setConfirmDelete}
            analysts={analysts}
            handleDelete={handleDelete}
            handleNoteChange={handleNoteChange}
            onProjectUpdate={handleProjectUpdate}
            showToast={showToast}
            sectionCollapsed={!!sectionCollapsed[status]}
            onToggleSection={() => setSectionCollapsed(prev => ({ ...prev, [status]: !prev[status] }))}
          />
        )
      })}

      {/* Any unknown statuses not in STATUS_ORDER */}
      {(() => {
        const known = new Set(STATUS_ORDER)
        const unknown = projects.filter(p => p.status && !known.has(p.status))
        if (!unknown.length) return null
        return (
          <StatusSection
            status="other"
            projects={unknown}
            expanded={expanded}
            setExpanded={setExpanded}
            onEdit={p => setEditing(p)}
            confirmDelete={confirmDelete}
            setConfirmDelete={setConfirmDelete}
            analysts={analysts}
            handleDelete={handleDelete}
            handleNoteChange={handleNoteChange}
            onProjectUpdate={handleProjectUpdate}
            showToast={showToast}
            sectionCollapsed={!!sectionCollapsed['other']}
            onToggleSection={() => setSectionCollapsed(prev => ({ ...prev, other: !prev.other }))}
          />
        )
      })()}

      {/* Edit modal */}
      {editing && (
        <ProjectEditModal
          project={editing}
          analysts={analysts}
          onSave={handleUpdate}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Chat panel */}
      {showChat && (
        <ProjectChatPanel
          onClose={() => setShowChat(false)}
          onProjectsChanged={refreshProjects}
        />
      )}
    </div>
  )
}
