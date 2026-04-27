# functions/main.py — COMPLETE FINAL VERSION
# Contains all 3 functions: process_report, generate_briefing, escalation_pulse

import os
import json
import logging
import functions_framework
import firebase_admin
from firebase_admin import firestore
import requests
import google.auth
import google.auth.transport.requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

PROMPT = """
You are a crisis assessment AI for an NGO coordination system.
Read the field report below and return ONLY a valid JSON object.
No explanation. No markdown. No code fences. Pure JSON only.

Return exactly these fields:
{
  "category": one of ["medical", "food", "shelter", "water", "safety", "infrastructure", "other"],
  "subcategory": short string describing the specific issue,
  "urgency_score": integer from 0 to 100,
  "urgency_tier": one of ["critical", "high", "medium", "low"],
  "explanation": one sentence under 20 words explaining the urgency score,
  "affected_people_estimate": integer if mentioned in report or null,
  "location_extracted": exact location words from the report as string or null,
  "needs_immediate_action": true or false,
  "duplicate_risk": true or false,
  "confidence": decimal from 0.0 to 1.0,
  "recommended_resources": array of up to 3 strings
}

Urgency score rules:
90-100 = life-threatening right now
70-89  = will get worse within hours without help
50-69  = serious but stable for 1-2 days
30-49  = moderate, not immediately dangerous
0-29   = low urgency or just informational
"""


def parse_gemini_response(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        lines = text.splitlines()
        text = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        ).strip()
    return json.loads(text)


def call_gemini(raw_text: str, prompt: str = "", temperature: float = 0.1, max_tokens: int = 600) -> str:
    """Call Gemini API and return raw text response."""
    use_prompt = prompt if prompt else f"{PROMPT}\n\nField report:\n{raw_text}"
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    body = {
        "contents": [{"parts": [{"text": use_prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
    }
    response = requests.post(url, json=body, timeout=60)
    logger.info(f"Gemini status: {response.status_code}")
    if response.status_code != 200:
        logger.error(f"Gemini error: {response.text[:300]}")
    response.raise_for_status()
    return response.json()["candidates"][0]["content"]["parts"][0]["text"]


def get_report_id(cloud_event) -> str:
    """Extract report document ID from Firestore cloud event."""
    try:
        raw = cloud_event.data
        text = raw.decode("latin-1")
        marker = "reports/"
        idx = text.find(marker)
        if idx != -1:
            after = text[idx + len(marker):]
            report_id = ""
            for ch in after:
                if ch.isprintable() and ch not in [" ", "\n", "\r", "/"]:
                    report_id += ch
                else:
                    break
            if report_id:
                logger.info(f"Got report_id from binary scan: {report_id}")
                return report_id
    except Exception as e:
        logger.warning(f"Binary scan failed: {e}")
    return ""


# ============================================================
# FUNCTION 1: process_report
# Trigger: Firestore document created in reports/{reportId}
# ============================================================

@functions_framework.cloud_event
def process_report(cloud_event):
    logger.info("=== Firestore trigger received ===")

    # Step 1: Get report ID
    report_id = get_report_id(cloud_event)
    if not report_id:
        logger.error("Could not extract report_id — aborting")
        return

    logger.info(f"Report ID: {report_id}")

    # Step 2: Fetch document from Firestore
    doc_ref = db.collection("reports").document(report_id)
    try:
        doc = doc_ref.get()
    except Exception as e:
        logger.error(f"Firestore fetch failed: {e}")
        return

    if not doc.exists:
        logger.error(f"Document {report_id} not found")
        return

    data = doc.to_dict()
    current_status = data.get("status", "")
    raw_text = data.get("raw_text", "").strip()

    logger.info(f"Status: {current_status}")
    logger.info(f"raw_text: {raw_text[:120]}")

    # Step 3: Only process pending reports
    if current_status != "pending":
        logger.info(f"Skipping — status is '{current_status}'")
        return

    if not raw_text:
        doc_ref.update({"status": "error", "error_message": "No raw_text"})
        return

    # Step 4: Mark as processing
    doc_ref.update({"status": "processing"})
    logger.info("Marked as processing")

    # Step 5: Call Gemini for classification
    try:
        logger.info("Calling Gemini...")
        response_text = call_gemini(raw_text)
        logger.info(f"Gemini response: {response_text[:300]}")
        ai_result = parse_gemini_response(response_text)
        logger.info(
            f"Classified: tier={ai_result.get('urgency_tier')} "
            f"score={ai_result.get('urgency_score')} "
            f"category={ai_result.get('category')}"
        )
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Gemini: {e}")
        doc_ref.update({"status": "error", "error_message": "Invalid JSON from Gemini"})
        return
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        doc_ref.update({"status": "error", "error_message": str(e)})
        return

    # Step 6: Match volunteer
    matched_volunteer_id = None
    try:
        category = ai_result.get("category", "other")
        for vol in db.collection("volunteers").where("available", "==", True).stream():
            if category in vol.to_dict().get("skills", []):
                matched_volunteer_id = vol.id
                logger.info(f"Matched volunteer: {vol.id}")
                break
    except Exception as e:
        logger.warning(f"Volunteer match failed (non-fatal): {e}")

    # Step 7: Save all results
    doc_ref.update({
        **ai_result,
        "status": "active",
        "assigned_volunteer_id": matched_volunteer_id,
        "stale_minutes": 0,
        "processed_at": firestore.SERVER_TIMESTAMP,
    })

    logger.info(f"=== Report {report_id} successfully processed ===")


# ============================================================
# FUNCTION 2: generate_briefing
# Trigger: HTTP GET — called from dashboard Generate button
# ============================================================

@functions_framework.http
def generate_briefing(request):
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }

    if request.method == "OPTIONS":
        return ("", 204, cors)

    try:
        active_reports = (
            db.collection("reports")
            .where("status", "==", "active")
            .limit(20)
            .stream()
        )
        reports = [r.to_dict() for r in active_reports]

        if not reports:
            return (
                json.dumps({"briefing": "No active reports at this time. All clear."}),
                200, cors
            )

        # Build summary for Gemini
        lines = []
        for r in sorted(reports, key=lambda x: -(x.get("urgency_score") or 0)):
            score    = r.get("urgency_score", "?")
            cat      = r.get("category", "unknown")
            sub      = r.get("subcategory", "")
            loc      = r.get("location_extracted") or "unknown location"
            people   = r.get("affected_people_estimate")
            assigned = "volunteer assigned" if r.get("assigned_volunteer_id") else "UNASSIGNED"
            stale    = r.get("stale_minutes", 0)

            line = f"- Score {score}: {cat}/{sub} at {loc}, {assigned}"
            if people:
                line += f", ~{people} people"
            if stale and stale > 30:
                line += f", UNRESOLVED {stale} MIN"
            lines.append(line)

        briefing_prompt = f"""You are a field coordinator AI for an NGO crisis response team.
Write a 2-3 sentence situation briefing for the coordinator.
Be specific: mention categories, numbers, and what needs immediate action.
Flag anything unresolved for a long time.
Plain English only. No bullet points. No headings. Just sentences.

Active situation:
{chr(10).join(lines)}"""

        briefing_text = call_gemini("", prompt=briefing_prompt, temperature=0.3, max_tokens=2000)
        logger.info(f"Generated briefing: {briefing_text[:150]}")

        return (json.dumps({"briefing": briefing_text.strip()}), 200, cors)

    except Exception as e:
        logger.error(f"Briefing failed: {e}")
        return (json.dumps({"briefing": f"Error generating briefing: {str(e)}"}), 500, cors)


# ============================================================
# FUNCTION 3: escalation_pulse
# Trigger: HTTP GET — called by Cloud Scheduler every 5 min
# ============================================================

@functions_framework.http
def escalation_pulse(request):
    cors = {"Access-Control-Allow-Origin": "*"}

    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        active = db.collection("reports").where("status", "==", "active").stream()
        batch = db.batch()
        updated = 0

        for report in active:
            rdata = report.to_dict()
            processed_at = rdata.get("processed_at")
            if rdata.get("urgency_score", 0) >= 60 and processed_at:
                stale = int((now - processed_at).total_seconds() / 60)
                batch.update(report.reference, {"stale_minutes": stale})
                updated += 1

        batch.commit()
        logger.info(f"Escalation pulse: updated {updated} reports")
        return (json.dumps({"status": "ok", "updated": updated}), 200, cors)

    except Exception as e:
        logger.error(f"Escalation pulse failed: {e}")
        return (json.dumps({"error": str(e)}), 500, cors)