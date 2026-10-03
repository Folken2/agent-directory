# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv first
RUN pip install --no-cache-dir uv

# Copy dependency files for better layer caching
COPY agents/pyproject.toml agents/uv.lock ./

# Install the exact versions recorded in agents/uv.lock (fails if it is out of date)
RUN uv sync --frozen --no-dev

# Copy the rest of the application
COPY . .

# Expose the port that the app runs on
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"
ENV PORT=8000
ENV AGENTS_DIR=agents

# Run the application
CMD [".venv/bin/python", "run_adk.py"]
