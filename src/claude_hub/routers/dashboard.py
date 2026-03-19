"""Dashboard + Health API."""
from fastapi import APIRouter, Request

router = APIRouter(tags=["overview"])


@router.get("/dashboard")
async def get_dashboard(request: Request):
    scanner = request.app.state.scanner
    return scanner.get_dashboard()


@router.get("/health")
async def get_health(request: Request):
    validator = request.app.state.validator
    config = request.app.state.config
    results = validator.validate_all(config.claude_dir)
    return {"results": [{"valid": r.valid, "message": r.message, "target": r.target} for r in results]}
