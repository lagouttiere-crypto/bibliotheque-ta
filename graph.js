// graph.js — module ES
// Dépendances attendues sur window : docs, notesTagsState

export function renderNotesGraph(targetContainerId) {
  const graphId = targetContainerId || ('notes-graph-' + Date.now());
  const tagged = Object.entries(window.notesTagsState || {}).filter(([id, tags]) => tags.length > 0);

  if (tagged.length < 2) {
    return `<span class="myspace-empty">Ajoute des #tags dans tes notes pour voir les connexions apparaître.</span>`;
  }

  const nodes = tagged.map(([id, tags]) => {
    const d = (window.docs || []).find(doc => String(doc.id) === id);
    return { id, tags, title: d ? d.title : id, author: d ? d.author : '' };
  });

  const edges = [];
  nodes.forEach((a, i) => {
    nodes.forEach((b, j) => {
      if (j <= i) return;
      const shared = a.tags.filter(t => b.tags.includes(t));
      if (shared.length > 0) edges.push({ source: a.id, target: b.id, shared });
    });
  });

  if (!targetContainerId) {
    setTimeout(() => _initNotesGraph(graphId), 50);
    return `
      <div style="position:relative">
        <div id="${graphId}" style="width:100%;min-height:260px;border:1px solid var(--border);background:var(--cream)"></div>
        <button class="graph-zoom-btn" onclick="openGraphModal()" title="Agrandir">⊕</button>
      </div>`;
  } else {
    setTimeout(() => _initNotesGraph(graphId), 50);
    return `<div id="${graphId}" style="width:100%;height:100%;background:var(--cream)"></div>`;
  }
}

export function _initNotesGraph(graphId) {
  const container = document.getElementById(graphId);
  if (!container) return;
  const W = container.offsetWidth || 300;
  const H = container.offsetHeight || 260;

  const tagged = Object.entries(window.notesTagsState || {}).filter(([id, tags]) => tags.length > 0);
  const nodes = tagged.map(([id, tags]) => {
    const d = (window.docs || []).find(doc => String(doc.id) === id);
    return { id, tags, title: d ? d.title : id, author: d ? d.author : '' };
  });
  const edges = [];
  nodes.forEach((a, i) => {
    nodes.forEach((b, j) => {
      if (j <= i) return;
      const shared = a.tags.filter(t => b.tags.includes(t));
      if (shared.length > 0) edges.push({ source: a.id, target: b.id, shared });
    });
  });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.style.display = 'block';
  container.appendChild(svg);

  if (!window.d3) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
    script.onload = () => _initGraph(svg, nodes, edges, W, H);
    document.head.appendChild(script);
  } else {
    _initGraph(svg, nodes, edges, W, H);
  }
}

function _initGraph(svg, nodes, edges, W, H) {
  const d3svg = d3.select(svg);

  const nodeData = nodes.map(n => ({ ...n }));
  const linkData = edges.map(e => ({
    source: nodeData.find(n => n.id === e.source),
    target: nodeData.find(n => n.id === e.target),
    shared: e.shared
  }));

  const simulation = d3.forceSimulation(nodeData)
    .force('link', d3.forceLink(linkData).distance(80).strength(1))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(W/2, H/2))
    .force('collision', d3.forceCollide(25))
    .alphaDecay(0.005)
    .alphaMin(0.001)
    .alpha(1);

  const link = d3svg.append('g').selectAll('line')
    .data(linkData).join('line')
    .attr('stroke', 'var(--accent)')
    .attr('stroke-width', 0.8)
    .attr('opacity', 0.3);

  const node = d3svg.append('g').selectAll('g')
    .data(nodeData).join('g')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    )
    .on('click', (event, d) => { window.closeGraphModal?.(); window.closeMySpace?.(); window.openReader?.(parseInt(d.id)); });
  node.append('circle')
    .attr('r', 8)
    .attr('fill', 'var(--accent-light)')
    .attr('stroke', 'var(--accent)')
    .attr('stroke-width', 1);

  node.append('text')
    .text(d => d.title.split(' ').slice(0, 2).join(' '))
    .attr('text-anchor', 'middle')
    .attr('dy', 20)
    .style('font-size', '9px')
    .style('fill', 'var(--ink-light)')
    .style('font-family', "'DM Sans', sans-serif")
    .style('pointer-events', 'none');

  node.append('title').text(d => d.title + '\n' + d.tags.join(' '));

  simulation.on('tick', () => {
    link
      .attr('x1', d => Math.max(10, Math.min(W-10, d.source.x)))
      .attr('y1', d => Math.max(10, Math.min(H-10, d.source.y)))
      .attr('x2', d => Math.max(10, Math.min(W-10, d.target.x)))
      .attr('y2', d => Math.max(10, Math.min(H-10, d.target.y)));
    node.attr('transform', d =>
      `translate(${Math.max(10, Math.min(W-10, d.x))},${Math.max(10, Math.min(H-10, d.y))})`
    );
  });
  simulation.alpha(1).restart();
}

export function openGraphModal() {
  const modal = document.getElementById('graphModalOverlay');
  const body  = document.getElementById('graphModalBody');
  body.innerHTML = renderNotesGraph('graph-modal-canvas');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeGraphModal(e) {
  if (e && e.type === 'click' && e.target !== document.getElementById('graphModalOverlay')) return;
  document.getElementById('graphModalOverlay').classList.remove('open');
  document.getElementById('graphModalBody').innerHTML = '';
  document.body.style.overflow = '';
}

// Exposition sur window
window.renderNotesGraph = renderNotesGraph;
window.openGraphModal   = openGraphModal;
window.closeGraphModal  = closeGraphModal;