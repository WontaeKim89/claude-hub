"""Commands CRUD API."""
from fastapi import APIRouter, HTTPException, Request

from claude_hub.models.command import CommandCreate, CommandDetail, CommandSummary, CommandUpdate

router = APIRouter(tags=["commands"])


@router.get("/commands", response_model=list[CommandSummary])
async def list_commands(request: Request):
    scanner = request.app.state.scanner
    return scanner.scan_commands()


@router.get("/commands/{name}", response_model=CommandDetail)
async def get_command(name: str, request: Request):
    scanner = request.app.state.scanner
    commands = scanner.scan_commands()
    cmd = next((c for c in commands if c.name == name), None)
    if cmd is None:
        raise HTTPException(status_code=404, detail=f"커맨드 없음: {name}")

    from pathlib import Path
    cmd_md = Path(cmd.path)
    content = cmd_md.read_text(encoding="utf-8")
    return CommandDetail(name=cmd.name, content=content, path=cmd.path)


@router.post("/commands", response_model=CommandSummary, status_code=201)
async def create_command(body: CommandCreate, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    existing = scanner.scan_commands()
    if any(c.name == body.name for c in existing):
        raise HTTPException(status_code=409, detail=f"이미 존재하는 커맨드: {body.name}")

    commands_dir = config.paths.commands_dir
    commands_dir.mkdir(parents=True, exist_ok=True)
    cmd_md = commands_dir / f"{body.name}.md"
    editor.write_text(cmd_md, body.content)

    preview = body.content[:100].replace("\n", " ")
    return CommandSummary(name=body.name, content_preview=preview, path=str(cmd_md))


@router.put("/commands/{name}")
async def update_command(name: str, body: CommandUpdate, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    commands = scanner.scan_commands()
    if not any(c.name == name for c in commands):
        raise HTTPException(status_code=404, detail=f"커맨드 없음: {name}")

    from pathlib import Path
    cmd_md = config.paths.commands_dir / f"{name}.md"
    editor.write_text(cmd_md, body.content)
    return {"ok": True}


@router.delete("/commands/{name}")
async def delete_command(name: str, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    commands = scanner.scan_commands()
    if not any(c.name == name for c in commands):
        raise HTTPException(status_code=404, detail=f"커맨드 없음: {name}")

    from pathlib import Path
    cmd_md = config.paths.commands_dir / f"{name}.md"
    if cmd_md.exists():
        editor.backup_service.create_backup(cmd_md)
        cmd_md.unlink()
    return {"ok": True}
