"""토큰/비용 추적 서비스."""
import json
import time
from dataclasses import dataclass
from pathlib import Path
from claude_hub.utils.paths import ClaudePaths

# Claude 모델별 가격 (USD per 1M tokens)
MODEL_PRICING = {
    "opus": {"input": 5.0, "output": 25.0},
    "sonnet": {"input": 3.0, "output": 15.0},
    "haiku": {"input": 1.0, "output": 5.0},
}


@dataclass
class CostService:
    paths: ClaudePaths

    def get_summary(self, days: int = 7) -> dict:
        """기간별 비용 요약."""
        cutoff = time.time() - (days * 86400)
        total_in = 0
        total_out = 0
        total_cost = 0.0
        session_count = 0
        tool_calls = 0
        model_usage = {}

        for jsonl_file in self.paths.projects_dir.rglob("*.jsonl"):
            try:
                stat = jsonl_file.stat()
                if stat.st_mtime < cutoff:
                    continue
                session_count += 1
                with open(jsonl_file, "r", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entry = json.loads(line)
                            msg = entry.get("message", entry)
                            usage = msg.get("usage", entry.get("usage", {}))
                            model = msg.get("model", entry.get("model", ""))

                            if usage:
                                inp = usage.get("input_tokens", 0)
                                out = usage.get("output_tokens", 0)
                                total_in += inp
                                total_out += out

                                # 모델별 비용 계산
                                model_key = "opus" if "opus" in model else "sonnet" if "sonnet" in model else "haiku" if "haiku" in model else "sonnet"
                                pricing = MODEL_PRICING.get(model_key, MODEL_PRICING["sonnet"])
                                cost = (inp / 1_000_000 * pricing["input"]) + (out / 1_000_000 * pricing["output"])
                                total_cost += cost

                                model_usage.setdefault(model_key, {"input": 0, "output": 0, "cost": 0.0})
                                model_usage[model_key]["input"] += inp
                                model_usage[model_key]["output"] += out
                                model_usage[model_key]["cost"] += cost

                            # 도구 호출 수
                            content = msg.get("content", [])
                            if isinstance(content, list):
                                tool_calls += sum(1 for b in content if isinstance(b, dict) and b.get("type") == "tool_use")
                        except (json.JSONDecodeError, TypeError):
                            continue
            except Exception:
                continue

        return {
            "days": days,
            "total_tokens_in": total_in,
            "total_tokens_out": total_out,
            "total_cost_usd": round(total_cost, 2),
            "daily_avg_cost": round(total_cost / max(days, 1), 2),
            "session_count": session_count,
            "tool_calls": tool_calls,
            "model_usage": model_usage,
        }

    def get_combined_summary(self) -> dict:
        """주간+월간+오늘 비용을 단일 패스로 계산 (대시보드용)."""
        import datetime

        now = time.time()
        cutoff_weekly = now - (7 * 86400)
        cutoff_monthly = now - (30 * 86400)
        # 오늘 00:00 기준 cutoff
        today_start = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()

        today = {"tokens_in": 0, "tokens_out": 0, "cost": 0.0, "sessions": 0, "tool_calls": 0}
        weekly = {"tokens_in": 0, "tokens_out": 0, "cost": 0.0, "sessions": 0, "tool_calls": 0}
        monthly = {"tokens_in": 0, "tokens_out": 0, "cost": 0.0, "sessions": 0, "tool_calls": 0}
        model_usage: dict = {}

        for jsonl_file in self.paths.projects_dir.rglob("*.jsonl"):
            try:
                # 서브에이전트 세션 제외 (세션 카운트에서)
                is_subagent = "subagents" in jsonl_file.parts or jsonl_file.stem.startswith("agent-")
                stat = jsonl_file.stat()
                mtime = stat.st_mtime
                if mtime < cutoff_monthly:
                    continue

                is_weekly = mtime >= cutoff_weekly
                is_today = mtime >= today_start
                if not is_subagent:
                    monthly["sessions"] += 1
                    if is_weekly:
                        weekly["sessions"] += 1
                    if is_today:
                        today["sessions"] += 1

                with open(jsonl_file, "r", errors="ignore") as f:
                    for line in f:
                        # 빠른 필터: "input_tokens"가 없으면 usage 데이터 없으므로 스킵
                        if "input_tokens" not in line:
                            continue
                        try:
                            entry = json.loads(line)
                            msg = entry.get("message", entry)
                            usage = msg.get("usage", entry.get("usage", {}))
                            if not usage or "input_tokens" not in usage:
                                continue
                            model = msg.get("model", entry.get("model", ""))

                            inp = usage.get("input_tokens", 0)
                            out = usage.get("output_tokens", 0)
                            model_key = "opus" if "opus" in model else "sonnet" if "sonnet" in model else "haiku" if "haiku" in model else "sonnet"
                            pricing = MODEL_PRICING.get(model_key, MODEL_PRICING["sonnet"])
                            cost = (inp / 1_000_000 * pricing["input"]) + (out / 1_000_000 * pricing["output"])

                            monthly["tokens_in"] += inp
                            monthly["tokens_out"] += out
                            monthly["cost"] += cost

                            if is_weekly:
                                weekly["tokens_in"] += inp
                                weekly["tokens_out"] += out
                                weekly["cost"] += cost

                            if is_today:
                                today["tokens_in"] += inp
                                today["tokens_out"] += out
                                today["cost"] += cost

                            model_usage.setdefault(model_key, {"input": 0, "output": 0, "cost": 0.0})
                            model_usage[model_key]["input"] += inp
                            model_usage[model_key]["output"] += out
                            model_usage[model_key]["cost"] += cost
                        except (json.JSONDecodeError, TypeError):
                            continue
            except Exception:
                continue

        # stats-cache.json에서 오늘 활동 데이터 보강
        stats_cache = self.paths.claude_dir / "stats-cache.json"
        today_activity = None
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        if stats_cache.exists():
            try:
                cache = json.loads(stats_cache.read_text())
                for day in reversed(cache.get("dailyActivity", [])):
                    if day.get("date") == today_str:
                        today_activity = {
                            "messages": day.get("messageCount", 0),
                            "sessions": day.get("sessionCount", 0),
                            "tool_calls": day.get("toolCallCount", 0),
                        }
                        break
            except Exception:
                pass

        return {
            "today": {
                "sessions": today["sessions"],
                "tokens_in": today["tokens_in"],
                "tokens_out": today["tokens_out"],
                "cost": round(today["cost"], 2),
                "tool_calls": today["tool_calls"],
                "activity": today_activity,
            },
            "weekly": {
                "sessions": weekly["sessions"],
                "tokens_in": weekly["tokens_in"],
                "tokens_out": weekly["tokens_out"],
                "cost": round(weekly["cost"], 2),
            },
            "monthly": {
                "sessions": monthly["sessions"],
                "tokens_in": monthly["tokens_in"],
                "tokens_out": monthly["tokens_out"],
                "cost": round(monthly["cost"], 2),
            },
            "daily_avg_cost": round(monthly["cost"] / 30, 2),
            "model_breakdown": model_usage,
        }

    def get_by_project(self, days: int = 7) -> list[dict]:
        """프로젝트별 비용. 서브에이전트는 부모 프로젝트로 합산, 경로 디코딩 포함."""
        from claude_hub.utils.paths import decode_project_path

        cutoff = time.time() - (days * 86400)
        projects = {}

        for jsonl_file in self.paths.projects_dir.rglob("*.jsonl"):
            try:
                if jsonl_file.stat().st_mtime < cutoff:
                    continue
                encoded = jsonl_file.parent.name

                # 서브에이전트 세션은 제외
                if encoded == "subagents" or jsonl_file.stem.startswith("agent-"):
                    continue

                decoded = decode_project_path(encoded)
                # 디코딩된 경로에서 프로젝트명 추출
                project_name = decoded.rstrip("/").split("/")[-1] if "/" in decoded else encoded

                if encoded not in projects:
                    projects[encoded] = {"project": project_name, "project_path": decoded, "tokens_in": 0, "tokens_out": 0, "cost": 0.0, "sessions": 0}
                projects[encoded]["sessions"] += 1

                with open(jsonl_file, "r", errors="ignore") as f:
                    for line in f:
                        if "input_tokens" not in line:
                            continue
                        try:
                            entry = json.loads(line)
                            msg = entry.get("message", entry)
                            usage = msg.get("usage", entry.get("usage", {}))
                            if not usage or "input_tokens" not in usage:
                                continue
                            model = msg.get("model", entry.get("model", ""))
                            inp = usage.get("input_tokens", 0)
                            out = usage.get("output_tokens", 0)
                            projects[encoded]["tokens_in"] += inp
                            projects[encoded]["tokens_out"] += out
                            model_key = "opus" if "opus" in model else "sonnet" if "sonnet" in model else "haiku" if "haiku" in model else "sonnet"
                            pricing = MODEL_PRICING.get(model_key, MODEL_PRICING["sonnet"])
                            projects[encoded]["cost"] += (inp / 1_000_000 * pricing["input"]) + (out / 1_000_000 * pricing["output"])
                        except (json.JSONDecodeError, TypeError):
                            continue
            except Exception:
                continue

        result = sorted(projects.values(), key=lambda x: x["cost"], reverse=True)
        for r in result:
            r["cost"] = round(r["cost"], 2)
        return result
