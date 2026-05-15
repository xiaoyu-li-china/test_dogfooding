const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let recordingStartTime = null;
let recordedSegments = [];

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    title: '视频录制应用 - 修复最后一帧丢失和内存溢出',
    backgroundColor: '#667eea',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('应用加载完成');
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('recording:start', async (event, options) => {
  console.log('开始录制', options);
  recordingStartTime = Date.now();
  recordedSegments = [];
  return { success: true, timestamp: recordingStartTime };
});

ipcMain.handle('recording:stop', async (event) => {
  console.log('停止录制');
  const duration = Date.now() - recordingStartTime;
  return { 
    success: true, 
    duration,
    segments: recordedSegments.length,
    totalSize: recordedSegments.reduce((sum, seg) => sum + seg.size, 0)
  };
});

ipcMain.handle('recording:segment-saved', async (event, segmentData) => {
  recordedSegments.push({
    ...segmentData,
    savedAt: new Date().toISOString()
  });
  console.log(`分段已保存: ${segmentData.index}, 大小: ${(segmentData.size / 1024 / 1024).toFixed(2)} MB`);
  return { success: true, segmentIndex: segmentData.index };
});

ipcMain.handle('file:save-dialog', async (event, defaultFilename) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存视频文件',
    defaultPath: defaultFilename || `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`,
    filters: [
      { name: 'WebM Video', extensions: ['webm'] },
      { name: 'MP4 Video', extensions: ['mp4'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('file:save', async (event, filePath, data) => {
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
    console.log(`文件已保存: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('app:get-info', async () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome
  };
});

ipcMain.on('recording:error', (event, error) => {
  console.error('录制错误:', error);
  dialog.showErrorBox('录制错误', error.message || '发生未知错误');
});

module.exports = { app, mainWindow };
