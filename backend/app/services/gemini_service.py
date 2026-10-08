"""
MediSync AI — Google Gemini Explanation Service
Uses Gemini to generate human-readable explanations for transfer recommendations.
Falls back to deterministic explanations if Gemini is unavailable.

IMPORTANT: Gemini does NOT generate any numerical data.
All numbers come from the backend optimization engine.
Gemini only reformats/explains pre-computed results.
"""

import logging
import hashlib
import json
from typing import Dict, Optional
from datetime import datetime
from app.core import settings

logger = logging.getLogger(__name__)

# Simple in-memory cache for explanations
_cache: Dict[str, str] = {}
_gemini_client = None
_gemini_available = False


def _init_gemini():
    """Initialize Gemini client once."""
    global _gemini_client, _gemini_available

    if _gemini_client is not None:
        return

    api_key = settings.gemini_api_key
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — using fallback explanations")
        _gemini_available = False
        return

    try:
        from google import genai
        _gemini_client = genai.Client(api_key=api_key)
        _gemini_available = True
        logger.info(f"Gemini client initialized with model: {settings.gemini_model}")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini: {e}")
        _gemini_available = False


def _cache_key(data: dict) -> str:
    """Generate cache key from recommendation data."""
    relevant = {
        "src": data.get("source_hospital_name", ""),
        "dst": data.get("destination_hospital_name", ""),
        "qty": data.get("quantity", 0),
        "time": data.get("estimated_transport_minutes", 0),
        "hours": str(data.get("hours_to_shortage", "")),
    }
    return hashlib.md5(json.dumps(relevant, sort_keys=True).encode()).hexdigest()


def generate_explanation(recommendation_data: dict) -> str:
    """
    Generate a human-readable explanation for a transfer recommendation.
    Uses Gemini if available, otherwise returns deterministic fallback.

    The recommendation_data dict should contain:
    - source_hospital_name
    - destination_hospital_name
    - quantity
    - estimated_transport_minutes
    - hours_to_shortage (destination)
    - source_current_stock
    - destination_current_stock
    - source_safety_stock
    - destination_safety_stock
    """
    _init_gemini()

    # Check cache
    key = _cache_key(recommendation_data)
    if key in _cache:
        return _cache[key]

    if _gemini_available:
        try:
            explanation = _call_gemini(recommendation_data)
            if explanation:
                _cache[key] = explanation
                return explanation
        except Exception as e:
            logger.error(f"Gemini call failed, using fallback: {e}")

    # Deterministic fallback
    explanation = _fallback_explanation(recommendation_data)
    _cache[key] = explanation
    return explanation


def _call_gemini(data: dict) -> Optional[str]:
    """Call Gemini API with structured recommendation data."""
    global _gemini_client

    prompt = f"""You are a medical resource coordination assistant for a SIMULATED hospital network.
Based on the following pre-computed transfer recommendation data, write a clear, concise operational summary.

Do NOT invent any numbers. Use ONLY the data provided below.

TRANSFER RECOMMENDATION DATA:
- Source Hospital: {data.get('source_hospital_name', 'Unknown')}
- Destination Hospital: {data.get('destination_hospital_name', 'Unknown')}
- Transfer Quantity: {data.get('quantity', 0)} oxygen cylinders
- Estimated Transport Time: {data.get('estimated_transport_minutes', 0):.0f} minutes
- Destination Hours to Safety Threshold: {data.get('hours_to_shortage', 'N/A')}
- Source Current Stock: {data.get('source_current_stock', 0):.0f} cylinders
- Destination Current Stock: {data.get('destination_current_stock', 0):.0f} cylinders

Provide:
1. A one-line transfer justification
2. A brief operational summary (2-3 sentences)
3. One suggested follow-up check

Keep the tone professional and clear. Remind that this is simulated data.
Format the response as plain text, not markdown."""

    try:
        response = _gemini_client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        text = response.text.strip() if response.text else None
        if text and len(text) > 10:
            return text
        return None
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return None


def _fallback_explanation(data: dict) -> str:
    """Deterministic fallback explanation when Gemini is unavailable."""
    src = data.get("source_hospital_name", "Source Hospital")
    dst = data.get("destination_hospital_name", "Destination Hospital")
    qty = data.get("quantity", 0)
    transport = data.get("estimated_transport_minutes", 0)
    hours = data.get("hours_to_shortage", None)

    parts = [
        f"TRANSFER JUSTIFICATION: Move {qty} oxygen cylinders from {src} to {dst}.",
        "",
        f"OPERATIONAL SUMMARY: {dst} is projected to reach its safety stock threshold"
    ]

    if hours is not None:
        parts[-1] += f" in approximately {hours:.1f} simulated hours."
    else:
        parts[-1] += " soon."

    parts.append(
        f"{src} has sufficient surplus to supply {qty} cylinders while maintaining "
        f"its own safety reserve. Estimated transport time is {transport:.0f} minutes."
    )
    parts.append("")
    parts.append(
        f"FOLLOW-UP: Verify {dst}'s receiving capacity and confirm transport availability "
        f"before dispatch."
    )
    parts.append("")
    parts.append("NOTE: This is simulated data for demonstration purposes.")

    return "\n".join(parts)


def generate_emergency_explanation(hospital_name: str, old_rate: float, new_rate: float) -> str:
    """Generate explanation for an emergency surge event."""
    _init_gemini()

    data = {
        "hospital": hospital_name,
        "old_rate": old_rate,
        "new_rate": new_rate,
    }
    key = f"emergency_{hashlib.md5(json.dumps(data).encode()).hexdigest()}"
    if key in _cache:
        return _cache[key]

    if _gemini_available:
        try:
            prompt = f"""You are a medical resource coordination assistant for a SIMULATED hospital network.
An emergency demand surge has been triggered at {hospital_name}.
The oxygen cylinder consumption rate increased from {old_rate:.1f} to {new_rate:.1f} cylinders per simulated hour.

Write a brief, clear alert message (3-4 sentences) explaining:
1. What happened
2. The immediate impact on oxygen supply
3. That the system is recalculating transfer recommendations

Use ONLY the provided numbers. This is simulated data."""

            response = _gemini_client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
            )
            if response.text:
                _cache[key] = response.text.strip()
                return _cache[key]
        except Exception as e:
            logger.error(f"Gemini emergency explanation failed: {e}")

    # Fallback
    explanation = (
        f"⚠️ EMERGENCY SURGE ALERT: {hospital_name} is experiencing a sudden increase "
        f"in oxygen demand. Consumption rate has risen from {old_rate:.1f} to {new_rate:.1f} "
        f"cylinders per simulated hour ({new_rate/old_rate:.1f}x normal). "
        f"The system is automatically recalculating shortage predictions and transfer "
        f"recommendations. Immediate review of available donor hospitals is recommended. "
        f"(Simulated scenario for demonstration.)"
    )
    _cache[key] = explanation
    return explanation


def clear_cache():
    """Clear the explanation cache."""
    global _cache
    _cache = {}
