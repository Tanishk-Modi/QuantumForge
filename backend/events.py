import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from redis import Redis
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

REDIS_EVENT_URL = os.getenv(
    "REDIS_EVENT_URL",
    os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
)

_redis_client = Redis.from_url(REDIS_EVENT_URL, decode_responses=True)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def publish_experiment_event(
    db: Session,
    experiment: Any,
    event_type: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "experiment_id": experiment.id,
        "algorithm": experiment.algorithm,
        "status": experiment.status,
        "event_type": event_type,
        "data": data or {},
        "timestamp": _utc_iso(),
    }

    # Durable history for catch-up when clients connect mid-run.
    existing_log = experiment.progress_log or []
    experiment.progress_log = [*existing_log, payload]
    db.commit()
    db.refresh(experiment)

    # Best-effort live fanout to connected WebSocket clients.
    channel = f"experiment:{experiment.id}:events"
    try:
        _redis_client.publish(channel, json.dumps(payload))
    except Exception:
        logger.exception("Redis publish failed for channel %s", channel)

    return payload