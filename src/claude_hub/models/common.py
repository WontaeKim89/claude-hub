"""공통 응답/에러 모델."""
from pydantic import BaseModel

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = {}

class ErrorResponse(BaseModel):
    error: ErrorDetail

class DiffRequest(BaseModel):
    target: str
    scope: str
    content: str | dict

class DiffResponse(BaseModel):
    diff: str
    target_path: str
