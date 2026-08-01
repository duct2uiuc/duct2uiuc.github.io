
const screenWidth = 1650;
const screenHeight = 950;
const margin = { top: 60, right: 225, bottom: 60, left: 60 };
const chartWidth = screenWidth - margin.left - margin.right;
const chartHeight = screenHeight - margin.top - margin.bottom;

const tooltip = d3.select(".tooltip");
const previousButton = d3.select("#previous-button");
const currentYearLabel = d3.select("#current-year");
const nextButton = d3.select("#next-button");

const tourOverlay = d3.select("#tour-overlay");
const tourDialog = d3.select("#tour-dialog");
const tourPageLabel = d3.select("#tour-page");
const tourStartButton = d3.select("#tour-start");
const tourAction = d3.select("#tour-button");
const tourHeading = d3.select("#tour-heading");
const tourDescription = d3.select("#tour-description");

const years = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

const annotations = {
    "2020": [
        { topic: "Software", note: "Accelerated digital transformation", offsetY: 30 },
        { topic: "Trade", note: "Surged labour shortages", offsetY: 0 }
    ],
    "2021": [
        { topic: "R&D", note: "Economy recovery projects", offsetY: 30 },
        { topic: "Trade", note: "Social distancing effects", offsetY: 0 }
    ],
    "2022": [
        { topic: "Workforce", note: "Post-pandemic planning", offsetY: 0 },
        { topic: "Circular Economy", note: "Growing resource scarcity", offsetY: 0 }
    ],
    "2023": [
        { topic: "IP", note: "Rapid technological advancement", offsetY: 34 },
        { topic: "VR/AR", note: "Entering trough of disillusionment", offsetY: 0 }
    ],
    "2024": [
        { topic: "IoT", note: "Real-world apps established", offsetY: -40 },
        { topic: "Telecom", note: "5G matured the industry", offsetY: 0 }
    ],
    "2025": [
        { topic: "Automation", note: "Matured but highly sought-after", offsetY: -20 },
        { topic: "Health", note: "COVID-19 transitioned to endemic", offsetY: 20 },
        { topic: "Quantum", note: "National Quantum Strategy", offsetY: 0 }
    ],
    "2026": [
        { topic: "AI", note: "Modern utility globally", offsetY: 15 },
        { topic: "IP", note: "GenAI regulated", offsetY: 0 }
    ]
};

const tourPages = [
    {
        title: "Welcome to the tour",
        text: "Learn how to interact with the chart to reveal each year, uncover more information, and track a topic through the rankings.",
        target: null,
        action: "Sweet!"
    },
    {
        title: "Navigate through the years",
        text: "Use the controls to step through each endpoint.",
        target: ".navigations",
        action: "Wow!"
    },
    {
        title: "Deepdive through the trends",
        text: "Hover over any line or topic label to highlight the trend and view more information. The full timeline remains visible through 2026.",
        target: "#svg",
        action: "Magnificent!",
        exampleTopic: "Marketing"
    }
];



d3.csv("data/data.csv", d3.autoType)
    .then(data => {
        let idxCurrentYear = 0;
        let idxTourPage = -1;
        let idxYearBackupForTour = 0;
        let tourExampleTimer = null;

        const topics = data.map(d => d.Topic);
        const series = data.map(row => ({
            topic: row.Topic,
            values: years.map(year => ({
                year,
                rank: row[year]
            }))
        }));

        const x = d3.scalePoint()
            .domain(years)
            .range([0, chartWidth]);

        const y = d3.scaleLinear()
            .domain([1, d3.max(data, d => d3.max(years, year => d[year]))])
            .range([0, chartHeight]);

        const color = d3.scaleOrdinal()
            .domain(topics)
            .range(d3.quantize(d3.interpolateRainbow, topics.length));

        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.rank))
            .curve(d3.curveMonotoneX);

        const svg = d3.select("#svg")
            .append("svg")
            .attr("viewBox", `0 0 ${screenWidth} ${screenHeight}`)
            .attr("aria-label", "Main chart")
            .attr("role", "img")
            .attr("preserveAspectRatio", "xMidYMid meet");
            
        const chart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        chart.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).ticks(30).tickSize(-chartWidth).tickFormat(""));

        chart.append("g")
            .attr("class", "axis")
            .call(d3.axisTop(x).tickSizeOuter(0));

        chart.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(30).tickSizeOuter(0));

        const yearVerticalLine = chart.append("line")
            .attr("class", "year-vertical-line")
            .attr("y1", 0)
            .attr("y2", chartHeight);

        const allLines = chart.append("g")
            .selectAll("g")
            .data(series)
            .join("g")
            .attr("class", "series")
            .on("mouseenter", function(event, topicSeries) {
                allLines.classed("dimmed", true).classed("active", false);
                d3.select(this).classed("dimmed", false).classed("active", true);
                d3.select(this).raise();
                showTooltip(event, topicSeries);
            })
            .on("mousemove", function(event, topicSeries) {
                showTooltip(event, topicSeries);
            })
            .on("mouseleave", function() {
                if (idxTourPage === 2) highlightTour();
                else allLines.classed("dimmed", false).classed("active", false);
                tooltip.style("display", "none");
            });

        allLines.append("path")
            .attr("class", "topic-line")
            .attr("stroke", d => color(d.topic));

        allLines.append("text")
            .attr("class", "topic-label")
            .attr("fill", d => color(d.topic))
            .text(d => d.topic);

        const calloutLayer = chart.append("g")
            .attr("class", "callout-layer");

        function getDetails(topicSeries) {
            const visibleValues = topicSeries.values.slice(0, idxCurrentYear + 1);
            const current = visibleValues[visibleValues.length - 1];
            const previous = visibleValues.length > 1
                ? visibleValues[visibleValues.length - 2]
                : null;

            const bestRank = d3.min(visibleValues, d => d.rank);
            const bestYears = visibleValues
                .filter(d => d.rank === bestRank)
                .map(d => d.year)
                .join(", ");

            const movement = previous === null
                ? "First year"
                : current.rank < previous.rank
                    ? `Up ${previous.rank - current.rank}`
                    : current.rank > previous.rank
                        ? `Down ${current.rank - previous.rank}`
                        : "No change";

            const overallChange = current.rank < visibleValues[0].rank
                ? `Up ${visibleValues[0].rank - current.rank}`
                : current.rank > visibleValues[0].rank
                    ? `Down ${current.rank - visibleValues[0].rank}`
                    : "No change";

            return {
                current,
                previous,
                bestRank,
                bestYears,
                movement,
                overallChange
            };
        }

        function updateCallouts(currentYear) {
            const boxWidth = 185;
            const boxHeight = 49;
            const boxGap = 87;
            const notes = (annotations[currentYear] || []).map(callout => {
                const topicSeries = series.find(d => d.topic === callout.topic);
                const pointX = x(currentYear);
                const pointY = y(topicSeries.values[idxCurrentYear].rank);
                const boxX = pointX + boxGap;
                const desiredBoxY = pointY + callout.offsetY - boxHeight / 2;
                const boxY = Math.max(4, Math.min(chartHeight - boxHeight - 4, desiredBoxY));

                return {
                    ...callout,
                    pointX,
                    pointY,
                    boxX,
                    boxY
                };
            });

            const callouts = calloutLayer
                .selectAll(".callout")
                .data(notes, d => d.topic);

            callouts.exit()
                .transition()
                .duration(200)
                .style("opacity", 0)
                .remove();

            const enteredCallouts = callouts.enter()
                .append("g")
                .attr("class", "callout")
                .style("opacity", 0);

            enteredCallouts.append("path")
                .attr("class", "callout-connector");

            enteredCallouts.append("circle")
                .attr("class", "callout-point")
                .attr("r", 4);

            enteredCallouts.append("rect")
                .attr("class", "callout-box")
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .attr("rx", 9);

            enteredCallouts.append("text")
                .attr("class", "callout-topic")
                .attr("x", 11)
                .attr("y", 18);

            enteredCallouts.append("text")
                .attr("class", "callout-note")
                .attr("x", 11)
                .attr("y", 35);

            const mergedCallouts = enteredCallouts.merge(callouts);

            mergedCallouts.transition()
                .duration(400)
                .style("opacity", 1)
                .attr("transform", d => `translate(${d.boxX},${d.boxY})`);

            mergedCallouts.select(".callout-connector")
                .attr("stroke", d => color(d.topic))
                .attr("d", d => {
                    const relativeX = d.pointX - d.boxX;
                    const relativeY = d.pointY - d.boxY;
                    return `M${relativeX},${relativeY} L0,${boxHeight / 2}`;
                });

            mergedCallouts.select(".callout-point")
                .attr("cx", d => d.pointX - d.boxX)
                .attr("cy", d => d.pointY - d.boxY)
                .attr("fill", d => color(d.topic));

            mergedCallouts.select(".callout-box")
                .attr("stroke", d => color(d.topic));

            mergedCallouts.select(".callout-topic")
                .attr("fill", d => color(d.topic))
                .text(d => d.topic);

            mergedCallouts.select(".callout-note")
                .text(d => d.note);
        }

        function clearHighlight() {
            document
                .querySelectorAll(".tour-highlight")
                .forEach(element => element.classList.remove("tour-highlight"));
        }

        function positionDialog(targetSelector) {
            tourDialog.classed("centered", targetSelector === null);
            tourDialog.style("top", null).style("left", null);

            if (targetSelector === null) return;
            
            const target = document.querySelector(targetSelector);
            target.classList.add("tour-highlight");

            const targetBounds = target.getBoundingClientRect();
            const cardBounds = tourDialog.node().getBoundingClientRect();
            const pagePadding = 16;
            let left = targetBounds.left
                + targetBounds.width / 2
                - cardBounds.width / 2;
            let top = targetBounds.bottom + 18;

            if (targetSelector === "#svg") {
                left = targetBounds.right - cardBounds.width - 24;
                top = targetBounds.top + 24;
            } else if (top + cardBounds.height > window.innerHeight - pagePadding) {
                top = targetBounds.top - cardBounds.height - 18;
            }

            left = Math.max(
                pagePadding,
                Math.min(left, window.innerWidth - cardBounds.width - pagePadding)
            );
            top = Math.max(
                pagePadding,
                Math.min(top, window.innerHeight - cardBounds.height - pagePadding)
            );

            tourDialog
                .style("left", `${left}px`)
                .style("top", `${top}px`);
        }

        function highlightTour() {
            const exampleTopic = tourPages[2].exampleTopic;

            allLines
                .classed("dimmed", d => d.topic !== exampleTopic)
                .classed("active", d => d.topic === exampleTopic);

            allLines
                .filter(d => d.topic === exampleTopic)
                .raise();

            calloutLayer.selectAll(".callout")
                .style("opacity", d => d.topic === exampleTopic ? 1 : 0.12);
        }

        function renderDialog() {
            const step = tourPages[idxTourPage];

            window.clearTimeout(tourExampleTimer);
            clearHighlight();
            tourOverlay.property("hidden", false);
            tourDialog.property("hidden", false);
            tourPageLabel.text(`Step ${idxTourPage + 1} of ${tourPages.length}`);
            tourHeading.text(step.title);
            tourDescription.text(step.text);
            tourAction.text(step.action);

            if (idxTourPage === 2) {
                idxCurrentYear = years.length - 1;
                update();
                tourExampleTimer = window.setTimeout(highlightTour, 555);
            } else {
                allLines.classed("dimmed", false).classed("active", false);
                calloutLayer.selectAll(".callout").style("opacity", null);
            }

            positionDialog(step.target);
            tourAction.node().focus();
        }

        function startTour() {
            idxYearBackupForTour = idxCurrentYear;
            idxTourPage = 0;
            renderDialog();
        }

        function finishTour() {
            window.clearTimeout(tourExampleTimer);
            idxTourPage = -1;
            clearHighlight();
            tourOverlay.property("hidden", true);
            tourDialog.property("hidden", true);
            tooltip.style("display", "none");
            allLines.classed("dimmed", false).classed("active", false);
            calloutLayer.selectAll(".callout").style("opacity", null);
            idxCurrentYear = idxYearBackupForTour;
            update();
            tourStartButton.node().focus();
        }

        function showTooltip(event, topicSeries) {
            const details = getDetails(topicSeries);
            const previousRank = details.previous === null ? "—" : `#${details.previous.rank}`;

            tooltip
                .style("display", "block")
                .style("left", `${event.pageX + 14}px`)
                .style("top", `${event.pageY + 14}px`)
                .html(
                    `<strong>${topicSeries.topic}</strong><br>` +
                    `Year: ${details.current.year}<br>` +
                    `Current rank: #${details.current.rank}<br>` +
                    `Previous rank: ${previousRank}<br>` +
                    `YoY movement: ${details.movement}<br>` +
                    `Overall change: ${details.overallChange}<br>` +
                    `Best performance: #${details.bestRank} (${details.bestYears})`
                );
        }

        function update() {
            const currentYear = years[idxCurrentYear];

            currentYearLabel.text(`Visible through ${currentYear}`);
            previousButton.property("disabled", idxCurrentYear === 0);
            nextButton.property("disabled", idxCurrentYear === years.length - 1);

            yearVerticalLine
                .transition()
                .duration(400)
                .attr("x1", x(currentYear))
                .attr("x2", x(currentYear));

            allLines.select(".topic-line")
                .transition()
                .duration(500)
                .attr("d", d => line(d.values.slice(0, idxCurrentYear + 1)));

            allLines.each(function(topicSeries) {
                d3.select(this)
                    .selectAll("circle")
                    .data(topicSeries.values.slice(0, idxCurrentYear + 1), d => d.year)
                    .join(enter => 
                        enter.append("circle")
                            .attr("class", "topic-dot")
                            .attr("r", 0)
                            .attr("cx", d => x(d.year))
                            .attr("cy", d => y(d.rank))
                            .attr("fill", color(topicSeries.topic))
                            .call(enter => enter.transition().duration(400).attr("r", 3.5)),
                        update => update,
                        exit => exit.transition()
                            .duration(250)
                            .attr("r", 0)
                            .remove()
                    );
            });

            allLines.select(".topic-label")
                .transition()
                .duration(500)
                .attr("x", x(currentYear) + 8)
                .attr("y", d => y(d.values[idxCurrentYear].rank))
                .style("opacity",
                    d => annotations[currentYear].some(callout => callout.topic === d.topic) ? 0 : 1
                );

            updateCallouts(currentYear);
        }

        previousButton.on("click", () => {
            if (idxCurrentYear > 0) {
                idxCurrentYear -= 1;
                update();
            }
        });

        nextButton.on("click", () => {
            if (idxCurrentYear < years.length - 1) {
                idxCurrentYear += 1;
                update();
            }
        });

        tourStartButton
            .property("disabled", false)
            .on("click", startTour);

        tourAction.on("click", () => {
            if (idxTourPage === tourPages.length - 1) {
                finishTour();
            } else {
                idxTourPage += 1;
                renderDialog();
            }
        });

        window.addEventListener("resize", () => {
            if (idxTourPage >= 0) positionDialog(tourPages[idxTourPage].target);            
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && idxTourPage >= 0) finishTour();            
        });

        update();
        window.requestAnimationFrame(startTour);
    })
    .catch(error => {console.error(error);});
