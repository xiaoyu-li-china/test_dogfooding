FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY health_check_server.py .

EXPOSE 8080

VOLUME ["/data"]

ENV CHECK_URLS=""
ENV CHECK_KEYWORDS=""
ENV CHECK_TIMEOUT=10
ENV DINGTALK_WEBHOOK=""
ENV WECHAT_WEBHOOK=""
ENV CHECK_INTERVAL=60

CMD ["python", "health_check_server.py", "--port", "8080", "--interval", "60"]
