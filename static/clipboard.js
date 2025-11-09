const ws = new WebSocket(`ws://${window.location.host}/ws`);
const status = document.getElementById('status');
const sendText = document.getElementById('sendText');
const receiveText = document.getElementById('receiveText');
const sendBtn = document.getElementById('sendBtn');
const copyBtn = document.getElementById('copyBtn');

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
        if (data.type === 'clipboard') {
            receiveText.value = data.content;
            // Show notification
            showNotification('📋 Clipboard received from Linux!');
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
};

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
        showNotification('✅ Sent to Linux clipboard!', 'success');
        sendText.value = '';
    } else {
        showNotification('❌ Not connected to server', 'error');
    }
}

async function copyToClipboard() {
    const text = receiveText.value;
    if (!text.trim()) {
        showNotification('⚠️ No text to copy', 'warning');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(text);
        showNotification('✅ Copied to iPhone clipboard!', 'success');
    } catch (err) {
        // Fallback for older browsers
        receiveText.select();
        document.execCommand('copy');
        showNotification('✅ Copied to clipboard!', 'success');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
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

// Event listeners
sendBtn.addEventListener('click', sendClipboard);
copyBtn.addEventListener('click', copyToClipboard);

// Send on Enter (Ctrl+Enter for newline)
sendText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendClipboard();
    }
});
