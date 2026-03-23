"""스킬/플러그인 사용패턴 분석 — 정량(Python) + 정성(Claude CLI)."""
import json
import time
from dataclasses import dataclass

from claude_hub.utils.claude_cli import run_claude

from claude_hub.services.usage_db import UsageDB


@dataclass
class SkillScore:
    name: str
    source: str
    description: str
    total_hits: int
    last_used: float
    project_count: int
    frequency_score: float      # /25
    recency_score: float        # /20
    versatility_score: float    # /15
    trigger_accuracy: float     # /20 (Claude)
    replaceability: float       # /20 (Claude)
    total_score: float          # /100
    ai_comment: str


def analyze_skills(db: UsageDB, skills: list[dict], total_projects: int) -> list[SkillScore]:
    """전체 스킬 비교 분석 — 정량 점수 산출."""
    all_stats = db.get_top_skills(limit=1000)
    stats_map = {s["name"]: s for s in all_stats}
    all_hits = [s["hit_count"] for s in all_stats] if all_stats else [0]
    max_hits = max(all_hits) if all_hits else 1

    project_data = _get_project_usage(db)

    results = []
    for skill in skills:
        name = skill.get("name", "")
        stat = stats_map.get(name, {})
        hits = stat.get("hit_count", 0)
        last = stat.get("last_used", 0)

        # 사용 빈도 (25점) — 상대 비율
        freq = (hits / max_hits * 25) if max_hits > 0 else 0

        # 최근 활성도 (20점) — 감쇠
        days_ago = (time.time() - last) / 86400 if last > 0 else 999
        if days_ago <= 1:
            rec = 20
        elif days_ago <= 7:
            rec = 16
        elif days_ago <= 14:
            rec = 12
        elif days_ago <= 30:
            rec = 8
        else:
            rec = max(0, 4 - (days_ago - 30) / 30 * 4)

        # 프로젝트 범용성 (15점)
        proj_count = len(project_data.get(name, set()))
        vers = (proj_count / total_projects * 15) if total_projects > 0 else 0

        total_quantitative = freq + rec + vers

        results.append(SkillScore(
            name=name,
            source=skill.get("source", ""),
            description=skill.get("description", ""),
            total_hits=hits,
            last_used=last,
            project_count=proj_count,
            frequency_score=round(freq, 1),
            recency_score=round(rec, 1),
            versatility_score=round(vers, 1),
            trigger_accuracy=0,
            replaceability=0,
            total_score=round(total_quantitative, 1),
            ai_comment="",
        ))

    results.sort(key=lambda x: x.total_score, reverse=True)
    return results


def _get_project_usage(db: UsageDB) -> dict[str, set[str]]:
    """스킬별 사용된 프로젝트 집합."""
    import sqlite3
    result: dict[str, set[str]] = {}
    try:
        with db._connect() as conn:
            rows = conn.execute(
                "SELECT name, project FROM usage_events WHERE type='skill' AND project IS NOT NULL"
            ).fetchall()
            for name, project in rows:
                result.setdefault(name, set()).add(project)
    except Exception:
        pass
    return result


def analyze_with_claude(skills_data: list[dict]) -> list[dict]:
    """Claude CLI로 정성 분석 실행."""
    prompt = f"""아래는 Claude Code에서 사용 중인 스킬들의 사용 통계입니다.
각 스킬의 유용성을 평가해주세요.

평가 기준 (Claude Skill Evaluation Framework 기반, https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills):
1. 트리거 정확도 (0-20점): 스킬의 설명(description)이 실제 사용 맥락과 일치하는가
2. 대체 가능성 (0-20점, 높을수록 대체 어려움=좋음): 기본 모델로 충분하거나 다른 스킬과 기능 중복인가

각 스킬에 대해 trigger_accuracy(0-20), replaceability(0-20), comment(한줄 한국어) 를 포함하는 JSON 배열로 응답하세요.
중복되는 스킬 그룹이 있다면 comment에 명시하세요.

스킬 데이터:
{json.dumps(skills_data, ensure_ascii=False, indent=2)}

응답 형식 (JSON만, 다른 텍스트 없이):
[{{"name": "skill-name", "trigger_accuracy": 18, "replaceability": 15, "comment": "한줄 평가"}}]"""

    try:
        proc = run_claude("-p", prompt, "--output-format", "json", timeout=180)
        if proc.returncode == 0:
            # --output-format json → {"result": "...", ...} 구조
            wrapper = json.loads(proc.stdout)
            output = wrapper.get("result", "") if isinstance(wrapper, dict) else proc.stdout

            # JSON 배열 추출 (```json ... ``` 래핑 제거)
            output = output.strip()
            if "```" in output:
                lines = output.split("\n")
                json_lines = []
                in_block = False
                for line in lines:
                    if line.strip().startswith("```"):
                        in_block = not in_block
                        continue
                    if in_block:
                        json_lines.append(line)
                output = "\n".join(json_lines)

            # [ 로 시작하는 JSON 배열 찾기
            start = output.find("[")
            end = output.rfind("]")
            if start >= 0 and end > start:
                output = output[start:end + 1]

            return json.loads(output)
    except Exception:
        pass
    return []
