function initAvailabilityGrid(teamId) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKeys = ['sun', 'mon', 'tues', 'wed', 'thur', 'fri', 'sat'];
    const startHour = 8;
    const endHour = 22;
    const stepMinutes = 15;

    const gridEl = document.getElementById('grid');
    const cells = [];

    // --- 1. Build the Grid ---
    function div(className, text) {
        const el = document.createElement('div');
        el.className = className;
        el.textContent = text;
        return el;
    }

    gridEl.innerHTML = ''; // Clear any existing content
    gridEl.appendChild(div('header', '')); // Top-left empty corner
    days.forEach(d => gridEl.appendChild(div('header', d)));

    for (let t = startHour * 60; t < endHour * 60; t += stepMinutes) {
        const label = t % 60 === 0 ? `${Math.floor(t / 60)}:00` : '';
        gridEl.appendChild(div('time', label));

        for (let day = 0; day < 7; day++) {
            const cell = div('cell', '');
            cell.dataset.day = String(day);
            cell.dataset.minutes = t;
            gridEl.appendChild(cell);
            cells.push(cell);
        }
    }

    // --- 2. Drag & Selection Logic ---
    let isMouseDown = false;
    let dragMode = null;

    gridEl.addEventListener('mousedown', e => {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        isMouseDown = true;
        dragMode = cell.classList.contains('selected') ? 'deselect' : 'select';
        cell.classList.toggle('selected', dragMode === 'select');
        e.preventDefault();
    });

    gridEl.addEventListener('mouseover', e => {
        if (!isMouseDown) return;
        const cell = e.target.closest('.cell');
        if (cell) cell.classList.toggle('selected', dragMode === 'select');
    });

    window.addEventListener('mouseup', () => isMouseDown = false);
    // --- 3. Export & Save Logic ---
    const exportButton = document.getElementById('exportBtn');
    console.log("hello1")
    if (exportButton) {
        console.log("hello2")
        exportButton.onclick = function() {
        console.log("Exporting data for team:", teamId);
        const unavailable = {}; 
        dayKeys.forEach(key => unavailable[key] = []);

        // Group selected cell minutes by day
        const dayMap = {};
        cells.forEach(cell => {
            if (cell.classList.contains('selected')) {
                const dIdx = cell.dataset.day;
                const dayName = dayKeys[parseInt(dIdx)];
                if (!dayMap[dayName]) dayMap[dayName] = [];
                dayMap[dayName].push(parseInt(cell.dataset.minutes));
            }
        });

        // Convert individual 15-min blocks into [start, end] ranges
        for (const day in dayMap) {
            const times = dayMap[day].sort((a, b) => a - b);
            if (times.length === 0) continue;

            let start = times[0];
            for (let i = 0; i < times.length; i++) {
                // If next block isn't consecutive, or it's the end of the array
                if (times[i + 1] !== times[i] + stepMinutes) {
                    unavailable[day].push([
                        minutesToTimeStr(start), 
                        minutesToTimeStr(times[i] + stepMinutes)
                    ]);
                    start = times[i + 1];
                }
            }
        }

        const finalObj = {
            unavailable: unavailable,
            preferences: []
        };

        // Send to Django
        fetch(`/api/team/${teamId}/availability/`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(finalObj)
        })
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then(data => alert("Availability saved successfully!"))
        .catch(err => {
            console.error(err);
            alert("Error saving: Check browser console.");
        });
    }}}
