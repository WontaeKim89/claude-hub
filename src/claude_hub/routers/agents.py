"""Agents CRUD API."""
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from claude_hub.models.agent import AgentCreate, AgentDetail, AgentSummary, AgentUpdate

router = APIRouter(tags=["agents"])


@router.get("/agents", response_model=list[AgentSummary])
async def list_agents(request: Request):
    scanner = request.app.state.scanner
    return scanner.scan_agents()


@router.get("/agents/{name}", response_model=AgentDetail)
async def get_agent(name: str, request: Request):
    scanner = request.app.state.scanner
    agents = scanner.scan_agents()
    agent = next((a for a in agents if a.name == name), None)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"에이전트 없음: {name}")

    config = request.app.state.config
    agent_md = config.paths.agents_dir / f"{name}.md"
    content = agent_md.read_text(encoding="utf-8")
    return AgentDetail(
        name=agent.name,
        description=agent.description,
        model=agent.model,
        tools=agent.tools,
        max_turns=agent.max_turns,
        content=content,
    )


@router.post("/agents", response_model=AgentSummary, status_code=201)
async def create_agent(body: AgentCreate, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    existing = scanner.scan_agents()
    if any(a.name == body.name for a in existing):
        raise HTTPException(status_code=409, detail=f"이미 존재하는 에이전트: {body.name}")

    agents_dir = config.paths.agents_dir
    agents_dir.mkdir(parents=True, exist_ok=True)
    agent_md = agents_dir / f"{body.name}.md"

    frontmatter = (
        f"---\n"
        f"name: {body.name}\n"
        f"description: {body.description}\n"
        f"model: {body.model}\n"
        f"tools: {body.tools}\n"
        f"maxTurns: {body.max_turns}\n"
        f"---\n"
        f"{body.content}"
    )
    editor.write_text(agent_md, frontmatter)

    return AgentSummary(
        name=body.name,
        description=body.description,
        model=body.model,
        tools=[t.strip() for t in body.tools.split(",")],
        max_turns=body.max_turns,
    )


@router.put("/agents/{name}")
async def update_agent(name: str, body: AgentUpdate, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    agents = scanner.scan_agents()
    if not any(a.name == name for a in agents):
        raise HTTPException(status_code=404, detail=f"에이전트 없음: {name}")

    agent_md = config.paths.agents_dir / f"{name}.md"
    editor.write_text(agent_md, body.content)
    return {"ok": True}


@router.delete("/agents/{name}")
async def delete_agent(name: str, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    agents = scanner.scan_agents()
    if not any(a.name == name for a in agents):
        raise HTTPException(status_code=404, detail=f"에이전트 없음: {name}")

    agent_md = config.paths.agents_dir / f"{name}.md"
    if agent_md.exists():
        editor.backup_service.create_backup(agent_md)
        agent_md.unlink()

    from claude_hub.services.scanner import _cache
    _cache.pop("scan_agents", None)
    return {"ok": True}
