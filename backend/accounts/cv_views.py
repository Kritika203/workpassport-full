"""Minimal, privacy-aware CV extraction. No CV file is stored."""
import io
import re
from pathlib import Path
from rest_framework import permissions, parsers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Profile

COMMON_SKILLS = ('Python', 'JavaScript', 'React', 'Django', 'HTML', 'CSS', 'SQL', 'Excel',
                 'Canva', 'Photoshop', 'Figma', 'Writing', 'Communication', 'Design',
                 'Marketing', 'Accounting', 'Data Analysis', 'Customer Service', 'Translation')


def extract_cv_text(name, content):
    ext = Path(name).suffix.lower()
    if ext == '.pdf':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        if len(reader.pages) > 12:
            raise ValueError('Maximum 12 pages allowed.')
        return '\n'.join(page.extract_text() or '' for page in reader.pages)
    if ext == '.docx':
        from docx import Document
        doc = Document(io.BytesIO(content))
        return '\n'.join(par.text for par in doc.paragraphs)
    raise ValueError('Only PDF or DOCX files are supported.')


class ImportCV(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser]

    def post(self, request):
        if getattr(request.user.profile, 'role', None) != Profile.FREELANCER:
            return Response({'detail': 'Only freelancer accounts can import CVs.'}, status=403)
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'Choose a PDF or DOCX file.'}, status=400)
        if uploaded.size > 3 * 1024 * 1024:
            return Response({'detail': 'Maximum size is 3 MB.'}, status=400)
        try:
            raw = uploaded.read()
            # ZIP signature for DOCX; PDF magic for PDFs. Never trust MIME types alone.
            ext = Path(uploaded.name).suffix.lower()
            if (ext == '.pdf' and not raw.startswith(b'%PDF-')) or (ext == '.docx' and not raw.startswith(b'PK')):
                raise ValueError('File content does not match its extension.')
            content = extract_cv_text(uploaded.name, raw)[:20000]
        except Exception as exc:
            # Avoid echoing file contents or library internals.
            return Response({'detail': str(exc) if isinstance(exc, ValueError) else 'Could not read this CV.'}, status=400)
        lines = [re.sub(r'\s+', ' ', line).strip() for line in content.splitlines()]
        lines = [line for line in lines if line]
        if len(' '.join(lines)) < 50:
            return Response({'detail': 'Not enough selectable text found. Scanned PDFs need OCR.'}, status=400)
        first = next((line for line in lines[:8] if 2 <= len(line) <= 90 and not ('@' in line or re.search(r'\d{5,}', line))), '')
        # This is a suggested name only, never verified identification.
        name = first if first and len(first.split()) <= 5 else request.user.profile.display_name
        found = [skill for skill in COMMON_SKILLS if re.search(r'(?<!\w)' + re.escape(skill) + r'(?!\w)', content, re.I)]
        return Response({'name': name, 'headline': '', 'about': '', 'skills': found[:30],
                         'review_required': True, 'notice': 'Extracted text is unverified. Review before saving.'})
