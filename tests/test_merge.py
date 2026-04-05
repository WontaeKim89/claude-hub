"""스킬 병합 알고리즘 단위 테스트."""
import pytest
from claude_hub.services.merge import merge_skills, _split_sections, MergeResult


# -- _split_sections 테스트 --

class TestSplitSections:
    def test_single_section(self):
        body = "## Purpose\nDo something useful"
        sections = _split_sections(body)
        assert len(sections) == 1
        assert sections[0][0] == "purpose"

    def test_multiple_sections(self):
        body = "## Purpose\nA\n\n## Trigger\nB\n\n## Action\nC"
        sections = _split_sections(body)
        assert len(sections) == 3
        keys = [s[0] for s in sections]
        assert keys == ["purpose", "trigger", "action"]

    def test_intro_section(self):
        body = "Some intro text\n\n## Purpose\nA"
        sections = _split_sections(body)
        assert sections[0][0] == "__intro__"
        assert sections[1][0] == "purpose"

    def test_empty_body(self):
        sections = _split_sections("")
        assert sections == []


# -- merge_skills 테스트 --

SKILL_A = """\
---
name: skill-a
description: Short desc A
---
# Skill A

## Purpose
Do task X efficiently.

## Trigger
When user asks for X.

## Action
Step 1: Do this.
Step 2: Do that.
"""

SKILL_B_SIMILAR = """\
---
name: skill-b
description: A longer description for skill B
---
# Skill B

## Purpose
Do task X efficiently.

## Trigger
When user asks for X.

## Action
Step 1: Do this.
Step 2: Do that.
"""

SKILL_B_DIFFERENT = """\
---
name: skill-b
description: A longer description for skill B
---
# Skill B

## Purpose
Handle task Y completely differently.

## Trigger
When user needs Y processing.

## Constraints
Never do Z.
"""


class TestMergeSkills:
    def test_high_similarity_keeps_a_only(self):
        """유사도 >= 0.9인 동일 섹션은 A 내용만 유지 (common)."""
        result = merge_skills(SKILL_A, SKILL_B_SIMILAR, "skill-a", "skill-b")
        assert isinstance(result, MergeResult)
        assert result.merged_name == "skill-a"
        # description은 더 긴 B 것이 선택됨
        assert result.merged_description == "A longer description for skill B"
        # 모든 source_map이 common이어야 함 (거의 동일하므로)
        sources = {s.source for s in result.source_map if result.merged_content.splitlines()[s.line].strip()}
        assert "common" in sources

    def test_different_sections_both_included(self):
        """유사도 < 0.9인 동일 섹션은 두 내용 모두 포함."""
        result = merge_skills(SKILL_A, SKILL_B_DIFFERENT, "skill-a", "skill-b")
        content = result.merged_content
        # A의 Purpose와 B의 Purpose 모두 포함
        assert "Do task X efficiently" in content
        assert "Handle task Y completely differently" in content

    def test_unique_sections_preserved(self):
        """한쪽에만 있는 섹션은 그대로 추가."""
        result = merge_skills(SKILL_A, SKILL_B_DIFFERENT, "skill-a", "skill-b")
        content = result.merged_content
        # A에만 있는 Action 섹션
        assert "Step 1: Do this" in content
        # B에만 있는 Constraints 섹션
        assert "Never do Z" in content

    def test_source_map_has_entries(self):
        """source_map에 라인 정보가 존재."""
        result = merge_skills(SKILL_A, SKILL_B_DIFFERENT, "skill-a", "skill-b")
        assert len(result.source_map) > 0
        # source 값은 a, b, common 중 하나
        valid_sources = {"a", "b", "common"}
        for s in result.source_map:
            assert s.source in valid_sources

    def test_merged_content_has_frontmatter(self):
        """병합 결과에 frontmatter가 포함."""
        result = merge_skills(SKILL_A, SKILL_B_SIMILAR, "skill-a", "skill-b")
        assert result.merged_content.startswith("---\n")
        assert "name: skill-a" in result.merged_content

    def test_default_name_is_skill_a(self):
        """기본 병합 이름은 skill_a의 frontmatter name."""
        result = merge_skills(SKILL_A, SKILL_B_DIFFERENT, "skill-a", "skill-b")
        assert result.merged_name == "skill-a"
