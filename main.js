const P_RANGE = [13, 23];
const R_RANGE = [5, 12];

const P_BREAKS = [14.4, 18, 21.6];
const R_BREAKS = [6.15, 8.2, 10.3];

const tooltip = d3.select("#tooltip");
const rangeNote = d3.select("#range-note");

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

function render() {
  const container = d3.select("#chart");
  container.selectAll("*").remove();

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
  const sumMin = minKp + minKr;
  const sumMax = maxKp + maxKr;
  rangeNote.text(
    `Raw K_sum range in this view: ${formatPct(sumMin, 1)} to ${formatPct(
      sumMax,
      1
    )}.`
  );

  const color = d3
    .scaleSequential(d3.interpolateTurbo)
    .domain([sumMin, sumMax]);

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
      const sum = kP(p) + kR(r);
      values[idx] = sum;
      const c = d3.rgb(color(sum));
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
    Math.ceil((sumMin + Number.EPSILON) / contourStep) * contourStep;
  const contourStop =
    Math.floor((sumMax - Number.EPSILON) / contourStep) * contourStep;
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
    .text((d) => `${d.value}%`);

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
    const value = sumMin + (sumMax - sumMin) * t;
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
          d3.scaleLinear().domain([sumMin, sumMax]).range([0, legendWidth])
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
      const sum = kp + kr;

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
            `K(П): ${formatPct(kp, 2)}<br/>` +
            `K(R): ${formatPct(kr, 2)}<br/>` +
            `K_sum: ${formatPct(sum, 2)}`
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

render();
window.addEventListener("resize", render);
