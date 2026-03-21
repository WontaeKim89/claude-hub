"""사용패턴 AI 분석 API."""
from fastapi import APIRouter, Request

from claude_hub.services.claude_connection import check_claude_connection

router = APIRouter(tags=["analysis"])


@router.get("/claude/status")
async def claude_status():
    status = check_claude_connection()
    return {"connected": status.connected, "version": status.version}


@router.post("/analysis/skills")
async def analyze_skills_endpoint(request: Request):
    """전체 스킬 비교 분석."""
    status = check_claude_connection()

    scanner = request.app.state.scanner
    db = request.app.state.usage_db

    skills = scanner.scan_skills()
    skills_data = [{"name": s.name, "source": s.source, "description": s.description} for s in skills]
    total_projects = len(scanner.list_projects())

    from claude_hub.services.analyzer import analyze_skills, analyze_with_claude
    results = analyze_skills(db, skills_data, total_projects)

    ai_results = []
    if status.connected:
        analysis_input = [
            {
                "name": r.name,
                "source": r.source,
                "total_hits": r.total_hits,
                "project_count": r.project_count,
                "description": next((s["description"] for s in skills_data if s["name"] == r.name), ""),
            }
            for r in results
        ]
        ai_results = analyze_with_claude(analysis_input)

    if ai_results and isinstance(ai_results, list):
        ai_map = {r.get("name", ""): r for r in ai_results if isinstance(r, dict)}
        for result in results:
            ai = ai_map.get(result.name, {})
            result.trigger_accuracy = ai.get("trigger_accuracy", 0)
            result.replaceability = ai.get("replaceability", 0)
            result.ai_comment = ai.get("comment", "")
            result.total_score = round(
                result.frequency_score + result.recency_score + result.versatility_score +
                result.trigger_accuracy + result.replaceability, 1
            )

    results.sort(key=lambda x: x.total_score, reverse=True)

    return {
        "items": [vars(r) for r in results],
        "total_analyzed": len(results),
        "claude_connected": status.connected,
        "reference_url": "https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills",
    }


@router.post("/analysis/plugins")
async def analyze_plugins_endpoint(request: Request):
    """전체 플러그인 비교 분석. 스킬과 동일한 로직."""
    status = check_claude_connection()
    scanner = request.app.state.scanner
    db = request.app.state.usage_db

    plugins = scanner.scan_plugins()
    plugins_data = [{"name": p.name, "source": p.source_type, "description": p.description} for p in plugins]
    total_projects = len(scanner.list_projects())

    from claude_hub.services.analyzer import analyze_skills
    results = analyze_skills(db, plugins_data, total_projects)

    return {
        "items": [vars(r) for r in results],
        "total_analyzed": len(results),
        "claude_connected": status.connected,
        "reference_url": "https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills",
    }
