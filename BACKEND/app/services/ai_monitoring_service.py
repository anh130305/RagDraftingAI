"""
services.ai_monitoring_service
-------------------------------
Aggregates RAG AI performance metrics (QoS) for the admin dashboard.
Calculates success rates, average latencies, and feedback correlation.
"""

from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.query_log import QueryLog
from app.models.chat_message import ChatMessage
from app.models.audit_log import AuditLog, AuditAction

def get_ai_monitoring_stats(db: Session, days: int = 7) -> dict[str, Any]:
    """
    Collects and returns aggregated AI performance metrics for a specific period.
    """
    # ── 1. Global KPI Metrics (Based on selected days) ──
    start_date = datetime.utcnow() - timedelta(days=days)
    
    total_queries = db.query(func.count(QueryLog.id)).filter(QueryLog.created_at >= start_date).scalar() or 0
    
    success_count = db.query(func.count(QueryLog.id))\
        .filter(QueryLog.created_at >= start_date)\
        .filter(QueryLog.is_error == False).scalar() or 0
        
    error_count = total_queries - success_count
    
    avg_latency = db.query(func.avg(QueryLog.response_time_ms))\
        .filter(QueryLog.created_at >= start_date)\
        .filter(QueryLog.is_error == False).scalar() or 0
        
    # ── 2. Feedback correlation ──
    feedback_stats = db.query(
        ChatMessage.feedback,
        func.count(ChatMessage.id)
    ).join(QueryLog, QueryLog.message_id == ChatMessage.id)\
     .filter(QueryLog.created_at >= start_date)\
     .group_by(ChatMessage.feedback).all()
     
    feedback_map = {row[0]: row[1] for row in feedback_stats}
    likes = feedback_map.get('like', 0)
    dislikes = feedback_map.get('dislike', 0)
    total_feedback = sum(feedback_map.values())
    
    # ── 3. Mode distribution (QA vs Drafting) ──
    mode_distribution = {}
    try:
        mode_stats = db.query(
            ChatMessage.mode,
            func.count(ChatMessage.id)
        ).filter(ChatMessage.created_at >= start_date)\
         .filter(ChatMessage.mode.is_not(None))\
         .group_by(ChatMessage.mode).all()
        mode_distribution = {str(row[0]): row[1] for row in mode_stats}
    except Exception:
        # Fallback if column doesn't exist yet or other DB issue
        pass

    # ── 4. Top Document Types (from AuditLog) ──
    top_forms = []
    try:
        top_forms_query = db.query(
            AuditLog.detail['form_type'].astext.label('form_type'),
            func.count(AuditLog.id).label('count')
        ).filter(AuditLog.action == AuditAction.draft_document)\
         .filter(AuditLog.created_at >= start_date)\
         .group_by(AuditLog.detail['form_type'].astext)\
         .order_by(func.count(AuditLog.id).desc())\
         .limit(5).all()
        top_forms = [{"name": row[0], "value": row[1]} for row in top_forms_query if row[0]]
    except Exception:
        # Fallback for empty/missing audit logs
        pass
    
    # ── 5. Time Series Data (Daily for last X days) ──
    # We use 'days' for both the trends and summary for consistency
    trend_start = datetime.utcnow().date() - timedelta(days=days)
    
    chart_query = db.query(
        func.date(QueryLog.created_at).label("day"),
        func.count(QueryLog.id).label("total"),
        func.count(case((QueryLog.is_error == True, 1))).label("errors"),
        func.avg(QueryLog.response_time_ms).label("avg_time")
    ).filter(QueryLog.created_at >= trend_start)\
     .group_by(func.date(QueryLog.created_at))\
     .order_by(func.date(QueryLog.created_at)).all()
     
    time_series = []
    for row in chart_query:
        # Convert date to string (e.g., "Apr 12")
        day_str = row.day.strftime("%b %d")
        time_series.append({
            "name": day_str,
            "queries": row.total,
            "errors": row.errors,
            "avgLatency": round(float(row.avg_time or 0), 1)
        })

    # If no data, provide dummy points to prevent empty charts
    if not time_series:
        for i in range(days):
            d = (trend_start + timedelta(days=i)).strftime("%b %d")
            time_series.append({"name": d, "queries": 0, "errors": 0, "avgLatency": 0})

    return {
        "summary": {
            "total_queries": total_queries,
            "success_rate": round((success_count / total_queries * 100), 1) if total_queries > 0 else 100.0,
            "error_rate": round((error_count / total_queries * 100), 1) if total_queries > 0 else 0.0,
            "avg_latency_ms": round(float(avg_latency), 1),
            "user_satisfaction": round((likes / total_feedback * 100), 1) if total_feedback > 0 else 100.0,
            "interaction_stats": {
                "likes": likes,
                "dislikes": dislikes,
                "total_feedback": total_feedback
            },
            "mode_distribution": mode_distribution,
            "top_forms": top_forms
        },
        "trends": time_series,
        "collected_at": datetime.utcnow().isoformat() + "Z"
    }
