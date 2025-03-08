# Use slim Python image
FROM python:3.10-slim as builder

WORKDIR /app

# Install only essential build dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    git \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Final stage
FROM python:3.10-slim

WORKDIR /app

# Copy only runtime dependencies from builder
COPY --from=builder /usr/local/lib/python3.10/site-packages/ /usr/local/lib/python3.10/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create cache directories with correct permissions
RUN mkdir -p /app/models_cache/transformers \
    /app/models_cache/offload \
    /app/models_cache/huggingface \
    /app/uploads \
    && chmod -R 777 /app/models_cache \
    && chmod -R 777 /app/uploads

# Copy application code
COPY backend/api /app/api
WORKDIR /app/api

# Environment variables for optimization
ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    HF_HUB_DISABLE_EXPERIMENTAL_WARNING=1 \
    HF_HUB_DISABLE_IMPLICIT_TOKEN=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    TRANSFORMERS_OFFLINE=0 \
    TRANSFORMERS_CACHE=/app/models_cache/transformers \
    HF_HOME=/app/models_cache/huggingface \
    HF_HUB_CACHE=/app/models_cache/huggingface \
    HUGGINGFACE_HUB_CACHE=/app/models_cache/huggingface \
    SAFETENSORS_FAST_GPU=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FLASK_APP=app.py \
    FLASK_ENV=development \
    FLASK_DEBUG=1 \
    PYTHONPATH=/app/api \
    OMP_NUM_THREADS=1 \
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:32 \
    HF_HUB_ENABLE_HF_TRANSFER=0 \
    HF_TRANSFER_DISABLE=1 \
    DISABLE_TELEMETRY=1 \
    HF_HUB_DOWNLOAD_TIMEOUT=600 \
    USE_SAFETENSORS=1 \
    REQUESTS_CA_BUNDLE="" \
    SSL_CERT_FILE=""

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the application with explicit logging
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8000", "--debug"]
