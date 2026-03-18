"""Plugin 모델."""
from pydantic import BaseModel

class PluginAssets(BaseModel):
    skills: int = 0
    commands: int = 0
    agents: int = 0

class PluginSummary(BaseModel):
    name: str
    description: str
    version: str
    marketplace: str
    source_type: str
    enabled: bool
    assets: PluginAssets

class PluginToggle(BaseModel):
    enabled: bool
