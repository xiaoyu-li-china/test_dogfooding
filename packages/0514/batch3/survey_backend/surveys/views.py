from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response as DRFResponse
from django.db import IntegrityError
from .models import Survey, Question, Response as SurveyResponse
from .serializers import (
    SurveySerializer,
    SurveyListSerializer,
    QuestionSerializer,
    ResponseSerializer
)
from .services import CRMService


class SurveyViewSet(viewsets.ModelViewSet):
    queryset = Survey.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return SurveyListSerializer
        return SurveySerializer


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer

    def get_queryset(self):
        survey_id = self.request.query_params.get('survey')
        if survey_id:
            return Question.objects.filter(survey_id=survey_id)
        return super().get_queryset()


@api_view(['POST'])
def submit_response(request):
    serializer = ResponseSerializer(data=request.data)
    if serializer.is_valid():
        try:
            response = serializer.save()
            crm_service = CRMService()
            success, message = crm_service.create_follow_up_task(response)
            response.crm_webhook_status = 'success' if success else 'failed'
            response.crm_webhook_message = message
            response.save()
            return DRFResponse(serializer.data, status=status.HTTP_201_CREATED)
        except IntegrityError:
            return DRFResponse(
                {'error': '该问卷已使用此 token 提交过'},
                status=status.HTTP_400_BAD_REQUEST
            )
    return DRFResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def check_token(request, token):
    exists = SurveyResponse.objects.filter(token=token).exists()
    return DRFResponse({'exists': exists})
