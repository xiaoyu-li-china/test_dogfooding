from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NoteViewSet, CommentViewSet

router = DefaultRouter()
router.register(r'notes', NoteViewSet)
router.register(r'comments', CommentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
