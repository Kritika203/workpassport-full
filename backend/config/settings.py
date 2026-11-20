"""WorkPassport backend settings."""
import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'dev-only-not-for-production-workpassport-change-this-key'
    else:
        raise ImproperlyConfigured('Set DJANGO_SECRET_KEY before starting production.')

ALLOWED_HOSTS = [s.strip() for s in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if s.strip()]
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'rest_framework_simplejwt.token_blacklist', 'corsheaders', 'drf_spectacular',
    'accounts', 'opportunities', 'workflows',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'

DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    if parsed.scheme not in ('postgres', 'postgresql', 'postgresql+psycopg'):
        raise ImproperlyConfigured('DATABASE_URL must start with postgresql://')
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': unquote((parsed.path or '/')[1:]),
        'USER': unquote(parsed.username or ''),
        'PASSWORD': unquote(parsed.password or ''),
        'HOST': parsed.hostname or 'localhost',
        'PORT': str(parsed.port or 5432),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {'sslmode': 'require'} if os.getenv('PGSSLMODE') == 'require' else {},
    }}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {'anon': '50/hour', 'user': '500/hour', 'demo': '10/hour', 'account_recovery': '8/hour', 'safety_report': '10/hour', 'shield_checks': '100/hour', 'extension_activation': '10/hour', 'extension_user': '100/hour'},
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
CORS_ALLOWED_ORIGINS = [s.strip() for s in os.getenv(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'
).split(',') if s.strip()]
CSRF_TRUSTED_ORIGINS = [s.strip() for s in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if s.strip()]
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kathmandu'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
# Stored outside STATIC and never served publicly. Use private object storage in production.
MEDIA_ROOT = BASE_DIR / 'private_uploads'
# JSON uploads contain base64, so a 2 MB file needs up to ~2.7 MB of request body.
DATA_UPLOAD_MAX_MEMORY_SIZE = 4_000_000
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
X_FRAME_OPTIONS = 'DENY'
if not DEBUG and os.getenv('DJANGO_HTTPS_ONLY', 'false').lower() == 'true':
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 3600
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

ALLOW_DEMO_SESSIONS = os.getenv("ALLOW_DEMO_SESSIONS", "false").lower() == "true"


# Real email delivery needs SMTP configuration in production.
WEB_FRONTEND_URL = os.getenv('WEB_FRONTEND_URL', 'http://localhost:5173').rstrip('/')
BACKEND_PUBLIC_URL = os.getenv('BACKEND_PUBLIC_URL', 'http://127.0.0.1:8000').rstrip('/')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'WorkPassport <noreply@example.invalid>')
# Brevo HTTPS works on free Render, where SMTP ports 25, 465 and 587 are blocked.
BREVO_API_KEY = os.getenv('BREVO_API_KEY', '').strip()

# Guided Apply writing helper (Gemini). The proposal endpoint returns 503
# when no key is configured; the frontend keeps the user's draft.
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash-lite')

# WhatsApp Shield bot (Meta Cloud API). The webhook answers 200 even
# when these are empty; it just cannot send replies.
WHATSAPP_VERIFY_TOKEN = os.getenv('WHATSAPP_VERIFY_TOKEN', '')
WHATSAPP_ACCESS_TOKEN = os.getenv('WHATSAPP_ACCESS_TOKEN', '')
WHATSAPP_PHONE_NUMBER_ID = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '')
WHATSAPP_APP_SECRET = os.getenv('WHATSAPP_APP_SECRET', '')
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'accounts.email_backend.BrevoAPIEmailBackend' if BREVO_API_KEY else ('django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend'))
EMAIL_HOST = os.getenv('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() == 'true'
EMAIL_TIMEOUT = 12
# Reset links expire after one hour.
PASSWORD_RESET_TIMEOUT = 3600


# Optional private object storage for production proof images.
if os.getenv('PRIVATE_S3_BUCKET_NAME'):
    STORAGES['default'] = {
            'BACKEND': 'storages.backends.s3.S3Storage',
            'OPTIONS': {
                'bucket_name': os.environ['PRIVATE_S3_BUCKET_NAME'],
                'default_acl': 'private',
                'querystring_auth': True,
                'custom_domain': None,
                'file_overwrite': False,
            },
        }


SPECTACULAR_SETTINGS = {
    'TITLE': 'WorkPassport API',
    'DESCRIPTION': 'Authenticated freelancer, client, safety and Workroom APIs.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
