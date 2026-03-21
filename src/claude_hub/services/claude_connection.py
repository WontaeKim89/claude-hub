"""Claude CLI 연결 상태 확인."""
import subprocess
from dataclasses import dataclass


@dataclass
class ClaudeStatus:
    connected: bool
    version: str | None = None


def check_claude_connection() -> ClaudeStatus:
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return ClaudeStatus(connected=True, version=result.stdout.strip())
    except Exception:
        pass
    return ClaudeStatus(connected=False)
