"""Memory 파일 관리 API."""
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(tags=["memory"])


class MemoryFileCreate(BaseModel):
    name: str
    content: str = ""


class MemoryFileUpdate(BaseModel):
    content: str


@router.get("/memory/projects")
async def list_projects(request: Request):
    scanner = request.app.state.scanner
    return scanner.list_projects()


@router.get("/memory/{project}")
async def list_memory_files(project: str, request: Request):
    config = request.app.state.config
    memory_dir = config.paths.projects_dir / project / "memory"
    if not memory_dir.exists():
        raise HTTPException(status_code=404, detail=f"프로젝트 없음: {project}")

    files = []
    for f in sorted(memory_dir.iterdir()):
        if f.is_file() and f.suffix == ".md":
            files.append({"name": f.name, "size": f.stat().st_size})

    return {"project": project, "files": files}


@router.get("/memory/{project}/{file}")
async def get_memory_file(project: str, file: str, request: Request):
    config = request.app.state.config
    file_path = config.paths.projects_dir / project / "memory" / file
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"파일 없음: {file}")

    return {
        "project": project,
        "file": file,
        "content": file_path.read_text(encoding="utf-8"),
    }


@router.put("/memory/{project}/{file}")
async def update_memory_file(project: str, file: str, body: MemoryFileUpdate, request: Request):
    config = request.app.state.config
    editor = request.app.state.editor
    file_path = config.paths.projects_dir / project / "memory" / file
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"파일 없음: {file}")

    editor.write_text(file_path, body.content)
    return {"ok": True}


@router.post("/memory/{project}", status_code=201)
async def create_memory_file(project: str, body: MemoryFileCreate, request: Request):
    config = request.app.state.config
    editor = request.app.state.editor
    memory_dir = config.paths.projects_dir / project / "memory"
    if not memory_dir.exists():
        raise HTTPException(status_code=404, detail=f"프로젝트 없음: {project}")

    file_path = memory_dir / body.name
    if file_path.exists():
        raise HTTPException(status_code=409, detail=f"이미 존재하는 파일: {body.name}")

    editor.write_text(file_path, body.content)
    return {"project": project, "file": body.name}


@router.delete("/memory/{project}/{file}")
async def delete_memory_file(project: str, file: str, request: Request):
    config = request.app.state.config
    backup = request.app.state.backup
    file_path = config.paths.projects_dir / project / "memory" / file
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"파일 없음: {file}")

    backup.create_backup(file_path)
    file_path.unlink()
    return {"ok": True}
