<script setup>
defineProps({
  notes: {
    type: Array,
    required: true,
  },
  selectedId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['select', 'create', 'delete'])

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleDelete(e, id) {
  e.stopPropagation()
  if (confirm('确定要删除这篇笔记吗？')) {
    emit('delete', id)
  }
}
</script>

<template>
  <div class="note-list">
    <div class="list-header">
      <h2>笔记列表</h2>
      <button class="btn-create" @click="emit('create')">
        + 新建笔记
      </button>
    </div>

    <div class="notes-container">
      <div v-if="notes.length === 0" class="empty-state">
        <p>暂无笔记</p>
        <p class="hint">点击上方按钮创建第一篇笔记</p>
      </div>

      <div
        v-for="note in notes"
        :key="note.id"
        class="note-item"
        :class="{ active: note.id === selectedId }"
        @click="emit('select', note)"
      >
        <div class="note-header">
          <h3 class="note-title">{{ note.title || '无标题' }}</h3>
          <button
            class="btn-delete"
            @click="handleDelete($event, note.id)"
            title="删除笔记"
          >
            ×
          </button>
        </div>
        <p class="note-preview">
          {{ note.content.substring(0, 100) }}{{ note.content.length > 100 ? '...' : '' }}
        </p>
        <p class="note-meta">
          更新于: {{ formatDate(note.updated_at) }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.note-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f8f9fa;
  border-right: 1px solid #e9ecef;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  background-color: #fff;
}

.list-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.btn-create {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.btn-create:hover {
  background-color: #0056b3;
}

.notes-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-state .hint {
  font-size: 0.875rem;
  margin-top: 8px;
}

.note-item {
  padding: 12px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.note-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.note-item.active {
  border-color: #007bff;
  background-color: #e7f3ff;
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.note-title {
  margin: 0 0 8px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-delete {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: #dc3545;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.note-item:hover .btn-delete {
  opacity: 1;
}

.btn-delete:hover {
  color: #a71d2a;
}

.note-preview {
  margin: 0 0 8px 0;
  font-size: 0.875rem;
  color: #6c757d;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-meta {
  margin: 0;
  font-size: 0.75rem;
  color: #adb5bd;
}
</style>
