// Configuration
const API_URL = '/api';  // Use relative path for API requests

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const modelStatus = document.getElementById('model-status');
const memoryStats = document.getElementById('memory-stats-content');
const modelInfo = document.getElementById('model-info-content');

// State
let isModelReady = false;

// Initialize
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    await checkModelStatus();
    setInterval(updateStats, 5000);
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

async function checkModelStatus() {
    try {
        const response = await fetch(`${API_URL}/models/status`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const status = await response.json();
        
        isModelReady = status.model_loaded;
        updateModelStatus(status);
        
    } catch (error) {
        console.error('Error checking model status:', error);
        modelStatus.textContent = 'Model Status: Error';
        modelStatus.className = 'status-badge error';
        // Retry after 5 seconds
        setTimeout(checkModelStatus, 5000);
    }
}

async function updateStats() {
    try {
        const response = await fetch(`${API_URL}/models/status`);
        const stats = await response.json();
        
        // Update memory stats
        memoryStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">RAM Usage:</span>
                <span>${Math.round(stats.memory_usage.rss)}MB</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Cache Size:</span>
                <span>${Math.round(stats.memory_usage.cache_size)}MB</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Offload Size:</span>
                <span>${Math.round(stats.memory_usage.offload_size)}MB</span>
            </div>
        `;
        
        // Update model info
        modelInfo.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Model:</span>
                <span>DeepSeek LLM 7B</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Device:</span>
                <span>${stats.device}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Status:</span>
                <span>${isModelReady ? 'Ready' : 'Loading'}</span>
            </div>
        `;
        
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

function updateModelStatus(status) {
    if (status.model_loaded) {
        modelStatus.textContent = 'Model Status: Ready';
        modelStatus.className = 'status-badge online';
    } else {
        modelStatus.textContent = 'Model Status: Loading';
        modelStatus.className = 'status-badge';
    }
}

async function sendMessage() {
    if (!isModelReady) {
        alert('Please wait for the model to be ready');
        return;
    }
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat('user', message);
    userInput.value = '';
    
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            addMessageToChat('bot', data.response);
        } else {
            throw new Error(data.error || 'Failed to get response');
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        addMessageToChat('bot', 'Sorry, there was an error processing your message.');
    }
}

function addMessageToChat(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
