const ws = new WebSocket(`ws://${window.location.host}/ws`);
const status = document.getElementById('status');
const fileList = document.getElementById('fileList');
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
        if (data.type === 'file_uploaded') {
            // Immediately reload file list when new file is uploaded
            loadFileList();
            showNotification('✅ File uploaded successfully!', 'success');
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
};

let lastFileListHash = '';

async function loadFileList() {
    try {
        const response = await fetch('/files', {
            cache: 'no-store' // Prevent browser caching for fresh data
        });
        const files = await response.json();
        
        // Create hash to detect changes
        const currentHash = JSON.stringify(files.map(f => f.id + f.uploaded_at));
        
        // Skip update if nothing changed
        if (currentHash === lastFileListHash && fileList.children.length > 0) {
            return;
        }
        lastFileListHash = currentHash;
        
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            fileList.innerHTML = '<div class="clipboard-info">No files available</div>';
            return;
        }
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
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
            
            fragment.appendChild(item);
        });
        
        fileList.appendChild(fragment);
    } catch (err) {
        console.error('Failed to load file list:', err);
        fileList.innerHTML = '<div class="clipboard-info" style="color: rgba(255,255,255,0.7);">Failed to load files. Retrying...</div>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
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
            // Create progress display
            const progressDiv = document.createElement('div');
            progressDiv.className = 'upload-progress-item';
            progressDiv.innerHTML = `
                <div style="margin-bottom: 8px;">
                    <span style="font-weight: 500;">${escapeHtml(file.name)}</span>
                    <span style="float: right; color: #666;" id="progress-${i}">0%</span>
                </div>
                <div style="background: #e0e0e0; height: 6px; border-radius: 3px; overflow: hidden;">
                    <div id="bar-${i}" style="background: linear-gradient(90deg, #4CAF50, #45a049); height: 100%; width: 0%; transition: width 0.3s;"></div>
                </div>
            `;
            uploadProgress.appendChild(progressDiv);
            
            // Use XMLHttpRequest for progress tracking
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        const progressText = document.getElementById(`progress-${i}`);
                        const progressBar = document.getElementById(`bar-${i}`);
                        if (progressText) {
                            progressText.textContent = `${percent}% (${formatFileSize(e.loaded)} / ${formatFileSize(e.total)})`;
                        }
                        if (progressBar) {
                            progressBar.style.width = percent + '%';
                        }
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            // Notify all clients about new file
                            ws.send(JSON.stringify({
                                type: 'file_notification',
                                file_id: result.id
                            }));
                            const progressText = document.getElementById(`progress-${i}`);
                            if (progressText) {
                                progressText.textContent = '✓ Complete';
                                progressText.style.color = '#4CAF50';
                            }
                            resolve();
                        } catch (e) {
                            reject(new Error('Invalid response'));
                        }
                    } else {
                        reject(new Error('Upload failed'));
                    }
                });
                
                xhr.addEventListener('error', () => reject(new Error('Network error')));
                xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
                
                xhr.open('POST', '/upload');
                xhr.send(formData);
            });
            
        } catch (err) {
            console.error('Upload error:', err);
            showNotification(`❌ Failed to upload ${file.name}`, 'error');
            const progressText = document.getElementById(`progress-${i}`);
            if (progressText) {
                progressText.textContent = '✗ Failed';
                progressText.style.color = '#f44336';
            }
        }
    }
    
    // Clear after 3 seconds
    setTimeout(() => {
        uploadProgress.innerHTML = '';
    }, 3000);
    
    fileInput.value = '';
    loadFileList();
}

function downloadFile(fileId, filename) {
    const link = document.createElement('a');
    link.href = `/download/${fileId}`;
    link.download = filename;
    link.click();
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

uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', uploadFiles);

// Auto-refresh file list every 60 seconds (reduced since we have WebSocket updates)
setInterval(loadFileList, 60000);
