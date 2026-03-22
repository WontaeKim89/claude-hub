"""토큰/비용 추적 서비스."""
import json
import time
from dataclasses import dataclass
from pathlib import Path
from claude_hub.utils.paths import ClaudePaths

# Claude 모델별 가격 (USD per 1M tokens)
MODEL_PRICING = {
    "opus": {"input": 15.0, "output": 75.0},
    "sonnet": {"input": 3.0, "output": 15.0},
    "haiku": {"input": 0.25, "output": 1.25},
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

    def get_by_project(self, days: int = 7) -> list[dict]:
        """프로젝트별 비용."""
        cutoff = time.time() - (days * 86400)
        projects = {}

        for jsonl_file in self.paths.projects_dir.rglob("*.jsonl"):
            try:
                if jsonl_file.stat().st_mtime < cutoff:
                    continue
                project = jsonl_file.parent.name
                if project not in projects:
                    projects[project] = {"project": project, "tokens_in": 0, "tokens_out": 0, "cost": 0.0, "sessions": 0}
                projects[project]["sessions"] += 1

                with open(jsonl_file, "r", errors="ignore") as f:
                    for line in f:
                        try:
                            entry = json.loads(line.strip())
                            msg = entry.get("message", entry)
                            usage = msg.get("usage", entry.get("usage", {}))
                            model = msg.get("model", entry.get("model", ""))
                            if usage:
                                inp = usage.get("input_tokens", 0)
                                out = usage.get("output_tokens", 0)
                                projects[project]["tokens_in"] += inp
                                projects[project]["tokens_out"] += out
                                model_key = "opus" if "opus" in model else "sonnet" if "sonnet" in model else "haiku" if "haiku" in model else "sonnet"
                                pricing = MODEL_PRICING.get(model_key, MODEL_PRICING["sonnet"])
                                projects[project]["cost"] += (inp / 1_000_000 * pricing["input"]) + (out / 1_000_000 * pricing["output"])
                        except (json.JSONDecodeError, TypeError):
                            continue
            except Exception:
                continue

        result = sorted(projects.values(), key=lambda x: x["cost"], reverse=True)
        for r in result:
            r["cost"] = round(r["cost"], 2)
        return result
