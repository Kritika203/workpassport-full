"""Small, dependency-free inference for an *experimental* text risk classifier.

If the optional public-data model has been trained locally, it takes priority.
The fallback bundled model was trained on authored synthetic examples only. It is not
clinically or operationally validated, and must never be shown as a safety proof.
The rule engine still supplies human-readable triggers and the last word on red flags.
"""
from functools import lru_cache
from math import exp, log, sqrt
from pathlib import Path
import json
import re

MODEL_DIR = Path(__file__).parent / 'model'
MODEL_PATH = MODEL_DIR / 'scam_baseline.json'
PUBLIC_MODEL_PATH = MODEL_DIR / 'scam_public_v1.json'


@lru_cache(maxsize=1)
def load_model():
    path = PUBLIC_MODEL_PATH if PUBLIC_MODEL_PATH.exists() else MODEL_PATH
    if not path.exists():
        return None
    with path.open(encoding='utf8') as file:
        return json.load(file)


def score_risk(text):
    model = load_model()
    if not model:
        return {'available': False, 'reason': 'experimental model unavailable'}
    tokens = re.findall(r'(?u)\b\w+\b', text.lower())[:800]
    features = tokens + [' '.join(tokens[i:i+2]) for i in range(len(tokens) - 1)]
    counts = {}
    for word in features:
        if word in model['coefficients']:
            counts[word] = counts.get(word, 0) + 1
    tfidf = {word: (1 + log(count)) * model['idf'][word] for word, count in counts.items()}
    norm = sqrt(sum(value * value for value in tfidf.values())) or 1.0
    linear = model['intercept'] + sum(model['coefficients'][word] * value / norm
                                       for word, value in tfidf.items())
    probability = 1.0 / (1.0 + exp(-max(-35, min(35, linear))))
    has_test = bool(model.get('metrics', {}).get('sms_test'))
    # Scores may be poorly calibrated. Do not interpret as a probability of fraud.
    return {'available': True, 'risk_score': round(probability, 3),
            'level': 'high' if probability >= 0.78 else 'review' if probability >= 0.55 else 'uncertain',
            'model': model.get('model', 'experimental-text-baseline'),
            'validated': False, 'held_out_evaluation': has_test,
            'warning': ('Research model evaluated on held-out English SMS; not validated for Nepali, '
                        'mixed languages or WorkPassport users.' if has_test else
                        'Synthetic demonstration model; not evaluated on independent real messages.')}

