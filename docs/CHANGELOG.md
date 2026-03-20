# claude-hub Changelog

## 2026-03-20 — Phase 1 MVP 완료

### 프로젝트 초기화
- pyproject.toml (Python 3.13+, FastAPI, Pydantic, uvicorn)
- Vite + React 19 + Tailwind CSS + TanStack Query 프론트엔드 초기화
- git init + 초기 커밋

### 백엔드 Core Utils (Task 2)
- `utils/paths.py` — ClaudePaths, 프로젝트 경로 인코딩/디코딩
- `utils/frontmatter.py` — SKILL.md, Agent .md 파서
- `utils/filelock.py` — fcntl 기반 advisory lock
- `utils/diff.py` — unified diff 생성
- 21 tests

### Pydantic Models (Task 3)
- common, skill, plugin, agent, settings, hook, mcp 모델 정의

### Services (Task 4-6)
- `services/backup.py` — FIFO 백업/복원, history.json 이력 관리
- `services/scanner.py` — ~/.claude/ 스캔, MCP env 마스킹
- `services/editor.py` — 원자적 쓰기, mtime 충돌 감지 (ConflictError)
- `services/validator.py` — settings.json / SKILL.md 유효성 검증
- 59 tests (누적)

### FastAPI Routers (Task 7-10)
- Dashboard API (GET /api/dashboard, /api/health)
- Skills CRUD API (list/get/create/update/delete)
- Settings API (GET/PUT with mtime conflict detection)
- CLAUDE.md API (list/get/update by scope)
- 73 tests (누적)

### Frontend (Task 11-14)
- App Shell: Sidebar (5그룹 네비게이션), React Router
- Dashboard: 4개 stat 카드 + Health Check 결과
- Skills: 필터탭 + 검색 + CRUD + Monaco Editor
- Settings: Global/Local/Raw JSON 탭
- CLAUDE.md: scope별 탭 + Monaco Editor
- npm run build 성공 (JS 299KB, CSS 15KB)

### Build Pipeline (Task 15)
- scripts/build.sh — 프론트엔드 빌드 + static 복사
- CLI 엔트리포인트 (`uv run claude-hub`)
- build.sh 경로 해석 버그 수정
