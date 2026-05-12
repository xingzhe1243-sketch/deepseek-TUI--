const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');
const sessionsPath = path.join(userDataPath, 'sessions');
const projectsPath = path.join(userDataPath, 'projects');
const templatesPath = path.join(userDataPath, 'templates');
const snapshotsPath = path.join(userDataPath, 'snapshots');

let mainWindow, chatWindow, terminalWindow;
let agentWindows = {};
let tray;
let isQuitting = false;
let currentRequest = null;
let activeTerminals = {};

let projectState = {
  rootDir: null, files: [], tasks: [], pipeline: [], recentProjects: []
};

// ============ 配置 ============
function loadConfig() {
  try { if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch (e) {}
  return { apiKey: '', apiBase: 'https://api.deepseek.com', model: 'deepseek-chat', systemPrompt: '', temperature: 0.7, darkMode: false, templates: [], quickActions: [] };
}
function saveConfig(c) {
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(c, null, 2), 'utf-8');
}

// ============ 会话 ============
function loadSessionList() {
  const result = [];
  try {
    if (!fs.existsSync(sessionsPath)) fs.mkdirSync(sessionsPath, { recursive: true });
    const files = fs.readdirSync(sessionsPath);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const fp = path.join(sessionsPath, f);
        const d = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        let title = d.title || '新对话';
        if (!title || title === '新对话' || title === 'DeepSeek Chat') {
          const msgs = d.messages || [];
          const um = msgs.filter(m => m.role === 'user');
          const am = msgs.filter(m => m.role === 'assistant');
          const q = um[0]?.content?.replace(/\n+/g, ' ').slice(0, 20) || '';
          const a = am[am.length - 1]?.content?.replace(/\n+/g, ' ').slice(0, 20) || '';
          if (q && a) title = q + ' · ' + a;
          else if (q) title = q;
          if (title.length > 50) title = title.slice(0, 47) + '...';
        }
        result.push({ id: f.replace('.json', ''), title, createdAt: d.createdAt, updatedAt: d.updatedAt || d.createdAt, pinned: !!d.pinned, tags: d.tags || [] });
      } catch(e) {}
    }
  } catch(e) {}
  result.sort((a, b) => {
    if (b.pinned !== a.pinned) return b.pinned ? 1 : -1;
    return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
  });
  return result;
}
function saveSession(id, d) {
  if (!fs.existsSync(sessionsPath)) fs.mkdirSync(sessionsPath, { recursive: true });
  const fp = path.join(sessionsPath, `${id}.json`);
  const existing = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : {};
  fs.writeFileSync(fp, JSON.stringify({ ...existing, ...d }, null, 2), 'utf-8');
}
function deleteSession(id) { const fp = path.join(sessionsPath, `${id}.json`); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
function renameSession(id, title) { const fp = path.join(sessionsPath, `${id}.json`); if (fs.existsSync(fp)) { const d = JSON.parse(fs.readFileSync(fp, 'utf-8')); d.title = title; fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf-8'); return true; } return false; }

// ============ 项目 ============
function scanDirectory(dirPath, depth = 3) {
  const result = []; if (depth <= 0) return result;
  try {
    for (const e of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
      const full = path.join(dirPath, e.name);
      if (e.isDirectory()) result.push({ name: e.name, path: full, type: 'dir', children: scanDirectory(full, depth - 1) });
      else { const s = fs.statSync(full); result.push({ name: e.name, path: full, type: 'file', size: s.size, ext: path.extname(e.name), mtime: s.mtimeMs }); }
    }
  } catch (e) {}
  return result;
}

function readProjectFile(fp) {
  try { return { content: fs.readFileSync(fp, 'utf-8'), path: fp, name: path.basename(fp) }; }
  catch (e) { return { error: e.message }; }
}
function saveProjectFile(fp, content) {
  try { const d = path.dirname(fp); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(fp, content, 'utf-8'); return true; }
  catch (e) { return { error: e.message }; }
}
function saveProject() { if (!fs.existsSync(projectsPath)) fs.mkdirSync(projectsPath, { recursive: true }); fs.writeFileSync(path.join(projectsPath, 'state.json'), JSON.stringify(projectState, null, 2), 'utf-8'); }
function loadProject() { try { const fp = path.join(projectsPath, 'state.json'); if (fs.existsSync(fp)) projectState = JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch (e) {} }

function addRecentProject(dir) {
  projectState.recentProjects = projectState.recentProjects.filter(p => p.path !== dir);
  projectState.recentProjects.unshift({ path: dir, name: path.basename(dir), time: Date.now() });
  if (projectState.recentProjects.length > 10) projectState.recentProjects = projectState.recentProjects.slice(0, 10);
  saveProject();
}

// ============ Git ============
function runGit(dir, args) {
  return new Promise((resolve) => {
    exec(`git ${args.join(' ')}`, { cwd: dir, timeout: 10000 }, (err, stdout, stderr) => {
      resolve({ error: err ? (stderr || err.message) : null, output: stdout.trim() });
    });
  });
}

async function getGitStatus(dir) {
  const [branch, status, log] = await Promise.all([
    runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(dir, ['status', '--porcelain']),
    runGit(dir, ['log', '--oneline', '-10'])
  ]);
  const files = {};
  if (status.output) {
    for (const line of status.output.split('\n')) {
      if (!line) continue;
      const code = line.slice(0, 2).trim();
      const file = line.slice(3).trim();
      files[file] = code;
    }
  }
  return { branch: branch.output, changes: files, log: log.output ? log.output.split('\n') : [] };
}

// ============ 任务 & 流水线 ============
function addTask(task) {
  const t = { id: Date.now().toString(), title: task.title, description: task.description || '', status: 'pending', assignedTo: null, result: null, pipeline: [], tags: task.tags || [], createdAt: Date.now(), startedAt: null, completedAt: null };
  projectState.tasks.push(t); saveProject(); broadcastAll('project-state', projectState); return t;
}
function updateTask(id, updates) {
  const t = projectState.tasks.find(t => t.id === id);
  if (t) {
    if (updates.status === 'in_progress' && !t.startedAt) updates.startedAt = Date.now();
    if (updates.status === 'done') updates.completedAt = Date.now();
    Object.assign(t, updates); saveProject(); broadcastAll('project-state', projectState);
  } return t;
}
function addPipelineStep(taskId, stage, input) {
  const step = { id: Date.now().toString(), taskId, stage, input, output: null, status: 'pending', agentId: null, createdAt: Date.now(), startedAt: null, completedAt: null };
  const task = projectState.tasks.find(t => t.id === taskId);
  if (task) task.pipeline.push(step);
  projectState.pipeline.push(step); saveProject(); broadcastAll('project-state', projectState); return step;
}
function updatePipelineStep(id, updates) {
  const step = projectState.pipeline.find(s => s.id === id);
  if (step) {
    if (updates.status === 'in_progress' && !step.startedAt) updates.startedAt = Date.now();
    if (updates.status === 'done' && !step.completedAt) updates.completedAt = Date.now();
    Object.assign(step, updates);
    const task = projectState.tasks.find(t => t.id === step.taskId);
    if (task) { const tp = task.pipeline.find(s => s.id === id); if (tp) Object.assign(tp, updates); }
    saveProject(); broadcastAll('project-state', projectState);
  } return step;
}

// ============ 模板 & 快照 ============
function loadTemplates() {
  try {
    if (!fs.existsSync(templatesPath)) fs.mkdirSync(templatesPath, { recursive: true });
    return fs.readdirSync(templatesPath).filter(f => f.endsWith('.json')).map(f => {
      return JSON.parse(fs.readFileSync(path.join(templatesPath, f), 'utf-8'));
    });
  } catch (e) { return []; }
}
function saveTemplate(t) {
  if (!fs.existsSync(templatesPath)) fs.mkdirSync(templatesPath, { recursive: true });
  t.id = t.id || Date.now().toString();
  fs.writeFileSync(path.join(templatesPath, `${t.id}.json`), JSON.stringify(t, null, 2), 'utf-8');
  return t;
}
function deleteTemplate(id) {
  const fp = path.join(templatesPath, `${id}.json`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

function createSnapshot(name) {
  if (!fs.existsSync(snapshotsPath)) fs.mkdirSync(snapshotsPath, { recursive: true });
  const snap = { id: Date.now().toString(), name, projectState: JSON.parse(JSON.stringify(projectState)), createdAt: Date.now() };
  fs.writeFileSync(path.join(snapshotsPath, `${snap.id}.json`), JSON.stringify(snap, null, 2), 'utf-8');
  return snap;
}
function listSnapshots() {
  try {
    if (!fs.existsSync(snapshotsPath)) return [];
    return fs.readdirSync(snapshotsPath).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(snapshotsPath, f), 'utf-8'))).sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) { return []; }
}
function restoreSnapshot(id) {
  const fp = path.join(snapshotsPath, `${id}.json`);
  if (fs.existsSync(fp)) {
    const snap = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    projectState = snap.projectState;
    saveProject(); broadcastAll('project-state', projectState);
    return true;
  } return false;
}

// ============ 终端 ============
function createTerminal(cwd) {
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
  const proc = spawn(shell, [], { cwd: cwd || projectState.rootDir || userDataPath, env: process.env });
  const termId = Date.now().toString();
  activeTerminals[termId] = proc;

  if (terminalWindow && !terminalWindow.isDestroyed()) {
    proc.stdout.on('data', (d) => terminalWindow.webContents.send('term-data', { id: termId, data: d.toString() }));
    proc.stderr.on('data', (d) => terminalWindow.webContents.send('term-data', { id: termId, data: d.toString() }));
  }
  proc.on('close', () => { delete activeTerminals[termId]; if (terminalWindow && !terminalWindow.isDestroyed()) terminalWindow.webContents.send('term-closed', termId); });
  return termId;
}

// ============ 窗口 ============
function getWinConfig(role) {
  const m = { dashboard: [1200, 800, 'DeepSeek 工作台'], chat: [1100, 750, 'DeepSeek Chat'], terminal: [900, 550, '终端'], coder: [1000, 700, '🧑‍💻 AI 编码'], reviewer: [900, 650, '🔍 代码审查'], scorer: [800, 600, '📊 代码评分'], architect: [1000, 700, '🏗️ 架构设计'] };
  const [w, h, t] = m[role] || [900, 600, role];
  return { width: w, height: h, minWidth: 600, minHeight: 400, title: t };
}

function createAgentWindow(role, ctx) {
  const cfg = getWinConfig(role);
  const winId = `${role}-${Date.now()}`;
  const win = new BrowserWindow({ ...cfg, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  agentWindows[winId] = { win, role, taskContext: ctx, createdAt: Date.now() };
  win.loadFile(path.join(__dirname, 'renderer', 'agent.html'), { hash: encodeURIComponent(JSON.stringify({ role, taskContext: ctx, winId })) });
  win.on('closed', () => { delete agentWindows[winId]; broadcastAll('agent-closed', { winId, role }); });
  win.webContents.on('did-finish-load', () => win.webContents.send('agent-init', { role, taskContext: ctx, winId }));
  return { winId, role };
}

function broadcastAll(ch, data) {
  for (const w of [mainWindow, chatWindow, terminalWindow, ...Object.values(agentWindows).map(a => a.win)]) {
    if (w && !w.isDestroyed()) w.webContents.send(ch, data);
  }
}
function sendToWindow(wid, ch, data) {
  const a = agentWindows[wid];
  if (a && a.win && !a.win.isDestroyed()) a.win.webContents.send(ch, data);
}

// ============ 托盘 & 快捷键 ============
function createTrayIcon() {
  const size = 16, canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, d = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
    if (d < 6) { canvas[i] = 0x07; canvas[i + 1] = 0xc1; canvas[i + 2] = 0x60; canvas[i + 3] = 255; }
    else if (d < 7) { canvas[i] = 0x06; canvas[i + 1] = 0xad; canvas[i + 2] = 0x56; canvas[i + 3] = 255; }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}
function createTray() {
  tray = new Tray(createTrayIcon()); tray.setToolTip('DeepSeek 工作台');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '聊天', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '工作台', click: () => { if (chatWindow) { chatWindow.show(); chatWindow.focus(); } } },
    { label: '终端', click: () => { if (terminalWindow) { terminalWindow.show(); terminalWindow.focus(); } } },
    { type: 'separator' }, { label: '退出', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', () => { const w = mainWindow || chatWindow; if (w) { w.isVisible() ? w.hide() : w.show(); if (w.isVisible()) w.focus(); } });
}
function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+N', () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.webContents.send('shortcut', 'new-chat'); });
  globalShortcut.register('CommandOrControl+Shift+D', () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.webContents.send('shortcut', 'toggle-dark-mode'); });
}

// ============ 主窗口 ============
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 750, minWidth: 800, minHeight: 600,
    title: 'DeepSeek Chat',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('enter-full-screen', () => {
    globalShortcut.register('Escape', () => { mainWindow.setFullScreen(false); });
  });
  mainWindow.on('leave-full-screen', () => {
    globalShortcut.unregister('Escape');
  });
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function openWorkspace() {
  if (!chatWindow || chatWindow.isDestroyed()) {
    chatWindow = new BrowserWindow({
      width: 1200, height: 800, minWidth: 900, minHeight: 600,
      title: 'DeepSeek 工作台',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
    });
    chatWindow.loadFile(path.join(__dirname, 'renderer', 'workspace.html'));
    chatWindow.on('close', (e) => {
      if (!isQuitting) { e.preventDefault(); chatWindow.hide(); }
    });
  } else {
    chatWindow.show();
    chatWindow.focus();
  }
  return true;
}

// ============ IPC ============
function registerIPC() {
  ipcMain.handle('get-config', () => loadConfig());
  ipcMain.handle('save-config', (_, c) => { saveConfig(c); return true; });
  ipcMain.handle('get-dark-mode', () => loadConfig().darkMode || false);
  ipcMain.handle('set-dark-mode', (_, d) => { const c = loadConfig(); c.darkMode = d; saveConfig(c); return true; });

  ipcMain.handle('list-sessions', () => loadSessionList());
  ipcMain.handle('save-session', (_, id, d) => { saveSession(id, d); return true; });
  ipcMain.handle('delete-session', (_, id) => { deleteSession(id); return true; });
  ipcMain.handle('rename-session', (_, id, t) => renameSession(id, t));
  ipcMain.handle('pin-session', (_, id) => {
    const fp = path.join(sessionsPath, `${id}.json`);
    if (fs.existsSync(fp)) { const d = JSON.parse(fs.readFileSync(fp, 'utf-8')); d.pinned = !d.pinned; fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf-8'); return d.pinned; }
    return false;
  });
  ipcMain.handle('load-session', (_, id) => { try { const p = path.join(sessionsPath, `${id}.json`); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (e) {} return null; });
  ipcMain.handle('tag-session', (_, id, tags) => { const fp = path.join(sessionsPath, `${id}.json`); if (fs.existsSync(fp)) { const d = JSON.parse(fs.readFileSync(fp, 'utf-8')); d.tags = tags; fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf-8'); return true; } return false; });

  ipcMain.handle('pick-project-dir', async () => { const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] }); if (r.canceled) return null; projectState.rootDir = r.filePaths[0]; projectState.files = scanDirectory(projectState.rootDir); addRecentProject(projectState.rootDir); saveProject(); broadcastAll('project-state', projectState); return { rootDir: projectState.rootDir, files: projectState.files }; });
  ipcMain.handle('get-project-state', () => projectState);
  ipcMain.handle('read-project-file', (_, fp) => readProjectFile(fp));
  ipcMain.handle('save-project-file', (_, fp, c) => saveProjectFile(fp, c));
  ipcMain.handle('scan-directory', (_, d) => scanDirectory(d));
  ipcMain.handle('read-file', async (_, fp) => { try { return { name: path.basename(fp), content: fs.readFileSync(fp, 'utf-8'), ext: path.extname(fp).toLowerCase(), size: fs.statSync(fp).size, path: fp }; } catch (e) { return { error: e.message }; } });
  ipcMain.handle('pick-files', async () => { const r = await dialog.showOpenDialog(mainWindow || chatWindow, { properties: ['openFile', 'multiSelections'] }); return r.canceled ? [] : r.filePaths; });

  // Git
  ipcMain.handle('git-status', async (_, dir) => getGitStatus(dir || projectState.rootDir));
  ipcMain.handle('git-run', async (_, dir, args) => runGit(dir || projectState.rootDir, args));
  ipcMain.handle('git-diff', async (_, dir, file) => runGit(dir || projectState.rootDir, ['diff', file]));
  ipcMain.handle('git-commit', async (_, dir, msg) => {
    await runGit(dir || projectState.rootDir, ['add', '.']);
    return runGit(dir || projectState.rootDir, ['commit', '-m', msg]);
  });
  ipcMain.handle('git-push', async (_, dir) => runGit(dir || projectState.rootDir, ['push']));
  ipcMain.handle('git-pull', async (_, dir) => runGit(dir || projectState.rootDir, ['pull']));
  ipcMain.handle('git-fetch', async (_, dir) => runGit(dir || projectState.rootDir, ['fetch']));
  ipcMain.handle('git-clone', async (_, url, targetDir) => {
    const dest = targetDir || path.join(projectState.rootDir || userDataPath, path.basename(url).replace('.git', ''));
    return new Promise(resolve => {
      exec(`git clone "${url}" "${dest}"`, { timeout: 60000 }, (err, stdout, stderr) => {
        resolve({ error: err ? (stderr || err.message) : null, output: stdout.trim() });
      });
    });
  });

  // 任务 & 流水线
  ipcMain.handle('add-task', (_, t) => addTask(t));
  ipcMain.handle('update-task', (_, id, u) => updateTask(id, u));
  ipcMain.handle('delete-task', (_, id) => { projectState.tasks = projectState.tasks.filter(t => t.id !== id); projectState.pipeline = projectState.pipeline.filter(s => s.taskId !== id); saveProject(); broadcastAll('project-state', projectState); return true; });
  ipcMain.handle('batch-task-action', (_, ids, action) => { for (const id of ids) { if (action === 'delete') updateTask(id, { status: '__deleted' }); else updateTask(id, { status: action }); } projectState.tasks = projectState.tasks.filter(t => t.status !== '__deleted'); saveProject(); broadcastAll('project-state', projectState); return true; });
  ipcMain.handle('add-pipeline-step', (_, tid, stage, input) => addPipelineStep(tid, stage, input));
  ipcMain.handle('update-pipeline-step', (_, sid, u) => updatePipelineStep(sid, u));

  // 代理
  ipcMain.handle('open-agent', (_, role, ctx) => createAgentWindow(role, ctx));
  ipcMain.handle('get-agent-windows', () => Object.entries(agentWindows).map(([id, a]) => ({ id, role: a.role, taskContext: a.taskContext, createdAt: a.createdAt })));
  ipcMain.handle('close-agent', (_, wid) => { const a = agentWindows[wid]; if (a) a.win.close(); return true; });
  ipcMain.handle('broadcast', (_, ch, d) => { broadcastAll(ch, d); return true; });
  ipcMain.handle('send-to-window', (_, wid, ch, d) => { sendToWindow(wid, ch, d); return true; });

  // 终端
  ipcMain.handle('open-terminal', () => {
    if (!terminalWindow || terminalWindow.isDestroyed()) {
      terminalWindow = new BrowserWindow({ width: 900, height: 550, minWidth: 600, minHeight: 300, title: '终端', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
      terminalWindow.loadFile(path.join(__dirname, 'renderer', 'terminal.html'));
      terminalWindow.on('close', (e) => { if (!isQuitting) { e.preventDefault(); terminalWindow.hide(); } });
    } else { terminalWindow.show(); terminalWindow.focus(); }
    return true;
  });
  ipcMain.handle('term-create', (_, cwd) => createTerminal(cwd));
  ipcMain.handle('term-write', (_, id, data) => { const p = activeTerminals[id]; if (p) p.stdin.write(data); return true; });
  ipcMain.handle('term-resize', (_, id, cols, rows) => { const p = activeTerminals[id]; if (p && p.stdout) { p.stdout.columns = cols; p.stdout.rows = rows; } return true; });
  ipcMain.handle('term-kill', (_, id) => { const p = activeTerminals[id]; if (p) p.kill(); return true; });

  // 模板
  ipcMain.handle('list-templates', () => loadTemplates());
  ipcMain.handle('save-template', (_, t) => saveTemplate(t));
  ipcMain.handle('delete-template', (_, id) => { deleteTemplate(id); return true; });

  // 快照
  ipcMain.handle('create-snapshot', (_, name) => createSnapshot(name));
  ipcMain.handle('list-snapshots', () => listSnapshots());
  ipcMain.handle('restore-snapshot', (_, id) => restoreSnapshot(id));

  // 聊天窗口就是主窗口，直接显示
  ipcMain.handle('open-chat', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    return true;
  });

  // 工作台作为独立窗口
  ipcMain.handle('open-workspace', () => openWorkspace());

  // 工具定义
  const DESKTOP = path.join(require('os').homedir(), 'Desktop');
  const TOOLS = [{
    type: 'function', function: {
      name: 'create_file', description: '【绝对不要在用户未明确说出"保存""创建文件""存到""写入"且指定路径时调用】创建文件。当且仅当用户同时说出动作+位置(如"保存到桌面""写到D盘")才能用。不知道路径就反问用户。',
      parameters: { type: 'object', properties: { path: { type: 'string', description: '必须是用户亲口说出的完整路径，绝对不要猜。没听到路径就问用户"要保存到哪个位置？"' }, content: { type: 'string', description: '文件内容' } }, required: ['path', 'content'] }
    }
  }, {
    type: 'function', function: {
      name: 'run_command', description: '【仅在用户明确要求"运行""执行命令""安装"时使用】执行终端命令。',
      parameters: { type: 'object', properties: { command: { type: 'string', description: '用户要求的命令' } }, required: ['command'] }
    }
  }, {
    type: 'function', function: {
      name: 'run_admin', description: '【仅在用户要求管理员权限操作时使用】以管理员执行命令，弹出UAC窗口。',
      parameters: { type: 'object', properties: { command: { type: 'string', description: '需要管理员权限的命令' } }, required: ['command'] }
    }
  }, {
    type: 'function', function: {
      name: 'read_file', description: '读取文件内容。可用于审查代码、分析文件。用户说"审查""看看""检查"某文件时调用。',
      parameters: { type: 'object', properties: { path: { type: 'string', description: '用户指定的文件路径' } }, required: ['path'] }
    }
  }, {
    type: 'function', function: {
      name: 'list_files', description: '列出目录下的文件。用户说"看看有什么文件""列出"时调用。',
      parameters: { type: 'object', properties: { dir: { type: 'string', description: '目录路径，默认桌面: ' + DESKTOP } } }
    }
  }];

  // 执行工具
  async function executeTool(name, args) {
    try {
      if (name === 'create_file') { 
        try {
          const dir = path.dirname(args.path); 
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); 
          fs.writeFileSync(args.path, args.content, 'utf-8'); 
          return '文件已创建: ' + args.path + ' (' + args.content.length + ' 字节)';
        } catch(e) {
          if (e.code === 'EPERM' || e.code === 'EACCES') {
            return '权限不足: ' + e.message + '。请使用 run_admin 工具以管理员身份创建文件，或尝试保存到 ' + require('os').homedir() + '\\Desktop\\ 路径。当前尝试路径: ' + args.path;
          }
          throw e;
        }
      }
      if (name === 'read_file') { if (!fs.existsSync(args.path)) return '文件不存在: ' + args.path; const c = fs.readFileSync(args.path, 'utf-8'); return c.slice(0, 10000); }
      if (name === 'list_files') { const d = args.dir || DESKTOP; if (!fs.existsSync(d)) return '目录不存在: ' + d; const fsList = fs.readdirSync(d).slice(0, 50); return fsList.map(f => { try { const s = fs.statSync(path.join(d, f)); return f + (s.isDirectory() ? '/' : '') + ' (' + s.size + 'B)'; } catch(e) { return f; } }).join('\n') || '(空目录)'; }
      if (name === 'run_command') { 
        const cmd = 'chcp 65001 >nul && ' + args.command;
        return await new Promise(res => { exec(cmd, { timeout: 30000, maxBuffer: 1024 * 500, encoding: 'utf8' }, (err, stdout, stderr) => { res((stdout || '') + (stderr ? '\n[stderr]\n' + stderr : '') + (err ? '\n[error]\n' + err.message : '')); }); }); 
      }
      if (name === 'run_admin') {
        const cmd = 'chcp 65001 >nul && ' + args.command;
        return await new Promise(res => { exec('powershell -Command "Start-Process cmd -ArgumentList \'/c ' + cmd.replace(/"/g, '\\"') + '\' -Verb RunAs -Wait"', { timeout: 60000, encoding: 'utf8' }, (err, stdout, stderr) => { res((stdout || '') + (stderr ? '\n[stderr]\n' + stderr : '') + (err ? '\n[error]\n需管理员权限: ' + err.message : '\n[以管理员身份执行完成]')); }); }); 
      }
    } catch (e) { return '执行失败: ' + e.message; }
  }

  // 流式
  ipcMain.on('stop-stream', () => { if (currentRequest) { currentRequest.destroy(); currentRequest = null; } });
  ipcMain.handle('chat-stream', async (_, config, messages) => {
    return new Promise((resolve, reject) => {
      const sender = BrowserWindow.getFocusedWindow() || mainWindow;
      const payload = JSON.stringify({ model: config.model || 'deepseek-chat', messages, stream: true, temperature: config.temperature || 0.7 });
      const apiBase = config.apiBase || 'https://api.deepseek.com';
      const url = new URL(apiBase + '/v1/chat/completions');
      const req = require('https').request({ hostname: url.hostname, port: 443, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}`, 'Accept': 'text/event-stream' } }, (res) => {
        currentRequest = req;
        if (res.statusCode !== 200) { let b = ''; res.on('data', d => b += d); res.on('end', () => { currentRequest = null; sender?.webContents.send('stream-error', { message: `HTTP ${res.statusCode}` }); reject(new Error(`HTTP ${res.statusCode}`)); }); return; }
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString(); const lines = buf.split('\n'); buf = lines.pop() || '';
          for (const line of lines) { const t = line.trim(); if (!t || !t.startsWith('data: ')) continue; const d = t.slice(6); if (d === '[DONE]') { sender.webContents.send('stream-end'); currentRequest = null; continue; } try { const pp = JSON.parse(d); const delta = pp.choices?.[0]?.delta; if (!delta) continue; if (delta.content) sender.webContents.send('stream-data', delta.content); if (delta.reasoning_content) sender.webContents.send('reasoning-data', delta.reasoning_content); } catch (e) {} }
        });
        res.on('end', () => { currentRequest = null; resolve(true); });
        res.on('error', (e) => { currentRequest = null; sender?.webContents.send('stream-error', { message: e.message }); reject(e); });
      });
      req.on('error', (e) => { currentRequest = null; reject(e); });
      req.setTimeout(60000, () => { req.destroy(); reject(new Error('请求超时')); });
      req.write(payload); req.end();
    });
  });

  // 工具模式聊天（独立于普通聊天，不会影响基础功能）
  ipcMain.handle('chat-with-tools', async (_, config, msgs) => {
    const sender = BrowserWindow.getFocusedWindow() || mainWindow;
    const DESKTOP = path.join(require('os').homedir(), 'Desktop');
    const TOOLS = [{
      type: 'function', function: {
        name: 'create_file', description: '创建文件。桌面=' + DESKTOP + ', 下载=' + path.join(require('os').homedir(), 'Downloads'),
        parameters: { type: 'object', properties: { path: { type: 'string', description: '完整路径' }, content: { type: 'string', description: '内容' } }, required: ['path', 'content'] }
      }
    }, {
      type: 'function', function: {
        name: 'run_command', description: '执行命令',
        parameters: { type: 'object', properties: { command: { type: 'string', description: '命令' } }, required: ['command'] }
      }
    }];

    async function callAPI(messages) {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ model: config.model || 'deepseek-chat', messages, stream: false, temperature: config.temperature || 0.7, tools: TOOLS, tool_choice: 'auto' });
        const apiBase = config.apiBase || 'https://api.deepseek.com';
        const url = new URL(apiBase + '/v1/chat/completions');
        const req = require('https').request({ hostname: url.hostname, port: 443, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` } }, (res) => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); } catch(e) { reject(new Error('解析失败')); }
          });
        });
        req.on('error', e => reject(e));
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('超时')); });
        req.write(payload); req.end();
      });
    }

    // 强制工具模式的 system prompt
    const TOOL_SYSTEM = `你是桌面助手，拥有实际操作系统的能力。规则：
1. 用户要求创建文件/保存代码/生成程序→必须调用 create_file，路径默认桌面(${DESKTOP})
2. 用户要求运行命令/安装/部署→必须调用 run_command
3. 用户要求读文件→调用 read_file
4. 不知道路径就问用户，但能猜到的直接执行（如"桌面"= ${DESKTOP}）
5. 绝对不要给文字说明、步骤、建议——直接调用工具执行
6. 创建文件后简短告知用户结果即可`;
    try {
      let msgsCopy = JSON.parse(JSON.stringify(msgs));
      // 插入或替换 system prompt
      const sysIdx = msgsCopy.findIndex(m => m.role === 'system');
      if (sysIdx >= 0) msgsCopy[sysIdx].content = TOOL_SYSTEM;
      else msgsCopy.unshift({ role: 'system', content: TOOL_SYSTEM });
      let resp = await callAPI(msgsCopy);
      let loop = 0;

      while (resp.choices?.[0]?.message?.tool_calls && loop < 5) {
        loop++;
        const tc = resp.choices[0].message.tool_calls[0];
        const fnName = tc.function.name;
        let fnArgs = {};
        try { fnArgs = JSON.parse(tc.function.arguments); } catch(e) {}

        sender.webContents.send('tool-call-start', { name: fnName, args: fnArgs });
        let result = '';
        // 弹窗确认
        let confirmMsg = '';
        if (fnName === 'create_file') confirmMsg = 'AI 将创建文件：\n' + fnArgs.path;
        else if (fnName === 'run_command') confirmMsg = 'AI 将执行命令：\n' + fnArgs.command;

        if (confirmMsg) {
          const { response } = await dialog.showMessageBox(sender, {
            type: 'warning',
            title: '🔧 工具确认',
            message: confirmMsg,
            detail: '点"确认"执行，点"取消"拒绝',
            buttons: ['确认', '取消'],
            defaultId: 0,
            cancelId: 1
          });
          if (response === 1) { result = '已取消'; sender.webContents.send('tool-result', { name: fnName, args: fnArgs, result }); sender.webContents.send('stream-data', '操作已取消。'); sender.webContents.send('stream-end'); return true; }
        }

        if (!result) {
        try {
          if (fnName === 'create_file') { const dir = path.dirname(fnArgs.path); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(fnArgs.path, fnArgs.content, 'utf-8'); result = '已创建: ' + fnArgs.path + ' (' + fnArgs.content.length + 'B)'; }
          else if (fnName === 'run_command') { result = await new Promise(res => exec('chcp 65001 >nul && ' + fnArgs.command, { timeout: 30000, encoding: 'utf8' }, (err, stdout, stderr) => res((stdout||'')+(stderr||'')+(err?err.message:'')))); }
        } catch(e) { result = '失败: ' + e.message; }
        }

        sender.webContents.send('tool-result', { name: fnName, args: fnArgs, result });
        msgsCopy.push(resp.choices[0].message);
        msgsCopy.push({ role: 'tool', tool_call_id: tc.id, content: result });
        resp = await callAPI(msgsCopy);
      }

      const finalContent = resp.choices?.[0]?.message?.content || '';
      if (finalContent) sender.webContents.send('stream-data', finalContent);
      sender.webContents.send('stream-end');
    } catch(e) {
      sender.webContents.send('stream-error', { message: e.message });
    }
    return true;
  });

  ipcMain.handle('run-code', async (_, lang, code) => {
    return new Promise((resolve) => {
      const configs = {
        python: { cmd: 'python', args: ['-c', code], timeout: 30000 },
        py: { cmd: 'python', args: ['-c', code], timeout: 30000 },
        javascript: { cmd: 'node', args: ['-e', code], timeout: 15000 },
        js: { cmd: 'node', args: ['-e', code], timeout: 15000 },
        sh: { cmd: process.platform === 'win32' ? 'cmd' : 'bash', args: process.platform === 'win32' ? ['/c', code] : ['-c', code], timeout: 15000 },
        bat: { cmd: 'cmd', args: ['/c', code], timeout: 15000 },
      };
      const cfg = configs[lang] || configs.python;
      if (!cfg) return resolve({ error: '不支持的语言: ' + lang });

      const proc = spawn(cfg.cmd, cfg.args, { timeout: cfg.timeout, env: process.env });
      let stdout = '', stderr = '';
      proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > 100000) proc.kill(); });
      proc.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 100000) proc.kill(); });
      proc.on('close', exitCode => resolve({ stdout: stdout.slice(0, 50000), stderr: stderr.slice(0, 50000), exitCode }));
      proc.on('error', e => resolve({ error: e.message }));
    });
  });

  ipcMain.handle('save-file-dialog', async (_, content, defaultName) => {
    const w = BrowserWindow.getFocusedWindow() || mainWindow;
    const { filePath } = await dialog.showSaveDialog(w, {
      defaultPath: defaultName || 'code.txt',
      filters: [
        { name: '所有文件', extensions: ['*'] },
        { name: 'JavaScript', extensions: ['js'] },
        { name: 'Python', extensions: ['py'] },
        { name: 'HTML', extensions: ['html'] },
        { name: '文本', extensions: ['txt', 'md'] }
      ]
    });
    if (!filePath) return false;
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  });

  ipcMain.handle('export-chat', async (_, sd) => {
    const w = BrowserWindow.getFocusedWindow() || mainWindow;
    const { filePath } = await dialog.showSaveDialog(w, { defaultPath: `${sd.title || '对话'}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (!filePath) return false;
    let md = `# ${sd.title || '对话'}\n\n`;
    for (const msg of sd.messages || []) { md += `### ${msg.role === 'user' ? '🧑 你' : '🤖 DeepSeek'}\n\n${msg.content}\n\n`; if (msg.reasoning) md += `<details>\n<summary>思考过程</summary>\n\n${msg.reasoning}\n\n</details>\n\n`; md += `---\n\n`; }
    fs.writeFileSync(filePath, md, 'utf-8'); return true;
  });
}

// ============ 启动 ============
app.whenReady().then(() => { loadProject(); registerIPC(); createMainWindow(); createTray(); registerShortcuts(); });
app.on('window-all-closed', () => {});
app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); for (const p of Object.values(activeTerminals)) p.kill(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); else if (mainWindow) mainWindow.show(); });
