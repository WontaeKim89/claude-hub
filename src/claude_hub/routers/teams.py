"""Teams 관리 API."""
import shutil

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["teams"])


@router.get("/teams")
async def list_teams(request: Request):
    config = request.app.state.config
    teams_dir = config.paths.teams_dir
    if not teams_dir.exists():
        return []

    teams = []
    for entry in sorted(teams_dir.iterdir()):
        if entry.is_dir():
            teams.append({"name": entry.name, "path": str(entry)})
    return teams


@router.put("/teams/{name}")
async def update_team(name: str, request: Request):
    config = request.app.state.config
    team_dir = config.paths.teams_dir / name
    if not team_dir.exists():
        raise HTTPException(status_code=404, detail=f"팀 없음: {name}")
    # placeholder: 팀 구조는 향후 확장 예정
    return {"ok": True}


@router.delete("/teams/{name}")
async def delete_team(name: str, request: Request):
    config = request.app.state.config
    backup = request.app.state.backup
    team_dir = config.paths.teams_dir / name
    if not team_dir.exists():
        raise HTTPException(status_code=404, detail=f"팀 없음: {name}")

    # 팀 디렉토리 내 파일들을 백업 후 디렉토리 삭제
    for f in team_dir.rglob("*"):
        if f.is_file():
            backup.create_backup(f)
    shutil.rmtree(team_dir)
    return {"ok": True}
