"""Claude CLI 호출 유틸리티 — PATH 문제 방지."""
import os
import shutil
import subprocess
from pathlib import Path


def _find_claude() -> str:
    """claude CLI의 절대 경로를 찾는다."""
    # 1. shutil.which로 먼저 시도
    found = shutil.which("claude")
    if found:
        return found

    # 2. 일반적인 설치 경로 직접 탐색
    candidates = [
        Path.home() / ".npm-global" / "bin" / "claude",
        Path.home() / ".local" / "bin" / "claude",
        Path("/opt/homebrew/bin/claude"),
        Path("/usr/local/bin/claude"),
        Path.home() / ".bun" / "bin" / "claude",
    ]
    for c in candidates:
        if c.exists():
            return str(c)

    return "claude"  # fallback


CLAUDE_BIN = _find_claude()


def run_claude(*args: str, timeout: int = 60, **kwargs) -> subprocess.CompletedProcess:
    """Claude CLI를 안전하게 실행. PATH 문제를 방지."""
    env = os.environ.copy()
    # PATH에 일반적인 경로 추가
    extra_paths = [
        str(Path.home() / ".npm-global" / "bin"),
        str(Path.home() / ".local" / "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ]
    env["PATH"] = ":".join(extra_paths) + ":" + env.get("PATH", "")

    return subprocess.run(
        [CLAUDE_BIN, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
        **kwargs,
    )


def popen_claude(*args: str, **kwargs) -> subprocess.Popen:
    """Claude CLI를 백그라운드로 실행."""
    env = os.environ.copy()
    extra_paths = [
        str(Path.home() / ".npm-global" / "bin"),
        str(Path.home() / ".local" / "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ]
    env["PATH"] = ":".join(extra_paths) + ":" + env.get("PATH", "")

    return subprocess.Popen(
        [CLAUDE_BIN, *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        **kwargs,
    )
