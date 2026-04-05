"""MCP Registry API 클라이언트 및 캐시 관리."""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0.1"
SYNC_LIMIT = 100
SYNC_PAGES = 5
REQUEST_TIMEOUT = 5.0
CACHE_TTL_HOURS = 24
_META_KEY = "io.modelcontextprotocol.registry/official"


def _is_latest(item: dict) -> bool:
    """Registry 응답 항목이 최신 버전인지 확인."""
    meta = item.get("_meta", {})
    # 실제 구조: _meta["io.modelcontextprotocol.registry/official"]["isLatest"]
    if _META_KEY in meta:
        official = meta[_META_KEY]
        if isinstance(official, dict):
            return official.get("isLatest", False)
    # 테스트용 간소화 구조 폴백: _meta.isLatest
    return meta.get("isLatest", False)


def normalize_server(raw: dict) -> dict:
    """Registry API 응답의 서버 항목을 프론트엔드 형태로 정규화."""
    server = raw.get("server", {})

    title = server.get("title", "")
    if title:
        name = title
    else:
        raw_name = server.get("name", "")
        name = raw_name.rsplit("/", 1)[-1] if "/" in raw_name else raw_name

    package = ""
    for pkg in server.get("packages", []):
        if pkg.get("registryType") == "npm":
            package = pkg.get("identifier", "")
            break

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
        servers: dict[str, dict] = {}
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
                    if not _is_latest(item):
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
                    if not _is_latest(item):
                        continue
                    normalized = normalize_server(item)
                    servers[normalized["name"]] = normalized

                return list(servers.values())
        except (httpx.HTTPError, Exception) as e:
            logger.warning("MCP Registry 검색 실패: %s", e)
            cache = self.load_cache()
            if cache:
                q = query.lower()
                return [
                    s for s in cache["servers"]
                    if q in s["name"].lower() or q in s["description"].lower()
                ]
            return []
