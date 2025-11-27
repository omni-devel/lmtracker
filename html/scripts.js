const API_BASE_URL = "";
const REFRESH_INTERVAL_MS = 10000;
const METRICS_INTERVAL_MS = 5000;

const state = {
    user: null,
    currentProject: null,
    allRuns: [],
    selectedRunNames: new Set(),
    metricsData: {},
    charts: {},
    intervals: {
        runs: null,
        metrics: null,
    },
    fullscreenMetric: null,
    fullscreenChart: null,
};

const DOM = {
    app: document.getElementById("app"),
    navbar: document.getElementById("navbar"),
    views: {
        login: document.getElementById("view-login"),
        projects: document.getElementById("view-projects"),
        dashboard: document.getElementById("view-dashboard"),
    },
    forms: {
        login: document.getElementById("form-login"),
        newProject: document.getElementById("form-new-project"),
    },
    inputs: {
        username: document.getElementById("input-username"),
        password: document.getElementById("input-password"),
        projectName: document.getElementById("input-project-name"),
        runsSearch: document.getElementById("search-runs"),
    },
    containers: {
        projectsGrid: document.getElementById("projects-grid"),
        runsList: document.getElementById("runs-list-container"),
        charts: document.getElementById("charts-container"),
        toast: document.querySelector(".toast-container"),
    },
    buttons: {
        logout: document.getElementById("btn-logout"),
        backProjects: document.getElementById("btn-back-projects"),
        selectAll: document.getElementById("btn-select-all"),
        selectNone: document.getElementById("btn-select-none"),
    },
    overlay: document.getElementById("loading-overlay"),
    userDisplay: document.getElementById("user-display"),
    projectNameDisplay: document.getElementById("current-project-name"),
    modals: {
        newProject: new bootstrap.Modal(
            document.getElementById("modal-new-project"),
        ),
        fullscreen: new bootstrap.Modal(
            document.getElementById("modal-fullscreen"),
        ),
    },
};

document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();
    await checkAuth();
});

function setupEventListeners() {
    DOM.forms.login.addEventListener("submit", handleLogin);
    DOM.buttons.logout.addEventListener("click", handleLogout);
    DOM.forms.newProject.addEventListener("submit", handleCreateProject);
    DOM.buttons.backProjects.addEventListener("click", showProjectsView);

    const navProjects = document.getElementById("nav-projects");
    if (navProjects) {
        navProjects.addEventListener("click", (e) => {
            e.preventDefault();
            showProjectsView();

            const navToggler = document.querySelector(".navbar-toggler");
            const navContent = document.getElementById("navContent");
            if (
                window.getComputedStyle(navToggler).display !== "none" &&
                navContent.classList.contains("show")
            ) {
                navToggler.click();
            }
        });
    }

    DOM.buttons.selectAll.addEventListener("click", () => {
        const searchTerm = DOM.inputs.runsSearch.value.toLowerCase();
        state.allRuns.forEach((r) => {
            if (!searchTerm || r.name.toLowerCase().includes(searchTerm)) {
                state.selectedRunNames.add(r.name);
            }
        });
        renderRunsList();
        fetchAndRenderMetrics();
    });

    DOM.buttons.selectNone.addEventListener("click", () => {
        state.selectedRunNames.clear();
        renderRunsList();
        renderCharts();
    });
    DOM.inputs.runsSearch.addEventListener("input", renderRunsList);

    document
        .getElementById("modal-fullscreen")
        .addEventListener("hidden.bs.modal", () => {
            if (state.fullscreenChart) {
                state.fullscreenChart.destroy();
                state.fullscreenChart = null;
            }
            state.fullscreenMetric = null;
        });
}

function getAuthHeaders() {
    const creds = getCookieCredentials();
    if (!creds) return {};
    return { Authorization: `${creds.username}:${creds.password}` };
}

async function apiCall(endpoint, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(API_BASE_URL + endpoint, options);
        if (response.status === 401) {
            handleLogout();
            throw new Error("Unauthorized");
        }
        return response;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

async function checkAuth() {
    const creds = getCookieCredentials();
    if (!creds) {
        showLoginView();
        return;
    }

    setLoading(true);
    try {
        const res = await apiCall("/api/check-user");
        if (res.ok) {
            state.user = creds.username;
            DOM.userDisplay.textContent = state.user;
            showProjectsView();
        } else {
            showLoginView();
        }
    } catch (e) {
        showLoginView();
    } finally {
        setLoading(false);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const user = DOM.inputs.username.value;
    const pass = DOM.inputs.password.value;

    setLoading(true);
    document.cookie = `lmt_username=${encodeURIComponent(user)}; path=/; SameSite=Strict`;
    document.cookie = `lmt_password=${encodeURIComponent(pass)}; path=/; SameSite=Strict`;

    try {
        const res = await apiCall("/api/check-user");
        if (res.ok) {
            setCookieCredentials(user, pass);
            state.user = user;
            DOM.userDisplay.textContent = user;
            DOM.forms.login.reset();
            showProjectsView();
        } else {
            showToast("Login failed", "Invalid credentials", "danger");
            clearCookieCredentials();
        }
    } catch (err) {
        showToast("Error", "Network error", "danger");
        clearCookieCredentials();
    } finally {
        setLoading(false);
    }
}

function handleLogout() {
    clearCookieCredentials();
    stopAutoRefresh();
    state.user = null;
    showLoginView();
}

async function loadProjects() {
    setLoading(true);
    try {
        const res = await apiCall("/api/get-projects", "POST", {});
        if (res.ok) {
            const data = await res.json();
            const projects = (data.projects || []).sort(
                (a, b) => b.modified_at - a.modified_at,
            );
            renderProjects(projects);
        }
    } catch (e) {
        showToast("Error", "Failed to load projects", "danger");
    } finally {
        setLoading(false);
    }
}

function renderProjects(projects) {
    DOM.containers.projectsGrid.innerHTML = "";
    if (projects.length === 0) {
        DOM.containers.projectsGrid.innerHTML =
            '<div class="col-12 text-center text-muted">No projects found.</div>';
        return;
    }

    projects.forEach((p) => {
        const date = new Date(p.modified_at * 1000).toLocaleString();
        const col = document.createElement("div");
        col.className = "col-md-4 col-lg-3";
        col.innerHTML = `
            <div class="card project-card h-100 p-3 position-relative">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="text-white m-0 text-truncate pe-2">${escapeHtml(p.name)}</h5>
                    <button class="btn btn-link btn-sm p-0 text-danger delete-project-btn" style="z-index: 2;" title="Delete Project">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <small class="text-secondary">Modified: ${date}</small>
            </div>
        `;
        col.querySelector(".card").addEventListener("click", () =>
            openProject(p.name),
        );
        col.querySelector(".delete-project-btn").addEventListener(
            "click",
            (e) => {
                e.stopPropagation();
                deleteProject(p.name);
            },
        );
        DOM.containers.projectsGrid.appendChild(col);
    });
}

async function handleCreateProject(e) {
    e.preventDefault();
    const name = DOM.inputs.projectName.value.trim();
    if (!name) return;

    try {
        const res = await apiCall("/api/create-project", "POST", { name });
        if (res.ok) {
            DOM.modals.newProject.hide();
            DOM.inputs.projectName.value = "";
            loadProjects();
            showToast("Success", "Project created", "success");
        } else {
            showToast("Error", "Failed to create project", "danger");
        }
    } catch (e) {
        showToast("Error", "Network error", "danger");
    }
}

async function deleteProject(name) {
    if (
        !confirm(
            `Are you sure you want to delete project "${name}"? All runs will be lost.`,
        )
    )
        return;

    setLoading(true);
    try {
        const res = await apiCall("/api/delete-project", "POST", { name });
        if (res.ok) {
            showToast("Deleted", "Project deleted", "success");
            loadProjects();
        } else {
            showToast("Error", "Failed to delete project", "danger");
        }
    } catch (e) {
        showToast("Error", "Network error", "danger");
    } finally {
        setLoading(false);
    }
}

async function openProject(projectName) {
    state.currentProject = projectName;
    DOM.projectNameDisplay.textContent = projectName;
    state.selectedRunNames.clear();
    state.metricsData = {};

    Object.values(state.charts).forEach((chart) => chart.destroy());
    state.charts = {};
    DOM.containers.charts.innerHTML = "";

    showDashboardView();
    await fetchRuns(false);
    startAutoRefresh();
}

async function fetchRuns(isAutoRefresh = false) {
    if (!state.currentProject) return;

    try {
        const res = await apiCall("/api/get-runs", "POST", {
            project_name: state.currentProject,
        });
        if (res.ok) {
            const data = await res.json();
            let newRuns = data.runs || [];

            newRuns.sort((a, b) => b.modified_at - a.modified_at);

            const runsChanged =
                JSON.stringify(newRuns.map((r) => r.name)) !==
                JSON.stringify(state.allRuns.map((r) => r.name));

            if (runsChanged || !isAutoRefresh) {
                state.allRuns = newRuns;

                if (
                    !isAutoRefresh &&
                    state.selectedRunNames.size === 0 &&
                    newRuns.length > 0
                ) {
                    newRuns
                        .slice(0, 10)
                        .forEach((r) => state.selectedRunNames.add(r.name));
                }

                const runNames = new Set(state.allRuns.map((r) => r.name));
                for (const selected of state.selectedRunNames) {
                    if (!runNames.has(selected))
                        state.selectedRunNames.delete(selected);
                }

                renderRunsList();

                if (!isAutoRefresh) {
                    fetchAndRenderMetrics();
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch runs", e);
    }
}

function renderRunsList() {
    const container = DOM.containers.runsList;
    const searchTerm = DOM.inputs.runsSearch.value.toLowerCase();
    const scrollTop = container.scrollTop;

    container.innerHTML = "";

    if (state.allRuns.length === 0) {
        container.innerHTML =
            '<div class="text-center text-secondary mt-3 small">No runs available</div>';
        return;
    }

    state.allRuns.forEach((run) => {
        if (searchTerm && !run.name.toLowerCase().includes(searchTerm)) return;

        const isSelected = state.selectedRunNames.has(run.name);
        const date = new Date(run.modified_at * 1000).toLocaleDateString();

        const div = document.createElement("div");
        div.className = `run-item d-flex justify-content-between align-items-center ${isSelected ? "selected" : ""}`;

        div.innerHTML = `
            <div class="form-check m-0 flex-grow-1">
                <input class="form-check-input" type="checkbox" id="run-${run.name}" ${isSelected ? "checked" : ""}>
                <label class="form-check-label text-white text-break small" for="run-${run.name}" style="cursor:pointer">
                    ${escapeHtml(run.name)}
                    <div class="text-secondary" style="font-size: 0.7rem">${date}</div>
                </label>
            </div>
            <button class="btn btn-link btn-sm p-0 delete-run-btn" title="Delete">
                <i class="bi bi-trash"></i>
            </button>
        `;

        const checkbox = div.querySelector("input");
        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                state.selectedRunNames.add(run.name);
            } else {
                state.selectedRunNames.delete(run.name);
            }
            div.classList.toggle("selected", e.target.checked);
            fetchAndRenderMetrics();
        });

        div.querySelector(".delete-run-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteRun(run.name);
        });

        container.appendChild(div);
    });

    container.scrollTop = scrollTop;
}

async function deleteRun(runName) {
    if (!confirm(`Delete run "${runName}"?`)) return;

    try {
        const res = await apiCall("/api/delete-run", "POST", {
            project_name: state.currentProject,
            run_name: runName,
        });
        if (res.ok) {
            state.allRuns = state.allRuns.filter((r) => r.name !== runName);
            state.selectedRunNames.delete(runName);
            renderRunsList();
            fetchAndRenderMetrics();
            showToast("Deleted", `Run ${runName} deleted`, "success");
        } else {
            showToast("Error", "Failed to delete run", "danger");
        }
    } catch (e) {
        showToast("Error", "Network error", "danger");
    }
}

async function fetchAndRenderMetrics() {
    if (state.selectedRunNames.size === 0) {
        state.metricsData = {};
        renderCharts();
        return;
    }

    const newMetricsData = {};

    const promises = Array.from(state.selectedRunNames).map(async (runName) => {
        try {
            const res = await apiCall("/api/get-run", "POST", {
                project_name: state.currentProject,
                run_name: runName,
            });
            if (res.ok) {
                const data = await res.json();
                if (data.metrics) {
                    data.metrics.forEach((stepMetric, index) => {
                        Object.entries(stepMetric).forEach(([key, val]) => {
                            if (!newMetricsData[key]) newMetricsData[key] = {};
                            if (!newMetricsData[key][runName])
                                newMetricsData[key][runName] = [];

                            newMetricsData[key][runName].push({
                                x: Number(index),
                                y: Number(val),
                            });
                        });
                    });
                }
            }
        } catch (e) {
            console.error(`Error fetching metrics for ${runName}`, e);
        }
    });

    await Promise.all(promises);
    state.metricsData = newMetricsData;
    renderCharts();

    if (state.fullscreenMetric) {
        updateFullscreenChart();
    }
}

function renderCharts() {
    const container = DOM.containers.charts;
    const metricNames = Object.keys(state.metricsData);

    if (metricNames.length === 0) {
        if (state.selectedRunNames.size > 0) {
            container.innerHTML =
                '<div class="col-12 text-center text-muted mt-5">Selected runs have no metrics data.</div>';
        } else {
            container.innerHTML = `
                <div class="col-12 text-center mt-5 text-secondary">
                    <i class="bi bi-bar-chart fs-1"></i>
                    <p class="mt-2">Select runs from the sidebar to view metrics.</p>
                </div>`;
        }
        Object.values(state.charts).forEach((c) => c.destroy());
        state.charts = {};
        return;
    }

    if (Object.keys(state.charts).length === 0) {
        container.innerHTML = "";
    }

    Object.keys(state.charts).forEach((metric) => {
        if (!metricNames.includes(metric)) {
            state.charts[metric].destroy();
            delete state.charts[metric];
            const el = document.getElementById(`card-${metric}`);
            if (el) el.remove();
        }
    });

    metricNames.forEach((metric) => {
        let chartInstance = state.charts[metric];

        if (!chartInstance) {
            const col = document.createElement("div");
            col.className = "col-md-6 col-xl-4";
            col.id = `card-${metric}`;
            col.innerHTML = `
                <div class="chart-card">
                    <div class="chart-header">
                        <h6 class="text-white m-0 text-truncate" title="${metric}">${metric}</h6>
                        <button class="btn-fullscreen" onclick="openFullscreen('${metric}')">
                            <i class="bi bi-arrows-fullscreen"></i>
                        </button>
                    </div>
                    <div class="chart-canvas-container">
                        <canvas></canvas>
                    </div>
                </div>
            `;
            container.appendChild(col);

            const ctx = col.querySelector("canvas").getContext("2d");
            chartInstance = createChartInstance(ctx, metric);
            state.charts[metric] = chartInstance;
        }

        updateChartData(chartInstance, state.metricsData[metric]);
    });
}

function createChartInstance(ctx, title) {
    return new Chart(ctx, {
        type: "line",
        data: { datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            parsing: false,
            interaction: {
                mode: "nearest",
                axis: "x",
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1E1E1E",
                    titleColor: "#fff",
                    bodyColor: "#ccc",
                    borderColor: "#333",
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => `Step: ${items[0].parsed.x}`,
                        label: (item) =>
                            `${item.dataset.label}: ${item.parsed.y.toPrecision(5)}`,
                    },
                },
            },
            scales: {
                x: {
                    type: "linear",
                    display: true,
                    grid: { color: "#222", drawBorder: false },
                    ticks: { color: "#666", maxRotation: 0, autoSkip: true },
                    title: {
                        display: true,
                        text: "Step",
                        color: "#444",
                        font: { size: 10 },
                    },
                },
                y: {
                    type: "linear",
                    display: true,
                    grid: { color: "#222", drawBorder: false },
                    ticks: { color: "#666" },
                },
            },
        },
    });
}

function updateChartData(chart, runDataMap) {
    const datasets = [];

    const availableRuns = Object.keys(runDataMap);
    availableRuns.sort((a, b) => {
        const indexA = state.allRuns.findIndex((r) => r.name === a);
        const indexB = state.allRuns.findIndex((r) => r.name === b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    availableRuns.forEach((runName) => {
        const points = runDataMap[runName];
        const color = getRunColor(runName);
        datasets.push({
            label: runName,
            data: points,
            borderColor: color,
            backgroundColor: "transparent",
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1,
            spanGaps: true,
        });
    });

    chart.data.datasets = datasets;
    chart.update("none");
}

window.openFullscreen = function (metricName) {
    state.fullscreenMetric = metricName;
    document.getElementById("fullscreen-title").textContent = metricName;
    DOM.modals.fullscreen.show();

    setTimeout(() => {
        const canvas = document.getElementById("canvas-fullscreen");
        if (state.fullscreenChart) state.fullscreenChart.destroy();

        state.fullscreenChart = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false,
                interaction: { mode: "nearest", axis: "x", intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: "#ccc", boxWidth: 10 },
                    },
                    tooltip: {
                        backgroundColor: "#1E1E1E",
                        titleColor: "#fff",
                        bodyColor: "#ccc",
                        borderColor: "#333",
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => `Step: ${items[0].parsed.x}`,
                            label: (item) =>
                                `${item.dataset.label}: ${item.parsed.y.toPrecision(6)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        type: "linear",
                        grid: { color: "#222" },
                        ticks: { color: "#888" },
                        title: { display: true, text: "Step", color: "#666" },
                    },
                    y: {
                        type: "linear",
                        grid: { color: "#222" },
                        ticks: { color: "#888" },
                    },
                },
            },
        });
        updateFullscreenChart();
    }, 200);
};

function updateFullscreenChart() {
    if (!state.fullscreenChart || !state.fullscreenMetric) return;
    const data = state.metricsData[state.fullscreenMetric];
    if (data) {
        updateChartData(state.fullscreenChart, data);
    }
}

function getRunColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 85%, 60%)`;
}

function startAutoRefresh() {
    stopAutoRefresh();
    state.intervals.runs = setInterval(
        () => fetchRuns(true),
        REFRESH_INTERVAL_MS,
    );
    state.intervals.metrics = setInterval(
        () => fetchAndRenderMetrics(),
        METRICS_INTERVAL_MS,
    );
}

function stopAutoRefresh() {
    if (state.intervals.runs) clearInterval(state.intervals.runs);
    if (state.intervals.metrics) clearInterval(state.intervals.metrics);
    state.intervals.runs = null;
    state.intervals.metrics = null;
}

function showLoginView() {
    DOM.views.login.classList.remove("d-none");
    DOM.views.projects.classList.add("d-none");
    DOM.views.dashboard.classList.add("d-none");
    DOM.navbar.classList.add("d-none");
}

function showProjectsView() {
    stopAutoRefresh();
    state.currentProject = null;
    DOM.views.login.classList.add("d-none");
    DOM.views.projects.classList.remove("d-none");
    DOM.views.dashboard.classList.add("d-none");
    DOM.navbar.classList.remove("d-none");
    loadProjects();
}

function showDashboardView() {
    DOM.views.login.classList.add("d-none");
    DOM.views.projects.classList.add("d-none");
    DOM.views.dashboard.classList.remove("d-none");
    DOM.navbar.classList.remove("d-none");
}

function setLoading(isLoading) {
    if (isLoading) DOM.overlay.classList.remove("d-none");
    else DOM.overlay.classList.add("d-none");
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(title, message, type = "info") {
    const toastEl = document.createElement("div");
    toastEl.className = `toast align-items-center text-white bg-${type === "danger" ? "danger" : "dark"} border-0`;
    toastEl.setAttribute("role", "alert");
    toastEl.setAttribute("aria-live", "assertive");
    toastEl.setAttribute("aria-atomic", "true");

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong>: ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    DOM.containers.toast.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

function setCookieCredentials(username, password) {
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    document.cookie = `lmt_username=${encodeURIComponent(username)}; expires=${exp.toUTCString()}; path=/; SameSite=Strict`;
    document.cookie = `lmt_password=${encodeURIComponent(password)}; expires=${exp.toUTCString()}; path=/; SameSite=Strict`;
}

function getCookieCredentials() {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    let username = null,
        password = null;
    cookies.forEach((c) => {
        if (c.startsWith("lmt_username="))
            username = decodeURIComponent(c.substring(13));
        if (c.startsWith("lmt_password="))
            password = decodeURIComponent(c.substring(13));
    });
    return username && password ? { username, password } : null;
}

function clearCookieCredentials() {
    document.cookie =
        "lmt_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
    document.cookie =
        "lmt_password=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
}
