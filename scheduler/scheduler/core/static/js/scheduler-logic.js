// Constants for the grid
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const keyToIndex = { "sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6 };
const indexToKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const startHour = 8;
const endHour = 17;
const stepMinutes = 15;

let cells = [];      // Bottom Grid (Assigning)
let viewCells = [];  // Top Grid (Read-only availability)
let isMouseDown = false;
let toggleMode = "add";

// Helper to create elements
function div(container, cls, txt) {
    const el = document.createElement("div");
    el.className = cls;
    el.textContent = txt;
    container.appendChild(el);
}

function initSupervisorGrids(teamId) {
    const gridEl = document.getElementById("grid");
    const viewGridEl = document.getElementById("viewGrid");

    if (!gridEl || !viewGridEl) {
        console.error("Grid elements not found!");
        return;
    }

    // Initialize Top Grid (View Only)
    viewGridEl.innerHTML = "";
    viewCells = [];
    div(viewGridEl, "header", "");
    days.forEach(d => div(viewGridEl, "header", d));

    // Initialize Bottom Grid (Interactive)
    gridEl.innerHTML = "";
    cells = [];
    div(gridEl, "header", "");
    days.forEach(d => div(gridEl, "header", d));

    // Build Rows
    for (let t = startHour * 60; t < endHour * 60; t += stepMinutes) {
        const label = (t % 60 === 0) ? `${Math.floor(t / 60)}:00` : "";
        
        // Top Grid Row
        div(viewGridEl, "time-label", label);
        for (let d = 0; d < 7; d++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.day = d;
            cell.dataset.minutes = t;
            viewGridEl.appendChild(cell);
            viewCells.push(cell);
        }

        // Bottom Grid Row
        div(gridEl, "time-label", label);
        for (let d = 0; d < 7; d++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.day = d;
            cell.dataset.minutes = t;
            cell.addEventListener("mousedown", handleCellClick);
            cell.addEventListener("mouseover", handleCellHover);
            gridEl.appendChild(cell);
            cells.push(cell);
        }
    }

    window.addEventListener("mouseup", () => isMouseDown = false);
}

function handleCellClick(e) {
    if (e.buttons !== 1) return;
    const cell = e.target;
    if (cell.classList.contains("unavailable")) return;
    isMouseDown = true;
    toggleMode = cell.classList.contains("scheduled") ? "remove" : "add";
    applySchedule(cell);
}

function handleCellHover(e) {
    if (isMouseDown) applySchedule(e.target);
}

function applySchedule(cell) {
    if (cell.classList.contains("unavailable")) return;
    if (toggleMode === "add") cell.classList.add("scheduled");
    else cell.classList.remove("scheduled");
}

function renderBlockOnGrid(data) {
  const layer = document.getElementById('blocks-layer');
  const block = document.createElement('div');
  block.className = 'pref-block';

  block.dataset.startTime = data.startTime;
  block.dataset.endTime = data.endTime;
  block.dataset.building = data.building;
  block.dataset.eventName = data.eventName || '';
  block.dataset.roleIds = JSON.stringify(data.roleIds || []);

  block.style.top = data.top + 'px';
  block.style.height = data.height + 'px';
  block.style.left = (data.dayIndex * (100 / 7)) + '%';
  block.style.width = (100 / 7) + '%'; // Ensures the block fills the column width
  block.style.backgroundColor = data.color || '#4a90e2';

  block.innerHTML = `
        <button class="delete-btn" onclick="this.parentElement.remove()">×</button>
        <button class="clone-btn" onclick="duplicateBlock(this.parentElement)" 
                style="position:absolute; right:5px; bottom:2px; background:none; border:none; color:white; font-size:12px; cursor:pointer;">📋</button>
        <div style="padding: 2px; height:100%;" onmousedown="initMove(event, this.parentElement)">
            <div class="fw-bold" style="font-size: 10px;">${data.eventName || 'Event'}</div>
            <div style="font-size: 9px;">${data.building}</div>
            <div class="block-time-label" style="font-size: 8px; color: rgba(255,255,255,0.9);">
                ${formatTimeRange(data.startTime, data.endTime)}
            </div>
        </div>
    `;
  layer.appendChild(block);
}

function loadWorkerData(workdid, teamid) {
    const dayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };

    window.SAVED_AVAILABILITY.forEach(avail => {
        // 1. Map the day string to index
        const dayIdx = dayMap[avail.day.toLowerCase()];
        if (dayIdx === undefined) return;

        // 2. Parse times
        const [sH, sM] = avail.start.split(':').map(Number);
        const [eH, eM] = avail.end.split(':').map(Number);

        const startTotalMins = sH * 60 + sM;
        const endTotalMins = eH * 60 + eM;

        // 3. Convert to Grid Pixels
        // Formula: (Minutes from grid start / 15-min increments) * pixel height
        const gridStartMins = window.START_HOUR * 60;
        const topPx = ((startTotalMins - gridStartMins) / 15) * 25;
        const bottomPx = ((endTotalMins - gridStartMins) / 15) * 25;

        // 4. Render
        renderBlockOnGrid({
            dayIndex: dayIdx,
            top: topPx,
            height: bottomPx - topPx,
            roleIds: avail.roleIds || [],
            roleNames: avail.roleNames || avail.event_name || 'Saved Range',
            building: avail.building || avail.location || '',
            color: avail.color || '#4a90e2',
            startTime: startTotalMins,
            endTime: endTotalMins,
            eventName: avail.event_name || ''
        });
    });
}

function addEvent() {
    const name = document.getElementById('eventName').value;
    const dayKey = document.getElementById('dayOfWeek').value;
    const startTimeRaw = document.getElementById('startTime').value; // e.g. "09:00"
    const endTimeRaw = document.getElementById('endTime').value;     // e.g. "09:50"

    if (!name || !dayKey || !startTimeRaw || !endTimeRaw) {
        alert("Fill in all fields!");
        return;
    }

    // 1. Convert "09:50" into total minutes (590)
    let startMins = timeStrToMinutes(startTimeRaw);
    let endMins = timeStrToMinutes(endTimeRaw);

    // 2. The "Block Out" Logic: Rounding
    // Round start DOWN to nearest 15: (e.g., 9:10 becomes 9:00)
    startMins = Math.floor(startMins / 15) * 15;
    // Round end UP to nearest 15: (e.g., 9:50 becomes 10:00)
    endMins = Math.ceil(endMins / 15) * 15;

    // 3. Find the Day Index (0-6)
    const dayIndex = keyToIndex[dayKey];

    // 4. Update the cells in the "Assign Shifts" grid
    cells.forEach(cell => {
        const cellDay = parseInt(cell.dataset.day);
        const cellTime = parseInt(cell.dataset.minutes);

        if (cellDay === dayIndex && cellTime >= startMins && cellTime < endMins) {
            cell.classList.add("scheduled");
            // Optional: Put the name of the event in the first block
            if (cellTime === startMins) {
                cell.textContent = name;
                cell.style.fontSize = "8px";
                cell.style.overflow = "hidden";
            }
        }
    });

    console.log(`Blocked out ${name} from ${startMins} to ${endMins}`);
}

// Helper functions for time conversion
function timeStrToMinutes(str) { 
    const [h, m] = str.split(":").map(Number); 
    return h * 60 + m; 
}

// supervisor-logic.js

let selectedWorkerId = null;

async function addRole() {
    const roleInput = document.getElementById('newRoleName');
    const roleName = roleInput.value.trim();
    
    if (!roleName) {
        alert("Please enter a role name.");
        return;
    }

    try {
        const response = await fetch(`/api/team/${TEAM_ID}/roles/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') // Ensure this helper exists!
            },
            body: JSON.stringify({ name: roleName })
        });

        const data = await response.json();

        if (response.ok) {
            // 1. Clear the input
            roleInput.value = '';
            
            // 2. Update the UI list (Badge container)
            const container = document.getElementById('roleBadgeContainer');
            if (container) {
                const badge = document.createElement('span');
                badge.className = 'badge bg-info text-dark me-1';
                badge.textContent = data.name;
                container.appendChild(badge);
            }
            
            // 3. Optional: Refresh the page or the dropdowns
            // location.reload(); 
        } else {
            alert("Error: " + (data.error || "Could not create role"));
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

async function selectWorker(element, workerId) {
    // UI highlight
    document.querySelectorAll('.worker-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    
    selectedWorkerId = workerId;
    document.getElementById('saveBtn').disabled = false;

    // 1. Fetch worker availability (The "Read-Only" Grid)
    const response = await fetch(`/api/team/${TEAM_ID}/get-availability/${workerId}/`);
    const data = await response.json();
    
    // 2. Clear and Fill the View-Only Grid
    renderAvailabilityGrid(data.unavailable); 
    
    // 3. Clear the Assignment Grid for fresh drawing
    clearAssignmentGrid();
}

function filterWorkers() {
    const query = document.getElementById('workerSearch').value.toLowerCase();
    const items = document.querySelectorAll('.worker-item');
    
    items.forEach(item => {
        const name = item.getAttribute('data-name');
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

async function addEvent() {
    const name = document.getElementById('eventName').value;
    const day = document.getElementById('dayOfWeek').value;
    const start = document.getElementById('startTime').value;
    const end = document.getElementById('endTime').value;

    if (!name || !day || !start || !end) {
        alert("Please fill in all event fields.");
        return;
    }

    const response = await fetch(`/api/team/${TEAM_ID}/events/add/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ name, day, start, end })
    });

    if (response.ok) {
        alert(`Event "${name}" added successfully!`);
        // Optional: Refresh a list or clear the form
        document.getElementById('eventName').value = '';
    } else {
        alert("Failed to add event.");
    }
}

// Helper to get CSRF token
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

// Constants for the grid
const DAYS = ['sun', 'mon', 'tues', 'wed', 'thur', 'fri', 'sat'];
const HOURS = 24;

/**
 * Fetches and displays a worker's availability on the viewGrid
 */
async function selectWorker(element, workerId) {
    // UI selection style
    document.querySelectorAll('.worker-item').forEach(i => i.classList.remove('active'));
    element.classList.add('active');
    
    window.selectedWorkerId = workerId;
    document.getElementById('saveBtn').disabled = false;

    // Fetch data from the API route we created earlier
    const resp = await fetch(`/api/team/${window.TEAM_ID}/get-availability/${workerId}/`);
    const data = await resp.json();

    // Reset the read-only grid
    document.querySelectorAll('#viewGrid .grid-cell').forEach(c => {
        c.classList.remove('unavailable');
        c.style.backgroundColor = '';
    });

    // Mark unavailable blocks
    if (data.unavailable) {
        for (const [day, ranges] of Object.entries(data.unavailable)) {
            ranges.forEach(range => {
                highlightRange('viewGrid', day, range[0], range[1], 'unavailable');
            });
        }
    }
}

/**
 * Helper to highlight a span of time in the grid
 */
function highlightRange(containerId, day, start, end, className) {
    const cells = document.querySelectorAll(`#${containerId} .grid-cell[data-day="${day.toLowerCase()}"]`);
    const startHour = parseInt(start.split(':')[0]);
    const endHour = parseInt(end.split(':')[0]);

    cells.forEach(cell => {
        const cellHour = parseInt(cell.dataset.time.split(':')[0]);
        if (cellHour >= startHour && cellHour < endHour) {
            cell.classList.add(className);
            if (className === 'unavailable') cell.style.backgroundColor = '#ffcccc';
        }
    });
}