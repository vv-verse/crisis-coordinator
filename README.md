# 🚨 Crisis Coordinator
      AI powered Resource Allocation

An AI system that turns messy field reports into clear, prioritized action — in seconds.

---

## 🔗 Live

* Dashboard: https://crisis-coordinator-397633197942.asia-south1.run.app
* Submit: https://crisis-coordinator-397633197942.asia-south1.run.app/submit

---

## The problem

In real crisis situations, information doesn’t arrive neatly.

It comes as:

* voice notes
* WhatsApp messages
* rushed text updates
* incomplete reports

Someone has to read everything, understand it, prioritize it, and assign help.

That “someone” is usually a coordinator — and it takes hours.

That delay costs lives.

---

## What this does

Crisis Coordinator acts like a real-time decision assistant.

You drop in a raw report, and within seconds it:

* understands what’s happening
* scores urgency (0–100)
* extracts key details
* surfaces it on a live dashboard
* keeps everything sorted by priority

No manual sorting. No backlog.

---

## Core capabilities

* **AI classification**
  Gemini analyzes each report and assigns category, urgency, and context.

* **Live dashboard**
  Incoming reports appear instantly, ordered by urgency.

* **Coordinator briefing**
  One click → AI summarizes the current situation in plain language.

* **Signal over noise**
  High-risk reports stand out immediately.

* **Extensible system**
  Volunteer matching, escalation logic, and duplicate detection are built to scale.

---

## How it works

```
Submit report → Firestore  
             → Cloud Function (triggered)  
             → Gemini 2.5 processes it  
             → Structured output saved  
             → Dashboard updates in real time
```

Everything happens automatically.

---

## Stack

* **Frontend** — Next.js + Tailwind
* **Backend** — Cloud Functions (Python, Gen2)
* **AI** — Gemini 2.5 Flash
* **Database** — Firebase Firestore
* **Hosting** — Cloud Run

---

## Running locally

```bash
git clone https://github.com/vv-verse/crisis-coordinator
cd crisis-coordinator
npm install
npm run dev
```

Add your Firebase config in `.env.local`.

---

## Example

Input:
"Medical emergency near river bridge, 50 people sick, no doctor"

Output:
- Category: Medical  
- Urgency: 92  
- Summary: Large-scale illness, immediate medical response needed

## Why this matters

This isn’t just automation.

It’s about removing the delay between **information** and **action**.

When every minute matters, clarity is everything.

---


