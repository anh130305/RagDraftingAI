"""
services.system_stats_service
--------------------------------
Collects real system metrics (GPU/VRAM via pynvml, CPU/RAM via psutil).
Falls back to static placeholder values when NVIDIA drivers are unavailable
(e.g. macOS, AMD GPU, no GPU at all).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

# ── psutil (always available) ─────────────────────────────────────────────────
try:
    import psutil
    _PSUTIL_OK = True
except ImportError:
    _PSUTIL_OK = False

# ── pynvml (NVIDIA only) ──────────────────────────────────────────────────────
try:
    from pynvml import (  # provided by nvidia-ml-py package
        nvmlInit, nvmlDeviceGetCount, nvmlDeviceGetHandleByIndex,
        nvmlDeviceGetMemoryInfo, nvmlDeviceGetUtilizationRates,
        nvmlDeviceGetTemperature, nvmlDeviceGetPowerUsage,
        nvmlDeviceGetEnforcedPowerLimit, nvmlDeviceGetName,
        NVML_TEMPERATURE_GPU,
    )
    nvmlInit()
    _GPU_COUNT = nvmlDeviceGetCount()
    _NVML_OK = _GPU_COUNT > 0
except Exception:
    _NVML_OK = False
    _GPU_COUNT = 0


# ── helpers ───────────────────────────────────────────────────────────────────

def _bytes_to_mb(b: int) -> float:
    return round(b / (1024 ** 2), 1)


def _pct(used: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round(used / total * 100, 1)


# ── GPU stats ─────────────────────────────────────────────────────────────────

def _real_gpu_stats() -> list[dict[str, Any]]:
    """Return per-GPU metrics using nvidia-ml-py (pynvml)."""
    gpus = []
    for i in range(_GPU_COUNT):
        handle = nvmlDeviceGetHandleByIndex(i)
        mem    = nvmlDeviceGetMemoryInfo(handle)
        util   = nvmlDeviceGetUtilizationRates(handle)

        try:
            temp = nvmlDeviceGetTemperature(handle, NVML_TEMPERATURE_GPU)
        except Exception:
            temp = None

        try:
            power_w       = nvmlDeviceGetPowerUsage(handle) / 1000.0  # mW → W
            power_limit_w = nvmlDeviceGetEnforcedPowerLimit(handle) / 1000.0
        except Exception:
            power_w = None
            power_limit_w = None

        name = nvmlDeviceGetName(handle)
        if isinstance(name, bytes):
            name = name.decode()

        gpus.append({
            "index": i,
            "name": name,
            "vram_used_mb": _bytes_to_mb(mem.used),
            "vram_total_mb": _bytes_to_mb(mem.total),
            "vram_free_mb": _bytes_to_mb(mem.free),
            "vram_percent": _pct(mem.used, mem.total),
            "gpu_util_percent": util.gpu,
            "memory_util_percent": util.memory,
            "temperature_c": temp,
            "power_w": round(power_w, 1) if power_w is not None else None,
            "power_limit_w": round(power_limit_w, 1) if power_limit_w is not None else None,
        })
    return gpus


def _mock_gpu_stats() -> list[dict[str, Any]]:
    """
    Static placeholder shown when no NVIDIA driver is available.
    Values are fixed — not animated — to make it clear this is not real data.
    """
    return [
        {
            "index": 0,
            "name": "N/A (NVIDIA GPU not detected)",
            "vram_used_mb": 0.0,
            "vram_total_mb": 0.0,
            "vram_free_mb": 0.0,
            "vram_percent": 0.0,
            "gpu_util_percent": 0.0,
            "memory_util_percent": 0.0,
            "temperature_c": None,
            "power_w": None,
            "power_limit_w": None,
        }
    ]


# ── CPU / RAM stats ───────────────────────────────────────────────────────────

def _real_system_stats() -> dict[str, Any]:
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu_percent": round(cpu, 1),
        "ram_used_mb": _bytes_to_mb(mem.used),
        "ram_total_mb": _bytes_to_mb(mem.total),
        "ram_percent": round(mem.percent, 1),
        "disk_used_gb": round(disk.used / (1024 ** 3), 1),
        "disk_total_gb": round(disk.total / (1024 ** 3), 1),
        "disk_percent": round(disk.percent, 1),
    }


def _mock_system_stats() -> dict[str, Any]:
    """Static placeholder when psutil is unavailable."""
    return {
        "cpu_percent": 0.0,
        "ram_used_mb": 0.0,
        "ram_total_mb": 0.0,
        "ram_percent": 0.0,
        "disk_used_gb": 0.0,
        "disk_total_gb": 0.0,
        "disk_percent": 0.0,
    }


# ── VRAM history ring buffer ──────────────────────────────────────────────────
# Keeps last 20 data-points to drive the chart without a full time-series DB.

_HISTORY_SIZE = 20
_vram_history: list[dict[str, Any]] = []


def _append_history(gpu_stats: list[dict[str, Any]]) -> None:
    """Add current avg VRAM% to rolling history."""
    if not gpu_stats:
        return
    avg_vram = round(sum(g["vram_percent"] for g in gpu_stats) / len(gpu_stats), 1)
    _vram_history.append({
        "time": datetime.now().strftime("%H:%M"),
        "value": avg_vram,
    })
    if len(_vram_history) > _HISTORY_SIZE:
        _vram_history.pop(0)


# ── Public API ────────────────────────────────────────────────────────────────

def get_system_stats() -> dict[str, Any]:
    """
    Collect and return a unified stats payload.

    Fields
    ------
    is_mock        – True when no NVIDIA driver found (fallback mode)
    gpu_count      – number of GPUs detected (0 on non-NVIDIA)
    gpus           – per-GPU detail list
    system         – CPU / RAM / disk
    vram_history   – last N VRAM % readings for the chart
    collected_at   – ISO timestamp
    """
    if _NVML_OK:
        gpus = _real_gpu_stats()
        is_mock = False
        # Only record history when we have real GPU data
        _append_history(gpus)
    else:
        gpus = _mock_gpu_stats()
        is_mock = True
        # Do NOT append to history — keep the chart static/empty for mock mode

    if _PSUTIL_OK:
        system = _real_system_stats()
    else:
        system = _mock_system_stats()

    return {
        "is_mock": is_mock,
        "gpu_count": len(gpus) if not is_mock else 0,
        "gpus": gpus,
        "system": system,
        "vram_history": list(_vram_history),
        "collected_at": datetime.utcnow().isoformat() + "Z",
    }
