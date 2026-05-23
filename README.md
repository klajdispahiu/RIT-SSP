# RIT Student Study Platform (RIT-SSP)

An AI-powered study platform built for university students. Upload your textbooks, generate exercises and flashcards, take interactive quizzes, and track your exam schedule — all personalized to your major and subjects.

---

## Features

- **PDF Textbook Upload** — Upload course materials per subject and extract exercises automatically
- **AI Exercise Generation** — Generate custom practice exercises from your textbook content using RAG
- **Flashcard Mode** — Anki-style flashcards generated directly from your uploaded materials
- **Interactive Quiz Mode** — Multiple choice quizzes with instant grading, explanations, and scoring
- **AI Solutions** — Get step-by-step solutions for any exercise
- **Calendar** — Track exam dates (red) and assignment deadlines (purple)
- **Major & Subject Management** — Supports CIT and EET majors with dedicated subject spaces
- **Study Session History** — Tracks every session on your dashboard
- **User Authentication** — Secure signup, login, and per-user data isolation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Django, Django REST Framework |
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Database | SQLite |
| PDF Processing | PyMuPDF (fitz) |
| Vector Embeddings | Sentence Transformers (`all-MiniLM-L6-v2`) |
| Vector Storage | ChromaDB |
| AI Generation | Google Gemini API (`gemini-2.5-flash`) |
| Authentication | Django built-in auth |

---

## Prerequisites

Make sure you have the following installed:

- Python 3.10+
- pip
- Git

---

## Installation

**1. Clone the repository**

```bash
git clone https://github.com/klajdispahiu/RIT-SSP.git
cd RIT-SSP
```

**2. Create and activate a virtual environment**

On Mac/Linux:
```bash
python -m venv venv
source venv/bin/activate
```

On Windows:
```bash
python -m venv venv
venv\Scripts\activate
```

**3. Install dependencies**

```bash
pip install django djangorestframework pymupdf python-dotenv google-genai sentence-transformers chromadb
```

**4. Set up your environment variables**

Create a `.env` file in the root folder:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your free Gemini API key at [aistudio.google.com](https://aistudio.google.com)

**5. Apply database migrations**

```bash
python manage.py makemigrations
python manage.py migrate
```

**6. Run the development server**

```bash
python manage.py runserver
```

Open your browser and go to `http://127.0.0.1:8000`

---

## How to Use

**1. Create an account** — Sign up and select your major (CIT or EET)

**2. Upload textbooks** — Go to Subjects, pick a subject, and upload a PDF textbook

**3. Process for AI** — Go to AI Generate, select your document, and click Process. This indexes the textbook for semantic search (one-time per book)

**4. Generate content** — Enter a topic and generate:
   - Practice exercises with show/hide answers
   - Flashcards with flip animation and grid view
   - Interactive multiple choice quizzes with scoring

**5. Study mode** — Go to Study, select a document, enter exercise numbers and a page to retrieve and solve specific exercises

**6. Calendar** — Add exam dates and assignment deadlines to your personal calendar

---

## Project Structure

```
RIT-SSP/
├── core/               # Django project settings and URLs
├── study/              # Main app — models, views, URLs, RAG engine
│   ├── models.py       # Database models
│   ├── views.py        # API endpoints and page views
│   ├── urls.py         # URL routing
│   └── rag.py          # RAG pipeline (chunking, embedding, retrieval)
├── templates/study/    # HTML templates
├── static/
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── media/              # Uploaded PDF files (not tracked by Git)
├── chromadb_store/     # Vector embeddings (not tracked by Git)
└── manage.py
```

---

## Notes

- The `chromadb_store/` folder is local — if you switch machines, re-process your textbooks
- The `.env` file is not tracked by Git — create it manually on each machine
- First-time processing of large textbooks (500+ pages) may take several minutes
- The platform is designed for local development use

---

## Author

**Klajdi Spahiu**  
Rochester Institute of Technology  
[GitHub](https://github.com/klajdispahiu)

<img width="1131" height="778" alt="Screenshot 2026-05-23 at 6 24 08 PM" src="https://github.com/user-attachments/assets/2a8e13c3-417d-4cd0-b341-4e0bc06b1a42" />
<img width="1373" height="775" alt="Screenshot 2026-05-23 at 6 24 51 PM" src="https://github.com/user-attachments/assets/63eed0a6-bd0c-496b-be99-666c8a028496" />
<img width="1347" height="726" alt="Screenshot 2026-05-23 at 6 29 30 PM" src="https://github.com/user-attachments/assets/5ae0ffe7-cd65-446a-8f51-5e6adf8d6386" />
<img width="1362" height="734" alt="Screenshot 2026-05-23 at 6 25 43 PM" src="https://github.com/user-attachments/assets/bb554bcb-d2b2-4af1-99ba-2c28fe1c30c8" />

