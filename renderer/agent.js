const api = window.electronAPI;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// 角色配置
const ROLE_CONFIG = {
  coder: {
    icon: '🧑‍💻', title: 'AI 编码',
    system: `你是一位资深软件工程师。根据用户需求编写高质量代码。
如果输入包含"审查意见"或"修复"，请针对审查发现的问题逐一修复，输出修复后的完整代码。
代码需包含详细注释、错误处理。只输出代码和必要的解释，不要问候语。`,
    pipeline: 'review'
  },
  reviewer: {
    icon: '🔍', title: '代码审查',
    system: `你是一位严格的代码审查专家。审查代码中的bug、安全隐患、性能问题、代码风格。
必须按以下三段式输出，缺一不可：

## 🔴 严重问题
（列出所有会导致崩溃、安全漏洞、数据丢失的问题。如果没有，写"无"）

## 🟡 警告
（列出性能问题、不良实践、可维护性问题。如果没有，写"无"）

## 🟢 建议
（列出代码风格、命名规范、注释等建议。如果没有，写"无"）

注意：第一段 ## 🔴 严重问题 必须以英文 ## 开头，后面紧接 🔴 严重问题。如果此处写"无"则表示通过。`    ,
    pipeline: 'score',
    maxCycles: 3
  },
  scorer: {
    icon: '📊', title: '代码评分',
    system: '你是一位代码质量评估专家。从以下维度打分(0-100)：正确性、可读性、性能、安全性、可维护性。输出结构化评分报告。',
    pipeline: null
  },
  architect: {
    icon: '🏗️', title: '架构设计',
    system: '你是一位系统架构师。帮助设计项目结构、模块划分、技术选型。输出架构图(ASCII)、组件说明、接口定义。',
    pipeline: null
  }
};

let config = {};
let role = 'coder';
let winId = '';
let taskContext = {};
let messages = [];
let isStreaming = false;
let streamContent = '';
let darkMode = false;
let currentFile = null;
let pipelineState = []; // 流水线步骤列表

async function init() {
  // 解析 hash 参数
  try {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const params = JSON.parse(hash);
    role = params.role || 'coder';
    taskContext = params.taskContext || {};
    winId = params.winId || '';
  } catch (e) {}

  config = await api.getConfig();
  darkMode = await api.getDarkMode();
  const ps = await api.getProjectState();
  pipelineState = ps.pipeline || [];
  applyDark();

  const rc = ROLE_CONFIG[role] || ROLE_CONFIG.coder;
  document.title = rc.title;
  $('#agent-icon').textContent = rc.icon;
  $('#agent-title').textContent = rc.title;
  $('#btn-pipeline-next').textContent = rc.pipeline ? `▶ ${ROLE_CONFIG[rc.pipeline]?.title || '下一阶段'}` : '✓ 完成';

  // 初始化消息
  messages = [{ role: 'system', content: rc.system }];
  if (taskContext.task) {
    const taskContent = `任务：${taskContext.task.title}\n${taskContext.task.description || ''}`;
    messages.push({ role: 'user', content: taskContent });
    addMessage('user', `📋 任务：${taskContext.task.title}`);

    // 自动发送——仅当描述中包含代码块时（来自流水线按钮），否则填入输入框等用户粘贴
    if (taskContext.task.description) {
      if (taskContext.task.description.includes('```')) {
        // 含代码 → 自动分析
      isStreaming = true;
      streamContent = '';
      $('#agent-input').disabled = true;
      $('#btn-agent-send').style.display = 'none';
      $('#btn-agent-stop').style.display = '';

      const msgDiv = document.createElement('div');
      msgDiv.className = 'agent-msg assistant streaming';
      msgDiv.id = 'stream-msg';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'agent-msg-content';
      contentDiv.id = 'stream-content';
      contentDiv.innerHTML = '▊';
      msgDiv.appendChild(contentDiv);
      $('#agent-chat-messages').appendChild(msgDiv);

      api.removeStreamListeners();
      api.onStreamData(onStreamData);
      api.onStreamEnd(onStreamEnd);
      api.onStreamError(onStreamError);
      api.chatStream(config, messages).catch(() => {});
      } else {
        // 不含代码（模板）→ 填入输入框，等用户粘贴代码
        $('#agent-input').value = taskContext.task.description + '\n\n';
        $('#agent-input').style.height = 'auto';
        $('#agent-input').style.height = Math.min($('#agent-input').scrollHeight, 120) + 'px';
        updateSendBtn();
        addMessage('assistant', '📋 已准备好提示词，请粘贴代码后发送');
      }
    } else {
      addMessage('assistant', '收到，有什么需要？');
    }
  }

  // 如果有文件上下文
  if (taskContext.file) {
    currentFile = taskContext.file;
    showContext('file', `📄 ${currentFile.name}`, currentFile.content);
    showEditor(currentFile.name, currentFile.content);
  }

  // 事件
  $('#btn-dark-mode').addEventListener('click', toggleDark);
  $('#btn-pipeline-next').addEventListener('click', pipelineNext);
  $('#btn-clear-ctx').addEventListener('click', clearContext);
  $('#btn-save-file').addEventListener('click', saveFile);
  $('#btn-send-code').addEventListener('click', sendToPipeline);
  $('#btn-agent-send').addEventListener('click', sendMessage);
  $('#btn-agent-stop').addEventListener('click', stopStream);
  $('#agent-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  $('#agent-input').addEventListener('input', () => {
    $('#btn-agent-send').disabled = isStreaming || !$('#agent-input').value.trim() || !config.apiKey;
  });

  // 项目状态监听
  api.onProjectState(state => {
    pipelineState = state.pipeline || [];
    // 检查是否有新的流水线步骤指派给本窗口
    if (taskContext.stepId) {
      const step = state.pipeline.find(s => s.id === taskContext.stepId);
      if (step && step.status === 'pending' && step.input) {
        showContext('pipeline', '📥 流水线输入', step.input);
        if (role === 'reviewer' || role === 'scorer') {
          showEditor('review-target', step.input);
          messages.push({ role: 'user', content: `请${role === 'reviewer' ? '审查' : '评分'}以下代码：\n\n${step.input}` });
          addMessage('user', `${role === 'reviewer' ? '🔍 收到待审查代码' : '📊 收到待评分代码'}`);
          api.updatePipelineStep(taskContext.stepId, { status: 'in_progress', agentId: winId });
        }
      }
    }
  });

  // 流式事件
  api.onStreamData(onStreamData);
  api.onStreamEnd(onStreamEnd);
  api.onStreamError(onStreamError);

  updateSendBtn();
}

function showContext(type, label, content) {
  const el = $('#agent-context');
  el.classList.remove('hidden');
  $('#ctx-label').textContent = label;
  $('#ctx-content').textContent = content;
}

function clearContext() {
  $('#agent-context').classList.add('hidden');
}

function showEditor(filename, content) {
  const el = $('#editor-section');
  el.classList.remove('hidden');
  $('#editor-filename').textContent = filename;
  $('#code-editor').value = content || '';
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `agent-msg ${role}`;
  div.innerHTML = `<div class="agent-msg-content">${api.renderMarkdown(content)}</div>`;
  $('#agent-chat-messages').appendChild(div);
  scrollBottom();
}

async function sendMessage() {
  if (isStreaming) return;
  const content = $('#agent-input').value.trim();
  if (!content || !config.apiKey) return;

  // 如果有编辑器内容，自动附上
  let fullContent = content;
  const editorContent = $('#code-editor').value.trim();
  if (editorContent && !fullContent.includes(editorContent)) {
    fullContent += '\n\n```\n' + editorContent + '\n```';
  }

  messages.push({ role: 'user', content: fullContent });
  addMessage('user', content);
  $('#agent-input').value = '';
  updateSendBtn();

  isStreaming = true;
  streamContent = '';
  $('#agent-input').disabled = true;
  $('#btn-agent-send').style.display = 'none';
  $('#btn-agent-stop').style.display = '';

  const msgDiv = document.createElement('div');
  msgDiv.className = 'agent-msg assistant streaming';
  msgDiv.id = 'stream-msg';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'agent-msg-content';
  contentDiv.id = 'stream-content';
  msgDiv.appendChild(contentDiv);
  $('#agent-chat-messages').appendChild(msgDiv);
  scrollBottom();

  try {
    api.removeStreamListeners();
    api.onStreamData(onStreamData);
    api.onStreamEnd(onStreamEnd);
    api.onStreamError(onStreamError);
    await api.chatStream(config, messages);
  } catch (e) {}
}

function onStreamData(chunk) {
  streamContent += chunk;
  const el = $('#stream-content');
  if (el) el.innerHTML = api.renderMarkdown(streamContent);
  scrollBottom();
}

async function onStreamEnd() {
  const el = $('#stream-msg');
  if (el) el.classList.remove('streaming');
  messages.push({ role: 'assistant', content: streamContent });

  // 如果角色是 coder，尝试提取代码块到编辑器
  if (role === 'coder') {
    const codeMatch = streamContent.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      const lang = codeMatch[1] || 'txt';
      const code = codeMatch[2].trim();
      showEditor(`generated.${lang}`, code);
    }
  }

  finishStream();
}

function onStreamError(err) {
  const el = $('#stream-content');
  if (el) el.innerHTML = `<span style="color:#e74c3c">❌ ${err.message || '请求失败'}</span>`;
  finishStream();
}

function finishStream() {
  isStreaming = false;
  streamContent = '';
  $('#agent-input').disabled = false;
  $('#btn-agent-send').style.display = '';
  $('#btn-agent-stop').style.display = 'none';
  $('#agent-input').focus();
  updateSendBtn();
}

function stopStream() { api.stopStream(); }

async function saveFile() {
  if (!currentFile || !currentFile.path) return;
  const content = $('#code-editor').value;
  await api.saveProjectFile(currentFile.path, content);
  addMessage('assistant', `✅ 已保存：${currentFile.name}`);
}

async function pipelineNext() {
  const rc = ROLE_CONFIG[role];
  if (!rc.pipeline) {
    addMessage('assistant', '✅ 流水线已完成');
    return;
  }

  const content = $('#code-editor').value.trim() || streamContent;
  if (!content) {
    addMessage('assistant', '⚠️ 没有可发送的内容，请先生成代码');
    return;
  }

  const stepId = taskContext.stepId;
  if (stepId) {
    await api.updatePipelineStep(stepId, { output: content, status: 'done' });
  }

  // 审查 Agent 特殊逻辑：检查是否有严重问题，决定下一阶段
  if (role === 'reviewer' && taskContext.taskId) {
    const severityPattern = /🔴\s*(严重|高危|CRITICAL|紧急|阻断|[🚨⚠])(?!.*无)/i;
    const hasSevere = severityPattern.test(content);
    // 检查 ## 🔴 严重问题 段是否写了"无"
    const severeSection = content.match(/##\s*🔴\s*[^\n]*\n([\s\S]*?)(?=##|$)/);
    const isClean = severeSection && /^\s*无\s*$/m.test(severeSection[1]);

    if (!isClean && hasSevere) {
      // 有严重问题 → 打回编码
      const currentCycle = (taskContext.cycle || 0) + 1;
      const maxCycles = rc.maxCycles || 3;

      if (currentCycle >= maxCycles) {
        addMessage('assistant', `⚠️ 经过 ${currentCycle} 轮审查仍有严重问题，流水线强制推进到评分`);
        const nextStep = await api.addPipelineStep(taskContext.taskId, 'score', content);
        api.openAgent('score', { taskId: taskContext.taskId, stepId: nextStep.id, task: taskContext.task });
        return;
      }

      // 提取审查发现 + 原始代码，发给编码
      // 从流水线上取最近的 coder 步骤输出
      const coderSteps = pipelineState.filter(s => s.stage === 'code' && s.taskId === taskContext.taskId && s.output);
      const lastCoder = coderSteps.length > 0 ? coderSteps[coderSteps.length - 1] : null;
      let origCode = lastCoder ? lastCoder.output : '';
      if (!origCode) {
        // fallback: 可能是首次审查，从当前步骤输入找
        const reviewerStep = pipelineState.find(s => s.id === stepId);
        if (reviewerStep && reviewerStep.input) origCode = reviewerStep.input;
      }
      const fixTask = {
        title: `修复审查问题 (第${currentCycle}轮)`,
        description: `原始代码：\n\`\`\`\n${origCode.slice(0, 4000)}\n\`\`\`\n\n根据以下审查意见修复代码中的严重问题：\n\n${content.slice(0, 3000)}`
      };
      const nextStep = await api.addPipelineStep(taskContext.taskId, 'code', content);
      api.openAgent('coder', { taskId: taskContext.taskId, stepId: nextStep.id, task: fixTask, cycle: currentCycle });
      addMessage('assistant', `🔄 检测到严重问题，已退回编码 Agent 修复 (第${currentCycle}轮)`);
      return;
    }

    // 无严重问题 → 正常进评分
    addMessage('assistant', '✅ 审查通过，进入评分阶段');
    const nextStep = await api.addPipelineStep(taskContext.taskId, 'score', content);
    api.openAgent('score', { taskId: taskContext.taskId, stepId: nextStep.id, task: taskContext.task });
    return;
  }

  // 非审查 Agent：正常推进到下一阶段
  if (taskContext.taskId) {
    const nextStage = rc.pipeline;
    const nextStep = await api.addPipelineStep(taskContext.taskId, nextStage, content);
    const nextCtx = { taskId: taskContext.taskId, stepId: nextStep.id, task: taskContext.task };
    if (taskContext.cycle) nextCtx.cycle = taskContext.cycle; // 传递 cycle 计数
    api.openAgent(nextStage, nextCtx);
  }

  addMessage('assistant', `📤 已发送到 ${ROLE_CONFIG[rc.pipeline]?.title || '下一阶段'}`);
}

async function sendToPipeline() {
  const content = $('#code-editor').value.trim();
  if (!content) return;
  // 审查代理
  const reviewStep = await api.addPipelineStep(taskContext.taskId || Date.now().toString(), 'review', content);
  api.openAgent('reviewer', { taskId: taskContext.taskId, stepId: reviewStep.id, task: taskContext.task });
  addMessage('assistant', '📤 已发送到 🔍 代码审查');
}

function toggleDark() {
  darkMode = !darkMode;
  applyDark();
  api.setDarkMode(darkMode);
}
function applyDark() { document.documentElement.toggleAttribute('data-theme', darkMode); }
function updateSendBtn() { $('#btn-agent-send').disabled = isStreaming || !$('#agent-input').value.trim() || !config.apiKey; }
function scrollBottom() { requestAnimationFrame(() => { const el = $('#agent-chat-messages'); el.scrollTop = el.scrollHeight; }); }

init();
