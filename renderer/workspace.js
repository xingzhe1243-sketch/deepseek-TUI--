const api = window.electronAPI;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let darkMode = false;
let projectState = { rootDir: null, files: [], tasks: [], pipeline: [], recentProjects: [] };
let gitState = null;
let sessions = [];
let templates = [];
let snapshots = [];
let selectedTasks = new Set();
let actionHistory = [];
let taskFilter = '', taskStatusFilter = 'all';

async function init() {
  darkMode = await api.getDarkMode(); applyDark();
  [projectState, sessions, templates, snapshots] = await Promise.all([
    api.getProjectState(), api.listSessions(), api.listTemplates(), api.listSnapshots()
  ]);
  renderAll();
  if (projectState.rootDir) refreshGit();

  $('#btn-pick-project').addEventListener('click', pickProject);
  $('#btn-open-chat').addEventListener('click', () => api.openChat());
  $('#btn-open-terminal').addEventListener('click', () => api.openTerminal());
  $('#btn-dark-mode').addEventListener('click', toggleDark);
  $('#btn-add-task').addEventListener('click', () => $('#task-modal').classList.remove('hidden'));
  $('#btn-task-cancel').addEventListener('click', () => $('#task-modal').classList.add('hidden'));
  $('#btn-task-create').addEventListener('click', createTask);
  $('#btn-batch-delete').addEventListener('click', batchDelete);
  $('#btn-create-snapshot').addEventListener('click', createSnapshot);
  $('#btn-save-template').addEventListener('click', saveTemplatePrompt);
  $('#file-filter').addEventListener('input', renderFileTree);
  $('#task-filter').addEventListener('input', () => { taskFilter = $('#task-filter').value.toLowerCase(); renderTaskList(); });
  $('#task-status-filter').addEventListener('change', () => { taskStatusFilter = $('#task-status-filter').value; renderTaskList(); });
  $('#session-tag-input').addEventListener('input', renderSessionTags);

  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    document.getElementById('tab-' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'git') refreshGit();
  }));

  api.onProjectState(s => { projectState = s; renderAll(); if (projectState.rootDir) refreshGit(); });
  api.onAgentClosed(() => renderAgentList());
  api.onShortcut(a => { if (a === 'toggle-dark-mode') toggleDark(); });
}

// ============ 渲染总控 ============
function renderAll() {
  renderFileTree();
  renderTaskList();
  renderPipeline();
  renderAgentList();
  renderStats();
  renderRecentProjects();
  renderQuickActions();
  renderSnapshots();
  renderTemplates();
  renderSessionTags();
}

// ============ 文件树 ============
function renderFileTree() {
  const el = $('#file-tree');
  const filter = ($('#file-filter').value || '').toLowerCase();
  if (!projectState.rootDir) { el.innerHTML = '<div class="empty-hint">请打开一个项目目录</div>'; return; }
  el.innerHTML = `<div class="file-tree-root">📁 ${projectState.rootDir.split('\\').pop()}</div>`;
  renderTree(el, projectState.files, filter);
}

function renderTree(parent, nodes, filter) {
  for (const n of nodes) {
    const nameMatch = !filter || n.name.toLowerCase().includes(filter);
    const childMatch = n.type === 'dir' && (n.children || []).some(c => matchesFilter(c, filter));
    if (!nameMatch && !childMatch) continue;

    const div = document.createElement('div');
    div.className = 'tree-node';

    if (n.type === 'dir') {
      div.innerHTML = `<span class="tree-toggle">▸</span> <span class="git-icon"></span>📁 ${n.name}`;
      const children = document.createElement('div');
      children.className = 'tree-children hidden';
      renderTree(children, n.children || [], filter);
      div.appendChild(children);
      div.querySelector('.tree-toggle').addEventListener('click', (e) => {
        e.stopPropagation(); children.classList.toggle('hidden');
        div.querySelector('.tree-toggle').textContent = children.classList.contains('hidden') ? '▸' : '▾';
      });
    } else {
      let gitIcon = '';
      if (gitState && gitState.changes) {
        const code = gitState.changes[n.path] || gitState.changes[n.path.replace(projectState.rootDir + '\\', '')];
        if (code === 'M' || code === 'MM') gitIcon = '<span class="git-modified" title="已修改">●</span>';
        else if (code === 'A' || code === '??') gitIcon = '<span class="git-added" title="新增">＋</span>';
        else if (code === 'D') gitIcon = '<span class="git-deleted" title="已删除">－</span>';
      }
      div.innerHTML = `<span class="tree-file">${gitIcon}📄 ${n.name}</span>`;
      div.addEventListener('click', async (e) => {
        if (!e.target.closest('.tree-toggle')) {
          const content = await api.readProjectFile(n.path);
          if (!content.error) api.openAgent('coder', { projectDir: projectState.rootDir, file: { path: n.path, name: n.name, content: content.content } });
        }
      });
      // 右键菜单
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showFileContextMenu(e, n);
      });
    }
    parent.appendChild(div);
  }
}

function matchesFilter(node, filter) {
  if (!filter) return true;
  if (node.name.toLowerCase().includes(filter)) return true;
  if (node.type === 'dir' && node.children) return node.children.some(c => matchesFilter(c, filter));
  return false;
}

function showFileContextMenu(e, node) {
  const old = document.querySelector('.file-ctx-menu');
  if (old) old.remove();
  const menu = document.createElement('div');
  menu.className = 'file-ctx-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.innerHTML = `
    <div class="fctx-item" data-action="optimize">🤖 让 DeepSeek 优化这段代码</div>
    <div class="fctx-item" data-action="explain">💡 解释这段代码</div>
    <div class="fctx-item" data-action="review">🔍 审查这段代码</div>
  `;
  document.body.appendChild(menu);
  menu.querySelectorAll('.fctx-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      const content = await api.readProjectFile(node.path);
      if (content.error) return;
      let prompt = '';
      if (action === 'optimize') prompt = '请优化以下代码，提高可读性和性能：\n\n';
      else if (action === 'explain') prompt = '请详细解释以下代码的功能和逻辑：\n\n';
      else prompt = '请审查以下代码中的bug、安全隐患和性能问题：\n\n';
      prompt += '```\n' + content.content + '\n```';
      api.openAgent('coder', { projectDir: projectState.rootDir, file: { path: node.path, name: node.name, content: prompt } });
      menu.remove();
    });
  });
  document.addEventListener('click', () => menu.remove(), { once: true });
}

// ============ Git ============
async function refreshGit() {
  if (!projectState.rootDir) return;
  gitState = await api.gitStatus(projectState.rootDir);
  $('#git-branch').innerHTML = gitState.branch ? `🔀 ${gitState.branch}` : '非 Git 仓库';
  const changesEl = $('#git-changes');
  if (!gitState.changes || Object.keys(gitState.changes).length === 0) {
    changesEl.innerHTML = '<div class="empty-hint">无变更</div>';
    return;
  }
  changesEl.innerHTML = Object.entries(gitState.changes).map(([f, code]) => {
    const icons = { M: '●', A: '＋', D: '－', '??': '?' };
    return `<div class="git-change-item" data-file="${f}">
      <span class="git-${code === '??' ? 'added' : code === 'D' ? 'deleted' : 'modified'}">${icons[code] || '?'}</span> ${f}
    </div>`;
  }).join('');
  renderFileTree();
}

// ============ 任务 ============
function renderTaskList() {
  const el = $('#task-list');
  let tasks = projectState.tasks || [];
  if (taskFilter) tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(taskFilter) || (t.description || '').toLowerCase().includes(taskFilter));
  if (taskStatusFilter !== 'all') tasks = tasks.filter(t => t.status === taskStatusFilter);
  if (tasks.length === 0) { el.innerHTML = '<div class="empty-hint">暂无任务</div>'; return; }

  el.innerHTML = tasks.map(t => {
    const sm = { pending: '⏳ 待处理', in_progress: '🔄 进行中', done: '✅ 完成' };
    const checked = selectedTasks.has(t.id) ? 'checked' : '';
    return `<div class="task-item task-${t.status}" data-id="${t.id}">
      <div class="task-head">
        <input type="checkbox" class="task-check" data-id="${t.id}" ${checked}>
        <span class="task-title">${esc(t.title)}</span>
        <span class="task-status">${sm[t.status] || t.status}</span>
      </div>
      ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
      ${t.tags && t.tags.length ? `<div class="task-tags">${t.tags.map(tg => `<span class="tag">${esc(tg)}</span>`).join('')}</div>` : ''}
      ${t.startedAt ? `<div class="task-time">⏱ ${formatDuration(t.startedAt, t.completedAt)}</div>` : ''}
      <div class="task-actions">
        ${t.status !== 'done' ? `<button class="btn-xs" data-action="start" data-id="${t.id}">▶</button>` : ''}
        ${t.status === 'in_progress' ? `<button class="btn-xs" data-action="done" data-id="${t.id}">✅</button>` : ''}
        ${t.status === 'done' ? `<button class="btn-xs" data-action="retry" data-id="${t.id}">🔄</button>` : ''}
        <button class="btn-xs btn-xs-danger" data-action="delete" data-id="${t.id}">🗑</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.task-check').forEach(cb => {
    cb.addEventListener('change', () => { if (cb.checked) selectedTasks.add(cb.dataset.id); else selectedTasks.delete(cb.dataset.id); });
  });
  el.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      if (b.dataset.action === 'start') { await api.updateTask(id, { status: 'in_progress' }); const task = projectState.tasks.find(t => t.id === id); if (task) { const step = await api.addPipelineStep(id, 'code', task.description || task.title); api.openAgent('coder', { taskId: id, stepId: step.id, task }); } }
      else if (b.dataset.action === 'done') await api.updateTask(id, { status: 'done' });
      else if (b.dataset.action === 'retry') await api.updateTask(id, { status: 'pending' });
      else if (b.dataset.action === 'delete') { await api.deleteTask(id); selectedTasks.delete(id); }
    });
  });
}

function batchDelete() {
  if (selectedTasks.size === 0) return;
  api.batchTaskAction([...selectedTasks], 'delete');
  selectedTasks.clear();
}

// ============ 流水线 ============
function renderPipeline() {
  const stages = { code: 'stage-code-status', review: 'stage-review-status', score: 'stage-score-status' };
  for (const [stage, elId] of Object.entries(stages)) {
    const steps = projectState.pipeline.filter(s => s.stage === stage);
    const active = steps.filter(s => s.status === 'in_progress');
    const done = steps.filter(s => s.status === 'done');
    const failed = steps.filter(s => s.status === 'failed');
    const el = document.getElementById(elId);
    if (!el) continue;
    if (failed.length) el.innerHTML = `<span class="badge badge-failed">${failed.length} 失败</span>`;
    else if (active.length) el.innerHTML = `<span class="badge badge-active">${active.length} 执行中</span>`;
    else if (done.length) el.innerHTML = `<span class="badge badge-done">${done.length} 完成</span>`;
    else el.textContent = '待命';
    // 节点颜色
    const stageEl = document.querySelector(`.pipeline-stage[data-stage="${stage}"]`);
    if (stageEl) { stageEl.classList.remove('stage-active', 'stage-done', 'stage-failed'); if (active.length) stageEl.classList.add('stage-active'); else if (done.length) stageEl.classList.add('stage-done'); else if (failed.length) stageEl.classList.add('stage-failed'); }
  }
}

// ============ 代理 ============
async function renderAgentList() {
  const agents = await api.getAgentWindows();
  const el = $('#agent-list');
  if (agents.length === 0) { el.innerHTML = '<div class="empty-hint">无活跃代理</div>'; return; }
  el.innerHTML = agents.map(a => {
    const icons = { coder: '🧑‍💻', reviewer: '🔍', scorer: '📊', architect: '🏗️' };
    const elapsed = Math.floor((Date.now() - a.createdAt) / 1000);
    const time = elapsed > 60 ? `${Math.floor(elapsed / 60)}分` : `${elapsed}秒`;
    return `<div class="agent-card">
      <div class="agent-card-head"><span>${icons[a.role] || '🤖'} ${a.role}</span><span class="agent-time">${time}</span></div>
      ${a.taskContext?.task ? `<div class="agent-card-task">📋 ${esc(a.taskContext.task.title || '')}</div>` : ''}
      <button class="btn-xs" data-close="${a.id}">✕</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => api.closeAgent(b.dataset.close)));
}

// ============ 快照 ============
async function renderSnapshots() {
  snapshots = await api.listSnapshots();
  const el = $('#snapshot-list');
  if (!snapshots.length) { el.innerHTML = '<div class="empty-hint">无快照</div>'; return; }
  el.innerHTML = snapshots.map(s => `<div class="snapshot-item"><span>📸 ${esc(s.name)}</span><span class="snap-time">${formatTime(s.createdAt)}</span><button class="btn-xs" data-restore="${s.id}">↩</button></div>`).join('');
  el.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', async () => { await api.restoreSnapshot(b.dataset.restore); }));
}
async function createSnapshot() {
  const name = prompt('快照名称：', `快照 ${new Date().toLocaleString()}`);
  if (name) await api.createSnapshot(name);
}

// ============ 模板 ============
async function renderTemplates() {
  templates = await api.listTemplates();
  const el = $('#template-list');
  const builtin = [
    { id: 'optimize', name: '🎯 代码优化', prompt: '请优化以下代码，提高可读性和性能，保持功能不变' },
    { id: 'security', name: '🔒 安全漏洞修复', prompt: '审查代码中的安全漏洞并提供修复方案' },
    { id: 'deploy', name: '🚀 部署脚本生成', prompt: '根据项目结构生成部署脚本' },
    { id: 'test', name: '🧪 生成测试用例', prompt: '为以下代码生成全面的单元测试' },
    { id: 'docs', name: '📝 生成文档', prompt: '为以下代码生成详细的API文档和注释' },
    { id: 'refactor', name: '♻️ 代码重构', prompt: '重构以下代码，应用最佳设计模式' },
  ];
  el.innerHTML = [...builtin, ...templates].map(t => {
    const isBuiltin = builtin.some(b => b.id === t.id);
    return `<div class="template-item" data-prompt="${encodeURIComponent(t.prompt || '')}">
      <span>${t.name}</span>
      ${!isBuiltin ? `<button class="btn-xs btn-xs-danger" data-del-tpl="${t.id}">✕</button>` : ''}
    </div>`;
  }).join('');
  el.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.dataset.delTpl) { api.deleteTemplate(e.target.dataset.delTpl); return; }
      const prompt = decodeURIComponent(item.dataset.prompt);
      api.openAgent('coder', { projectDir: projectState.rootDir, task: { title: item.querySelector('span').textContent, description: prompt } });
    });
  });
}
async function saveTemplatePrompt() {
  const name = prompt('指令名称：', '');
  if (!name) return;
  const promptText = prompt('指令内容：', '');
  if (!promptText) return;
  await api.saveTemplate({ name, prompt: promptText });
  renderTemplates();
}

// ============ 会话标签 ============
function renderSessionTags() {
  const filter = ($('#session-tag-input').value || '').toLowerCase();
  const allTags = new Set();
  for (const s of sessions) { if (s.tags) s.tags.forEach(t => allTags.add(t)); }
  const el = $('#session-tag-list');
  const tags = [...allTags].filter(t => !filter || t.toLowerCase().includes(filter));
  if (!tags.length) { el.innerHTML = '<div class="empty-hint">无标签</div>'; return; }
  el.innerHTML = tags.map(t => `<div class="tag-chip" data-tag="${t}">🏷️ ${esc(t)} <span class="tag-count">${sessions.filter(s => (s.tags || []).includes(t)).length}</span></div>`).join('');
  el.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tagged = sessions.filter(s => (s.tags || []).includes(chip.dataset.tag));
      // 显示标签下的会话列表
    });
  });
}

// ============ 最近项目 & 快速操作 ============
function renderRecentProjects() {
  const el = $('#recent-projects');
  const recent = projectState.recentProjects || [];
  if (!recent.length) { el.innerHTML = '<div class="empty-hint">无最近项目</div>'; return; }
  el.innerHTML = '<div class="section-header"><h3>🕐 最近项目</h3></div>' + recent.map(p => `<div class="recent-item" data-path="${p.path}">📁 ${esc(p.name)}<span class="recent-time">${formatTime(p.time)}</span></div>`).join('');
  el.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', async () => { projectState.rootDir = item.dataset.path; projectState = await api.getProjectState(); renderAll(); if (projectState.rootDir) refreshGit(); });
  });
}

function renderQuickActions() {
  const el = $('#quick-actions');
  const actions = [
    { role: 'coder', icon: '🧑‍💻', label: '编码' },
    { role: 'reviewer', icon: '🔍', label: '审查' },
    { role: 'scorer', icon: '📊', label: '评分' },
    { role: 'architect', icon: '🏗️', label: '架构' },
  ];
  el.innerHTML = actions.map(a => `<button class="btn-agent" data-role="${a.role}">${a.icon} ${a.label}</button>`).join('');
  el.querySelectorAll('.btn-agent').forEach(b => b.addEventListener('click', () => {
    api.openAgent(b.dataset.role, { projectDir: projectState.rootDir });
    actionHistory.push({ role: b.dataset.role, time: Date.now() });
    renderActionHistory();
  }));
}

function renderActionHistory() {
  const el = $('#action-history');
  if (!actionHistory.length) { el.innerHTML = ''; return; }
  const recent = actionHistory.slice(-5).reverse();
  el.innerHTML = '<div class="section-header" style="margin-top:8px"><h3>最近操作</h3></div>' + recent.map(a => `<div class="history-item" data-role="${a.role}">${formatTime(a.time)} — ${a.role}</div>`).join('');
}

// ============ 其他 ============
function renderStats() {
  $('#stat-files').textContent = projectState.files.length;
  $('#stat-tasks').textContent = projectState.tasks.length;
  $('#stat-active').textContent = projectState.tasks.filter(t => t.status === 'in_progress').length;
  $('#stat-done').textContent = projectState.tasks.filter(t => t.status === 'done').length;
}

async function pickProject() {
  const r = await api.pickProjectDir();
  if (r) { projectState = await api.getProjectState(); renderAll(); refreshGit(); }
}
async function createTask() {
  const title = $('#task-title').value.trim(); if (!title) return;
  const desc = $('#task-desc').value.trim();
  const tags = ($('#task-tags-input').value || '').split(',').map(t => t.trim()).filter(Boolean);
  await api.addTask({ title, description: desc, tags });
  $('#task-modal').classList.add('hidden');
  $('#task-title').value = ''; $('#task-desc').value = ''; $('#task-tags-input').value = '';
}
function toggleDark() { darkMode = !darkMode; applyDark(); api.setDarkMode(darkMode); }
function applyDark() { document.documentElement.toggleAttribute('data-theme', darkMode); }
function esc(s) { const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }; return String(s).replace(/[&<>"]/g, c => m[c]); }
function formatTime(ts) { const d = new Date(ts), now = new Date(); const pad = n => String(n).padStart(2, '0'); const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`; if (d.toDateString() === now.toDateString()) return t; const y = new Date(now); y.setDate(y.getDate() - 1); if (d.toDateString() === y.toDateString()) return `昨天 ${t}`; if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()} ${t}`; return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${t}`; }
function formatDuration(start, end) { const ms = (end || Date.now()) - (start || Date.now()); const s = Math.floor(ms / 1000); if (s < 60) return `${s}秒`; if (s < 3600) return `${Math.floor(s / 60)}分`; return `${Math.floor(s / 3600)}时${Math.floor((s % 3600) / 60)}分`; }

init();
