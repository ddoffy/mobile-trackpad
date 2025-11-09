const ws = new WebSocket(`ws://${window.location.host}/ws`);
const status = document.getElementById('status');
const sendText = document.getElementById('sendText');
const historyList = document.getElementById('historyList');
const sendBtn = document.getElementById('sendBtn');

ws.onopen = () => {
    status.textContent = '✓ Connected';
    status.className = 'status connected';
};

ws.onclose = () => {
    status.textContent = '✗ Disconnected';
    status.className = 'status disconnected';
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    status.textContent = '✗ Connection Error';
    status.className = 'status disconnected';
};

ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'clipboard_history') {
            addHistoryItem(data.content, data.timestamp, data.source);
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
};

function addHistoryItem(content, timestamp, source) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const date = new Date(timestamp * 1000);
    const timeStr = date.toLocaleTimeString();
    
    const icon = source === 'Linux' ? '🖥️' : '📱';
    
    const escapedContent = escapeHtml(content);
    
    item.innerHTML = `
        <div class="history-header">
            <span class="history-source">${icon} ${source}</span>
            <span class="history-time">${timeStr}</span>
        </div>
        <div class="history-content">${escapedContent}</div>
        <button class="btn btn-small" data-content="${escapedContent}">📋 Copy</button>
    `;
    
    const copyBtn = item.querySelector('.btn');
    copyBtn.addEventListener('click', function() {
        copyHistoryItem(this);
    });
    
    historyList.insertBefore(item, historyList.firstChild);
    
    while (historyList.children.length > 50) {
        historyList.removeChild(historyList.lastChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sendClipboard() {
    const text = sendText.value;
    if (!text.trim()) {
        showNotification('⚠️ Please enter some text first', 'warning');
        return;
    }
    
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'clipboard',
            content: text
        }));
        showNotification('✅ Broadcasted to all sessions!', 'success');
        sendText.value = '';
    } else {
        showNotification('❌ Not connected to server', 'error');
    }
}

async function copyHistoryItem(button) {
    const content = button.getAttribute('data-content');
    const textarea = document.createElement('textarea');
    textarea.innerHTML = content;
    const plainText = textarea.value;
    
    try {
        await navigator.clipboard.writeText(plainText);
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.style.background = '#4CAF50';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        showNotification('❌ Failed to copy to clipboard', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 
                     type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 
                     'rgba(59, 130, 246, 0.9)'};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 1000;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.transition = 'opacity 0.3s';
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}

sendBtn.addEventListener('click', sendClipboard);

sendText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendClipboard();
    }
});
