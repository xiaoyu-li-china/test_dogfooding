const USERNAME = '用户' + Math.floor(Math.random() * 10000);
const WS_URL = `ws://${window.location.host}`;

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

const TYPING_DEBOUNCE_DELAY = 300;
const TYPING_TIMEOUT_DELAY = 1000;

let ws = null;
let reconnectAttempts = 0;
let currentReconnectDelay = INITIAL_RECONNECT_DELAY;
let reconnectTimeoutId = null;
let isManualDisconnect = false;

let typingDebounceTimer = null;
let typingTimeoutTimer = null;
let isCurrentlyTyping = false;

const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const typingIndicator = document.getElementById('typingIndicator');

function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function updateConnectionStatus(status) {
    statusDot.className = 'status-dot';
    switch (status) {
        case 'connecting':
            statusDot.classList.add('connecting');
            statusText.textContent = '连接中...';
            break;
        case 'connected':
            statusDot.classList.add('connected');
            statusText.textContent = '已连接';
            break;
        case 'disconnected':
            statusDot.classList.add('disconnected');
            statusText.textContent = '已断开';
            break;
        default:
            statusText.textContent = '未连接';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addSystemMessage(text, allowHtml = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    const span = document.createElement('span');
    if (allowHtml) {
        span.innerHTML = text;
    } else {
        span.textContent = text;
    }
    messageDiv.appendChild(span);
    messagesContainer.insertBefore(messageDiv, typingIndicator);
    scrollToBottom();
}

function addMessage(content, isSent, username, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = timestamp ? new Date(timestamp) : new Date();
    const currentTime = formatTime(time);
    
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'message-username';
    usernameDiv.textContent = username;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = currentTime;
    
    messageDiv.appendChild(usernameDiv);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    messagesContainer.insertBefore(messageDiv, typingIndicator);
    scrollToBottom();
}

function showTypingIndicator(username) {
    const usernameSpan = typingIndicator.querySelector('.typing-username');
    usernameSpan.textContent = username;
    typingIndicator.classList.add('show');
    scrollToBottom();
}

function hideTypingIndicator() {
    typingIndicator.classList.remove('show');
}

function scrollToBottom() {
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 0);
}

function clearReconnectTimeout() {
    if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }
}

function resetReconnectState() {
    reconnectAttempts = 0;
    currentReconnectDelay = INITIAL_RECONNECT_DELAY;
    clearReconnectTimeout();
}

function scheduleReconnect() {
    if (isManualDisconnect) {
        addSystemMessage('已手动断开连接，停止自动重连');
        return;
    }

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        addSystemMessage('已达到最大重连次数，请刷新页面重试');
        return;
    }

    reconnectAttempts++;
    const delay = Math.min(currentReconnectDelay, MAX_RECONNECT_DELAY);
    const seconds = Math.ceil(delay / 1000);
    
    addSystemMessage(`第 ${reconnectAttempts} 次重连，${seconds} 秒后尝试...`);
    
    reconnectTimeoutId = setTimeout(() => {
        connect();
        currentReconnectDelay = Math.min(currentReconnectDelay * 2, MAX_RECONNECT_DELAY);
    }, delay);
}

function sendTypingEvent(isTyping) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
    }

    const data = {
        type: 'typing',
        username: USERNAME,
        isTyping: isTyping
    };
    ws.send(JSON.stringify(data));
}

function handleInput() {
    if (typingDebounceTimer) {
        clearTimeout(typingDebounceTimer);
    }

    if (typingTimeoutTimer) {
        clearTimeout(typingTimeoutTimer);
    }

    const hasContent = messageInput.value.trim().length > 0;

    if (hasContent && !isCurrentlyTyping) {
        isCurrentlyTyping = true;
        sendTypingEvent(true);
    }

    typingDebounceTimer = setTimeout(() => {
        if (isCurrentlyTyping) {
            isCurrentlyTyping = false;
            sendTypingEvent(false);
        }
    }, TYPING_DEBOUNCE_DELAY);

    typingTimeoutTimer = setTimeout(() => {
        if (isCurrentlyTyping) {
            isCurrentlyTyping = false;
            sendTypingEvent(false);
        }
    }, TYPING_TIMEOUT_DELAY);
}

function onConnectionSuccess() {
    updateConnectionStatus('connected');
    messageInput.disabled = false;
    sendButton.disabled = false;
    resetReconnectState();
    
    addSystemMessage('✅ 连接成功！');
    
    if (reconnectAttempts > 0) {
        addSystemMessage(`重连成功，总共尝试了 ${reconnectAttempts} 次`);
    }
    
    addSystemMessage(`您的用户名：<strong>${escapeHtml(USERNAME)}</strong>`, true);
    
    messageInput.value = '';
    messageInput.focus();
}

function handleIncomingMessage(data) {
    try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (parsed.type === 'message') {
            addMessage(parsed.content, false, parsed.username, parsed.timestamp);
        } else if (parsed.type === 'typing') {
            if (parsed.isTyping) {
                showTypingIndicator(parsed.username);
            } else {
                hideTypingIndicator();
            }
        }
    } catch (error) {
        console.error('解析消息失败:', error);
        addMessage(data, false, '服务器');
    }
}

function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }

    clearReconnectTimeout();
    updateConnectionStatus('connecting');
    isManualDisconnect = false;

    const urlDisplay = reconnectAttempts > 0 
        ? `正在重连到 ${WS_URL}...` 
        : `正在连接到 ${WS_URL}...`;
    addSystemMessage(urlDisplay);

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = function() {
            onConnectionSuccess();
        };

        ws.onmessage = function(event) {
            handleIncomingMessage(event.data);
        };

        ws.onclose = function(event) {
            updateConnectionStatus('disconnected');
            messageInput.disabled = true;
            sendButton.disabled = true;
            hideTypingIndicator();

            if (isManualDisconnect) {
                addSystemMessage('🔌 已手动断开连接');
                return;
            }

            addSystemMessage('🔌 连接已断开');

            if (event.code === 1000) {
                addSystemMessage('连接正常关闭');
            } else {
                addSystemMessage(`异常断开，错误码：${event.code}`);
            }

            setTimeout(() => {
                scheduleReconnect();
            }, 1000);
        };

        ws.onerror = function(error) {
            console.error('WebSocket 错误:', error);
        };
    } catch (error) {
        console.error('创建 WebSocket 失败:', error);
        addSystemMessage('❌ 无法创建连接');
        updateConnectionStatus('disconnected');
        setTimeout(() => {
            scheduleReconnect();
        }, 1000);
    }
}

function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) {
        return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addSystemMessage('⚠️ 未连接到服务器，消息无法发送');
        return;
    }

    try {
        if (typingDebounceTimer) {
            clearTimeout(typingDebounceTimer);
        }
        if (typingTimeoutTimer) {
            clearTimeout(typingTimeoutTimer);
        }
        if (isCurrentlyTyping) {
            isCurrentlyTyping = false;
            sendTypingEvent(false);
        }

        const data = {
            type: 'message',
            username: USERNAME,
            content: message
        };
        ws.send(JSON.stringify(data));
        addMessage(message, true, USERNAME);
        messageInput.value = '';
        messageInput.focus();
    } catch (error) {
        console.error('发送消息失败:', error);
        addSystemMessage('❌ 发送消息失败');
    }
}

sendButton.addEventListener('click', function(e) {
    e.preventDefault();
    sendMessage();
});

messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', handleInput);

document.addEventListener('DOMContentLoaded', function() {
    connect();
});
