function _1(colorout, colorin, md) {
    return md`
      This chart shows relationships among universities. Hover over a university to reveal its faculty placements.`
  }
  
function chart(d3, bilink, data, id, colornone, colorin, colorout) {
    const width = 1000;
    const height = 800;
    const radius = width / 2.3;
    
    // arc size
    const arc = d3.arc()
    .innerRadius(radius - 120)
    .outerRadius(radius - 100);

    const tree = d3.cluster()
      .size([2 * Math.PI, radius - 100]);
    const root = tree(bilink(d3.hierarchy(data)
      .sort((a, b) => d3.ascending(a.height, b.height) || d3.ascending(a.data.name, b.data.name))));
  
    const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -width / 2, width, width])
      .attr("style", "max-width: 1000px; height: 1000px; font: 10px Barlow Condensed;"); //change SVG
  
    const node = svg.append("g")
      .selectAll()
      .data(root.leaves())
      .join("g")
        .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
      .append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d.x < Math.PI ? 6 : -6)
        .attr("text-anchor", d => d.x < Math.PI ? "start" : "end")
        .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
        .text(d => d.data.name)
        //.attr("fill", d => colorScale(d.continent))
        .each(function(d) { d.text = this; })
        .on("mouseover", overed)
        .on("mouseout", outed)
        .call(text => text.append("title").text(d => `${id(d)}
        ${d.outgoing.length} outgoing
        ${d.incoming.length} incoming`));
  
    const line = d3.lineRadial()
      .curve(d3.curveBundle.beta(0.85))
      .radius(d => d.y)
      .angle(d => d.x);
  
    const link = svg.append("g")
      .attr("stroke", colornone)
      .attr("fill", "none")
      .selectAll()
      .data(root.leaves().flatMap(leaf => leaf.outgoing))
      .join("path")
        .style("mix-blend-mode", "multiply")
        .attr("d", ([i, o]) => line(i.path(o)))
        .each(function(d) { d.path = this; });

        function updateLinks() {
          const showIncoming = document.getElementById('filter-incoming').checked;
          const showOutgoing = document.getElementById('filter-outgoing').checked;
  
          link.attr("visibility", d => {
              const isIncoming = d[1].incoming.some(([source, target]) => target === d[1]);
              const isOutgoing = d[1].outgoing.some(([source, target]) => source === d[1]);
  
              if (showIncoming && isIncoming) {
                  return "visible";
              }
              if (showOutgoing && isOutgoing) {
                  return "visible";
              }
              return "hidden";
          });
      }
  
    document.getElementById('filter-incoming').addEventListener('change', updateLinks);
    document.getElementById('filter-outgoing').addEventListener('change', updateLinks);
  
    function overed(event, d) {
      link.style("mix-blend-mode", null);
      d3.select(this).attr("font-weight", "bold");
      d3.selectAll(d.incoming.map(d => d.path)).attr("stroke", colorin).raise();
      d3.selectAll(d.incoming.map(([d]) => d.text)).attr("fill", colorin).attr("font-weight", "bold");
      d3.selectAll(d.outgoing.map(d => d.path)).attr("stroke", colorout).raise();
      d3.selectAll(d.outgoing.map(([, d]) => d.text)).attr("fill", colorout).attr("font-weight", "bold");
    }
  
    function outed(event, d) {
      link.style("mix-blend-mode", "multiply");
      d3.select(this).attr("font-weight", null);
      d3.selectAll(d.incoming.map(d => d.path)).attr("stroke", null);
      d3.selectAll(d.incoming.map(([d]) => d.text)).attr("fill", null).attr("font-weight", null);
      d3.selectAll(d.outgoing.map(d => d.path)).attr("stroke", null);
      d3.selectAll(d.outgoing.map(([, d]) => d.text)).attr("fill", null).attr("font-weight", null);
    }
  
    return svg.node();
  }
  
async function data(hierarchy, FileAttachment) {
    // return hierarchy(await FileAttachment("./uni-edge.json").json());
    const file = await FileAttachment("./uni-edge.json").json();

    // Check if the file was loaded correctly and is not undefined or empty
    if (!file) {
      throw new Error("Failed to load uni-edge.json or the file is empty.");
    }

    // Log the file content to inspect its structure and ensure it's correct
    console.log("Loaded data:", file);

    // Now process the data using the hierarchy function
    return hierarchy(file);
  }
  
function hierarchy() {
    return function hierarchy(data, delimiter = ".") {
      let root;
      const map = new Map;
      data.forEach(function find(data) {
        const {name} = data;
        if (map.has(name)) return map.get(name);
        const i = name.lastIndexOf(delimiter);
        map.set(name, data);
        if (i >= 0) {
          find({name: name.substring(0, i), children: []}).children.push(data);
          data.name = name.substring(i + 1);
        } else {
          root = data;
        }
        return data;
      });
      return root;
    }
  }

// Define the color scale based on continents
// const colorScale = d3.scaleOrdinal()
//   .domain(["Asia", "Europe", "North America", "Oceania", "Africa", "South America"])
//   .range(["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f"]);

// Function to split name into Continent, Country, and School
function splitGeojsonName(name) {
  const parts = name.split(".");
  return {
    continent: parts[1], // Continent is the second part
    country: parts[2],   // Country is the third part
    school: parts.slice(3).join("."), // The rest is the school name
  };
}

function bilink(id) {
    return function bilink(root) {
      const map = new Map(root.leaves().map(d => [id(d), d]));
      for (const d of root.leaves()) {
        d.incoming = [];
        // Use splitGeojsonName to get the continent
        const splitName = splitGeojsonName(d.data.name);
        d.continent = splitName.continent;

        d.outgoing = d.data.imports.map(i => [d, map.get(i)]).filter(([, target]) => target);
      }
      for (const d of root.leaves()) {
        for (const o of d.outgoing) {
          if (o[1]) { // Check if target node exists
            o[1].incoming.push(o);
          }
        }
      }
      return root;
    }
  }


// Define the color scale
// const colorScale = d3.scaleOrdinal()
//   .domain(["Asia", "Europe", "North America", "Oceania"]) 
//   .range(["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3"]); 


function id() {
    return function id(node) {
      return `${node.parent ? id(node.parent) + "." : ""}${node.data.name}`;
    }
  }
  
function colorin() {
    return "#16537e";
  }
  
function colorout() {
    return "#e06666";
  }
  
function colornone() {
    return "#ccc";
  }
  

export default function define(runtime, observer) {
    const main = runtime.module();
    function toString() { return this.url; }
    const fileAttachments = new Map([
      ["uni-edge.json", {url: new URL("uni-edge.json", import.meta.url), mimeType: "application/json", toString}]
    ]);
    main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
    main.variable(observer()).define(["colorout","colorin","md"], _1);
    main.variable(observer("chart")).define("chart", ["d3","bilink","data","id","colornone","colorin","colorout"], chart);
    main.variable(observer("data")).define("data", ["hierarchy","FileAttachment"], data);
    main.variable(observer("hierarchy")).define("hierarchy", hierarchy);
    main.variable(observer("bilink")).define("bilink", ["id"], bilink);
    main.variable(observer("id")).define("id", id);
    main.variable(observer("colorin")).define("colorin", colorin);
    main.variable(observer("colorout")).define("colorout", colorout);
    main.variable(observer("colornone")).define("colornone", colornone);
    return main;
  }

