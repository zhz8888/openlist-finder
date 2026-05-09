# OpenList Finder

基于 Tauri 2 的跨平台文件管理工具，集成 OpenList 服务与 Meilisearch 搜索引擎，支持 MCP 协议供 AI 工具调用。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + TypeScript 5.8 |
| 构建 | Vite 7 + Bun |
| UI | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 后端 | Rust |

## Git 提交规范

采用 Conventional Commits 格式。

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | 缺陷修复 |
| docs | 文档变更 |
| style | 代码格式（不影响运行） |
| refactor | 重构（非功能变更） |
| perf | 性能优化 |
| test | 测试相关 |
| build | 构建或依赖变更 |
| ci | CI 配置变更 |
| chore | 其他变更 |
| revert | 回退提交 |

### 作用范围

frontend、backend、api、dbus、config、deps、ui、core、utils

### 规则

- type/scope 使用英文，subject 使用中文
- subject 末尾不加句号
- body 使用中文，描述变更内容
- footer 用于关联 issue 或 Breaking Change 说明

### 示例

```
feat(openlist): 添加令牌刷新机制处理失效的认证

实现自动刷新过期 Token 的功能
```

## 开发命令

```bash
bun install          # 安装依赖
bun tauri dev        # 开发模式
bun tauri build      # 构建发布
bun run build        # 仅构建前端
```

## 环境要求

- Node.js >= 24
- Rust >= 1.90
- Tauri CLI 2.x
