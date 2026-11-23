"""Rules used by the web app's WorkShield screen."""
import re
from .ai_scanner import score_risk

RED = {
    'fee': ('registration fee', 'pay first', 'deposit', 'training fee', 'send money', 'processing fee', 'activation fee'),
    'otp': ('otp', 'password', 'pin code', 'bank pin', 'cvv'),
    'crypto': ('gift card', 'bitcoin', 'crypto', 'usdt'),
    'offplatform': ('whatsapp', 'telegram', 'viber', 'personal number', 'call me at night'),
    'photo': ('send your photo', 'send a selfie', 'your picture', 'personal photo'),
    'urgency': ('urgent', 'act now', 'only today', 'immediately', 'last chance', 'hurry'),
    'nepali_payment': ('pahila paisa', 'pahile paisa', 'paisa pathau', 'deposit gara', 'registration fee pathau', 'दर्ता शुल्क तिर्नु', 'पहिले पैसा पठाउनु', 'अग्रिम रकम जम्मा'),
    'nepali_credentials': ('otp ra password', 'pin pathau', 'ओटिपी र पासवर्ड', 'बैंकको पिन', 'पासवर्ड पठाउन'),
}
SAFETY = {
    'photo': ('selfie', 'send your photo', 'send a photo', 'send me a photo', 'your photo', 'your picture', 'send pic', 'photo of you', 'personal photo'),
    'meeting': ('meet me', 'meet alone', 'come to my office', 'come to my home', 'visit me', 'meet in person', 'hotel'),
    'pressure': ('stupid', 'idiot', 'useless', 'waste my time', 'bad review if', 'i will report you', 'do it now or', 'last warning', 'shut up'),
    'call': ('video call', 'voice call', 'call me now', 'call me', 'phone call', 'come on video'),
    'personal': ('are you single', 'boyfriend', 'are you married', 'how old are you', 'your home address', 'where do you live exactly', 'send your number', 'your phone number', 'personal number'),
    'flirty': ('sweetheart', 'beautiful girl', 'pretty girl', 'i like you', 'you are cute'),
    'night': ('are you still up', 'still awake', 'are you awake', 'up late', 'midnight', 'so late at night'),
}
FREE = ('free sample', 'free work', 'do one free', 'unpaid trial', 'trial work')
WORK = ('logo', 'poster', 'design', 'posts', 'rows', 'words', 'article', 'video', 'photo edit', 'file', 'files', 'page', 'banner', 'translation', 'type', 'typing', 'label', 'labels')
PAY = ('pay', 'paid', 'payment', '$', 'rs', 'npr', 'salary', 'rate')
METHOD = ('bank transfer', 'esewa', 'khalti', 'milestone')
DEADLINE = ('deadline', 'days', 'by friday', 'by monday', 'within a week', 'tomorrow')
SCOPE = ('can you also', 'could you also', 'please also', 'one more thing', 'also make', 'also create', 'also write', 'also design', 'also add', 'extra work', 'for free', 'quick favour', 'quick favor', "while you're at it", 'while you are at it', 'not in our list', 'not in the list', 'not in the agreement', 'add one more', 'in addition to')


def analyze(text, structural=True):
    low = text.lower()
    has = lambda words: any(word in low for word in words)
    amounts = [float(x.replace(',', '')) for x in re.findall(r'\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)', text)]
    max_amount = max(amounts, default=0)
    hourly = has(('/hour', 'per hour', 'an hour'))
    highpay = structural and bool(amounts) and (
        (hourly and max_amount >= 40) or (max_amount >= 1000 and has(('easy', 'simple', 'no experience'))))
    # Avoid obvious educational warnings like 'never share your OTP' being
    # incorrectly labelled as a credential request. This is not full negation NLP.
    educational = ('never share', 'do not share', "don't share", 'do not pay',
                   "don't pay", 'no registration fee', 'without any registration fee')
    caution_only = any(phrase in low for phrase in educational) and not any(
        phrase in low for phrase in ('you must share', 'please send', 'send me your',
                                    'transfer to', 'pay the', 'pay a '))
    red = [key for key in ('fee', 'otp', 'crypto') if has(RED[key]) and not caution_only]
    if highpay:
        red.append('highpay')
    red += [key for key in ('nepali_payment', 'nepali_credentials', 'offplatform', 'photo', 'urgency') if has(RED[key])]
    vague = not has(WORK)
    yellow = []
    if has(FREE): yellow.append('freetrial')
    if vague: yellow.append('vague')
    if not has(PAY): yellow.append('nopay')
    if structural and amounts and not highpay and ((hourly and max_amount < 3) or (not hourly and max_amount < 10)):
        yellow.append('lowpay')
    green = []
    if not vague: green.append('clearwork')
    if has(METHOD) or (amounts and 'paid' in low): green.append('paymethod')
    if has(DEADLINE): green.append('deadline')
    safety = [key for key, words in SAFETY.items() if has(words)]
    scope = [key for key in SCOPE if key in low][:3]
    ml = score_risk(text)
    # Model suggestions cannot cancel rule warnings or certify safety.
    if ml.get('level') == 'high' and not red:
        yellow.append('model_review')
    # Low-information rule (mirrors the extension): with nothing recognisable
    # in the text and no danger signs, the verdict is 'unknown', never a vague
    # warning and never a clean pass.
    recognisable = bool(amounts) or has(WORK) or has(PAY) or has(METHOD) or has(DEADLINE)
    verdict = 'danger' if red else ('warning' if yellow else 'ok')
    if not recognisable and not red:
        verdict = 'unknown'
    return {'findings': {'red': red, 'yellow': yellow, 'green': green},
            'verdict': verdict,
            'ai_assessment': ml,
            'safety_categories': safety, 'scope': {'flagged': bool(scope), 'matched': scope},
            'disclaimer': 'Automated warnings are not a guarantee that a job is safe.'}
