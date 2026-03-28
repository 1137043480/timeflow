# ⏱ TimeFlow — 智能时间管理桌面应用

<p align="center">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" />
  <img src="https://img.shields.io/badge/Electron-33-purple" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

一款帮助你**准确评估任务时间**的桌面应用。通过记录预估时间与实际用时的差异，结合 AI 算法，逐步提升你的时间感知能力。

## ✨ 功能特色

- 📋 **任务看板** — 三列 Kanban 视图（待办/进行中/已完成），支持搜索和分类筛选
- ⏱ **精确计时** — 开始/暂停/完成，支持多次 session 累加
- 📊 **时间报表** — 每日/每周统计，预估 vs 实际散点图，准确度趋势分析
- 🏷️ **分类标签** — 自定义分类（颜色+图标）和标签
- 🔔 **智能提醒** — 80%/100% 预估时间到达时系统通知
- 🤖 **AI 辅助预估** — 本地统计算法 + LLM 双引擎，越用越准
- ☁️ **iCloud 同步** — 数据自动存储到 iCloud Drive（macOS），换机不丢失
- 🌗 **深色/浅色主题** — 深色玻璃拟态设计，支持主题切换

## 📸 截图

<p align="center">
  <img src="screenshots/main.png" width="800" />
</p>

## 🚀 快速开始

### 安装运行

```bash
git clone https://github.com/1137043480/timeflow.git
cd timeflow
npm install
npm start
```

### 打包为桌面应用

```bash
# macOS
npm run build

# 生成的 .dmg 在 dist/ 目录
```

### 配置 AI 预估（可选）

1. 打开应用 → 设置
2. 启用 "LLM 辅助预估"
3. 填入兼容 OpenAI API 的 Base URL 和 API Key
4. 支持任何 OpenAI 兼容的模型（GPT-4o、Claude 等）

## 🏗️ 技术栈

| 技术 | 用途 |
|------|------|
| Electron 33 | 桌面应用框架 |
| 原生 HTML/CSS/JS | 前端（组件化架构） |
| Chart.js | 数据可视化 |
| JSON 文件存储 | 本地数据持久化 |
| OpenAI API | AI 时间预估（可选） |

## 📁 项目结构

```
timeflow/
├── main.js              # Electron 主进程 + IPC + LLM
├── preload.js           # 安全 API 桥接
├── package.json
└── src/
    ├── index.html       # 主页面
    ├── styles/          # CSS 设计系统
    └── js/
        ├── app.js       # 入口
        ├── store.js     # 数据层
        ├── components/  # UI 组件
        └── utils/       # 工具函数 + AI 预估算法
```

## 🤖 AI 预估原理

**双引擎设计：**

1. **本地统计算法**（离线可用）
   - 按分类/标签/关键词匹配历史任务
   - 加权移动平均计算预估偏差率
   - 近期数据权重更高

2. **LLM 增强**（可选）
   - 理解任务描述的语义复杂度
   - 综合历史数据给出智能预估
   - 提供文字解释和置信度评级

## 📄 License

MIT

## 🙏 致谢

本项目由 AI 辅助开发，感谢开源社区的支持。
