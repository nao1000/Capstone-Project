// availability-logic.js

let isDrawing = false;
let startY = 0;
let startDayIndex = 0;
const DAYS = ['sun', 'mon', 'tues', 'wed', 'thur', 'fri', 'sat'];

document.addEventListener('DOMContentLoaded', () => {
    initBackgroundGrid();
    setupDrawingListeners();
    loadExistingData(); // NEW: Loads the baked JSON data
});

function initBackgroundGrid() {
    const bg = document.getElementById('gridBackground');
    if (!bg) return;
    bg.innerHTML = '';
    for (let hour = window.START_HOUR; hour < window.END_HOUR; hour++) {
        for (let quarter = 0; quarter < 60; quarter += 15) {
            const label = document.createElement('div');
            label.className = 'time-slot-label';
            label.textContent = quarter === 0 ? `${hour}:00` : '';
            bg.appendChild(label);
            for (let d = 0; d < 7; d++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell-bg';
                cell.dataset.day = d;
                bg.appendChild(cell);
            }
        }
    }
}

function loadExistingData() {
    if (!window.SAVED_AVAILABILITY) return;

    const dayMap = { 'sun': 0, 'mon': 1, 'tues': 2, 'wed': 3, 'thur': 4, 'fri': 5, 'sat': 6 };

    window.SAVED_AVAILABILITY.forEach(avail => {
        const dayIdx = dayMap[avail.day];
        
        // Calculate Y position
        const [sH, sM] = avail.start.split(':').map(Number);
        const [eH, eM] = avail.end.split(':').map(Number);
        
        const topPx = ((sH - window.START_HOUR) * 60 + sM) / 15 * 25;
        const bottomPx = ((eH - window.START_HOUR) * 60 + eM) / 15 * 25;

        renderBlockOnGrid({
            dayIndex: dayIdx,
            top: topPx,
            height: bottomPx - topPx,
            roleIds: avail.roleIds,
            roleNames: avail.roleNames,
            building: avail.building,
            color: avail.color
        });
    });
}

function setupDrawingListeners() {
    const wrapper = document.getElementById('gridWrapper');
    const overlay = document.getElementById('drawingOverlay');

    wrapper.onmousedown = (e) => {
        const cell = e.target.closest('.grid-cell-bg');
        if (!cell) return;
        isDrawing = true;
        const rect = wrapper.getBoundingClientRect();
        startDayIndex = parseInt(cell.dataset.day);
        startY = e.clientY - rect.top;
        overlay.classList.remove('d-none');
    };

    window.onmousemove = (e) => {
        if (!isDrawing) return;
        const rect = wrapper.getBoundingClientRect();
        const currentY = e.clientY - rect.top;
        const top = Math.min(startY, currentY);
        const height = Math.abs(currentY - startY);
        const colWidth = (wrapper.offsetWidth - 60) / 7;
        
        overlay.style.top = top + 'px';
        overlay.style.height = height + 'px';
        overlay.style.left = (60 + (startDayIndex * colWidth)) + 'px';
        overlay.style.width = colWidth + 'px';
    };

    window.onmouseup = (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        document.getElementById('drawingOverlay').classList.add('d-none');
        const rect = wrapper.getBoundingClientRect();
        finalizeDrawing(startY, e.clientY - rect.top);
    };
}

function finalizeDrawing(y1, y2) {
    const top = Math.floor(Math.min(y1, y2) / 25) * 25;
    const bottom = Math.ceil(Math.max(y1, y2) / 25) * 25;
    
    // Minimal block size (15 mins)
    if (bottom - top < 25) return;

    renderBlockOnGrid({
        dayIndex: startDayIndex,
        top: top,
        height: bottom - top,
        building: document.getElementById('prefBuilding').value || "Any",
        color: "#4a90e2" // Single color for all time blocks
    });
}

async function saveAll() {
    const blocks = document.querySelectorAll('.pref-block');
    const checkedRoles = document.querySelectorAll('.role-checkbox:checked');
    
    const payload = {
        ranges: Array.from(blocks).map(block => ({
            day: DAYS[Math.round(parseFloat(block.style.left) / (100/7))],
            start: pixelsToTime(parseInt(block.style.top)),
            end: pixelsToTime(parseInt(block.style.top) + parseInt(block.style.height)),
            building: block.dataset.building
        })),
        role_ids: Array.from(checkedRoles).map(cb => cb.value)
    };
}

function renderBlockOnGrid(data) {
    const layer = document.getElementById('blocks-layer');
    const block = document.createElement('div');
    block.className = 'pref-block';
    
    block.dataset.roleIds = JSON.stringify(data.roleIds);
    block.dataset.building = data.building;
    
    block.style.top = data.top + 'px';
    block.style.height = data.height + 'px';
    block.style.left = (data.dayIndex * (100/7)) + '%';
    block.style.width = (100/7) + '%';
    block.style.backgroundColor = data.color;
    
    block.innerHTML = `
        <button class="delete-btn" onclick="this.parentElement.remove()">×</button>
        <div style="padding: 2px;">
            <div class="fw-bold" style="font-size: 10px;">${data.roleNames}</div>
            <div style="font-size: 9px;">${data.building}</div>
        </div>
    `;
    layer.appendChild(block);
}


/**
 * Collects all blocks and POSTs them to Django
 */
document.getElementById('saveAllBtn').addEventListener('click', saveAllPreferences);

async function saveAllPreferences() {
    const blocks = document.querySelectorAll('.pref-block');
    const checkedRoles = document.querySelectorAll('.role-checkbox:checked');
    
    // 1. Prepare the Data Payload
    const payload = {
        role_ids: Array.from(checkedRoles).map(cb => cb.value),
        ranges: Array.from(blocks).map(block => {
            // Convert pixels back to time
            const topPx = parseInt(block.style.top);
            const heightPx = parseInt(block.style.height);
            
            // Assuming 25px = 15 minutes and grid starts at window.START_HOUR
            const startTotalMins = (topPx / 25) * 15 + (window.START_HOUR * 60);
            const endTotalMins = startTotalMins + (heightPx / 25) * 15;

            const toTimeStr = (totalMins) => {
                const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
                const m = (totalMins % 60).toString().padStart(2, '0');
                return `${h}:${m}`;
            };

            // Get Day Index from left percentage (e.g., "14.28%")
            const leftPercent = parseFloat(block.style.left);
            const dayIdx = Math.round(leftPercent / (100 / 7));
            const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

            return {
                day: DAYS[dayIdx],
                start: toTimeStr(startTotalMins),
                end: toTimeStr(endTotalMins),
                building: block.dataset.building
            };
        })
    };

    // 2. Send to Django
    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/save-availability/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("All preferences saved successfully!");
        } else {
            const errorData = await response.json();
            alert("Error: " + errorData.message);
        }
    } catch (err) {
        console.error("Save failed:", err);
        alert("Server error. Check console.");
    }
}

// Helper to get CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}