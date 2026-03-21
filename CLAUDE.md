# claude-hub

Claude Code의 전체 harness 구성을 시각적으로 관리하는 로컬 웹 대시보드.

## 현재 상태

- **Phase 1 (MVP)**: 완료 (2026-03-20) — Dashboard, Skills, Settings, CLAUDE.md
- **Phase 2 (Extensions & Config)**: 완료 (2026-03-20) — Plugins, Agents, Commands, Hooks, MCP, Keybindings
- **Phase 3 (Content & Store)**: 완료 (2026-03-20) — Memory, Teams, Marketplace
- **Phase 4 (Polish)**: 완료 (2026-03-20) — Backup History, Preview Diff, Health Check, README, PyPI
- **Phase 5 (Native App + Stats)**: 완료 (2026-03-21) — pywebview 앱, SQLite 사용 통계, macOS 트레이
- **Phase 6 (UX 개선)**: 완료 (2026-03-21) — Info 툴팁, Hit 통계 탭, AI 분석, 스킬 템플릿
- **백엔드**: FastAPI + 134 tests passing
- **프론트엔드**: Vite + React 19 + Tailwind + 1826 modules, npm run build 성공
- **PyPI 빌드**: uv build 성공 (sdist + wheel)
- **macOS App**: /Applications/claude-hub.app (메뉴바 트레이 지원)

## 기술 스택

- Backend: Python 3.13+ / FastAPI / Pydantic v2 / uvicorn
- Frontend: Vite + React 19 + Tailwind CSS + Monaco Editor
- 패키징: PyPI (uv)
- 실행: `uv run claude-hub`

## 핵심 설계 결정

- 로컬 전용 도구 (127.0.0.1 바인딩)
- ~/.claude/ 파일시스템 직접 읽기/쓰기 (쓰기 전 항상 백업)
- 플러그인 설치/삭제는 `claude plugin` CLI 래핑
- mtime 기반 파일 충돌 감지 (409 Conflict)
- MCP 환경변수 API 레벨 마스킹

## 실행 방법

```bash
bash scripts/build.sh   # 프론트엔드 빌드
uv run claude-hub        # 서버 시작 (localhost:3847)
```

## 주요 문서

- 설계 스펙: `docs/superpowers/specs/2026-03-19-claude-hub-design.md`
- 구현 계획: `docs/superpowers/plans/2026-03-19-claude-hub.md`
- 진행 이력: `docs/CHANGELOG.md`
- 실패 기록: `docs/FAILURES.md`
- 의사결정: `docs/DECISIONS.md`
- 로드맵: `docs/ROADMAP.md`
