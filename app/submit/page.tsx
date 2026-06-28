'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SubmitPage() {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [recording, setRecording] = useState(false)
  const router = useRouter()

  const startVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input not supported. Please use Chrome.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setText(prev => (prev ? prev + ' ' + transcript : transcript))
    }
    recognition.onend = () => setRecording(false)
    recognition.onerror = () => setRecording(false)
    recognition.start()
    setRecording(true)
  }

  const handleSubmit = async () => {
  if (!text.trim()) return
  setSubmitting(true)

  try {
    console.log('Submitting...')

    const url = `https://firestore.googleapis.com/v1/projects/crisis-coordinator/databases/(default)/documents/reports?key=AIzaSyCePv2LwNA5ABNbXqXmnpRAJIvT5v0fKfI`

    const body = {
      fields: {
        raw_text:     { stringValue: text.trim() },
        source:       { stringValue: 'text' },
        status:       { stringValue: 'pending' },
        submitted_at: { stringValue: new Date().toISOString() },
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    console.log('Status:', response.status)

    if (!response.ok) {
      const err = await response.json()
      console.error('Error:', err)
      throw new Error(err?.error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    console.log('Success! ID:', data.name)
    setDone(true)
    setTimeout(() => router.push('/'), 2500)

  } catch (err: any) {
    console.error('Failed:', err)
    alert(`Failed: ${err.message}`)
    setSubmitting(false)
  }
}

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-sm w-full shadow-sm">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Report Submitted!</h2>
          <p className="text-gray-500 text-sm">AI is processing your report. Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 font-medium">
            ← Back to Dashboard
          </Link>
          <h1 className="text-base font-bold text-gray-900">Submit Field Report</h1>
          <div className="w-24" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">What is happening?</h2>
            <p className="text-sm text-gray-500">
              Describe the situation — who needs help, where, how many people affected.
            </p>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick examples</p>
            <div className="flex flex-wrap gap-2">
              {[
                '50 families near river bridge have no food for 2 days',
                'Medical emergency — children sick with fever, no doctor nearby',
                'Building collapsed, people trapped inside',
              ].map(ex => (
                <button key={ex} onClick={() => setText(ex)}
                  className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors text-left">
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Example: Around 80 people near the river bridge with no food. Some children have fever since yesterday."
            className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm text-gray-900 placeholder-gray-400 min-h-40 resize-none focus:outline-none focus:border-blue-400 transition-colors bg-white"
          />

          <div className="text-right mt-1 mb-4">
            <span className="text-xs text-gray-400">{text.length} characters</span>
          </div>

          <div className="flex gap-3">
            <button onClick={startVoice} disabled={recording}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                recording
                  ? 'border-red-300 bg-red-50 text-red-600 animate-pulse'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}>
              <span>{recording ? '🔴' : '🎤'}</span>
              {recording ? 'Listening...' : 'Voice Input'}
            </button>

            <button onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="flex-1 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
              {submitting ? '⏳ Submitting...' : ' Submit Report'}
            </button>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-800 font-medium"> After submission, Gemini AI will automatically:</p>
            <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
              <li>Classify the emergency type</li>
              <li>Assign an urgency score (0–100)</li>
              <li>Identify affected people and location</li>
              <li>Recommend resources needed</li>
              <li>Match the nearest available volunteer</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}