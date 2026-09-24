# AMD ROCm Hardware Integration & Diagnostics

AURA includes dedicated support for AMD Radeon and Instinct GPUs through ROCm runtime and PyTorch HIP execution backends.

## Hardware Discovery & Metrics

The AMD diagnostics module (`backend/amd/diagnostics.py`) inspects:
- Installed AMD GPU models and device count
- Total and available VRAM (MB)
- ROCm / HIP driver versions
- GPU utilization percentage

### Honest Fallback Guarantee
If AURA is executed on a machine without compatible AMD ROCm hardware, it clearly reports:
`"AMD acceleration unavailable in current environment."`
And falls back gracefully to CPU deterministic execution without fabricating fake numbers.

## Setup Instructions for AMD Hardware

1. Install ROCm v6.0+ graphics drivers for your Linux/Windows host.
2. Install PyTorch built with ROCm HIP support:
   ```bash
   pip install torch --index-url https://download.pytorch.org/whl/rocm6.0
   ```
3. Run `rocm-smi` to verify hardware status.
4. Launch AURA backend: `python -m uvicorn backend.main:app --port 8000`.
