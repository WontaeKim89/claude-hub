# Phase 6: UX 개선 6건 Design Spec

## 개선 항목

1. Info 호버 툴팁 — 각 페이지 제목 옆 ℹ 아이콘, 개념/사용법 안내
2. 카드 클릭 네비게이션 — Dashboard 카드 → 해당 페이지 이동
3. 백업/Sync 설명 팝업 — 버튼 옆 ℹ 클릭 시 기능 설명
4. 스킬 생성 템플릿 — New Skill 팝업에 SKILL.md 포맷 프리셋
5. 대시보드 Hit 통계 탭 — Skills/Plugins/Agents 탭별 히트 바 차트
6. 사용패턴 AI 분석 — Claude CLI 기반 전체 비교 분석 + 유용성 랭킹

## 1. Info 호버 툴팁

### 컴포넌트: InfoTooltip

```tsx
// components/shared/InfoTooltip.tsx
Props: { title: string; description: string; detail?: string }
```

- 각 페이지 PageHeader 옆에 `ℹ` 아이콘 (Info lucide, 14px, zinc-500)
- hover 시 emerald 보더 팝업 (280px 너비)
- 내용: 제목(emerald) + 설명 + 경로/추가정보(zinc-600)
- 디자인을 해치지 않도록 뮤트된 색상

### 카테고리별 설명 데이터

```typescript
const categoryInfo: Record<string, { title: string; description: string; detail: string }> = {
  skills: { title: "Skills이란?", description: "특정 작업을 수행하도록 지시하는 마크다운 파일. /스킬명으로 호출", detail: "~/.claude/skills/{name}/SKILL.md" },
  plugins: { title: "Plugins이란?", description: "스킬, 커맨드, 에이전트를 묶은 확장 패키지. 마켓플레이스에서 설치", detail: "~/.claude/plugins/" },
  agents: { title: "Agents란?", description: "독립적으로 작업을 수행하는 서브에이전트 정의", detail: "~/.claude/agents/{name}.md" },
  commands: { title: "Commands란?", description: "커스텀 CLI 명령어 정의", detail: "~/.claude/commands/" },
  settings: { title: "Settings란?", description: "Claude Code 전역/로컬 설정 (모델, 권한 등)", detail: "~/.claude/settings.json" },
  hooks: { title: "Hooks란?", description: "이벤트 발생 시 자동 실행되는 셸 명령 (11종 이벤트)", detail: "settings.json → hooks" },
  mcp: { title: "MCP Servers란?", description: "외부 서비스와 연결하는 Model Context Protocol 서버", detail: "settings.json → mcpServers" },
  keybindings: { title: "Keybindings란?", description: "키보드 단축키 커스터마이징", detail: "~/.claude/keybindings.json" },
  claudeMd: { title: "CLAUDE.md란?", description: "Claude에게 항상 전달되는 지시문 파일 (전역/프로젝트별)", detail: "~/.claude/CLAUDE.md" },
  memory: { title: "Memory란?", description: "프로젝트별 기억 저장소. 세션 간 정보 유지", detail: "~/.claude/projects/{path}/memory/" },
  teams: { title: "Teams란?", description: "멀티 에이전트 팀 구성", detail: "~/.claude/teams/" },
  marketplace: { title: "Marketplace란?", description: "외부 플러그인/스킬 탐색 및 설치", detail: "등록된 마켓플레이스에서 검색" },
}
```

## 2. 카드 클릭 네비게이션

Dashboard의 StatCard에 `onClick` + `useNavigate` 추가:

| 카드 | 이동 경로 |
|------|-----------|
| Skills | /skills |
| Plugins | /plugins |
| Agents | /agents |
| Hooks | /hooks |
| MCP Servers | /mcp |
| Projects | /memory |

카드에 `cursor-pointer` + hover `scale(1.02)` + `border-emerald-500/30` 효과.

## 3. 백업/Sync 설명 팝업

Dashboard의 Backup History, Sync 버튼 옆에 ℹ 아이콘. 클릭 시 설명 팝업:

**Backup History**: "설정 수정 시마다 자동 백업. 실수로 변경한 설정을 이전 시점으로 복원. 저장: ~/.claude-hub/backups/, 최대 50개"

**Sync**: "Claude Code 세션 로그에서 스킬/플러그인 사용 이력을 추출하여 통계 DB에 반영. 최초 실행 시 과거 데이터 소급 분석"

## 4. 스킬 생성 템플릿

Skills 페이지의 New Skill 다이얼로그에서 Monaco Editor 초기값을 SKILL.md 템플릿으로 설정:

```markdown
---
name: {name}
description: {description}
---

# {name}

## 목적
<이 스킬이 해결하는 문제를 설명하세요>

## 트리거 조건
<이 스킬이 언제 사용되어야 하는지 명시>

## 동작
<스킬이 수행할 구체적인 작업 단계>

## 제약 조건
<하지 말아야 할 것, 주의사항>
```

name/description 입력 시 frontmatter 실시간 반영.

## 5. 대시보드 Hit 통계 탭

Dashboard 최상단에 탭 바 차트:

- **탭**: Skills / Plugins / Agents (emerald underline active)
- **데이터**: `/api/stats/skills`, `/api/stats/plugins`
- **차트**: 가로 바, hit 수 내림차순, 스킬명(mono) | 바(emerald gradient) | hit수
- **미사용 항목**: amber 바 + ⚠ 표시
- **빈 데이터**: "사용 데이터 없음. Sync를 실행하세요" + [Sync] 버튼

## 6. 사용패턴 AI 분석

### 6.1 Claude 연결 관리

앱 시작 시 `claude --version` 실행하여 연결 상태 확인:

```python
# services/claude_connection.py
import subprocess

def check_claude_connection() -> dict:
    try:
        result = subprocess.run(["claude", "--version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return {"connected": True, "version": result.stdout.strip()}
    except Exception:
        pass
    return {"connected": False, "version": None}
```

**API**: `GET /api/claude/status` → `{"connected": true, "version": "..."}`

**사이드바**: 하단 Connected/Disconnected이 실제 연결 상태 반영

**미연결 시**: AI 분석 버튼 비활성 + "Claude 연결 필요" 안내

### 6.2 전체 비교 분석 엔진

#### 정량 분석 (Python, 60점)

```python
# services/analyzer.py

def calculate_scores(db: UsageDB, skills: list) -> list[dict]:
    """전체 스킬을 상대 비교하여 점수 산출."""
    all_stats = db.get_top_skills(limit=1000)

    for skill in skills:
        hits = next((s["hit_count"] for s in all_stats if s["name"] == skill.name), 0)

        # 사용 빈도 (25점) — 백분위 순위
        frequency_score = percentile_rank(hits, all_hits) * 25

        # 최근 활성도 (20점) — 감쇠 함수
        recency_score = recency_decay(last_used, days=30) * 20

        # 프로젝트 범용성 (15점) — 사용 프로젝트 수 비율
        versatility_score = (project_count / total_projects) * 15
```

#### 정성 분석 (Claude CLI, 40점)

```python
async def analyze_with_claude(skills_data: str) -> dict:
    """Claude CLI로 전체 스킬 비교 분석."""
    prompt = f"""아래 스킬 사용 데이터를 분석하여 각 스킬의 유용성을 평가하세요.

평가 기준 (Claude Skill Evaluation Framework 기반):
- 트리거 정확도: 스킬 설명과 실제 사용 맥락이 일치하는가
- 대체 가능성: 기본 모델로 충분하거나, 다른 스킬과 기능이 중복되는가
- 답변 품질 기여도: 이 스킬이 실제 답변 품질에 유의미한 영향을 주는가

출력 형식: JSON
{skills_data}"""

    result = subprocess.run(
        ["claude", "-p", prompt, "--output-format", "json"],
        capture_output=True, text=True, timeout=120
    )
    return json.loads(result.stdout)
```

#### API 엔드포인트

```
POST /api/analysis/skills    # 전체 스킬 비교 분석 실행
POST /api/analysis/plugins   # 전체 플러그인 비교 분석 실행
GET  /api/analysis/results   # 마지막 분석 결과 조회
GET  /api/claude/status      # Claude 연결 상태
```

분석 결과는 `~/.claude-hub/analysis_results.json`에 캐싱.

#### UI: 유용성 랭킹 테이블

| 열 | 내용 |
|-----|------|
| # | 순위 (1부터) |
| 스킬명 | mono 폰트 + source 뱃지 |
| 점수 | /100, 색상: emerald(80+)/white(50-79)/amber(20-49)/red(0-19) |
| 사용량 | 가로 바 (상대적 비율) |
| AI 판정 | 한 줄 코멘트 |
| 액션 | 하위 항목에 [제거] 버튼 |

하단에 **AI 종합 분석 코멘트** (보라색 패널) + 출처 URL 링크.

### 6.3 출처 명시

분석 결과 하단에 항상 표시:
```
평가 기준: Claude Skill Evaluation Framework
https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills
```
