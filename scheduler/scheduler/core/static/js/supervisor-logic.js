// Constants for the grid
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const keyToIndex = { "sun": 0, "mon": 1, "tues": 2, "wed": 3, "thur": 4, "fri": 5, "sat": 6 };
const indexToKey = ["sun", "mon", "tues", "wed", "thur", "fri", "sat"];
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

function loadWorkerData(workerId, teamId) {
    // Clear grids first
    viewCells.forEach(c => c.classList.remove("unavailable"));
    document.getElementById("saveBtn").disabled = true;

    if (!workerId) return;

    fetch(`/api/team/${teamId}/get-availability/${workerId}/`)
        .then(res => res.json())
        .then(data => {
            if (data.unavailable) {
                for (const [dayKey, ranges] of Object.entries(data.unavailable)) {
                    const dayIndex = keyToIndex[dayKey.toLowerCase()];
                    ranges.forEach(range => {
                        const startMins = timeStrToMinutes(range[0]);
                        const endMins = timeStrToMinutes(range[1]);
                        
                        viewCells.forEach(cell => {
                            const cellDay = parseInt(cell.dataset.day);
                            const cellTime = parseInt(cell.dataset.minutes);
                            if (cellDay === dayIndex && cellTime >= startMins && cellTime < endMins) {
                                cell.classList.add("unavailable");
                            }
                        });
                    });
                }
            }
            document.getElementById("saveBtn").disabled = false;
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
