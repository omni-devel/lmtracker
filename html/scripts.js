const API_BASE_URL = '';
let currentUser = null;
let currentProject = null;
let allRuns = [];
let selectedRuns = [];
let charts = {};
let metricsRefreshIntervalId = null;

// Global variables for the currently active fullscreen chart
let currentFullscreenChartInstance = null;
let currentFullscreenMetricName = null;

const loginContainer = document.getElementById('login-container');
const mainContainer = document.getElementById('main-container');
const loadingContainer = document.getElementById('loading-container');
const loginForm = document.getElementById('login-form');
const userInfoElement = document.getElementById('user-info');
const projectsList = document.getElementById('projects-list');
const projectsView = document.getElementById('projects-view');
const projectDetails = document.getElementById('project-details');
const projectNameElement = document.getElementById('project-name');
const metricsContainer = document.getElementById('metrics-container');
const runsList = document.getElementById('runs-list');
const runsSearch = document.getElementById('runs-search');

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();
    await checkAuthentication();
    hideLoading();
}

function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    document.getElementById('projects-link').addEventListener('click', showProjects);

    document.getElementById('new-project-btn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('new-project-modal'));
        modal.show();
    });
    document.getElementById('create-project-btn').addEventListener('click', createProject);

    document.getElementById('select-all-runs').addEventListener('click', selectAllRuns);
    document.getElementById('deselect-all-runs').addEventListener('click', deselectAllRuns);
    document.getElementById('apply-runs-selection').addEventListener('click', applyRunsSelection);
    runsSearch.addEventListener('input', filterRuns);

    document.getElementById('runs-dropdown').addEventListener('click', function (e) {
        e.stopPropagation();
    });
}

async function checkAuthentication() {
    const credentials = getCookieCredentials();

    if (!credentials) {
        showLogin();
        return;
    }

    try {
        const response = await fetchWithAuth('/api/check-user', {
            method: 'GET'
        }, credentials.username, credentials.password);

        if (response.ok) {
            currentUser = credentials.username;
            userInfoElement.textContent = `User: ${currentUser}`;
            showMain();
            loadProjects();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showLogin();
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    showLoading();

    try {
        const response = await fetchWithAuth('/api/check-user', {
            method: 'GET'
        }, username, password);

        if (response.ok) {
            setCookieCredentials(username, password);
            currentUser = username;
            userInfoElement.textContent = `User: ${currentUser}`;
            showMain();
            loadProjects();
        } else {
            alert('Incorrect username or password');
            hideLoading();
            showLogin();
        }
    } catch (error) {
        console.error('Authentication error:', error);
        alert('Authentication error');
        hideLoading();
    }
}

function handleLogout() {
    clearCookieCredentials();
    stopMetricsAutoRefresh();
    currentUser = null;
    showLogin();
}

async function loadProjects() {
    showLoading();
    stopMetricsAutoRefresh();

    try {
        const response = await fetchWithAuth('/api/get-projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            renderProjects(data.projects);
        } else {
            alert('Failed to load projects');
        }
    } catch (error) {
        console.error('Projects loading error:', error);
        alert('Projects loading error');
    } finally {
        hideLoading();
    }
}

function renderProjects(projects) {
    projectsList.innerHTML = '';

    if (projects.length === 0) {
        projectsList.innerHTML = '<div class="col-12"><p class="text-center">There are no available projects</p></div>';
        return;
    }

    projects.forEach(project => {
        const date = new Date(project.modified_at * 1000);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        const projectCard = document.createElement('div');
        projectCard.className = 'col-md-4 col-lg-3 mb-4';
        projectCard.innerHTML = `
            <div class="card project-card h-100">
                <div class="card-body">
                    <h5 class="card-title text-orange">${project.name}</h5>
                    <p class="card-text text-muted">Modified: ${formattedDate}</p>
                </div>
            </div>
        `;

        projectCard.querySelector('.project-card').addEventListener('click', () => {
            openProject(project.name);
        });

        projectsList.appendChild(projectCard);
    });
}

async function createProject() {
    const projectName = document.getElementById('project-name-input').value.trim();

    if (!projectName) {
        alert('Enter project name');
        return;
    }

    showLoading();

    try {
        const response = await fetchWithAuth('/api/create-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: projectName })
        });

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('new-project-modal')).hide();
            document.getElementById('project-name-input').value = '';
            loadProjects();
        } else {
            alert('Failed to create project');
        }
    } catch (error) {
        console.error('Project creation error:', error);
        alert('Failed to create project');
    } finally {
        hideLoading();
    }
}

async function openProject(projectName) {
    showLoading();
    currentProject = projectName;
    projectNameElement.textContent = projectName;

    try {
        const response = await fetchWithAuth('/api/get-runs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ project_name: projectName })
        });

        if (response.ok) {
            const data = await response.json();
            allRuns = data.runs || [];
            selectedRuns = [...allRuns];

            renderRunsList();
            showProjectDetails();
            await loadMetrics();
            startMetricsAutoRefresh();
        } else {
            alert('Failed to load runs');
            showProjects();
        }
    } catch (error) {
        console.error('Project opening error:', error);
        alert('Project opening error');
        showProjects();
    } finally {
        hideLoading();
    }
}

function renderRunsList() {
    runsList.innerHTML = '';

    if (allRuns.length === 0) {
        runsList.innerHTML = '<p class="text-center">There are no available runs</p>';
        return;
    }

    allRuns.forEach(run => {
        const isSelected = selectedRuns.some(r => r.name === run.name);
        const date = new Date(run.modified_at * 1000);
        const formattedDate = date.toLocaleDateString();

        const runItem = document.createElement('div');
        runItem.className = 'run-item';
        runItem.innerHTML = `
            <div class="form-check d-flex align-items-center justify-content-between">
                <div>
                    <input class="form-check-input" type="checkbox" value="${run.name}" id="run-${run.name}" ${isSelected ? 'checked' : ''}>
                    <label class="form-check-label" for="run-${run.name}">
                        <span>${run.name}</span>
                        <small class="text-muted ms-2">${formattedDate}</small>
                    </label>
                </div>
                <button class="delete-run-btn" title="Delete run">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        runItem.querySelector('.form-check-input').addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!selectedRuns.some(r => r.name === run.name)) {
                    selectedRuns.push(run);
                }
            } else {
                selectedRuns = selectedRuns.filter(r => r.name !== run.name);
            }
        });

        runItem.querySelector('.delete-run-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRun(run.name);
        });

        runsList.appendChild(runItem);
    });
}

function filterRuns() {
    const searchTerm = runsSearch.value.toLowerCase();
    const runItems = runsList.querySelectorAll('.run-item');

    runItems.forEach(item => {
        const runName = item.querySelector('.form-check-label span').textContent.toLowerCase();
        if (runName.includes(searchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function selectAllRuns() {
    selectedRuns = [...allRuns];
    const checkboxes = runsList.querySelectorAll('.form-check-input');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

function deselectAllRuns() {
    selectedRuns = [];
    const checkboxes = runsList.querySelectorAll('.form-check-input');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

async function applyRunsSelection() {
    showLoading();
    stopMetricsAutoRefresh();
    await loadMetrics();
    startMetricsAutoRefresh();
    hideLoading();

    const dropdownEl = document.getElementById('runsDropdown');
    const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownEl);
    if (dropdownInstance) {
        dropdownInstance.hide();
    }
}

async function loadMetrics() {
    if (selectedRuns.length === 0) {
        stopMetricsAutoRefresh();
        // Destroy and remove all existing chart instances and their elements
        for (const metricName in charts) {
            if (charts[metricName] && charts[metricName].instance) {
                charts[metricName].instance.destroy();
            }
            if (charts[metricName] && charts[metricName].element) {
                charts[metricName].element.remove();
            }
        }
        charts = {};

        // Also ensure fullscreen chart is destroyed and container cleared if modal is open
        if (currentFullscreenChartInstance) {
            currentFullscreenChartInstance.destroy();
            currentFullscreenChartInstance = null;
            currentFullscreenMetricName = null;
            const fsContainer = document.getElementById('fullscreen-chart-container');
            if (fsContainer) fsContainer.innerHTML = '';
            const modalElement = document.getElementById('fullscreen-chart-modal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
        metricsContainer.innerHTML = '<div class="alert alert-warning">Select at least one run to display the metrics.</div>';
        return;
    }

    const metricsData = {};

    for (const run of selectedRuns) {
        try {
            const response = await fetchWithAuth('/api/get-run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_name: currentProject,
                    run_name: run.name
                })
            });

            if (response.ok) {
                const data = await response.json();

                if (data.metrics && data.metrics.length > 0) {
                    data.metrics.forEach((metric, index) => {
                        for (const [key, value] of Object.entries(metric)) {
                            if (!metricsData[key]) {
                                metricsData[key] = {};
                            }

                            if (!metricsData[key][run.name]) {
                                metricsData[key][run.name] = [];
                            }

                            metricsData[key][run.name].push({
                                x: index,
                                y: value
                            });
                        }
                    });
                }
            }
        } catch (error) {
            console.error(`Error loading metrics for ${run.name}:`, error);
        }
    }

    updateMetricsDisplay(metricsData);

    // Also update the fullscreen chart if it's currently open
    if (currentFullscreenMetricName && currentFullscreenChartInstance) {
        const runDataForFullscreen = metricsData[currentFullscreenMetricName];

        if (runDataForFullscreen) {
            const datasets = [];
            for (const [runName, dataPoints] of Object.entries(runDataForFullscreen)) {
                const color = stringToColor(runName);
                datasets.push({
                    label: runName,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: color.replace('50%', '80%').replace('hsl', 'hsla').replace(')', ',0.2)'),
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5
                });
            }
            currentFullscreenChartInstance.data.datasets = datasets;
            currentFullscreenChartInstance.update();
        } else {
            // If data for the fullscreen metric is no longer available, close the modal
            console.warn(`Fullscreen metric '${currentFullscreenMetricName}' no longer has data. Closing modal.`);
            const modalElement = document.getElementById('fullscreen-chart-modal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
    }
}

function updateMetricsDisplay(newMetricsData) {
    let metricsRow = document.getElementById('metrics-row');
    if (!metricsRow) {
        metricsRow = document.createElement('div');
        metricsRow.className = 'row';
        metricsRow.id = 'metrics-row';
        metricsContainer.innerHTML = '';
        metricsContainer.appendChild(metricsRow);
    }

    const existingMetricNames = Object.keys(charts);
    const newMetricNames = Object.keys(newMetricsData);

    for (const metricName of existingMetricNames) {
        if (!newMetricNames.includes(metricName)) {
            if (charts[metricName] && charts[metricName].instance) {
                charts[metricName].instance.destroy();
            }
            if (charts[metricName] && charts[metricName].element) {
                charts[metricName].element.remove();
            }
            delete charts[metricName];
        }
    }

    if (newMetricNames.length === 0) {
        metricsRow.innerHTML = '';
        metricsContainer.innerHTML = '<div class="alert alert-info">There are no available metrics for selected runs</div>';
        charts = {};
        return;
    }

    for (const [metricName, runData] of Object.entries(newMetricsData)) {
        const datasets = [];
        for (const [runName, dataPoints] of Object.entries(runData)) {
            const color = stringToColor(runName);
            datasets.push({
                label: runName,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color.replace('50%', '80%').replace('hsl', 'hsla').replace(')', ',0.2)'),
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 5
            });
        }

        if (charts[metricName]) {
            charts[metricName].instance.data.datasets = datasets;
            charts[metricName].instance.update();
            if (charts[metricName].element) { // Ensure the element is visible in case it was hidden
                charts[metricName].element.style.display = '';
            }
        } else {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4 metric-card';

            const card = document.createElement('div');
            card.className = 'card h-100';

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            const cardTitle = document.createElement('h5');
            cardTitle.className = 'card-title text-orange mb-3';
            cardTitle.textContent = metricName;

            const chartContainer = document.createElement('div');
            chartContainer.className = 'chart-container';

            const canvas = document.createElement('canvas');
            canvas.id = `chart-${metricName}`;

            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'fullscreen-btn';
            fullscreenBtn.innerHTML = '<i class="bi bi-fullscreen"></i>';
            fullscreenBtn.addEventListener('click', () => {
                openFullscreenChart(metricName, newMetricsData[metricName]);
            });

            chartContainer.appendChild(canvas);
            chartContainer.appendChild(fullscreenBtn);

            cardBody.appendChild(cardTitle);
            cardBody.appendChild(chartContainer);

            card.appendChild(cardBody);
            col.appendChild(card);
            
            metricsRow.appendChild(col);

            const chartInstance = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    scales: {
                        x: {
                            type: 'linear',
                            title: {
                                display: true,
                                text: 'Step',
                                color: '#9e9e9e'
                            },
                            grid: {
                                color: '#2d2d2d'
                            },
                            ticks: {
                                color: '#9e9e9e'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: metricName,
                                color: '#9e9e9e'
                            },
                            grid: {
                                color: '#2d2d2d'
                            },
                            ticks: {
                                color: '#9e9e9e'
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: '#1e1e1e',
                            titleColor: '#ff8a00',
                            bodyColor: '#bdbdbd',
                            borderColor: '#2d2d2d',
                            borderWidth: 1
                        },
                        legend: {
                            position: 'top',
                            labels: {
                                color: '#9e9e9e',
                                usePointStyle: true,
                                padding: 20
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
            charts[metricName] = { instance: chartInstance, element: col };
        }
    }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 80%, 50%)`;
}

function openFullscreenChart(metricName, runData) {
    const modalElement = document.getElementById('fullscreen-chart-modal');
    const modal = new bootstrap.Modal(modalElement);
    document.getElementById('fullscreen-chart-title').textContent = metricName;

    // Hide the original small chart card when opening fullscreen
    if (charts[metricName] && charts[metricName].element) {
        charts[metricName].element.style.display = 'none';
    }

    modal.show();

    // Set global variables for the active fullscreen chart
    currentFullscreenMetricName = metricName;

    modalElement.addEventListener('hidden.bs.modal', () => {
        // Destroy the fullscreen chart instance when modal is hidden
        if (currentFullscreenChartInstance) {
            currentFullscreenChartInstance.destroy();
            currentFullscreenChartInstance = null; // Clear reference
        }
        // Show the original small chart card again
        if (charts[metricName] && charts[metricName].element) {
            charts[metricName].element.style.display = '';
        }
        // Clear global fullscreen chart references
        currentFullscreenMetricName = null;
        // Clear the fullscreen container just in case
        const fsContainer = document.getElementById('fullscreen-chart-container');
        if (fsContainer) fsContainer.innerHTML = '';
    }, { once: true }); // Use { once: true } to auto-remove listener after first hide

    setTimeout(() => {
        const container = document.getElementById('fullscreen-chart-container');
        container.innerHTML = ''; // Clear any previous chart in container

        const canvas = document.createElement('canvas');
        canvas.id = `fullscreen-chart-${metricName}`;
        container.appendChild(canvas);

        const datasets = [];
        for (const [runName, dataPoints] of Object.entries(runData)) {
            const color = stringToColor(runName);
            datasets.push({
                label: runName,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color.replace('50%', '80%').replace('hsl', 'hsla').replace(')', ',0.2)'),
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 5
            });
        }

        currentFullscreenChartInstance = new Chart(canvas.getContext('2d'), { // Assign to global variable
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Step',
                            color: '#9e9e9e'
                        },
                        grid: {
                            color: '#2d2d2d'
                        },
                        ticks: {
                            color: '#9e9e9e'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: metricName,
                            color: '#9e9e9e'
                        },
                        grid: {
                            color: '#2d2d2d'
                        },
                        ticks: {
                            color: '#9e9e9e'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1e1e1e',
                        titleColor: '#ff8a00',
                        bodyColor: '#bdbdbd',
                        borderColor: '#2d2d2d',
                        borderWidth: 1
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#9e9e9e',
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }, 400);
}

function showLoading() {
    loadingContainer.classList.remove('d-none');
}

function hideLoading() {
    loadingContainer.classList.add('d-none');
}

function showLogin() {
    hideLoading();
    loginContainer.classList.remove('d-none');
    mainContainer.classList.add('d-none');
}

function showMain() {
    hideLoading();
    loginContainer.classList.add('d-none');
    mainContainer.classList.remove('d-none');
}

function showProjects() {
    stopMetricsAutoRefresh();
    projectsView.classList.remove('d-none');
    projectDetails.classList.add('d-none');
}

function showProjectDetails() {
    projectsView.classList.add('d-none');
    projectDetails.classList.remove('d-none');
}

function setCookieCredentials(username, password) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    document.cookie = `lmt_username=${encodeURIComponent(username)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Strict`;
    document.cookie = `lmt_password=${encodeURIComponent(password)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Strict`;
}

function getCookieCredentials() {
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    let username = null;
    let password = null;

    for (const cookie of cookies) {
        if (cookie.startsWith('lmt_username=')) {
            username = decodeURIComponent(cookie.substring('lmt_username='.length));
        } else if (cookie.startsWith('lmt_password=')) {
            password = decodeURIComponent(cookie.substring('lmt_password='.length));
        }
    }

    if (username && password) {
        return { username, password };
    }

    return null;
}

function clearCookieCredentials() {
    document.cookie = 'lmt_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
    document.cookie = 'lmt_password=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
}

async function fetchWithAuth(url, options = {}, username = null, password = null) {
    const user = username || currentUser;

    const passCookie = document.cookie.split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith('lmt_password='));

    const pass = password || (passCookie ? decodeURIComponent(passCookie.substring('lmt_password='.length)) : null);

    if (!user || !pass) {
        throw new Error('Non authorized');
    }

    const headers = options.headers || {};
    headers['Authorization'] = `${user}:${pass}`;

    return fetch(API_BASE_URL + url, {
        ...options,
        headers
    });
}

async function deleteRun(runName) {
    if (!confirm(`Are you sure you want to delete run "${runName}"? This action is irreversible!`)) {
        return;
    }
    showLoading();
    stopMetricsAutoRefresh();
    try {
        const response = await fetchWithAuth('/api/delete-run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                project_name: currentProject,
                run_name: runName
            })
        });
        if (response.ok) {
            allRuns = allRuns.filter(r => r.name !== runName);
            selectedRuns = selectedRuns.filter(r => r.name !== runName);
            renderRunsList();
            await loadMetrics();
        } else {
            alert('Failed to delete run');
        }
    } catch (error) {
        console.error('Deleting run error:', error);
        alert('Deleting run error');
    } finally {
        hideLoading();
        startMetricsAutoRefresh();
    }
}

function startMetricsAutoRefresh() {
    if (metricsRefreshIntervalId) {
        clearInterval(metricsRefreshIntervalId);
    }
    metricsRefreshIntervalId = setInterval(async () => {
        if (currentProject) {
            await loadMetrics();
            const response = await fetchWithAuth('/api/get-runs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ project_name: currentProject })
            });
            if (response.ok) {
                const data = await response.json();
                const newAllRuns = data.runs || [];
                if (JSON.stringify(allRuns.map(r => r.name)) !== JSON.stringify(newAllRuns.map(r => r.name))) {
                    allRuns = newAllRuns;
                    const newSelectedRuns = [];
                    for (const run of allRuns) {
                        if (selectedRuns.some(r => r.name === run.name)) {
                            newSelectedRuns.push(run);
                        }
                    }
                    selectedRuns = newSelectedRuns;
                    renderRunsList();
                }
            } else {
                console.error('Failed to auto-refresh runs list:', response.statusText);
            }
        }
    }, 15000);
}

function stopMetricsAutoRefresh() {
    if (metricsRefreshIntervalId) {
        clearInterval(metricsRefreshIntervalId);
        metricsRefreshIntervalId = null;
    }
}
