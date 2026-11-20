# WorkShield AI research: dataset, limits and reproducibility

The safety engine combines human-readable rules with an **experimental** text classifier. No model or rule set guarantees that a message is safe. The model never overrides an explicit red flag from the rules.

## Published dataset selection (not silently substituted with fake training data)

Primary message/smishing data: **[rasheq/scam-shield-sms v1.1.0](https://huggingface.co/datasets/rasheq/scam-shield-sms)** (CC BY 4.0). About 24k labeled English SMS messages, with training/validation/test splits and synthetic examples **limited to training**. The real scam samples include published user reports from the 2025 IMC smishing study, plus the Mishra and Soni 2022 SMS phishing corpus. Known limitation: some reports are mislabeled; the held-out safe messages are old personal chats and do not include real benign service SMS. Attribution to upstream authors and licence is required.

Employment-specific data: **[Employment Scam Aegean Dataset (EMSCAD)](https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction)**, 17,880 job postings with 866 fraudulent examples, from 2012–2014. Employment is the WorkPassport domain, but this dataset is older, skewed toward Western English ads, and carries provenance/licensing caveats. Before publishing a model derived from it, review its data usage terms. Download locally as `fake_job_postings.csv` and pass the path to the training command.

Scientific references: Mishra & Soni, *SMS Phishing Dataset for Machine Learning and Pattern Recognition*, DOI [10.17632/f45bkkt8pr.1](https://doi.org/10.17632/f45bkkt8pr.1) (CC BY 4.0); Agarwal, Papasavva, Suarez-Tangil and Vasek, *Fishing for Smishing*, IMC 2025, DOI [10.1145/3730567.3764431](https://doi.org/10.1145/3730567.3764431); Vidros et al., *Automatic Detection of Online Recruitment Frauds*, 2017.

## What is shipped

`backend/workflows/model/scam_baseline.json` is a **small synthetic demonstration baseline**, so offline demos always run. It is *not* trained on the published datasets and is never represented as such.

The full reproducible training implementation is `backend/workflows/train_public_scam_model.py`. It downloads the published SMS train/validation/test CSVs at a pinned revision, keeps genuine test data held out, prints scam **precision, recall and F1**, and exports a small dependency-free model to `backend/workflows/model/scam_public_v1.json`. When this file exists, WorkShield loads it automatically without introducing a heavy runtime dependency.

**Important environmental limitation:** The downloadable published dataset could not be retrieved in the build environment that assembled this ZIP, so the publicly trained model is **not pre-bundled**. No test metrics are invented. The optional training step requires internet and scikit-learn on a developer machine; it is not user-facing testing.

```powershell
cd backend
python -m pip install scikit-learn
python -m workflows.train_public_scam_model
# Optional if you have legal access to the EMSCAD CSV:
python -m workflows.train_public_scam_model --emscad-csv data/fake_job_postings.csv
```

The model is only an experimental supplemental signal; it is not independently validated for Nepali (Devanagari), Romanized Nepali, code-mixed work chats, coercion, harassment, or modern Nepal-specific recruitment scams. Those require local data collected with consent, rigorous labeling and held-out evaluation. Avoid a “safe” badge. **No warning found** is the only defensible negative result.

Data privacy: No WorkPassport chat content is used to train the model. The only text submitted to the backend is text the user deliberately checks or saves; it is not uploaded to a third-party model provider.
