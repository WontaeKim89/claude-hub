"""Settings 모델."""
from pydantic import BaseModel

class SettingsResponse(BaseModel):
    global_settings: dict
    local_settings: dict
    last_mtime: float

class SettingsUpdate(BaseModel):
    settings: dict
    scope: str = "global"
    last_mtime: float
