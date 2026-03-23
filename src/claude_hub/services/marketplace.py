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

                results.append({
                    "name": name,
                    "description": desc,
                    "version": plugin_info.get("version", ""),
                    "category": plugin_info.get("category", ""),
                    "marketplace": mp_name,
                    "installed": installed,
                })

        return results

    def browse_mcp(self) -> list[dict]:
        """MCP 서버 마켓플레이스 (공식 MCP 서버 목록)."""
        MCP_SERVERS = [
            {"name": "github", "description": "GitHub API 연동 (이슈, PR, 코드 검색)", "package": "@modelcontextprotocol/server-github", "category": "development", "source": "MCP Official"},
            {"name": "filesystem", "description": "로컬 파일시스템 접근", "package": "@modelcontextprotocol/server-filesystem", "category": "system", "source": "MCP Official"},
            {"name": "postgres", "description": "PostgreSQL 데이터베이스 쿼리", "package": "@modelcontextprotocol/server-postgres", "category": "database", "source": "MCP Official"},
            {"name": "sqlite", "description": "SQLite 데이터베이스 관리", "package": "@modelcontextprotocol/server-sqlite", "category": "database", "source": "MCP Official"},
            {"name": "slack", "description": "Slack 메시지 및 채널 접근", "package": "@modelcontextprotocol/server-slack", "category": "communication", "source": "MCP Official"},
            {"name": "google-drive", "description": "Google Drive 파일 접근", "package": "@anthropic/mcp-server-google-drive", "category": "storage", "source": "Anthropic"},
            {"name": "memory", "description": "지식 그래프 기반 메모리", "package": "@modelcontextprotocol/server-memory", "category": "AI", "source": "MCP Official"},
            {"name": "puppeteer", "description": "브라우저 자동화 (Puppeteer)", "package": "@modelcontextprotocol/server-puppeteer", "category": "automation", "source": "MCP Official"},
            {"name": "brave-search", "description": "Brave 웹 검색", "package": "@anthropic/mcp-server-brave-search", "category": "search", "source": "Anthropic"},
            {"name": "fetch", "description": "HTTP 요청 (웹 페이지 가져오기)", "package": "@anthropic/mcp-server-fetch", "category": "network", "source": "Anthropic"},
        ]

        # 현재 설치된 MCP 서버 확인
        installed: set[str] = set()
        if self.paths.settings_path.exists():
            settings = json.loads(self.paths.settings_path.read_text())
            installed = set(settings.get("mcpServers", {}).keys())

        for server in MCP_SERVERS:
            server["installed"] = server["name"] in installed

        return MCP_SERVERS

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
