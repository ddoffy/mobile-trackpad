const ws = new WebSocket(`ws://${window.location.host}/ws`);
const status = document.getElementById('status');
const sendText = document.getElementById('sendText');
const historyList = document.getElementById('historyList');
const fileList = document.getElementById('fileList');
const sendBtn = document.getElementById('sendBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');

ws.onopen = () => {
    status.textContent = '✓ Connected';
    status.className = 'status connected';
    loadFileList();
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
        } else if (data.type === 'file_uploaded') {
            loadFileList();
            showNotification('✅ File uploaded successfully!', 'success');
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
    
    const icon = source === 'Client' ? '�' : '�️';
    
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
        // Try modern API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(plainText);
        } else {
            // Fallback for non-HTTPS or older browsers
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = plainText;
            tempTextarea.style.position = 'fixed';
            tempTextarea.style.left = '-9999px';
            tempTextarea.style.top = '0';
            document.body.appendChild(tempTextarea);
            tempTextarea.focus();
            tempTextarea.select();
            
            try {
                const successful = document.execCommand('copy');
                if (!successful) {
                    throw new Error('execCommand failed');
                }
            } finally {
                document.body.removeChild(tempTextarea);
            }
        }
        
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

async function loadFileList() {
    try {
        const response = await fetch('/files');
        const files = await response.json();
        
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            fileList.innerHTML = '<div class="clipboard-info">No files available</div>';
            return;
        }
        
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const uploadDate = new Date(file.uploaded_at * 1000);
            const expiresDate = new Date((file.uploaded_at + 3600) * 1000);
            const timeLeft = Math.max(0, Math.floor((expiresDate - Date.now()) / 1000 / 60));
            
            item.innerHTML = `
                <div class="history-header">
                    <span class="history-source">📎 ${escapeHtml(file.filename)}</span>
                    <span class="history-time">${formatFileSize(file.size)} • ${timeLeft}min left</span>
                </div>
                <button class="btn btn-small" onclick="downloadFile('${file.id}', '${escapeHtml(file.filename)}')">⬇️ Download</button>
            `;
            
            fileList.appendChild(item);
        });
    } catch (err) {
        console.error('Failed to load file list:', err);
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function uploadFiles() {
    const files = fileInput.files;
    if (files.length === 0) return;
    
    uploadProgress.innerHTML = '';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            uploadProgress.innerHTML = `Uploading ${escapeHtml(file.name)}...`;
            
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                // Notify all clients about new file
                ws.send(JSON.stringify({
                    type: 'file_notification',
                    file_id: result.id
                }));
            } else {
                throw new Error('Upload failed');
            }
        } catch (err) {
            console.error('Upload error:', err);
            showNotification(`❌ Failed to upload ${file.name}`, 'error');
        }
    }
    
    uploadProgress.innerHTML = '';
    fileInput.value = '';
    loadFileList();
}

function downloadFile(fileId, filename) {
    const link = document.createElement('a');
    link.href = `/download/${fileId}`;
    link.download = filename;
    link.click();
}

sendBtn.addEventListener('click', sendClipboard);

uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', uploadFiles);

sendText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendClipboard();
    }
});
