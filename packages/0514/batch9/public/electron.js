const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadURL(
    app.isPackaged
      ? `file://${path.join(__dirname, '../build/index.html')}`
      : 'http://localhost:3000'
  );

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.filePaths[0];
});

ipcMain.handle('scan-music', async (event, folderPath) => {
  const musicFiles = [];
  
  const scanDirectory = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.mp3' || ext === '.flac') {
          musicFiles.push({
            name: path.basename(file, ext),
            path: fullPath,
            extension: ext,
          });
        }
      }
    });
  };

  try {
    scanDirectory(folderPath);
    return musicFiles;
  } catch (error) {
    return [];
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  return fs.promises.readFile(filePath);
});

ipcMain.handle('read-lyrics', async (event, filePath) => {
  try {
    const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
    if (fs.existsSync(lrcPath)) {
      return fs.promises.readFile(lrcPath, 'utf-8');
    }
    return null;
  } catch (error) {
    return null;
  }
});
