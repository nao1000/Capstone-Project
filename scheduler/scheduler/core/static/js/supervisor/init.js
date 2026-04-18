import { setupRoomGrid, setupDrawListeners } from './grid.js';
import { loadSavedTimes } from './rooms.js';
import { loadSectionsIntoDropdown } from './roles.js';
import { setRoomData } from './config.js';
import { initUIListeners } from './ui.js';
import { populateTimeDropdowns } from './events.js';

// If you need global functions for HTML onClick attributes, you must map them to `window`
import * as Rooms from './rooms.js';
import * as Roles from './roles.js';
import * as UI from './ui.js';
import * as Events from './events.js';
import * as Members from './members.js';

Object.assign(window, {
    ...Rooms, ...Roles, ...UI, ...Events, ...Members
});

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State Parsing
    const roomElements = document.querySelectorAll('.room-info');
    setRoomData(Array.from(roomElements).map(el => ({
        id: el.dataset.id,
        name: el.dataset.name,
        schedule: []
    })));

    // 2. Setup Grids and Listeners
    setupRoomGrid();
    setupDrawListeners();
    initUIListeners();
    populateTimeDropdowns();

    // 3. Dropdowns and Roles Setup
    document.getElementById('roomSelect')?.addEventListener('change', loadSavedTimes);
    
    document.querySelectorAll('.member-role-select').forEach(async select => {
        const roleId = select.value;
        const userId = select.dataset.userId;
        if (!roleId) return;

        const sectionSelect = document.querySelector(`.member-section-select[data-user-id="${userId}"]`);
        if (sectionSelect) {
             await loadSectionsIntoDropdown(roleId, sectionSelect);
             const savedSectionId = sectionSelect.dataset.currentSectionId || select.closest('tr')?.querySelector('.member-section-select')?.dataset.currentSectionId;
             if (savedSectionId) sectionSelect.value = savedSectionId;
        }
    });
});