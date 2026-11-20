"""Reproducible training on ORIGINAL synthetic phrases, not a real-world dataset.

Run manually with scikit-learn installed; the deployed inference has no ML dependency.
This is a demo research baseline, not a trustworthy real-world classifier.
"""
from pathlib import Path
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

SCAMS = [
    'Pay a registration fee before you can start this job',
    'Transfer a security deposit to receive your first task',
    'The company will hire you after you pay the processing fee',
    'Send your OTP and account password to verify your salary account',
    'Buy gift cards first and send us the codes',
    'You must share your bank PIN and CVV to release payment',
    'Join Telegram to earn guaranteed income with no experience',
    'Easy daily profit just send crypto to activate your account',
    'Pay the training charge now or your application will be cancelled',
    'We need a selfie and your private photos for this graphic design task',
    'Send money to unlock the work platform',
    'We will pay after you provide your login password',
    'Claim your remote job by paying in bitcoin now',
    'Do this unpaid trial of twenty articles before we hire you',
    'Your account is frozen verify your OTP urgently',
    'You are selected send a deposit immediately to continue',
    'Guaranteed Rs 90000 per day by simply liking posts pay to join',
    'You owe an activation fee to start typing work',
    'We have an urgent job click this strange verification link and share password',
    'Do not tell anyone about this job send bank details now',
    'Send me your personal picture for your application not your portfolio',
    'Pay me first and we will unlock the contract later',
    'I can offer the role only if you meet me alone at the hotel',
    'Send your credentials to this chat for your final payment',
    'For a guaranteed job you must send 1000 rupees fee now',
    'Need your card number and one time password to receive wages',
    'Job pakka cha pahila registration fee pathau',
    'Paisa pathau ani kaam suru huncha',
    'Pahile deposit gara natra job cancel huncha',
    'OTP ra password pathaunus payment release garna',
    'Telegram ma aau pahile paisa halnuparcha',
    'Timi eklaai hotel ma vetna aau natra job hudaina',
    'Photo pathau ani matra kaam dinchu',
    'तपाईंले पहिले दर्ता शुल्क तिर्नुपर्छ अनि काम पाउनुहुन्छ',
    'रोजगारी सुरु गर्न पहिले पैसा पठाउनुहोस्',
    'ओटिपी र पासवर्ड दिएपछि मात्र तलब आउँछ',
    'ग्यारेन्टी कामको लागि अग्रिम रकम जम्मा गर्नुहोस्',
    'बैंकको पिन र कार्ड नम्बर पठाउनुपर्छ',
]
LEGIT = [
    'We need a beginner Canva designer for five social media posters',
    'Payment is 30 USD after approved delivery via bank transfer',
    'Please share your public portfolio link to show writing samples',
    'You can ask for a written agreement before starting',
    'The application deadline is next Monday and pay is negotiable',
    'We need twenty Excel data entries by Friday for a fixed price',
    'Applicants will be reviewed and shortlisted based on examples of work',
    'We offer a clear scope and two revisions for each logo design',
    'Can you deliver the translation by Thursday at the agreed rate',
    'We will schedule an optional video call during daytime working hours',
    'Please send your professional resume and links to published projects',
    'The client will provide brand assets and sample designs',
    'The project requires editing product descriptions in Nepali',
    'Do you want to negotiate a milestone schedule before accepting',
    'No registration fee or deposit is required to apply',
    'Please do not share passwords or bank OTPs with anyone',
    'This is a warning against crypto investment scams',
    'I am reporting a client who asked me to pay first',
    'Safety education: never send money before starting a job',
    'Our job does not require photos beyond your design portfolio',
    'Application fee is zero and payment terms will be in writing',
    'Please check the attached scope and timeline',
    'The rate is NPR 2000 per article upon completion',
    'We need a bilingual assistant who can write Nepali and English',
    'You can decline an uncomfortable meeting without losing the job',
    'Canva poster banauna sakne freelancer khojeko ho',
    'Hami lai excel data entry garne manchhe chaiyeko cha',
    'Kaam sakkepachi bank transfer bata paisa dinchhau',
    'Portfolio link ra writing sample pathaunus',
    'Pahile agreement milau ani project start garau',
    'कामको विवरण र समयसीमा स्पष्ट छ',
    'तपाईंको लेखन नमुना पठाउनुहोस्',
    'यो काममा दर्ता शुल्क लाग्दैन',
    'सम्झौता अनुसार काम सकेपछि भुक्तानी हुन्छ',
    'ग्राहकले डिजाइनका लागि चाहिने सामग्री उपलब्ध गराउँछ',
    'हामीलाई नेपाली र अङ्ग्रेजी अनुवादक चाहिएको छ',
    'समयसीमाभित्र लेख तयार पारेर पठाउनुहोस्',
]
# Add diverse context forms without trying to inflate performance metrics.
SCAM_PREFIXES = ['', 'Hello applicant, ', 'Job offer: ', 'Please read carefully: ']
LEGIT_PREFIXES = ['', 'Hello applicant, ', 'Job details: ', 'Please read carefully: ']
examples = [prefix + msg for msg in SCAMS for prefix in SCAM_PREFIXES]
examples += [prefix + msg for msg in LEGIT for prefix in LEGIT_PREFIXES]
labels = [1] * (len(SCAMS) * len(SCAM_PREFIXES)) + [0] * (len(LEGIT) * len(LEGIT_PREFIXES))
vector = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True,
                         token_pattern=r'(?u)\b\w+\b', max_features=4000)
X = vector.fit_transform(examples)
classifier = LogisticRegression(class_weight='balanced', max_iter=500, random_state=23).fit(X, labels)
features = vector.get_feature_names_out()
obj = {
    'model': 'synthetic-text-baseline-v1',
    'training_source': 'Original hand-authored synthetic phrases in train_scam_baseline.py',
    'validation': 'NOT externally validated; does not have a reliable real-world accuracy estimate',
    'features': 'word unigrams and bigrams; TF-IDF; logistic regression',
    'idf': {word: round(float(weight), 8) for word, weight in zip(features, vector.idf_)},
    'coefficients': {word: round(float(weight), 8) for word, weight in zip(features, classifier.coef_[0])},
    'intercept': round(float(classifier.intercept_[0]), 8),
}
out = Path(__file__).parent / 'model' / 'scam_baseline.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
print('Wrote', out, 'features=', len(features), 'training_examples=', len(examples))
