# Phase 7: WOW Features Design Spec

6가지 핵심 기능을 3단계로 구현.

## Phase 7A: Harness Wizard + AI Skill Generator

### 1. Harness Wizard

프로젝트를 분석하여 맞춤 CLAUDE.md를 자동 생성하고, Hooks/MCP를 제안.

#### 플로우
1. 프로젝트 선택 (기존 목록 또는 새 경로 입력)
2. Claude CLI가 프로젝트 분석 (README.md, package.json/pyproject.toml, 파일 구조)
3. 전역 CLAUDE.md + 기존 스킬 목록 참조 (중복 방지)
4. 제안 미리보기 (체크박스로 항목별 선택)
5. 선택 항목 적용 (자동 백업)

#### AI가 참조하는 것
- 프로젝트 README.md, 패키지 매니저 파일 (tech stack 감지)
- 프로젝트 파일 구조 (src/, tests/, docs/)
- 전역 ~/.claude/CLAUDE.md (개발자의 기존 지시문)
- 설치된 스킬/플러그인 목록

#### AI가 생성하는 것
- 프로젝트 맞춤 CLAUDE.md (전역과 중복 없이 프로젝트 고유 내용만)
- Hooks 제안 (테스트 프레임워크 감지 시 자동 테스트 hook 등)
- MCP 서버 제안 (GitHub repo면 github MCP 등)

#### API
```
POST /api/wizard/analyze    — 프로젝트 경로 → Claude CLI 분석 → 추천 결과
POST /api/wizard/apply      — 선택된 항목 적용
```

#### UI
- 사이드바에 "Wizard" 페이지 추가 (또는 Dashboard에 진입점)
- Step 1: 프로젝트 셀렉터 (기존 프로젝트 + 경로 입력)
- Step 2: 분석 결과 + 체크박스 diff 미리보기
- Step 3: "Monaco에서 편집" 또는 "선택 항목 적용" 버튼

### 2. AI Skill Generator

자연어 대화로 SKILL.md를 자동 생성.

#### 진입점
Skills 페이지 → "+ 새 스킬" → 팝업 상단 "직접 작성 / AI 생성" 탭 전환

#### 대화형 플로우
1. AI: "어떤 스킬을 만들고 싶으신가요?"
2. 사용자: 목적 설명 (자연어)
3. AI: 추가 질문 (pill 버튼 선택지)
   - 트리거 조건 (자동/수동)
   - 대상 범위
   - 제약 조건
4. AI: SKILL.md 생성 → 코드 블록 미리보기
5. 사용자: "Monaco에서 편집" 또는 "스킬 저장"

#### API
```
POST /api/wizard/generate-skill  — 대화 히스토리 → Claude CLI → SKILL.md 생성
```

#### UI
- 채팅 인터페이스 (보라색 AI 아바타, 사용자 메시지 우측)
- AI 질문에 pill 버튼 선택지 제공
- 생성된 SKILL.md를 보라색 보더 코드 블록으로 미리보기
- 하단 입력창 + 전송 버튼

#### 백엔드 로직
- 대화 상태는 프론트엔드에서 관리 (messages 배열)
- 각 전송 시 전체 대화 히스토리 + 전역 CLAUDE.md + 기존 스킬 목록을 Claude CLI에 전달
- Claude에게 "SKILL.md 포맷으로 응답하라" 지시

---

## Phase 7B: Live Session Monitor + Cost Intelligence

### 3. Live Session Monitor

현재 Claude Code 세션의 도구 호출을 실시간으로 시각화.

#### 데이터 수집
- PostToolUse hook → usage.db 기록 + WebSocket push
- 세션 JSONL 파일 watchdog 감시 (신규 라인 감지)

#### UI (사이드바 "모니터" 페이지)
- 세션 헤더: 프로젝트명, 경과시간, 턴 수, LIVE 표시
- 이벤트 스트림 (타임라인):
  - 타임스탬프 + 컬러 도트 + 도구명 + 상세
  - 도구별 색상: Skill=보라, Read=teal, Grep=emerald, Agent=amber, Write=red, Bash=emerald
  - 현재 진행 중 항목: 펄스 애니메이션
- 하단 실시간 카운터: 토큰 in/out, 도구 호출 수, 예상 비용

#### API
```
WebSocket /api/monitor/live  — 실시간 이벤트 스트리밍
GET /api/monitor/session     — 현재 세션 정보
```

#### 백엔드
- watchdog으로 `~/.claude/projects/**/*.jsonl` 파일 변경 감시
- 새 라인 추가 시 파싱 → WebSocket broadcast
- 세션 감지: `~/.claude/sessions/*.json`에서 활성 세션 PID 확인

### 4. Cost Intelligence

토큰 사용량과 예상 비용을 시각화하는 대시보드.

#### 데이터 소스
- 세션 JSONL 로그의 `usage` 필드에서 토큰 수 추출
- 모델별 가격: opus=$15/M in $75/M out, sonnet=$3/M in $15/M out, haiku=$0.25/M in $1.25/M out

#### UI (대시보드 또는 별도 "비용" 페이지)
- 기간 선택: 7일 / 30일 / 전체
- 요약 카드 4개: 총 토큰, 예상 비용, 세션 수, 도구 호출 수
- 프로젝트별 비용 바 차트
- 스킬별 비용 그리드
- 면책 문구: "비용은 추정치입니다"

#### API
```
GET /api/cost/summary?days=7     — 기간별 요약
GET /api/cost/by-project?days=7  — 프로젝트별
GET /api/cost/by-skill?days=7    — 스킬별
```

#### 백엔드
- 세션 로그 파서 확장: usage 필드에서 input_tokens, output_tokens 추출
- usage.db에 token_in, token_out 컬럼 추가 (또는 별도 cost_events 테이블)
- 모델별 가격표로 비용 환산

---

## Phase 7C: Harness Templates + Config Diff & Sync

### 5. Harness Templates

프로젝트별 harness 설정을 템플릿으로 저장/공유/적용.

#### 템플릿 구조
```json
{
  "name": "React + TypeScript Starter",
  "description": "...",
  "version": "1.0.0",
  "author": "...",
  "claude_md": "# React Project\n...",
  "hooks": {...},
  "mcp_servers": {...},
  "recommended_skills": ["frontend-design", "test-driven-development"]
}
```

#### 저장 위치
- `~/.claude-hub/templates/` 디렉토리에 JSON 파일
- 커뮤니티 템플릿: GitHub repo에서 fetch (향후)

#### UI (사이드바 "템플릿" 페이지)
- 3개 탭: 커뮤니티 / 내 템플릿 / 현재 설정 내보내기
- 템플릿 카드: 이름, 설명, 포함 구성요소 태그, "적용" 버튼
- 적용 시: Harness Wizard와 동일한 체크박스 미리보기 패턴
- 내보내기: 현재 프로젝트의 CLAUDE.md + hooks + MCP를 JSON으로 패키징

#### API
```
GET    /api/templates           — 템플릿 목록
GET    /api/templates/{name}    — 템플릿 상세
POST   /api/templates           — 새 템플릿 저장
DELETE /api/templates/{name}    — 템플릿 삭제
POST   /api/templates/export    — 현재 설정 → 템플릿 내보내기
POST   /api/templates/{name}/apply  — 템플릿 적용 (프로젝트 지정)
```

### 6. Config Diff & Sync

프로젝트 간 Claude 설정을 비교하고 동기화.

#### UI (사이드바 "비교" 페이지 또는 대시보드 내)
- 두 프로젝트 드롭다운 선택
- 비교 테이블: 구성 요소별 (CLAUDE.md, Memory, Hooks, MCP, Settings)
  - 상태: 동일(emerald) / 다름(amber) / 누락(red)
  - 액션: "diff 보기" → DiffViewer, "A→B 복사"
- 하단: "누락 항목만 동기화" / "전체 동기화 A→B" 버튼

#### API
```
POST /api/config/diff  — 두 프로젝트 경로 비교 → 항목별 상태
POST /api/config/sync  — A의 설정을 B로 복사 (선택 항목)
```

#### 비교 대상
| 구성 요소 | 비교 방법 |
|-----------|-----------|
| CLAUDE.md | 파일 존재 여부 + 내용 diff |
| Memory | memory/ 파일 목록 + 개수 비교 |
| Hooks | settings.json hooks 섹션 비교 |
| MCP | settings.json mcpServers 비교 |
| Settings | model, permissions 등 주요 필드 비교 |

---

## 구현 순서

| Phase | 기능 | 예상 난이도 |
|-------|------|------------|
| 7A-1 | Harness Wizard | 중 (Claude CLI + 파일 분석) |
| 7A-2 | AI Skill Generator | 중 (채팅 UI + Claude CLI) |
| 7B-1 | Live Session Monitor | 상 (WebSocket + watchdog) |
| 7B-2 | Cost Intelligence | 중 (로그 파서 확장 + 비용 계산) |
| 7C-1 | Harness Templates | 하 (CRUD + JSON 파일) |
| 7C-2 | Config Diff & Sync | 중 (파일 비교 + 복사 로직) |

## 사이드바 네비게이션 추가

| 그룹 | 추가 항목 |
|------|-----------|
| Overview | Dashboard (기존) |
| **Tools** (신규) | Wizard, Skill Lab (AI 생성은 Skills 내 탭) |
| **Monitor** (신규) | Live Monitor, Cost |
| Extensions | Skills, Plugins, ... (기존) |
| Configuration | Settings, Hooks, ... (기존) |
| Content | CLAUDE.md, Memory, ... (기존) |
| **Sync** (신규) | Templates, Config Diff |
| Store | Marketplace (기존) |
