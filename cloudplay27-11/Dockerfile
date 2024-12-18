# Brug en officiel Python runtime som parent image
FROM python:3.11-slim-bullseye

# Sæt arbejdsmappen i containeren
WORKDIR /app

# Installer systemafhængigheder inklusive libnss3 og libdrm2
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libdrm2 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Kopier kravfilen til containeren
COPY requirements.txt ./

# Installer Python afhængigheder
RUN pip install --no-cache-dir -r requirements.txt

# Installer Playwright og de nødvendige browser binærer
RUN pip install --no-cache-dir playwright && \
    playwright install --with-deps || { echo 'Playwright installation failed'; exit 1; }

# Kopier resten af applikationen til containeren
COPY . .

# Sæt miljøvariabler
ENV PYTHONUNBUFFERED=1

# Eksponer porten, som applikationen vil køre på
EXPOSE 8080

# Kommando til at køre applikationen med Uvicorn
CMD ["uvicorn", "main:asgi_app", "--host", "0.0.0.0", "--port", "8080"]