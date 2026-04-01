'use client'
export default function Nav({ activeTab, setActiveTab, hasAttention }) {
  const tabs = [
    { id: 'team', label: 'Team' },
    { id: 'projects', label: 'Projects' },
    { id: 'meetings', label: 'Meetings' },
    { id: 'todos', label: 'My To-Dos' },
    { id: 'ai', label: 'AI Coach' },
  ]
  return (
    <nav className="nav">
      <span className="nav-brand">My Team Hub</span>
      {tabs.map(t => (
        <button key={t.id} className={`nav-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
          {t.label}
          {t.id === 'team' && hasAttention && <span className="nav-dot" />}
        </button>
      ))}
    </nav>
  )
}
