const { ipcRenderer } = require('electron');

const { createApp, ref, onMounted, onUnmounted } = Vue;

const app = createApp({
  setup() {
    const notes = ref([]);
    const appVersion = ref('1.0.0');
    const updateStatus = ref({
      status: '',
      message: '',
      details: {}
    });
    let draggingNote = null;
    let dragOverIndex = -1;

    const loadNotes = async () => {
      const data = await ipcRenderer.invoke('get-all-notes');
      notes.value = data.sort((a, b) => b.updatedAt - a.updatedAt);
    };

    const loadAppVersion = async () => {
      const version = await ipcRenderer.invoke('get-app-version');
      appVersion.value = version;
    };

    const checkUpdates = async () => {
      updateStatus.value = {
        status: 'checking',
        message: '正在检查更新...',
        details: {}
      };
      await ipcRenderer.invoke('check-for-updates');
    };

    const downloadUpdate = async () => {
      updateStatus.value = {
        status: 'downloading',
        message: '正在下载更新...',
        details: {}
      };
      await ipcRenderer.invoke('download-update');
    };

    const installUpdate = async () => {
      await ipcRenderer.invoke('install-update');
    };

    const createNote = async () => {
      const note = await ipcRenderer.invoke('create-note', {
        title: '',
        content: ''
      });
      await loadNotes();
      await ipcRenderer.invoke('open-note-window', note.id);
    };

    const openNote = async (noteId) => {
      await ipcRenderer.invoke('open-note-window', noteId);
    };

    const deleteNote = async (noteId) => {
      if (confirm('确定要删除这个便签吗？')) {
        await ipcRenderer.invoke('delete-note', noteId);
        await loadNotes();
      }
    };

    const previewContent = (content) => {
      if (!content) return '无内容';
      return content.replace(/\s+/g, ' ').trim();
    };

    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
      
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    const getCardElement = (element) => {
      return element.closest('.note-card');
    };

    const getCardIndex = (element) => {
      const card = getCardElement(element);
      if (!card) return -1;
      const cards = document.querySelectorAll('.note-card');
      return Array.from(cards).indexOf(card);
    };

    const handleDragStart = (event, note) => {
      draggingNote = note;
      dragOverIndex = -1;
      event.dataTransfer.effectAllowed = 'move';
      
      const card = getCardElement(event.target);
      if (card) {
        card.classList.add('dragging');
        const rect = card.getBoundingClientRect();
        event.dataTransfer.setDragImage(card, rect.width / 2, rect.height / 2);
      }
    };

    const handleDragEnd = (event) => {
      const cards = document.querySelectorAll('.note-card');
      cards.forEach(card => {
        card.classList.remove('dragging');
        card.classList.remove('drag-over');
      });
      draggingNote = null;
      dragOverIndex = -1;
    };

    const handleDragOver = (event, note) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      
      if (!draggingNote || draggingNote.id === note.id) {
        return;
      }
      
      const targetCard = getCardElement(event.target);
      const targetIndex = getCardIndex(event.target);
      
      if (targetCard && targetIndex !== -1 && targetIndex !== dragOverIndex) {
        const cards = document.querySelectorAll('.note-card');
        cards.forEach(card => card.classList.remove('drag-over'));
        targetCard.classList.add('drag-over');
        dragOverIndex = targetIndex;
      }
    };

    const handleDrop = async (event, targetNote) => {
      event.preventDefault();
      
      if (!draggingNote || draggingNote.id === targetNote.id) {
        handleDragEnd(event);
        return;
      }
      
      const notesArray = [...notes.value];
      const dragIndex = notesArray.findIndex(n => n.id === draggingNote.id);
      const dropIndex = notesArray.findIndex(n => n.id === targetNote.id);
      
      if (dragIndex !== -1 && dropIndex !== -1 && dragIndex !== dropIndex) {
        const [removed] = notesArray.splice(dragIndex, 1);
        notesArray.splice(dropIndex, 0, removed);
        notes.value = notesArray;
      }
      
      handleDragEnd(event);
    };

    onMounted(() => {
      loadNotes();
      loadAppVersion();
      
      ipcRenderer.on('note-updated', () => {
        loadNotes();
      });
      
      ipcRenderer.on('update-status', (event, status) => {
        updateStatus.value = status;
      });
    });

    onUnmounted(() => {
      ipcRenderer.removeAllListeners('note-updated');
      ipcRenderer.removeAllListeners('update-status');
    });

    return {
      notes,
      appVersion,
      updateStatus,
      createNote,
      openNote,
      deleteNote,
      previewContent,
      formatDate,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDrop,
      checkUpdates,
      downloadUpdate,
      installUpdate
    };
  }
});

app.mount('#app');
