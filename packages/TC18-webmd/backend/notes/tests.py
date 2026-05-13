from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIRequestFactory
from rest_framework import status
from .models import Note, Comment
from .views import NoteViewSet, CommentViewSet


class NoteAPITestCase(APITestCase):

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        self.note_data = {
            'title': 'Test Note',
            'content': '# Test Note\n\nThis is the content.'
        }
        self.note = Note.objects.create(**self.note_data)

    def test_create_note(self):
        url = reverse('note-list')
        data = {
            'title': 'New Test Note',
            'content': 'New note content'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Note.objects.count(), 2)
        self.assertEqual(response.data['title'], 'New Test Note')
        self.assertIn('id', response.data)
        self.assertIn('created_at', response.data)
        self.assertIn('updated_at', response.data)

    def test_list_notes(self):
        Note.objects.create(
            title='Second Note',
            content='Second content'
        )
        url = reverse('note-list')
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['title'], 'Second Note')

    def test_retrieve_note(self):
        url = reverse('note-detail', kwargs={'pk': self.note.pk})
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.note.pk)
        self.assertEqual(response.data['title'], self.note.title)
        self.assertEqual(response.data['content'], self.note.content)

    def test_update_note(self):
        url = reverse('note-detail', kwargs={'pk': self.note.pk})
        updated_data = {
            'title': 'Updated Note Title',
            'content': 'Updated content'
        }
        response = self.client.put(url, updated_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, 'Updated Note Title')
        self.assertEqual(self.note.content, 'Updated content')

    def test_partial_update_note(self):
        url = reverse('note-detail', kwargs={'pk': self.note.pk})
        updated_data = {
            'title': 'Partially Updated Title'
        }
        response = self.client.patch(url, updated_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, 'Partially Updated Title')
        self.assertEqual(self.note.content, '# Test Note\n\nThis is the content.')

    def test_delete_note(self):
        note_to_delete = Note.objects.create(
            title='Note to delete',
            content='Delete me'
        )
        initial_count = Note.objects.count()
        url = reverse('note-detail', kwargs={'pk': note_to_delete.pk})
        response = self.client.delete(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Note.objects.count(), initial_count - 1)
        with self.assertRaises(Note.DoesNotExist):
            Note.objects.get(pk=note_to_delete.pk)

    def test_note_readonly_fields(self):
        url = reverse('note-detail', kwargs={'pk': self.note.pk})
        original_created = self.note.created_at
        original_updated = self.note.updated_at

        updated_data = {
            'title': 'Test',
            'content': 'Content',
            'created_at': '2020-01-01T00:00:00Z',
            'updated_at': '2020-01-01T00:00:00Z'
        }
        response = self.client.put(url, updated_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.note.refresh_from_db()
        self.assertEqual(self.note.created_at, original_created)

    def test_create_note_missing_title(self):
        url = reverse('note-list')
        data = {
            'content': 'Content without title'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_notes_ordering(self):
        Note.objects.create(title='Old Note', content='Old')
        new_note = Note.objects.create(title='New Note', content='New')

        url = reverse('note-list')
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['title'], 'New Note')
        self.assertEqual(response.data[-1]['title'], 'Test Note')


class NoteWithSessionAuthTestCase(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            password='otherpass123'
        )
        self.note = Note.objects.create(
            title='User Note',
            content='User content'
        )

    def test_list_notes_without_authentication(self):
        url = reverse('note-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_note_without_authentication(self):
        url = reverse('note-list')
        data = {'title': 'Test', 'content': 'Content'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_update_note_without_authentication(self):
        url = reverse('note-detail', kwargs={'pk': self.note.pk})
        data = {'title': 'Updated', 'content': 'Updated'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_note_without_authentication(self):
        url = reverse('note-detail', kwargs={'pk': self.note.pk})
        response = self.client.delete(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class NoteWithIsAuthenticatedTestCase(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.note = Note.objects.create(
            title='Test Note',
            content='Test content'
        )

    def test_list_notes_with_session_authentication(self):
        self.client.force_login(self.user)
        url = reverse('note-list')
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_note_with_session_authentication(self):
        self.client.force_login(self.user)
        url = reverse('note-list')
        data = {'title': 'New Note', 'content': 'Content'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_logout_clears_session(self):
        self.client.force_login(self.user)
        self.client.logout()

        url = reverse('note-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class CommentAPITestCase(APITestCase):

    def setUp(self):
        self.note = Note.objects.create(
            title='Test Note',
            content='# Test\n\nParagraph 1\n\nParagraph 2'
        )
        self.note2 = Note.objects.create(
            title='Second Note',
            content='Content for second note'
        )

        self.comment1 = Comment.objects.create(
            note=self.note,
            paragraph_id='para-0',
            paragraph_text='# Test',
            content='Great title!',
            author='User A'
        )
        self.comment2 = Comment.objects.create(
            note=self.note,
            paragraph_id='para-1',
            paragraph_text='Paragraph 1',
            content='Needs more details',
            author='User B',
            resolved=True
        )
        self.comment3 = Comment.objects.create(
            note=self.note2,
            paragraph_id='para-0',
            paragraph_text='Content for second note',
            content='Comment on note 2',
            author='User C'
        )

    def test_create_comment(self):
        url = reverse('comment-list')
        data = {
            'note': self.note.pk,
            'paragraph_id': 'para-2',
            'paragraph_text': 'Paragraph 2',
            'content': 'New comment on paragraph 2',
            'author': 'Test User'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 4)
        self.assertEqual(response.data['content'], 'New comment on paragraph 2')
        self.assertEqual(response.data['author'], 'Test User')
        self.assertEqual(response.data['resolved'], False)
        self.assertIn('created_at', response.data)

    def test_list_all_comments(self):
        url = reverse('comment-list')
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

    def test_list_comments_by_note_id(self):
        url = f"{reverse('comment-list')}?note_id={self.note.pk}"
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_list_comments_by_note2_id(self):
        url = f"{reverse('comment-list')}?note_id={self.note2.pk}"
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['author'], 'User C')

    def test_retrieve_comment(self):
        url = reverse('comment-detail', kwargs={'pk': self.comment1.pk})
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.comment1.pk)
        self.assertEqual(response.data['paragraph_id'], 'para-0')
        self.assertEqual(response.data['content'], 'Great title!')

    def test_update_comment(self):
        url = reverse('comment-detail', kwargs={'pk': self.comment1.pk})
        updated_data = {
            'note': self.note.pk,
            'paragraph_id': 'para-0',
            'paragraph_text': '# Test',
            'content': 'Updated comment content',
            'author': 'User A Updated'
        }
        response = self.client.put(url, updated_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comment1.refresh_from_db()
        self.assertEqual(self.comment1.content, 'Updated comment content')
        self.assertEqual(self.comment1.author, 'User A Updated')

    def test_partial_update_comment(self):
        url = reverse('comment-detail', kwargs={'pk': self.comment1.pk})
        updated_data = {
            'content': 'Only content updated'
        }
        response = self.client.patch(url, updated_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comment1.refresh_from_db()
        self.assertEqual(self.comment1.content, 'Only content updated')

    def test_delete_comment(self):
        initial_count = Comment.objects.count()
        url = reverse('comment-detail', kwargs={'pk': self.comment1.pk})
        response = self.client.delete(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Comment.objects.count(), initial_count - 1)

    def test_resolve_comment(self):
        url = reverse('comment-resolve', kwargs={'pk': self.comment1.pk})
        data = {'resolved': True}
        response = self.client.patch(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comment1.refresh_from_db()
        self.assertTrue(self.comment1.resolved)

    def test_unresolve_comment(self):
        url = reverse('comment-resolve', kwargs={'pk': self.comment2.pk})
        data = {'resolved': False}
        response = self.client.patch(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comment2.refresh_from_db()
        self.assertFalse(self.comment2.resolved)

    def test_resolve_comment_default_true(self):
        url = reverse('comment-resolve', kwargs={'pk': self.comment1.pk})
        response = self.client.patch(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comment1.refresh_from_db()
        self.assertTrue(self.comment1.resolved)

    def test_create_comment_default_author(self):
        url = reverse('comment-list')
        data = {
            'note': self.note.pk,
            'paragraph_id': 'para-2',
            'paragraph_text': 'Paragraph 2',
            'content': 'Comment without author'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['author'], '匿名用户')

    def test_create_comment_missing_note(self):
        url = reverse('comment-list')
        data = {
            'paragraph_id': 'para-0',
            'paragraph_text': 'Test',
            'content': 'Missing note'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_comments_ordering(self):
        Comment.objects.all().delete()
        comment_old = Comment.objects.create(
            note=self.note,
            paragraph_id='para-0',
            paragraph_text='Test',
            content='Old comment'
        )
        import time
        time.sleep(0.01)
        comment_new = Comment.objects.create(
            note=self.note,
            paragraph_id='para-1',
            paragraph_text='Test 2',
            content='New comment'
        )

        url = reverse('comment-list')
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['content'], 'Old comment')
        self.assertEqual(response.data[1]['content'], 'New comment')

    def test_delete_note_cascades_comments(self):
        note_id = self.note.pk
        comments_count = Comment.objects.filter(note_id=note_id).count()
        self.assertEqual(comments_count, 2)

        note_url = reverse('note-detail', kwargs={'pk': note_id})
        self.client.delete(note_url, format='json')

        remaining_comments = Comment.objects.filter(note_id=note_id).count()
        self.assertEqual(remaining_comments, 0)

    def test_get_comments_through_note_endpoint(self):
        url = reverse('note-comments', kwargs={'pk': self.note.pk})
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertNotIn('note', response.data[0])

    def test_create_comment_through_note_endpoint(self):
        url = reverse('note-comments', kwargs={'pk': self.note.pk})
        data = {
            'paragraph_id': 'para-2',
            'paragraph_text': 'Paragraph 2',
            'content': 'Comment via note endpoint',
            'author': 'Test Author'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.filter(note=self.note).count(), 3)
        self.assertEqual(response.data['content'], 'Comment via note endpoint')


class CommentWithSessionAuthTestCase(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.note = Note.objects.create(
            title='Test Note',
            content='Test content'
        )

    def test_list_comments_without_auth(self):
        url = reverse('comment-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_comment_without_auth(self):
        url = reverse('comment-list')
        data = {
            'note': self.note.pk,
            'paragraph_id': 'para-0',
            'paragraph_text': 'Test',
            'content': 'Test comment'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_delete_comment_without_auth(self):
        comment = Comment.objects.create(
            note=self.note,
            paragraph_id='para-0',
            paragraph_text='Test',
            content='Comment'
        )
        url = reverse('comment-detail', kwargs={'pk': comment.pk})
        response = self.client.delete(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_resolve_comment_with_session_auth(self):
        self.client.force_login(self.user)
        comment = Comment.objects.create(
            note=self.note,
            paragraph_id='para-0',
            paragraph_text='Test',
            content='Comment'
        )
        url = reverse('comment-resolve', kwargs={'pk': comment.pk})
        response = self.client.patch(url, {'resolved': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
