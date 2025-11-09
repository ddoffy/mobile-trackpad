const ws = new WebSocket(`ws://${window.location.host}/ws`);
const trackpad = document.getElementById('trackpad');
const status = document.getElementById('status');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

let lastX = null;
let lastY = null;
let sensitivity = 1.5;

// Gesture detection variables
let touchStartTime = 0;
let touchStartFingers = 0;
let hasMoved = false;
let initialTouches = [];
let isDragging = false;
let dragCheckTimeout = null;
let twoFingerStartX = 0;
let twoFingerStartY = 0;
let twoFingerTotalDx = 0;
let twoFingerTotalDy = 0;
const TAP_THRESHOLD = 200; // milliseconds
const LONG_PRESS_THRESHOLD = 300; // milliseconds for drag
const MOVE_THRESHOLD = 10; // pixels
const SWIPE_THRESHOLD = 100; // pixels for horizontal swipe
const SWIPE_ANGLE_THRESHOLD = 0.5; // ratio of dy/dx to determine if mostly horizontal

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

function sendEvent(event) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
    }
}

// Trackpad touch start - detect tap and drag gestures
trackpad.addEventListener('touchstart', (e) => {
    const touches = e.touches;
    touchStartTime = Date.now();
    touchStartFingers = touches.length;
    hasMoved = false;
    
    // Store initial touch positions
    initialTouches = Array.from(touches).map(t => ({
        x: t.clientX,
        y: t.clientY
    }));
    
    if (touches.length === 1) {
        lastX = touches[0].clientX;
        lastY = touches[0].clientY;
        
        // Set timeout for long press (drag)
        dragCheckTimeout = setTimeout(() => {
            if (!hasMoved && !isDragging) {
                isDragging = true;
                sendEvent({ type: 'drag_start' });
                // Visual feedback
                trackpad.style.background = 'rgba(255, 255, 255, 0.2)';
            }
        }, LONG_PRESS_THRESHOLD);
    } else if (touches.length === 2) {
        // Initialize two-finger tracking
        const midX = (touches[0].clientX + touches[1].clientX) / 2;
        const midY = (touches[0].clientY + touches[1].clientY) / 2;
        twoFingerStartX = midX;
        twoFingerStartY = midY;
        twoFingerTotalDx = 0;
        twoFingerTotalDy = 0;
        lastX = midX;
        lastY = midY;
    }
});

// Trackpad touch move - handle cursor movement, scrolling, or drag
trackpad.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (touches.length === 1) {
        const currentX = touches[0].clientX;
        const currentY = touches[0].clientY;
        
        if (lastX !== null && lastY !== null) {
            const dx = (currentX - lastX) * sensitivity;
            const dy = (currentY - lastY) * sensitivity;
            
            // Check if moved beyond threshold
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                hasMoved = true;
                sendEvent({ type: 'move', dx, dy });
            }
        }
        
        lastX = currentX;
        lastY = currentY;
    } else if (touches.length === 2) {
        // Two-finger scroll gesture
        hasMoved = true;
        const midX = (touches[0].clientX + touches[1].clientX) / 2;
        const midY = (touches[0].clientY + touches[1].clientY) / 2;
        
        if (lastX !== null && lastY !== null) {
            const dx = midX - lastX;
            const dy = midY - lastY;
            
            // Track total movement for swipe detection
            twoFingerTotalDx += dx;
            twoFingerTotalDy += dy;
            
            sendEvent({ type: 'scroll', dx: dx * 2, dy: dy * 2 });
        }
        
        lastX = midX;
        lastY = midY;
    }
});

// Trackpad touch end - detect tap, two-finger tap, or swipe gestures
trackpad.addEventListener('touchend', (e) => {
    const touchDuration = Date.now() - touchStartTime;
    const touches = e.touches;
    
    // Clear drag timeout
    if (dragCheckTimeout) {
        clearTimeout(dragCheckTimeout);
        dragCheckTimeout = null;
    }
    
    // Handle drag end
    if (isDragging && touches.length === 0) {
        isDragging = false;
        sendEvent({ type: 'drag_end' });
        trackpad.style.background = 'rgba(255, 255, 255, 0.1)';
    }
    
    // Detect gestures only when all fingers are lifted
    if (touches.length === 0) {
        // Check for two-finger horizontal swipe (back/forward navigation)
        if (touchStartFingers === 2) {
            const absDx = Math.abs(twoFingerTotalDx);
            const absDy = Math.abs(twoFingerTotalDy);
            
            // Swipe detection: significant horizontal movement, minimal vertical
            // macOS-style: swipe right = back, swipe left = forward
            if (absDx > SWIPE_THRESHOLD && absDy / absDx < SWIPE_ANGLE_THRESHOLD) {
                const direction = twoFingerTotalDx > 0 ? 'left' : 'right';
                sendEvent({ type: 'swipe', direction });
            }
            // Two-finger tap for right-click
            else if (!hasMoved && touchDuration < TAP_THRESHOLD) {
                sendEvent({ type: 'click', button: 'right' });
            }
        }
        // One-finger tap for left-click
        else if (touchStartFingers === 1 && !hasMoved && !isDragging && touchDuration < TAP_THRESHOLD) {
            sendEvent({ type: 'click', button: 'left' });
        }
        
        lastX = null;
        lastY = null;
    }
});

// Mouse support for desktop testing
let isMouseDown = false;

trackpad.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

trackpad.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    
    if (lastX !== null && lastY !== null) {
        const dx = (e.clientX - lastX) * sensitivity;
        const dy = (e.clientY - lastY) * sensitivity;
        sendEvent({ type: 'move', dx, dy });
    }
    
    lastX = e.clientX;
    lastY = e.clientY;
});

trackpad.addEventListener('mouseup', () => {
    isMouseDown = false;
    lastX = null;
    lastY = null;
});

// Button clicks
leftBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendEvent({ type: 'click', button: 'left' });
});

rightBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendEvent({ type: 'click', button: 'right' });
});

// Arrow key buttons
const arrowUp = document.getElementById('arrowUp');
const arrowDown = document.getElementById('arrowDown');
const arrowLeft = document.getElementById('arrowLeft');
const arrowRight = document.getElementById('arrowRight');

arrowUp.addEventListener('click', (e) => {
    e.preventDefault();
    sendEvent({ type: 'arrow_key', key: 'up' });
});

arrowDown.addEventListener('click', (e) => {
    e.preventDefault();
    sendEvent({ type: 'arrow_key', key: 'down' });
});

arrowLeft.addEventListener('click', (e) => {
    e.preventDefault();
    sendEvent({ type: 'arrow_key', key: 'left' });
});

arrowRight.addEventListener('click', (e) => {
    e.preventDefault();
    sendEvent({ type: 'arrow_key', key: 'right' });
});

// Prevent default touch behaviors
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });
