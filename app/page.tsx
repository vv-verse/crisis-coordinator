'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  raw_text: string
  status: string
  urgency_score?: number
  urgency_tier?: string
  category?: string
  subcategory?: string
  explanation?: string
  affected_people_estimate?: number
  location_extracted?: string
  duplicate_risk?: boolean
  confidence?: number
  recommended_resources?: string[]
  stale_minutes?: number
  assigned_volunteer_id?: string
}

const tierStyle: Record<string, { badge: string; border: string; score: string }> = {
  critical: {
    badge: 'bg-red-100 text-red-700 border border-red-300',
    border: 'border-red-300 shadow-red-100 shadow-sm',
    score: 'text-red-600',
  },
  high: {
    badge: 'bg-orange-100 text-orange-700 border border-orange-300',
    border: 'border-orange-200',
    score: 'text-orange-500',
  },
  medium: {
    badge: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
    border: 'border-yellow-200',
    score: 'text-yellow-600',
  },
  low: {
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
    border: 'border-gray-200',
    score: 'text-gray-500',
  },
}

function ReportCard({ r }: { r: Report }) {
  const tier = r.urgency_tier ?? 'low'
  const styles = tierStyle[tier] ?? tierStyle.low
  const isStale = (r.stale_minutes ?? 0) > 30 && tier === 'critical'
  const needsReview = (r.confidence ?? 1) < 0.6

  if (r.status === 'pending' || r.status === 'processing') {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
        <div className="flex justify-between items-center mb-3">
          <div className="h-4 bg-gray-100 rounded-full w-24" />
          <div className="h-8 bg-gray-100 rounded w-12" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <p className="text-xs text-gray-400 mt-3">
          {r.status === 'pending' ? '⏳ Waiting for AI...' : '🤖 AI is processing...'}
        </p>
      </div>
    )
  }

  if (r.status === 'error') {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-5">
        <p className="text-sm font-medium text-red-600 mb-1">Processing failed</p>
        <p className="text-xs text-gray-500 line-clamp-2">{r.raw_text}</p>
      </div>
    )
  }

  return (
    <div className={`bg-white border-2 rounded-2xl p-5 transition-all ${styles.border} ${isStale ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}>
      {/* Header row */}
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${styles.badge}`}>
            {tier.toUpperCase()}
          </span>
          {r.category && (
            <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              {r.category} · {r.subcategory}
            </span>
          )}
          {r.duplicate_risk && (
            <span className="text-xs px-3 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
              ⚠ Possible duplicate
            </span>
          )}
          {needsReview && (
            <span className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              👁 Needs review
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-3xl font-bold ${styles.score}`}>{r.urgency_score}</div>
          <div className="text-xs text-gray-400 font-medium">/ 100</div>
        </div>
      </div>

      {/* Explanation */}
      {r.explanation && (
        <p className="text-sm text-gray-700 font-medium mb-3 leading-relaxed">
          {r.explanation}
        </p>
      )}

      {/* Meta info */}
      <div className="space-y-1 mb-3">
        {r.location_extracted && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <span>📍</span> {r.location_extracted}
          </p>
        )}
        {r.affected_people_estimate && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <span>👥</span> ~{r.affected_people_estimate.toLocaleString()} people affected
          </p>
        )}
        {r.assigned_volunteer_id && (
          <p className="text-xs text-green-600 flex items-center gap-1 font-medium">
            <span>✅</span> Volunteer assigned
          </p>
        )}
        {!r.assigned_volunteer_id && r.status === 'active' && (
          <p className="text-xs text-orange-500 flex items-center gap-1">
            <span>⚡</span> No volunteer assigned yet
          </p>
        )}
      </div>

      {/* Stale warning */}
      {isStale && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          <p className="text-xs font-bold text-red-700">
            🚨 Unresolved for {r.stale_minutes} minutes — escalation required
          </p>
        </div>
      )}

      {/* Resources */}
      {r.recommended_resources && r.recommended_resources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.recommended_resources.map(res => (
            <span key={res} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-medium">
              {res}
            </span>
          ))}
        </div>
      )}

      {/* Original text */}
      <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100 line-clamp-1 italic">
        "{r.raw_text}"
      </p>
    </div>
  )
}

export default function Dashboard() {
  const [reports, setReports] = useState<Report[]>([])
  const [briefing, setBriefing] = useState('')
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  const fetchReports = async () => {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/crisis-coordinator/databases/(default)/documents/reports?key=AIzaSyCePv2LwNA5ABNbXqXmnpRAJIvT5v0fKfI&pageSize=50`
      const res = await fetch(url)
      const data = await res.json()
      
      if (data.documents) {
        const docs = data.documents.map((doc: any) => {
          const fields = doc.fields || {}
          const id = doc.name.split('/').pop()
          
          const getStr = (f: any) => f?.stringValue || ''
          const getNum = (f: any) => f?.integerValue ? parseInt(f.integerValue) : f?.doubleValue || undefined
          const getBool = (f: any) => f?.booleanValue || false
          const getArr = (f: any) => f?.arrayValue?.values?.map((v: any) => v.stringValue) || []
          
          return {
            id,
            raw_text: getStr(fields.raw_text),
            status: getStr(fields.status),
            urgency_score: getNum(fields.urgency_score),
            urgency_tier: getStr(fields.urgency_tier),
            category: getStr(fields.category),
            subcategory: getStr(fields.subcategory),
            explanation: getStr(fields.explanation),
            affected_people_estimate: getNum(fields.affected_people_estimate),
            location_extracted: getStr(fields.location_extracted) || undefined,
            duplicate_risk: getBool(fields.duplicate_risk),
            confidence: getNum(fields.confidence),
            recommended_resources: getArr(fields.recommended_resources),
            stale_minutes: getNum(fields.stale_minutes),
            assigned_volunteer_id: getStr(fields.assigned_volunteer_id) || undefined,
          }
        })
        
        docs.sort((a: Report, b: Report) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0))
        setReports(docs)
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    } finally {
      setLoading(false)
    }
  }

  fetchReports()
  // Poll every 5 seconds for new reports
  const interval = setInterval(fetchReports, 5000)
  return () => clearInterval(interval)
}, [])

  const fetchBriefing = async () => {
  setLoadingBriefing(true)
  try {
    const res = await fetch('https://asia-south1-crisis-coordinator.cloudfunctions.net/generate_briefing')
    const data = await res.json()
    setBriefing(data.briefing)
  } catch {
    setBriefing('Could not load briefing.')
  }
  setLoadingBriefing(false)
}

  const active = reports.filter(r => r.status === 'active')
  const critical = active.filter(r => (r.urgency_score ?? 0) >= 80)
  const unassigned = active.filter(r => !r.assigned_volunteer_id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🚨 Crisis Coordinator</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI-powered NGO resource allocation</p>
          </div>
          <Link href="/submit"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            + Submit Report
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Reports', value: reports.length, color: 'text-gray-800', bg: 'bg-white' },
            { label: 'Active', value: active.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Critical', value: critical.length, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Unassigned', value: unassigned.length, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-gray-200 rounded-2xl p-4 text-center`}>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* AI Briefing */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900"> AI Coordinator Briefing</h2>
              <p className="text-xs text-gray-500 mt-0.5">Gemini analyzes all active reports and generates a situation summary</p>
            </div>
            <button onClick={fetchBriefing} disabled={loadingBriefing}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {loadingBriefing ? 'Generating...' : 'Generate'}
            </button>
          </div>
          {briefing ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-sm text-indigo-900 leading-relaxed font-medium">{briefing}</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-400 text-center">Click "Generate" to get an AI situation briefing</p>
            </div>
          )}
        </div>

        {/* Reports */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              Active Reports
              <span className="ml-2 text-sm font-normal text-gray-500">sorted by urgency</span>
            </h2>
          </div>

          {loading && (
            <div className="text-center py-12 text-gray-400">Loading reports...</div>
          )}

          {!loading && reports.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-600 font-medium">No reports yet</p>
              <p className="text-gray-400 text-sm mt-1">Submit a field report to see it here</p>
              <Link href="/submit"
                className="inline-block mt-4 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                Submit First Report
              </Link>
            </div>
          )}

          <div className="space-y-4">
            {reports.map(r => <ReportCard key={r.id} r={r} />)}
          </div>
        </div>
      </div>
    </div>
  )
}