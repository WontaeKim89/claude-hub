"""Marketplace API."""
from fastapi import APIRouter, Request

router = APIRouter(tags=["marketplace"])


@router.get("/marketplace/sources")
async def list_sources(request: Request):
    marketplace = request.app.state.marketplace
    return marketplace.list_sources()


@router.get("/marketplace/browse")
async def browse(
    request: Request,
    source: str | None = None,
    q: str | None = None,
    category: str | None = None,
):
    marketplace = request.app.state.marketplace
    return marketplace.browse(source=source, query=q, category=category)
