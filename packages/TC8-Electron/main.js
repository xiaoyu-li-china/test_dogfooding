const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const store = require('./store');

let mainWindow = null;
let noteWindows = {};
let updateDownloaded = false;
let autoUpdateEnabled = true;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function setupAutoUpdater() {
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    autoUpdateEnabled = false;
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking', '正在检查更新...');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', `发现新版本 ${info.version}，是否立即下载？`);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}`,
        detail: '是否立即下载并安装更新？',
        buttons: ['立即更新', '稍后提醒'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus('not-available', `当前版本 ${info.version} 已是最新`);
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus('error', `更新检查失败: ${err.message}`);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    const speed = formatBytes(progressObj.bytesPerSecond);
    const transferred = formatBytes(progressObj.transferred);
    const total = formatBytes(progressObj.total);
    
    sendUpdateStatus('downloading', `下载中 ${percent}% (${speed}/s)`, {
      percent,
      speed,
      transferred,
      total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    sendUpdateStatus('downloaded', `版本 ${info.version} 已下载完成，是否立即安装？`);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '更新下载完成',
        message: '新版本已下载完成',
        detail: '点击确定将重启应用并安装更新',
        buttons: ['立即安装', '稍后安装'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          quitAndInstallUpdate();
        }
      });
    }
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function sendUpdateStatus(status, message, details = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', {
      status,
      message,
      details
    });
  }
}

function checkForUpdates() {
  if (!autoUpdateEnabled) {
    sendUpdateStatus('disabled', '开发模式下自动更新已禁用');
    return;
  }
  autoUpdater.checkForUpdates();
}

function quitAndInstallUpdate() {
  autoUpdater.quitAndInstall();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: '便签管理'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/main/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    Object.values(noteWindows).forEach(win => {
      if (win && !win.isDestroyed()) {
        win.close();
      }
    });
    noteWindows = {};
  });

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      checkForUpdates();
    }, 3000);
  });
}

function createNoteWindow(noteId) {
  if (noteWindows[noteId]) {
    noteWindows[noteId].show();
    noteWindows[noteId].focus();
    return;
  }

  const note = store.getNoteById(noteId);
  if (!note) return;

  const win = new BrowserWindow({
    width: note.width || 400,
    height: note.height || 300,
    x: note.x,
    y: note.y,
    minWidth: 250,
    minHeight: 200,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: note.title || '便签'
  });

  noteWindows[noteId] = win;

  win.loadFile(path.join(__dirname, 'renderer/note/index.html'), {
    query: { id: noteId }
  });

  win.on('closed', () => {
    const bounds = win.getBounds();
    store.updateNote(noteId, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    delete noteWindows[noteId];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('note-updated');
    }
  });
}

app.whenReady().then(() => {
  setupAutoUpdater();
  store.init();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (updateDownloaded) {
    dialog.showMessageBox({
      type: 'info',
      title: '更新可用',
      message: '有新版本已下载完成',
      detail: '是否在退出时安装更新？',
      buttons: ['现在安装并退出', '仅退出'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        quitAndInstallUpdate();
      } else {
        app.quit();
      }
    });
  } else {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});

ipcMain.handle('get-all-notes', () => {
  return store.getAllNotes();
});

ipcMain.handle('get-note', (event, noteId) => {
  return store.getNoteById(noteId);
});

ipcMain.handle('create-note', (event, noteData) => {
  const note = store.createNote(noteData);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('note-updated');
  }
  return note;
});

ipcMain.handle('update-note', (event, noteId, noteData) => {
  const note = store.updateNote(noteId, noteData);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('note-updated');
  }
  if (noteWindows[noteId] && !noteWindows[noteId].isDestroyed()) {
    noteWindows[noteId].setTitle(noteData.title || '便签');
  }
  return note;
});

ipcMain.handle('delete-note', (event, noteId) => {
  store.deleteNote(noteId);
  if (noteWindows[noteId] && !noteWindows[noteId].isDestroyed()) {
    noteWindows[noteId].close();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('note-updated');
  }
  return true;
});

ipcMain.handle('open-note-window', (event, noteId) => {
  createNoteWindow(noteId);
  return true;
});

ipcMain.handle('close-note-window', (event, noteId) => {
  if (noteWindows[noteId] && !noteWindows[noteId].isDestroyed()) {
    noteWindows[noteId].close();
  }
  return true;
});

ipcMain.handle('minimize-note-window', (event, noteId) => {
  if (noteWindows[noteId] && !noteWindows[noteId].isDestroyed()) {
    noteWindows[noteId].minimize();
  }
  return true;
});

ipcMain.handle('move-note-window', (event, noteId, deltaX, deltaY) => {
  if (noteWindows[noteId] && !noteWindows[noteId].isDestroyed()) {
    const win = noteWindows[noteId];
    const bounds = win.getBounds();
    win.setBounds({
      x: bounds.x + deltaX,
      y: bounds.y + deltaY
    });
  }
  return true;
});

ipcMain.handle('get-note-window-bounds', (event, noteId) => {
  if (noteWindows[noteId] && !noteWindows[noteId].isDestroyed()) {
    const win = noteWindows[noteId];
    return win.getBounds();
  }
  return null;
});

ipcMain.handle('get-color-options', () => {
  return [
    '#FFFEF0',
    '#FFF8DC',
    '#FFEFD5',
    '#FFE4B5',
    '#FFDAB9',
    '#E6E6FA',
    '#F0FFF0',
    '#F0F8FF',
    '#FFF0F5',
    '#F5F5DC'
  ];
});

ipcMain.handle('check-for-updates', () => {
  checkForUpdates();
  return true;
});

ipcMain.handle('download-update', () => {
  if (autoUpdateEnabled) {
    autoUpdater.downloadUpdate();
    return true;
  }
  return false;
});

ipcMain.handle('install-update', () => {
  if (updateDownloaded) {
    quitAndInstallUpdate();
    return true;
  }
  return false;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-update-status', () => {
  return {
    updateDownloaded,
    autoUpdateEnabled,
    version: app.getVersion()
  };
});
