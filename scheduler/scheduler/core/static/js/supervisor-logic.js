/**
 * supervisor-logic.js
 * Focus: Role Management & Room/Event Accessibility
 */

console.log("Supervisor Logic Loaded. TEAM_ID:", TEAM_ID);

// --- 1. ROLE MANAGEMENT ---

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
                'X-CSRFToken': CSRF_TOKEN 
            },
            body: JSON.stringify({ name: roleName })
        });

        const data = await response.json();

        if (response.ok) {
            const data = await response.json(); // data includes {id: 5, name: "Tutor"}

            // 1. Update the badges
            const container = document.getElementById('roleBadgeContainer');
            const badge = document.createElement('span');
            badge.className = 'badge bg-info text-dark me-1';
            badge.textContent = data.name;
            container.appendChild(badge);

            // 2. Update ALL dropdowns in the table
            const dropdowns = document.querySelectorAll('select.form-select');
            dropdowns.forEach(select => {
                const option = document.createElement('option');
                option.value = data.id;      // The database ID
                option.textContent = data.name; // The role name
                select.appendChild(option);
            });

            roleInput.value = '';
        } else {
            alert("Error: " + (data.error || "Could not create role"));
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

// --- 2. ROOM / EVENT ACCESSIBILITY ---

async function addEvent() {
    const name = document.getElementById('eventName').value;
    const day = document.getElementById('dayOfWeek').value;
    const start = document.getElementById('startTime').value;
    const end = document.getElementById('endTime').value;

    if (!name || !day || !start || !end) {
        alert("Please fill in all room access fields.");
        return;
    }

    try {
        const response = await fetch(`/api/team/${TEAM_ID}/events/add/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify({ name, day, start, end })
        });

        if (response.ok) {
            alert(`Room "${name}" accessibility saved!`);
            document.getElementById('eventName').value = '';
            // If you had a list of rooms, you'd update it here
        } else {
            alert("Failed to save room access.");
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

// --- 3. WORKER SEARCH (The small filter on the table) ---

function filterWorkers() {
    const query = document.getElementById('workerSearch')?.value.toLowerCase();
    if (!query) return;

    const rows = document.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const workerName = row.querySelector('strong')?.textContent.toLowerCase();
        if (workerName) {
            row.style.display = workerName.includes(query) ? '' : 'none';
        }
    });
}