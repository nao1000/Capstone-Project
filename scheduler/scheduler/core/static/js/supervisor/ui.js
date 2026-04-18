export function openScheduler() {
    document.getElementById('schedulerModal').classList.add('show');
    document.querySelectorAll('.room-list-item').forEach(item => item.classList.remove('active'));
    document.getElementById('roomSelect').value = '';
    document.getElementById('selectedRoomTitle').textContent = 'Click New Room or Select a Room';
    document.getElementById('schedulerGrid').style.display = 'block';
    document.querySelectorAll('.room-block').forEach(block => block.remove());
}

export function closeScheduler() {
    document.getElementById('schedulerModal').classList.remove('show');
}

export function toggleActionMenu(event, button) {
    event.stopPropagation();
    const parent = button.parentElement;
    document.querySelectorAll('.dropdown').forEach(d => {
        if (d !== parent) d.classList.remove('active');
    });
    parent.classList.toggle('active');
}

export function initUIListeners() {
    // Click outside to close menus
    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
        const profileContainer = document.querySelector('.user-profile-container');
        if (profileContainer) profileContainer.classList.remove('active');
    });

    // Profile toggle
    const profileContainer = document.querySelector('.user-profile-container');
    if (profileContainer) {
        profileContainer.addEventListener('click', event => {
            event.stopPropagation();
            profileContainer.classList.toggle('active');
        });
    }

    // Table search/sort logic
    const tableBody = document.querySelector('.table-card tbody');
    if (!tableBody) return;

    const tableHeaders = document.querySelectorAll('.table-card th');
    let sortDirections = Array.from(tableHeaders).map(() => false);

    tableHeaders.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            const rows = Array.from(tableBody.querySelectorAll('tr'));
            const isDescending = sortDirections[index];
            sortDirections[index] = !isDescending;

            tableHeaders.forEach(th => {
                const icon = th.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-sort';
            });
            const clickedIcon = header.querySelector('i');
            if (clickedIcon) clickedIcon.className = isDescending ? 'fa-solid fa-sort-down' : 'fa-solid fa-sort-up';

            const mappedRows = rows.map(row => {
                const cell = row.querySelectorAll('td')[index];
                let combinedText = '';
                if (cell) {
                    const selects = cell.querySelectorAll('select');
                    if (selects.length > 0) {
                        selects.forEach(select => {
                            if (select.selectedIndex >= 0 && select.value !== '') combinedText += select.options[select.selectedIndex].text + ' ';
                        });
                    } else {
                        combinedText = cell.textContent;
                    }
                }
                return { htmlRow: row, value: combinedText.trim().toLowerCase() };
            });

            mappedRows.sort((a, b) => {
                if (a.value < b.value) return isDescending ? 1 : -1;
                if (a.value > b.value) return isDescending ? -1 : 1;
                return 0;
            });

            const fragment = document.createDocumentFragment();
            mappedRows.forEach(item => fragment.appendChild(item.htmlRow));
            tableBody.appendChild(fragment);
        });
    });

    const searchInput = document.getElementById('memberSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            tableBody.querySelectorAll('tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        });
    }
}