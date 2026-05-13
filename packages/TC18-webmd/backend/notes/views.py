from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Note, Comment
from .serializers import (
    NoteSerializer,
    CommentSerializer,
    CommentDetailSerializer
)


class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        note = self.get_object()

        if request.method == 'GET':
            comments = note.comments.all()
            serializer = CommentDetailSerializer(comments, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            data['note'] = note.id
            serializer = CommentSerializer(data=data)
            if serializer.is_valid():
                serializer.save(note=note)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer

    def get_queryset(self):
        note_id = self.request.query_params.get('note_id')
        if note_id:
            return Comment.objects.filter(note_id=note_id)
        return super().get_queryset()

    @action(detail=True, methods=['patch'])
    def resolve(self, request, pk=None):
        comment = self.get_object()
        comment.resolved = request.data.get('resolved', True)
        comment.save()
        serializer = self.get_serializer(comment)
        return Response(serializer.data)
