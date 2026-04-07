"""MCP Registry 서비스 테스트."""
import json
import pytest
from claude_hub.services.mcp_registry import normalize_server, _is_latest


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


class TestIsLatest:
    def test_real_registry_meta_structure(self):
        """실제 Registry API 응답의 _meta 구조."""
        item = {
            "server": {"name": "test"},
            "_meta": {
                "io.modelcontextprotocol.registry/official": {
                    "isLatest": True,
                    "status": "active",
                }
            },
        }
        assert _is_latest(item) is True

    def test_real_registry_not_latest(self):
        item = {
            "server": {"name": "test"},
            "_meta": {
                "io.modelcontextprotocol.registry/official": {
                    "isLatest": False,
                }
            },
        }
        assert _is_latest(item) is False

    def test_flat_meta_fallback(self):
        """테스트용 간소화된 _meta 구조도 지원."""
        item = {"server": {"name": "test"}, "_meta": {"isLatest": True}}
        assert _is_latest(item) is True

    def test_no_meta(self):
        item = {"server": {"name": "test"}}
        assert _is_latest(item) is False
