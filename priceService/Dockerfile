# Build from the repo root, since the image needs the app's namespaceMap.json:
# docker build -f priceService/Dockerfile .
FROM python:3.12.15-slim-trixie

RUN useradd --system --uid 10001 --no-create-home prices \
    && mkdir -p /srv/prices \
    && chown prices /srv/prices

WORKDIR /app
COPY priceService/price_service ./price_service
COPY renderer/public/data/namespaceMap.json ./namespaceMap.json

ENV PYTHONUNBUFFERED=1 \
    PRICE_OUTPUT_DIR=/srv/prices \
    PRICE_NAMESPACE_MAP=/app/namespaceMap.json

USER prices
CMD ["python", "-m", "price_service"]
