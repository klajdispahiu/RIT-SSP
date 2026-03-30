from django.db import models
from django.contrib.auth.models import User


MAJOR_CHOICES = [
    ('CIT', 'Computing and Information Technologies'),
    ('EET', 'Electrical Engineering Technology'),
]

CIT_SUBJECTS = [
    'Applied Calculus',
    'Software Development and Problem Solving',
    'Intro to CyberSecurity',
    'Intro to Technical Communication',
    'Public Policy',
]

EET_SUBJECTS = [
    'Calculus B',
    'Intro to Technical Communication',
    'Public Speaking',
    'Circuits 2',
    'Engineering Fundamentals',
]

SUBJECT_CHOICES = [(s, s) for s in CIT_SUBJECTS + EET_SUBJECTS]


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    major = models.CharField(max_length=10, choices=MAJOR_CHOICES, default='CIT')

    def __str__(self):
        return f"{self.user.username} — {self.major}"

    def get_subjects(self):
        if self.major == 'CIT':
            return CIT_SUBJECTS
        return EET_SUBJECTS


class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    file = models.FileField(upload_to='uploads/')
    original_name = models.CharField(max_length=255, default='untitled.pdf')
    subject = models.CharField(max_length=100, blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.original_name} ({self.user.username})"


class Page(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE)
    page_number = models.IntegerField()
    content = models.TextField()


class Exercise(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE)
    page_number = models.IntegerField()
    exercise_number = models.CharField(max_length=20)
    content = models.TextField()

    def __str__(self):
        return f"Exercise {self.exercise_number} (page {self.page_number})"


class StudySession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    document = models.ForeignKey(Document, on_delete=models.CASCADE)
    exercise_numbers = models.CharField(max_length=255)
    page_number = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} — {self.document.original_name} — {self.created_at.strftime('%Y-%m-%d')}"


class CalendarEvent(models.Model):
    EVENT_TYPES = [
        ('exam', 'Exam'),
        ('assignment', 'Assignment'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    date = models.DateField()
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    subject = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} — {self.date} ({self.event_type})"