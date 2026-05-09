#!/bin/bash

# Git Commit Message Hook
# Validates commit messages against Conventional Commits format defined in CLAUDE.md

COMMIT_MSG_FILE=$1

# Skip if no commit message
if [ -z "$COMMIT_MSG_FILE" ] || [ ! -f "$COMMIT_MSG_FILE" ]; then
    echo "Error: Invalid commit message file"
    exit 1
fi

COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Skip if no commit message
if [ -z "$COMMIT_MSG" ]; then
    echo "Error: Empty commit message"
    exit 1
fi

# Extract the first line (subject)
FIRST_LINE=$(echo "$COMMIT_MSG" | head -n1)

# Pattern: <type>(<scope>): <subject>
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\\([a-zA-Z0-9_,-]+\\): .+$"

if ! echo "$FIRST_LINE" | grep -qE "$PATTERN"; then
    echo "Error: Commit message does not follow Conventional Commits format"
    echo ""
    echo "Expected format: <type>(<scope>): <subject>"
    echo "  type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
    echo "  scope: frontend, backend, api, dbus, config, deps, ui, core, utils"
    echo ""
    echo "Examples:"
    echo "  feat(frontend): 添加用户登录功能"
    echo "  fix(backend): 修复数据库连接泄漏"
    echo "  refactor(core): 重构文件处理模块"
    echo ""
    echo "Your commit message:"
    echo "  $FIRST_LINE"
    exit 1
fi

# Check that subject does NOT end with 。 or . or !
SUBJECT=$(echo "$FIRST_LINE" | sed 's/^[^:]*: *//')
if echo "$SUBJECT" | grep -qE '[。.!?]$'; then
    echo "Error: Subject should not end with punctuation (。.!?), remove trailing punctuation"
    echo "Your subject: $SUBJECT"
    exit 1
fi

exit 0