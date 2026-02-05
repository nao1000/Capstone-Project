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
    if (bottom - top < 25) return;

    // We no longer block the user if checkboxes are empty
    const checked = document.querySelectorAll('.role-checkbox:checked');
    const roleIds = Array.from(checked).map(cb => cb.value);
    
    // Fallback if no roles are selected
    const roleNames = roleIds.length > 0 
        ? Array.from(checked).map(cb => cb.dataset.name).join(', ') 
        : "General Availability";
    
    const blockColor = roleIds.length > 0 
        ? checked[0].dataset.color 
        : "#6c757d"; // Gray for general availability

    renderBlockOnGrid({
        dayIndex: startDayIndex,
        top: top,
        height: bottom - top,
        roleIds: roleIds,
        roleNames: roleNames,
        building: document.getElementById('prefBuilding').value || "Any",
        color: blockColor
    });
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

// ... saveAllPreferences() and getCookie() functions go here ...

/**
 * Collects all blocks and POSTs them to Django
 */
async function saveAllPreferences() {
    const blocks = document.querySelectorAll('.pref-block');
    const preferences = [];

    blocks.forEach(block => {
        // 1. Calculate Start/End Time based on pixels
        const topPx = parseInt(block.style.top);
        const heightPx = parseInt(block.style.height);
        
        // Convert pixels back to total minutes from midnight
        const startTotalMinutes = (topPx / 25) * 15 + (window.START_HOUR * 60);
        const endTotalMinutes = startTotalMinutes + (heightPx / 25) * 15;

        const formatTime = (mins) => {
            const h = Math.floor(mins / 60).toString().padStart(2, '0');
            const m = (mins % 60).toString().padStart(2, '0');
            return `${h}:${m}`;
        };

        // 2. Determine Day based on left percentage
        const dayIndex = Math.round(parseFloat(block.style.left) / (100 / 7));

        preferences.push({
            day: DAYS[dayIndex],
            start_time: formatTime(startTotalMinutes),
            end_time: formatTime(endTotalMinutes),
            role_ids: JSON.parse(block.dataset.roleIds), // Multiple roles!
            building: block.dataset.building
        });
    });

    // 3. Send to Django
    const response = await fetch(`/api/team/${window.TEAM_ID}/save-availability/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') // Ensure this helper exists
        },
        body: JSON.stringify({ preferences: preferences })
    });

    if (response.ok) {
        alert("Availability saved successfully!");
    } else {
        alert("Failed to save. Check console for errors.");
    }
}

// Helper to get CSRF Token
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