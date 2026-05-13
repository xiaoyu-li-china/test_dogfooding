from django.db import models


class Note(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class Comment(models.Model):
    note = models.ForeignKey(
        Note,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    paragraph_id = models.CharField(max_length=100)
    paragraph_text = models.TextField()
    content = models.TextField()
    author = models.CharField(max_length=100, default='匿名用户')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Comment on {self.note.title} - {self.paragraph_id}'
