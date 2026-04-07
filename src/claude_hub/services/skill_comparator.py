"""LLM 기반 스킬 유사도 비교 서비스 — skills-cleaner 프롬프트 재현."""
import difflib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

from claude_hub.utils.claude_cli import run_claude

# skills-cleaner 프롬프트 원문 기반 4차원 비교 프롬프트
_COMPARE_PROMPT = """\
Read the full SKILL.md content of both skills and compare them across these 4 dimensions:

1. Purpose similarity — Do they solve the same problem?
2. Trigger similarity — Are they invoked in the same situations?
3. Process similarity — Do their workflows overlap?
4. Output similarity — Do they produce the same type of result?

Scoring guidelines:
- High similarity requires solving the same problem in the same way
- Skills covering the same topic but with different roles (e.g., requesting vs receiving) are complementary, NOT duplicates
- If one skill borrows principles from another but applies them to a different domain, score LOW
- Skills at different stages of a workflow are NOT duplicates

--- Skill A: {name_a} ---
{content_a}

--- Skill B: {name_b} ---
{content_b}

Respond ONLY in this JSON format (no other text):
{{
  "similarity_percent": <integer 0-100>,
  "dimensions": {{
    "purpose": {{ "score": <0-100>, "reason": "<one line>" }},
    "trigger": {{ "score": <0-100>, "reason": "<one line>" }},
    "process": {{ "score": <0-100>, "reason": "<one line>" }},
    "output": {{ "score": <0-100>, "reason": "<one line>" }}
  }},
  "overlapping_features": ["<feature 1>", "<feature 2>"],
  "differences": ["<difference 1>", "<difference 2>"],
  "recommendation": "<reason for removal or retention>"
}}"""


def _parse_json_response(raw: str) -> dict | None:
    """Claude CLI 응답에서 JSON을 추출한다. analyzer.py 패턴 재사용."""
    output = raw.strip()

    # ```json ... ``` 래핑 제거
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

    # { 로 시작하는 JSON 객체 찾기
    start = output.find("{")
    end = output.rfind("}")
    if start >= 0 and end > start:
        output = output[start:end + 1]
        return json.loads(output)
    return None


def compare_skill_pair(content_a: str, content_b: str, name_a: str, name_b: str) -> dict:
    """Claude CLI로 두 스킬을 4차원 비교한다.

    LLM 호출 실패 시 difflib 기반 fallback 결과를 반환한다.
    """
    prompt = _COMPARE_PROMPT.format(
        name_a=name_a, content_a=content_a,
        name_b=name_b, content_b=content_b,
    )

    try:
        proc = run_claude("-p", prompt, "--output-format", "json", timeout=180)
        if proc.returncode == 0:
            # --output-format json → {"result": "..."} 구조
            wrapper = json.loads(proc.stdout)
            raw = wrapper.get("result", "") if isinstance(wrapper, dict) else proc.stdout
            parsed = _parse_json_response(raw)
            if parsed and "similarity_percent" in parsed:
                return _normalize_result(parsed, name_a, name_b)
    except Exception:
        pass

    # fallback: difflib 기반 단순 비교
    return _difflib_fallback(content_a, content_b, name_a, name_b)


def compare_skill_pairs_parallel(
    pairs: list[tuple[dict, dict]],
    max_workers: int = 10,
) -> list[dict]:
    """여러 스킬 쌍을 병렬로 LLM 비교한다.

    Args:
        pairs: [(skill_a_info, skill_b_info), ...] 각 info는 name, content, source, description 포함
    """
    results = []

    with ThreadPoolExecutor(max_workers=min(max_workers, len(pairs))) as executor:
        future_map = {}
        for a, b in pairs:
            future = executor.submit(
                compare_skill_pair,
                a["content"], b["content"],
                a["name"], b["name"],
            )
            future_map[future] = (a, b)

        for future in as_completed(future_map):
            a, b = future_map[future]
            try:
                result = future.result()
                # 메타 정보 보강
                result["skill_a"] = a["name"]
                result["skill_b"] = b["name"]
                result["source_a"] = a["source"]
                result["source_b"] = b["source"]
                result["description_a"] = a["description"]
                result["description_b"] = b["description"]
                results.append(result)
            except Exception:
                continue

    results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
    return results


def _normalize_result(parsed: dict, name_a: str, name_b: str) -> dict:
    """LLM 응답을 표준 형식으로 정규화."""
    similarity = parsed.get("similarity_percent", 0)
    grade = "red" if similarity >= 90 else "yellow" if similarity >= 70 else "low"

    return {
        "similarity": similarity,
        "grade": grade,
        "dimensions": parsed.get("dimensions", {}),
        "overlapping_features": parsed.get("overlapping_features", []),
        "differences": parsed.get("differences", []),
        "recommendation": parsed.get("recommendation", ""),
    }


def _difflib_fallback(content_a: str, content_b: str, name_a: str, name_b: str) -> dict:
    """LLM 호출 실패 시 difflib 기반 fallback."""
    import frontmatter as fm

    body_a = fm.loads(content_a).content.strip()
    body_b = fm.loads(content_b).content.strip()

    ratio = difflib.SequenceMatcher(None, body_a, body_b).ratio()
    similarity = round(ratio * 100, 1)
    grade = "red" if similarity >= 90 else "yellow" if similarity >= 70 else "low"

    return {
        "similarity": similarity,
        "grade": grade,
        "dimensions": {
            "purpose": {"score": similarity, "reason": "text-based comparison (LLM unavailable)"},
            "trigger": {"score": similarity, "reason": "text-based comparison (LLM unavailable)"},
            "process": {"score": similarity, "reason": "text-based comparison (LLM unavailable)"},
            "output": {"score": similarity, "reason": "text-based comparison (LLM unavailable)"},
        },
        "overlapping_features": [],
        "differences": [],
        "recommendation": "LLM analysis unavailable — text similarity only",
    }
