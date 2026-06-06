const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let backendProcess;
let frontendProcess;

// Load Env from backend/.env
function loadEnv() {
  const envVars = { ...process.env };
  const dotenvPath = path.join(__dirname, 'backend', '.env');
  if (fs.existsSync(dotenvPath)) {
    const content = fs.readFileSync(dotenvPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
        if (key && !key.startsWith('#')) {
          envVars[key] = val;
        }
      }
    });
  }
  return envVars;
}

const env = loadEnv();

function startBackend() {
  const backendPath = path.join(__dirname, 'backend', 'dist', 'server.js');
  console.log('Spawning backend process...', backendPath);
  backendProcess = fork(backendPath, [], {
    env: { ...env, PORT: 5000 },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  backendProcess.stdout.on('data', (data) => console.log(`[Backend stdout]: ${data}`));
  backendProcess.stderr.on('data', (data) => console.error(`[Backend stderr]: ${data}`));
}

function startFrontend() {
  const nextBinPath = path.join(__dirname, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next');
  console.log('Spawning Next.js frontend process...', nextBinPath);
  frontendProcess = fork(nextBinPath, ['start', '-p', '3000'], {
    cwd: path.join(__dirname, 'frontend'),
    env: { ...env },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  frontendProcess.stdout.on('data', (data) => console.log(`[Frontend stdout]: ${data}`));
  frontendProcess.stderr.on('data', (data) => console.error(`[Frontend stderr]: ${data}`));
}

function pollServer(url, timeoutMs, intervalMs, callback) {
  const start = Date.now();
  const interval = setInterval(() => {
    http.get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        clearInterval(interval);
        callback(true);
      }
    }).on('error', () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        callback(false);
      }
    });
  }, intervalMs);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Construction ERP',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  if (!app.isPackaged) {
    // Development mode - directly loads the dev server
    mainWindow.loadURL('http://localhost:3000');
    // Open devtools
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - wait for background servers to be healthy
    let backendReady = false;
    let frontendReady = false;

    const checkReady = () => {
      if (backendReady && frontendReady) {
        mainWindow.loadURL('http://localhost:3000');
      }
    };

    pollServer('http://localhost:5000/api/health', 45000, 1000, (success) => {
      if (success) {
        backendReady = true;
        checkReady();
      } else {
        console.error('Backend server failed to start in time.');
      }
    });

    pollServer('http://localhost:3000', 45000, 1000, (success) => {
      if (success) {
        frontendReady = true;
        checkReady();
      } else {
        console.error('Frontend server failed to start in time.');
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  if (app.isPackaged) {
    startBackend();
    startFrontend();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    console.log('Terminating backend process...');
    backendProcess.kill();
  }
  if (frontendProcess) {
    console.log('Terminating frontend process...');
    frontendProcess.kill();
  }
});
