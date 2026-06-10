# Network Toolkit (网络运维工具箱)

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Network Toolkit 是一款极简、现代化的全栈网络诊断与运维辅助桌面端工具。它将原本散落在各个命令行黑框中的高频网络指令（Ping、MTR、FTP 等）集成到了一个拥有极佳交互体验的桌面应用程序中。

无论您是网络工程师、后端开发者，还是技术爱好者，这款开箱即用的免安装绿色工具都能成为您电脑里的常驻利器。

## 📥 快速下载使用

如果您只想使用本软件，无需关心代码，可以直接下载编译好的免安装版本：
*(您可以前往 GitHub Releases 页面下载最新的 `Network Toolkit Setup.exe` 或免安装绿色版)*

## ✨ 核心功能特性

- **现代仪表盘**: 响应式布局，分类清晰，支持最近使用记录追踪。
- **Wi-Fi 信道扫描与频谱分析**:
  - 深度扫描周围环境 AP（支持发现隐藏 SSID）。
  - **跨平台中文无损适配**: 彻底解决 Windows 下 netsh 命令的 GBK 乱码，完美展示信道、强度、认证方式等多语言元数据。
  - **2.4G/5G 精准探测**: 内置无线电波长计算引擎，支持动态频谱折线图与信号热力评估。
- **全能文件传输 (FTP / SFTP / TFTP)**:
  - 拥有极其平滑的进度条与实时 MB/s 速度监控。
  - 强力流控引擎支持中途 **暂停、继续、强制终止**。
  - **离线状态保持**: 随意切换到其它界面再切回来，您的传输任务与状态永远不会丢失。
- **路由追踪 (MTR / Tracert)**:
  - 支持普通 Tracert 与 **连续诊断 MTR 模式**，自动过滤云端防火墙 TTL 拦截节点，精准反馈链路丢包率与延迟跳动。
- **基础网络侦探**: 包含 Ping / TCPing 存活探测、端口扫描、子网掩码计算 (CIDR)。
- **公网 IP 精准获取**: 智能检测穿透网关与代理出口，内置 User-Agent 防阻断机制。
- **离线白板与工具**: 随时记录网络拓扑、DNS 查询与生成日常批处理脚本。

## 💻 本地开发指南

如果您希望参与二次开发或自行从源码构建，请参考以下步骤。

### 1. 环境准备

请确保本地已经安装了 [Node.js](https://nodejs.org/) (建议版本 v18 或以上)。

### 2. 安装依赖

```bash
git clone https://github.com/klftb/Network-Toolkit.git
cd Network-Toolkit
npm install
```

### 3. 本地开发调试

```bash
npm run dev
```

### 4. 编译打包桌面端

```bash
npm run build:win   # 构建 Windows .exe 安装包与绿色版
npm run build:mac   # 构建 macOS .dmg 文件
```

## 📜 免责声明与开源协议

本项目基于 **MIT License** 开源。
> 这是一个基于个人日常运维痛点而开发的自用工具集，出于开源精神分享给社区使用。代码实现可能存在不完美之处，欢迎大家友好交流或提交 Pull Request。
> 本软件仅供合法的网络维护与安全检测使用，禁止用于任何非法扫描或破坏用途。
