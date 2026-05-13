<script setup>
import { ref, computed, watch } from 'vue'
import { commentApi } from '../services/api.js'

const props = defineProps({
  noteId: {
    type: Number,
    default: null,
  },
  comments: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:comments', 'select-comment'])

const showResolved = ref(false)
const newCommentText = ref('')
const authorName = ref('')
const selectedParagraph = ref(null)
const isAddingComment = ref(false)

const activeComments = computed(() => {
  if (showResolved.value) {
    return props.comments
  }
  return props.comments.filter((c) => !c.resolved)
})

const unresolvedCount = computed(() => {
  return props.comments.filter((c) => !c.resolved).length
})

const commentsByParagraph = computed(() => {
  const groups = {}
  activeComments.value.forEach((comment) => {
    if (!groups[comment.paragraph_id]) {
      groups[comment.paragraph_id] = {
        paragraph_text: comment.paragraph_text,
        comments: [],
      }
    }
    groups[comment.paragraph_id].comments.push(comment)
  })
  return groups
})

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateText(text, maxLength = 80) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

async function toggleResolve(comment) {
  try {
    const updated = await commentApi.resolve(comment.id, !comment.resolved)
    const index = props.comments.findIndex((c) => c.id === comment.id)
    if (index !== -1) {
      const newComments = [...props.comments]
      newComments[index] = updated
      emit('update:comments', newComments)
    }
  } catch (error) {
    console.error('切换解决状态失败:', error)
  }
}

async function deleteComment(commentId) {
  if (!confirm('确定要删除这条评论吗？')) return
  try {
    await commentApi.delete(commentId)
    const newComments = props.comments.filter((c) => c.id !== commentId)
    emit('update:comments', newComments)
  } catch (error) {
    console.error('删除评论失败:', error)
  }
}

function highlightParagraph(comment) {
  emit('select-comment', comment)
}

function openCommentDialog(paragraph) {
  selectedParagraph.value = paragraph
  isAddingComment.value = true
  newCommentText.value = ''
}

async function submitComment() {
  if (!newCommentText.value.trim() || !selectedParagraph.value) return

  try {
    const newComment = await commentApi.create({
      note: props.noteId,
      paragraph_id: selectedParagraph.value.id,
      paragraph_text: selectedParagraph.value.text,
      content: newCommentText.value.trim(),
      author: authorName.value.trim() || '匿名用户',
      resolved: false,
    })
    const newComments = [...props.comments, newComment]
    emit('update:comments', newComments)
    isAddingComment.value = false
    newCommentText.value = ''
    selectedParagraph.value = null
  } catch (error) {
    console.error('添加评论失败:', error)
  }
}

function cancelComment() {
  isAddingComment.value = false
  newCommentText.value = ''
  selectedParagraph.value = null
}

watch(
  () => props.noteId,
  () => {
    selectedParagraph.value = null
    isAddingComment.value = false
    newCommentText.value = ''
  }
)
</script>

<template>
  <div class="comment-sidebar">
    <div class="sidebar-header">
      <div class="header-top">
        <h3>💬 评论</h3>
        <span class="badge" v-if="unresolvedCount > 0">{{ unresolvedCount }}</span>
      </div>
      <label class="show-resolved">
        <input type="checkbox" v-model="showResolved" />
        显示已解决
      </label>
    </div>

    <div v-if="isAddingComment && selectedParagraph" class="add-comment-form">
      <div class="form-header">
        <span>添加评论到段落:</span>
        <button class="btn-close" @click="cancelComment">×</button>
      </div>
      <div class="paragraph-preview">
        {{ truncateText(selectedParagraph.text, 100) }}
      </div>
      <input
        v-model="authorName"
        type="text"
        class="author-input"
        placeholder="您的名字（可选）"
      />
      <textarea
        v-model="newCommentText"
        class="comment-input"
        placeholder="输入您的评论..."
        rows="3"
      ></textarea>
      <div class="form-actions">
        <button class="btn-cancel" @click="cancelComment">取消</button>
        <button class="btn-submit" @click="submitComment" :disabled="!newCommentText.trim()">
          添加评论
        </button>
      </div>
    </div>

    <div class="comments-container">
      <div v-if="Object.keys(commentsByParagraph).length === 0" class="empty-state">
        <p v-if="comments.length === 0">暂无评论</p>
        <p v-else>没有未解决的评论</p>
        <p class="hint">在编辑器中选择段落来添加评论</p>
      </div>

      <div
        v-for="(group, paragraphId) in commentsByParagraph"
        :key="paragraphId"
        class="paragraph-group"
      >
        <div
          class="paragraph-header"
          @click="highlightParagraph({ paragraph_id: paragraphId })"
        >
          <span class="comment-icon">💬</span>
          <span class="paragraph-text">
            {{ truncateText(group.paragraph_text, 60) }}
          </span>
          <span class="comment-count">{{ group.comments.length }}</span>
        </div>

        <div class="comment-list">
          <div
            v-for="comment in group.comments"
            :key="comment.id"
            class="comment-item"
            :class="{ resolved: comment.resolved }"
          >
            <div class="comment-header">
              <span class="author">{{ comment.author }}</span>
              <span class="date">{{ formatDate(comment.created_at) }}</span>
            </div>
            <p class="comment-content">{{ comment.content }}</p>
            <div class="comment-actions">
              <button
                class="btn-resolve"
                :class="{ resolved: comment.resolved }"
                @click="toggleResolve(comment)"
              >
                {{ comment.resolved ? '重新打开' : '标记已解决' }}
              </button>
              <button class="btn-delete" @click="deleteComment(comment.id)">
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #fff;
  border-left: 1px solid #e9ecef;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  background-color: #f8f9fa;
}

.header-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.header-top h3 {
  margin: 0;
  font-size: 1rem;
  color: #333;
}

.badge {
  background-color: #dc3545;
  color: white;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.show-resolved {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: #6c757d;
  cursor: pointer;
}

.show-resolved input {
  cursor: pointer;
}

.add-comment-form {
  padding: 12px;
  background-color: #fff3cd;
  border-bottom: 1px solid #ffc107;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.875rem;
  color: #856404;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #856404;
  line-height: 1;
  padding: 0;
}

.paragraph-preview {
  background-color: rgba(255, 255, 255, 0.7);
  padding: 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 8px;
  font-style: italic;
}

.author-input,
.comment-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-size: 0.875rem;
  margin-bottom: 8px;
  resize: vertical;
  font-family: inherit;
}

.author-input:focus,
.comment-input:focus {
  outline: none;
  border-color: #e0a800;
  box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.25);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-submit {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-cancel {
  background-color: #e9ecef;
  color: #495057;
}

.btn-cancel:hover {
  background-color: #dee2e6;
}

.btn-submit {
  background-color: #ffc107;
  color: #212529;
}

.btn-submit:hover:not(:disabled) {
  background-color: #e0a800;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.comments-container {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-state p {
  margin: 0;
}

.empty-state .hint {
  font-size: 0.875rem;
  margin-top: 8px;
}

.paragraph-group {
  border-bottom: 1px solid #f1f3f5;
}

.paragraph-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: #f8f9fa;
  cursor: pointer;
  transition: background-color 0.2s;
}

.paragraph-header:hover {
  background-color: #e9ecef;
}

.comment-icon {
  font-size: 1rem;
}

.paragraph-text {
  flex: 1;
  font-size: 0.85rem;
  color: #495057;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comment-count {
  background-color: #e9ecef;
  color: #6c757d;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.comment-list {
  background-color: #fff;
}

.comment-item {
  padding: 12px;
  border-bottom: 1px solid #f1f3f5;
  transition: background-color 0.2s;
}

.comment-item:hover {
  background-color: #fafafa;
}

.comment-item.resolved {
  opacity: 0.6;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.author {
  font-weight: 600;
  color: #495057;
  font-size: 0.875rem;
}

.date {
  font-size: 0.75rem;
  color: #adb5bd;
}

.comment-content {
  margin: 0 0 8px 0;
  font-size: 0.875rem;
  color: #333;
  line-height: 1.5;
}

.comment-actions {
  display: flex;
  gap: 8px;
}

.btn-resolve,
.btn-delete {
  background: none;
  border: none;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.btn-resolve {
  color: #28a745;
}

.btn-resolve:hover {
  background-color: rgba(40, 167, 69, 0.1);
}

.btn-resolve.resolved {
  color: #6c757d;
}

.btn-delete {
  color: #dc3545;
}

.btn-delete:hover {
  background-color: rgba(220, 53, 69, 0.1);
}
</style>
