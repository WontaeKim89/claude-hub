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
