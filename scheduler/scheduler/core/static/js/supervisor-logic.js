/**
 * supervisor-logic.js
 * Focus: Role Management & Room/Event Accessibility
 */

// console.log("Supervisor Logic Loaded. TEAM_ID:", TEAM_ID);

// --- 1. ROLE MANAGEMENT ---

const TEAM_ID = "{{ team.id }}";
const CSRF_TOKEN = "{{ csrf_token }}";

// 2. Add Role Function (Now internal to the HTML)
async function addRole() {
    const roleName = document.getElementById('newRoleName').value.trim();
    const capInput = document.getElementById('roleCap').value.trim();
    if (!roleName) {
        alert("Please enter a role name.");
        return;
    }
    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ name: roleName, cap: capInput, current: 0 })
        });

        const data = await response.json();
        if (data.ok) {
            alert(`Role "${roleName}" created!`);
            // add a new role without refreshing the page and make it look like what it looks like in supervisor.html
            // make it so it doesn't have to refresh the page to update the dropdowns for assigning roles to workers
            const roleList = document.getElementById('roleList');
            const newBadge = document.createElement('span');
            newBadge.className = 'badge bg-secondary me-2';
            newBadge.id = `role-badge-${data.role_id}`;
            newBadge.innerHTML = `
                ${data.name} 
                <button class="btn btn-sm btn-danger ms-1" onclick="deleteRole(${data.role_id})">&times;</button>
            `;
            roleList.appendChild(newBadge);
        } else {
            alert("Error: " + data.error);
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

async function deleteRole(roleId) {
    if (!confirm("Are you sure you want to delete this role? This may affect assigned workers.")) return;

    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/delete/`, {
            method: 'DELETE', // Using DELETE method is cleaner for removals
            headers: {
                'X-CSRFToken': window.CSRF_TOKEN
            }
        });

        if (response.ok) {
            // Remove the badge from the UI
            const badge = document.getElementById(`role-badge-${roleId}`);
            if (badge) badge.remove();
            
            // Optional: Refresh page to update worker dropdowns
            // location.reload();
        } else {
            alert("Failed to delete role.");
        }
    } catch (err) {
        console.error("Delete error:", err);
    }
}

async function assignRoleToWorker(workerId, roleId) {
    // If they select "Choose Role...", we might want to clear it or just return
    if (roleId === "") {
        console.log("No role selected");
        return;
    }

    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/assign/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.CSRF_TOKEN
            },
            body: JSON.stringify({ 
                worker_id: workerId, 
                role_id: roleId 
            })
        });

        if (response.ok) {
            console.log(`Role ${roleId} assigned to worker ${workerId}`);
            // Optional: a tiny toast notification instead of a loud alert
            // alert("Role updated!"); 
        } else {
            alert("Failed to assign role.");
        }
    } catch (err) {
        console.error("Assignment error:", err);
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




