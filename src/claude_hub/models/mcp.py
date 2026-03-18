"""MCP Server 모델."""
from pydantic import BaseModel

class McpServer(BaseModel):
    name: str
    command: str
    args: list[str] = []
    env: dict[str, str] = {}

class McpServersResponse(BaseModel):
    servers: list[McpServer]
    last_mtime: float

class McpServersUpdate(BaseModel):
    servers: dict[str, dict]
    last_mtime: float
