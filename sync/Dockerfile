FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
RUN useradd -m app && mkdir -p /data/garmin-tokens && chown -R app /data
USER app
VOLUME /data
EXPOSE 8000
# Nur im internen Docker-Netz veröffentlichen (kein ports:-Mapping).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
