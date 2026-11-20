"""Train an optional lightweight WorkShield model on *published, labeled datasets*.

Usage (run once on a machine with internet):
  pip install scikit-learn>=1.5
  python -m workflows.train_public_scam_model
  python -m workflows.train_public_scam_model --emscad-csv data/fake_job_postings.csv

Published source: rasheq/scam-shield-sms v1.1.0 CC BY 4.0 (see MODEL_DATASET.md).
Use its official train, val, and test splits; synthetic rows are only in train.
If separately supplied, EMSCAD ads are deduplicated and stratified split as a
second evaluation domain. SMS metrics must NOT be used as job-scam metrics.
No credentials or user chats are uploaded for model training.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from urllib.request import urlretrieve

DATASET_REV = '08549fd9ca78fc14bd0f85fb07e7a7c8d7aca64e'
DATASET_URL = f'https://huggingface.co/datasets/rasheq/scam-shield-sms/resolve/{DATASET_REV}/'
MODEL_DIR = Path(__file__).parent / 'model'


def dataset_files(data_dir, allow_download=True):
    data_dir.mkdir(parents=True, exist_ok=True)
    for kind in ('train', 'val', 'test'):
        path = data_dir / f'{kind}.csv'
        if not path.exists():
            if not allow_download:
                raise FileNotFoundError(f'{path}: download the dataset CSV first.')
            print('Downloading', DATASET_URL + f'{kind}.csv')
            urlretrieve(DATASET_URL + f'{kind}.csv', path)
        yield kind, path


def messages(path):
    rows = []
    with path.open(encoding='utf-8-sig', newline='') as infile:
        for row in csv.DictReader(infile):
            text = (row.get('text') or '').strip()
            label = (row.get('label') or '').strip().lower()
            if text and label in ('scam', 'safe'):
                rows.append((text, int(label == 'scam')))
    return rows


def emscad_rows(path):
    """Extract job-posting text; dedupe by normalised content across splits."""
    result = {}
    with Path(path).open(encoding='utf-8-sig', newline='', errors='replace') as infile:
        for row in csv.DictReader(infile):
            label = (row.get('fraudulent') or '').strip()
            if label not in ('0', '1'):
                continue
            text = '\n'.join((row.get(name) or '').strip() for name in
                             ('title', 'company_profile', 'description', 'requirements', 'benefits')).strip()
            if len(text) < 40:
                continue
            fingerprint = hashlib.sha256(' '.join(text.lower().split()).encode()).hexdigest()
            # Drop ambiguous near-identical records with conflicting labels.
            if fingerprint in result and result[fingerprint][1] != int(label):
                result[fingerprint] = None
            elif fingerprint not in result:
                result[fingerprint] = (text[:12000], int(label))
    return [item for item in result.values() if item is not None]


def evaluate(classifier, rows, name):
    from sklearn.metrics import precision_recall_fscore_support, confusion_matrix
    if not rows:
        return None
    truth = [y for _, y in rows]
    estimate = classifier.predict([text for text, _ in rows])
    precision, recall, f1, _ = precision_recall_fscore_support(truth, estimate, labels=[1], zero_division=0)
    tn, fp, fn, tp = confusion_matrix(truth, estimate, labels=[0, 1]).ravel()
    summary = dict(sample_count=len(rows), scam_count=sum(truth), scam_precision=round(float(precision[0]), 4),
                   scam_recall=round(float(recall[0]), 4), scam_f1=round(float(f1[0]), 4),
                   true_positive=int(tp), false_positive=int(fp), false_negative=int(fn), true_negative=int(tn))
    print(name, json.dumps(summary, sort_keys=True))
    return summary


def main():
    parser = argparse.ArgumentParser(description='Train an experimental text classifier on published datasets.')
    parser.add_argument('--data-dir', type=Path, default=MODEL_DIR / 'downloaded', help='Raw SMS CSV cache')
    parser.add_argument('--emscad-csv', type=Path, default=None,
                        help='Optional legally obtained fake_job_postings.csv to add a real jobs domain')
    parser.add_argument('--offline', action='store_true', help='Do not download missing files')
    args = parser.parse_args()
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import average_precision_score
    sms = {kind: messages(path) for kind, path in dataset_files(args.data_dir, not args.offline)}
    job = {'train': [], 'val': [], 'test': []}
    if args.emscad_csv:
        source = emscad_rows(args.emscad_csv)
        job_main, job['test'] = train_test_split(source, test_size=0.15, random_state=42,
                                                stratify=[label for _, label in source])
        job['train'], job['val'] = train_test_split(job_main, test_size=0.15, random_state=42,
                                                  stratify=[label for _, label in job_main])
    train = sms['train'] + job['train']
    print('Training examples:', len(train), 'SMS', len(sms['train']), 'jobs', len(job['train']))
    # Exactly the same word ngrams and normalization as workflows.ai_scanner.
    vector = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True,
        token_pattern=r'(?u)\b\w+\b', max_features=12000)
    x = vector.fit_transform([message for message, _ in train])
    classifier = LogisticRegression(max_iter=600, class_weight='balanced', random_state=42,
                                    C=1.5).fit(x, [label for _, label in train])
    class Predictor:
        def predict(self, messages):
            return classifier.predict(vector.transform(messages))
    predictor = Predictor()
    metrics = {
        'sms_validation': evaluate(predictor, sms['val'], 'sms_validation'),
        'sms_test': evaluate(predictor, sms['test'], 'sms_test'),
        'job_validation': evaluate(predictor, job['val'], 'job_validation'),
        'job_test': evaluate(predictor, job['test'], 'job_test'),
    }
    words = vector.get_feature_names_out()
    model = {
        'model': 'workshield-public-data-tfidf-lr-v1',
        'training_source': 'rasheq/scam-shield-sms v1.1.0 train split (CC BY 4.0)' +
            (' and EMSCAD locally supplied job postings (check upstream licence)' if args.emscad_csv else ''),
        'validation': 'Held-out SMS test; optional separate held-out EMSCAD job test. Not validated on Nepali.',
        'features': 'word unigrams and bigrams, sublinear TF-IDF, class-weighted logistic regression',
        'metrics': metrics,
        'idf': {word: round(float(weight), 8) for word, weight in zip(words, vector.idf_)},
        'coefficients': {word: round(float(weight), 8) for word, weight in zip(words, classifier.coef_[0])},
        'intercept': round(float(classifier.intercept_[0]), 8),
    }
    MODEL_DIR.mkdir(exist_ok=True)
    output = MODEL_DIR / 'scam_public_v1.json'
    output.write_text(json.dumps(model, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Saved model:', output, 'bytes:', output.stat().st_size)
    (MODEL_DIR / 'public_training_report.json').write_text(json.dumps({
        'dataset': DATASET_URL, 'training_count': len(train), 'metrics': metrics,
        'domain_warning': 'English SMS and optionally older English job ads; not Nepali/code-mixed validated.',
    }, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
