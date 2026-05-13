package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

const (
	defaultQueueKey     = "task_queue"
	defaultResultPrefix = "task_result:"
	defaultWorkerCount  = 3
	defaultHTTPPort     = "8081"
	defaultRedisAddr    = "localhost:6379"
	defaultRedisDB      = 0
	defaultTaskSleep    = 2
	defaultResultTTL    = 24
	defaultTimeout      = 10
)

var (
	ctx    = context.Background()
	rdb    *redis.Client
	once   sync.Once

	redisAddr    = getEnv("REDIS_ADDR", defaultRedisAddr)
	redisPassword = getEnv("REDIS_PASSWORD", "")
	redisDB      = getEnvInt("REDIS_DB", defaultRedisDB)
	httpPort     = getEnv("HTTP_PORT", defaultHTTPPort)
	queueKey     = getEnv("QUEUE_KEY", defaultQueueKey)
	resultPrefix = getEnv("RESULT_PREFIX", defaultResultPrefix)
	workerCount  = getEnvInt("WORKER_COUNT", defaultWorkerCount)
	taskSleep    = getEnvInt("TASK_SLEEP_SECONDS", defaultTaskSleep)
	resultTTL    = getEnvInt("RESULT_TTL_HOURS", defaultResultTTL)
	taskTimeout  = getEnvInt("TASK_TIMEOUT_SECONDS", defaultTimeout)
	enableWorker = getEnvBool("ENABLE_WORKER", true)
	enableAPI    = getEnvBool("ENABLE_API", true)
)

type TaskManager struct {
	redisClient  *redis.Client
	queueKey     string
	resultPrefix string
	taskSleep    int
	taskTimeout  int
	resultTTL    time.Duration
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

type Task struct {
	ID      string          `json:"id"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type TaskResult struct {
	ID       string          `json:"id"`
	Status   string          `json:"status"`
	Result   json.RawMessage `json:"result,omitempty"`
	Error    string          `json:"error,omitempty"`
	CreateAt time.Time       `json:"create_at"`
	UpdateAt time.Time       `json:"update_at"`
}

func initRedis() {
	rdb = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDB,
	})
}

func (tm *TaskManager) pushTask(task *Task) error {
	data, err := json.Marshal(task)
	if err != nil {
		return err
	}
	return tm.redisClient.LPush(ctx, tm.queueKey, data).Err()
}

func (tm *TaskManager) popTask() (*Task, error) {
	result, err := tm.redisClient.BRPop(ctx, 5*time.Second, tm.queueKey).Result()
	if err != nil {
		return nil, err
	}

	var task Task
	if err := json.Unmarshal([]byte(result[1]), &task); err != nil {
		return nil, err
	}
	return &task, nil
}

func (tm *TaskManager) saveResult(result *TaskResult) error {
	data, err := json.Marshal(result)
	if err != nil {
		return err
	}
	key := tm.resultPrefix + result.ID
	return tm.redisClient.Set(ctx, key, data, tm.resultTTL).Err()
}

func (tm *TaskManager) getResult(taskID string) (*TaskResult, error) {
	key := tm.resultPrefix + taskID
	data, err := tm.redisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var result TaskResult
	if err := json.Unmarshal([]byte(data), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (tm *TaskManager) checkAndMarkTimeout(taskID string) bool {
	result, err := tm.getResult(taskID)
	if err != nil {
		return false
	}

	if result.Status != "processing" {
		return false
	}

	elapsed := time.Since(result.UpdateAt)
	if elapsed > time.Duration(tm.taskTimeout)*time.Second {
		result.Status = "failed"
		result.Error = "task timeout"
		result.UpdateAt = time.Now()
		tm.saveResult(result)
		return true
	}
	return false
}

func pushTask(task *Task) error {
	data, err := json.Marshal(task)
	if err != nil {
		return err
	}
	return rdb.LPush(ctx, queueKey, data).Err()
}

func popTask() (*Task, error) {
	result, err := rdb.BRPop(ctx, 5*time.Second, queueKey).Result()
	if err != nil {
		return nil, err
	}

	var task Task
	if err := json.Unmarshal([]byte(result[1]), &task); err != nil {
		return nil, err
	}
	return &task, nil
}

func saveResult(result *TaskResult) error {
	data, err := json.Marshal(result)
	if err != nil {
		return err
	}
	key := resultPrefix + result.ID
	return rdb.Set(ctx, key, data, time.Duration(resultTTL)*time.Hour).Err()
}

func getResult(taskID string) (*TaskResult, error) {
	key := resultPrefix + taskID
	data, err := rdb.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var result TaskResult
	if err := json.Unmarshal([]byte(data), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func processTask(task *Task) *TaskResult {
	result := &TaskResult{
		ID:       task.ID,
		Status:   "success",
		CreateAt: time.Now(),
		UpdateAt: time.Now(),
	}

	switch strings.ToLower(task.Type) {
	case "echo":
		result.Result = task.Payload
	case "uppercase":
		var payload struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(task.Payload, &payload); err != nil {
			result.Status = "failed"
			result.Error = err.Error()
			return result
		}
		result.Result, _ = json.Marshal(map[string]string{
			"original": payload.Text,
			"upper":    strings.ToUpper(payload.Text),
		})
	case "count":
		var payload struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(task.Payload, &payload); err != nil {
			result.Status = "failed"
			result.Error = err.Error()
			return result
		}
		result.Result, _ = json.Marshal(map[string]interface{}{
			"text":      payload.Text,
			"charCount": len(payload.Text),
			"wordCount": len(strings.Fields(payload.Text)),
		})
	default:
		result.Status = "failed"
		result.Error = fmt.Sprintf("unknown task type: %s", task.Type)
	}

	return result
}

func worker(id int) {
	fmt.Printf("Worker %d started\n", id)
	for {
		task, err := popTask()
		if err != nil {
			fmt.Printf("Worker %d error: %v\n", id, err)
			continue
		}

		fmt.Printf("Worker %d processing task: %s\n", id, task.ID)

		initialResult := &TaskResult{
			ID:       task.ID,
			Status:   "processing",
			CreateAt: time.Now(),
			UpdateAt: time.Now(),
		}
		saveResult(initialResult)

		time.Sleep(time.Duration(taskSleep) * time.Second)

		result := processTask(task)
		if err := saveResult(result); err != nil {
			fmt.Printf("Worker %d failed to save result: %v\n", id, err)
			continue
		}

		fmt.Printf("Worker %d completed task: %s, status: %s\n", id, task.ID, result.Status)
	}
}

func createTaskHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Type == "" {
		http.Error(w, "task type is required", http.StatusBadRequest)
		return
	}

	task := &Task{
		ID:      uuid.New().String(),
		Type:    req.Type,
		Payload: req.Payload,
	}

	initialResult := &TaskResult{
		ID:       task.ID,
		Status:   "pending",
		CreateAt: time.Now(),
		UpdateAt: time.Now(),
	}
	if err := saveResult(initialResult); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := pushTask(task); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"task_id":  task.ID,
		"status":   "pending",
		"message":  "task submitted successfully",
		"create_at": time.Now(),
	})
}

func getResultHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	taskID := strings.TrimPrefix(r.URL.Path, "/result/")
	if taskID == "" {
		http.Error(w, "task id is required", http.StatusBadRequest)
		return
	}

	result, err := getResult(taskID)
	if err != nil {
		if err == redis.Nil {
			http.Error(w, "task not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	status := "healthy"
	if err := rdb.Ping(ctx).Err(); err != nil {
		status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": status})
}

func main() {
	fmt.Println("=== Configuration ===")
	fmt.Printf("Redis Address: %s\n", redisAddr)
	fmt.Printf("Redis DB: %d\n", redisDB)
	fmt.Printf("HTTP Port: %s\n", httpPort)
	fmt.Printf("Queue Key: %s\n", queueKey)
	fmt.Printf("Worker Count: %d\n", workerCount)
	fmt.Printf("Task Sleep: %d seconds\n", taskSleep)
	fmt.Printf("Result TTL: %d hours\n", resultTTL)
	fmt.Printf("Enable Worker: %v\n", enableWorker)
	fmt.Printf("Enable API: %v\n", enableAPI)
	fmt.Println("=====================")

	initRedis()

	if err := rdb.Ping(ctx).Err(); err != nil {
		panic(fmt.Errorf("failed to connect to redis: %v", err))
	}
	fmt.Println("Connected to Redis successfully")

	if enableWorker {
		for i := 1; i <= workerCount; i++ {
			go worker(i)
		}
	}

	if enableAPI {
		http.HandleFunc("/task", createTaskHandler)
		http.HandleFunc("/result/", getResultHandler)
		http.HandleFunc("/health", healthHandler)

		fmt.Printf("HTTP Server starting on :%s\n", httpPort)
		fmt.Println("API Endpoints:")
		fmt.Println("  POST /task    - Submit a new task")
		fmt.Println("  GET /result/{task_id} - Get task result")
		fmt.Println("  GET /health   - Health check")
		if err := http.ListenAndServe(":"+httpPort, nil); err != nil {
			panic(err)
		}
	} else {
		fmt.Println("Running in worker-only mode")
		select {}
	}
}
