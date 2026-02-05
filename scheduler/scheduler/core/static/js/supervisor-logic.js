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
    console.log("addRole triggered. Team ID:", window.TEAM_ID);
    
    const roleInput = document.getElementById('newRoleName');
    const roleName = roleInput.value.trim();
    
    if (!roleName) {
        alert("Please enter a role name.");
        return;
    }

    try {
        // We use window.TEAM_ID because the .js file can't read {{ team.id }} directly
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.CSRF_TOKEN // Seeded from HTML
            },
            body: JSON.stringify({ name: roleName })
        });

        if (response.ok) {
            const data = await response.json();
            
            // 1. Update the Badges
            const container = document.getElementById('roleBadgeContainer');
            if (container) {
                const badge = document.createElement('span');
                badge.className = 'badge bg-info text-dark me-1';
                badge.textContent = data.name;
                container.appendChild(badge);
            }

            // 2. Update the Dropdowns for all workers
            const dropdowns = document.querySelectorAll('select.form-select');
            dropdowns.forEach(select => {
                const opt = document.createElement('option');
                opt.value = data.role_id;
                opt.textContent = data.name;
                select.appendChild(opt);
            });

            roleInput.value = '';
            console.log("Role created successfully:", data.name);
        } else {
            const errorData = await response.json();
            alert("Error: " + (errorData.error || "Failed to create role."));
        }
    } catch (err) {
        console.error("Fetch error:", err);
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




