from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('study/', views.study_view, name='study'),
    path('subjects/', views.subjects_view, name='subjects'),
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),
    path('logout/', views.logout_view, name='logout'),
    path('delete/<int:doc_id>/', views.delete_document, name='delete_document'),

    path('api/upload/', views.upload_pdf, name='upload_pdf'),
    path('api/exercises/', views.get_exercises, name='get_exercises'),
    path('api/solve/', views.solve_exercise, name='solve_exercise'),
    path('calendar/', views.calendar_view, name='calendar'),
    path('api/calendar/', views.calendar_events_api, name='calendar_events_api'),
    path('generate/', views.generate_view, name='generate'),
    path('api/embed/', views.embed_document_view, name='embed_document'),
    path('api/generate-exercises/', views.generate_exercises_view, name='generate_exercises'),
    path('api/generate-flashcards/', views.generate_flashcards_view, name='generate_flashcards'),
]