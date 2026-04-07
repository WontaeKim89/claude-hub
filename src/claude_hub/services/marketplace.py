"""마켓플레이스 브라우징 서비스."""
import json
from dataclasses import dataclass
from pathlib import Path
from claude_hub.utils.paths import ClaudePaths


@dataclass
class MarketplaceService:
    paths: ClaudePaths

    def list_sources(self) -> list[dict]:
        """등록된 마켓플레이스 목록."""
        known = self.paths.known_marketplaces_path
        if not known.exists():
            return []
        data = json.loads(known.read_text())
        return data if isinstance(data, list) else []

    def browse(self, source: str | None = None, query: str | None = None, category: str | None = None) -> list[dict]:
        """마켓플레이스 플러그인 브라우징. 로컬 캐시된 마켓플레이스 디렉토리 스캔."""
        results = []
        marketplaces_dir = self.paths.plugins_dir / "marketplaces"
        if not marketplaces_dir.exists():
            return results

        for mp_dir in sorted(marketplaces_dir.iterdir()):
            if not mp_dir.is_dir():
                continue
            if source and mp_dir.name != source:
                continue

            # Read marketplace.json
            mp_json = mp_dir / ".claude-plugin" / "marketplace.json"
            if not mp_json.exists():
                continue

            mp_data = json.loads(mp_json.read_text())
            mp_name = mp_data.get("name", mp_dir.name)

            for plugin_info in mp_data.get("plugins", []):
                name = plugin_info.get("name", "")
                desc = plugin_info.get("description", "")

                # Filter by query
                if query and query.lower() not in name.lower() and query.lower() not in desc.lower():
                    continue

                # Filter by category
                if category and plugin_info.get("category", "") != category:
                    continue

                # Check if installed
                installed = self._is_installed(name, mp_name)

                # source 필드에서 URL 추출 (source 구조가 마켓플레이스마다 다름)
                source_info = plugin_info.get("source", {})
                if isinstance(source_info, dict):
                    source_url = source_info.get("url", "")
                else:
                    source_url = ""

                # author 필드 추출
                author_info = plugin_info.get("author", {})
                if isinstance(author_info, dict):
                    author_name = author_info.get("name", "")
                else:
                    author_name = ""

                results.append({
                    "name": name,
                    "description": desc,
                    "version": plugin_info.get("version", ""),
                    "category": plugin_info.get("category", ""),
                    "marketplace": mp_name,
                    "installed": installed,
                    "homepage": plugin_info.get("homepage", ""),
                    "source_url": source_url,
                    "author": author_name,
                    "tags": plugin_info.get("tags", []),
                })

        return results

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

    def _is_installed(self, plugin_name: str, marketplace: str) -> bool:
        installed_path = self.paths.installed_plugins_path
        if not installed_path.exists():
            return False
        installed = json.loads(installed_path.read_text())
        if not isinstance(installed, list):
            return False
        return any(
            p.get("name") == plugin_name and p.get("marketplace") == marketplace
            for p in installed
        )
