FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

ARG VITE_API_BASE_URL=http://127.0.0.1:8000
ENV VITE_APP_ENV=production
ENV VITE_DEFAULT_CURRENCY=EUR
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN corepack pnpm@10.22.0 install --frozen-lockfile
RUN corepack pnpm@10.22.0 --filter @moneypulse/web build

EXPOSE 4173

CMD ["corepack", "pnpm@10.22.0", "--filter", "@moneypulse/web", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
