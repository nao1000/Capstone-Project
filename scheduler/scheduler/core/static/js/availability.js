/* Availability Specific Logic */
function initAvailabilityGrid(teamId) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKeys = ['sun', 'mon', 'tues', 'wed', 'thur', 'fri', 'sat'];
    const startHour = 8;
    const endHour = 22;
    const stepMinutes = 15;

    const gridEl = document.getElementById('grid');
    const outEl = document.getElementById('out');

    // Build the Grid (same as your current code)
    gridEl.appendChild(div('header', ''));
    days.forEach(d => gridEl.appendChild(div('header', d)));

    const cells = [];
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

    function div(className, text) {
        const el = document.createElement('div');
        el.className = className;
        el.textContent = text;
        return el;
    }

    // --- Drag & Selection Logic ---
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

    // --- Export & Fetch Logic ---
    document.getElementById('exportBtn').addEventListener('click', () => {
        // ... (Insert your sorting and range logic here) ...

        const finalObj = {
            name: document.getElementById('userName').value,
            unavailable: unavailable, // generated from your logic
            preferences: []
        };

        fetch(`/api/team/${teamId}/availability/`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') // Added security for Django
            },
            body: JSON.stringify(finalObj)
        })
        .then(res => res.json())
        .then(data => alert("Saved successfully!"))
        .catch(err => console.error(err));
    });
}