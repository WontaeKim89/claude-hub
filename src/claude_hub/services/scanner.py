"""~/.claude/ 디렉토리 구조 스캔 서비스."""
import json
import re
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


@dataclass
class ScannerService:
    claude_dir: Path = field(default_factory=lambda: Path.home() / ".claude")

    @property
    def _paths(self) -> ClaudePaths:
        return ClaudePaths(claude_dir=self.claude_dir)

    def scan_skills(self) -> list[SkillSummary]:
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
        paths = self._paths
        if not paths.settings_path.exists():
            return {}
        settings = json.loads(paths.settings_path.read_text())
        return settings.get("hooks", {})

    def read_mcp_servers(self) -> list[dict]:
        paths = self._paths
        if not paths.settings_path.exists():
            return []
        settings = json.loads(paths.settings_path.read_text())
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

    def scan_plugins(self) -> list[PluginSummary]:
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
