# MCP Registry 동적 연동 설계

## 목표

MCP 서버 마켓플레이스를 기존 하드코딩 10개에서 Official MCP Registry(10,000+ 서버) 기반 동적 로드로 전환한다. 앱 시작 시 백그라운드에서 레지스트리를 동기화하고, 검색 시 실시간 API 쿼리를 지원한다.

## 데이터 소스

- **Official MCP Registry**: `https://registry.modelcontextprotocol.io/v0.1/servers`
- 인증 불필요, cursor 기반 페이지네이션
- 파라미터: `limit` (1-100), `cursor`, `search`
- 응답 구조: `{ servers: [{ server: {...}, _meta: {...} }], metadata: { nextCursor, count } }`
- 서버 필드: `server.name`, `server.description`, `server.version`, `server.title`, `server.repository.url`, `server.websiteUrl`, `server.packages[]`, `server.remotes[]`
- `packages[]` 구조: `{ registryType: "npm"|"pypi"|..., identifier: "@scope/name", transport: {...} }`
- `_meta` 구조: `{ isLatest: boolean, publishedAt: string, updatedAt: string, status: string }`
- **동일 name의 서버가 버전별로 별도 항목으로 반환됨** → 정규화 시 dedup 필수

## 아키텍처

```
앱 시작 (lifespan)
  ├─ 백그라운드 태스크: Registry API → mcp_registry_cache.json 갱신
  │   ├─ 성공: 캐시 파일 갱신 (상위 500개)
  │   └─ 실패: 기존 캐시 유지 (앱 영향 없음)
  │
  └─ browse_mcp() 데이터 우선순위:
      1순위: mcp_registry_cache.json (레지스트리 캐시)
      2순위: mcp_servers.json (기존 10개 폴백)

사용자 검색:
  ├─ 검색어 있음 → Registry API 실시간 쿼리
  └─ 검색어 없음 → 캐시 데이터 반환

에러 발생:
  └─ 프론트엔드 경고 배너 + 재시도 버튼 (비차단)
```

## 캐시 전략

### 저장 위치

`~/.claude/hub/mcp_registry_cache.json` (사용자 데이터 영역)

### 캐시 파일 구조

```json
{
  "updated_at": "2026-03-31T13:00:00Z",
  "servers": [
    {
      "name": "server-name",
      "description": "...",
      "package": "@scope/package-name",
      "category": "",
      "source": "MCP Registry",
      "homepage": "https://github.com/..."
    }
  ]
}
```

### 데이터 정규화

레지스트리 응답을 현재 프론트엔드가 기대하는 형태로 변환:

| Registry 필드 | 정규화 결과 | 비고 |
|---|---|---|
| `server.title` 또는 `server.name` | `name` | `title`이 있으면 우선 사용. 없으면 `name`의 `/` 기준 마지막 세그먼트 |
| `server.description` | `description` | |
| `packages[]`에서 `registryType === "npm"`인 **첫 번째** 항목의 `identifier` | `package` | npm 패키지 없으면 빈 문자열 |
| `server.repository.url` | `homepage` | |
| `server.websiteUrl` | `homepage` (repository 없을 때 폴백) | 둘 다 없으면 빈 문자열 |
| — | `source`: `"MCP Registry"` (고정) | |
| — | `category`: `""` (레지스트리에 카테고리 없음) | |

### 버전 중복 제거 (Dedup)

동일 `server.name`이 여러 버전으로 반환되므로, 정규화 시 다음 규칙 적용:

- `_meta.isLatest === true`인 항목만 취한다.
- `isLatest`가 모두 false인 경우 `server.version` 기준 최신 버전 선택.
- 이 dedup 로직은 browse와 search 양쪽에서 공유한다.

### npm 패키지 없는 서버 처리

- `packages[]`에 npm 타입이 없는 서버도 캐시에 **포함**한다 (목록에 표시).
- `package`가 빈 문자열인 서버는 프론트엔드에서 **설치 버튼 비활성화** + "설치 방법 없음" 표시.
- Docker/pip 등 다른 transport 타입의 설치는 향후 확장 대상.

### 폴백 체인

1. `mcp_registry_cache.json` 존재 → 로드
2. 캐시 없음 → `src/claude_hub/data/mcp_servers.json` (기존 10개)
3. 둘 다 없음 → 빈 리스트

## API 설계

### 기존 엔드포인트 변경

**`GET /marketplace/mcp`** — 응답 구조 확장:

```json
{
  "servers": [...],
  "source": "registry_cache",
  "updated_at": "2026-03-31T13:00:00Z",
  "error_message": null
}
```

`source` 값: `"registry_cache"` | `"fallback"` | `"error"`

### 신규 엔드포인트

**`GET /marketplace/mcp/search?q={query}`** — 레지스트리 실시간 검색 프록시

- Registry API에 `search` 파라미터로 전달
- 네트워크 실패 시 캐시에서 로컬 텍스트 검색 폴백
- 응답: `McpBrowseResponse`와 동일 구조 (`{ servers, source, updated_at, error_message }`)

**`POST /marketplace/mcp/sync`** — 수동 레지스트리 동기화

- lifespan 백그라운드 태스크와 동일 로직 호출
- 재시도 버튼에서 사용
- 응답: `{ "ok": true, "count": 500, "source": "registry" }` 또는 에러

## 백그라운드 동기화

### 위치

`main.py`의 lifespan context manager 내부, 기존 `_monitor_poll_loop`과 동일 패턴.

### 동작

1. `asyncio.create_task()`로 비동기 태스크 생성
2. `httpx.AsyncClient`로 Registry API 호출 (`limit=100`, cursor 페이지네이션 5회 = 500개)
3. 정규화 후 캐시 파일에 JSON 저장
4. 실패 시 로그만 남기고 종료 (앱 시작에 영향 없음)
5. 타임아웃: 요청당 5초, 전체 30초

### 캐시 갱신 정책

- 캐시 파일의 `updated_at`이 24시간 이내이면 동기화 **skip** (불필요한 API 호출 방지)
- 24시간 이상 경과 또는 캐시 파일 없음 → 동기화 실행
- `POST /marketplace/mcp/sync` (수동 재시도)는 시간 체크 없이 항상 실행

## 프론트엔드 변경

### MCP 검색 연동

- 기존: 모든 MCP를 한 번에 로드 → 로컬 필터링
- 변경: 검색어 입력 시 `GET /marketplace/mcp/search?q=` 호출 (debounce 300ms)
- 검색어 비어있으면 기존 `GET /marketplace/mcp` 사용

### 에러 배너

MCP 탭 상단에 조건부 배너 표시:

- `source === "fallback"`: "레지스트리 캐시가 없습니다. 기본 MCP 서버만 표시됩니다." + 재시도
- `source === "error"`: "MCP 레지스트리 로드 실패." + 재시도
- 재시도 중: 스피너 + "레지스트리 동기화 중..."
- **비차단**: 배너만 로딩 상태. 탭 이동, 카테고리 선택, 플러그인 탭 등 모든 UI 조작 가능.
- 성공 시: 배너 제거, 목록 갱신

### 응답 타입 변경

```typescript
interface McpBrowseResponse {
  servers: McpServer[]
  source: 'registry_cache' | 'fallback' | 'error'
  updated_at: string | null
  error_message: string | null
}
```

### Breaking Change 마이그레이션

`GET /marketplace/mcp` 응답이 `McpServer[]` → `McpBrowseResponse` 객체로 변경되므로 프론트엔드에서 아래 부분 수정 필요:

- `useQuery` 반환 타입: `McpServer[]` → `McpBrowseResponse`
- 데이터 접근: `mcpServers` → `mcpData.servers`
- 설치/삭제 후 캐시 무효화: 동일하게 동작하나 데이터 추출 방식 변경
- `filteredMcp`, `installedMcpCount` 등 `mcpServers`를 참조하는 모든 로직
- McpCard의 설치 버튼: `package`가 빈 문자열인 경우 비활성화

## 수정 대상 파일

| Action | Path | 역할 |
|---|---|---|
| Create | `src/claude_hub/services/mcp_registry.py` | Registry API 클라이언트 + 캐시 관리 |
| Modify | `src/claude_hub/services/marketplace.py` | browse_mcp()에서 캐시 우선 로드 + 응답 구조 변경 |
| Modify | `src/claude_hub/routers/marketplace.py` | search, sync 엔드포인트 추가 |
| Modify | `src/claude_hub/main.py` | lifespan에 동기화 태스크 추가 |
| Modify | `src/client/src/pages/Marketplace.tsx` | 에러 배너 + 검색 API 연동 |
| Modify | `src/client/src/lib/api-client.ts` | search/sync API + 응답 타입 변경 |
| Modify | `src/client/src/lib/types.ts` | McpBrowseResponse 타입 추가 |
| Create | `tests/test_services/test_mcp_registry.py` | Registry 서비스 테스트 |
| Modify | `tests/test_routers/test_marketplace.py` | 변경된 API 응답 테스트 |

## 에러 처리

| 상황 | 동작 |
|---|---|
| 시작 시 레지스트리 API 타임아웃 | 로그 남기고 무시, 기존 캐시/폴백 사용 |
| 검색 API 실패 | 캐시에서 로컬 텍스트 검색 폴백 |
| 캐시 파일 없음 + API 실패 | mcp_servers.json 10개 제공, 프론트에 `source: "fallback"` |
| 캐시 파일 파싱 실패 | mcp_servers.json 폴백 |
| sync 엔드포인트 실패 | 에러 응답, 프론트에서 배너 유지 |

## 의존성

- `httpx` — 비동기 HTTP 클라이언트 (기존 프로젝트에 이미 있는지 확인 필요, 없으면 추가)
