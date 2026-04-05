"""Skill 모델."""
from pydantic import BaseModel

class SkillSummary(BaseModel):
    name: str
    description: str
    source: str
    invoke_command: str
    path: str

class SkillDetail(BaseModel):
    name: str
    description: str
    source: str
    invoke_command: str
    path: str
    content: str
    editable: bool

class SkillCreate(BaseModel):
    name: str
    description: str
    content: str

class SkillUpdate(BaseModel):
    content: str


class SimilarityCheckRequest(BaseModel):
    name: str
    content: str


class MergePreviewRequest(BaseModel):
    skill_a: str
    skill_b: str = ""
    # skill_b가 아직 파일로 존재하지 않을 때, raw content를 직접 전달
    content_b: str = ""
    name_b: str = ""


class MergeExecuteRequest(BaseModel):
    skill_a: str
    skill_b: str = ""
    target_name: str
    content: str
    delete_sources: bool = True
