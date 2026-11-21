
"use strict";

// ==========================================
// AIR QUALITY INDEX - COMPLETE JAVASCRIPT
// State -> District -> Location
// Live AQI + Map + Charts + ML Prediction
// ==========================================

// ==========================================
// 1. LABELS AND GLOBAL VARIABLES
// ==========================================

const featureLabels = {
    "AQI": "Today's Indian AQI",
    "PM2.5": "PM2.5",
    "PM10": "PM10",
    "NO": "Nitric Oxide (NO)",
    "NO2": "Nitrogen Dioxide (NO2)",
    "NOx": "Nitrogen Oxides (NOx)",
    "NH3": "Ammonia (NH3)",
    "CO": "Carbon Monoxide (CO)",
    "SO2": "Sulphur Dioxide (SO2)",
    "O3": "Ozone (O3)",
    "Benzene": "Benzene",
    "Toluene": "Toluene",
    "Xylene": "Xylene"
};

const pollutantLabels = {
    "pm2_5": "PM2.5",
    "pm10": "PM10",
    "nitrogen_dioxide": "NO2",
    "sulphur_dioxide": "SO2",
    "carbon_monoxide": "CO",
    "ozone": "O3"
};

const sampleMeasurements = {
    "AQI": 120,
    "PM2.5": 65,
    "PM10": 110,
    "NO": 12,
    "NO2": 30,
    "NOx": 42,
    "NH3": 15,
    "CO": 0.8,
    "SO2": 10,
    "O3": 35,
    "Benzene": 2.5,
    "Toluene": 4,
    "Xylene": 1.5
};

let indiaMap = null;
let locationMarker = null;

let aqiTrendChart = null;
let pollutantChart = null;
let forecastChart = null;

let selectedLocation = null;

let activeAQIRequest = 0;
let activeDistrictRequest = 0;
let activeLocationRequest = 0;
let activeSearchRequest = 0;


// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

function getElement(id) {
    return document.getElementById(id);
}

function addText(parent, tag, content) {
    const element = document.createElement(tag);

    element.textContent = String(content);

    parent.appendChild(element);

    return element;
}

function showMessage(id, message, type = "") {
    const element = getElement(id);

    if (!element) return;

    element.textContent = message;

    element.classList.remove(
        "error-message",
        "loading-message",
        "success-message"
    );

    if (type) {
        element.classList.add(type + "-message");
    }
}

function clearMessageStyle(id) {
    const element = getElement(id);

    if (!element) return;

    element.classList.remove(
        "error-message",
        "loading-message",
        "success-message"
    );
}

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            "Server returned an invalid response."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

function formatNumber(value, digits = 1) {
    if (value === null || value === undefined) {
        return "Unavailable";
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number.toFixed(digits)
        : "Unavailable";
}

function setSelectOptions(
    select,
    values,
    placeholder
) {
    if (!select) return;

    select.replaceChildren();

    const firstOption = document.createElement("option");

    firstOption.value = "";
    firstOption.textContent = placeholder;

    select.appendChild(firstOption);

    values.forEach(value => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        select.appendChild(option);
    });
}

function addOtherLocationOption(select) {
    const option = document.createElement("option");

    option.value = "other";
    option.textContent = "Other City / Village / Area";

    select.appendChild(option);
}


// ==========================================
// 3. INITIALIZE ML DASHBOARD
// ==========================================

async function initializeDashboard() {
    const data = await fetchJSON("/api/config");

    const container = getElement("featureInputs");

    if (!container) {
        throw new Error(
            "Missing HTML element: featureInputs"
        );
    }

    container.replaceChildren();

    data.features.forEach(feature => {
        const wrapper = document.createElement("div");
        wrapper.className = "field";

        const label = document.createElement("label");
        const input = document.createElement("input");

        input.type = "number";
        input.step = "any";
        input.required = true;
        input.min = "0";
        input.dataset.feature = feature;

        const inputId = "feature-" +
            feature.replace(/[^a-zA-Z0-9]/g, "-");

        input.id = inputId;
        label.htmlFor = inputId;

        label.textContent =
            featureLabels[feature] || feature;

        wrapper.append(label, input);
        container.appendChild(wrapper);
    });

    console.log("ML model loaded:", data.model);
}


// ==========================================
// 4. LOAD STATES
// ==========================================

async function loadStates() {
    const stateSelect = getElement("stateSelect");

    if (!stateSelect) {
        throw new Error(
            "Missing HTML element: stateSelect"
        );
    }

    const data = await fetchJSON("/api/states");

    setSelectOptions(
        stateSelect,
        data.states || [],
        "Select State"
    );
}


// ==========================================
// 5. STATE -> DISTRICT DROPDOWN
// ==========================================

async function updateDistrictDropdown() {
    const stateSelect = getElement("stateSelect");
    const districtSelect = getElement("districtSelect");
    const citySelect = getElement("citySelect");

    if (!stateSelect || !districtSelect || !citySelect) {
        console.error(
            "State, district or location dropdown is missing."
        );
        return;
    }

    const requestId = ++activeDistrictRequest;

    // Invalidate any previous location request.
    ++activeLocationRequest;
    ++activeSearchRequest;
    ++activeAQIRequest;

    const state = stateSelect.value;

    setSelectOptions(
        districtSelect,
        [],
        "First Select State"
    );

    setSelectOptions(
        citySelect,
        [],
        "First Select District"
    );

    districtSelect.disabled = true;
    citySelect.disabled = true;

    const customBox = getElement("customLocationBox");
    const placeInput = getElement("placeInput");

    if (customBox) {
        customBox.style.display = "none";
    }

    if (placeInput) {
        placeInput.value = "";
        placeInput.required = false;
    }

    showMessage("locationResult", "");
    showMessage("liveResult", "");

    if (!state) return;

    setSelectOptions(
        districtSelect,
        [],
        "Loading Districts..."
    );

    try {
        const params = new URLSearchParams({
            state: state
        });

        const data = await fetchJSON(
            `/api/districts?${params}`
        );

        if (
            requestId !== activeDistrictRequest ||
            stateSelect.value !== state
        ) {
            return;
        }

        const districts = data.districts || [];

        setSelectOptions(
            districtSelect,
            districts,
            districts.length
                ? "Select District"
                : "No Districts Available"
        );

        districtSelect.disabled = !districts.length;

        if (!districts.length) {
            showMessage(
                "locationResult",
                "District data is not available for this state yet.",
                "error"
            );
        }

    } catch (error) {
        if (requestId !== activeDistrictRequest) {
            return;
        }

        setSelectOptions(
            districtSelect,
            [],
            "Unable to Load Districts"
        );

        showMessage(
            "locationResult",
            error.message,
            "error"
        );
    }
}


// ==========================================
// 6. DISTRICT -> LOCATION DROPDOWN
// ==========================================

async function updateLocationDropdown() {
    const stateSelect = getElement("stateSelect");
    const districtSelect = getElement("districtSelect");
    const citySelect = getElement("citySelect");

    if (!stateSelect || !districtSelect || !citySelect) {
        return;
    }

    const requestId = ++activeLocationRequest;

    ++activeSearchRequest;
    ++activeAQIRequest;

    const state = stateSelect.value;
    const district = districtSelect.value;

    setSelectOptions(
        citySelect,
        [],
        "First Select District"
    );

    citySelect.disabled = true;

    const customBox = getElement("customLocationBox");
    const placeInput = getElement("placeInput");

    if (customBox) {
        customBox.style.display = "none";
    }

    if (placeInput) {
        placeInput.value = "";
        placeInput.required = false;
    }

    showMessage("locationResult", "");
    showMessage("liveResult", "");

    if (!state || !district) return;

    setSelectOptions(
        citySelect,
        [],
        "Loading Locations..."
    );

    try {
        const params = new URLSearchParams({
            state: state,
            district: district
        });

        const data = await fetchJSON(
            `/api/locations?${params}`
        );

        if (
            requestId !== activeLocationRequest ||
            stateSelect.value !== state ||
            districtSelect.value !== district
        ) {
            return;
        }

        const locations = data.locations || [];

        setSelectOptions(
            citySelect,
            locations,
            "Select Location"
        );

        addOtherLocationOption(citySelect);

        citySelect.disabled = false;

        console.log(
            "Locations loaded:",
            state,
            district,
            locations.length
        );

    } catch (error) {
        if (requestId !== activeLocationRequest) {
            return;
        }

        setSelectOptions(
            citySelect,
            [],
            "Unable to Load Locations"
        );

        showMessage(
            "locationResult",
            error.message,
            "error"
        );
    }
}


// ==========================================
// 7. CUSTOM LOCATION INPUT
// ==========================================

function toggleCustomLocation() {
    const citySelect = getElement("citySelect");
    const customBox = getElement("customLocationBox");
    const placeInput = getElement("placeInput");

    if (!citySelect || !customBox || !placeInput) {
        return;
    }

    const isOther = citySelect.value === "other";

    customBox.style.display =
        isOther ? "block" : "none";

    placeInput.required = isOther;

    if (!isOther) {
        placeInput.value = "";
    }

    ++activeSearchRequest;
    ++activeAQIRequest;

    showMessage("locationResult", "");
    showMessage("liveResult", "");
}


// ==========================================
// 8. INITIALIZE INDIA MAP
// ==========================================

function initializeMap() {
    const mapContainer = getElement("indiaMap");

    if (!mapContainer) {
        console.error(
            "India Map HTML element is missing."
        );
        return;
    }

    if (typeof L === "undefined") {
        console.error(
            "Leaflet.js is not loaded."
        );

        mapContainer.textContent =
            "Map library could not load. Check internet connection.";

        return;
    }

    if (indiaMap) return;

    indiaMap = L.map("indiaMap", {
        zoomControl: true
    }).setView([22.5, 79.0], 5);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(indiaMap);

    requestAnimationFrame(() => {
        indiaMap.invalidateSize();
    });
}


// ==========================================
// 9. UPDATE INDIA MAP
// ==========================================

function updateMap(location, aqi = null) {
    if (!indiaMap) return;

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        console.error("Invalid map coordinates.");
        return;
    }

    if (locationMarker) {
        indiaMap.removeLayer(locationMarker);
    }

    locationMarker = L.marker([
        latitude,
        longitude
    ]).addTo(indiaMap);

    const popup = document.createElement("div");

    addText(popup, "strong", location.name);

    if (aqi !== null) {
        addText(
            popup,
            "p",
            `Modeled US AQI: ${aqi}`
        );
    }

    locationMarker.bindPopup(popup).openPopup();

    indiaMap.setView(
        [latitude, longitude],
        11
    );

    requestAnimationFrame(() => {
        indiaMap.invalidateSize();
    });
}


// ==========================================
// 10. RENDER LIVE AQI
// ==========================================

function renderLiveAQI(data, locationName) {
    const output = getElement("liveResult");

    if (!output) return;

    clearMessageStyle("liveResult");
    output.replaceChildren();

    addText(output, "h3", locationName);

    addText(
        output,
        "p",
        `Data time: ${data.time || "Unavailable"} (IST)`
    );

    addText(
        output,
        "p",
        `Source: ${data.source}`
    );

    addText(
        output,
        "p",
        "Type: Modeled estimate, not a station reading"
    );

    addText(
        output,
        "h2",
        `Current US AQI: ${data.current_aqi}`
    );

    if (data.current_advisory) {
        addText(
            output,
            "p",
            `Category: ${data.current_advisory.category}`
        );

        addText(
            output,
            "p",
            `Health Advice: ${data.current_advisory.advice}`
        );
    }

    addText(
        output,
        "h3",
        "Pollutant Measurements"
    );

    const grid = document.createElement("div");
    grid.className = "pollutant-grid";

    Object.entries(data.pollutants || {}).forEach(
        ([key, item]) => {
            const card = document.createElement("div");

            card.className = "pollutant-card";

            addText(
                card,
                "strong",
                pollutantLabels[key] || key
            );

            const value =
                item.value === null ||
                item.value === undefined
                    ? "Unavailable"
                    : `${item.value} ${item.unit || ""}`;

            addText(card, "p", value);

            grid.appendChild(card);
        }
    );

    output.appendChild(grid);

    addText(
        output,
        "h3",
        "Tomorrow's API Forecast"
    );

    if (
        data.tomorrow_average_aqi !== null &&
        data.tomorrow_average_aqi !== undefined
    ) {
        addText(
            output,
            "p",
            `${data.tomorrow_date}: Average forecast US AQI = ` +
            formatNumber(data.tomorrow_average_aqi)
        );

        if (data.tomorrow_advisory) {
            addText(
                output,
                "p",
                `Forecast Category: ${data.tomorrow_advisory.category}`
            );
        }
    } else {
        addText(
            output,
            "p",
            "Tomorrow's forecast is currently unavailable."
        );
    }

    addText(
        output,
        "small",
        "The US AQI forecast is separate from the trained Indian AQI ML model."
    );
}


// ==========================================
// 11. CHART HELPERS
// ==========================================

function chartsAvailable() {
    if (typeof Chart === "undefined") {
        console.error("Chart.js library is not loaded.");
        return false;
    }

    return true;
}

function validHourlyRecords(hourlyData) {
    if (!Array.isArray(hourlyData)) {
        return [];
    }

    return hourlyData.filter(item =>
        item &&
        typeof item.time === "string" &&
        item.aqi !== null &&
        item.aqi !== undefined &&
        Number.isFinite(Number(item.aqi))
    );
}

function destroyExistingChart(chart) {
    if (chart) {
        chart.destroy();
    }
}


// ==========================================
// 12. HOURLY AQI TREND CHART
// ==========================================

function createAQITrendChart(hourlyData) {
    if (!chartsAvailable()) return;

    const canvas = getElement("aqiTrendChart");

    if (!canvas) return;

    destroyExistingChart(aqiTrendChart);

    const records = validHourlyRecords(hourlyData);

    if (!records.length) {
        aqiTrendChart = null;
        return;
    }

    aqiTrendChart = new Chart(canvas, {
        type: "line",

        data: {
            labels: records.map(item => item.time),

            datasets: [{
                label: "Hourly Modeled US AQI",

                data: records.map(
                    item => Number(item.aqi)
                ),

                borderColor: "#0f766e",
                backgroundColor: "rgba(15, 118, 110, 0.12)",

                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 5
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    enabled: true
                }
            },

            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 8
                    }
                },

                y: {
                    beginAtZero: true,

                    title: {
                        display: true,
                        text: "US AQI"
                    }
                }
            }
        }
    });
}


// ==========================================
// 13. POLLUTANT COMPARISON CHART
// ==========================================

function createPollutantChart(pollutants) {
    if (!chartsAvailable()) return;

    const canvas = getElement("pollutantChart");

    if (!canvas) return;

    destroyExistingChart(pollutantChart);

    const entries = Object.entries(pollutants || {})
        .filter(([, item]) => {
            if (!item) return false;

            if (
                item.value === null ||
                item.value === undefined
            ) {
                return false;
            }

            const value = Number(item.value);

            return (
                Number.isFinite(value) &&
                ["µg/m³", "μg/m³", "ug/m3"].includes(
                    item.unit
                )
            );
        });

    if (!entries.length) {
        pollutantChart = null;
        return;
    }

    const labels = entries.map(
        ([key]) => pollutantLabels[key] || key
    );

    const values = entries.map(
        ([, item]) => Number(item.value)
    );

    pollutantChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels: labels,

            datasets: [{
                label: "Concentration (µg/m³)",
                data: values,

                backgroundColor: [
                    "#0f766e",
                    "#14b8a6",
                    "#38bdf8",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ef4444"
                ],

                borderRadius: 6
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    title: {
                        display: true,
                        text: "Concentration (µg/m³)"
                    }
                }
            }
        }
    });
}


// ==========================================
// 14. TOMORROW FORECAST CHART
// ==========================================

function createForecastChart(
    hourlyData,
    tomorrowDate
) {
    if (!chartsAvailable()) return;

    const canvas = getElement("forecastChart");

    if (!canvas) return;

    destroyExistingChart(forecastChart);

    const records = validHourlyRecords(hourlyData)
        .filter(item =>
            tomorrowDate &&
            item.time.startsWith(tomorrowDate)
        );

    if (!records.length) {
        forecastChart = null;
        return;
    }

    forecastChart = new Chart(canvas, {
        type: "line",

        data: {
            labels: records.map(
                item => item.time.substring(11, 16)
            ),

            datasets: [{
                label: "Tomorrow's Forecast US AQI",

                data: records.map(
                    item => Number(item.aqi)
                ),

                borderColor: "#f97316",
                backgroundColor: "rgba(249, 115, 22, 0.15)",

                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {
                legend: {
                    display: true
                }
            },

            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Time (IST)"
                    },

                    ticks: {
                        maxTicksLimit: 12
                    }
                },

                y: {
                    beginAtZero: true,

                    title: {
                        display: true,
                        text: "US AQI"
                    }
                }
            }
        }
    });
}


// ==========================================
// 15. UPDATE ALL VISUALIZATIONS
// ==========================================

function updateVisualizations(data, location) {
    updateMap(
        location,
        data.current_aqi
    );

    if (!chartsAvailable()) return;

    createAQITrendChart(
        data.hourly_aqi || []
    );

    createPollutantChart(
        data.pollutants || {}
    );

    createForecastChart(
        data.hourly_aqi || [],
        data.tomorrow_date || ""
    );
}


// ==========================================
// 16. SEARCH SELECTED LOCATION
// ==========================================

async function searchLocation() {
    const stateSelect = getElement("stateSelect");
    const districtSelect = getElement("districtSelect");
    const citySelect = getElement("citySelect");
    const placeInput = getElement("placeInput");

    const output = getElement("locationResult");
    const button = getElement("searchLocation");

    if (!stateSelect || !districtSelect || !citySelect) {
        showMessage(
            "locationResult",
            "Location dropdowns are missing in index.html.",
            "error"
        );
        return;
    }

    const state = stateSelect.value;
    const district = districtSelect.value;
    const selectedCity = citySelect.value;

    const place = selectedCity === "other"
        ? (placeInput ? placeInput.value.trim() : "")
        : selectedCity;

    if (!state) {
        showMessage(
            "locationResult",
            "Please select a State.",
            "error"
        );
        return;
    }

    if (!district) {
        showMessage(
            "locationResult",
            "Please select a District.",
            "error"
        );
        return;
    }

    if (!place) {
        showMessage(
            "locationResult",
            "Please select or enter a Location.",
            "error"
        );
        return;
    }

    const requestId = ++activeSearchRequest;

    // Invalidate any old live AQI request.
    ++activeAQIRequest;

    showMessage(
        "locationResult",
        "Searching locations...",
        "loading"
    );

    showMessage(
        "liveResult",
        "Select a matching location to load AQI."
    );

    if (button) button.disabled = true;

    try {
        const params = new URLSearchParams({
            state: state,
            district: district,
            place: place
        });

        const data = await fetchJSON(
            `/api/location/search?${params}`
        );

        if (requestId !== activeSearchRequest) {
            return;
        }

        clearMessageStyle("locationResult");

        if (output) {
            output.replaceChildren();
        }

        if (
            !Array.isArray(data.locations) ||
            data.locations.length === 0
        ) {
            showMessage(
                "locationResult",
                "No matching location found. Try Other City / Village / Area.",
                "error"
            );
            return;
        }

        data.locations.forEach(location => {
            const locationButton =
                document.createElement("button");

            locationButton.type = "button";
            locationButton.className = "location-option";
            locationButton.textContent = location.name;

            locationButton.addEventListener(
                "click",
                () => loadLocationAQI(location)
            );

            output.appendChild(locationButton);
        });

    } catch (error) {
        if (requestId !== activeSearchRequest) {
            return;
        }

        showMessage(
            "locationResult",
            error.message,
            "error"
        );

    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}


// ==========================================
// 17. LOAD SELECTED LOCATION LIVE AQI
// ==========================================

async function loadLocationAQI(location) {
    selectedLocation = location;

    const requestId = ++activeAQIRequest;

    showMessage(
        "liveResult",
        "Loading air quality data...",
        "loading"
    );

    try {
        const params = new URLSearchParams({
            lat: location.latitude,
            lon: location.longitude
        });

        const data = await fetchJSON(
            `/api/live-aqi?${params}`
        );

        if (requestId !== activeAQIRequest) {
            return;
        }

        renderLiveAQI(
            data,
            location.name
        );

        updateVisualizations(
            data,
            location
        );

        console.log(
            "AQI dashboard updated successfully."
        );

    } catch (error) {
        if (requestId !== activeAQIRequest) {
            return;
        }

        showMessage(
            "liveResult",
            error.message,
            "error"
        );

        console.error(
            "Live AQI error:",
            error
        );
    }
}


// ==========================================
// 18. USE SAMPLE VALUES
// ==========================================

function fillSampleValues() {
    const inputs = document.querySelectorAll(
        "#featureInputs input"
    );

    if (!inputs.length) {
        showMessage(
            "result",
            "ML fields are not loaded yet.",
            "error"
        );
        return;
    }

    let filledCount = 0;

    inputs.forEach(input => {
        const feature = input.dataset.feature;

        if (
            Object.prototype.hasOwnProperty.call(
                sampleMeasurements,
                feature
            )
        ) {
            input.value = sampleMeasurements[feature];
            filledCount++;
        }
    });

    showMessage(
        "result",
        `${filledCount} sample values filled. Click Predict Tomorrow's AQI. These are test values, not real measurements.`,
        "success"
    );

    const advisoryBox = getElement("healthAdvisory");

    if (advisoryBox) {
        advisoryBox.replaceChildren();
    }
}


// ==========================================
// 19. ML NEXT-DAY AQI PREDICTION
// ==========================================

async function predictAQI(event) {
    event.preventDefault();

    const measurements = {};

    const inputs = document.querySelectorAll(
        "#featureInputs input"
    );

    if (!inputs.length) {
        showMessage(
            "result",
            "ML input fields are not loaded.",
            "error"
        );
        return;
    }

    for (const input of inputs) {
        if (input.value.trim() === "") {
            showMessage(
                "result",
                `Enter ${input.dataset.feature}.`,
                "error"
            );

            input.focus();
            return;
        }

        const value = Number(input.value);

        if (!Number.isFinite(value) || value < 0) {
            showMessage(
                "result",
                `Invalid value for ${input.dataset.feature}.`,
                "error"
            );
            return;
        }

        measurements[input.dataset.feature] = value;
    }

    showMessage(
        "result",
        "Predicting tomorrow's AQI...",
        "loading"
    );

    const advisoryBox = getElement("healthAdvisory");

    if (advisoryBox) {
        advisoryBox.replaceChildren();
    }

    try {
        const data = await fetchJSON(
            "/predict",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(measurements)
            }
        );

        showMessage(
            "result",
            `Predicted Next-Day Indian AQI: ${data.predicted_next_day_aqi}`,
            "success"
        );

        if (data.health_advisory && advisoryBox) {
            addText(
                advisoryBox,
                "h3",
                `Category: ${data.health_advisory.category}`
            );

            addText(
                advisoryBox,
                "p",
                `Health Advice: ${data.health_advisory.advice}`
            );
        }

    } catch (error) {
        showMessage(
            "result",
            error.message,
            "error"
        );
    }
}


// ==========================================
// 20. START APPLICATION
// ==========================================

function startApplication() {
    // Initialize India map
    initializeMap();

    // State -> District
    const stateSelect = getElement("stateSelect");

    if (stateSelect) {
        stateSelect.addEventListener(
            "change",
            updateDistrictDropdown
        );
    }

    // District -> Location
    const districtSelect = getElement("districtSelect");

    if (districtSelect) {
        districtSelect.addEventListener(
            "change",
            updateLocationDropdown
        );
    }

    // Other location input
    const citySelect = getElement("citySelect");

    if (citySelect) {
        citySelect.addEventListener(
            "change",
            toggleCustomLocation
        );
    }

    // Search location
    const searchButton = getElement("searchLocation");

    if (searchButton) {
        searchButton.addEventListener(
            "click",
            searchLocation
        );
    }

    // ML prediction
    const predictionForm = getElement("predictionForm");

    if (predictionForm) {
        predictionForm.addEventListener(
            "submit",
            predictAQI
        );
    }

    // Sample values
    const sampleButton = getElement("sampleValuesBtn");

    if (sampleButton) {
        sampleButton.addEventListener(
            "click",
            fillSampleValues
        );
    }

    // Initial dropdown states
    setSelectOptions(
        getElement("districtSelect"),
        [],
        "First Select State"
    );

    setSelectOptions(
        getElement("citySelect"),
        [],
        "First Select District"
    );

    const initialDistrict = getElement("districtSelect");
    const initialCity = getElement("citySelect");

    if (initialDistrict) {
        initialDistrict.disabled = true;
    }

    if (initialCity) {
        initialCity.disabled = true;
    }

    // Load ML model features
    initializeDashboard().catch(error => {
        showMessage(
            "result",
            error.message,
            "error"
        );
    });

    // Load states from Flask
    loadStates().catch(error => {
        showMessage(
            "locationResult",
            error.message,
            "error"
        );
    });

    console.log(
        "Air Quality Index application initialized."
    );
}


// ==========================================
// PROFESSIONAL DASHBOARD SUMMARY CARDS
// Add this at the END of existing script.js
// ==========================================

function setSummaryText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = String(value);
    }
}

function updateLiveSummary(data, locationName) {
    const current = data.current_aqi;

    setSummaryText(
        "currentAQIValue",
        current ?? "--"
    );

    setSummaryText(
        "currentAQICategory",
        data.current_advisory?.category || "Unavailable"
    );

    setSummaryText(
        "tomorrowAQIValue",
        data.tomorrow_average_aqi == null
            ? "--"
            : Number(data.tomorrow_average_aqi).toFixed(1)
    );

    setSummaryText(
        "tomorrowAQICategory",
        data.tomorrow_advisory?.category || "Unavailable"
    );

    setSummaryText(
        "selectedLocationValue",
        locationName
    );

    setSummaryText(
        "selectedLocationStatus",
        "Air quality data loaded"
    );
}

function updateMLSummary(data) {
    setSummaryText(
        "mlAQIValue",
        data.predicted_next_day_aqi ?? "--"
    );

    setSummaryText(
        "mlAQICategory",
        data.health_advisory?.category || "Prediction complete"
    );
}

// Connect summary cards to existing renderLiveAQI().
const originalRenderLiveAQI = renderLiveAQI;

renderLiveAQI = function(data, locationName) {
    originalRenderLiveAQI(data, locationName);
    updateLiveSummary(data, locationName);
};

// Connect ML summary card to successful /predict response.
// Keep existing predictAQI function unchanged.
const originalFetchJSONForDashboard = fetchJSON;

fetchJSON = async function(url, options = {}) {
    const data = await originalFetchJSONForDashboard(url, options);

    if (url === "/predict") {
        updateMLSummary(data);
    }

    return data;
};



// ==========================================
// 21. DOM READY
// ==========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        startApplication
    );
} else {
    startApplication();
}

/* ==========================================
   ML MODEL PERFORMANCE
   ========================================== */

function createModelComparisonChart() {

    const canvas = document.getElementById(
        "modelComparisonChart"
    );

    if (!canvas) return;

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not available.");
        return;
    }

    // Avoid duplicate charts
    const existingChart = Chart.getChart(canvas);

    if (existingChart) {
        existingChart.destroy();
    }

    new Chart(canvas, {
        type: "bar",

        data: {
            labels: [
                "Linear Regression",
                "Decision Tree",
                "Random Forest"
            ],

            datasets: [{
                label: "R² Score",

                data: [
                    0.8217,
                    0.7880,
                    0.8487
                ],

                backgroundColor: [
                    "#38bdf8",
                    "#f59e0b",
                    "#0f766e"
                ],

                borderRadius: 8
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true
                }
            },

            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,

                    title: {
                        display: true,
                        text: "R² Score"
                    }
                }
            }
        }
    });
}

// Run when page is ready
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        createModelComparisonChart
    );
} else {
    createModelComparisonChart();
}
