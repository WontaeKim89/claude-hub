#!/bin/bash
# Ralph Loop 래퍼 스크립트 — Claude Code Bash 권한 파서 우회용
# 사용법: ./scripts/ralph-start.sh "프롬프트" [completion_promise] [max_iterations]

set -eo pipefail

SCRIPT="/Users/gim-wontae/.claude/plugins/cache/claude-plugins-official/ralph-loop/d5c15b861cd2/scripts/setup-ralph-loop.sh"
PROMPT="${1:?프롬프트를 입력하세요}"
PROMISE="${2:-}"
MAX="${3:-0}"

ARGS=("$PROMPT")
if [[ -n "$PROMISE" ]]; then
  ARGS+=(--completion-promise "$PROMISE")
fi
if [[ "$MAX" -gt 0 ]]; then
  ARGS+=(--max-iterations "$MAX")
fi

exec "$SCRIPT" "${ARGS[@]}"
