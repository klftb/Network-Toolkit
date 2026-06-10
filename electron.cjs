const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

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
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
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
