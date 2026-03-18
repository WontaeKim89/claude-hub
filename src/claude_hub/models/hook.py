"""Hook 모델."""
from pydantic import BaseModel

class HookEntry(BaseModel):
    type: str = "command"
    command: str
    timeout: int = 2000

class HookGroup(BaseModel):
    matcher: str | None = None
    hooks: list[HookEntry]

class HooksResponse(BaseModel):
    hooks: dict[str, list[HookGroup]]
    last_mtime: float

class HooksUpdate(BaseModel):
    hooks: dict[str, list[dict]]
    last_mtime: float
