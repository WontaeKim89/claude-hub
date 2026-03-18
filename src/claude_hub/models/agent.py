"""Agent 모델."""
from pydantic import BaseModel

class AgentSummary(BaseModel):
    name: str
    description: str
    model: str
    tools: list[str]
    max_turns: int

class AgentDetail(BaseModel):
    name: str
    description: str
    model: str
    tools: list[str]
    max_turns: int
    content: str

class AgentCreate(BaseModel):
    name: str
    description: str
    model: str = "sonnet"
    tools: str = "Read, Grep, Glob, Bash"
    max_turns: int = 15
    content: str = ""

class AgentUpdate(BaseModel):
    content: str
