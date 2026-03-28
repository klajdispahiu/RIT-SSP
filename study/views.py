import re
import json
import fitz  # PyMuPDF
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import Document, Page, Exercise, StudySession


# ── Auth views ──────────────────────────────────────────────────────────────

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
        if password != confirm:
            return render(request, 'study/signup.html', {'error': 'Passwords do not match.'})
        if User.objects.filter(username=username).exists():
            return render(request, 'study/signup.html', {'error': 'Username already taken.'})
        user = User.objects.create_user(username=username, email=email, password=password)
        login(request, user)
        return redirect('dashboard')
    return render(request, 'study/signup.html')


def logout_view(request):
    logout(request)
    return redirect('login')


# ── Main app views ───────────────────────────────────────────────────────────

@login_required
def dashboard(request):
    documents = Document.objects.filter(user=request.user).order_by('-uploaded_at')
    sessions = StudySession.objects.filter(user=request.user).order_by('-created_at')[:10]
    return render(request, 'study/dashboard.html', {
        'documents': documents,
        'sessions': sessions,
    })


@login_required
def study_view(request):
    documents = Document.objects.filter(user=request.user).order_by('-uploaded_at')
    return render(request, 'study/study.html', {'documents': documents})


# ── API endpoints ────────────────────────────────────────────────────────────

@csrf_exempt
@login_required
def upload_pdf(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    pdf_file = request.FILES.get('file')
    if not pdf_file:
        return JsonResponse({'error': 'No file provided'}, status=400)
    if not pdf_file.name.endswith('.pdf'):
        return JsonResponse({'error': 'Only PDF files are supported'}, status=400)

    doc = Document.objects.create(
        user=request.user,
        file=pdf_file,
        original_name=pdf_file.name,
    )

    try:
        pdf = fitz.open(doc.file.path)
        exercise_count = 0
        for page_num in range(len(pdf)):
            page = pdf[page_num]
            text = page.get_text()
            Page.objects.create(
                document=doc,
                page_number=page_num + 1,
                content=text,
            )
            patterns = [
                r'(?:Exercise|Problem|Ex\.|Q\.?)\s*(\d+[\.\d]*)',
                r'^(\d+)\.\s+\w',
            ]
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.MULTILINE | re.IGNORECASE)
                for match in matches:
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
                'message': 'No exercises matched the pattern — showing raw page content.',
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

    return JsonResponse({
        'solution': f'[AI solution will appear here once the Anthropic API key is configured in your .env file.]\n\nExercise received:\n{content[:300]}',
        'similar_exercises': [
            'Similar exercise 1 will be generated here.',
            'Similar exercise 2 will be generated here.',
            'Similar exercise 3 will be generated here.',
        ]
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