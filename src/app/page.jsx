'use client'
import { useState, useEffect, useCallback } from 'react'
import Nav from '@/components/Nav'
import TeamTab from '@/components/TeamTab'
import ProjectsTab from '@/components/ProjectsTab'
import MeetingsTab from '@/components/MeetingsTab'
import TodosTab from '@/components/TodosTab'
import AICoach from '@/components/AICoach'
import SettingsModal from '@/components/SettingsModal'

export default function Home() {
  const [activeTab, setActiveTab] = useState('team')
  const [analysts, setAnalysts] = useState([])
  const [projects, setProjects] = useState([])
  const [meetings, setMeetings] = useState([])
  const [todos, setTodos] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toasts, setToasts] = useState([])
  const [showSettings, setShowSettings] = useState(false)

  const showToast = useCallback((msg, type = 'error') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, p, m, td, s] = await Promise.all([
        fetch('/api/team').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/meetings').then(r => r.json()),
        fetch('/api/todos').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
      setAnalysts(Array.isArray(a) ? a : [])
      setProjects(Array.isArray(p) ? p : [])
      setMeetings(Array.isArray(m) ? m : [])
      setTodos(Array.isArray(td) ? td : [])
      setSettings(s && !s.error ? s : {})
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // No auto-popup — user opens settings manually via nav

  const hasAttention = analysts.some(a => !a.pending && a.mood === 'l')

  return (
    <div className="app-shell">
      <Nav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasAttention={hasAttention}
        settings={settings}
        onOpenSettings={() => setShowSettings(true)}
      />
      <main className="tab-content">
        {error && (
          <div style={{ background: 'var(--accent-red-bg)', color: 'var(--accent-red-text)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Failed to load data: {error}</span>
            <button className="btn btn-sm" onClick={fetchAll}>Retry</button>
          </div>
        )}
        {activeTab === 'team'     && <TeamTab analysts={analysts} setAnalysts={setAnalysts} meetings={meetings} loading={loading} showToast={showToast} />}
        {activeTab === 'projects' && <ProjectsTab projects={projects} setProjects={setProjects} analysts={analysts} loading={loading} showToast={showToast} />}
        {activeTab === 'meetings' && <MeetingsTab meetings={meetings} setMeetings={setMeetings} analysts={analysts} setAnalysts={setAnalysts} setProjects={setProjects} setTodos={setTodos} loading={loading} showToast={showToast} />}
        {activeTab === 'todos'    && <TodosTab todos={todos} setTodos={setTodos} analysts={analysts} loading={loading} showToast={showToast} />}
        {activeTab === 'ai'       && <AICoach analysts={analysts} projects={projects} meetings={meetings} todos={todos} settings={settings} showToast={showToast} />}
      </main>
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={s => setSettings(s)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
