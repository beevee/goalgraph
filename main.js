const P_RANGE = [13, 23];
const R_RANGE = [5, 12];

const P_BREAKS = [14.4, 18, 21.6];
const R_BREAKS = [6.15, 8.2, 10.3];

const tooltip = d3.select("#tooltip");
const rangeNote = d3.select("#range-note");
const weightPInput = d3.select("#weight-p");
const weightRInput = d3.select("#weight-r");
const weightPValue = d3.select("#weight-p-value");
const weightRValue = d3.select("#weight-r-value");

const STORAGE_KEY_P = "goalgraph.weightP";
const STORAGE_KEY_R = "goalgraph.weightR";

function kP(p) {
  if (p < 14.4) return 0;
  if (p <= 18) return 80 + ((p - 14.4) / 3.6) * 20;
  if (p <= 21.6) return 100 + ((p - 18) / 3.6) * 20;
  return 120;
}

function kR(r) {
  if (r < 6.15) return 0;
  if (r <= 8.2) return 75 + ((r - 6.15) / 2.05) * 25;
  if (r <= 10.3) return 100 + ((r - 8.2) / 2.1) * 25;
  return 125;
}

function extremes(range, breaks, fn) {
  const values = [range[0], range[1], ...breaks].filter(
    (v) => v >= range[0] && v <= range[1]
  );
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    const val = fn(v);
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return { min, max };
}

function formatPct(value, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

function formatUnit(value, digits = 3) {
  return value.toFixed(digits);
}

function readWeight(input, fallback) {
  const value = Number.parseFloat(input.property("value"));
  if (Number.isFinite(value)) return value;
  return fallback;
}

function loadStoredWeights() {
  const storedP = Number.parseFloat(localStorage.getItem(STORAGE_KEY_P));
  const storedR = Number.parseFloat(localStorage.getItem(STORAGE_KEY_R));
  if (Number.isFinite(storedP)) weightPInput.property("value", storedP);
  if (Number.isFinite(storedR)) weightRInput.property("value", storedR);
}

function storeWeights(weightP, weightR) {
  localStorage.setItem(STORAGE_KEY_P, weightP.toString());
  localStorage.setItem(STORAGE_KEY_R, weightR.toString());
}

function render() {
  const container = d3.select("#chart");
  container.selectAll("*").remove();

  const weightP = readWeight(weightPInput, 0.5);
  const weightR = readWeight(weightRInput, 0.5);
  storeWeights(weightP, weightR);
  weightPValue.text(weightP.toFixed(2));
  weightRValue.text(weightR.toFixed(2));

  const outerWidth = Math.min(1000, container.node().clientWidth || 900);
  const outerHeight = Math.round(outerWidth * 0.58);

  const margin = { top: 70, right: 28, bottom: 52, left: 60 };
  const innerWidth = Math.round(
    Math.max(320, outerWidth - margin.left - margin.right)
  );
  const innerHeight = Math.round(
    Math.max(240, outerHeight - margin.top - margin.bottom)
  );

  const plot = container
    .append("div")
    .attr("class", "plot")
    .style("width", `${outerWidth}px`)
    .style("height", `${outerHeight}px`);

  const canvas = plot
    .append("canvas")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .style("left", `${margin.left}px`)
    .style("top", `${margin.top}px`);

  const svg = plot
    .append("svg")
    .attr("width", outerWidth)
    .attr("height", outerHeight);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain(P_RANGE).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain(R_RANGE).range([innerHeight, 0]);

  const xAxis = d3
    .axisBottom(xScale)
    .ticks(6)
    .tickFormat((d) => `${d}%`);

  const yAxis = d3
    .axisLeft(yScale)
    .ticks(6)
    .tickFormat((d) => `${d}%`);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g").attr("class", "axis").call(yAxis);

  g.append("text")
    .attr("class", "label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .text("П (%)");

  g.append("text")
    .attr("class", "label")
    .attr("x", -innerHeight / 2)
    .attr("y", -44)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("R (%)");

  const { min: minKp, max: maxKp } = extremes(P_RANGE, P_BREAKS, kP);
  const { min: minKr, max: maxKr } = extremes(R_RANGE, R_BREAKS, kR);
  const sumRawMin = minKp + minKr;
  const sumRawMax = maxKp + maxKr;

  const sumWeightedMin = (minKp / 100) * weightP + (minKr / 100) * weightR;
  const sumWeightedMax = (maxKp / 100) * weightP + (maxKr / 100) * weightR;
  const sumWeightedSpan = sumWeightedMax - sumWeightedMin;

  const scaleToRaw =
    sumWeightedSpan === 0
      ? () => sumRawMin
      : d3
          .scaleLinear()
          .domain([sumWeightedMin, sumWeightedMax])
          .range([sumRawMin, sumRawMax]);
  const scaleToWeighted =
    sumRawMax === sumRawMin
      ? () => sumWeightedMin
      : d3
          .scaleLinear()
          .domain([sumRawMin, sumRawMax])
          .range([sumWeightedMin, sumWeightedMax]);

  rangeNote.text(
    `Weighted K_sum range: ${formatUnit(sumWeightedMin)} to ${formatUnit(
      sumWeightedMax
    )}. Colors/contours scaled to ${formatPct(sumRawMin, 1)}–${formatPct(
      sumRawMax,
      1
    )}.`
  );

  const colorMax = Math.max(sumRawMax, 200);
  const color = d3
    .scaleLinear()
    .domain([0, 150, 200, colorMax])
    .range(["#0b1d4a", "#f6d84c", "#3fb950", "#0b6e2b"])
    .clamp(true);

  const ctx = canvas.node().getContext("2d", { alpha: false });
  const width = innerWidth;
  const height = innerHeight;

  const values = new Float32Array(width * height);
  const image = ctx.createImageData(width, height);
  const data = image.data;

  let idx = 0;
  for (let y = 0; y < height; y += 1) {
    const r = R_RANGE[1] - (y / (height - 1)) * (R_RANGE[1] - R_RANGE[0]);
    for (let x = 0; x < width; x += 1) {
      const p = P_RANGE[0] + (x / (width - 1)) * (P_RANGE[1] - P_RANGE[0]);
      const sumWeighted =
        (kP(p) / 100) * weightP + (kR(r) / 100) * weightR;
      const sumScaled = scaleToRaw(sumWeighted);
      values[idx] = sumScaled;
      const c = d3.rgb(color(sumScaled));
      const offset = idx * 4;
      data[offset] = c.r;
      data[offset + 1] = c.g;
      data[offset + 2] = c.b;
      data[offset + 3] = 255;
      idx += 1;
    }
  }

  ctx.putImageData(image, 0, 0);

  const contourStep = 10;
  const contourStart =
    Math.ceil((sumRawMin + Number.EPSILON) / contourStep) * contourStep;
  const contourStop =
    Math.floor((sumRawMax - Number.EPSILON) / contourStep) * contourStep;
  const contourLevels =
    contourStart <= contourStop
      ? d3.range(contourStart, contourStop + contourStep, contourStep)
      : [];

  const contours = d3
    .contours()
    .size([width, height])
    .thresholds(contourLevels)(values);

  const contourPath = d3.geoPath();

  g.append("g")
    .attr("class", "contours")
    .selectAll("path")
    .data(contours)
    .join("path")
    .attr("class", (d) => (d.value === 200 ? "contour contour-200" : "contour"))
    .attr("d", contourPath);

  function topIntersections(contour) {
    const hits = [];
    contour.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        for (let i = 1; i < ring.length; i += 1) {
          const [x0, y0] = ring[i - 1];
          const [x1, y1] = ring[i];
          const dy = y1 - y0;
          if (Math.abs(y0) < 0.5 && Math.abs(y1) < 0.5) {
            hits.push(x0, x1);
          } else if ((y0 <= 0 && y1 >= 0) || (y1 <= 0 && y0 >= 0)) {
            if (Math.abs(dy) > 1e-6) {
              const t = (0 - y0) / dy;
              if (t >= 0 && t <= 1) {
                hits.push(x0 + (x1 - x0) * t);
              }
            }
          }
        }
      });
    });
    return hits.filter((x) => Number.isFinite(x) && x >= 0 && x <= width);
  }

  const topLabels = contours
    .map((contour) => {
      const hits = topIntersections(contour);
      if (!hits.length) return null;
      const x = d3.min(hits);
      return { x, value: contour.value };
    })
    .filter((d) => d && d.value >= 210)
    .sort((a, b) => a.x - b.x);

  const minLabelSpacing = 24;
  let lastX = -Infinity;
  const filteredLabels = topLabels.filter((label) => {
    if (label.x - lastX < minLabelSpacing) return false;
    lastX = label.x;
    return true;
  });

  g.append("g")
    .attr("class", "contour-top-labels")
    .selectAll("text")
    .data(filteredLabels)
    .join("text")
    .attr("class", "contour-top-label")
    .attr("x", (d) => d.x + 20)
    .attr("y", 6)
    .text((d) => formatUnit(scaleToWeighted(d.value), 2));

  const label200 = contours
    .map((contour) => {
      if (contour.value !== 200) return null;
      const hits = topIntersections(contour);
      if (!hits.length) return null;
      const x = d3.min(hits);
      return { x, value: contour.value };
    })
    .filter(Boolean);

  if (label200.length) {
    g.append("g")
      .attr("class", "contour-top-labels")
      .selectAll("text")
      .data(label200)
      .join("text")
      .attr("class", "contour-top-label")
      .attr("x", (d) => d.x + 20)
      .attr("y", 6)
      .text((d) => formatUnit(scaleToWeighted(d.value), 2));
  }

  const guides = g.append("g").attr("class", "guides");

  P_BREAKS.filter((p) => p >= P_RANGE[0] && p <= P_RANGE[1]).forEach((p) => {
    guides
      .append("line")
      .attr("x1", xScale(p))
      .attr("x2", xScale(p))
      .attr("y1", 0)
      .attr("y2", innerHeight);
  });

  R_BREAKS.filter((r) => r >= R_RANGE[0] && r <= R_RANGE[1]).forEach((r) => {
    guides
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScale(r))
      .attr("y2", yScale(r));
  });

  const legendWidth = 220;
  const legendHeight = 10;
  const legendX = innerWidth - legendWidth;
  const legendY = -44;

  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const legendStops = 10;
  for (let i = 0; i <= legendStops; i += 1) {
    const t = i / legendStops;
    const value = sumRawMin + (sumRawMax - sumRawMin) * t;
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(value));
  }

  g.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#legend-gradient)")
    .attr("rx", 4);

  g.append("g")
    .attr("class", "axis")
    .attr(
      "transform",
      `translate(${legendX},${legendY + legendHeight})`
    )
    .call(
      d3
        .axisBottom(
          d3
            .scaleLinear()
            .domain(
              sumRawMax === sumRawMin
                ? [sumRawMin, sumRawMin + 1]
                : [sumRawMin, sumRawMax]
            )
            .range([0, legendWidth])
        )
        .ticks(5)
        .tickFormat((d) => `${d}%`)
    );

  const crosshairX = g
    .append("line")
    .attr("stroke", "rgba(255,255,255,0.7)")
    .attr("stroke-dasharray", "2 4")
    .style("opacity", 0);

  const crosshairY = g
    .append("line")
    .attr("stroke", "rgba(255,255,255,0.7)")
    .attr("stroke-dasharray", "2 4")
    .style("opacity", 0);

  const overlay = g
    .append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .style("cursor", "crosshair");

  overlay
    .on("mousemove", (event) => {
      const [mx, my] = d3.pointer(event);
      if (mx < 0 || my < 0 || mx > innerWidth || my > innerHeight) {
        tooltip.style("opacity", 0);
        crosshairX.style("opacity", 0);
        crosshairY.style("opacity", 0);
        return;
      }

      const p = xScale.invert(mx);
      const r = yScale.invert(my);
      const kp = kP(p);
      const kr = kR(r);
      const sum = (kp / 100) * weightP + (kr / 100) * weightR;

      crosshairX
        .attr("x1", mx)
        .attr("x2", mx)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .style("opacity", 1);

      crosshairY
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", my)
        .attr("y2", my)
        .style("opacity", 1);

      tooltip
        .style("opacity", 1)
        .html(
          `<strong>П ${formatPct(p, 2)}, R ${formatPct(r, 2)}</strong>` +
            `K(П): ${formatPct(kp, 2)} × ${weightP.toFixed(2)}<br/>` +
            `K(R): ${formatPct(kr, 2)} × ${weightR.toFixed(2)}<br/>` +
            `K_sum: ${formatUnit(sum, 3)}`
        );

      const plotRect = plot.node().getBoundingClientRect();
      tooltip
        .style(
          "left",
          `${plotRect.left + window.scrollX + margin.left + mx}px`
        )
        .style(
          "top",
          `${plotRect.top + window.scrollY + margin.top + my}px`
        );
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
      crosshairX.style("opacity", 0);
      crosshairY.style("opacity", 0);
    });
}

weightPInput.on("input", render);
weightRInput.on("input", render);

loadStoredWeights();
render();
window.addEventListener("resize", render);
