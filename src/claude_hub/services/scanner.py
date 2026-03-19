"""~/.claude/ 디렉토리 구조 스캔 서비스."""
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from claude_hub.models.agent import AgentSummary
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
            results.append(
                SkillSummary(
                    name=meta.name,
                    description=meta.description,
                    source="local",
                    invoke_command=f"/skill:{meta.name}",
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

    def get_dashboard(self) -> dict:
        return {
            "skills_count": len(self.scan_skills()),
            "agents_count": len(self.scan_agents()),
            "projects_count": len(self.list_projects()),
            "mcp_servers_count": len(self.read_mcp_servers()),
        }
