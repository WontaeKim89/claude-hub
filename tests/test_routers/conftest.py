import pytest
from httpx import ASGITransport, AsyncClient

from claude_hub.config import AppConfig
from claude_hub.main import create_app


@pytest.fixture
def app(fake_claude_dir):
    return create_app(AppConfig(claude_dir=fake_claude_dir))


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
