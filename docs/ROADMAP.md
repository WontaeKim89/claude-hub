# claude-hub Roadmap

향후 고도화 아이디어를 기록하는 문서. Claude가 작업 시 참조.

---

## Phase 5: 네이티브 앱 창 + 사용 통계 시스템

### 5A. 네이티브 앱 창 (pywebview)

#### 목적
브라우저 탭이 아닌 독립 앱 창으로 claude-hub 실행. OS 네이티브 윈도우 프레임 사용.

#### 기술 선택: pywebview

| 검토 옵션 | 결론 |
|-----------|------|
| Tauri | 가장 경량(5MB)이지만 Rust 빌드 체인 필요. 추후 업그레이드 경로로 보류 |
| Electron | 150MB 번들, Python 백엔드와 이질적. 탈락 |
| PWA | 설치 없이 가능하지만 네이티브 느낌 부족. 중간 단계로 고려 |
| **pywebview** | Python 패키지 하나로 해결. 기존 FastAPI 코드 그대로 사용. **채택** |

#### 구현 계획

```
claude-hub        → 기존처럼 브라우저에서 열림 (--no-window 모드)
claude-hub --app  → pywebview 네이티브 창으로 열림
```

**의존성**: `pywebview>=5.0`

**변경 사항**:
1. `main.py`의 `cli()`에 `--app` 플래그 추가
2. `--app` 시: `webview.create_window("claude-hub", url, width=1200, height=800)` + `webview.start()`
3. FastAPI 서버는 별도 스레드에서 실행, webview가 메인 스레드 점유
4. 창 닫으면 서버도 종료

**코드 변경량**: main.py 20줄 추가 수준

---

### 5B. 스킬/플러그인 사용 통계 시스템

#### 목적
claude-hub를 통해 Claude Code를 실행하고, 스킬/플러그인 사용 빈도를 로컬 DB에 기록하여 대시보드에서 효과성을 한눈에 파악. 사용빈도 낮은 항목은 원클릭 제거.

#### 아키텍처

```
┌─────────────────────────────────────────────────┐
│               claude-hub (앱 창)                  │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Dashboard    │  │  Usage Stats Panel       │ │
│  │  (기존)       │  │  - 스킬별 hit 카운트      │ │
│  │              │  │  - 플러그인별 hit 카운트    │ │
│  │              │  │  - 최근 사용일             │ │
│  │              │  │  - 미사용 항목 경고        │ │
│  │              │  │  - [제거] 버튼            │ │
│  └──────────────┘  └──────────────────────────┘ │
├─────────────────────────────────────────────────┤
│                  FastAPI Server                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ 기존 API  │  │ Stats API│  │ Claude Runner │ │
│  └──────────┘  └────┬─────┘  └───────┬───────┘ │
│                     │                │          │
│              ┌──────▼────────────────▼────────┐ │
│              │     SQLite (~/.claude-hub/      │ │
│              │            usage.db)            │ │
│              └────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│                 Hook System                      │
│  PostToolUse hook → usage.db에 skill/plugin hit │
│  기록 (Skill tool 호출 감지)                     │
└─────────────────────────────────────────────────┘
```

#### 데이터 수집 방식

**방법 A: Hook 기반 (추천)**
- Claude Code의 `PostToolUse` hook에 등록
- `Skill` 도구가 호출될 때마다 스킬명 + 타임스탬프를 DB에 기록
- claude-hub가 실행 중이 아니어도 데이터 수집 가능 (hook은 독립 실행)

```json
// settings.json hooks 추가
{
  "PostToolUse": [{
    "matcher": "Skill",
    "hooks": [{
      "type": "command",
      "command": "claude-hub-tracker record-skill",
      "timeout": 1000
    }]
  }]
}
```

**방법 B: 세션 로그 파싱**
- `~/.claude/projects/*/*.jsonl` 세션 로그를 파싱
- Skill tool_use 이벤트를 찾아서 집계
- 과거 데이터도 소급 분석 가능

**결정: A + B 병행**
- Hook으로 실시간 수집 (정확도 높음)
- 세션 로그 파싱으로 과거 데이터 소급 분석 (초기 데이터 확보)

#### SQLite 스키마

```sql
-- 스킬/플러그인 사용 기록
CREATE TABLE usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,          -- 'skill' | 'plugin' | 'agent' | 'command'
    name TEXT NOT NULL,          -- 스킬/플러그인 이름
    project TEXT,                -- 프로젝트 경로 (optional)
    session_id TEXT,             -- 세션 ID
    timestamp REAL NOT NULL,     -- Unix timestamp
    metadata TEXT                -- JSON (추가 정보)
);

CREATE INDEX idx_usage_type_name ON usage_events(type, name);
CREATE INDEX idx_usage_timestamp ON usage_events(timestamp);

-- 일별 집계 (빠른 조회용)
CREATE TABLE usage_daily (
    date TEXT NOT NULL,          -- YYYY-MM-DD
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    hit_count INTEGER DEFAULT 0,
    PRIMARY KEY (date, type, name)
);
```

#### API 엔드포인트

```
GET  /api/stats/overview        # 전체 요약 (top 10 스킬/플러그인)
GET  /api/stats/skills          # 스킬별 사용 통계 (hit_count, last_used, trend)
GET  /api/stats/plugins         # 플러그인별 사용 통계
GET  /api/stats/unused          # 30일 이상 미사용 항목 목록
GET  /api/stats/timeline        # 시간대별 사용 트렌드 (일별/주별)
POST /api/stats/record          # Hook에서 호출: 사용 이벤트 기록
POST /api/stats/sync            # 세션 로그에서 과거 데이터 소급 파싱
```

#### Dashboard 통합

**Dashboard 페이지에 추가할 섹션:**

1. **Top Used Skills** (상위 10개)
   - 바 차트 형태, 각 행: 스킬명 | 히트 카운트 | 최근 사용일 | 바
   - emerald 바 길이로 상대적 사용량 표시

2. **Top Used Plugins** (상위 5개)
   - 동일 바 차트 형태

3. **Unused Items** (경고 섹션)
   - 30일 이상 미사용 스킬/플러그인 리스트
   - 각 항목 옆에 amber 경고 아이콘 + **[제거]** 버튼 (red, 확인 다이얼로그)
   - "이 스킬은 45일간 사용되지 않았습니다" 텍스트

4. **Usage Timeline** (간단한 시계열)
   - 최근 30일 일별 총 사용 횟수 미니 바 차트

#### CLI 추가 명령

```bash
claude-hub                    # 기존: 웹 대시보드
claude-hub --app              # 네이티브 앱 창
claude-hub tracker install    # PostToolUse hook을 settings.json에 등록
claude-hub tracker uninstall  # hook 제거
claude-hub tracker sync       # 세션 로그 소급 파싱
claude-hub tracker status     # 수집 상태 확인
```

#### 구현 단계

| Step | 내용 | 예상 파일 |
|------|------|-----------|
| 1 | SQLite 스키마 + DB 서비스 | `services/usage_db.py` |
| 2 | Hook tracker CLI (`claude-hub-tracker`) | `tracker.py` + pyproject.toml scripts |
| 3 | 세션 로그 파서 | `services/log_parser.py` |
| 4 | Stats API 라우터 | `routers/stats.py` |
| 5 | Dashboard Usage Stats UI | `pages/Dashboard.tsx` 확장 |
| 6 | Unused Items 경고 + 제거 버튼 | Skills/Plugins 페이지 통합 |
| 7 | pywebview 앱 창 모드 | `main.py` 확장 |
| 8 | `tracker install/uninstall/sync` CLI | `main.py` CLI 확장 |

#### 의존성 추가

```
aiosqlite>=0.20    # 비동기 SQLite
pywebview>=5.0     # 네이티브 앱 창 (optional dependency)
```

---

## 향후 아이디어 (미정)

> 아래는 아직 구체화되지 않은 아이디어. 필요 시 별도 Phase로 구체화.

- **Tauri 마이그레이션**: pywebview → Tauri로 업그레이드 (더 네이티브 느낌, 작은 번들)
- **스킬 A/B 테스트**: 같은 작업을 다른 스킬 조합으로 실행하고 결과 비교
- **팀 공유 설정**: 팀원들의 claude-hub 설정을 Git repo로 공유/동기화
- **스킬 작성 도우미**: UI에서 SKILL.md를 시각적으로 작성하는 위자드
- **프롬프트 라이브러리**: 자주 쓰는 프롬프트를 저장/재사용
- **비용 대시보드**: Anthropic API 사용량 연동 (API key 필요)
- **실시간 세션 모니터링**: WebSocket으로 현재 진행 중인 세션의 도구 호출 실시간 표시
