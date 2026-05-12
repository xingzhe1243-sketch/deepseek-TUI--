const { contextBridge, ipcRenderer } = require('electron');

let hljs;
try { hljs = require('highlight.js'); } catch(e) { hljs = null; }

function renderMarkdown(text) {
  let s = String(text || '');
  if (!s) return s;

  // 先提取代码块，避免被转义
  const codeBlocks = [];
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push({ lang, code });
    return '\x00CODE' + (codeBlocks.length - 1) + '\x00';
  });

  // 提取行内代码
  const inlineCodes = [];
  s = s.replace(/`([^`]+)`/g, (_, code) => {
    inlineCodes.push(code);
    return '\x00ICODE' + (inlineCodes.length - 1) + '\x00';
  });

  // 转义 HTML
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 恢复行内代码
  s = s.replace(/\x00ICODE(\d+)\x00/g, (_, i) => '<code>' + escHtml(inlineCodes[+i]) + '</code>');

  // 恢复代码块
  s = s.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    const { lang, code } = codeBlocks[+i];
    let h = escHtml(code);
    if (hljs) {
      try {
        h = (lang && hljs.getLanguage(lang)) ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value;
      } catch(e) {}
    }
    const encoded = encodeURIComponent(code);
    const langLabel = lang ? '<span class="code-lang">' + lang + '</span>' : '';
    return '<div class="code-block-wrapper">' + langLabel +
      '<div class="code-actions">' +
        '<button class="btn-copy-code" data-code="' + encoded + '" title="复制">📋</button>' +
        '<button class="btn-run-code" data-code="' + encoded + '" data-lang="' + lang + '" title="运行">▶</button>' +
        '<button class="btn-pipeline" data-code="' + encoded + '" data-lang="' + lang + '" data-role="reviewer" title="审查">🔍</button>' +
        '<button class="btn-pipeline" data-code="' + encoded + '" data-lang="' + lang + '" data-role="coder" title="优化">🔧</button>' +
        '<button class="btn-pipeline" data-code="' + encoded + '" data-lang="' + lang + '" data-role="architect" title="架构">🏗️</button>' +
      '</div>' +
      '<pre><code class="hljs' + (lang ? ' language-' + lang : '') + '">' + h + '</code></pre></div>';
  });

  // 加粗 **...**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜体 *...*
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 标题 ### ...
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 分割线 ---
  s = s.replace(/^---+$/gm, '<hr>');

  // 无序列表 - ... 或 * ...
  s = s.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, content) => {
    return '  '.repeat(Math.floor(indent.length / 2)) + '<li>' + content + '</li>';
  });

  // 有序列表 1. ...
  s = s.replace(/^(\s*)\d+\. (.+)$/gm, (_, indent, content) => {
    return '  '.repeat(Math.floor(indent.length / 2)) + '<li>' + content + '</li>';
  });

  // 引用 > ...
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 段落
  let paragraphs = s.split(/\n\n+/);
  s = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (/^<(h[1-3]|hr|blockquote|div|pre|li|ul|ol|table)/.test(p)) return p;
    p = p.replace(/\n/g, '<br>');
    return '<p>' + p + '</p>';
  }).join('\n');

  return s;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (c) => ipcRenderer.invoke('save-config', c),
  getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),
  setDarkMode: (d) => ipcRenderer.invoke('set-dark-mode', d),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  saveSession: (id, d) => ipcRenderer.invoke('save-session', id, d),
  deleteSession: (id) => ipcRenderer.invoke('delete-session', id),
  loadSession: (id) => ipcRenderer.invoke('load-session', id),
  renameSession: (id, t) => ipcRenderer.invoke('rename-session', id, t),
  pinSession: (id) => ipcRenderer.invoke('pin-session', id),
  tagSession: (id, tags) => ipcRenderer.invoke('tag-session', id, tags),
  pickProjectDir: () => ipcRenderer.invoke('pick-project-dir'),
  getProjectState: () => ipcRenderer.invoke('get-project-state'),
  readProjectFile: (fp) => ipcRenderer.invoke('read-project-file', fp),
  saveProjectFile: (fp, c) => ipcRenderer.invoke('save-project-file', fp, c),
  readFile: (fp) => ipcRenderer.invoke('read-file', fp),
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  saveFileDialog: (content, defaultName) => ipcRenderer.invoke('save-file-dialog', content, defaultName),
  runCode: (lang, code) => ipcRenderer.invoke('run-code', lang, code),
  gitStatus: (dir) => ipcRenderer.invoke('git-status', dir),
  gitDiff: (dir, file) => ipcRenderer.invoke('git-diff', dir, file),
  gitCommit: (dir, msg) => ipcRenderer.invoke('git-commit', dir, msg),
  gitPush: (dir) => ipcRenderer.invoke('git-push', dir),
  gitPull: (dir) => ipcRenderer.invoke('git-pull', dir),
  gitFetch: (dir) => ipcRenderer.invoke('git-fetch', dir),
  gitClone: (url, targetDir) => ipcRenderer.invoke('git-clone', url, targetDir),
  addTask: (t) => ipcRenderer.invoke('add-task', t),
  updateTask: (id, u) => ipcRenderer.invoke('update-task', id, u),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
  addPipelineStep: (tid, s, i) => ipcRenderer.invoke('add-pipeline-step', tid, s, i),
  updatePipelineStep: (sid, u) => ipcRenderer.invoke('update-pipeline-step', sid, u),
  openAgent: (role, ctx) => ipcRenderer.invoke('open-agent', role, ctx),
  getAgentWindows: () => ipcRenderer.invoke('get-agent-windows'),
  closeAgent: (wid) => ipcRenderer.invoke('close-agent', wid),
  openTerminal: () => ipcRenderer.invoke('open-terminal'),
  termCreate: (cwd) => ipcRenderer.invoke('term-create', cwd),
  termWrite: (id, data) => ipcRenderer.invoke('term-write', id, data),
  termKill: (id) => ipcRenderer.invoke('term-kill', id),
  listTemplates: () => ipcRenderer.invoke('list-templates'),
  saveTemplate: (t) => ipcRenderer.invoke('save-template', t),
  deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),
  createSnapshot: (name) => ipcRenderer.invoke('create-snapshot', name),
  listSnapshots: () => ipcRenderer.invoke('list-snapshots'),
  restoreSnapshot: (id) => ipcRenderer.invoke('restore-snapshot', id),
  openChat: () => ipcRenderer.invoke('open-chat'),
  openWorkspace: () => ipcRenderer.invoke('open-workspace'),
  chatStream: (cfg, msgs) => ipcRenderer.invoke('chat-stream', cfg, msgs),
  chatWithTools: (cfg, msgs) => ipcRenderer.invoke('chat-with-tools', cfg, msgs),
  stopStream: () => ipcRenderer.send('stop-stream'),
  onStreamData: (cb) => ipcRenderer.on('stream-data', (_, d) => cb(d)),
  onStreamEnd: (cb) => ipcRenderer.on('stream-end', () => cb()),
  onStreamError: (cb) => ipcRenderer.on('stream-error', (_, e) => cb(e)),
  onReasoningData: (cb) => ipcRenderer.on('reasoning-data', (_, d) => cb(d)),
  removeStreamListeners: () => { ipcRenderer.removeAllListeners('stream-data'); ipcRenderer.removeAllListeners('stream-end'); ipcRenderer.removeAllListeners('stream-error'); ipcRenderer.removeAllListeners('reasoning-data'); },
  onShortcut: (cb) => ipcRenderer.on('shortcut', (_, a) => cb(a)),
  onProjectState: (cb) => ipcRenderer.on('project-state', (_, s) => cb(s)),
  onAgentClosed: (cb) => ipcRenderer.on('agent-closed', (_, d) => cb(d)),
  onToolResult: (cb) => ipcRenderer.on('tool-result', (_, d) => cb(d)),
  onToolCallStart: (cb) => ipcRenderer.on('tool-call-start', (_, d) => cb(d)),
  renderMarkdown: renderMarkdown,
  exportChat: (sd) => ipcRenderer.invoke('export-chat', sd)
});