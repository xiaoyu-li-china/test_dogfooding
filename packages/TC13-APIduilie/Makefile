.PHONY: help build run test docker-build docker-up docker-down docker-logs clean deploy docker-build-cn docker-up-cn deploy-cn

APP_NAME := taskqueue
DOCKER_COMPOSE := docker compose
DOCKER_COMPOSE_CN := docker compose -f docker-compose.cn.yml
GO := /opt/homebrew/bin/go

help:
	@echo "Available commands:"
	@echo "  make build           - Build the Go application"
	@echo "  make run             - Run the application locally"
	@echo "  make test            - Run tests (if any)"
	@echo "  make docker-build    - Build Docker images (Docker Hub)"
	@echo "  make docker-up       - Start all services with Docker Compose"
	@echo "  make docker-down     - Stop all services"
	@echo "  make docker-logs     - View logs from all services"
	@echo "  make docker-build-cn - Build Docker images (China mirror)"
	@echo "  make docker-up-cn    - Start all services with China mirror"
	@echo "  make clean           - Clean build artifacts"
	@echo "  make deploy          - Deploy the application (build and start)"
	@echo "  make deploy-cn       - Deploy the application with China mirror"

build:
	@echo "Building $(APP_NAME)..."
	$(GO) build -v -o $(APP_NAME) .

run: build
	@echo "Running $(APP_NAME) locally..."
	./$(APP_NAME)

test:
	@echo "Running tests..."
	$(GO) test -v ./...

docker-build:
	@echo "Building Docker images..."
	$(DOCKER_COMPOSE) build

docker-up:
	@echo "Starting all services..."
	$(DOCKER_COMPOSE) up -d

docker-down:
	@echo "Stopping all services..."
	$(DOCKER_COMPOSE) down

docker-logs:
	@echo "Viewing logs from all services..."
	$(DOCKER_COMPOSE) logs -f

docker-restart: docker-down docker-up

docker-build-cn:
	@echo "Building Docker images (China mirror)..."
	$(DOCKER_COMPOSE_CN) build

docker-up-cn:
	@echo "Starting all services (China mirror)..."
	$(DOCKER_COMPOSE_CN) up -d

docker-restart-cn: docker-down docker-up-cn

clean:
	@echo "Cleaning build artifacts..."
	rm -f $(APP_NAME)
	$(DOCKER_COMPOSE) down -v --rmi local

deploy: docker-build docker-up
	@echo "Deployment complete!"
	@echo "API is available at http://localhost:8081"
	@echo "Use 'make docker-logs' to view logs"

deploy-cn: docker-build-cn docker-up-cn
	@echo "Deployment complete (China mirror)!"
	@echo "API is available at http://localhost:8081"
	@echo "Use 'make docker-logs' to view logs"
