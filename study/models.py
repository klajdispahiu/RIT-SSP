from django.db import models
from django.contrib.auth.models import User


class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    file = models.FileField(upload_to='uploads/')
    original_name = models.CharField(max_length=255, default='untitled.pdf')
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
        return f"{self.user.username} - {self.document.original_name} - {self.created_at.strftime('%Y-%m-%d')}"