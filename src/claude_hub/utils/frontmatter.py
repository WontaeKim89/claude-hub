"""YAML frontmatter 파서."""
from dataclasses import dataclass
from pathlib import Path

import frontmatter


@dataclass
class SkillMeta:
    name: str
    description: str
    body: str
    path: Path


@dataclass
class AgentMeta:
    name: str
    description: str
    tools: list[str]
    model: str
    max_turns: int
    body: str
    path: Path


def parse_skill_md(path: Path) -> SkillMeta:
    post = frontmatter.load(str(path))
    return SkillMeta(
        name=post.get("name", path.parent.name),
        description=post.get("description", ""),
        body=post.content,
        path=path,
    )


def parse_agent_md(path: Path) -> AgentMeta:
    post = frontmatter.load(str(path))
    tools_raw = post.get("tools", "")
    tools = [t.strip() for t in tools_raw.split(",")] if isinstance(tools_raw, str) else tools_raw
    return AgentMeta(
        name=post.get("name", path.stem),
        description=post.get("description", ""),
        tools=tools,
        model=post.get("model", ""),
        max_turns=int(post.get("maxTurns", 0)),
        body=post.content,
        path=path,
    )
