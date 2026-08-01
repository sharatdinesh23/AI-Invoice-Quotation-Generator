FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Copy pyproject.toml (and uv.lock if it exists)
COPY pyproject.toml uv.lock* ./

# Compile pyproject.toml to a temporary requirements.txt and install
# This is the most reliable way to use uv with pyproject.toml in Docker
RUN uv pip compile pyproject.toml -o requirements.txt
RUN uv pip install --system --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]