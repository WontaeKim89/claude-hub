"""활성 세션 JSONL 파일의 변경을 감지하고 새 줄을 파싱."""
import json
import platform
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

from claude_hub.utils.paths import ClaudePaths, decode_project_path

_IDLE_TIMEOUT = 30.0
_PERMISSION_WAIT = 3.0  # tool_use 후 이 시간 동안 결과 없으면 permission 대기로 간주


@dataclass
class WatchedFile:
    path: Path
    offset: int = 0
    last_change: float = 0.0
    # permission 알림용: 마지막 tool_use의 시각 (tool_result 오면 리셋)
    pending_tool_use_at: float = 0.0
    permission_notified: bool = False


class SessionWatcher:
    def __init__(self, paths: ClaudePaths, max_age_seconds: float = 300,
                 idle_timeout: float = _IDLE_TIMEOUT):
        self._paths = paths
        self._max_age = max_age_seconds
        self._idle_timeout = idle_timeout
        self._watched: dict[str, WatchedFile] = {}

    def find_active_sessions(self) -> list[Path]:
        """최근 수정된 JSONL 파일 = 활성 세션 후보."""
        now = time.time()
        active: list[Path] = []
        projects_dir = self._paths.projects_dir
        if not projects_dir.exists():
            return active
        for jsonl in projects_dir.rglob("*.jsonl"):
            if "subagents" in jsonl.parts:
                continue
            try:
                if now - jsonl.stat().st_mtime < self._max_age:
                    active.append(jsonl)
            except OSError:
                continue
        return active

    async def poll_new_lines(self) -> list[dict]:
        """새로 추가된 줄을 읽어서 파싱된 이벤트 리스트로 반환."""
        events: list[dict] = []
        now = time.time()
        active = self.find_active_sessions()

        active_keys = {str(p) for p in active}

        # 종료 판정
        for key in list(self._watched):
            watched = self._watched[key]
            gone = key not in active_keys
            idle = (now - watched.last_change) > self._idle_timeout

            if gone or idle:
                self._watched.pop(key)
                events.append({
                    "type": "session_ended",
                    "session_id": watched.path.stem,
                    "project": watched.path.parent.name,
                    "project_path": decode_project_path(watched.path.parent.name),
                })
                continue

        # 새 데이터 읽기
        keys_with_new_data: set[str] = set()
        for path in active:
            key = str(path)
            try:
                stat = path.stat()
            except OSError:
                continue

            if key not in self._watched:
                if now - stat.st_mtime > self._idle_timeout:
                    continue
                watched_file = WatchedFile(path=path, offset=stat.st_size, last_change=now)
                self._watched[key] = watched_file
                events.append({
                    "type": "session_active",
                    "session_id": path.stem,
                    "project": path.parent.name,
                    "project_path": decode_project_path(path.parent.name),
                })
                continue

            watched = self._watched[key]
            if stat.st_size <= watched.offset:
                continue

            watched.last_change = now
            keys_with_new_data.add(key)

            try:
                with open(path, "r", errors="ignore") as f:
                    f.seek(watched.offset)
                    new_data = f.read()
            except OSError:
                continue
            watched.offset = stat.st_size

            for line in new_data.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    event = self._parse_event(entry, path)
                    if event:
                        events.append(event)
                    # stop_reason 기반 즉시 알림 (end_turn)
                    notif = self._check_notification(entry, path)
                    if notif:
                        events.append(notif)
                    # tool_use / tool_result 추적
                    msg = entry.get("message", entry)
                    stop = msg.get("stop_reason", "")
                    if stop == "tool_use":
                        watched.pending_tool_use_at = now
                        watched.permission_notified = False
                    # tool_result가 오면 자동 실행된 것 → permission 아님
                    entry_type = entry.get("type", "")
                    if entry_type == "tool_result" or msg.get("role") == "user":
                        watched.pending_tool_use_at = 0.0
                except (json.JSONDecodeError, TypeError):
                    continue

        # permission 대기 판정: tool_use 후 일정 시간 동안 tool_result가 안 온 경우
        for key, watched in self._watched.items():
            if key in keys_with_new_data:
                continue
            if watched.permission_notified or watched.pending_tool_use_at == 0.0:
                continue
            if (now - watched.pending_tool_use_at) < _PERMISSION_WAIT:
                continue
            watched.permission_notified = True
            project_name = watched.path.parent.name
            project_path = decode_project_path(project_name)
            short_project = project_path.rsplit("/", 1)[-1] if project_path else project_name
            title = f"[{short_project}] Permission needed"
            body = "Claude is waiting for your approval."
            _send_native_notification(title, body)
            events.append({
                "type": "notification",
                "reason": "needs_input",
                "session_id": watched.path.stem,
                "project": project_name,
                "project_path": project_path,
                "title": title,
                "body": body,
            })

        return events

    def _check_notification(self, entry: dict, path: Path) -> dict | None:
        """stop_reason 기반으로 즉시 알림 이벤트를 생성."""
        msg = entry.get("message", entry)
        if msg.get("role") != "assistant":
            return None

        stop_reason = msg.get("stop_reason", "")
        if not stop_reason:
            return None

        project_name = path.parent.name
        project_path = decode_project_path(project_name)
        short_project = project_path.rsplit("/", 1)[-1] if project_path else project_name

        if stop_reason == "end_turn":
            # Claude 응답 완료 → 사용자 입력 대기
            content = msg.get("content", "")
            preview = ""
            if isinstance(content, str):
                preview = content[:80]
            elif isinstance(content, list):
                texts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
                preview = "\n".join(texts)[:80]

            title = f"[{short_project}] Response complete"
            body = preview if preview else "Claude finished responding."
            _send_native_notification(title, body)
            return {
                "type": "notification",
                "reason": "response_complete",
                "session_id": path.stem,
                "project": project_name,
                "project_path": project_path,
                "title": title,
                "body": body,
            }

        if stop_reason == "tool_use":
            # 도구 호출 → permission 대기 가능성
            # tool_result가 바로 이어지면 자동 실행된 것이므로 알림 불필요
            # 여기서는 일단 알림을 보내지 않음 — tool_use 후 데이터가 안 오면
            # idle timeout으로 처리됨
            pass

        return None

    def _parse_event(self, entry: dict, path: Path) -> dict | None:
        msg = entry.get("message", entry)
        role = msg.get("role", "")
        if role not in ("user", "assistant"):
            return None

        content = msg.get("content", "")
        event: dict = {
            "type": "message",
            "role": role,
            "session_id": path.stem,
            "project": path.parent.name,
            "project_path": decode_project_path(path.parent.name),
            "model": msg.get("model", ""),
            "tools": [],
            "text_preview": "",
        }

        if isinstance(content, str):
            event["text_preview"] = content[:300]
        elif isinstance(content, list):
            texts: list[str] = []
            for block in content:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type", "")
                if btype == "text":
                    texts.append(block.get("text", ""))
                elif btype == "tool_use":
                    tool_name = block.get("name", "")
                    tool_input = block.get("input", {})
                    event["tools"].append({
                        "name": tool_name,
                        "summary": _summarize_tool(tool_name, tool_input),
                    })
            event["text_preview"] = "\n".join(texts)[:300]

        return event


def _send_native_notification(title: str, body: str) -> None:
    """macOS 네이티브 알림 센터로 푸시 알림 전송."""
    if platform.system() != "Darwin":
        return
    try:
        script = (
            f'display notification "{body}" '
            f'with title "ClaudeHub" subtitle "{title}" sound name "Glass"'
        )
        subprocess.Popen(
            ["osascript", "-e", script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        pass


def _summarize_tool(name: str, inp: dict) -> str:
    """도구 호출의 요약 텍스트 생성."""
    if name == "Read":
        return inp.get("file_path", "")
    if name == "Write":
        return inp.get("file_path", "")
    if name == "Edit":
        return inp.get("file_path", "")
    if name == "Bash":
        cmd = inp.get("command", "")
        return cmd[:120]
    if name == "Grep":
        return f'/{inp.get("pattern", "")}/'
    if name == "Glob":
        return inp.get("pattern", "")
    if name == "Skill":
        return inp.get("skill", "")
    if name == "Agent":
        return inp.get("description", "")
    return str(inp)[:80]
