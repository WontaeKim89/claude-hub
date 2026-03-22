"""Templates + Config Diff & Sync API."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(tags=["templates"])


class SaveTemplateRequest(BaseModel):
    name: str
    display_name: str = ""
    description: str = ""
    claude_md: str = ""
    hooks: list[dict] = []
    mcp_servers: dict = {}
    tags: list[str] = []


class ExportRequest(BaseModel):
    project_path: str


class ApplyRequest(BaseModel):
    project_path: str


class DiffRequest(BaseModel):
    project_a: str
    project_b: str


class SyncRequest(BaseModel):
    source: str
    target: str


@router.get("/templates")
async def list_templates():
    from claude_hub.services.templates import list_templates as _list
    return _list()


@router.get("/templates/{name}")
async def get_template(name: str):
    from claude_hub.services.templates import get_template as _get
    tmpl = _get(name)
    if tmpl is None:
        raise HTTPException(status_code=404, detail=f"Template '{name}' not found")
    return tmpl


@router.post("/templates")
async def save_template(body: SaveTemplateRequest):
    from claude_hub.services.templates import save_template as _save
    name = _save(body.model_dump())
    return {"name": name, "saved": True}


@router.delete("/templates/{name}")
async def delete_template(name: str):
    from claude_hub.services.templates import delete_template as _delete, get_template as _get
    tmpl = _get(name)
    if tmpl is None:
        raise HTTPException(status_code=404, detail=f"Template '{name}' not found")
    if tmpl.get("builtin"):
        raise HTTPException(status_code=400, detail="Built-in templates cannot be deleted")
    deleted = _delete(name)
    return {"deleted": deleted}


@router.post("/templates/export")
async def export_template(body: ExportRequest, request: Request):
    from claude_hub.services.templates import export_current
    config = request.app.state.config
    try:
        result = export_current(body.project_path, config.paths)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/templates/{name}/apply")
async def apply_template(name: str, body: ApplyRequest, request: Request):
    from claude_hub.services.templates import apply_template as _apply
    config = request.app.state.config
    try:
        result = _apply(name, body.project_path, config.paths)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/diff")
async def diff_config(body: DiffRequest, request: Request):
    from claude_hub.services.config_diff import diff_projects
    config = request.app.state.config
    results = diff_projects(body.project_a, body.project_b, config.paths)
    return results


@router.post("/config/sync")
async def sync_config(body: SyncRequest, request: Request):
    from claude_hub.services.config_diff import sync_claude_md
    try:
        result = sync_claude_md(body.source, body.target)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
