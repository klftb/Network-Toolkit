# Network Toolkit (网络运维工具箱)

![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20WeChat-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Network Toolkit 是一款极简、现代化的全栈网络诊断、运维辅助与安全密码管理工具。它将原本散落在各个命令行黑框中的高频网络指令（Ping、MTR、端口扫描、FTP/SFTP、Wi-Fi 频谱分析等）与安全凭据管理集成到了一个拥有极佳交互体验的应用中，并提供桌面客户端与微信小程序双端协同体验。

无论您是网络工程师、系统运维、后端开发者，还是技术爱好者，这款开箱即用的工具都能成为您日常工作中的常驻利器。

---

## 📥 快速下载安装 (Windows / macOS)

无需配置开发环境，您可以直接前往 GitHub Releases 下载官方预编译好的最新版本：

- 🚀 **最新版本发布页**：[Network Toolkit v1.4.0 Release](https://github.com/klftb/Network-Toolkit/releases/tag/v1.4.0)
- 📥 **Windows 安装包直接下载**：[Network.Toolkit.Setup.1.4.0.exe](https://github.com/klftb/Network-Toolkit/releases/download/v1.4.0/Network.Toolkit.Setup.1.4.0.exe) (~95 MB)

---

## ✨ 核心功能特性

### 🔐 1. 密码管理与安全保险箱 (全新增强)
- **KeePass (.kdbx) 全平台双向互通**：
  - 导出/导入均采用标准 KeePass 加密数据库格式（强制配置 `AES KDF` 密钥派生算法）；
  - 导出的 `.kdbx` 备份可在 **KeePass 2.x、KeePassXC、KeePassDX、AuthPass** 等全平台工具中无缝打开、管理与互转。
- **固定主访问密码与安全防窥**：
  - 首次进入强制配置固定主访问密码，采用 SHA-256 + 16 字节随机盐安全哈希，本地不保存明文密码；
  - 锁定状态下密码本完全隐藏，解锁后方可浏览管理，支持随时一键上锁与在线修改主密码。
- **5 分钟无操作自动锁定屏**：
  - 智能感知物理键盘、鼠标移动及滚动事件，闲置满 5 分钟自动上锁，保护离开工位时的隐私安全。
- **随机强密码生成引擎**：
  - 支持大写字母、小写字母、数字、特殊符号自由组合与长度滑块调节，实时呈现 5 级密码安全强度评估。
- **现代化无感交互**：
  - 彻底去除浏览器原生阻塞弹窗，采用高颜值 Toast 浮层提示，根治 Windows 客户端按键焦点丢失问题；
  - 页面排版精简纯粹，操作栏位常驻呈现高辨识度【编辑】与【删除】按钮，无需横向滚动一览无余。

### 📡 2. Wi-Fi 信道扫描与频谱分析
- **深度扫描周围环境 AP**：支持发现隐藏 SSID，获取 BSSID、信号强度、加密方式与信道信息。
- **跨平台中文无损适配**：彻底解决 Windows 下 `netsh` 命令的 GBK 编码乱码问题，完美呈现多语言 SSID。
- **2.4G / 5G 精准动态频谱**：内置无线电波长计算引擎，支持动态频谱折线图与信道信号热力评估。

### 🚀 3. 全能文件传输 (FTP / SFTP / TFTP)
- **实时速度与流控监控**：拥有极其平滑的进度条与实时 KB/s、MB/s 速度监控。
- **动态任务流控**：基于底层流控拦截，支持对正在进行的传输任务 **暂停、继续、强制终止**。
- **界面状态保持 (Keep-Alive)**：在文件传输中随意切换到其他网络诊断模块，传输任务与连接状态永不丢失。

### 🌐 4. 路由追踪与网络侦探 (MTR / Tracert / Ping)
- **连续诊断 MTR 模式**：支持普通 Tracert 与连续诊断 MTR，自动过滤云端防火墙 TTL 拦截节点，精准反馈链路丢包率与跳动。
- **高并发 Ping / TCPing 探测**：支持自定义发包频率、包大小与超时时间，实时输出流式延迟数据。
- **IP / 端口高并发扫描**：支持多目标网段、常用端口组与自定义端口范围批量快速扫描。
- **子网掩码计算器 (CIDR)**：IP/掩码/可用主机数/网络广播地址实时换算。

### 🔍 5. 网络扩展与运维辅助
- **公网 IP 精准获取**：多源聚合检测（国内外节点穿透代理出口），内置防阻断机制。
- **Whois 查询 & 国际/国内公网 DNS 测速**：直观对比多组主流 DNS 响应延迟。
- **离线网络拓扑白板**：支持现场绘制拓扑图、记录网络配置备忘。
- **文本批处理与比对**：快速处理设备配置文本、提取 IP 地址及对比配置差异。

### 📱 6. 微信小程序多端协同 (WeApp Client)
- 项目内置基于 Taro 框架的轻量级微信小程序客户端（位于 `weapp-client/`），支持在移动端进行快捷网络诊断、端口扫描与工具查询。

---

## 💻 本地开发与构建指南

### 1. 环境准备
- 推荐使用 [Node.js](https://nodejs.org/) (建议版本 **v18** 或 **v20**)。

### 2. 克隆仓库与安装依赖
```bash
git clone https://github.com/klftb/Network-Toolkit.git
cd Network-Toolkit
npm install
```

### 3. 启动本地全栈开发环境
```bash
npm run dev
```
> 服务将在 `http://localhost:3005` 启动，并在开发模式下通过 Vite 中间件提供热更新。

### 4. 编译打包桌面端安装包
```bash
# 构建 Windows 64位 安装包 (.exe) 与绿色免安装版 (release/win-unpacked)
npm run build:win

# 构建 macOS 应用程序 (.dmg)
npm run build:mac
```

---

## 📜 开源协议与免责声明

本项目基于 **MIT License** 开源。

> - 这是一个源于日常网络运维真实痛点而打造的开源工具箱，出于开源精神分享给社区。
> - 本软件仅供合法的网络维护、故障排查、系统管理与安全检测使用，严禁用于任何未经授权的入侵、攻击或破坏行为。使用者须自行对使用行为及可能产生的后果承担全部法律责任。
