<script setup>
import { ref, watch, onMounted } from 'vue'
import NoteList from './components/NoteList.vue'
import NoteEditor from './components/NoteEditor.vue'
import CommentSidebar from './components/CommentSidebar.vue'
import { noteApi, commentApi } from './services/api.js'

const notes = ref([])
const selectedNote = ref(null)
const comments = ref([])
const loading = ref(false)
const error = ref('')
const showComments = ref(true)

const editorRef = ref(null)

async function loadNotes() {
  loading.value = true
  error.value = ''
  try {
    notes.value = await noteApi.getAll()
  } catch (err) {
    console.error('加载笔记失败:', err)
    error.value = '无法加载笔记，请确保后端服务已启动'
  } finally {
    loading.value = false
  }
}

async function loadComments(noteId) {
  if (!noteId) {
    comments.value = []
    return
  }
  try {
    comments.value = await commentApi.getAll(noteId)
  } catch (err) {
    console.error('加载评论失败:', err)
  }
}

function selectNote(note) {
  selectedNote.value = note
  loadComments(note.id)
}

async function createNote() {
  try {
    const newNote = await noteApi.create({
      title: '新建笔记',
      content: '# 新建笔记\n\n这是第一个段落，可以点击它来添加评论。\n\n这是第二个段落，也可以添加评论。',
    })
    notes.value.unshift(newNote)
    selectedNote.value = newNote
    comments.value = []
  } catch (err) {
    console.error('创建笔记失败:', err)
    error.value = '创建笔记失败'
  }
}

async function deleteNote(id) {
  try {
    await noteApi.delete(id)
    notes.value = notes.value.filter((note) => note.id !== id)
    if (selectedNote.value && selectedNote.value.id === id) {
      selectedNote.value = null
      comments.value = []
    }
  } catch (err) {
    console.error('删除笔记失败:', err)
    error.value = '删除笔记失败'
  }
}

async function updateNote(updatedNote) {
  try {
    const savedNote = await noteApi.update(updatedNote.id, {
      title: updatedNote.title,
      content: updatedNote.content,
    })
    const index = notes.value.findIndex((n) => n.id === savedNote.id)
    if (index !== -1) {
      notes.value[index] = savedNote
    }
    if (selectedNote.value && selectedNote.value.id === savedNote.id) {
      selectedNote.value = savedNote
    }
  } catch (err) {
    console.error('更新笔记失败:', err)
    error.value = '更新笔记失败'
  }
}

function handleAddComment(paragraph) {
  if (!selectedNote.value) return
  showComments.value = true
  const existingComments = comments.value.filter(
    (c) => c.paragraph_id === paragraph.id
  )
  if (existingComments.length > 0) {
    editorRef.value?.scrollToParagraph(paragraph.id)
  }
}

function handleSelectComment(comment) {
  if (editorRef.value && comment.paragraph_id) {
    editorRef.value.scrollToParagraph(comment.paragraph_id)
  }
}

function handleCommentsUpdate(newComments) {
  comments.value = newComments
}

watch(
  () => selectedNote.value,
  (note) => {
    if (note) {
      loadComments(note.id)
    } else {
      comments.value = []
    }
  }
)

onMounted(() => {
  loadNotes()
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>📝 全栈笔记应用</h1>
      <p class="subtitle">Vue 3 + CodeMirror + Django REST Framework</p>
      <button
        v-if="selectedNote"
        class="btn-toggle-comments"
        @click="showComments = !showComments"
      >
        {{ showComments ? '隐藏评论' : '💬 显示评论' }}
      </button>
    </header>

    <main class="app-main">
      <div v-if="error" class="error-message">
        {{ error }}
        <button @click="error = ''; loadNotes()">重试</button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <template v-else>
        <aside class="sidebar">
          <NoteList
            :notes="notes"
            :selected-id="selectedNote?.id"
            @select="selectNote"
            @create="createNote"
            @delete="deleteNote"
          />
        </aside>

        <section class="editor-area" :class="{ 'with-comments': showComments && selectedNote }">
          <NoteEditor
            ref="editorRef"
            :note="selectedNote"
            :comments="comments"
            @update="updateNote"
            @add-comment="handleAddComment"
          />
        </section>

        <aside v-if="showComments && selectedNote" class="comment-sidebar-wrapper">
          <CommentSidebar
            :note-id="selectedNote?.id"
            v-model:comments="comments"
            @select-comment="handleSelectComment"
            @update:comments="handleCommentsUpdate"
          />
        </aside>
      </template>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: #fff;
  border-bottom: 1px solid #e9ecef;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 0.875rem;
  color: #6c757d;
}

.header-left {
  flex: 1;
}

.btn-toggle-comments {
  padding: 8px 16px;
  background-color: #ffc107;
  color: #212529;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-toggle-comments:hover {
  background-color: #e0a800;
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.error-message {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background-color: #dc3545;
  color: white;
  border-radius: 6px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 16px;
}

.error-message button {
  padding: 6px 12px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
}

.error-message button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.loading {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.25rem;
  color: #6c757d;
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
}

.editor-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.comment-sidebar-wrapper {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  border-left: 1px solid #e9ecef;
}
</style>
