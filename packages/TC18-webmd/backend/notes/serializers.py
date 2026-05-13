from rest_framework import serializers
from .models import Note, Comment


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'title', 'content', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = [
            'id', 'note', 'paragraph_id', 'paragraph_text',
            'content', 'author', 'created_at', 'resolved'
        ]
        read_only_fields = ['created_at']


class CommentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = [
            'id', 'paragraph_id', 'paragraph_text',
            'content', 'author', 'created_at', 'resolved'
        ]
        read_only_fields = ['created_at']
