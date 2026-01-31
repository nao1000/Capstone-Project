/* Global Helpers */
const pad2 = n => String(n).padStart(2, '0');

function minutesToTimeStr(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${pad2(h)}:${pad2(m)}`;
}

// Django CSRF Helper (needed for the fetch call)
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Filter worker list in the sidebar
function filterWorkers() {
    const input = document.getElementById('workerSearch').value.toLowerCase();
    const items = document.querySelectorAll('.worker-item');
    
    items.forEach(item => {
        const name = item.getAttribute('data-name');
        item.style.display = name.includes(input) ? 'flex' : 'none';
    });
}

// Select a worker and trigger the grid load
function selectWorker(element, workerId) {
    // 1. Visual highlight
    document.querySelectorAll('.worker-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');
    
    // 2. Call the grid loading function from supervisor-logic.js
    // We pass teamId using a global variable or grabbing it from the URL
    const teamId = window.location.pathname.split('/')[2]; // Typical Django URL: /supervisor/5/
    loadWorkerData(workerId, teamId);
}