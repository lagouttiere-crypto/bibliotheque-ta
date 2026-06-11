// assignation.js — module ES
// Dépendances : window.docs, window.currentUser, window.SHEET_URL, window.groupesState

let assignationsState = {};

export function loadAssignations() {
  const docs = window.docs || [];
  assignationsState = {};
  docs.forEach(d => {
    assignationsState[d.id] = {
      statut:        d.statut        || "",
      groupedoc:     d.groupedoc     || "",
      dateouverture: d.dateouverture || ""
    };
  });
  renderAssignationPanel();
}

export function renderAssignationPanel() {
  const container = document.getElementById("ms-panel-assignation");
  if (!container) return;
  const docs   = window.docs || [];
  const groupes = (window.groupesState || []).filter(g => !g.id.startsWith("a"));
  const projets = (window.groupesState || []).filter(g => g.id.startsWith("a"));
  console.log("projets docs:", projets.map(p => p.nom + ':' + JSON.stringify(p.docs)));
  const now    = new Date();
  console.log("groupes filtrés:", groupes.length, groupes.map(g => g.nom));

  // Classer les docs en 4 catégories
  const masques   = [];
  const restreints = [];
  const enAttente = [];
  const enProjet   = [];
  const ouverts   = [];

  docs.forEach(d => {
    const state = assignationsState[d.id] || {};
    const isPrive = state.statut === "prive";
    const groupedoc = state.groupedoc || d.groupe_id || "";
    const dateouverture = state.dateouverture || "";
    const groupIds = groupedoc ? groupedoc.split("|").map(g => g.trim()).filter(Boolean) : [];
    const dateFuture = dateouverture && new Date(dateouverture) > now;

    if (isPrive) {
      masques.push({ d, state, groupIds, dateouverture });
    } else if (dateFuture) {
      enAttente.push({ d, state, groupIds, dateouverture });
    } else if (groupIds.length > 0) {
      restreints.push({ d, state, groupIds, dateouverture });
    } else {
      const dansProjet = projets.some(p => p.docs.includes(String(d.id)));
      if (dansProjet) {
        enProjet.push({ d, state, groupIds, dateouverture });
      } else {
        ouverts.push({ d, state, groupIds, dateouverture });
      }
    }
  });

  const renderSection = (titre, items, badgeClass, badgeLabel, showEdit = true) => {
    if (items.length === 0) return `
      <div class="statut-section">
        <div class="statut-section-header">
          <span class="assignation-badge ${badgeClass}">${badgeLabel}</span>
          <span class="statut-count">0 document</span>
        </div>
      </div>`;

    return `
      <div class="statut-section">
        <div class="statut-section-header">
          <span class="assignation-badge ${badgeClass}">${badgeLabel}</span>
          <span class="statut-count">${items.length} document${items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="statut-section-body">
          ${items.map(({ d, state, groupIds, dateouverture }) => `
            <div class="statut-doc-row" id="arow-${d.id}"
              data-title="${(d.title||'').toLowerCase()}"
              data-author="${(d.author||'').toLowerCase()}">
              <div class="assignation-doc-info">
                <div class="assignation-doc-title">${d.title}</div>
                <div class="assignation-doc-author">${d.author || ''}</div>
              </div>
              ${showEdit ? `
              <div class="assignation-controls">
                <label class="assignation-toggle">
                  <input type="checkbox" ${state.statut === "prive" ? 'checked' : ''}
                    onchange="window._setStatut(${d.id}, this.checked)" />
                  <span>Masqué</span>
                </label>
                <div class="assignation-groups">
                  ${groupes.length === 0
                    ? '<span style="font-size:11px;color:var(--ink-faint);font-style:italic">Aucun groupe</span>'
                    : groupes.map(g => `
                        <label class="assignation-toggle">
                          <input type="checkbox" ${groupIds.includes(g.id) ? 'checked' : ''}
                            onchange="window._toggleGroup(${d.id}, '${g.id}', this.checked)" />
                          <span>${g.nom}</span>
                        </label>`).join('')
                  }
                </div>
                <div class="assignation-date-wrap">
                  <label style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-faint);display:block;margin-bottom:3px">Ouverture auto</label>
                  <div style="display:flex;align-items:center;gap:4px">
                    <input type="date" value="${dateouverture}"
                      onchange="window._setDateOuverture(${d.id}, this.value)"
                      style="border:1px solid var(--border);background:var(--white);padding:5px 8px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--ink);outline:none" />
                    ${dateouverture ? `<button onclick="window._setDateOuverture(${d.id}, &quot;&quot;)"
                      style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--ink-faint)">✕</button>` : ''}
                  </div>
                </div>
              </div>
              <div class="assignation-status" id="astatus-${d.id}">
                ${_buildStatusBadge(state.statut === "prive", groupIds, dateouverture, groupes)}
              </div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  };

  let html = `
    <div style="margin-bottom:16px">
      <input type="text" id="assignation-search"
        placeholder="Filtrer les documents…"
        oninput="window._filterAssignation()"
        style="width:100%;border:1px solid var(--border);background:var(--white);padding:8px 10px;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--ink);outline:none" />
    </div>
    <div id="assignation-list">
      ${renderSection('Masqués',            masques,    'badge-prive',  'Masqués')}
      ${renderSection('En attente',         enAttente,  'badge-date',   'En attente')}
      ${renderSection('Restreints',         restreints, 'badge-group',  'Restreints')}
      ${renderSection('Projets',            enProjet,   'badge-prive',  'Projets',  false)}
      ${renderSection('Ouverts',            ouverts,    'badge-open',   'Ouverts',  true)}
    </div>`;
  console.log("masqués:", masques.length, "enAttente:", enAttente.length, "restreints:", restreints.length, "ouverts:", ouverts.length);
  container.innerHTML = html;
}

function _buildStatusBadge(isPrive, groupIds, dateouverture, groupes) {
  const parts = [];
  if (isPrive) parts.push(`<span class="assignation-badge badge-prive">Masqué</span>`);
  groupIds.forEach(gid => {
    const g = groupes.find(x => x.id === gid);
    if (g) parts.push(`<span class="assignation-badge badge-group">${g.nom}</span>`);
  });
  if (dateouverture) parts.push(`<span class="assignation-badge badge-date">↗ ${dateouverture}</span>`);
  if (parts.length === 0) parts.push(`<span class="assignation-badge badge-open">Ouvert</span>`);
  return parts.join(' ');
}

async function _saveAssignation(docId) {
  const state = assignationsState[docId] || {};
  const url = `${window.SHEET_URL}?sheet=catalogue&action=update_assignation`
    + `&doc_id=${docId}`
    + `&statut=${encodeURIComponent(state.statut || "")}`
    + `&groupedoc=${encodeURIComponent(state.groupedoc || "")}`
    + `&dateouverture=${encodeURIComponent(state.dateouverture || "")}`;
  const statusEl = document.getElementById("astatus-" + docId);
  if (statusEl) statusEl.innerHTML = `<span style="font-size:11px;color:var(--ink-faint);font-style:italic">Sauvegarde…</span>`;
  try {
    await fetch(url);
    const groupes = (window.groupesState || []).filter(g => !g.id.startsWith("a"));
    const s = assignationsState[docId] || {};
    const groupIds = s.groupedoc ? s.groupedoc.split("|").filter(Boolean) : [];
    if (statusEl) statusEl.innerHTML = _buildStatusBadge(s.statut === "prive", groupIds, s.dateouverture || "", groupes);
    const d = (window.docs || []).find(doc => doc.id === docId);
    if (d) {
      d.statut        = s.statut;
      d.groupedoc     = s.groupedoc;
      d.dateouverture = s.dateouverture;
    }
    renderAssignationPanel();
  } catch(err) {
    if (statusEl) statusEl.innerHTML = `<span style="font-size:11px;color:#B75D4A">Erreur</span>`;
    console.warn("Erreur sauvegarde assignation", err);
  }
}

window._setStatut = (docId, checked) => {
  if (!assignationsState[docId]) assignationsState[docId] = {};
  assignationsState[docId].statut = checked ? "prive" : "";
  _saveAssignation(docId);
};

window._toggleGroup = (docId, groupeId, checked) => {
  if (!assignationsState[docId]) assignationsState[docId] = {};
  const current = assignationsState[docId].groupedoc || "";
  let ids = current ? current.split("|").map(g => g.trim()).filter(Boolean) : [];
  if (checked && !ids.includes(groupeId)) ids.push(groupeId);
  if (!checked) ids = ids.filter(g => g !== groupeId);
  assignationsState[docId].groupedoc = ids.join("|");
  _saveAssignation(docId);
};

window._setDateOuverture = (docId, val) => {
  if (!assignationsState[docId]) assignationsState[docId] = {};
  assignationsState[docId].dateouverture = val;
  _saveAssignation(docId);
};

window._filterAssignation = () => {
  const q = (document.getElementById("assignation-search")?.value || "").toLowerCase();
  document.querySelectorAll(".statut-doc-row").forEach(row => {
    const title  = row.dataset.title  || "";
    const author = row.dataset.author || "";
    row.style.display = (!q || title.includes(q) || author.includes(q)) ? "" : "none";
  });
};

window.loadAssignations       = loadAssignations;
window.renderAssignationPanel = renderAssignationPanel;