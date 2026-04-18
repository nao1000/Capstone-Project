import { csrfToken } from './config.js';

export async function updateMemberRole(selectElement) {
    const workerId = selectElement.dataset.memberId;
    const roleId = selectElement.value;
    selectElement.disabled = true;
    selectElement.style.opacity = '0.5';

    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/assign/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ worker_id: workerId, role_id: roleId })
        });
        const data = await response.json();
        if (!response.ok) alert(data.error || 'Failed to update role.');
    } catch (error) {
        console.error('Network Error:', error);
    } finally {
        selectElement.disabled = false;
        selectElement.style.opacity = '1';
    }
}

export async function updateMemberSection(input) {
    const userId = input.dataset.memberId;
    const section = input.value.trim();
    await fetch(`/api/team/${window.TEAM_ID}/roles/assign/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({ worker_id: userId, section })
    });
}

export async function saveAllAssignments() {
    const assignments = [];
    document.querySelectorAll('.member-role-select').forEach(select => {
        const userId = select.dataset.userId;
        const roleId = select.value || null;
        const sectionSelect = document.querySelector(`.member-section-select[data-user-id="${userId}"]`);
        const sectionId = sectionSelect?.value || null;
        assignments.push({ user_id: userId, role_id: roleId, section_id: sectionId });
    });

    try {
        const res = await fetch(`/api/team/${window.TEAM_ID}/members/save-assignments/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ assignments })
        });
        const data = await res.json();
        if (res.ok) alert(`✓ Saved ${data.saved} assignments.`);
        else alert(data.error || 'Failed to save.');
    } catch (err) {
        console.error(err);
    }
}

export async function removeUserFromTeam(userId, username) {
    if (!confirm(`Are you sure you want to remove ${username} from the team?`)) return;
    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/unassign/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ worker_id: parseInt(userId), role_id: 0 })
        });
        const rawText = await response.text();
        let data = {};
        try { data = JSON.parse(rawText); } catch (e) { console.log("Response was not JSON:", rawText); }
        if (response.ok) {
            const row = document.querySelector(`tr[data-user-id="${userId}"]`);
            if (row) {
                row.style.opacity = '0';
                setTimeout(() => row.remove(), 300);
            }
        } else alert(`Error: ${data.error || rawText}`);
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

export async function resetMember(userId, userName) {
    if (!confirm(`Clear all current assignments for ${userName}?`)) return;
    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/members/save-assignments/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ assignments: [{ user_id: userId, role_id: null, section_id: null }] })
        });
        if (response.ok) {
            const row = document.querySelector(`tr[data-user-id="${userId}"]`);
            if (row) {
                const roleSelect = row.querySelector('.member-role-select');
                if (roleSelect) roleSelect.value = "";
                const sectionSelect = row.querySelector('.member-section-select');
                if (sectionSelect) {
                    sectionSelect.value = "";
                    sectionSelect.style.display = 'none';
                }
                row.style.backgroundColor = '#d4edda';
                setTimeout(() => row.style.backgroundColor = '', 800);
            }
        }
    } catch (error) {
        console.error('Reset error:', error);
    }
}