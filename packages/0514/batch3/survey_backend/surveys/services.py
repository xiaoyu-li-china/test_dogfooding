import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class CRMService:
    def __init__(self):
        self.webhook_url = getattr(settings, 'CRM_WEBHOOK_URL', None)
        self.api_key = getattr(settings, 'CRM_API_KEY', None)

    def create_follow_up_task(self, survey_response):
        if not self.webhook_url:
            logger.warning('CRM Webhook URL not configured')
            return False, 'CRM Webhook URL not configured'

        try:
            answers_data = []
            for answer in survey_response.answers.all():
                answers_data.append({
                    'question': answer.question.text,
                    'value': answer.value
                })

            payload = {
                'event_type': 'survey_completed',
                'survey_id': survey_response.survey.id,
                'survey_title': survey_response.survey.title,
                'response_token': survey_response.token,
                'submitted_at': survey_response.submitted_at.isoformat(),
                'answers': answers_data
            }

            headers = {}
            if self.api_key:
                headers['Authorization'] = f'Bearer {self.api_key}'

            response = requests.post(
                self.webhook_url,
                json=payload,
                headers=headers,
                timeout=10
            )

            if response.status_code in (200, 201, 202):
                logger.info(f'CRM follow-up task created successfully for response {survey_response.id}')
                return True, 'Success'
            else:
                logger.error(f'CRM Webhook returned status {response.status_code}: {response.text}')
                return False, f'HTTP {response.status_code}'

        except requests.exceptions.RequestException as e:
            logger.error(f'CRM Webhook request failed: {str(e)}')
            return False, str(e)
