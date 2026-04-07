"""스킬 병합 서비스 — 섹션 기반 병합 알고리즘."""
import difflib
import re
from dataclasses import dataclass, field


@dataclass
class SourceLine:
    """병합 결과의 각 라인에 대한 출처 정보."""
    line: int
    source: str  # "a" | "b" | "common"


@dataclass
class MergeResult:
    """병합 알고리즘의 결과."""
    merged_content: str
    merged_name: str
    merged_description: str
    source_map: list[SourceLine] = field(default_factory=list)


def _split_sections(body: str) -> list[tuple[str, str]]:
    """마크다운 body를 ## 헤더 기준으로 섹션 분리.

    Returns:
        [(header_key, full_text), ...] 형태의 리스트.
        헤더가 없는 도입부는 header_key="__intro__"로 처리.
    """
    sections: list[tuple[str, str]] = []
    current_key = "__intro__"
    current_lines: list[str] = []

    for line in body.splitlines():
        # ## 또는 # 으로 시작하는 헤더 감지
        m = re.match(r"^(#{1,3})\s+(.+)$", line)
        if m:
            # 이전 섹션 저장
            text = "\n".join(current_lines).strip()
            if text or current_key != "__intro__":
                sections.append((current_key, text))
            # 새 섹션 시작 — 헤더 텍스트를 정규화하여 매칭 키로 사용
            current_key = m.group(2).strip().lower()
            current_lines = [line]
        else:
            current_lines.append(line)

    # 마지막 섹션 저장
    text = "\n".join(current_lines).strip()
    if text or current_key != "__intro__":
        sections.append((current_key, text))

    return sections


def merge_skills(content_a: str, content_b: str, name_a: str, name_b: str) -> MergeResult:
    """두 스킬의 SKILL.md 내용을 섹션 기반으로 병합한다.

    Args:
        content_a: 스킬 A의 전체 SKILL.md 내용
        content_b: 스킬 B의 전체 SKILL.md 내용
        name_a: 스킬 A 이름
        name_b: 스킬 B 이름

    Returns:
        MergeResult — 병합된 내용, 이름, 설명, source_map
    """
    from claude_hub.utils.frontmatter import parse_skill_md
    from pathlib import Path
    import tempfile, os

    # frontmatter 파싱을 위해 임시 파일 사용
    meta_a = _parse_content(content_a, name_a)
    meta_b = _parse_content(content_b, name_b)

    # frontmatter 병합: name은 A 기본값, description은 더 긴 것
    merged_name = meta_a["name"]
    merged_desc = meta_a["description"] if len(meta_a["description"]) >= len(meta_b["description"]) else meta_b["description"]

    # body 섹션 분리
    sections_a = _split_sections(meta_a["body"])
    sections_b = _split_sections(meta_b["body"])

    # 섹션 매칭 및 병합
    merged_lines: list[str] = []
    source_map: list[SourceLine] = []
    used_b_keys: set[str] = set()

    # A 기준으로 순회하면서 B에서 매칭되는 섹션 찾기
    b_dict: dict[str, str] = {key: text for key, text in sections_b}

    for key_a, text_a in sections_a:
        if key_a in b_dict:
            # 동일 섹션이 양쪽에 존재
            used_b_keys.add(key_a)
            text_b = b_dict[key_a]
            ratio = difflib.SequenceMatcher(None, text_a, text_b).ratio()

            if ratio >= 0.9:
                # 거의 동일 → A 내용만 유지 (공통 처리)
                _append_lines(merged_lines, source_map, text_a, "common")
            else:
                # 차이가 있음 → 둘 다 포함
                _append_lines(merged_lines, source_map, text_a, "a")
                # 구분 빈 줄
                _append_lines(merged_lines, source_map, "", "b")
                _append_lines(merged_lines, source_map, text_b, "b")
        else:
            # A에만 있는 섹션
            _append_lines(merged_lines, source_map, text_a, "a")

        # 섹션 간 빈 줄 구분
        if merged_lines and merged_lines[-1] != "":
            _append_lines(merged_lines, source_map, "", "common")

    # B에만 있는 고유 섹션 추가
    for key_b, text_b in sections_b:
        if key_b not in used_b_keys:
            _append_lines(merged_lines, source_map, text_b, "b")
            if merged_lines and merged_lines[-1] != "":
                _append_lines(merged_lines, source_map, "", "common")

    # frontmatter + body 조합
    merged_body = "\n".join(merged_lines).rstrip()
    merged_content = f"---\nname: {merged_name}\ndescription: {merged_desc}\n---\n{merged_body}\n"

    return MergeResult(
        merged_content=merged_content,
        merged_name=merged_name,
        merged_description=merged_desc,
        source_map=source_map,
    )


def _parse_content(content: str, fallback_name: str) -> dict:
    """SKILL.md 내용 문자열에서 frontmatter를 파싱한다."""
    import frontmatter as fm
    post = fm.loads(content)
    return {
        "name": post.get("name", fallback_name),
        "description": post.get("description", ""),
        "body": post.content,
    }


def _append_lines(
    merged_lines: list[str],
    source_map: list[SourceLine],
    text: str,
    source: str,
) -> None:
    """텍스트를 라인별로 분리하여 merged_lines와 source_map에 추가."""
    if text == "":
        idx = len(merged_lines)
        merged_lines.append("")
        source_map.append(SourceLine(line=idx, source=source))
        return

    for line in text.splitlines():
        idx = len(merged_lines)
        merged_lines.append(line)
        source_map.append(SourceLine(line=idx, source=source))
