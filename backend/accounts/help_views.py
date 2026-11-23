"""WorkPassport Help Me: grounded product guidance with optional hosted AI.

No conversation or private account information is included automatically.
AI access stays on the server, never in the browser bundle.
"""
import json
import os
import re
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# Use navigation names and functions that actually exist in the app.
GUIDES = [
    ('apply', ('apply', 'application', 'applying', 'आवेदन', 'काममा', 'job apply', 'apply kasari'),
     'To apply, open FirstWork, choose an internal job and select Apply Now. Follow the application steps and press Send Application. External leads cannot receive applications inside WorkPassport.',
     'आवेदन दिन FirstWork मा काम खोल्नुहोस् र Apply Now थिच्नुहोस्। फारम पूरा गरी Send Application थिच्नुहोस्। बाहिरी काममा WorkPassport बाट आवेदन दिन सकिँदैन।'),
    ('applications', ('my applications', 'track', 'status', 'applied jobs', 'mero application', 'कहाँ', 'आवेदन स्थिति'),
     'Open Applications & Workrooms (or My WorkPassport → Applications). You can review submitted applications and open available conversations and workrooms.',
     'Applications & Workrooms (वा My WorkPassport → Applications) मा आफ्नो आवेदन र उपलब्ध कुराकानी/वर्करुम हेर्न सक्नुहुन्छ।'),
    ('cv', ('cv', 'resume', 'curriculum', 'pdf', 'docx', 'सीभी', 'बायोडाटा'),
     'Open My WorkPassport → Passport → Import your CV. Upload a text-based PDF or DOCX under 3 MB, check the extracted details carefully, then save. A scanned PDF may not work.',
     'My WorkPassport → Passport → Import your CV मा PDF वा DOCX फाइल राख्नुहोस्। निकालेको विवरण जाँचेर मात्रै सुरक्षित गर्नुहोस्।'),
    ('voice', ('voice', 'mic', 'microphone', 'speak', 'translate', 'translation', 'nepali', 'भाषा', 'अनुवाद', 'आवाज', 'बोल्ने'),
     'Inside a connected work conversation, choose Nepali or English. Use Voice to text if supported by your browser. Preview translations before sending; translation requires an approved service configured by WorkPassport.',
     'कुराकानीमा नेपाली वा English छान्नुहोस्। ब्राउजरले समर्थन गरे Voice to text थिच्नुहोस्। अनुवाद पठाउनुअघि जाँच्नुहोस्; अनुवाद सेवा कन्फिगर हुनुपर्छ।'),
    ('external', ('whatsapp', 'messenger', 'facebook', 'external', 'बाहिर', 'ह्वाट्सएप', 'मेसेन्जर'),
     'In a work conversation, choose WhatsApp or Messenger and read the exit warning. Those messages are outside WorkPassport: we cannot monitor or recover them. Keep agreements, payment terms and milestones confirmed inside WorkPassport.',
     'कुराकानीबाट WhatsApp वा Messenger खोल्दा चेतावनी पढ्नुहोस्। बाहिरी च्याट WorkPassport ले निगरानी वा पुनःप्राप्ति गर्न सक्दैन। सम्झौता र भुक्तानी यहीँ पुष्टि गर्नुहोस्।'),
    ('client', ('post a job', 'post job', 'employer', 'client', 'hire', 'applicant', 'रोजगारदाता', 'काम पोस्ट'),
     'As an employer, open your Client Dashboard and select Post a Job. Review applicants in My Posted Jobs. You can edit or close your own listings, but closed jobs cannot take new applications.',
     'रोजगारदाताले Client Dashboard बाट Post a Job प्रयोग गर्न सक्छन्। My Posted Jobs मा आवेदक हेर्न, आफ्नो काम सम्पादन गर्न वा बन्द गर्न सकिन्छ।'),
    ('safety', ('scam', 'fraud', 'report', 'safe', 'safety', 'workshield', 'harass', 'ठगी', 'रिपोर्ट', 'सुरक्षा'),
     'Use WorkShield to check suspicious messages and Report on a job or conversation. Never pay an advance fee to get a job. WorkShield gives warnings, not guaranteed verification; urgent danger needs local emergency services.',
     'शंकास्पद सन्देश WorkShield मा जाँच्नुहोस् वा Report गर्नुहोस्। काम पाउन अग्रिम शुल्क नतिर्नुहोस्। WorkShield ले चेतावनी दिन्छ, पूर्ण प्रमाणित गर्दैन।'),
    ('milestones', ('milestone', 'deliverable', 'workroom', 'payment', 'agreement', 'invoice', 'भुक्तानी', 'सम्झौता', 'माइलस्टोन'),
     'An accepted application may open its Workroom. Keep deliverables, milestone changes, approvals and payment terms recorded there. Do not treat an external-chat promise as a confirmed WorkPassport agreement.',
     'स्वीकृत आवेदनबाट Workroom खोल्न सकिन्छ। काम, माइलस्टोन, स्वीकृति र भुक्तानीका शर्तहरू त्यहीँ पुष्टि गर्नुहोस्। बाहिरी च्याटलाई आधिकारिक सम्झौता नमान्नुहोस्।'),
    ('onboarding', ('sign up', 'register', 'onboard', 'profile', 'beginner', 'start', 'खाता', 'सुरु', 'दर्ता'),
     'Create an account and complete the short setup. You only need your name initially; add optional experience, interests, skills and a CV to your Passport later.',
     'खाता बनाएर छोटो सुरुवाती फारम भर्नुहोस्। सुरुमा नाम मात्र आवश्यक छ। सीप, अनुभव र CV पछि थप्न सकिन्छ।'),
]

SYSTEM = '''You are WorkPassport Help Me. Answer only how to use WorkPassport, its job board, employee/employer functions and safety practices. Be concise, accurate, friendly and practical. Do not invent buttons, menus, verified jobs, successful applications, or actions. You cannot see a user's account, messages or live screen. Ask a short clarification if the question is unclear. Support English, Nepali and romanized Nepali. Never request credentials, phone numbers or private CV data. For external WhatsApp/Messenger communication clarify WorkPassport cannot monitor, guarantee safety, or recover external messages, and recommend confirming agreements inside the app. If you don't know, say so. Product reference:\n'''
SYSTEM += '\n'.join(f'{key}: {en}' for key, _, en, _ in GUIDES)


def local_answer(message, lang):
    text = message.lower().strip()
    matches = [(key, en, ne) for key, terms, en, ne in GUIDES if any(term in text for term in terms)]
    if matches:
        _, en, ne = matches[0]
        return ne if lang == 'ne' else en
    return ('कुन सुविधामा मद्दत चाहिएको हो? FirstWork, आवेदन, Passport, WorkShield, Workroom, वा client job posting मध्ये एक भन्नुहोस्।' if lang == 'ne'
            else 'I can help you use FirstWork, applications, Passport/CV import, WorkShield, Workrooms, and client job posting. Which one are you trying to do?')


class HelpChat(APIView):
    permission_classes = [AllowAny]  # Guests need product guidance too.

    def post(self, request):
        message = request.data.get('message', '')
        lang = request.data.get('language', 'en')
        if not isinstance(message, str) or not message.strip() or len(message) > 500:
            return Response({'detail': 'Ask a question of 1–500 characters.'}, status=400)
        lang = lang if lang in ('en', 'ne') else 'en'
        ident = request.user.pk if request.user.is_authenticated else request.META.get('REMOTE_ADDR', 'guest')
        bucket = f'wp_help:{ident}'
        try:
            if cache.add(bucket, 1, timeout=60):
                count = 1
            else:
                count = cache.incr(bucket)
            if count > 15:
                return Response({'detail': 'Too many questions. Try again in a minute.'}, status=429)
        except (ValueError, TypeError):
            pass
        # Optional OpenAI-compatible endpoint. No vendor is selected without consent/configuration.
        endpoint = os.getenv('WP_HELP_AI_ENDPOINT', '').strip()
        key = os.getenv('WP_HELP_AI_KEY', '').strip()
        model = os.getenv('WP_HELP_AI_MODEL', '').strip()
        if endpoint.startswith('https://') and key and model:
            context = request.data.get('history', [])
            if not isinstance(context, list):
                context = []
            history = []
            for item in context[-4:]:
                if isinstance(item, dict) and item.get('role') in ('user', 'assistant') and isinstance(item.get('content'), str):
                    history.append({'role': item['role'], 'content': item['content'][:500]})
            payload = {'model': model, 'messages': [{'role': 'system', 'content': SYSTEM}, *history,
                                                        {'role': 'user', 'content': message}], 'max_tokens': 220, 'temperature': 0.2}
            try:
                req = urlrequest.Request(endpoint, data=json.dumps(payload).encode('utf-8'), method='POST', headers={
                    'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'})
                with urlrequest.urlopen(req, timeout=8) as response:
                    data = json.load(response)
                answer = data['choices'][0]['message']['content']
                if isinstance(answer, str) and answer.strip():
                    return Response({'answer': answer.strip()[:2000], 'mode': 'ai'})
            except (HTTPError, URLError, TimeoutError, ValueError, TypeError, KeyError, IndexError):
                pass
        return Response({'answer': local_answer(message, lang), 'mode': 'local'})
