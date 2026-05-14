from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'surveys', views.SurveyViewSet)
router.register(r'questions', views.QuestionViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('responses/submit/', views.submit_response, name='submit-response'),
    path('responses/check-token/<str:token>/', views.check_token, name='check-token'),
]
