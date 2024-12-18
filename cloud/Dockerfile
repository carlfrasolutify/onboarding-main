# Brug en Python-baseret baseimage
FROM python:3.10-slim

# Installer systempakker, inklusiv Chromium og nødvendige afhængigheder
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libgconf-2-4 \
    libfontconfig1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxi6 \
    libxrandr2 \
    libasound2 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgtk-3-0 \
    libgbm1 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Sæt miljøvariabler til Selenium og Chrome
ENV PATH="/usr/lib/chromium:$PATH"
ENV CHROME_BIN="/usr/bin/chromium-browser"

# Installer Python-afhængigheder
COPY requirements.txt /app/requirements.txt
WORKDIR /app
RUN pip install --no-cache-dir -r requirements.txt

# Verificer installationen af pakker
RUN pip list
RUN pip show webdriver-manager

# Installer gunicorn til produktion
RUN pip install gunicorn

# Kopiér applikationskode
COPY . /app

# Eksponer porten Flask skal lytte på
EXPOSE 8080

# Start Flask-applikationen med gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:8080", "cloud.main:app"]
