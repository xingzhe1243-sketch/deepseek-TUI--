// i18n.js - 多语言支持
const I18N = {
  zh: {
    title: 'DeepSeek Chat',
    newChat: '新对话',
    send: '发送',
    stop: '停止',
    settings: '设置',
    save: '保存',
    cancel: '取消',
    close: '关闭',
    export: '导出对话',
    darkMode: '深色模式',
    darkToggle: '🌙',
    attach: '添加文件',
    toolMode: '工具模式',
    search: '搜索',
    searchPlace: '搜索对话内容...',
    inputPlace: '输入消息... (Enter 发送)',
    configApiKey: 'API Key',
    configApiBase: 'API Base URL',
    configModel: '模型',
    configSystem: '系统提示词',
    configTemp: 'Temperature',
    copy: '复制',
    run: '运行',
    review: '审查',
    optimize: '优化',
    architect: '架构',
    think: '思考过程',
    thinking: '思考中...',
    delete: '删除',
    rename: '重命名',
    clickSwitchDblRename: '单击切换 · 右键更多',
    error: '请求失败',
    interrupted: '生成中断',
    confirmDelete: '确定删除此对话？',
    enterNewName: '请输入新名称：',
    // 工作区
    wsFiles: '📁 文件',
    wsGit: '🔀 Git',
    wsClone: '📥 Clone',
    wsTasks: '📋 任务',
    wsTools: '⚡ 工具',
    wsOpenProject: '📂 打开项目',
    wsOpenFull: '⬛ 窗口',
    wsFilterFiles: '过滤文件...',
    wsRecent: '🕐 最近',
    wsNoProject: '打开项目目录以浏览文件',
    wsNoGit: '非 Git 仓库',
    wsNoChanges: '无变更',
    wsGitCommits: '提交历史',
    wsCommitMsg: 'commit 信息...',
    wsCommit: '✅ 提交',
    wsPush: '📤',
    wsPull: '📥',
    wsCloneUrl: 'https://github.com/user/repo.git',
    wsCloneBtn: '⬇ 克隆到项目目录',
    wsCloneTitle: '📥 克隆仓库',
    wsNewTask: '＋ 新建',
    wsBatchDel: '🗑 批量删',
    wsAll: '全部',
    wsPending: '待处理',
    wsInProgress: '进行中',
    wsDone: '已完成',
    wsNoTasks: '暂无任务',
    wsTaskTitle: '任务标题',
    wsTaskDesc: '描述',
    wsTaskTags: '标签 (逗号分隔)',
    wsQuickActions: '⚡ 快速操作',
    wsCoding: '🧑‍💻 编码',
    wsReviewing: '🔍 审查',
    wsScoring: '📊 评分',
    wsArchitecture: '🏗️ 架构',
    wsTerminal: '⬛ 打开终端',
    wsTemplates: '📋 指令模板',
    wsSnapshots: '💾 快照',
    wsNoSnapshots: '无快照',
    wsSaveSnapshot: '📸 保存当前状态',
    wsActionHistory: '🕐 操作记录',
    wsNoHistory: '暂无操作',
    wsAgents: '🤖 活跃代理',
    wsNoAgents: '无活跃代理',
    wsStart: '▶',
    wsDone: '✅',
    wsRetry: '🔄',
    snapshotName: '快照名称：',
    // 模板
    tplOptimize: '🎯 代码优化',
    tplOptimizeDesc: '请优化以下代码，提高可读性和性能',
    tplSecurity: '🔒 安全修复',
    tplSecurityDesc: '审查以下代码的安全漏洞并提出修复方案',
    tplTest: '🧪 生成测试',
    tplTestDesc: '为以下代码生成全面的单元测试用例',
    tplDocs: '📝 生成文档',
    tplDocsDesc: '为以下代码生成详细的API文档和注释',
    // Agent
    agentCoder: 'AI 编码',
    agentReviewer: '代码审查',
    agentScorer: '代码评分',
    agentArchitect: '架构设计',
    agentSend: '发送到审查',
    agentReady: '📋 已准备好提示词，请粘贴代码后发送',
    agentReceived: '收到，有什么需要？',
    agentSave: '✅ 已保存：',
    pipelineDone: '✅ 流水线已完成',
    pipelineSent: '📤 已发送到',
    pipelineNoContent: '⚠️ 没有可发送的内容，请先生成代码',
    // 提醒
    commitFail: '提交失败: ',
    commitOk: '✅ 提交成功',
    pushConfirm: '确认推送到远程？',
    pushFail: '推送失败: ',
    pushOk: '✅ 推送成功',
    pullFail: '拉取失败: ',
    pullOk: '✅ 拉取成功',
    cloneFail: '克隆失败: ',
    cloneOk: '✅ 克隆成功',
    cloneNeedUrl: '请输入仓库地址',
    needCommitMsg: '请输入 commit 信息',
    // 其他
    langToggle: '中/EN',
    dropHint: '释放文件以添加为上下文',
    welcomeTitle: '👋 欢迎使用 DeepSeek Chat',
    welcomeDesc: 'AI 对话 · 代码编写 · 审查 · 评分 · 终端',
  },
  en: {
    title: 'DeepSeek Chat',
    newChat: 'New Chat',
    send: 'Send',
    stop: 'Stop',
    settings: 'Settings',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    export: 'Export Chat',
    darkMode: 'Dark Mode',
    darkToggle: '🌙',
    attach: 'Attach Files',
    toolMode: 'Tool Mode',
    search: 'Search',
    searchPlace: 'Search messages...',
    inputPlace: 'Type a message... (Enter)',
    configApiKey: 'API Key',
    configApiBase: 'API Base URL',
    configModel: 'Model',
    configSystem: 'System Prompt',
    configTemp: 'Temperature',
    copy: 'Copy',
    run: 'Run',
    review: 'Review',
    optimize: 'Optimize',
    architect: 'Architect',
    think: 'Thinking process',
    thinking: 'Thinking...',
    delete: 'Delete',
    rename: 'Rename',
    clickSwitchDblRename: 'Click to switch · Right-click more',
    error: 'Request failed',
    interrupted: 'Generation interrupted',
    confirmDelete: 'Delete this conversation?',
    enterNewName: 'Enter new name:',
    wsFiles: '📁 Files',
    wsGit: '🔀 Git',
    wsClone: '📥 Clone',
    wsTasks: '📋 Tasks',
    wsTools: '⚡ Tools',
    wsOpenProject: '📂 Open Project',
    wsOpenFull: '⬛ Window',
    wsFilterFiles: 'Filter files...',
    wsRecent: '🕐 Recent',
    wsNoProject: 'Open a project folder to browse',
    wsNoGit: 'Not a Git repo',
    wsNoChanges: 'No changes',
    wsGitCommits: 'Commit History',
    wsCommitMsg: 'commit message...',
    wsCommit: '✅ Commit',
    wsPush: '📤 Push',
    wsPull: '📥 Pull',
    wsCloneUrl: 'https://github.com/user/repo.git',
    wsCloneBtn: '⬇ Clone to project',
    wsCloneTitle: '📥 Clone Repository',
    wsNewTask: '＋ New',
    wsBatchDel: '🗑 Batch',
    wsAll: 'All',
    wsPending: 'Pending',
    wsInProgress: 'In Progress',
    wsDone: 'Done',
    wsNoTasks: 'No tasks',
    wsTaskTitle: 'Task Title',
    wsTaskDesc: 'Description',
    wsTaskTags: 'Tags (comma separated)',
    wsQuickActions: '⚡ Quick Actions',
    wsCoding: '🧑‍💻 Code',
    wsReviewing: '🔍 Review',
    wsScoring: '📊 Score',
    wsArchitecture: '🏗️ Arch',
    wsTerminal: '⬛ Terminal',
    wsTemplates: '📋 Templates',
    wsSnapshots: '💾 Snapshots',
    wsNoSnapshots: 'No snapshots',
    wsSaveSnapshot: '📸 Save State',
    wsActionHistory: '🕐 History',
    wsNoHistory: 'No history',
    wsAgents: '🤖 Agents',
    wsNoAgents: 'No active agents',
    wsStart: '▶',
    wsDone: '✅',
    wsRetry: '🔄',
    snapshotName: 'Snapshot name:',
    tplOptimize: '🎯 Optimize',
    tplOptimizeDesc: 'Please optimize the following code for readability and performance',
    tplSecurity: '🔒 Security Fix',
    tplSecurityDesc: 'Review the following code for security vulnerabilities and propose fixes',
    tplTest: '🧪 Generate Tests',
    tplTestDesc: 'Generate comprehensive unit tests for the following code',
    tplDocs: '📝 Generate Docs',
    tplDocsDesc: 'Generate detailed API documentation and comments for the following code',
    agentCoder: 'AI Coder',
    agentReviewer: 'Code Review',
    agentScorer: 'Code Scoring',
    agentArchitect: 'Architecture',
    agentSend: 'Send to Review',
    agentReady: 'Prompt ready. Paste your code and send.',
    agentReceived: 'Got it. What do you need?',
    agentSave: 'Saved: ',
    pipelineDone: 'Pipeline complete',
    pipelineSent: 'Sent to ',
    pipelineNoContent: 'No content to send. Generate code first.',
    commitFail: 'Commit failed: ',
    commitOk: 'Commit successful',
    pushConfirm: 'Confirm push to remote?',
    pushFail: 'Push failed: ',
    pushOk: 'Push successful',
    pullFail: 'Pull failed: ',
    pullOk: 'Pull successful',
    cloneFail: 'Clone failed: ',
    cloneOk: 'Clone successful',
    cloneNeedUrl: 'Please enter a repository URL',
    needCommitMsg: 'Please enter a commit message',
    langToggle: '中/EN',
    dropHint: 'Drop files to add as context',
    welcomeTitle: '👋 Welcome to DeepSeek Chat',
    welcomeDesc: 'AI Chat · Code · Review · Score · Terminal',
  }
};

let currentLang = 'zh';

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || key;
}

function setLang(lang) {
  currentLang = lang;
  renderAllText();
}

function renderAllText() {
  // Input placeholder
  const input = document.querySelector('#chat-input');
  if (input) input.placeholder = t('inputPlace');

  // Buttons
  const map = {
    '#btn-send': 'send',
    '#btn-stop': 'stop',
    '#btn-new-chat': 'newChat',
    '#btn-settings': 'settings',
    '#btn-save-settings': 'save',
    '#btn-close-settings': 'close',
    '#btn-attach': 'attach',
    '#btn-tool-mode': 'toolMode',
    '#ws-pick-project': 'wsOpenProject',
    '#ws-open-full': 'wsOpenFull',
    '#ws-add-task': 'wsNewTask',
    '#ws-batch-delete': 'wsBatchDel',
    '#ws-create-snapshot': 'wsSaveSnapshot',
    '#ws-open-terminal': 'wsTerminal',
    '#ws-git-commit': 'wsCommit',
    '#ws-git-push': 'wsPush',
    '#ws-git-pull': 'wsPull',
    '#ws-clone-btn': 'wsCloneBtn',
    '#btn-task-create': 'send',
    '#btn-task-cancel': 'cancel',
  };

  for (const [sel, key] of Object.entries(map)) {
    const el = document.querySelector(sel);
    if (el && !el.querySelector('*')) el.textContent = t(key);
  }

  // Placeholders
  const ph = {
    '#ws-file-filter': 'wsFilterFiles',
    '#ws-clone-url': 'wsCloneUrl',
    '#ws-git-msg': 'wsCommitMsg',
    '#task-title': 'wsTaskTitle',
    '#task-desc': 'wsTaskDesc',
    '#task-tags-input': 'wsTaskTags',
    '#session-search': 'searchPlace',
    '#search-input': 'searchPlace',
  };
  for (const [sel, key] of Object.entries(ph)) {
    const el = document.querySelector(sel);
    if (el) el.placeholder = t(key);
  }

  // Labels
  const labels = {
    '#ws-clone .ws-topbar span': 'wsCloneTitle',
    '#ws-quick-actions': null, // handled separately
    '#cfg-api-key': 'configApiKey',
    '#cfg-api-base': 'configApiBase',
    '#cfg-model': 'configModel',
    '#cfg-system-prompt': 'configSystem',
    '#cfg-temperature': 'configTemp',
  };

  // Task filter options
  const tf = document.querySelector('#ws-task-filter');
  if (tf) {
    tf.options[0].text = t('wsAll');
    tf.options[1].text = t('wsPending');
    tf.options[2].text = t('wsInProgress');
    tf.options[3].text = t('wsDone');
  }

  // Section titles
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t(key)) el.textContent = t(key);
  });

  // Drag overlay
  const dragP = document.querySelector('.drag-hint p');
  if (dragP) dragP.textContent = t('dropHint');
}

// Expose for other scripts
window.__t = t;
window.__setLang = setLang;
window.__currentLang = () => currentLang;
