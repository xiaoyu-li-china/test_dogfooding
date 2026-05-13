<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  processMarkdownWithParagraphs,
  getCommentParagraphIds,
  splitContentIntoParagraphs,
} from '../utils/commentHighlight.js'

const props = defineProps({
  note: {
    type: Object,
    default: null,
  },
  comments: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update', 'add-comment'])

const editorRef = ref(null)
const titleInput = ref(null)
const previewRef = ref(null)
let editorView = null

const localTitle = ref('')
const localContent = ref('')
const isSaving = ref(false)
const saveStatus = ref('')
const highlightedParagraphId = ref(null)
const showCommentHint = ref(true)

const paragraphs = computed(() => {
  return splitContentIntoParagraphs(localContent.value)
})

const commentParagraphIds = computed(() => {
  return getCommentParagraphIds(props.comments)
})

const renderedContent = computed(() => {
  return processMarkdownWithParagraphs(localContent.value, commentParagraphIds.value)
})

function getParagraphComments(paragraphId) {
  return props.comments.filter((c) => c.paragraph_id === paragraphId && !c.resolved)
}

function createEditor(container, content = '') {
  if (editorView) {
    editorView.destroy()
  }

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      localContent.value = update.state.doc.toString()
    }
  })

  const state = EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      markdown(),
      oneDark,
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      EditorView.lineWrapping,
      updateListener,
    ],
  })

  editorView = new EditorView({
    state,
    parent: container,
  })
}

function setContent(content) {
  if (editorView) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: content,
      },
    })
  }
}

async function saveNote() {
  if (!props.note) return

  isSaving.value = true
  saveStatus.value = '保存中...'

  try {
    emit('update', {
      ...props.note,
      title: localTitle.value,
      content: localContent.value,
    })
    saveStatus.value = '已保存 ✓'
    setTimeout(() => {
      saveStatus.value = ''
    }, 2000)
  } catch (error) {
    console.error('保存失败:', error)
    saveStatus.value = '保存失败'
  } finally {
    isSaving.value = false
  }
}

function handleParagraphClick(event) {
  const target = event.target.closest('.commentable-paragraph')
  if (!target) return

  const paragraphId = target.dataset.paragraphId
  const paragraph = paragraphs.value.find((p) => p.id === paragraphId)

  if (paragraph) {
    highlightedParagraphId.value = paragraphId
    emit('add-comment', paragraph)
  }
}

function scrollToParagraph(paragraphId) {
  if (!previewRef.value) return

  const element = previewRef.value.querySelector(
    `[data-paragraph-id="${paragraphId}"]`
  )
  if (element) {
    highlightedParagraphId.value = paragraphId
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })

    element.classList.add('highlighted')
    setTimeout(() => {
      element.classList.remove('highlighted')
    }, 2000)
  }
}

defineExpose({
  scrollToParagraph,
})

watch(
  () => props.note,
  (newNote) => {
    if (newNote) {
      localTitle.value = newNote.title || ''
      localContent.value = newNote.content || ''
      highlightedParagraphId.value = null
      nextTick(() => {
        if (editorRef.value) {
          createEditor(editorRef.value, localContent.value)
          if (titleInput.value) {
            titleInput.value.focus()
          }
        }
      })
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (props.note && editorRef.value) {
    createEditor(editorRef.value, localContent.value)
  }
})
</script>

<template>
  <div class="note-editor">
    <template v-if="note">
      <div class="editor-header">
        <input
          ref="titleInput"
          v-model="localTitle"
          type="text"
          class="title-input"
          placeholder="请输入标题..."
          @blur="saveNote"
        />
        <div class="header-actions">
          <span class="save-status">{{ saveStatus }}</span>
          <button
            class="btn-save"
            :disabled="isSaving"
            @click="saveNote"
          >
            {{ isSaving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>

      <div class="editor-body">
        <div class="editor-pane">
          <div class="pane-header">Markdown 编辑</div>
          <div ref="editorRef" class="code-editor"></div>
        </div>
        <div class="preview-pane">
          <div class="pane-header">
            <span>实时预览</span>
            <span v-if="showCommentHint" class="comment-hint">
              💡 点击段落添加评论
              <button class="close-hint" @click="showCommentHint = false">×</button>
            </span>
          </div>
          <div
            ref="previewRef"
            class="markdown-preview"
            v-html="renderedContent"
            @click="handleParagraphClick"
          ></div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="empty-editor">
        <h2>选择或创建一篇笔记</h2>
        <p>从左侧列表选择笔记开始编辑，或点击新建按钮创建新笔记</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.note-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #fff;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  background-color: #f8f9fa;
}

.title-input {
  flex: 1;
  padding: 10px 16px;
  font-size: 1.25rem;
  font-weight: 600;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  margin-right: 16px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.title-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-status {
  font-size: 0.875rem;
  color: #28a745;
}

.btn-save {
  padding: 10px 20px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-save:hover:not(:disabled) {
  background-color: #218838;
}

.btn-save:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-pane {
  border-right: 1px solid #e9ecef;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f1f3f5;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
}

.comment-hint {
  font-size: 0.75rem;
  font-weight: normal;
  color: #856404;
  background-color: #fff3cd;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.close-hint {
  background: none;
  border: none;
  cursor: pointer;
  color: #856404;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  margin-left: 4px;
}

.code-editor {
  flex: 1;
  overflow: auto;
}

.code-editor :deep(.cm-editor) {
  height: 100%;
}

.code-editor :deep(.cm-scroller) {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
}

.markdown-preview {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  font-size: 1rem;
  line-height: 1.7;
  color: #333;
}

.markdown-preview :deep(.commentable-paragraph) {
  display: block;
  position: relative;
  transition: background-color 0.2s;
  border-radius: 4px;
  margin: -2px -6px;
  padding: 2px 6px;
  cursor: pointer;
}

.markdown-preview :deep(.commentable-paragraph:hover) {
  background-color: rgba(0, 123, 255, 0.05);
}

.markdown-preview :deep(.commentable-paragraph.has-comment) {
  background-color: rgba(255, 193, 7, 0.15);
  border-left: 3px solid #ffc107;
  margin-left: -9px;
  padding-left: 9px;
}

.markdown-preview :deep(.commentable-paragraph.has-comment:hover) {
  background-color: rgba(255, 193, 7, 0.25);
}

.markdown-preview :deep(.commentable-paragraph.highlighted) {
  background-color: rgba(0, 123, 255, 0.2) !important;
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.01); }
}

.markdown-preview :deep(h1) {
  font-size: 2rem;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 0.5rem;
  margin-top: 0;
}

.markdown-preview :deep(h2) {
  font-size: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 0.3rem;
}

.markdown-preview :deep(h3) {
  font-size: 1.25rem;
}

.markdown-preview :deep(p) {
  margin: 1rem 0;
}

.markdown-preview :deep(code) {
  background-color: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
}

.markdown-preview :deep(pre) {
  background-color: #282c34;
  color: #abb2bf;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}

.markdown-preview :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

.markdown-preview :deep(blockquote) {
  border-left: 4px solid #007bff;
  margin: 1rem 0;
  padding-left: 1rem;
  color: #6c757d;
  font-style: italic;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 1.5rem;
}

.markdown-preview :deep(li) {
  margin: 0.5rem 0;
}

.markdown-preview :deep(a) {
  color: #007bff;
  text-decoration: none;
}

.markdown-preview :deep(a:hover) {
  text-decoration: underline;
}

.markdown-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid #dee2e6;
  padding: 8px 12px;
  text-align: left;
}

.markdown-preview :deep(th) {
  background-color: #f8f9fa;
  font-weight: 600;
}

.empty-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: #6c757d;
}

.empty-editor h2 {
  margin: 0 0 8px 0;
  color: #495057;
}

.empty-editor p {
  margin: 0;
}
</style>
