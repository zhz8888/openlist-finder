# OpenList Finder

基于 Tauri 2 构建的跨平台文件管理工具，集成 OpenList 服务与 Meilisearch 搜索引擎，支持 MCP 协议供 AI 工具调用。

## 功能特性

- **OpenList 集成** — 连接 OpenList 服务器，浏览和管理远程文件系统（列表、重命名、删除、复制、移动）
- **Meilisearch 搜索** — 将文件元数据同步至 Meilisearch 索引，实现快速全文检索（实验性特性）
- **MCP 服务** — 通过 stdio 暴露文件操作与搜索能力，供 AI 工具集成调用
- **多服务器管理** — 支持配置多个 OpenList 服务器，Token 认证
- **主题系统** — GitHub Light / GitHub Dark / 跟随系统，基于 DaisyUI 主题
- **文件编辑** — 在线预览与编辑文本文件，支持图片预览
- **跨平台** — 支持 Windows（NSIS/MSI）和 macOS（DMG）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + TypeScript 5.8 |
| 构建 | Vite 7 |
| UI | DaisyUI 5 + Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 路由 | React Router DOM 7 |
| 后端 | Rust（reqwest、serde、tokio） |
| 持久化 | Tauri Plugin Store |

## 项目结构

```
openlist-finder/
├── src/                          # 前端源码
│   ├── components/               # UI 组件
│   │   ├── Breadcrumb.tsx        # 面包屑导航
│   │   ├── ErrorBoundary.tsx     # 错误边界
│   │   ├── FileList.tsx          # 文件列表与操作
│   │   ├── Sidebar.tsx           # 侧边栏
│   │   ├── ThemeProvider.tsx     # 主题提供者
│   │   └── ToastContainer.tsx    # 通知容器
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useFileBrowser.ts     # 文件浏览逻辑
│   │   └── useTheme.ts           # 主题切换
│   ├── pages/                    # 页面
│   │   ├── HomePage.tsx          # 主页（文件浏览）
│   │   └── SettingsPage.tsx      # 设置页
│   ├── services/                 # API 服务
│   │   ├── openlist.ts           # OpenList API 客户端
│   │   └── meilisearch.ts        # Meilisearch API 客户端
│   ├── stores/                   # Zustand 状态
│   │   ├── fileBrowserStore.ts   # 文件浏览状态
│   │   ├── searchStore.ts        # 搜索状态
│   │   ├── serverStore.ts        # 服务器配置
│   │   ├── settingsStore.ts      # 应用设置
│   │   └── toastStore.ts         # 通知状态
│   ├── types/                    # TypeScript 类型定义
│   └── styles/
│       └── index.css             # 全局样式与 DaisyUI 主题
├── src-tauri/                    # Rust 后端
│   └── src/
│       ├── commands/             # Tauri 命令
│       │   ├── openlist.rs       # OpenList 操作命令
│       │   ├── meilisearch.rs    # Meilisearch 操作命令
│       │   └── mcp_server.rs     # MCP 服务实现
│       ├── config/               # 应用配置
│       ├── models/               # 数据模型
│       ├── services/             # 后端服务层
│       └── lib.rs                # Tauri 入口
└── package.json
```

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建发布

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录下。

## 配置

### OpenList 服务器

在设置页面添加 OpenList 服务器地址和 Token：

- **服务器地址** — OpenList 实例的 URL（如 `https://fox.oplist.org`）
- **Token** — 认证令牌

### Meilisearch（实验性）

需在设置中启用实验性特性后配置：

- **Host** — Meilisearch 服务地址（默认 `http://localhost:7700`）
- **API Key** — Meilisearch API 密钥
- **Index UID** — 索引名称（默认 `openlist`）
- **同步策略** — 手动 / 定时

### MCP 服务

MCP 服务通过 stdio 传输协议运行，可被支持 MCP 的 AI 工具集成。提供的工具包括：

| 工具 | 说明 |
|------|------|
| `list_files` | 列出目录文件 |
| `get_file_info` | 获取文件详情 |
| `rename_file` | 重命名文件 |
| `delete_file` | 删除文件 |
| `copy_file` | 复制文件 |
| `move_file` | 移动文件 |
| `edit_file` | 编辑文件内容 |
| `search_files` | 搜索文件（需 Meilisearch） |
| `sync_index` | 同步索引（需 Meilisearch，实验性） |
| `get_index_status` | 获取索引状态（需 Meilisearch，实验性） |

## 许可证

本项目基于 [GNU Affero General Public License v3.0](LICENSE) 许可证发布。
