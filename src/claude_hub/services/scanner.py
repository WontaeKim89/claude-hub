"""~/.claude/ 디렉토리 구조 스캔 서비스."""
import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

from claude_hub.models.agent import AgentSummary
from claude_hub.models.command import CommandSummary
from claude_hub.models.plugin import PluginAssets, PluginSummary
from claude_hub.models.skill import SkillSummary
from claude_hub.utils.frontmatter import parse_agent_md, parse_skill_md
from claude_hub.utils.paths import ClaudePaths

# 민감 키 탐지 패턴 (env 딕셔너리의 키 이름 기준)
_SENSITIVE_KEY = re.compile(r"(token|key|secret|password)", re.IGNORECASE)

# TTL 캐시 (60초)
_cache: dict[str, tuple[float, object]] = {}
_CACHE_TTL = 60.0


def _cached(key: str, fn):
    """TTL 기반 인메모리 캐시."""
    now = time.time()
    if key in _cache:
        ts, val = _cache[key]
        if now - ts < _CACHE_TTL:
            return val
    val = fn()
    _cache[key] = (now, val)
    return val


def invalidate_settings_cache():
    """settings.json 관련 캐시 무효화. 설정 변경 후 호출."""
    _cache.pop("settings_json", None)


@dataclass
class ScannerService:
    claude_dir: Path = field(default_factory=lambda: Path.home() / ".claude")

    @property
    def _paths(self) -> ClaudePaths:
        return ClaudePaths(claude_dir=self.claude_dir)

    def _read_settings_json(self) -> dict:
        """settings.json을 한번만 읽고 캐시."""
        def _load():
            p = self._paths.settings_path
            if p.exists():
                return json.loads(p.read_text(encoding="utf-8"))
            return {}
        return _cached("settings_json", _load)

    def scan_skills(self) -> list[SkillSummary]:
        return _cached("scan_skills", self._scan_skills_impl)

    def _scan_skills_impl(self) -> list[SkillSummary]:
        skills_dir = self._paths.skills_dir
        if not skills_dir.exists():
            return []
        results = []
        for entry in sorted(skills_dir.iterdir()):
            if not entry.is_dir():
                continue
            skill_md = entry / "SKILL.md"
            if not skill_md.exists():
                continue
            meta = parse_skill_md(skill_md)
            # symlink → installed(외부에서 설치된 스킬), 실제 디렉토리 → custom(직접 만든 스킬)
            source = "custom" if not entry.is_symlink() else "installed"
            results.append(
                SkillSummary(
                    name=meta.name,
                    description=meta.description,
                    source=source,
                    invoke_command=f"/{meta.name}",
                    path=str(skill_md),
                )
            )
        return results

    def scan_agents(self) -> list[AgentSummary]:
        return _cached("scan_agents", self._scan_agents_impl)

    def _scan_agents_impl(self) -> list[AgentSummary]:
        agents_dir = self._paths.agents_dir
        if not agents_dir.exists():
            return []
        results = []
        for entry in sorted(agents_dir.iterdir()):
            if not entry.is_file() or entry.suffix != ".md":
                continue
            meta = parse_agent_md(entry)
            results.append(
                AgentSummary(
                    name=meta.name,
                    description=meta.description,
                    model=meta.model,
                    tools=meta.tools,
                    max_turns=meta.max_turns,
                )
            )
        return results

    def scan_commands(self) -> list[CommandSummary]:
        commands_dir = self._paths.commands_dir
        if not commands_dir.exists():
            return []
        results = []
        for entry in sorted(commands_dir.iterdir()):
            if not entry.is_file() or entry.suffix != ".md":
                continue
            content = entry.read_text(encoding="utf-8")
            preview = content[:100].replace("\n", " ")
            results.append(
                CommandSummary(
                    name=entry.stem,
                    content_preview=preview,
                    path=str(entry),
                )
            )
        return results

    def read_settings(self) -> dict:
        paths = self._paths
        global_settings = {}
        local_settings = {}
        last_mtime = 0.0

        if paths.settings_path.exists():
            global_settings = json.loads(paths.settings_path.read_text())
            last_mtime = paths.settings_path.stat().st_mtime

        if paths.settings_local_path.exists():
            local_settings = json.loads(paths.settings_local_path.read_text())
            local_mtime = paths.settings_local_path.stat().st_mtime
            if local_mtime > last_mtime:
                last_mtime = local_mtime

        return {
            "global_settings": global_settings,
            "local_settings": local_settings,
            "last_mtime": last_mtime,
        }

    def read_hooks(self) -> dict:
        return self._read_settings_json().get("hooks", {})

    def read_mcp_servers(self) -> list[dict]:
        settings = self._read_settings_json()
        raw = settings.get("mcpServers", {})
        results = []
        for name, config in raw.items():
            entry = dict(config)
            entry["name"] = name
            if "env" in entry and isinstance(entry["env"], dict):
                masked_env = {}
                for k, v in entry["env"].items():
                    masked_env[k] = "***" if _SENSITIVE_KEY.search(k) else v
                entry["env"] = masked_env
            results.append(entry)
        return results

    def list_projects(self) -> list[dict]:
        projects = self._paths.list_projects()
        return [
            {
                "encoded": p.encoded,
                "decoded": p.decoded,
                "memory_dir": str(p.memory_dir),
            }
            for p in projects
        ]

    def list_projects_grouped(self) -> list[dict]:
        """프로젝트를 원본 레포와 워크트리로 그룹화."""
        projects = self.list_projects()
        groups: dict[str, dict] = {}

        for p in projects:
            decoded = p["decoded"]
            encoded = p["encoded"]

            # worktree 감지: 경로 마지막 세그먼트에 "worktree"가 포함되면 하위
            last_segment = decoded.rstrip("/").split("/")[-1]
            is_worktree = "worktree" in last_segment.lower()

            # 부모 프로젝트 경로 추정
            if is_worktree:
                parts = decoded.rsplit("-worktree", 1)
                parent_path = parts[0] if parts else decoded
            else:
                parent_path = decoded

            if parent_path not in groups:
                groups[parent_path] = {
                    "path": parent_path,
                    "name": parent_path.rstrip("/").split("/")[-1],
                    "worktrees": [],
                    "main": None,
                }

            entry = {"decoded": decoded, "encoded": encoded, "is_worktree": is_worktree}
            if is_worktree:
                groups[parent_path]["worktrees"].append(entry)
            else:
                groups[parent_path]["main"] = entry

        return list(groups.values())

    def scan_plugins(self) -> list[PluginSummary]:
        return _cached("scan_plugins", self._scan_plugins_impl)

    def _scan_plugins_impl(self) -> list[PluginSummary]:
        paths = self._paths
        installed_path = paths.installed_plugins_path
        if not installed_path.exists():
            return []

        raw = json.loads(installed_path.read_text())

        # version 2 형식: {"version": 2, "plugins": {"name@mp": [...]}}
        if isinstance(raw, dict) and "plugins" in raw:
            plugins_dict = raw["plugins"]
        elif isinstance(raw, list):
            # version 1 형식 (하위 호환)
            plugins_dict = {f"{p['name']}@{p.get('marketplace','')}": [p] for p in raw}
        else:
            return []

        # settings.json 에서 enabledPlugins 상태 조회
        enabled_map: dict[str, bool] = {}
        if paths.settings_path.exists():
            settings = json.loads(paths.settings_path.read_text())
            enabled_map = settings.get("enabledPlugins", {})

        results = []
        cache_root = paths.plugins_dir / "cache"

        for plugin_key, entries in plugins_dict.items():
            # plugin_key: "name@marketplace"
            parts = plugin_key.split("@", 1)
            name = parts[0]
            marketplace = parts[1] if len(parts) > 1 else ""
            # 가장 최근 설치된 엔트리 사용
            entry = entries[-1] if entries else {}
            version = entry.get("version", "")

            description = ""
            assets = PluginAssets()

            # installPath가 있으면 직접 사용, 없으면 추정
            install_path = entry.get("installPath", "")
            cache_dir = Path(install_path) if install_path else cache_root / marketplace / name / version
            if cache_dir.exists():
                plugin_json = cache_dir / ".claude-plugin" / "plugin.json"
                if plugin_json.exists():
                    meta = json.loads(plugin_json.read_text())
                    description = meta.get("description", "")

                # assets 하위 디렉토리 수 카운트
                for asset_key in ("skills", "commands", "agents"):
                    asset_dir = cache_dir / asset_key
                    if asset_dir.is_dir():
                        count = sum(1 for _ in asset_dir.iterdir())
                        setattr(assets, asset_key, count)

            source_type = "official" if "official" in marketplace else "community"
            plugin_key = f"{name}@{marketplace}"
            enabled = enabled_map.get(plugin_key, False)

            results.append(
                PluginSummary(
                    name=name,
                    description=description,
                    version=version,
                    marketplace=marketplace,
                    source_type=source_type,
                    enabled=enabled,
                    assets=assets,
                )
            )

        return results

    def get_project_overview(self, project_path: str) -> dict:
        """프로젝트별 harness 셋팅 현황."""
        from pathlib import Path
        from claude_hub.utils.paths import encode_project_path

        project_dir = Path(project_path).expanduser().resolve()
        encoded = encode_project_path(str(project_dir))
        memory_dir = self._paths.projects_dir / encoded / "memory"

        claude_md = project_dir / "CLAUDE.md"
        docs_dir = project_dir / "docs"
        gitignore = project_dir / ".gitignore"
        readme = project_dir / "README.md"

        items = []

        # CLAUDE.md
        items.append({
            "name": "CLAUDE.md",
            "type": "claude_md",
            "exists": claude_md.exists(),
            "size": claude_md.stat().st_size if claude_md.exists() else 0,
            "lines": len(claude_md.read_text(errors="ignore").splitlines()) if claude_md.exists() else 0,
            "path": str(claude_md),
        })

        # Memory 파일
        memory_files = []
        if memory_dir.exists():
            for f in sorted(memory_dir.iterdir()):
                if f.is_file() and f.suffix == ".md":
                    memory_files.append(f.name)
        items.append({
            "name": "Memory",
            "type": "memory",
            "exists": bool(memory_files),
            "count": len(memory_files),
            "files": memory_files,
            "path": str(memory_dir),
        })

        # docs/ 디렉토리
        doc_files = []
        if docs_dir.exists():
            for f in sorted(docs_dir.rglob("*.md")):
                doc_files.append(str(f.relative_to(project_dir)))
        items.append({
            "name": "docs/",
            "type": "docs",
            "exists": docs_dir.exists(),
            "count": len(doc_files),
            "files": doc_files[:20],
            "path": str(docs_dir),
        })

        # README.md
        items.append({
            "name": "README.md",
            "type": "file",
            "exists": readme.exists(),
            "lines": len(readme.read_text(errors="ignore").splitlines()) if readme.exists() else 0,
            "path": str(readme),
        })

        # tests/ 디렉토리
        tests_dir = project_dir / "tests"
        test_count = len(list(tests_dir.rglob("test_*.py"))) if tests_dir.exists() else 0
        if not tests_dir.exists():
            tests_dir = project_dir / "test"
            test_count = len(list(tests_dir.rglob("*.test.*"))) if tests_dir.exists() else 0
        items.append({
            "name": "tests/",
            "type": "tests",
            "exists": tests_dir.exists(),
            "count": test_count,
            "path": str(tests_dir),
        })

        # 패키지 관리자 파일 탐색
        package_found = False
        for pm in ["pyproject.toml", "package.json", "Cargo.toml", "go.mod"]:
            pm_path = project_dir / pm
            if pm_path.exists():
                items.append({
                    "name": pm,
                    "type": "package_manager",
                    "exists": True,
                    "path": str(pm_path),
                })
                package_found = True
                break
        if not package_found:
            items.append({
                "name": "패키지 관리자",
                "type": "package_manager",
                "exists": False,
                "path": "",
            })

        return {
            "project_path": str(project_dir),
            "project_name": project_dir.name,
            "items": items,
        }

    def get_project_tree(self, project_path: str) -> dict:
        """프로젝트의 .claude 관련 파일을 트리 구조로 반환."""
        from pathlib import Path
        from claude_hub.utils.paths import encode_project_path

        project_dir = Path(project_path).expanduser().resolve()
        encoded = encode_project_path(str(project_dir))
        claude_project_dir = self._paths.projects_dir / encoded

        tree = {
            "project_name": project_dir.name,
            "project_path": str(project_dir),
            "nodes": [],
        }

        # CLAUDE.md (프로젝트 루트)
        claude_md = project_dir / "CLAUDE.md"
        tree["nodes"].append(_file_node("CLAUDE.md", claude_md, warn_lines=200))

        # .claude/ project directory
        claude_node: dict = {"name": ".claude/", "type": "dir", "children": []}

        # memory/
        memory_dir = claude_project_dir / "memory"
        if memory_dir.exists():
            memory_node: dict = {"name": "memory/", "type": "dir", "children": []}
            for f in sorted(memory_dir.iterdir()):
                if f.is_file() and f.suffix == ".md":
                    memory_node["children"].append(_file_node(f.name, f, warn_lines=200))
            claude_node["children"].append(memory_node)
        else:
            claude_node["children"].append({"name": "memory/", "type": "dir", "children": [], "missing": True})

        tree["nodes"].append(claude_node)

        # docs/
        docs_dir = project_dir / "docs"
        if docs_dir.exists():
            docs_node: dict = {"name": "docs/", "type": "dir", "children": []}
            for f in sorted(docs_dir.rglob("*.md"))[:15]:
                rel = str(f.relative_to(docs_dir))
                docs_node["children"].append(_file_node(rel, f))
            tree["nodes"].append(docs_node)

        # tests/
        tests_dir = project_dir / "tests"
        if not tests_dir.exists():
            tests_dir = project_dir / "test"
        if tests_dir.exists():
            test_count = len(list(tests_dir.rglob("test_*")))
            tree["nodes"].append({"name": "tests/", "type": "dir", "count": test_count, "children": []})

        return tree

    def get_dashboard(self) -> dict:
        skills = self.scan_skills()
        plugins = self.scan_plugins()
        hooks = self.read_hooks()
        hook_count = sum(len(groups) for groups in hooks.values())
        return {
            "skills": {"total": len(skills), "custom": sum(1 for s in skills if s.source == "custom"), "installed": sum(1 for s in skills if s.source == "installed")},
            "plugins": {"total": len(plugins), "enabled": sum(1 for p in plugins if p.enabled)},
            "hooks": {"total": hook_count},
            "mcp_servers": {"total": len(self.read_mcp_servers())},
            "agents": {"total": len(self.scan_agents())},
            "projects": {"total": len(self.list_projects())},
        }


def _file_node(name: str, path: object, warn_lines: int = 0) -> dict:
    """파일 노드 생성. warn_lines 초과 시 compact 경고 플래그 설정."""
    from pathlib import Path
    p = Path(str(path))
    if not p.exists():
        return {"name": name, "type": "file", "exists": False, "path": str(p)}

    content = p.read_text(errors="ignore")
    lines = len(content.splitlines())
    size = p.stat().st_size

    return {
        "name": name,
        "type": "file",
        "exists": True,
        "path": str(p),
        "lines": lines,
        "size": size,
        "needs_compact": warn_lines > 0 and lines > warn_lines,
    }
