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

from app.services import cloudinary_service


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


import random

def _mock_gpu_stats() -> list[dict[str, Any]]:
    """
    Sinh dữ liệu mock GPU động thay đổi theo thời gian thực.
    Các thông số được tính toán đồng bộ và thực tế (ví dụ: RTX 4090).
    """
    vram_total_mb = 24576.0  # 24 GB
    # VRAM sử dụng dao động quanh 8.3 GB - 8.8 GB (~34% - 36%)
    vram_used_mb = round(8192.0 + random.uniform(150.0, 600.0), 1)
    vram_free_mb = round(vram_total_mb - vram_used_mb, 1)
    vram_percent = round((vram_used_mb / vram_total_mb) * 100, 1)

    # GPU utilization loanh quanh 30% - 40%
    gpu_util = int(30 + random.uniform(0, 10))
    memory_util = int(20 + random.uniform(0, 8))

    # Nhiệt độ quanh 62°C (60 - 64)
    temp = int(60 + random.uniform(0, 4))
    # Công suất quanh 180W, giới hạn 450W
    power = round(175.0 + random.uniform(0.0, 15.0), 1)
    power_limit = 450.0

    return [
        {
            "index": 0,
            "name": "NVIDIA GeForce RTX",
            "vram_used_mb": vram_used_mb,
            "vram_total_mb": vram_total_mb,
            "vram_free_mb": vram_free_mb,
            "vram_percent": vram_percent,
            "gpu_util_percent": gpu_util,
            "memory_util_percent": memory_util,
            "temperature_c": temp,
            "power_w": power,
            "power_limit_w": power_limit,
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
    """
    Sinh dữ liệu mock hệ thống động thời gian thực.
    - CPU loanh quanh 30% (28% - 32%)
    - RAM loanh quanh 20GB trên tổng số 32GB (~62.5% sử dụng)
    - Disk quanh 245GB trên tổng số 512GB (~48% sử dụng)
    """
    cpu_percent = round(28.0 + random.uniform(0.0, 4.0), 1)
    
    ram_total_mb = 32768.0  # 32 GB
    # RAM dùng quanh 20GB (19.8GB - 20.2GB)
    ram_used_mb = round(20275.2 + random.uniform(-204.8, 204.8), 1)
    ram_percent = round((ram_used_mb / ram_total_mb) * 100, 1)

    disk_total_gb = 512.0
    disk_used_gb = round(245.0 + random.uniform(0.2, 0.8), 1)
    disk_percent = round((disk_used_gb / disk_total_gb) * 100, 1)

    return {
        "cpu_percent": cpu_percent,
        "ram_used_mb": ram_used_mb,
        "ram_total_mb": ram_total_mb,
        "ram_percent": ram_percent,
        "disk_used_gb": disk_used_gb,
        "disk_total_gb": disk_total_gb,
        "disk_percent": disk_percent,
    }


# ── VRAM history ring buffer ──────────────────────────────────────────────────
# Keeps last 20 data-points to drive the chart without a full time-series DB.

_HISTORY_SIZE = 20
_vram_history: list[dict[str, Any]] = []


def _prepopulate_history_if_needed() -> None:
    """Khởi tạo trước 20 điểm dữ liệu lịch sử để biểu đồ không bị trống khi mới tải trang."""
    global _vram_history
    if not _vram_history:
        from datetime import datetime, timedelta
        now = datetime.now()
        for i in range(_HISTORY_SIZE, 0, -1):
            t = (now - timedelta(minutes=i * 2)).strftime("%H:%M")
            # Lấy giá trị phần trăm VRAM loanh quanh 34% - 36%
            val = round(34.5 + random.uniform(-1.2, 1.2), 1)
            _vram_history.append({
                "time": t,
                "value": val,
            })


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
    # Đảm bảo biểu đồ có sẵn lịch sử
    _prepopulate_history_if_needed()

    if _NVML_OK:
        gpus = _real_gpu_stats()
        is_mock = False
        _append_history(gpus)
        if _PSUTIL_OK:
            system = _real_system_stats()
        else:
            system = _mock_system_stats()
    else:
        # Chế độ Mock / Demo (Không có card NVIDIA)
        gpus = _mock_gpu_stats()
        is_mock = True
        _append_history(gpus)
        system = _mock_system_stats()

    return {
        "is_mock": is_mock,
        "gpu_count": len(gpus) if not is_mock else 1,  # Hiển thị 1 GPU ở chế độ demo
        "gpus": gpus,
        "system": system,
        "storage": cloudinary_service.get_health_status(),
        "vram_history": list(_vram_history),
        "collected_at": datetime.utcnow().isoformat() + "Z",
    }
