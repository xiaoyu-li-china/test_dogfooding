from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from .models import Survey, Question, Response, Answer
import uuid


class SurveyAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.survey = Survey.objects.create(
            title='测试问卷',
            description='测试描述'
        )
        
        self.question1 = Question.objects.create(
            survey=self.survey,
            text='问题1',
            question_type='single',
            options=['A', 'B'],
            order=1
        )
        
        self.question2 = Question.objects.create(
            survey=self.survey,
            text='问题2',
            question_type='text',
            order=2
        )

    def test_create_survey(self):
        url = reverse('survey-list')
        data = {'title': '新问卷', 'description': '新描述'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Survey.objects.count(), 2)
        self.assertEqual(Survey.objects.get(id=response.data['id']).title, '新问卷')

    def test_get_survey_list(self):
        url = reverse('survey-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_get_survey_detail(self):
        url = reverse('survey-detail', args=[self.survey.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], '测试问卷')
        self.assertEqual(len(response.data['questions']), 2)

    def test_submit_survey_response(self):
        url = reverse('submit-response')
        token = str(uuid.uuid4())
        data = {
            'survey': self.survey.id,
            'token': token,
            'answers': [
                {'question': self.question1.id, 'value': 'A'},
                {'question': self.question2.id, 'value': '测试答案'}
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Response.objects.count(), 1)
        self.assertEqual(Answer.objects.count(), 2)

    def test_duplicate_token_prevent_duplicate_submission(self):
        url = reverse('submit-response')
        token = str(uuid.uuid4())
        Response.objects.create(survey=self.survey, token=token)
        
        data = {
            'survey': self.survey.id,
            'token': token,
            'answers': [
                {'question': self.question1.id, 'value': 'A'}
            ]
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Answer.objects.count(), 0)

    def test_check_token_exists(self):
        token = str(uuid.uuid4())
        Response.objects.create(survey=self.survey, token=token)
        
        url = reverse('check-token', args=[token])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['exists'])

    def test_check_token_not_exists(self):
        url = reverse('check-token', args=['non-existent-token'])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['exists'])

    def test_question_skip_logic(self):
        self.question1.skip_logic = {
            'conditions': [
                {'answer': 'A', 'action': 'jump', 'target_question_order': 3},
                {'answer': 'B', 'action': 'next'}
            ]
        }
        self.question1.save()
        
        url = reverse('survey-detail', args=[self.survey.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('skip_logic', response.data['questions'][0])

    def test_crm_webhook_status(self):
        token = str(uuid.uuid4())
        survey_response = Response.objects.create(
            survey=self.survey,
            token=token,
            crm_webhook_status='pending'
        )
        self.assertEqual(survey_response.crm_webhook_status, 'pending')
        
        survey_response.crm_webhook_status = 'success'
        survey_response.save()
        self.assertEqual(survey_response.crm_webhook_status, 'success')
