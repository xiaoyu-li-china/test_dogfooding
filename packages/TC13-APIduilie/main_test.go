package main

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testCtx = context.Background()

func setupTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	s, err := miniredis.Run()
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{
		Addr: s.Addr(),
	})

	return s, client
}

func createTestTaskManager(client *redis.Client) *TaskManager {
	return &TaskManager{
		redisClient:  client,
		queueKey:     "test_queue",
		resultPrefix: "test_result:",
		taskSleep:    1,
		taskTimeout:  2,
		resultTTL:    24 * time.Hour,
	}
}

func TestPushTask(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	task := &Task{
		ID:      uuid.New().String(),
		Type:    "echo",
		Payload: json.RawMessage(`{"message": "hello"}`),
	}

	err := tm.pushTask(task)
	require.NoError(t, err)

	queueLen, err := client.LLen(testCtx, tm.queueKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), queueLen)
}

func TestPopTask(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	task := &Task{
		ID:      uuid.New().String(),
		Type:    "uppercase",
		Payload: json.RawMessage(`{"text":"hello"}`),
	}

	err := tm.pushTask(task)
	require.NoError(t, err)

	poppedTask, err := tm.popTask()
	require.NoError(t, err)
	assert.Equal(t, task.ID, poppedTask.ID)
	assert.Equal(t, task.Type, poppedTask.Type)
	assert.Equal(t, task.Payload, poppedTask.Payload)
}

func TestSaveAndGetResult(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	taskID := uuid.New().String()
	result := &TaskResult{
		ID:       taskID,
		Status:   "success",
		Result:   json.RawMessage(`{"message":"done"}`),
		CreateAt: time.Now(),
		UpdateAt: time.Now(),
	}

	err := tm.saveResult(result)
	require.NoError(t, err)

	retrievedResult, err := tm.getResult(taskID)
	require.NoError(t, err)
	assert.Equal(t, taskID, retrievedResult.ID)
	assert.Equal(t, "success", retrievedResult.Status)
	assert.Equal(t, json.RawMessage(`{"message":"done"}`), retrievedResult.Result)
}

func TestProcessTask_Echo(t *testing.T) {
	payload := json.RawMessage(`{"data": "test data"}`)
	task := &Task{
		ID:      uuid.New().String(),
		Type:    "echo",
		Payload: payload,
	}

	result := processTask(task)
	assert.Equal(t, "success", result.Status)
	assert.Equal(t, payload, result.Result)
}

func TestProcessTask_Uppercase(t *testing.T) {
	payload := json.RawMessage(`{"text": "hello world"}`)
	task := &Task{
		ID:      uuid.New().String(),
		Type:    "uppercase",
		Payload: payload,
	}

	result := processTask(task)
	assert.Equal(t, "success", result.Status)

	var resultData map[string]string
	err := json.Unmarshal(result.Result, &resultData)
	require.NoError(t, err)
	assert.Equal(t, "hello world", resultData["original"])
	assert.Equal(t, "HELLO WORLD", resultData["upper"])
}

func TestProcessTask_Count(t *testing.T) {
	payload := json.RawMessage(`{"text": "The quick brown fox"}`)
	task := &Task{
		ID:      uuid.New().String(),
		Type:    "count",
		Payload: payload,
	}

	result := processTask(task)
	assert.Equal(t, "success", result.Status)

	var resultData map[string]interface{}
	err := json.Unmarshal(result.Result, &resultData)
	require.NoError(t, err)
	assert.Equal(t, "The quick brown fox", resultData["text"])
	assert.Equal(t, float64(19), resultData["charCount"])
	assert.Equal(t, float64(4), resultData["wordCount"])
}

func TestProcessTask_UnknownType(t *testing.T) {
	payload := json.RawMessage(`{"data": "test"}`)
	task := &Task{
		ID:      uuid.New().String(),
		Type:    "unknown_type",
		Payload: payload,
	}

	result := processTask(task)
	assert.Equal(t, "failed", result.Status)
	assert.Contains(t, result.Error, "unknown task type")
}

func TestCheckAndMarkTimeout(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	taskID := uuid.New().String()
	result := &TaskResult{
		ID:       taskID,
		Status:   "processing",
		CreateAt: time.Now().Add(-5 * time.Second),
		UpdateAt: time.Now().Add(-5 * time.Second),
	}

	err := tm.saveResult(result)
	require.NoError(t, err)

	marked := tm.checkAndMarkTimeout(taskID)
	assert.True(t, marked)

	retrievedResult, err := tm.getResult(taskID)
	require.NoError(t, err)
	assert.Equal(t, "failed", retrievedResult.Status)
	assert.Equal(t, "task timeout", retrievedResult.Error)
}

func TestCheckAndMarkTimeout_NotProcessing(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	taskID := uuid.New().String()
	result := &TaskResult{
		ID:       taskID,
		Status:   "pending",
		CreateAt: time.Now().Add(-5 * time.Second),
		UpdateAt: time.Now().Add(-5 * time.Second),
	}

	err := tm.saveResult(result)
	require.NoError(t, err)

	marked := tm.checkAndMarkTimeout(taskID)
	assert.False(t, marked)

	retrievedResult, err := tm.getResult(taskID)
	require.NoError(t, err)
	assert.Equal(t, "pending", retrievedResult.Status)
}

func TestCheckAndMarkTimeout_NotExpired(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	taskID := uuid.New().String()
	result := &TaskResult{
		ID:       taskID,
		Status:   "processing",
		CreateAt: time.Now(),
		UpdateAt: time.Now(),
	}

	err := tm.saveResult(result)
	require.NoError(t, err)

	marked := tm.checkAndMarkTimeout(taskID)
	assert.False(t, marked)

	retrievedResult, err := tm.getResult(taskID)
	require.NoError(t, err)
	assert.Equal(t, "processing", retrievedResult.Status)
}

func TestTaskLifecycle(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	taskID := uuid.New().String()
	task := &Task{
		ID:      taskID,
		Type:    "uppercase",
		Payload: json.RawMessage(`{"text": "test"}`),
	}

	pendingResult := &TaskResult{
		ID:       taskID,
		Status:   "pending",
		CreateAt: time.Now(),
		UpdateAt: time.Now(),
	}
	err := tm.saveResult(pendingResult)
	require.NoError(t, err)

	err = tm.pushTask(task)
	require.NoError(t, err)

	poppedTask, err := tm.popTask()
	require.NoError(t, err)
	assert.Equal(t, taskID, poppedTask.ID)

	processingResult := &TaskResult{
		ID:       taskID,
		Status:   "processing",
		CreateAt: time.Now(),
		UpdateAt: time.Now(),
	}
	err = tm.saveResult(processingResult)
	require.NoError(t, err)

	result := processTask(task)
	result.ID = taskID
	err = tm.saveResult(result)
	require.NoError(t, err)

	finalResult, err := tm.getResult(taskID)
	require.NoError(t, err)
	assert.Equal(t, "success", finalResult.Status)
}

func TestGetResult_NotFound(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	_, err := tm.getResult("non_existent_task")
	assert.Error(t, err)
}

func TestPopTask_EmptyQueue(t *testing.T) {
	s, client := setupTestRedis(t)
	defer s.Close()
	defer client.Close()

	tm := createTestTaskManager(client)

	_, err := tm.popTask()
	assert.Error(t, err)
}
