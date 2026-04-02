'use client'
export default function Nav({ activeTab, setActiveTab, hasAttention, settings, onOpenSettings }) {
  const tabs = [
    { id: 'team', label: 'Team' },
    { id: 'projects', label: 'Projects' },
    { id: 'meetings', label: 'Meetings' },
    { id: 'todos', label: 'My To-Dos' },
    { id: 'ai', label: 'AI Coach' },
  ]
  const name = settings?.managerName || ''
  const title = settings?.managerTitle || ''

  return (
    <nav className="nav">
      <span className="nav-brand">My Team Hub</span>
      {tabs.map(t => (
        <button key={t.id} className={`nav-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
          {t.label}
          {t.id === 'team' && hasAttention && <span className="nav-dot" />}
        </button>
      ))}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {name ? (
          <button className="btn btn-ghost btn-sm" onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--accent-blue-bg)', color: 'var(--accent-blue-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0
            }}>
              {name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{name}</span>
            {title && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{title}</span>}
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={onOpenSettings} style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Set your name →
          </button>
        )}
      </div>
    </nav>
  )
}
