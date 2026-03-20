"""Command 모델."""
from pydantic import BaseModel


class CommandSummary(BaseModel):
    name: str
    content_preview: str
    path: str


class CommandDetail(BaseModel):
    name: str
    content: str
    path: str


class CommandCreate(BaseModel):
    name: str
    content: str = ""


class CommandUpdate(BaseModel):
    content: str
