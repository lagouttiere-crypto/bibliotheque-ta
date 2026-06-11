// assignation.js — module ES
// Dépendances : window.docs, window.currentUser, window.SHEET_URL, window.groupesState

let assignationsState = {}; // { docId: { hidden, accessGroup, openDate } }

export function loadAssignations() {
  const docs = window.docs || [];
  assignationsState = {};
  docs.forEach(d => {
    assignationsState[d.id] = {
      hidden:      d.hidden      || "",
      accessGroup: d.accessGroup || "",
      openDate:    d.openDate    || ""
    };
  });
  renderAssignationPanel();
}

export function renderAssignationPanel() {
  const container = document.getElementById("ms-panel-assignation");
  if (!container) return;
  const docs = window.docs || [];
  const groupes = (window.groupesState || []).filter(g => !g.id.startsWith("a"));

  let html = `
    <div style="margin-bottom:16px">
      <input type="text" id="assignation-search"
        placeholder="Filtrer les documents…"
        oninput="window._filterAssignation()"
        style="width:100%;border:1px solid var(--border);background:var(--white);padding:8px 10px;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--ink);outline:none" />
    </div>
    <div id="assignation-list">`;

  docs.forEach(d => {
    const state = assignationsState[d.id] || {};
    const isHidden = state.hidden === "1";
    const accessGroup = state.accessGroup || "";
    const openDate = state.openDate || "";
    const groupIds = accessGroup ? accessGroup.split("|").map(g => g.trim()).filter(Boolean) : [];

    html += `
      <div class="assignation-row" id="arow-${d.id}" data-title="${(d.title||'').toLowerCase()}" data-author="${(d.author||'').toLowerCase()}">
        <div class="assignation-doc-info">
          <div class="assignation-doc-title">${d.title}</div>
          <div class="assignation-doc-author">${d.author || ''}</div>
        </div>
        <div class="assignation-controls">

          <label class="assignation-toggle" title="Masquer du catalogue">
            <input type="checkbox" ${isHidden ? 'checked' : ''}
              onchange="window._setHidden(${d.id}, this.checked)" />
            <span>Masqué</span>
          </label>

          <div class="assignation-groups">
            ${groupes.length === 0
              ? '<span style="font-size:11px;color:var(--ink-faint);font-style:italic">Aucun groupe</span>'
              : groupes.map(g => `
                  <label class="assignation-toggle" title="Restreindre au groupe ${g.nom}">
                    <input type="checkbox" ${groupIds.includes(g.id) ? 'checked' : ''}
                      onchange="window._toggleGroup(${d.id}, '${g.id}', this.checked)" />
                    <span>${g.nom}</span>
                  </label>`).join('')
            }
          </div>

          <div class="assignation-date-wrap">
            <label style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-faint);display:block;margin-bottom:3px">Ouverture auto</label>
            <input type="date" value="${openDate}"
              onchange="window._setOpenDate(${d.id}, this.value)"
              style="border:1px solid var(--border);background:var(--white);padding:5px 8px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--ink);outline:none" />
            ${openDate ? `<button onclick="window._setOpenDate(${d.id},'')"
              style="margin-left:4px;background:none;border:none;cursor:pointer;font-size:11px;color:var(--ink-faint)">✕</button>` : ''}
          </div>

        </div>
        <div class="assignation-status" id="astatus-${d.id}">
          ${_buildStatusBadge(isHidden, groupIds, openDate, groupes)}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function _buildStatusBadge(isHidden, groupIds, openDate, groupes) {
  const parts = [];
  if (isHidden) parts.push(`<span class="assignation-badge badge-hidden">Masqué</span>`);
  groupIds.forEach(gid => {
    const g = groupes.find(x => x.id === gid);
    if (g) parts.push(`<span class="assignation-badge badge-group">${g.nom}</span>`);
  });
  if (openDate) parts.push(`<span class="assignation-badge badge-date">↗ ${openDate}</span>`);
  if (parts.length === 0) parts.push(`<span class="assignation-badge badge-open">Ouvert</span>`);
  return parts.join(' ');
}

async function _saveAssignation(docId) {
  const state = assignationsState[docId] || {};
  const url = `${window.SHEET_URL}?sheet=catalogue&action=update_assignation`
    + `&doc_id=${docId}`
    + `&hidden=${encodeURIComponent(state.hidden || "")}`
    + `&accessGroup=${encodeURIComponent(state.accessGroup || "")}`
    + `&openDate=${encodeURIComponent(state.openDate || "")}`;
  const statusEl = document.getElementById("astatus-" + docId);
  if (statusEl) statusEl.innerHTML = `<span style="font-size:11px;color:var(--ink-faint);font-style:italic">Sauvegarde…</span>`;
  try {
    await fetch(url);
    const groupes = (window.groupesState || []).filter(g => !g.id.startsWith("a"));
    const s = assignationsState[docId] || {};
    const groupIds = s.accessGroup ? s.accessGroup.split("|").filter(Boolean) : [];
    if (statusEl) statusEl.innerHTML = _buildStatusBadge(s.hidden === "1", groupIds, s.openDate || "", groupes);
    // Mettre à jour window.docs en mémoire
    const d = (window.docs || []).find(d => d.id === docId);
    if (d) {
      d.hidden = s.hidden;
      d.accessGroup = s.accessGroup;
      d.openDate = s.openDate;
    }
  } catch(err) {
    if (statusEl) statusEl.innerHTML = `<span style="font-size:11px;color:#B75D4A">Erreur</span>`;
    console.warn("Erreur sauvegarde assignation", err);
  }
}

// Exposition sur window
window._setHidden = (docId, checked) => {
  if (!assignationsState[docId]) assignationsState[docId] = {};
  assignationsState[docId].hidden = checked ? "1" : "";
  _saveAssignation(docId);
};

window._toggleGroup = (docId, groupeId, checked) => {
  if (!assignationsState[docId]) assignationsState[docId] = {};
  const current = assignationsState[docId].accessGroup || "";
  let ids = current ? current.split("|").map(g => g.trim()).filter(Boolean) : [];
  if (checked && !ids.includes(groupeId)) ids.push(groupeId);
  if (!checked) ids = ids.filter(g => g !== groupeId);
  assignationsState[docId].accessGroup = ids.join("|");
  _saveAssignation(docId);
};

window._setOpenDate = (docId, val) => {
  if (!assignationsState[docId]) assignationsState[docId] = {};
  assignationsState[docId].openDate = val;
  _saveAssignation(docId);
  renderAssignationPanel();
};

window._filterAssignation = () => {
  const q = (document.getElementById("assignation-search")?.value || "").toLowerCase();
  document.querySelectorAll(".assignation-row").forEach(row => {
    const title = row.dataset.title || "";
    const author = row.dataset.author || "";
    row.style.display = (!q || title.includes(q) || author.includes(q)) ? "" : "none";
  });
};

window.loadAssignations  = loadAssignations;
window.renderAssignationPanel = renderAssignationPanel;