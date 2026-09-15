const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// 注册原生文件另存为处理，确保 KeePass 导出在桌面端能直接弹出标准保存对话框
ipcMain.handle('save-kdbx-file', async (event, { defaultName, arrayBufferBase64 }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 KeePass 数据库备份',
      defaultPath: defaultName || 'passwords_backup.kdbx',
      filters: [
        { name: 'KeePass 密码数据库 (*.kdbx)', extensions: ['kdbx'] },
        { name: '所有文件 (*.*)', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const buffer = Buffer.from(arrayBufferBase64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, filePath };
  } catch (err) {
    console.error('Failed to save kdbx file via electron dialog:', err);
    return { success: false, error: err.message };
  }
});

// 设置环境变量并在Electron主进程中直接运行Express服务器
// 这避免了 ELECTRON_RUN_AS_NODE 在读取 asar 包时可能遇到的文件路径问题
process.env.PORT = '3005';
process.env.NODE_ENV = 'production';
try {
  require(path.join(__dirname, 'dist', 'server.cjs'));
  console.log("Express server started within Electron main process.");
} catch (e) {
  console.error("Failed to start Express server:", e);
}

function createWindow() {
  const isWin = process.platform === 'win32';
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'build', isWin ? 'icon.ico' : 'icon.png'),
    titleBarStyle: isWin ? 'default' : 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 支持前端请求强制激活窗口焦点
  ipcMain.on('focus-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // 等待 Express 在主进程启动后加载它
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3005');
  }, 500);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
