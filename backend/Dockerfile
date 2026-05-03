# Build context must be the repository root (Easypanel / monorepo default).
# Example: docker build -f backend/Dockerfile .
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

COPY backend/ .
RUN mkdir -p uploaded_evidence

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
