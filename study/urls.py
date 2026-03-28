from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('study/', views.study_view, name='study'),
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),
    path('logout/', views.logout_view, name='logout'),
    path('delete/<int:doc_id>/', views.delete_document, name='delete_document'),

    path('api/upload/', views.upload_pdf, name='upload_pdf'),
    path('api/exercises/', views.get_exercises, name='get_exercises'),
    path('api/solve/', views.solve_exercise, name='solve_exercise'),
]