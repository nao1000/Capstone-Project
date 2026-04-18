import { csrfToken } from './config.js';

export async function addRole() {
    const roleName = document.getElementById('newRoleInput').value.trim();
    if (!roleName) return alert('Please enter a role name.');

    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/create/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ name: roleName })
        });
        const data = await response.json();

        if (response.ok) {
            const rolesList = document.getElementById('roles-list');
            const block = document.createElement('div');
            block.className = 'role-block';
            block.dataset.roleId = data.role_id;
            block.innerHTML = `
                <div class="role-block-header">
                    <span class="role-name">${data.name}</span>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary" style="padding:2px 8px; font-size:11px;" onclick="toggleSections(this)">+ Sections</button>
                        <i class="fa-solid fa-xmark" style="cursor:pointer; color:#999;" onclick="deleteRole(this)"></i>
                    </div>
                </div>
                <div class="role-sections" style="display:none; margin-top:8px;">
                    <div class="sections-list"></div>
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <input type="text" class="new-section-input" placeholder="e.g. 001" style="width:80px; padding:4px 8px; border:1px solid #ccc; border-radius:4px; font-size:12px;">
                        <button class="btn btn-secondary" style="padding:2px 8px; font-size:11px;" onclick="addSection(this)">Add</button>
                    </div>
                </div>`;
            rolesList.appendChild(block);

            const newOption = `<option value="${data.role_id}">${data.name}</option>`;
            document.querySelectorAll('select[data-user-id]').forEach(dropdown => dropdown.insertAdjacentHTML('beforeend', newOption));
            document.getElementById('eventRoleInput')?.insertAdjacentHTML('beforeend', newOption);
            document.getElementById('newRoleInput').value = '';
        } else {
            alert(data.error || 'Failed to add role.');
        }
    } catch (error) {
        console.error(error);
    }
}

export async function deleteRole(icon) {
    const block = icon.closest('.role-block');
    const roleId = block.dataset.roleId;
    if (!confirm('Delete this role? This will unassign all members with this role.')) return;

    try {
        const response = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/delete/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': csrfToken }
        });
        if (response.ok) {
            block.remove();
            document.querySelectorAll(`option[value="${roleId}"]`).forEach(o => o.remove());
        }
    } catch (error) {
        console.error(error);
    }
}

export async function loadSectionsIntoDropdown(roleId, sectionSelect) {
    const res = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/sections/`);
    const data = await res.json();
    sectionSelect.innerHTML = '<option value="">No Section</option>';
    if (data.sections.length === 0) {
        sectionSelect.style.display = 'none';
        return;
    }
    data.sections.forEach(s => sectionSelect.appendChild(new Option(s.name, s.id)));
    sectionSelect.style.display = 'block';
}

export async function addSection(btn) {
    const roleBlock = btn.closest('.role-block');
    const roleId = roleBlock.dataset.roleId;
    const input = roleBlock.querySelector('.new-section-input');
    const name = input.value.trim();
    if (!name) return;

    try {
        const res = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/sections/create/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Failed to add section.');

        const sectionsList = roleBlock.querySelector('.sections-list');
        const tag = document.createElement('span');
        tag.className = 'section-tag';
        tag.dataset.sectionId = data.id;
        tag.innerHTML = `${data.name} <i class="fa-solid fa-xmark" onclick="deleteSection(this)"></i>`;
        sectionsList.appendChild(tag);
        input.value = '';
    } catch (err) {
        console.error(err);
    }
}

export async function deleteSection(icon) {
    const tag = icon.closest('.section-tag');
    const sectionId = tag.dataset.sectionId;
    const roleBlock = tag.closest('.role-block');
    const roleId = roleBlock.dataset.roleId;

    if (!confirm('Delete this section?')) return;
    try {
        const res = await fetch(`/api/team/${window.TEAM_ID}/roles/${roleId}/sections/${sectionId}/delete/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': csrfToken }
        });
        if (res.ok) tag.remove();
    } catch (err) {
        console.error(err);
    }
}

export function toggleSections(btn) {
    const sectionsDiv = btn.closest('.role-block').querySelector('.role-sections');
    const isVisible = sectionsDiv.style.display !== 'none';
    sectionsDiv.style.display = isVisible ? 'none' : 'block';
    btn.textContent = isVisible ? '+ Sections' : '- Sections';
}