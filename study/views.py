import os
import re
import json
import google.genai as genai
import fitz
from .models import Document, Page, Exercise, StudySession, StudentProfile, MAJOR_CHOICES, CalendarEvent
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Document, Page, Exercise, StudySession, StudentProfile, MAJOR_CHOICES
from .rag import embed_document, retrieve_relevant_chunks, delete_document_embeddings

# ── Auth ─────────────────────────────────────────────────────────────────────

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect('dashboard')
        return render(request, 'study/login.html', {'error': 'Invalid username or password.'})
    return render(request, 'study/login.html')


def signup_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm = request.POST.get('confirm_password')
        major = request.POST.get('major', 'CIT')
        if password != confirm:
            return render(request, 'study/signup.html', {'error': 'Passwords do not match.', 'majors': MAJOR_CHOICES})
        if User.objects.filter(username=username).exists():
            return render(request, 'study/signup.html', {'error': 'Username already taken.', 'majors': MAJOR_CHOICES})
        user = User.objects.create_user(username=username, email=email, password=password)
        StudentProfile.objects.create(user=user, major=major)
        login(request, user)
        return redirect('dashboard')
    return render(request, 'study/signup.html', {'majors': MAJOR_CHOICES})


def logout_view(request):
    logout(request)
    return redirect('login')


# ── Pages ─────────────────────────────────────────────────────────────────────

@login_required
def dashboard(request):
    profile, _ = StudentProfile.objects.get_or_create(user=request.user, defaults={'major': 'CIT'})
    documents = Document.objects.filter(user=request.user).order_by('-uploaded_at')
    sessions = StudySession.objects.filter(user=request.user).order_by('-created_at')[:10]
    return render(request, 'study/dashboard.html', {
        'documents': documents,
        'sessions': sessions,
        'profile': profile,
    })


@login_required
def subjects_view(request):
    profile, _ = StudentProfile.objects.get_or_create(user=request.user, defaults={'major': 'CIT'})
    subjects = profile.get_subjects()
    subject_data = []
    for subject in subjects:
        books = Document.objects.filter(user=request.user, subject=subject).order_by('-uploaded_at')
        subject_data.append({'name': subject, 'books': books})
    return render(request, 'study/subjects.html', {
        'profile': profile,
        'subject_data': subject_data,
    })


@login_required
def study_view(request):
    profile, _ = StudentProfile.objects.get_or_create(user=request.user, defaults={'major': 'CIT'})
    documents = Document.objects.filter(user=request.user).order_by('-uploaded_at')
    return render(request, 'study/study.html', {
        'documents': documents,
        'profile': profile,
    })


# ── API ───────────────────────────────────────────────────────────────────────

@csrf_exempt
@login_required
def upload_pdf(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    pdf_file = request.FILES.get('file')
    subject = request.POST.get('subject', '')

    if not pdf_file:
        return JsonResponse({'error': 'No file provided'}, status=400)
    if not pdf_file.name.endswith('.pdf'):
        return JsonResponse({'error': 'Only PDF files are supported'}, status=400)

    doc = Document.objects.create(
        user=request.user,
        file=pdf_file,
        original_name=pdf_file.name,
        subject=subject,
    )

    try:
        pdf = fitz.open(doc.file.path)
        exercise_count = 0
        for page_num in range(len(pdf)):
            page = pdf[page_num]
            text = page.get_text()
            Page.objects.create(document=doc, page_number=page_num + 1, content=text)
            patterns = [
                r'(?:Exercise|Problem|Ex\.|Q\.?)\s*(\d+[\.\d]*)',
                r'^(\d+)\.\s+\w',
            ]
            for pattern in patterns:
                for match in re.finditer(pattern, text, re.MULTILINE | re.IGNORECASE):
                    ex_num = match.group(1)
                    start = match.start()
                    snippet = text[start:start + 600].strip()
                    if not Exercise.objects.filter(document=doc, page_number=page_num + 1, exercise_number=ex_num).exists():
                        Exercise.objects.create(
                            document=doc,
                            page_number=page_num + 1,
                            exercise_number=ex_num,
                            content=snippet,
                        )
                        exercise_count += 1
        pdf.close()
    except Exception as e:
        doc.delete()
        return JsonResponse({'error': f'Failed to process PDF: {str(e)}'}, status=500)

    return JsonResponse({
        'success': True,
        'document_id': doc.id,
        'document_name': doc.original_name,
        'exercise_count': exercise_count,
        'subject': subject,
    })


@csrf_exempt
@login_required
def get_exercises(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body)
    document_id = data.get('document_id')
    page = data.get('page')
    exercise_numbers = data.get('exercise_numbers', [])

    if not document_id or not page or not exercise_numbers:
        return JsonResponse({'error': 'document_id, page, and exercise_numbers are required'}, status=400)

    try:
        doc = Document.objects.get(id=document_id, user=request.user)
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document not found'}, status=404)

    exercises = Exercise.objects.filter(
        document=doc,
        page_number=int(page),
        exercise_number__in=[str(n).strip() for n in exercise_numbers],
    )

    if not exercises.exists():
        page_obj = Page.objects.filter(document=doc, page_number=int(page)).first()
        if page_obj:
            return JsonResponse({
                'exercises': [],
                'page_content': page_obj.content[:2000],
                'message': 'No exercises matched — showing raw page content.',
            })
        return JsonResponse({'error': 'No content found for that page.'}, status=404)

    StudySession.objects.create(
        user=request.user,
        document=doc,
        exercise_numbers=', '.join(exercise_numbers),
        page_number=int(page),
    )

    return JsonResponse({
        'exercises': [
            {
                'id': ex.id,
                'exercise_number': ex.exercise_number,
                'page_number': ex.page_number,
                'content': ex.content,
            }
            for ex in exercises
        ]
    })


@csrf_exempt
@login_required
def solve_exercise(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body)
    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'No exercise content provided'}, status=400)

    client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

    solution = client.models.generate_content(
        model='models/gemini-2.5-flash',
        contents=f'Solve this exercise step by step with clear explanations:\n\n{content}'
    )
    similar = client.models.generate_content(
        model='models/gemini-2.5-flash',
        contents=f'Generate 3 similar exercises to this one, same concept and difficulty but different values. Return only the exercises numbered 1, 2, 3 with no solutions:\n\n{content}'
    )

    similar_list = [
        line.strip()
        for line in similar.text.split('\n')
        if line.strip() and line.strip()[0].isdigit()
    ]

    return JsonResponse({
        'solution': solution.text,
        'similar_exercises': similar_list[:3],
    })


@login_required
def delete_document(request, doc_id):
    try:
        doc = Document.objects.get(id=doc_id, user=request.user)
        doc.file.delete()
        doc.delete()
    except Document.DoesNotExist:
        pass
    return redirect('dashboard')


@login_required
def calendar_view(request):
    profile, _ = StudentProfile.objects.get_or_create(user=request.user, defaults={'major': 'CIT'})
    subjects = profile.get_subjects()
    events = CalendarEvent.objects.filter(user=request.user).order_by('date')
    return render(request, 'study/calendar.html', {
        'profile': profile,
        'subjects': subjects,
        'events': events,
    })


@csrf_exempt
@login_required
def calendar_events_api(request):
    if request.method == 'GET':
        events = CalendarEvent.objects.filter(user=request.user)
        return JsonResponse({
            'events': [
                {
                    'id': e.id,
                    'title': e.title,
                    'date': str(e.date),
                    'event_type': e.event_type,
                    'subject': e.subject,
                }
                for e in events
            ]
        })

    if request.method == 'POST':
        data = json.loads(request.body)
        title = data.get('title', '').strip()
        date = data.get('date', '').strip()
        event_type = data.get('event_type', 'exam')
        subject = data.get('subject', '').strip()

        if not title or not date:
            return JsonResponse({'error': 'Title and date are required.'}, status=400)

        event = CalendarEvent.objects.create(
            user=request.user,
            title=title,
            date=date,
            event_type=event_type,
            subject=subject,
        )
        event.refresh_from_db()
        return JsonResponse({
            'success': True,
            'event': {
                'id': event.id,
                'title': event.title,
                'date': str(event.date),
                'event_type': event.event_type,
                'subject': event.subject,
            }
        })

    if request.method == 'DELETE':
        data = json.loads(request.body)
        event_id = data.get('id')
        try:
            event = CalendarEvent.objects.get(id=event_id, user=request.user)
            event.delete()
            return JsonResponse({'success': True})
        except CalendarEvent.DoesNotExist:
            return JsonResponse({'error': 'Event not found.'}, status=404)

    return JsonResponse({'error': 'Method not allowed.'}, status=405)

"""
Add these imports at the top of views.py (merge with existing imports):
from .rag import embed_document, retrieve_relevant_chunks, delete_document_embeddings
"""

# ── RAG: Embed document ───────────────────────────────────────────────────────

@csrf_exempt
@login_required
def embed_document_view(request):
    """Trigger embedding for a document. Called after upload or manually."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body)
    doc_id = data.get('document_id')

    try:
        doc = Document.objects.get(id=doc_id, user=request.user)
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document not found.'}, status=404)

    pages = Page.objects.filter(document=doc).order_by('page_number')
    if not pages.exists():
        return JsonResponse({'error': 'Document has no extracted pages yet.'}, status=400)

    pages_content = [{'page_number': p.page_number, 'content': p.content} for p in pages]

    try:
        from .rag import embed_document
        chunk_count = embed_document(doc_id, pages_content)
        return JsonResponse({'success': True, 'chunks': chunk_count})
    except Exception as e:
        return JsonResponse({'error': f'Embedding failed: {str(e)}'}, status=500)


# ── RAG: Generate exercises from textbook ────────────────────────────────────

@csrf_exempt
@login_required
def generate_exercises_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body)
    doc_id = data.get('document_id')
    topic = data.get('topic', '').strip()
    difficulty = data.get('difficulty', 'medium')
    count = min(int(data.get('count', 5)), 10)

    if not doc_id:
        return JsonResponse({'error': 'document_id is required.'}, status=400)
    if not topic:
        return JsonResponse({'error': 'Please enter a topic or chapter.'}, status=400)

    try:
        doc = Document.objects.get(id=doc_id, user=request.user)
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document not found.'}, status=404)

    try:
        from .rag import retrieve_relevant_chunks
        chunks = retrieve_relevant_chunks(doc_id, topic, n_results=8)
    except Exception as e:
        return JsonResponse({'error': f'Retrieval failed: {str(e)}'}, status=500)

    if not chunks:
        return JsonResponse({
            'error': 'This document has not been processed yet. Please click "Process for AI" first.'
        }, status=400)

    context = '\n\n'.join([f"[Page {c['page_number']}]: {c['text']}" for c in chunks])

    prompt = f"""You are a university professor creating practice exercises for students.

Based ONLY on the following textbook content, create {count} {difficulty}-difficulty exercises on the topic: "{topic}".

TEXTBOOK CONTENT:
{context}

INSTRUCTIONS:
- Each exercise must be directly based on the textbook content above
- Number each exercise clearly: Exercise 1, Exercise 2, etc.
- Include a mix of problem types (calculation, conceptual, application)
- After all exercises, provide an "ANSWERS" section with brief answers for each
- Keep exercises appropriate for university level

Format:
Exercise 1: [question]
Exercise 2: [question]
...

ANSWERS:
1. [answer]
2. [answer]
..."""

    try:
        client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=prompt
        )

        return JsonResponse({
            'success': True,
            'exercises': response.text,
            'topic': topic,
            'source_pages': sorted(set(c['page_number'] for c in chunks)),
        })
    except Exception as e:
        return JsonResponse({'error': f'Generation failed: {str(e)}'}, status=500)


# ── RAG: Generate flashcards ──────────────────────────────────────────────────

@csrf_exempt
@login_required
def generate_flashcards_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body)
    doc_id = data.get('document_id')
    topic = data.get('topic', '').strip()
    count = min(int(data.get('count', 10)), 20)

    if not doc_id:
        return JsonResponse({'error': 'document_id is required.'}, status=400)
    if not topic:
        return JsonResponse({'error': 'Please enter a topic or chapter.'}, status=400)

    try:
        doc = Document.objects.get(id=doc_id, user=request.user)
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document not found.'}, status=404)

    try:
        from .rag import retrieve_relevant_chunks
        chunks = retrieve_relevant_chunks(doc_id, topic, n_results=10)
    except Exception as e:
        return JsonResponse({'error': f'Retrieval failed: {str(e)}'}, status=500)

    if not chunks:
        return JsonResponse({
            'error': 'This document has not been processed yet. Please click "Process for AI" first.'
        }, status=400)

    context = '\n\n'.join([f"[Page {c['page_number']}]: {c['text']}" for c in chunks])

    prompt = f"""You are creating Anki-style flashcards for a university student.

Based ONLY on the following textbook content, create exactly {count} flashcards on the topic: "{topic}".

TEXTBOOK CONTENT:
{context}

INSTRUCTIONS:
- Each flashcard has a FRONT (question/term) and BACK (answer/definition)
- Make fronts concise and specific
- Make backs clear and complete but not too long
- Cover key concepts, definitions, formulas, and important facts
- Output ONLY valid JSON, nothing else

OUTPUT FORMAT (strict JSON array):
[
  {{"front": "question or term here", "back": "answer or definition here"}},
  {{"front": "question or term here", "back": "answer or definition here"}}
]"""

    try:
        client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=prompt
        )

        text = response.text.strip()
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'^```\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

        flashcards = json.loads(text)

        return JsonResponse({
            'success': True,
            'flashcards': flashcards,
            'topic': topic,
            'source_pages': sorted(set(c['page_number'] for c in chunks)),
        })
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Could not parse flashcards. Try again.'}, status=500)
    except Exception as e:
        return JsonResponse({'error': f'Generation failed: {str(e)}'}, status=500)

@login_required
def generate_view(request):
    profile, _ = StudentProfile.objects.get_or_create(user=request.user, defaults={'major': 'CIT'})
    documents = Document.objects.filter(user=request.user).order_by('-uploaded_at')
    return render(request, 'study/generate.html', {
        'profile': profile,
        'documents': documents,
    })