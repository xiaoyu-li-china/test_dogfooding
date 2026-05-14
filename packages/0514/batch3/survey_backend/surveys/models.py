from django.db import models
import uuid


class Survey(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Question(models.Model):
    QUESTION_TYPES = (
        ('single', '单选题'),
        ('multiple', '多选题'),
        ('text', '文本题'),
    )
    
    survey = models.ForeignKey(Survey, related_name='questions', on_delete=models.CASCADE)
    text = models.CharField(max_length=500)
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    options = models.JSONField(default=list, blank=True)
    order = models.IntegerField(default=0)
    skip_logic = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.text} ({self.get_question_type_display()})'


class Response(models.Model):
    CRM_STATUS_CHOICES = (
        ('pending', '待处理'),
        ('success', '成功'),
        ('failed', '失败'),
    )
    
    survey = models.ForeignKey(Survey, related_name='responses', on_delete=models.CASCADE)
    token = models.CharField(max_length=100, unique=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    crm_webhook_status = models.CharField(max_length=20, choices=CRM_STATUS_CHOICES, default='pending')
    crm_webhook_message = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = str(uuid.uuid4())
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Response {self.id} for {self.survey.title}'


class Answer(models.Model):
    response = models.ForeignKey(Response, related_name='answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, related_name='answers', on_delete=models.CASCADE)
    value = models.JSONField()

    def __str__(self):
        return f'Answer to {self.question.text}'
