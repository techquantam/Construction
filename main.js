const { app, BrowserWindow, utilityProcess } = require('electron');
const path = require('path');
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

const cleanEnv = {};
for (const key in env) {
  if (env[key] !== undefined && env[key] !== null) {
    cleanEnv[key] = String(env[key]);
  }
}

let logPath = null;
function logToFile(msg) {
  if (!logPath) {
    try {
      logPath = path.join(app.getPath('userData'), 'app-debug.log');
    } catch (e) {
      logPath = path.join(__dirname, 'app-debug.log');
    }
  }
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (e) {}
  console.log(msg);
}

function startBackend() {
  const backendPath = path.join(__dirname, 'backend', 'dist', 'server.js');
  logToFile('Spawning backend process from path: ' + backendPath);
  
  const backupsDir = path.join(app.getPath('userData'), 'backups');
  logToFile('Backups directory: ' + backupsDir);

  // Define database path in userData
  const userDbPath = path.join(app.getPath('userData'), 'database.db');
  logToFile('Target User Database path: ' + userDbPath);

  // If database doesn't exist in userData, copy the packaged one (which has migrated data)
  if (!fs.existsSync(userDbPath)) {
    const packagedDbPath = path.join(__dirname, 'backend', 'database.db');
    logToFile('User database not found. Copying packaged database from: ' + packagedDbPath);
    try {
      if (fs.existsSync(packagedDbPath)) {
        fs.copyFileSync(packagedDbPath, userDbPath);
        logToFile('Database copied successfully to userData.');
      } else {
        logToFile('Warning: Packaged database not found at ' + packagedDbPath);
      }
    } catch (err) {
      logToFile('Error copying database: ' + err.message);
    }
  }

  // Override DATABASE_URL to point to the writable userData directory
  const dbUrl = 'file:' + userDbPath;
  logToFile('Setting DATABASE_URL for backend: ' + dbUrl);

  backendProcess = utilityProcess.fork(backendPath, [], {
    env: { ...cleanEnv, PORT: '5000', APPDATA_BACKUPS_DIR: backupsDir, DATABASE_URL: dbUrl },
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => logToFile(`[Backend stdout]: ${data.toString().trim()}`));
  backendProcess.stderr.on('data', (data) => logToFile(`[Backend stderr]: ${data.toString().trim()}`));
  backendProcess.on('exit', (code, signal) => logToFile(`[Backend exited] code: ${code}, signal: ${signal}`));
  backendProcess.on('error', (err) => logToFile(`[Backend error]: ${err.message}`));
}

function startFrontend() {
  const nextBinPath = path.join(__dirname, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next');
  logToFile('Spawning Next.js frontend process from path: ' + nextBinPath);
  frontendProcess = utilityProcess.fork(nextBinPath, ['start', '-p', '3000'], {
    cwd: path.join(__dirname, 'frontend'),
    env: cleanEnv,
    stdio: 'pipe'
  });

  frontendProcess.stdout.on('data', (data) => logToFile(`[Frontend stdout]: ${data.toString().trim()}`));
  frontendProcess.stderr.on('data', (data) => logToFile(`[Frontend stderr]: ${data.toString().trim()}`));
  frontendProcess.on('exit', (code, signal) => logToFile(`[Frontend exited] code: ${code}, signal: ${signal}`));
  frontendProcess.on('error', (err) => logToFile(`[Frontend error]: ${err.message}`));
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
      logToFile(`checkReady: backendReady=${backendReady}, frontendReady=${frontendReady}`);
      if (backendReady && frontendReady) {
        logToFile('Both servers ready! Loading URL http://localhost:3000');
        mainWindow.loadURL('http://localhost:3000');
      }
    };

    logToFile('Starting health polls...');
    pollServer('http://localhost:5000/api/health', 45000, 1000, (success) => {
      logToFile('Backend health poll result: ' + success);
      if (success) {
        backendReady = true;
        checkReady();
      } else {
        logToFile('Backend server failed to start in time.');
      }
    });

    pollServer('http://localhost:3000', 45000, 1000, (success) => {
      logToFile('Frontend health poll result: ' + success);
      if (success) {
        frontendReady = true;
        checkReady();
      } else {
        logToFile('Frontend server failed to start in time.');
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
