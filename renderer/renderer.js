if (!window.electronAPI) { document.body.innerHTML = '<h1>preload 未加载</h1>'; }
const api = window.electronAPI;
const $ = s => document.querySelector(s);
let config = {}, sessions = [], activeSessionId = null, activeMessages = [], isStreaming = false, streamContent = '', reasoningContent = '';

$('#btn-send').disabled = false;
$('#btn-send').onclick = send;
$('#btn-stop').onclick = () => api.stopStream();
let toolMode = false;
if ($('#btn-tool-mode')) { $('#btn-tool-mode').onclick = () => { toolMode = !toolMode; $('#btn-tool-mode').classList.toggle('active', toolMode); }; }
$('#btn-new-chat').onclick = newChat;
$('#btn-settings').onclick = openSettings;
$('#btn-close-settings').onclick = closeSettings;
$('#btn-save-settings').onclick = saveSettings;
$('#chat-input').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
$('#chat-input').oninput = () => { $('#chat-input').style.height = 'auto'; $('#chat-input').style.height = Math.min($('#chat-input').scrollHeight, 150) + 'px'; };
if ($('#cfg-temperature')) $('#cfg-temperature').oninput = e => $('#temp-label').textContent = e.target.value;
if ($('#btn-dark-header')) $('#btn-dark-header').onclick = toggleDark;
if ($('#btn-lang-toggle')) $('#btn-lang-toggle').onclick = toggleLang;
if ($('#btn-search-toggle')) $('#btn-search-toggle').onclick = toggleSearch;
if ($('#btn-workspace-toggle')) $('#btn-workspace-toggle').onclick = toggleWorkspace;
if ($('#btn-attach')) $('#btn-attach').onclick = attachFiles;

api.onStreamData(c => { streamContent += c; const b = $('#s-bubble'); if (b) b.innerHTML = api.renderMarkdown(streamContent); });
api.onStreamEnd(() => {
  const b = $('#s-bubble'); if (b) { b.innerHTML = api.renderMarkdown(streamContent); b.id = ''; }
  const el = $('#s-msg'); if (el) el.id = '';
  const re = $('#s-reasoning'); if (re) { re.open = reasoningContent ? false : true; re.id = ''; }
  const rs = $('#s-reasoning-summary'); if (rs) rs.textContent = '💭 思考过程';
  const aiMsg = { role: 'assistant', content: streamContent };
  if (reasoningContent) aiMsg.reasoning = reasoningContent;
  activeMessages.push(aiMsg);
  let t = $('#chat-title').textContent;
  if (t === '新对话' || !t) { const fu = activeMessages.find(m => m.role === 'user'); if (fu) t = fu.content.slice(0, 30).replace(/\n/g, ' '); $('#chat-title').textContent = t || '新对话'; }
  done();
  api.saveSession(activeSessionId, { title: t, messages: activeMessages, updatedAt: Date.now() });
  api.listSessions().then(ss => { sessions = ss; renderSessions(); });
});
api.onStreamError(e => {
  const b = $('#s-bubble'); if (b) b.innerHTML = '<span style="color:#e74c3c">❌ ' + (e?.message || e || '请求失败') + '</span>';
  const el = $('#s-msg'); if (el) el.id = '';
  const re = $('#s-reasoning'); if (re) { re.style.display = 'none'; re.id = ''; }
  if (streamContent) activeMessages.push({ role: 'assistant', content: streamContent + '\n\n*[生成中断]*' });
  done();
});
api.onReasoningData(c => { reasoningContent += c; const re = $('#s-reasoning'); const rc = $('#s-reasoning-content'); if (re && rc) { re.style.display = ''; rc.innerHTML = api.renderMarkdown(reasoningContent); } });
api.onToolCallStart(d => { const b = $('#s-bubble'); if (b) b.innerHTML = '⏳ ' + d.name + '...'; });
api.onToolResult(d => { const b = $('#s-bubble'); if (b) b.innerHTML = '🔧 **' + d.name + '**\n```\n' + String(d.result).slice(0, 2000) + '\n```\n\n▊'; });

(async () => {
  config = await api.getConfig();
  sessions = await api.listSessions();
  if (!config.apiKey) openSettings();
  renderSessions();
})();

function done() { isStreaming = false; streamContent = ''; reasoningContent = ''; $('#chat-input').disabled = false; $('#btn-send').style.display = ''; $('#btn-stop').style.display = 'none'; }

async function send() {
  if (isStreaming) return;
  const c = $('#chat-input').value.trim(); if (!c) return;
  if (!config.apiKey) { openSettings(); return; }
  if (!activeSessionId) { activeSessionId = Date.now().toString(); activeMessages = []; if (config.systemPrompt) activeMessages.push({ role: 'system', content: config.systemPrompt }); }
  let fullContent = c;
  if (attachedFiles.length) { const ts = attachedFiles.map(f => '[' + f.name + ']\n' + f.content.slice(0, 20000)).join('\n\n'); fullContent = (c || '分析以下文件：') + '\n\n' + ts; attachedFiles = []; const bar = $('#attach-bar'); if (bar) { bar.innerHTML = ''; bar.style.display = 'none'; } }
  activeMessages.push({ role: 'user', content: fullContent });
  const w = document.createElement('div'); w.className = 'message user'; w.innerHTML = '<div class="message-bubble">' + api.renderMarkdown(c) + '</div>';
  $('#chat-messages').appendChild(w);
  $('#chat-input').value = ''; $('#chat-input').style.height = 'auto';
  isStreaming = true; streamContent = ''; reasoningContent = '';
  $('#chat-input').disabled = true; $('#btn-send').style.display = 'none'; $('#btn-stop').style.display = '';
  const sw = document.createElement('div'); sw.className = 'message assistant streaming'; sw.id = 's-msg';
  sw.innerHTML = '<div class="message-bubble-wrap"><details class="reasoning-block" id="s-reasoning" style="display:none" open><summary id="s-reasoning-summary">💭 思考中...</summary><div class="reasoning-content" id="s-reasoning-content"></div></details><div class="message-bubble" id="s-bubble">▊</div></div>';
  $('#chat-messages').appendChild(sw);
  setTimeout(() => { $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight; }, 50);
  try { if (toolMode) await api.chatWithTools(config, [...activeMessages]); else await api.chatStream(config, [...activeMessages]); } catch(e) { done(); }
}

let sessionFilter = '';
$('#session-search').oninput = () => { sessionFilter = $('#session-search').value.trim().toLowerCase(); renderSessions(); };

function renderSessions() {
  const el = $('#session-list'); el.innerHTML = '';
  let list = sessions;
  if (sessionFilter) list = sessions.filter(s => (s.title || '新对话').toLowerCase().includes(sessionFilter));
  if (!list.length) { el.innerHTML = '<div class="session-empty">' + (sessionFilter ? '无匹配' : '暂无对话') + '</div>'; return; }
  for (const s of list) {
    const d = document.createElement('div');
    d.className = 'session-item' + (s.id === activeSessionId ? ' active' : '');
    d.dataset.id = s.id;
    d.title = '单击切换 · 点⋯ 更多';
    const pin = document.createElement('span'); pin.className = 'session-pin'; pin.textContent = s.pinned ? '📌' : '';
    const ttl = document.createElement('span'); ttl.className = 'session-title'; ttl.textContent = s.title || '新对话';
    const menu = document.createElement('span'); menu.className = 'session-menu'; menu.textContent = '⋯'; menu.title = '更多';
    menu.onclick = e => { e.stopPropagation(); showSessionCtx(e, s.id); };
    d.appendChild(pin); d.appendChild(ttl); d.appendChild(menu);
    d.onclick = () => switchSess(s.id);
    el.appendChild(d);
  }
}
function showSessionCtx(e, id) {
  const old = document.querySelector('.session-ctx-menu'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'session-ctx-menu';
  const isPinned = sessions.find(s => s.id === id)?.pinned;
  m.innerHTML = '<div class="ctx-item" data-act="pin">' + (isPinned ? '📌 取消置顶' : '📍 置顶') + '</div><div class="ctx-item" data-act="rename">✏️ 重命名</div><div class="ctx-item" data-act="delete">🗑 删除</div>';
  m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px'; document.body.appendChild(m);
  m.onclick = ev => {
    const act = ev.target.dataset.act; m.remove();
    if (act === 'pin') { api.pinSession(id).then(() => api.listSessions()).then(ss => { sessions = ss; renderSessions(); }); return; }
    if (act === 'rename') { inlineRename(id); }
    if (act === 'delete') { if (!confirm('删除此对话？')) return; api.deleteSession(id); sessions = sessions.filter(s => s.id !== id); if (activeSessionId === id) { activeSessionId = null; activeMessages = []; $('#chat-messages').innerHTML = ''; $('#chat-title').textContent = 'DeepSeek Chat'; } renderSessions(); }
  };
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 10);
}
function inlineRename(id) {
  const item = document.querySelector('.session-item[data-id="' + id + '"]'); if (!item) return;
  const span = item.querySelector('.session-title'); if (!span) return;
  const cur = span.textContent;
  const input = document.createElement('input');
  input.type = 'text'; input.value = cur; input.className = 'session-rename-input';
  input.style.cssText = 'flex:1;padding:2px 6px;border:1px solid var(--accent);border-radius:4px;font-size:12px;outline:none;background:rgba(255,255,255,.1);color:var(--side-text);width:100%';
  span.replaceWith(input); input.focus(); input.select();
  const commit = () => {
    const n = input.value.trim();
    input.replaceWith(span);
    if (n && n !== cur) { api.renameSession(id, n).then(() => api.listSessions()).then(ss => { sessions = ss; renderSessions(); }); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  input.addEventListener('blur', () => commit());
}

async function switchSess(id) {
  if (isStreaming) { api.stopStream(); isStreaming = false; streamContent = ''; reasoningContent = ''; }
  $('#chat-input').disabled = false; $('#btn-send').style.display = ''; $('#btn-stop').style.display = 'none';
  activeSessionId = id;
  const d = await api.loadSession(id);
  if (d) { activeMessages = d.messages || []; $('#chat-messages').innerHTML = ''; for (const m of activeMessages) { if (m.role === 'system') continue; const w = document.createElement('div'); w.className = 'message ' + m.role; let html = ''; if (m.reasoning) html += '<details class="reasoning-block"><summary>💭 思考过程</summary><div class="reasoning-content">' + api.renderMarkdown(m.reasoning) + '</div></details>'; html += '<div class="message-bubble">' + api.renderMarkdown(m.content) + '</div>'; w.innerHTML = '<div class="message-bubble-wrap">' + html + '</div>'; $('#chat-messages').appendChild(w); } $('#chat-title').textContent = d.title || '对话'; setTimeout(() => { $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight; }, 50); }
  renderSessions();
}

function newChat() { activeSessionId = Date.now().toString(); activeMessages = []; if (config.systemPrompt) activeMessages.push({ role: 'system', content: config.systemPrompt }); $('#chat-messages').innerHTML = ''; $('#chat-title').textContent = '新对话'; $('#chat-input').value = ''; renderSessions(); api.saveSession(activeSessionId, { title: '新对话', messages: activeMessages, createdAt: Date.now(), updatedAt: Date.now() }); sessions.unshift({ id: activeSessionId, title: '新对话' }); renderSessions(); }

function openSettings() { $('#settings-overlay').classList.remove('hidden'); $('#cfg-api-key').value = config.apiKey || ''; $('#cfg-api-base').value = config.apiBase || 'https://api.deepseek.com'; $('#cfg-model').value = config.model || 'deepseek-chat'; $('#cfg-system-prompt').value = config.systemPrompt || ''; $('#cfg-temperature').value = config.temperature ?? 0.7; if ($('#temp-label')) $('#temp-label').textContent = config.temperature ?? 0.7; }
function closeSettings() { $('#settings-overlay').classList.add('hidden'); }
async function saveSettings() { config = { apiKey: $('#cfg-api-key').value.trim(), apiBase: $('#cfg-api-base').value.trim() || 'https://api.deepseek.com', model: $('#cfg-model').value, systemPrompt: $('#cfg-system-prompt').value.trim(), temperature: parseFloat($('#cfg-temperature').value) }; await api.saveConfig(config); closeSettings(); }

let darkMode = false;
async function toggleDark() { darkMode = !darkMode; if (darkMode) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); api.setDarkMode(darkMode); }

function toggleLang() {
  const cur = window.__currentLang ? window.__currentLang() : 'zh';
  const next = cur === 'zh' ? 'en' : 'zh';
  window.__setLang && window.__setLang(next);
  const btn = $('#btn-lang-toggle'); if (btn) btn.textContent = next === 'zh' ? 'EN' : '中';
  api.getConfig().then(c => { c.lang = next; api.saveConfig(c); });
}

function toggleSearch() {
  if ($('#search-bar').style.display === 'flex') { $('#search-bar').style.display = 'none'; clearSearchHL(); }
  else { $('#search-bar').style.display = 'flex'; $('#search-input').focus(); }
}
$('#search-input').oninput = () => {
  const q = $('#search-input').value.trim(); clearSearchHL();
  if (!q) return;
  let count = 0;
  document.querySelectorAll('.message-bubble').forEach(b => {
    if (!b.dataset.origHtml) b.dataset.origHtml = b.innerHTML;
    b.innerHTML = b.dataset.origHtml;
    if (!b.textContent.toLowerCase().includes(q.toLowerCase())) return;
    b.innerHTML = b.innerHTML.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark class="search-hl">$1</mark>');
    count++;
  });
  $('#search-count').textContent = count || '0';
};
$('#btn-search-close').onclick = () => { $('#search-bar').style.display = 'none'; clearSearchHL(); };
function clearSearchHL() {
  document.querySelectorAll('.message-bubble[data-orig-html]').forEach(b => { b.innerHTML = b.dataset.origHtml; });
  $('#search-count').textContent = '';
}

function toggleWorkspace() { const p = $('#workspace-panel'); if (p) { p.classList.toggle('hidden'); const tb = $('#btn-workspace-toggle'); if (tb) tb.classList.toggle('active', !p.classList.contains('hidden')); } }

// 工作区：标签切换 + 快速操作按钮
document.querySelectorAll('.ws-tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.ws-tab').forEach(x => x.classList.remove('active')); b.classList.add('active');
  document.querySelectorAll('.ws-content').forEach(x => x.classList.remove('active'));
  const target = document.getElementById('ws-' + b.dataset.tab); if (target) target.classList.add('active');
});
$('#ws-pick-project') && ($('#ws-pick-project').onclick = async () => { const r = await api.pickProjectDir(); if (r) alert('项目已打开：' + r.rootDir); });
$('#ws-open-terminal') && ($('#ws-open-terminal').onclick = () => api.openTerminal());
$('#ws-add-task') && ($('#ws-add-task').onclick = () => $('#task-modal').classList.remove('hidden'));
$('#btn-task-cancel') && ($('#btn-task-cancel').onclick = () => $('#task-modal').classList.add('hidden'));
$('#btn-task-create') && ($('#btn-task-create').onclick = async () => { const t = $('#task-title').value.trim(); if (t) { await api.addTask({ title: t, description: $('#task-desc').value.trim() }); $('#task-modal').classList.add('hidden'); $('#task-title').value = ''; $('#task-desc').value = ''; } });
// 快速操作按钮（编码/审查/评分/架构）
$('#workspace-panel').addEventListener('click', e => { if (e.target.classList.contains('btn-agent') && e.target.dataset.role) api.openAgent(e.target.dataset.role, {}); });

let attachedFiles = [];
async function attachFiles() { const paths = await api.pickFiles(); if (!paths || !paths.length) return; const bar = $('#attach-bar'); for (const fp of paths) { const r = await api.readFile(fp); if (!r.error) { attachedFiles.push(r); const chip = document.createElement('span'); chip.className = 'attach-chip'; chip.textContent = '📎 ' + r.name; chip.title = r.path; if (bar) bar.appendChild(chip); } } if (bar && attachedFiles.length) bar.style.display = 'flex'; }

api.getDarkMode().then(d => { darkMode = d; if (d) document.documentElement.setAttribute('data-theme', 'dark'); });
(async () => { const c = await api.getConfig(); if (c.lang && window.__setLang) { window.__setLang(c.lang); const btn = $('#btn-lang-toggle'); if (btn) btn.textContent = c.lang === 'zh' ? 'EN' : '中'; } })();

// 代码块快捷按钮
document.addEventListener('click', e => {
  const t = e.target;
  if (t.classList.contains('btn-copy-code')) { navigator.clipboard.writeText(decodeURIComponent(t.dataset.code)); t.textContent = '✅'; setTimeout(() => t.textContent = '📋', 1500); }
  if (t.classList.contains('btn-run-code')) { if (!confirm('运行以下代码？\n' + decodeURIComponent(t.dataset.code).slice(0, 200))) return; api.runCode(t.dataset.lang || 'python', decodeURIComponent(t.dataset.code)).then(r => { const out = (r.stdout||'')+(r.stderr||'')+(r.error||''); const w = document.createElement('div'); w.className = 'message system'; w.innerHTML = '<div class="message-bubble">' + (r.exitCode===0?'✅':'❌') + ' 退出码:'+r.exitCode+'\n```\n'+out.slice(0,3000)+'\n```</div>'; $('#chat-messages').appendChild(w); }); }
  if (t.classList.contains('btn-pipeline') && t.dataset.role) { const code = decodeURIComponent(t.dataset.code); const lang = t.dataset.lang || ''; const prompts = { reviewer: '审查以下代码：\n```\n'+code+'\n```', coder: '优化以下代码：\n```\n'+code+'\n```', architect: '分析以下代码架构：\n```\n'+code+'\n```' }; api.openAgent(t.dataset.role, { task: { title: t.dataset.role, description: prompts[t.dataset.role] } }); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen(); });

// ===== 工作区面板数据加载（追加，不动上面的代码） =====
let _projectState = {};
(async function initWorkpace() {
  _projectState = await api.getProjectState();
  const tabObserver = new MutationObserver(() => {
    const gitTab = document.getElementById('ws-git');
    if (gitTab && gitTab.classList.contains('active')) loadGitTab();
    const toolsTab = document.getElementById('ws-tools');
    if (toolsTab && toolsTab.classList.contains('active')) loadToolsTab();
  });
  const wsPanel = document.getElementById('workspace-panel');
  if (wsPanel) tabObserver.observe(wsPanel, { attributes: true, subtree: true, attributeFilter: ['class'] });
  // 标签切换时加载对应数据
  document.querySelectorAll('.ws-tab').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.tab === 'git') loadGitTab();
      if (b.dataset.tab === 'tools') loadToolsTab();
    });
  });
  // 快照保存按钮
  $('#ws-create-snapshot') && ($('#ws-create-snapshot').onclick = async () => {
    const name = prompt('快照名称：', new Date().toLocaleString());
    if (name) { await api.createSnapshot(name); loadSnapshots(); }
  });
})();

async function loadGitTab() {
  if (!_projectState.rootDir) { $('#ws-git-branch').textContent = '请先打开项目'; return; }
  try {
    const gs = await api.gitStatus(_projectState.rootDir);
    $('#ws-git-branch').innerHTML = gs.branch ? '🔀 ' + gs.branch : '非 Git 仓库';
    const changes = gs.changes || {};
    const keys = Object.keys(changes);
    $('#ws-git-changes').innerHTML = keys.length
      ? keys.map(f => '<div class="git-change-item">' + changes[f] + ' ' + f + '</div>').join('')
      : '<div class="empty-hint">无变更</div>';
  } catch(e) {}
}

async function loadToolsTab() {
  try {
    const templates = await api.listTemplates();
    const builtin = [{ name: '🎯 代码优化', prompt: '优化以下代码' }, { name: '🔒 安全修复', prompt: '审查安全漏洞' }, { name: '🧪 生成测试', prompt: '生成测试用例' }, { name: '📝 生成文档', prompt: '生成API文档' }];
    const all = [...builtin, ...templates];
    const el = $('#ws-templates'); if (!el) return;
    el.innerHTML = all.map(t => '<div class="template-item" style="cursor:pointer;padding:4px 6px;font-size:11px" data-prompt="' + encodeURIComponent(t.prompt || '') + '">' + t.name + '</div>').join('');
    el.querySelectorAll('.template-item').forEach(item => {
      item.onclick = () => api.openAgent('coder', { task: { title: item.textContent.trim(), description: decodeURIComponent(item.dataset.prompt) } });
    });
  } catch(e) {}
  loadSnapshots();
}

async function loadSnapshots() {
  try {
    const snaps = await api.listSnapshots();
    const el = $('#ws-snapshots'); if (!el) return;
    el.innerHTML = snaps.length ? snaps.map(s => '<div class="snap-row"><span>📸 ' + s.name + '</span><button class="btn-xs" data-restore="' + s.id + '">↩</button></div>').join('') : '<div class="empty-hint">无快照</div>';
    el.querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => { await api.restoreSnapshot(b.dataset.restore); loadSnapshots(); });
  } catch(e) {}
}


