FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl nodejs npm \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g corepack \
  && corepack enable

COPY . .

RUN corepack pnpm@10.22.0 install --frozen-lockfile
RUN pip install --no-cache-dir -e backend/api

EXPOSE 8000

CMD ["bash", "-lc", "cd /app/backend/api && moneypulse-init-db && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
