FROM python:3.11-slim

WORKDIR /app

COPY requirements-action.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY dep_updater.py .

ENTRYPOINT ["python", "/app/dep_updater.py"]
CMD []
