FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend /app/backend
COPY models /app/models
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
