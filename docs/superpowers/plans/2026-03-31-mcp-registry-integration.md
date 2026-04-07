# MCP Registry 동적 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Official MCP Registry API에서 MCP 서버 목록을 동적으로 가져와 캐시하고, 실시간 검색을 지원한다.

**Architecture:** `McpRegistryService`가 Registry API 호출/정규화/캐시 관리를 담당한다. `MarketplaceService.browse_mcp()`는 캐시 → 폴백 체인으로 데이터를 제공하고, 검색은 Registry API에 직접 프록시한다. 앱 시작 시 lifespan에서 비동기 동기화 태스크를 실행한다.

**Tech Stack:** Python (FastAPI, httpx, asyncio), TypeScript (React 19, TanStack Query), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-31-mcp-registry-integration-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/claude_hub/services/mcp_registry.py` | Registry API 클라이언트, 데이터 정규화, JSON 캐시 관리 |
| Modify | `src/claude_hub/services/marketplace.py` | browse_mcp() 응답 구조 변경 (캐시 우선 로드 + 메타데이터) |
| Modify | `src/claude_hub/routers/marketplace.py` | search, sync 엔드포인트 추가 |
| Modify | `src/claude_hub/main.py:109-119` | lifespan에 동기화 태스크 추가 |
| Modify | `src/claude_hub/utils/paths.py:15-68` | hub_dir 프로퍼티 추가 |
| Modify | `src/client/src/lib/types.ts` | McpBrowseResponse 타입 추가 |
| Modify | `src/client/src/lib/api-client.ts:140-160` | search/sync API + 응답 타입 변경 |
| Modify | `src/client/src/pages/Marketplace.tsx` | 에러 배너 + 검색 API 연동 + 설치 버튼 비활성화 |
| Create | `tests/test_services/test_mcp_registry.py` | Registry 서비스 유닛 테스트 |
| Modify | `tests/test_routers/test_marketplace.py` | 변경된 MCP API 응답 테스트 |

---

### Task 1: ClaudePaths에 hub_dir 추가

**Files:**
- Modify: `src/claude_hub/utils/paths.py:15-68`

- [ ] **Step 1: hub_dir 프로퍼티 추가**

`src/claude_hub/utils/paths.py`의 `ClaudePaths` 클래스, `backup_dir` 프로퍼티 아래에 추가:

```python
@property
def hub_dir(self) -> Path:
    return Path.home() / ".claude" / "hub"

@property
def mcp_registry_cache_path(self) -> Path:
    return self.hub_dir / "mcp_registry_cache.json"
```

- [ ] **Step 2: Commit**

```bash
git add src/claude_hub/utils/paths.py
git commit -m "feat: ClaudePaths에 hub_dir, mcp_registry_cache_path 추가"
```

---

### Task 2: McpRegistryService — 테스트

**Files:**
- Create: `tests/test_services/test_mcp_registry.py`

- [ ] **Step 1: 테스트 디렉토리 확인**

Run: `ls tests/test_services/ 2>/dev/null || echo "not found"`
디렉토리 없으면 `__init__.py`와 함께 생성.

- [ ] **Step 2: 정규화 함수 테스트 작성**

```python
"""MCP Registry 서비스 테스트."""
import json
import pytest
from claude_hub.services.mcp_registry import normalize_server


class TestNormalizeServer:
    def test_basic_normalization(self):
        raw = {
            "server": {
                "name": "io.github.user/sqlite-mcp",
                "description": "SQLite database access",
                "version": "1.0.0",
                "repository": {"url": "https://github.com/user/sqlite-mcp"},
                "packages": [
                    {"registryType": "npm", "identifier": "@user/sqlite-mcp"}
                ],
            },
            "_meta": {"isLatest": True},
        }
        result = normalize_server(raw)
        assert result["name"] == "sqlite-mcp"
        assert result["description"] == "SQLite database access"
        assert result["package"] == "@user/sqlite-mcp"
        assert result["homepage"] == "https://github.com/user/sqlite-mcp"
        assert result["source"] == "MCP Registry"

    def test_title_takes_priority_over_name(self):
        raw = {
            "server": {
                "name": "io.github.user/my-server",
                "title": "My Awesome Server",
                "description": "desc",
                "packages": [],
            },
            "_meta": {"isLatest": True},
        }
        result = normalize_server(raw)
        assert result["name"] == "My Awesome Server"

    def test_no_npm_package(self):
        raw = {
            "server": {
                "name": "io.github.user/docker-server",
                "description": "Docker only",
                "packages": [
                    {"registryType": "docker", "identifier": "user/docker-server"}
                ],
            },
            "_meta": {"isLatest": True},
        }
        result = normalize_server(raw)
        assert result["package"] == ""

    def test_no_packages_at_all(self):
        raw = {
            "server": {
                "name": "io.github.user/bare-server",
                "description": "No packages",
            },
            "_meta": {"isLatest": True},
        }
        result = normalize_server(raw)
        assert result["package"] == ""
        assert result["homepage"] == ""

    def test_website_url_fallback(self):
        raw = {
            "server": {
                "name": "io.github.user/web-server",
                "description": "Has website",
                "websiteUrl": "https://example.com",
                "packages": [],
            },
            "_meta": {"isLatest": True},
        }
        result = normalize_server(raw)
        assert result["homepage"] == "https://example.com"

    def test_name_segment_extraction(self):
        raw = {
            "server": {
                "name": "com.company/deep/nested/server-name",
                "description": "Nested",
                "packages": [],
            },
            "_meta": {"isLatest": True},
        }
        result = normalize_server(raw)
        assert result["name"] == "server-name"
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && uv run pytest tests/test_services/test_mcp_registry.py -v`
Expected: FAIL (모듈 없음)

- [ ] **Step 4: Commit**

```bash
git add tests/test_services/
git commit -m "test: McpRegistryService 정규화 함수 테스트 추가"
```

---

### Task 3: McpRegistryService — 구현

**Files:**
- Create: `src/claude_hub/services/mcp_registry.py`

- [ ] **Step 1: McpRegistryService 구현**

```python
"""MCP Registry API 클라이언트 및 캐시 관리."""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0.1"
SYNC_LIMIT = 100
SYNC_PAGES = 5  # 100 * 5 = 500 서버
REQUEST_TIMEOUT = 5.0
CACHE_TTL_HOURS = 24


def normalize_server(raw: dict) -> dict:
    """Registry API 응답의 서버 항목을 프론트엔드 형태로 정규화."""
    server = raw.get("server", {})

    # name: title 우선, 없으면 name의 마지막 세그먼트
    title = server.get("title", "")
    if title:
        name = title
    else:
        raw_name = server.get("name", "")
        name = raw_name.rsplit("/", 1)[-1] if "/" in raw_name else raw_name

    # package: 첫 번째 npm 타입의 identifier
    package = ""
    for pkg in server.get("packages", []):
        if pkg.get("registryType") == "npm":
            package = pkg.get("identifier", "")
            break

    # homepage: repository.url → websiteUrl → 빈 문자열
    repo = server.get("repository", {})
    homepage = ""
    if isinstance(repo, dict) and repo.get("url"):
        homepage = repo["url"]
    elif server.get("websiteUrl"):
        homepage = server["websiteUrl"]

    return {
        "name": name,
        "description": server.get("description", ""),
        "package": package,
        "category": "",
        "source": "MCP Registry",
        "homepage": homepage,
    }


class McpRegistryService:
    def __init__(self, cache_path: Path):
        self.cache_path = cache_path

    def load_cache(self) -> dict | None:
        """캐시 파일 로드. 없거나 파싱 실패 시 None."""
        if not self.cache_path.exists():
            return None
        try:
            return json.loads(self.cache_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def is_cache_fresh(self) -> bool:
        """캐시가 24시간 이내인지 확인."""
        cache = self.load_cache()
        if not cache or "updated_at" not in cache:
            return False
        try:
            updated = datetime.fromisoformat(cache["updated_at"])
            now = datetime.now(timezone.utc)
            return (now - updated).total_seconds() < CACHE_TTL_HOURS * 3600
        except (ValueError, TypeError):
            return False

    async def sync_from_registry(self) -> dict:
        """Registry API에서 서버 목록을 가져와 캐시에 저장."""
        servers: dict[str, dict] = {}  # name -> normalized, dedup용
        cursor = None

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for _ in range(SYNC_PAGES):
                params: dict = {"limit": SYNC_LIMIT}
                if cursor:
                    params["cursor"] = cursor

                resp = await client.get(f"{REGISTRY_BASE}/servers", params=params)
                resp.raise_for_status()
                data = resp.json()

                for item in data.get("servers", []):
                    meta = item.get("_meta", {})
                    # isLatest가 아닌 항목은 건너뛰기 (dedup)
                    if not meta.get("isLatest", False):
                        continue
                    normalized = normalize_server(item)
                    servers[normalized["name"]] = normalized

                metadata = data.get("metadata", {})
                cursor = metadata.get("nextCursor")
                if not cursor:
                    break

        server_list = list(servers.values())

        cache_data = {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "servers": server_list,
        }

        # 캐시 디렉토리 생성 및 저장
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(
            json.dumps(cache_data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("MCP Registry 동기화 완료: %d servers", len(server_list))
        return cache_data

    async def search_registry(self, query: str) -> list[dict]:
        """Registry API에서 실시간 검색."""
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.get(
                    f"{REGISTRY_BASE}/servers",
                    params={"search": query, "limit": SYNC_LIMIT},
                )
                resp.raise_for_status()
                data = resp.json()

                servers: dict[str, dict] = {}
                for item in data.get("servers", []):
                    meta = item.get("_meta", {})
                    if not meta.get("isLatest", False):
                        continue
                    normalized = normalize_server(item)
                    servers[normalized["name"]] = normalized

                return list(servers.values())
        except (httpx.HTTPError, Exception) as e:
            logger.warning("MCP Registry 검색 실패: %s", e)
            # 폴백: 캐시에서 로컬 검색
            cache = self.load_cache()
            if cache:
                q = query.lower()
                return [
                    s for s in cache["servers"]
                    if q in s["name"].lower() or q in s["description"].lower()
                ]
            return []
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && uv run pytest tests/test_services/test_mcp_registry.py -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/claude_hub/services/mcp_registry.py
git commit -m "feat: McpRegistryService — Registry API 클라이언트 및 캐시 관리"
```

---

### Task 4: MarketplaceService.browse_mcp() 응답 구조 변경 — 테스트

**Files:**
- Modify: `tests/test_routers/test_marketplace.py`
- Modify: `tests/conftest.py`

- [ ] **Step 1: conftest.py에 MCP 캐시 fixture 추가**

`tests/conftest.py`의 `fake_claude_dir` 함수 내, `return claude_dir` 전에 추가:

```python
# MCP Registry cache
hub_dir = claude_dir / "hub"
hub_dir.mkdir()
(hub_dir / "mcp_registry_cache.json").write_text(json.dumps({
    "updated_at": "2026-03-31T00:00:00+00:00",
    "servers": [
        {
            "name": "test-registry-server",
            "description": "A server from registry",
            "package": "@test/registry-server",
            "category": "",
            "source": "MCP Registry",
            "homepage": "https://github.com/test/registry-server",
        }
    ]
}))
```

- [ ] **Step 2: browse_mcp 응답 구조 변경 테스트**

기존 `test_browse_mcp_returns_homepage`을 수정하고 새 테스트 추가:

```python
@pytest.mark.asyncio
async def test_browse_mcp_returns_wrapped_response(client):
    """browse_mcp()가 서버 리스트 + 메타데이터를 포함한 객체를 반환하는지 검증."""
    resp = await client.get("/api/marketplace/mcp")
    assert resp.status_code == 200
    data = resp.json()

    # 래핑된 응답 구조
    assert "servers" in data
    assert "source" in data
    assert "updated_at" in data
    assert isinstance(data["servers"], list)
    assert data["source"] in ("registry_cache", "fallback", "error")

    # Registry 캐시에서 로드된 경우
    if data["source"] == "registry_cache":
        names = [s["name"] for s in data["servers"]]
        assert "test-registry-server" in names


@pytest.mark.asyncio
async def test_browse_mcp_fallback_when_no_cache(client, fake_claude_dir):
    """캐시 파일 없을 때 기존 mcp_servers.json 폴백."""
    cache_path = fake_claude_dir / "hub" / "mcp_registry_cache.json"
    if cache_path.exists():
        cache_path.unlink()

    resp = await client.get("/api/marketplace/mcp")
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "fallback"
    assert len(data["servers"]) >= 10  # 기존 하드코딩 10개
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && uv run pytest tests/test_routers/test_marketplace.py::test_browse_mcp_returns_wrapped_response -v`
Expected: FAIL (현재 browse_mcp()는 flat list 반환)

- [ ] **Step 4: Commit**

```bash
git add tests/conftest.py tests/test_routers/test_marketplace.py
git commit -m "test: browse_mcp() 래핑된 응답 구조 테스트 추가"
```

---

### Task 5: MarketplaceService.browse_mcp() 구현 변경

**Files:**
- Modify: `src/claude_hub/services/marketplace.py:85-99`

- [ ] **Step 1: browse_mcp() 메서드를 캐시 우선 로드 + 래핑 응답으로 변경**

`src/claude_hub/services/marketplace.py`의 `browse_mcp()` 전체 교체:

```python
def browse_mcp(self) -> dict:
    """MCP 서버 마켓플레이스. 캐시 → 폴백 체인."""
    # 1순위: Registry 캐시
    cache_path = self.paths.mcp_registry_cache_path
    if cache_path.exists():
        try:
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            servers = cache.get("servers", [])
            updated_at = cache.get("updated_at")
            source = "registry_cache"
        except (json.JSONDecodeError, OSError):
            servers, updated_at, source = [], None, "error"
    else:
        servers, updated_at, source = None, None, None

    # 2순위: 기존 mcp_servers.json 폴백
    if not servers:
        data_file = Path(__file__).parent.parent / "data" / "mcp_servers.json"
        if data_file.exists():
            servers = json.loads(data_file.read_text(encoding="utf-8"))
            source = "fallback"
        else:
            servers = []
            source = "error"

    # 설치 상태 체크
    installed: set[str] = set()
    if self.paths.settings_path.exists():
        settings = json.loads(self.paths.settings_path.read_text())
        installed = set(settings.get("mcpServers", {}).keys())

    for server in servers:
        server["installed"] = server["name"] in installed

    return {
        "servers": servers,
        "source": source,
        "updated_at": updated_at,
        "error_message": None if source != "error" else "캐시 로드 실패",
    }
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && uv run pytest tests/test_routers/test_marketplace.py -v`
Expected: ALL PASS (기존 `test_browse_mcp_returns_homepage` 제거 또는 수정 필요)

주의: 기존 `test_browse_mcp_returns_homepage` 테스트는 flat list를 기대하므로, 새 `test_browse_mcp_returns_wrapped_response`로 대체. 기존 테스트 삭제.

- [ ] **Step 3: Commit**

```bash
git add src/claude_hub/services/marketplace.py tests/test_routers/test_marketplace.py
git commit -m "feat: browse_mcp() 캐시 우선 로드 + 래핑 응답 구조로 변경"
```

---

### Task 6: search + sync 엔드포인트 추가

**Files:**
- Modify: `src/claude_hub/routers/marketplace.py`
- Modify: `src/claude_hub/main.py:21-42` (McpRegistryService 초기화)

- [ ] **Step 1: main.py에 McpRegistryService 초기화 추가**

`src/claude_hub/main.py` 상단 import에 추가:

```python
from claude_hub.services.mcp_registry import McpRegistryService
```

`create_app()` 내 서비스 초기화 부분 (`session_watcher` 아래)에 추가:

```python
mcp_registry = McpRegistryService(cache_path=config.paths.mcp_registry_cache_path)
app.state.mcp_registry = mcp_registry
```

- [ ] **Step 2: routers/marketplace.py에 search, sync 엔드포인트 추가**

```python
@router.get("/marketplace/mcp/search")
async def search_mcp(q: str, request: Request):
    """MCP Registry 실시간 검색."""
    registry: McpRegistryService = request.app.state.mcp_registry
    marketplace = request.app.state.marketplace

    servers = await registry.search_registry(q)

    # 설치 상태 체크
    paths = request.app.state.config.paths
    installed: set[str] = set()
    if paths.settings_path.exists():
        import json as _json
        settings = _json.loads(paths.settings_path.read_text())
        installed = set(settings.get("mcpServers", {}).keys())

    for s in servers:
        s["installed"] = s["name"] in installed

    return {
        "servers": servers,
        "source": "registry_search",
        "updated_at": None,
        "error_message": None,
    }


@router.post("/marketplace/mcp/sync")
async def sync_mcp(request: Request):
    """MCP Registry 수동 동기화."""
    registry: McpRegistryService = request.app.state.mcp_registry
    try:
        cache = await registry.sync_from_registry()
        return {"ok": True, "count": len(cache["servers"]), "source": "registry"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
```

import 추가 (파일 상단):

```python
from claude_hub.services.mcp_registry import McpRegistryService
```

주의: `/marketplace/mcp/search`와 `/marketplace/mcp/sync`는 `/marketplace/mcp/{name}` (DELETE) 보다 **위에** 위치해야 FastAPI가 경로를 올바르게 매칭함.

- [ ] **Step 3: 테스트 실행**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && uv run pytest tests/test_routers/test_marketplace.py -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/claude_hub/main.py src/claude_hub/routers/marketplace.py
git commit -m "feat: MCP search/sync 엔드포인트 + McpRegistryService 초기화"
```

---

### Task 7: lifespan 백그라운드 동기화

**Files:**
- Modify: `src/claude_hub/main.py:109-121`

- [ ] **Step 1: lifespan에 동기화 태스크 추가**

`src/claude_hub/main.py`의 `_lifespan` 함수를 수정:

```python
@asynccontextmanager
async def _lifespan(a):
    poll_task = asyncio.create_task(_monitor_poll_loop(session_watcher))
    sync_task = asyncio.create_task(_mcp_registry_sync(mcp_registry))
    try:
        yield
    finally:
        poll_task.cancel()
        sync_task.cancel()
```

`_monitor_poll_loop` 함수 아래에 동기화 함수 추가:

```python
async def _mcp_registry_sync(registry: McpRegistryService):
    """앱 시작 시 MCP Registry 백그라운드 동기화."""
    import asyncio
    await asyncio.sleep(2)  # 앱 시작 안정화 대기
    try:
        if registry.is_cache_fresh():
            logger.info("MCP Registry 캐시가 최신 상태 (24h 이내), 동기화 skip")
            return
        await registry.sync_from_registry()
    except Exception as e:
        logger.warning("MCP Registry 백그라운드 동기화 실패: %s", e)
```

파일 상단에 logger 추가 (없으면):

```python
import logging
logger = logging.getLogger(__name__)
```

- [ ] **Step 2: 서버 기동 확인**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && timeout 10 uv run claude-hub 2>&1 || true`
Expected: 시작 후 2초 뒤 로그에 "MCP Registry 동기화 완료" 또는 "캐시가 최신 상태" 출력

- [ ] **Step 3: Commit**

```bash
git add src/claude_hub/main.py
git commit -m "feat: 앱 시작 시 MCP Registry 백그라운드 동기화"
```

---

### Task 8: 프론트엔드 타입 + API 클라이언트

**Files:**
- Modify: `src/client/src/lib/types.ts`
- Modify: `src/client/src/lib/api-client.ts:140-160`

- [ ] **Step 1: McpBrowseResponse 타입 추가**

`src/client/src/lib/types.ts` 파일 끝에 추가:

```typescript
export interface McpBrowseResponse {
  servers: Array<{
    name: string
    description: string
    package: string
    category: string
    source: string
    installed: boolean
    homepage?: string
  }>
  source: 'registry_cache' | 'fallback' | 'error' | 'registry_search'
  updated_at: string | null
  error_message: string | null
}
```

- [ ] **Step 2: api-client.ts MCP API 수정**

`src/client/src/lib/api-client.ts`의 `marketplace` 객체 내:

```typescript
// 기존 mcp 교체
mcp: () => request<McpBrowseResponse>('/marketplace/mcp'),

// 신규 추가
mcpSearch: (q: string) => request<McpBrowseResponse>(`/marketplace/mcp/search?q=${encodeURIComponent(q)}`),
mcpSync: () => request<{ ok: boolean; count: number; source: string }>('/marketplace/mcp/sync', { method: 'POST' }),
```

import에 `McpBrowseResponse` 추가.

- [ ] **Step 3: Commit**

```bash
git add src/client/src/lib/types.ts src/client/src/lib/api-client.ts
git commit -m "feat: McpBrowseResponse 타입 + search/sync API 클라이언트"
```

---

### Task 9: 프론트엔드 Marketplace.tsx 변경

**Files:**
- Modify: `src/client/src/pages/Marketplace.tsx`

이 태스크는 변경 범위가 넓으므로 주요 변경점을 정리:

- [ ] **Step 1: import에 추가 아이콘 + 타입**

```typescript
import { Search, Package, Server, Trash2, Download, X, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
```

import에 `McpBrowseResponse` 추가:

```typescript
import type { MarketplacePlugin, McpBrowseResponse } from '../lib/types'
```

- [ ] **Step 2: MCP useQuery를 래핑된 응답으로 변경**

기존:
```typescript
const { data: mcpServers = [], isLoading: mcpLoading } = useQuery<McpServer[]>({
    queryKey: ['marketplace', 'mcp'],
    queryFn: () => api.marketplace.mcp(),
})
```

변경:
```typescript
const { data: mcpData, isLoading: mcpLoading } = useQuery<McpBrowseResponse>({
    queryKey: ['marketplace', 'mcp'],
    queryFn: () => api.marketplace.mcp(),
})
const mcpServers = mcpData?.servers ?? []
const mcpSource = mcpData?.source ?? 'error'
```

- [ ] **Step 3: MCP 검색 시 API 호출 (debounce)**

주의: 기존 `query` state는 키 입력마다 즉시 변경됨. MCP 검색 API는 `debouncedQuery`를 사용하여 300ms debounce 적용. `useState` + `useEffect`로 구현하거나 `useDeferredValue` 사용.

MCP 탭에서 검색어가 있으면 search API를 호출하는 쿼리 추가:

```typescript
const { data: mcpSearchData, isFetching: mcpSearching } = useQuery<McpBrowseResponse>({
    queryKey: ['marketplace', 'mcp', 'search', query],
    queryFn: () => api.marketplace.mcpSearch(query),
    enabled: mainTab === 'mcp' && query.length >= 2,
    staleTime: 30_000,
})
```

`filteredMcp` 로직 수정: 검색 결과가 있으면 검색 데이터 사용, 없으면 기존 로컬 필터:

```typescript
const filteredMcp = useMemo(() => {
    if (mainTab === 'mcp' && query.length >= 2 && mcpSearchData?.servers) {
        let list = mcpSearchData.servers
        if (filterMode === 'installed') list = list.filter((s) => s.installed)
        return list
    }
    let list = mcpServers
    if (filterMode === 'installed') list = list.filter((s) => s.installed)
    if (query) {
        list = list.filter((s) =>
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.description.toLowerCase().includes(query.toLowerCase())
        )
    }
    return list
}, [mcpServers, mcpSearchData, filterMode, query, mainTab])
```

- [ ] **Step 4: sync mutation + 에러 배너**

```typescript
const mcpSyncMutation = useMutation({
    mutationFn: () => api.marketplace.mcpSync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace', 'mcp'] }),
})
```

MCP 탭 렌더링 영역 (그리드 위)에 에러 배너 추가:

```tsx
{mainTab === 'mcp' && (mcpSource === 'fallback' || mcpSource === 'error') && (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
        <AlertTriangle size={14} className="shrink-0" />
        <span className="flex-1">
            {mcpSource === 'fallback'
                ? '레지스트리 캐시가 없습니다. 기본 MCP 서버만 표시됩니다.'
                : 'MCP 레지스트리 로드에 실패했습니다.'}
        </span>
        <button
            onClick={() => mcpSyncMutation.mutate()}
            disabled={mcpSyncMutation.isPending}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border border-amber-500/30 rounded hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        >
            <RefreshCw size={10} className={mcpSyncMutation.isPending ? 'animate-spin' : ''} />
            {mcpSyncMutation.isPending ? '동기화 중...' : '재시도'}
        </button>
    </div>
)}
```

- [ ] **Step 5: McpCard 설치 버튼 비활성화 (package 없는 서버)**

McpCard 컴포넌트의 설치 버튼에 `package` 빈 문자열 체크 추가:

```tsx
{!server.installed && !server.package ? (
    <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-600">
        설치 불가
    </span>
) : !server.installed ? (
    <button
        onClick={(e) => { e.stopPropagation(); onInstall() }}
        disabled={isInstalling}
        className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-mono border border-fuchsia-600 text-fuchsia-400 hover:bg-fuchsia-600 hover:text-white rounded transition-colors disabled:opacity-50"
    >
        <Download size={10} />
        {isInstalling ? '...' : t('marketplace.install')}
    </button>
) : null}
```

- [ ] **Step 6: 빌드 확인**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && bash scripts/build.sh`
Expected: 빌드 성공

- [ ] **Step 7: Commit**

```bash
git add src/client/src/pages/Marketplace.tsx
git commit -m "feat: MCP 에러 배너 + 검색 API 연동 + 설치 불가 표시"
```

---

### Task 10: 전체 검증

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd /Users/gim-wontae/Desktop/Persnal_Project/claude-hub-worktree-1 && uv run pytest tests/ -v`
Expected: 마켓플레이스 관련 테스트 모두 PASS

- [ ] **Step 2: 프론트엔드 빌드**

Run: `bash scripts/build.sh`
Expected: 빌드 성공

- [ ] **Step 3: 수동 확인**

Run: `uv run claude-hub`

확인 항목:
- 시작 후 2초 뒤 로그에 Registry 동기화 메시지 출력
- MCP 서버 탭: 500개 내외 서버 표시 (registry_cache)
- 검색: 2글자 이상 입력 시 실시간 검색 동작
- 캐시 없이 시작: fallback 배너 + 재시도 버튼
- 재시도 버튼 클릭 시 스피너 → 성공 시 목록 갱신
- package 없는 서버: "설치 불가" 표시
- 배너 표시 중에도 Plugins 탭 이동 등 UI 정상 조작 가능
