const { ipcRenderer } = require('electron');

const { createApp, ref, computed, onMounted, onUnmounted, nextTick } = Vue;

const app = createApp({
  setup() {
    const note = ref({
      id: '',
      title: '',
      content: '',
      color: '#FFFEF0',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    const colorOptions = ref([]);
    const showColorPicker = ref(false);
    let saveTimeout = null;
    let noteId = '';
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let windowStartX = 0;
    let windowStartY = 0;
    
    const lastSavedText = computed(() => {
      if (!note.value.updatedAt) return '未保存';
      const date = new Date(note.value.updatedAt);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 5000) return '自动保存中...';
      if (diff < 60000) return '刚刚保存';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前保存`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前保存`;
      
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    });
    
    const getQueryParam = (name) => {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    };
    
    const loadNote = async () => {
      noteId = getQueryParam('id');
      if (noteId) {
        const data = await ipcRenderer.invoke('get-note', noteId);
        if (data) {
          note.value = { ...data };
        }
      }
      
      const colors = await ipcRenderer.invoke('get-color-options');
      colorOptions.value = colors;
    };
    
    const saveNote = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      saveTimeout = setTimeout(async () => {
        await ipcRenderer.invoke('update-note', noteId, {
          title: note.value.title,
          content: note.value.content,
          color: note.value.color
        });
      }, 500);
    };
    
    const changeColor = (color) => {
      note.value.color = color;
      showColorPicker.value = false;
      saveNote();
    };
    
    const toggleColorPicker = () => {
      showColorPicker.value = !showColorPicker.value;
    };
    
    const closeColorPicker = (event) => {
      if (showColorPicker.value) {
        const picker = document.querySelector('.color-picker');
        const menuBtn = document.querySelector('.btn-menu');
        if (picker && !picker.contains(event.target) && 
            menuBtn && !menuBtn.contains(event.target)) {
          showColorPicker.value = false;
        }
      }
    };
    
    const initWindowDrag = () => {
      const titleBar = document.querySelector('.title-bar');
      if (!titleBar) return;
      
      const handleMouseDown = async (event) => {
        if (event.target.closest('.title-bar-buttons') || 
            event.target.classList.contains('title-input')) {
          return;
        }
        
        event.preventDefault();
        
        isDragging = true;
        dragStartX = event.screenX;
        dragStartY = event.screenY;
        
        const bounds = await ipcRenderer.invoke('get-note-window-bounds', noteId);
        if (bounds) {
          windowStartX = bounds.x;
          windowStartY = bounds.y;
        }
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      };
      
      const handleMouseMove = async (event) => {
        if (!isDragging) return;
        
        const deltaX = event.screenX - dragStartX;
        const deltaY = event.screenY - dragStartY;
        
        await ipcRenderer.invoke('move-note-window', noteId, deltaX, deltaY);
      };
      
      const handleMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      titleBar.addEventListener('mousedown', handleMouseDown);
      
      return () => {
        titleBar.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    };
    
    let cleanupDrag = null;
    
    const minimizeWindow = async () => {
      await ipcRenderer.invoke('minimize-note-window', noteId);
    };
    
    const closeWindow = async () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        await ipcRenderer.invoke('update-note', noteId, {
          title: note.value.title,
          content: note.value.content,
          color: note.value.color
        });
      }
      await ipcRenderer.invoke('close-note-window', noteId);
    };
    
    const editTitle = () => {
      const titleInput = document.querySelector('.title-input');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    };
    
    onMounted(() => {
      loadNote();
      document.addEventListener('click', closeColorPicker);
      cleanupDrag = initWindowDrag();
    });
    
    onUnmounted(() => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      document.removeEventListener('click', closeColorPicker);
      if (cleanupDrag) {
        cleanupDrag();
      }
    });
    
    return {
      note,
      colorOptions,
      showColorPicker,
      lastSavedText,
      saveNote,
      changeColor,
      toggleColorPicker,
      minimizeWindow,
      closeWindow,
      editTitle
    };
  }
});

app.mount('#app');
