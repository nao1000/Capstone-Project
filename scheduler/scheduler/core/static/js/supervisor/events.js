import { csrfToken } from './config.js';
import { formatMin, timeToMin } from './utils.js';
import { loadSectionsIntoDropdown } from './roles.js';

export function populateTimeDropdowns() {
    const startSelect = document.getElementById('eventStartTime');
    const endSelect = document.getElementById('eventEndTime');
    if (!startSelect || !endSelect) return;

    for (let h = 7; h <= 22; h++) {
        for (let m = 0; m < 60; m += 15) {
            const totalMin = h * 60 + m;
            const label = formatMin(totalMin);
            startSelect.appendChild(new Option(label, totalMin));
            endSelect.appendChild(new Option(label, totalMin));
        }
    }
    endSelect.selectedIndex = 1;
}

export async function addFixedEvent() {
    const name = document.getElementById('eventNameInput').value.trim();
    const location = document.getElementById('eventLocationInput').value.trim();
    const roleId = document.getElementById('eventRoleInput').value;
    const section = document.getElementById('eventSectionInput').value || null;
    const startMin = timeToMin(document.getElementById('eventStartTime').value);
    const endMin = timeToMin(document.getElementById('eventEndTime').value);
    const checkedDays = [...document.querySelectorAll('.day-check input:checked')].map(cb => parseInt(cb.value));

    if (!name) return alert('Please enter an event name.');
    if (checkedDays.length === 0) return alert('Please select at least one day.');
    if (endMin <= startMin) return alert('End time must be after start time.');

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayLabel = checkedDays.map(d => dayNames[d]).join(', ');

    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/obstructions/create/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ name, location, role_id: roleId, section, start_min: startMin, end_min: endMin, days: checkedDays })
        });
        const data = await response.json();
        if (response.ok) {
            const tag = document.createElement('span');
            tag.className = 'role-tag';
            tag.dataset.obstructionId = data.obstruction_id;
            tag.innerHTML = `<strong>${name}</strong>&nbsp;<em>${location}</em>&nbsp;${dayLabel} &bull; ${formatMin(startMin)} - ${formatMin(endMin)}<i class="fa-solid fa-xmark" onclick="deleteObstruction(this)"></i>`;
            document.getElementById('fixed-events-list').appendChild(tag);
            document.getElementById('eventNameInput').value = '';
            document.querySelectorAll('.day-check input').forEach(cb => (cb.checked = false));
        }
    } catch (error) {
        console.error(error);
    }
}

export async function deleteObstruction(icon) {
    const tag = icon.closest('.role-tag');
    const obstructionId = tag.dataset.obstructionId;
    if (!confirm('Remove this obstruction?')) return;

    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/obstructions/${obstructionId}/delete/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': csrfToken }
        });
        if (response.ok) tag.remove();
    } catch (error) {
        console.error(error);
    }
}

export async function onEventRoleChange(select) {
    const roleId = select.value;
    const sectionSelect = document.getElementById('eventSectionInput');
    if (!roleId) {
        sectionSelect.style.display = 'none';
        sectionSelect.innerHTML = '<option value="">All sections</option>';
        return;
    }
    await loadSectionsIntoDropdown(roleId, sectionSelect);
    sectionSelect.options[0].textContent = 'All sections';
}