#!/bin/bash

# OpenList Finder Development Commands Reference
# Usage: bash .claude/hooks/dev-commands.sh [command]

COMMANDS_FILE=".claude/project-commands.json"

show_help() {
    cat << 'EOF'
OpenList Finder 开发命令参考

用法: bash .claude/hooks/dev-commands.sh [command]

可用命令:
  install      安装所有项目依赖
  dev          启动 Tauri 开发服务器和前端热重载
  build        仅构建前端（Vite）
  build:release 构建生产发布版本
  clean        清理 Rust 编译缓存
  check        快速检查 Rust 代码类型错误
  fmt          格式化 Rust 代码
  clippy       运行 Rust linter 检查代码质量
  test         运行 Rust 单元测试

工作流程:
  日常开发:    bun tauri dev
  提交前:      cargo fmt && cargo clippy && cargo test
  发布前:      bun tauri build
  问题排查:    cargo clean && cargo check

完整参考: cat .claude/project-commands.json
EOF
}

case "$1" in
    install)
        echo "执行: bun install"
        bun install
        ;;
    dev)
        echo "执行: bun tauri dev"
        echo "启动开发服务器，按 Ctrl+C 停止"
        bun tauri dev
        ;;
    build)
        echo "执行: bun run build"
        bun run build
        ;;
    build:release)
        echo "执行: bun tauri build"
        echo "构建生产版本..."
        bun tauri build
        ;;
    clean)
        echo "执行: cargo clean"
        cargo clean
        ;;
    check)
        echo "执行: cargo check"
        cargo check
        ;;
    fmt)
        echo "执行: cargo fmt"
        cargo fmt
        ;;
    clippy)
        echo "执行: cargo clippy"
        cargo clippy
        ;;
    test)
        echo "执行: cargo test"
        cargo test
        ;;
    workflow)
        echo "常用工作流程:"
        echo ""
        echo "日常开发:"
        echo "  bun tauri dev"
        echo ""
        echo "提交前检查:"
        echo "  cargo fmt && cargo clippy && cargo test"
        echo ""
        echo "发布前构建:"
        echo "  bun tauri build"
        echo ""
        echo "问题排查:"
        echo "  cargo clean && cargo check"
        ;;
    -h|--help|help|"")
        show_help
        ;;
    *)
        echo "未知命令: $1"
        echo ""
        show_help
        exit 1
        ;;
esac