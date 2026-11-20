"""Guided Apply writing helper: turns a freelancer's own Nepali words into a
professional English proposal, plus a simple Nepali back-translation so she
can check the meaning before anything is sent.

The input may be Devanagari Nepali, Roman Nepali, or a Nepali/English mix.
The model is instructed to use ONLY facts the user wrote: it must never
invent skills, experience, clients, prices or timelines. This service calls
the Gemini API from the backend only; the key is never exposed to the
browser. If no key is configured the feature reports itself unavailable and
the frontend keeps the user's draft untouched.
"""

import json
import urllib.error
import urllib.request

from django.conf import settings


class ProposalUnavailable(Exception):
    """Raised when the writing helper cannot be used right now."""


PROMPT = """You help a first-time freelancer in Nepal write a job proposal.
She wrote the following in her own words. It may be in Nepali (Devanagari
script), Roman Nepali, English, or a mix:

---
{job_line}{text}
---

Write a short professional English proposal message from her words.

STRICT RULES:
- Use ONLY facts she wrote. Never invent skills, experience, past clients,
  prices, or timelines. If she did not state something, do not add it.
- Keep every number she wrote exactly as she wrote it.
- Warm, professional, simple English. 60 to 110 words. First person.
- Do not add a name or signature; end with a polite closing line only.
- Then translate your English proposal into simple everyday Nepali
  (Devanagari script, polite spoken style) so she can check the meaning.

Reply with ONLY a JSON object, no other text:
{{"english": "<the English proposal>", "nepali": "<the simple Nepali translation of it>"}}"""


def _generate(prompt):
    key = getattr(settings, 'GEMINI_API_KEY', '') or ''
    if not key.strip():
        raise ProposalUnavailable('GEMINI_API_KEY is not configured.')
    model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash-lite')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.3},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key.strip()},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise ProposalUnavailable('The writing service could not be reached.') from exc
    try:
        return data['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError, TypeError) as exc:
        raise ProposalUnavailable('The writing service returned an unexpected reply.') from exc


def draft_proposal(text, job_title=''):
    job_line = f'The job she is applying for: {job_title}\n\n' if job_title else ''
    raw = _generate(PROMPT.format(job_line=job_line, text=text))
    cleaned = raw.strip()
    if cleaned.startswith('```'):
        cleaned = cleaned.strip('`')
        if cleaned.lower().startswith('json'):
            cleaned = cleaned[4:].strip()
    try:
        result = json.loads(cleaned)
        english = str(result['english']).strip()
        nepali = str(result['nepali']).strip()
    except (ValueError, KeyError, TypeError) as exc:
        raise ProposalUnavailable('The writing service returned an unreadable reply.') from exc
    if not english or not nepali or len(english) > 4000 or len(nepali) > 4000:
        raise ProposalUnavailable('The writing service returned an incomplete reply.')
    return {'english': english, 'nepali': nepali}
