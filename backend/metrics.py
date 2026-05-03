"""Prometheus metrics."""
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

api_requests_total = Counter("api_requests_total", "Total API requests", ["method", "endpoint", "status"])
api_latency_seconds = Histogram("api_latency_seconds", "API latency", ["endpoint"])
llm_calls_total = Counter("llm_calls_total", "LLM calls", ["feature"])
llm_tokens_total = Counter("llm_tokens_total", "LLM tokens", ["feature", "direction"])
ccm_alerts_fired_total = Counter("ccm_alerts_fired_total", "CCM alerts fired", ["severity"])
active_websocket_connections = Gauge("active_websocket_connections", "Active WS connections")
celery_tasks_total = Counter("celery_tasks_total", "Background tasks executed", ["task", "status"])


def latest_metrics() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
