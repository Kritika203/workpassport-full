"""Conservative, auditable job screening. Passing is NOT verification."""
import re
from decimal import Decimal

CRITICAL = {
    'upfront_fee': r'\b(?:registration|activation|security|training|processing)\s+fee\b|\bpay\s+(?:to\s+)?(?:apply|join|start)\b',
    'credentials': r'\b(?:send|share|give|provide)\s+(?:your\s+)?(?:otp|pin|password|bank\s+login|verification code)\b',
    'guaranteed_earnings': r'\bguaranteed\s+(?:daily\s+)?(?:returns?|income|profit)\b',
}
REVIEW = {
    'external_contact': r'\b(?:telegram|whatsapp)\s+(?:only|to apply|for payment)\b',
    'personal_contact': r'[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?977\s?9\d{9}',
    'external_link': r'https?://\S+|\bbit\.ly/\S+',
}


def evaluate(job):
    desc = (job.description or '').strip()
    title = (job.title or '').strip()
    text = f'{title} {desc} {job.caution_note or ""}'.lower()
    skills = job.required_skills if isinstance(job.required_skills, list) else []
    delivery = job.deliverables if isinstance(job.deliverables, list) else []
    completeness = {
        'title': len(title) >= 10 and len(title.split()) >= 2,
        'description': len(desc) >= 90 and len(desc.split()) >= 15,
        'skills': len(skills) > 0,
        'deliverables': any((isinstance(x, str) and len(x.strip()) >= 8) or (isinstance(x, dict) and bool(x.get('name'))) for x in delivery),
        'budget': Decimal('10') <= job.budget_usd <= Decimal('100000'),
        'deadline': 1 <= job.deadline_days <= 180,
        'employer': len((job.client_name or '').strip()) >= 3,
    }
    reasons = [f'unclear_{key}' for key, ok in completeness.items() if not ok]
    critical = [key for key, pattern in CRITICAL.items() if re.search(pattern, text, re.I)]
    review = [key for key, pattern in REVIEW.items() if re.search(pattern, text, re.I)]
    reasons += critical + review
    if re.search('[\u0900-\u097f]', text): reasons.append('nepali_language_needs_review')
    if job.external_url: reasons.append('external_lead')
    if len(desc) > 90 and len(set(re.findall('[a-z]{3,}', desc.lower()))) < 6: reasons.append('low_information')
    score = max(0, 100 - 12 * sum(not x for x in completeness.values()) - 45 * len(critical) - 20 * len(review))
    decision = 'hold' if critical else ('publish' if not reasons else 'review')
    return decision, score, list(dict.fromkeys(reasons)), completeness
