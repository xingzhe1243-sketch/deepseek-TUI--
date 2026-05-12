# DeepSeek Chat — 零基础构建 AI 桌面编程工作台

> 从零开始，手把手教你用 Electron + DeepSeek API 打造一个带有  
> 聊天、代码运行、多 Agent 协作、Git 管理和流水线功能的桌面应用。

---

## 📖 目录

1. [这个应用能干什么](#1-这个应用能干什么)
2. [你需要准备的（零基础清单）](#2-你需要准备的零基础清单)
3. [安装 Node.js 和 Git](#3-安装-nodejs-和-git)
4. [获取 DeepSeek API Key](#4-获取-deepseek-api-key)
5. [克隆项目 + 安装依赖](#5-克隆项目--安装依赖)
6. [项目结构详解](#6-项目结构详解)
7. [核心技术概念（零基础友好）](#7-核心技术概念零基础友好)
8. [代码逐文件讲解](#8-代码逐文件讲解)
9. [启动应用](#9-启动应用)
10. [功能使用指南](#10-功能使用指南)
11. [开发历程——我们解决了哪些问题](#11-开发历程我们解决了哪些问题)
12. [常见问题排查](#12-常见问题排查)

---

## 1. 这个应用能干什么

### 🎯 核心功能一览

| 功能 | 说明 |
|------|------|
| 🤖 **AI 对话** | 流式聊天，Markdown 渲染，代码语法高亮 |
| 🔧 **工具模式** | AI 可直接创建文件、执行命令到你的电脑 |
| 💭 **思维链** | 使用 DeepSeek-R1 模型时展示推理过程 |
| 📁 **多会话管理** | 新建/切换/删除/重命名/置顶/搜索对话 |
| 👨‍💻 **多 Agent 窗口** | 编码、审查、评分、架构 四个专业 Agent |
| 🔄 **审查流水线** | 编码→审查→评分 自动接力，严重问题自动打回修复 |
| 🔀 **Git 集成** | 查看状态、提交、推送、拉取、克隆仓库 |
| 📋 **任务管理** | 创建任务、状态跟踪、标签分类 |
| 💾 **快照备份** | 一键保存项目状态，随时恢复 |
| 🌙 **深色模式** | 日间/夜间主题切换 |
| 🌍 **中英双语** | 界面一键切换中文/English |
| 🔍 **内容搜索** | 对话内容实时搜索高亮 |
| ▶️ **代码运行** | 代码块一键运行（需本地安装对应环境） |

### 🖥️ 界面总览

```
┌──────────────┬─────────────────────┬──────────────┐
│   侧边栏      │      聊天区          │   工作区面板   │
│              │                     │              │
│  🔍 搜索会话  │  标题栏 🌙🔍中/EN   │ 📁 文件树    │
│              │  ─────────────────  │ 🔀 Git状态   │
│  📌 置顶对话  │                     │ 📋 任务列表  │
│  📝 对话1    │  用户消息气泡        │ ⚡ 快速操作  │
│  📝 对话2    │  AI 回复气泡         │  ⬛ 终端     │
│  📝 对话3    │  ```代码块```       │ 📋 指令模板  │
│  ...         │  ▶🔍🔧🏗️按钮      │ 💾 快照管理  │
│              │                     │              │
│  ＋ 🖥️ ⚙    │  📎🔧 输入框 [发送] │              │
└──────────────┴─────────────────────┴──────────────┘
```

---

## 2. 你需要准备的（零基础清单）

> 下面的软件**全部免费**。如果你是第一次写代码，跟着步骤走就能跑起来。

| 工具 | 作用 | 下载地址 |
|------|------|---------|
| **Node.js** (v18+) | JavaScript 运行环境 | https://nodejs.org (选 LTS 版本) |
| **Git** | 版本管理工具 | https://git-scm.com |
| **VS Code** (推荐) | 代码编辑器 | https://code.visualstudio.com |
| **DeepSeek API Key** | AI 模型的"钥匙" | https://platform.deepseek.com |
| **GitHub 账号** | 托管代码（可选） | https://github.com |

**硬件要求**：普通电脑即可，4GB 内存以上。

---

## 3. 安装 Node.js 和 Git

### Node.js

1. 打开 https://nodejs.org
2. 点左边的 **LTS** 按钮下载（长期支持版，最稳定）
3. 双击安装包 → 一路点 "Next" → 完成
4. 验证安装：打开 **命令提示符**（按 `Win+R`，输入 `cmd`，回车），输入：

```bash
node -v
# 应该显示 v18.x.x 或更高

npm -v
# 应该显示 9.x.x 或更高
```

### Git

1. 打开 https://git-scm.com → 下载 → 安装（全部默认选项）
2. 验证：

```bash
git --version
# 应该显示 git version 2.x.x
```

---

## 4. 获取 DeepSeek API Key

> API Key 就像你的 "AI 密码"，有了它才能调用 DeepSeek 的模型。

1. 打开 https://platform.deepseek.com
2. 注册账号（手机号或邮箱）
3. 登录后，点左侧菜单 **API Keys**
4. 点 **创建 API Key** → 起个名字（如 "我的桌面应用"）→ 创建
5. **立即复制**保存！关闭后就看不到了
6. 格式类似：`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

> 💰 费用：DeepSeek 的 API 非常便宜，聊天模型约 ¥1/百万 token，日常使用一个月几块钱。

---

## 5. 克隆项目 + 安装依赖

打开命令提示符（`Win+R` → `cmd`），逐行输入：

```bash
# 进入桌面
cd %USERPROFILE%\Desktop

# 克隆项目（替换为你的仓库地址）
git clone https://github.com/xingzhe1243-sketch/deepseek-TUI--.git

# 进入项目目录
cd DeepSeekChat

# 安装依赖（这一步需要联网，约 2-5 分钟）
npm install
```

### 配置 API Key

项目根目录有一个 `config.example.json`，把它复制一份：

```bash
copy config.example.json config.json
```

然后用记事本打开 `config.json`，把 `sk-your-api-key-here` 替换成你的真实 API Key：

```json
{
  "apiKey": "sk-你的真实Key",
  "apiBase": "https://api.deepseek.com",
  "model": "deepseek-chat",
  "temperature": 0.7,
  "darkMode": false,
  "lang": "zh"
}
```

> ⚠️ `config.json` 已在 `.gitignore` 中，不会被提交到 GitHub。

---

## 6. 项目结构详解

```
DeepSeekChat/
├── main.js                 # Electron 主进程（后端逻辑）
├── preload.js              # 安全桥接层（前后端通信）
├── package.json            # 项目配置文件
├── config.example.json     # 配置模板（不含 Key）
├── .gitignore              # 告诉 Git 忽略哪些文件
├── renderer/
│   ├── index.html          # 聊天界面 HTML
│   ├── renderer.js         # 聊天界面交互逻辑（核心！）
│   ├── style.css           # 全局样式
│   ├── agent.html          # Agent 窗口界面
│   ├── agent.js            # Agent 窗口逻辑
│   ├── agent.css           # Agent 窗口样式
│   ├── terminal.html       # 内嵌终端界面
│   ├── workspace.html      # 仪表盘界面
│   ├── workspace.js        # 仪表盘逻辑
│   ├── workspace.css       # 仪表盘样式
│   └── i18n.js             # 中英文翻译文件
└── node_modules/           # 依赖包（npm install 自动生成）
```

### 三明治架构

这是 Electron 应用的标准架构：

```
┌─────────────────────────────┐
│      渲染进程 (前端)          │  ← HTML + CSS + JavaScript
│    renderer.js / index.html │     用户看到的界面
├─────────────────────────────┤
│      preload.js (桥接)       │  ← contextBridge 暴露 API
│                              │     限制渲染进程权限
├─────────────────────────────┤
│      主进程 (后端)            │  ← Node.js 完整权限
│         main.js              │     IPC 通信、文件操作、API 调用
└─────────────────────────────┘
```

**为什么需要 preload.js？**

出于安全考虑，Electron 的渲染进程默认不能直接访问 Node.js（如文件系统）。preload.js 通过 `contextBridge` 把需要的功能"安全地"暴露给前端，就像一个安检闸门。

---

## 7. 核心技术概念（零基础友好）

### 7.1 什么是 Electron？

Electron 就是一个"把网页打包成桌面应用"的工具。你写的 HTML/CSS/JavaScript，在 Electron 里就像打开了 Chrome 浏览器，但它是独立的桌面窗口，还能访问电脑的文件系统。

**一句话**：Electron = Chrome 浏览器 + Node.js 后端，合二为一。

### 7.2 什么是 IPC（进程间通信）？

IPC (Inter-Process Communication) 是主进程和渲染进程之间的对话方式：

```
渲染进程 (renderer.js)          主进程 (main.js)
      │                              │
      │── ipcRenderer.invoke ──────→│   "帮我读文件"
      │         (发请求)              │   执行 fs.readFileSync()
      │                              │
      │←─── 返回结果 ───────────────│   "文件内容是：..."
```

### 7.3 什么是流式响应（Streaming）？

普通的 API 调用：发送问题 → 等待完整回复 → 显示（用户要等很久）。

流式 API 调用：发送问题 → AI 一个字一个字回复 → 实时显示（像打字一样）。

这就是为什么你看到 AI 的回复是"逐字逐句"出现的，而不是一下子全出来。

### 7.4 什么是 Function Calling（工具调用）？

普通的 AI 只能"说话"，不能"做事"。Function Calling 让 AI 能**调用工具**：

- 你问："帮我在桌面创建一个计算器"
- AI 不回复文字，而是调用 `create_file` 工具
- 工具把文件真正写到你的桌面

这就是 🔧 工具模式的核心原理。

### 7.5 什么是流水线（Pipeline）？

就像工厂的流水线：

```
💻 编码 Agent  →  写代码
      ↓
🔍 审查 Agent  →  检查 bug 和安全漏洞
      ↓
📊 评分 Agent  →  给代码打分
      ↓
如果有严重问题 →  退回编码 Agent 修复 → 再审查 → 再评分
```

---

## 8. 代码逐文件讲解

### 8.1 `package.json` — 项目身份证

```json
{
  "name": "deepseek-chat",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "dependencies": {
    "electron": "^28.0.0",
    "highlight.js": "^11.9.0"
  }
}
```

- `"main"`: 告诉 Electron 从哪个文件启动
- `"scripts"`: `npm start` 就是执行 `electron .`
- `"dependencies"`: 项目依赖的第三方库

### 8.2 `main.js` — 应用的大脑（主进程）

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
```

**核心职责：**

1. **创建窗口** (`createMainWindow`)
```javascript
const mainWindow = new BrowserWindow({
  width: 1100, height: 750,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,   // 安全隔离
    nodeIntegration: false    // 渲染进程不能直接用 Node.js
  }
});
mainWindow.loadFile('renderer/index.html');
```

2. **注册 IPC 处理器** — 响应前端的请求

```javascript
// 当渲染进程调用 api.listSessions()
ipcMain.handle('list-sessions', () => loadSessionList());

// 当渲染进程调用 api.chatStream()
ipcMain.handle('chat-stream', async (_, config, messages) => {
  // 向 DeepSeek API 发送请求
  // 把返回的数据逐块发给前端
});
```

3. **会话管理** — 读/写 JSON 文件

```javascript
function loadSessionList() {
  const files = fs.readdirSync(sessionsPath);
  // 读取每个 .json 文件 → 返回会话列表
}

function saveSession(id, data) {
  fs.writeFileSync(`sessions/${id}.json`, JSON.stringify(data));
}
```

4. **Git 集成** — 执行命令行

```javascript
ipcMain.handle('git-commit', async (_, dir, msg) => {
  exec('git add .', { cwd: dir });
  exec(`git commit -m "${msg}"`, { cwd: dir });
});
```

### 8.3 `preload.js` — 安全桥接层

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 前端通过 window.electronAPI.xxx() 调用
  getConfig: () => ipcRenderer.invoke('get-config'),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  chatStream: (cfg, msgs) => ipcRenderer.invoke('chat-stream', cfg, msgs),
  // ... 更多 API
});
```

**为什么要这样设计？**

不能把 `require('fs')` 直接暴露给前端（安全风险）。preload.js 只暴露**我们允许的**功能。

### 8.4 Markdown 渲染器（preload.js 内）

应用内置了一个轻量 Markdown → HTML 转换器：

```javascript
function renderMarkdown(text) {
  // 1. 先提取代码块（用占位符保护）
  // 2. 转义 HTML 特殊字符
  // 3. 转换 **加粗**、*斜体*、# 标题
  // 4. 恢复代码块（highlight.js 语法高亮）
  // 5. 给代码块加上 📋 ▶ 🔍 🔧 🏗️ 按钮
}
```

### 8.5 `renderer.js` — 聊天界面的灵魂

**这是整个应用最核心、代码量最大的文件（~500 行）。**

#### 事件绑定（同步设置）

```javascript
// 所有按钮的事件处理在脚本加载时立即绑定
$('#btn-send').onclick = send;
$('#btn-stop').onclick = () => api.stopStream();
$('#btn-new-chat').onclick = newChat;
// ...
```

#### 流式响应处理

```javascript
api.onStreamData(chunk => {
  streamContent += chunk;
  $('#s-bubble').innerHTML = api.renderMarkdown(streamContent);
});

api.onStreamEnd(() => {
  // 停止状态，恢复按钮
  activeMessages.push({ role: 'assistant', content: streamContent });
  done(); // 恢复发送按钮
});
```

#### 会话列表渲染（DOM 创建而非 innerHTML）

```javascript
function renderSessions() {
  const el = $('#session-list');
  el.innerHTML = '';
  for (const s of sessions) {
    const d = document.createElement('div');  // 不支持 innerHTML
    d.className = 'session-item';
    d.textContent = s.title || '新对话';
    d.onclick = () => switchSess(s.id);
    el.appendChild(d);
  }
}
```

> ⚠️ 重要教训：我们花了大量时间调试发现，`innerHTML + querySelector` 在某些情况下会失败。改用以 `createElement + appendChild` 创建 DOM 元素后问题解决。

#### 会话置顶、重命名、删除

```javascript
function showSessionCtx(e, id) {
  // 弹出右键菜单：📍置顶 | ✏️重命名 | 🗑删除
  const m = document.createElement('div');
  m.className = 'session-ctx-menu';
  m.innerHTML = '...';
  m.onclick = ev => {
    if (act === 'pin') { api.pinSession(id); /* 刷新列表 */ }
    if (act === 'rename') { inlineRename(id); }
    if (act === 'delete') { /* 确认后删除 */ }
  };
}
```

#### 聊天搜索

```javascript
// 保存每个消息气泡的原始 HTML
document.querySelectorAll('.message-bubble').forEach(b => {
  if (!b.dataset.origHtml) b.dataset.origHtml = b.innerHTML;
  b.innerHTML = b.dataset.origHtml; // 还原
  // 用正则替换匹配文本为 <mark> 高亮
  b.innerHTML = b.innerHTML.replace(regex, '<mark>$1</mark>');
});
```

### 8.6 `agent.js` — Agent 窗口逻辑

每个 Agent 窗口（编码/审查/评分/架构）运行独立的 agent.js：

```javascript
const ROLE_CONFIG = {
  coder: {
    system: '你是一位资深软件工程师...',
    pipeline: 'review'  // 下一阶段是审查
  },
  reviewer: {
    system: '你是一位严格的代码审查专家...',
    pipeline: 'score',   // 下一阶段是评分
    maxCycles: 3         // 最多退回修复 3 次
  }
};
```

**审查流水线的关键逻辑：**

```javascript
// 审查完成后检查是否有严重问题
const severeSection = content.match(/## 🔴 严重问题/);
if (hasSevere && cycle < maxCycles) {
  // 有严重问题 → 退回编码 Agent 修复
  api.openAgent('coder', { task: fixTask, cycle: cycle + 1 });
} else {
  // 通过 → 进入评分阶段
  api.openAgent('scorer', { ... });
}
```

### 8.7 `i18n.js` — 多语言系统

```javascript
const I18N = {
  zh: { newChat: '新对话', send: '发送', ... },
  en: { newChat: 'New Chat', send: 'Send', ... }
};

function setLang(lang) {
  currentLang = lang;
  // 遍历所有带 ID 的 DOM 元素，替换文字
  renderAllText();
}
```

---

## 9. 启动应用

```bash
cd %USERPROFILE%\Desktop\DeepSeekChat
npm start
```

第一次启动会提示输入 API Key（点 ⚙️ 设置），之后会自动记住。

**桌面快捷方式**（可选）：

创建 `DeepSeek 工作台.bat`：
```bat
@echo off
cd /d "%~dp0DeepSeekChat"
start "" npm start
```

双击即可启动。

---

## 10. 功能使用指南

### 🔧 工具模式

1. 点输入框左边的 **🔧** 图标（变亮 = 开启）
2. 输入"在桌面创建一个计算器.html"
3. AI 会弹窗问你确认 → 点确定 → 文件直接创建

### 👨‍💻 Agent 窗口

- **编码 Agent**：写代码、修复 bug
- **审查 Agent**：检查安全漏洞和代码质量
- **评分 Agent**：给代码打分（0-100）
- **架构 Agent**：分析系统设计

点击代码块上的 🔍🔧🏗️ 按钮即可一键启动。

### 🔀 Git 操作

1. 打开项目（右侧栏 → 📁 文件 → 📂 打开项目）
2. 切换到 🔀 Git 标签
3. 看到分支名、变更文件列表
4. 提交/推送/拉取按钮可用

### 📋 任务管理

1. 右侧栏 → 📋 任务 → ＋ 新建
2. 填写标题、描述、标签
3. 点 ▶ 启动任务 → 自动创建编码流水线

### 💾 快照

1. 右侧栏 → ⚡ 工具 → 📸 保存当前状态
2. 起个名字 → 当前项目状态（任务、流水线）全部保存
3. 任何时候点 ↩ 恢复到快照时的状态

---

## 11. 开发历程——我们解决了哪些问题

以下是构建这个应用过程中遇到的主要挑战和解决方案：

### 🐛 Bug 1: 发送按钮始终灰色

**原因**：`init()` 是 async 函数，事件监听器在 `await` 之后才设置。

**解决**：所有 DOM 事件和流式监听在脚本顶层同步设置。

### 🐛 Bug 2: 消息显示位置混乱

**原因**：流式结束后 DOM 元素 ID 没有清除。

**解决**：在 `onStreamEnd` 中显式清除 ID。

### 🐛 Bug 3: preload.js 加载失败

**原因**：marked.js v18 是纯 ESM 模块，Electron 的 require() 无法加载。

**解决**：用内置 Markdown 渲染器替代 marked.js。

### 🐛 Bug 4: 会话列表完全不可见

**原因**：CSS 变量在浅色模式下侧边栏白底白字。

**解决**：全部改为 CSS 变量响应主题，`--side-bg` / `--side-text`。

### 🐛 Bug 5: 会话列表 innerHTML 方式不可靠

**原因**：`innerHTML + querySelector` 在某些情况下 querySelector 返回 null。

**解决**：改用 `createElement + appendChild + textContent` 纯 DOM 创建。

### 🐛 Bug 6: 工具模式 5 次重复弹窗

**原因**：用户取消后 AI 继续尝试调用工具。

**解决**：取消时 `return true` 直接退出工具循环。

### 🐛 Bug 7: 代码块内容被二次转义

**原因**：HTML 转义在代码高亮之前执行。

**解决**：先提取代码块→转义正文→对原始代码高亮→恢复。

---

## 12. 常见问题排查

### Q: 启动报错 `Cannot find module 'electron'`

```bash
npm install
```

### Q: 发送消息后无回复

检查 `config.json` 中的 API Key 是否正确，API Base 是否为 `https://api.deepseek.com`。

### Q: 工具模式无效

1. 确保 🔧 图标已点亮
2. 清楚地说出要做什么（如"保存到桌面"）
3. 出现确认弹窗时点"确认"

### Q: Git 功能不能用

确保系统安装了 Git：`git --version`。如果没有，去 https://git-scm.com 下载。

### Q: 代码运行 ▶ 没反应

需要安装对应的运行环境：
- Python 代码 → 安装 Python
- JavaScript 代码 → 系统自带 Node.js
- Shell 脚本 → Windows 需要 Git Bash 或 WSL

### Q: 如何更新 API Key

点 ⚙️ 设置 → 修改 API Key → 保存。

### Q: 数据存在哪里

```
C:\Users\你的用户名\AppData\Roaming\deepseek-chat\
├── config.json      # 配置
├── sessions\        # 对话记录（.json 文件）
├── projects\        # 项目状态
├── templates\       # 自定义模板
└── snapshots\       # 快照备份
```

---

## 📝 开源协议

MIT License — 自由使用、修改、分发。

---

## 🙏 致谢

- [Electron](https://electronjs.org) — 跨平台桌面应用框架
- [DeepSeek](https://deepseek.com) — 强大的 AI 模型 API
- [highlight.js](https://highlightjs.org) — 代码语法高亮库

---

> 这个应用是 100% 由 AI 辅助编写的。  
> 从第一行代码到最后一个 bug 修复，全程通过对话完成。  
> 希望能激励你——即使零基础，也能借助 AI 构建复杂的软件。
