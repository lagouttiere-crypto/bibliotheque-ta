// groupes.js — module ES
// Dépendances attendues sur window : docs, currentUser, SHEET_URL
window.groupesState = [];
let groupesState = window.groupesState;

export async function loadGroupes() {
  try {
    const res  = await fetch(`${window.SHEET_URL}?sheet=groupes&v=${Date.now()}`);
    const rows = await res.json();
    if (Array.isArray(rows)) {
      groupesState = rows.map(r => ({
        id:       String(r.id       || '').trim(),
        nom:      String(r.nom      || '').trim(),
        createur: String(r.createur || '').trim(),
        membres:  String(r.membres  || '').split(',').map(m => m.trim()).filter(Boolean),
        docs:     String(r.docs     || '').split(',').map(d => d.trim()).filter(Boolean),
        mdp:      String(r.mdp      || '').trim(),
        date:     String(r.date     || '').trim(),
      }));
    }
  } catch(e) { console.warn("Groupes non chargés", e); }

  // Ajouter les ateliers de Matthieu à groupesState
  if (window.currentUser === 'Matthieu') {
    try {
      const res2 = await fetch(`${window.SHEET_URL}?sheet=ateliers&owner=Matthieu&v=${Date.now()}`);
      const ateliers = await res2.json();
      if (Array.isArray(ateliers)) {
        ateliers.forEach(a => {
          console.log("atelier docs raw:", a.id, JSON.stringify(a.docs));
          groupesState.push({
            id:       String(a.id    || '').trim(),
            nom:      String(a.titre || '').trim(),
            createur: 'Matthieu',
            membres:  ['Matthieu'],
            docs: (() => { try { const p = JSON.parse(a.docs); return Array.isArray(p) ? p.map(String) : String(a.docs||'').replace(/^'/,'').split(',').map(d=>d.trim()).filter(Boolean); } catch(e) { return String(a.docs||'').replace(/^'/,'').split(',').map(d=>d.trim()).filter(Boolean); } })(),
            date:     String(a.date  || '').trim(),
          });
        });
      }
    } catch(e) { console.warn("Ateliers non chargés dans groupesState", e); }
  }

  window.groupesState = groupesState;
  renderMySpaceGroupes();
}

async function loadGroupNotes(groupeId) {
  try {
    const res  = await fetch(`${window.SHEET_URL}?sheet=notes_groupe&groupe_id=${groupeId}&v=${Date.now()}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    if (!groupNotesState[groupeId]) groupNotesState[groupeId] = {};
    rows.forEach(r => {
      const docId = String(r.doc_id || '').trim();
      if (!groupNotesState[groupeId][docId]) groupNotesState[groupeId][docId] = [];
      groupNotesState[groupeId][docId].push({ auteur: r.auteur, texte: r.texte });
    });
  } catch(e) { console.warn("Notes groupe non chargées", e); }
}

export function onGroupDocSearch() {
  const q = normalizeText(document.getElementById('new-group-docs-search').value);
  const dropdown = document.getElementById('new-group-docs-dropdown');
  if (!q || q.length < 2) { dropdown.classList.remove('open'); return; }
  const docs = window.docs || [];
  const matches = docs.filter(d =>
    !selectedGroupDocs.includes(d.id) &&
    (normalizeText(d.title).includes(q) || normalizeText(d.author || '').includes(q))
  ).slice(0, 8);
  if (matches.length === 0) { dropdown.classList.remove('open'); return; }
  dropdown.innerHTML = matches.map(d => `
    <div class="doc-autocomplete-item" onclick="addGroupDocSelection(${d.id})">
      <div>${d.title}</div>
      <span>${d.author || '—'}</span>
    </div>`).join('');
  dropdown.classList.add('open');
}

export function addGroupDocSelection(id) {
  if (selectedGroupDocs.includes(id)) return;
  selectedGroupDocs.push(id);
  document.getElementById('new-group-docs-search').value = '';
  document.getElementById('new-group-docs-dropdown').classList.remove('open');
  renderGroupDocTags();
}

export function removeGroupDocSelection(id) {
  selectedGroupDocs = selectedGroupDocs.filter(d => d !== id);
  renderGroupDocTags();
}

function renderGroupDocTags() {
  const container = document.getElementById('new-group-docs-tags');
  if (!container) return;
  const docs = window.docs || [];
  container.innerHTML = selectedGroupDocs.map(id => {
    const d = docs.find(doc => doc.id === id);
    if (!d) return '';
    return `<span class="doc-selected-tag">${d.title}<button class="doc-selected-remove" onclick="removeGroupDocSelection(${id})">×</button></span>`;
  }).join('');
}

export async function createGroupe() {
  const nom = document.getElementById('new-group-name').value.trim();
  const mdp = document.getElementById('new-group-mdp').value.trim();
  if (!nom) return;
  const docsStr = selectedGroupDocs.join(',');
  try {
    await fetch(`${window.SHEET_URL}?sheet=groupes&action=create&nom=${encodeURIComponent(nom)}&auteur=${encodeURIComponent(window.currentUser)}&docs=${encodeURIComponent(docsStr)}&mdp=${encodeURIComponent(mdp)}`);
    document.getElementById('new-group-name').value = '';
    document.getElementById('new-group-mdp').value = '';
    selectedGroupDocs = [];
    renderGroupDocTags();
    document.getElementById('myspace-create-form').style.display = 'none';
    await loadGroupes();
  } catch(e) { console.warn("Erreur création groupe", e); }
}

export async function joinGroupe(groupeId) {
  const g = groupesState.find(g => g.id === groupeId);
  if (!g) return;
  if (g.mdp) {
    const saisie = prompt(`Ce groupe est protégé.\nEntrez le mot de passe :`);
    if (saisie === null) return;
    if (saisie.trim() !== g.mdp) { alert("Mot de passe incorrect."); return; }
  }
  try {
    await fetch(`${window.SHEET_URL}?sheet=groupes&action=join&groupe_id=${groupeId}&auteur=${encodeURIComponent(window.currentUser)}`);
    await loadGroupes();
  } catch(e) { console.warn("Erreur rejoindre groupe", e); }
}

export async function leaveGroupe(groupeId) {
  if (!confirm("Quitter ce groupe ?")) return;
  try {
    await fetch(`${window.SHEET_URL}?sheet=groupes&action=leave&groupe_id=${groupeId}&auteur=${encodeURIComponent(window.currentUser)}`);
    await loadGroupes();
  } catch(e) { console.warn("Erreur quitter groupe", e); }
}

export async function openGroupPanel(groupeId) {
  const g = groupesState.find(g => g.id === groupeId);
  if (!g) return;
  currentGroupe = g;
  document.getElementById('groupPanelTitle').textContent   = g.nom;
  document.getElementById('groupPanelMembers').textContent = g.membres.join(', ');
  await loadGroupNotes(groupeId);
  renderGroupPanelBody();
  document.getElementById('groupPanelOverlay').classList.add('open');
  document.getElementById('groupPanel').classList.add('open');
}

export function closeGroupPanel() {
  const panel   = document.getElementById('groupPanel');
  const overlay = document.getElementById('groupPanelOverlay');
  panel.classList.remove('open');
  overlay.classList.remove('open');
  overlay.style.pointerEvents = 'none';
  setTimeout(() => { overlay.style.pointerEvents = ''; }, 350);
  currentGroupe = null;
}

function renderGroupPanelBody() {
  const body = document.getElementById('groupPanelBody');
  if (!currentGroupe) return;
  const g = currentGroupe;
  const docs = window.docs || [];
  const notes = groupNotesState[g.id] || {};
  const groupDocs = g.docs.length > 0
    ? g.docs.map(id => docs.find(d => String(d.id).trim() === String(id).trim())).filter(Boolean)
    : [];
  if (groupDocs.length === 0) {
    body.innerHTML = `<p style="font-size:13px;color:var(--ink-faint);font-style:italic">Aucun document assigné à ce groupe.</p>`;
    return;
  }
  body.innerHTML = groupDocs.map(d => {
    const docNotes = notes[String(d.id)] || [];
    return `
      <div class="group-doc-section">
        <div class="group-doc-header">
          <span class="group-doc-name">${d.title}</span>
          <a href="#" onclick="event.preventDefault();closeGroupPanel();openReader(${d.id})"
            style="font-size:11px;color:var(--accent);text-decoration:none;letter-spacing:0.05em;text-transform:uppercase">Lire ↗</a>
        </div>
        <div class="group-notes-list">
          ${docNotes.length === 0
            ? '<span style="font-size:12px;color:var(--ink-faint);font-style:italic">Pas encore de notes.</span>'
            : docNotes.map(n => `
                <div class="group-note-item">
                  <div class="group-note-author">${n.auteur}</div>
                  <div class="group-note-text">${String(n.texte||'').replace(/</g,'&lt;')}</div>
                </div>`).join('')}
        </div>
        <div class="group-note-form">
          <textarea id="gnote-${g.id}-${d.id}" placeholder="Ajouter une note…"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addGroupNote('${g.id}',${d.id})}"></textarea>
          <button class="btn-group primary" onclick="addGroupNote('${g.id}',${d.id})">Envoyer</button>
        </div>
      </div>`;
  }).join('');
}

export async function addGroupNote(groupeId, docId) {
  const input = document.getElementById(`gnote-${groupeId}-${docId}`);
  if (!input) return;
  const texte = input.value.trim();
  if (!texte) return;
  if (!groupNotesState[groupeId]) groupNotesState[groupeId] = {};
  if (!groupNotesState[groupeId][docId]) groupNotesState[groupeId][docId] = [];
  groupNotesState[groupeId][docId].push({ auteur: window.currentUser, texte });
  input.value = '';
  renderGroupPanelBody();
  try {
    await fetch(`${window.SHEET_URL}?sheet=notes_groupe&action=save&groupe_id=${groupeId}&doc_id=${docId}&auteur=${encodeURIComponent(window.currentUser)}&texte=${encodeURIComponent(texte)}`);
  } catch(e) { console.warn("Erreur envoi note groupe", e); }
}

export function toggleGroupAccordion(groupeId) {
  const card = document.getElementById('group-accord-' + groupeId);
  if (!card) return;
  const isOpen = card.classList.toggle('accordion-open');
  if (isOpen && card.dataset.notesLoaded !== '1') {
    loadGroupNotes(groupeId).then(() => {
      renderGroupAccordionNotes(groupeId);
      card.dataset.notesLoaded = '1';
    });
  }
}

export function toggleAccordionDocNotes(groupeId, docId) {
  const el  = document.getElementById(`ga-notes-${groupeId}-${docId}`);
  const btn = document.getElementById(`ga-notebtn-${groupeId}-${docId}`);
  if (!el || !btn) return;
  const open = el.classList.toggle('open');
  btn.classList.toggle('active', open);
}

function renderGroupAccordionNotes(groupeId) {
  const g = groupesState.find(g => g.id === groupeId);
  if (!g) return;
  const docs = window.docs || [];
  const notes = groupNotesState[groupeId] || {};
  const groupDocs = g.docs.length > 0
    ? g.docs.map(id => docs.find(d => String(d.id).trim() === String(id).trim())).filter(Boolean)
    : [];
  groupDocs.forEach(d => {
    const notesEl = document.getElementById(`ga-notes-${groupeId}-${d.id}`);
    if (!notesEl) return;
    const docNotes = notes[String(d.id)] || [];
    notesEl.innerHTML = docNotes.length === 0
      ? `<span style="font-size:11px;color:var(--ink-faint);font-style:italic">Pas encore de notes.</span>`
      : docNotes.map(n => `
          <div class="group-accordion-note-item">
            <div class="group-accordion-note-author">${n.auteur}</div>
            <div class="group-accordion-note-text">${String(n.texte||'').replace(/</g,'&lt;')}</div>
          </div>`).join('');
    notesEl.innerHTML += `
      <div class="group-accordion-note-form">
        <textarea id="ga-inp-${groupeId}-${d.id}" placeholder="Ajouter une note…"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addGroupNoteAccordion('${groupeId}',${d.id})}"></textarea>
        <button class="btn-group primary" onclick="addGroupNoteAccordion('${groupeId}',${d.id})">↵</button>
      </div>`;
  });
}

export async function addGroupNoteAccordion(groupeId, docId) {
  const input = document.getElementById(`ga-inp-${groupeId}-${docId}`);
  if (!input) return;
  const texte = input.value.trim();
  if (!texte) return;
  if (!groupNotesState[groupeId]) groupNotesState[groupeId] = {};
  if (!groupNotesState[groupeId][docId]) groupNotesState[groupeId][docId] = [];
  groupNotesState[groupeId][docId].push({ auteur: window.currentUser, texte });
  renderGroupAccordionNotes(groupeId);
  try {
    await fetch(`${window.SHEET_URL}?sheet=notes_groupe&action=save&groupe_id=${groupeId}&doc_id=${docId}&auteur=${encodeURIComponent(window.currentUser)}&texte=${encodeURIComponent(texte)}`);
  } catch(e) { console.warn("Erreur envoi note groupe", e); }
}

export async function deleteDocFromCatalogue(docId, groupeId) {
  const docs = window.docs || [];
  const d = docs.find(doc => doc.id === docId);
  if (!d) return;
  if (d.driveUrl && String(d.driveUrl).startsWith('https://drive.google.com')) {
    alert("Ce document est hébergé sur Google Drive.\nPour le supprimer, utilisez l'interface admin.");
    return;
  }
  if (!confirm(`Êtes-vous sûr de vouloir supprimer "${d.title}" du catalogue ?\n\nCette action est irréversible.`)) return;
  window.docs = docs.filter(doc => doc.id !== docId);
  window.renderDocs?.();
  renderMySpaceGroupes();
  try {
    await fetch(`${window.SHEET_URL}?sheet=catalogue&action=delete&doc_id=${docId}&auteur=${encodeURIComponent(window.currentUser)}`);
  } catch(e) { console.warn("Erreur suppression catalogue", e); }
  try {
    await fetch(`${window.SHEET_URL}?sheet=groupes&action=remove_doc&groupe_id=${groupeId}&doc_id=${docId}`);
  } catch(e) { console.warn("Erreur retrait doc groupe", e); }
}

export function renderMySpaceGroupes() {
  const docs = window.docs || [];
  const currentUser = window.currentUser || '';
  const mesGroupes    = groupesState.filter(g => g.membres.includes(currentUser));
  const autresGroupes = groupesState.filter(g => !g.membres.includes(currentUser));
  const mesEl    = document.getElementById('myspace-groupes');
  const autresEl = document.getElementById('myspace-autres-groupes');
  if (!mesEl || !autresEl) return;

  const cntEl = document.getElementById('ms-tab-count-groupes');
  if (cntEl) cntEl.textContent = mesGroupes.length;

  const groupDocHtml = (g) => {
    const groupDocs = g.docs.length > 0
      ? g.docs.map(id => docs.find(d => String(d.id).trim() === String(id).trim())).filter(Boolean)
      : [];
    if (groupDocs.length === 0) {
      return `<div class="group-accordion-empty">Aucun document dans ce groupe.</div>`;
    }
    return groupDocs.map(d => `
      <div class="group-accordion-doc">
        <div class="group-accordion-doc-info">
          <div class="group-accordion-doc-title">${d.title}</div>
          <div class="group-accordion-doc-author">${d.author || '—'}</div>
        </div>
        <div class="group-accordion-actions">
          <button class="group-accordion-notes-toggle" id="ga-notebtn-${g.id}-${d.id}"
            onclick="event.stopPropagation();toggleAccordionDocNotes('${g.id}',${d.id})">Notes</button>
          <button class="myspace-read-btn"
            onclick="event.stopPropagation();closeMySpace();openReader(${d.id})">Lire ↗</button>
          <button class="btn-group danger" style="padding:3px 7px;font-size:10px"
            onclick="event.stopPropagation();deleteDocFromCatalogue(${d.id},'${g.id}')"
            title="Supprimer du catalogue">🗑</button>
        </div>
      </div>
      <div class="group-accordion-notes" id="ga-notes-${g.id}-${d.id}">
        <span style="font-size:11px;color:var(--ink-faint);font-style:italic">Chargement…</span>
      </div>`).join('');
  };

  mesEl.innerHTML = mesGroupes.length === 0
    ? "<span class='myspace-empty'>Tu n'appartiens à aucun groupe.</span>"
    : mesGroupes.map(g => `
        <div class="group-card" id="group-accord-${g.id}">
          <div class="group-card-header" onclick="toggleGroupAccordion('${g.id}')">
            <div>
              <div class="group-name">${g.nom}${g.mdp ? ' 🔒' : ''}</div>
              <div class="group-meta">
                <span class="group-members">${g.membres.join(', ')}</span>
                <span style="margin-left:8px">${g.docs.length} doc${g.docs.length!==1?'s':''}</span>
              </div>
            </div>
            <span class="group-accordion-arrow">▾</span>
          </div>
          <div class="group-accordion-body">
            <div class="group-accordion-inner">
              ${groupDocHtml(g)}
              <div class="group-actions" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
                <button class="btn-group primary"
                  onclick="event.stopPropagation();openGroupPanel('${g.id}')">Vue complète ↗</button>
                ${g.createur !== currentUser
                  ? `<button class="btn-group danger"
                      onclick="event.stopPropagation();leaveGroupe('${g.id}')">Quitter</button>`
                  : ''}
              </div>
            </div>
          </div>
        </div>`).join('');

  autresEl.innerHTML = autresGroupes.length === 0 ? '' : `
    <div class="myspace-section-title" style="margin-bottom:8px;margin-top:4px">Autres groupes</div>
    ${autresGroupes.map(g => `
      <div class="group-card">
        <div class="group-name">${g.nom}${g.mdp ? ' 🔒' : ''}</div>
        <div class="group-meta"><span class="group-members">${g.membres.join(', ')}</span></div>
        <div class="group-actions">
          <button class="btn-group primary" onclick="joinGroupe('${g.id}')">Rejoindre</button>
        </div>
      </div>`).join('')}`;
}

function normalizeText(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Listener autocomplete
document.addEventListener('click', e => {
  if (!e.target.closest('.doc-autocomplete-wrap')) {
    document.querySelectorAll('.doc-autocomplete-dropdown').forEach(d => d.classList.remove('open'));
  }
});

// Exposition sur window
window.loadGroupes              = loadGroupes;
window.renderMySpaceGroupes     = renderMySpaceGroupes;
window.openGroupPanel           = openGroupPanel;
window.closeGroupPanel          = closeGroupPanel;
window.createGroupe             = createGroupe;
window.joinGroupe               = joinGroupe;
window.leaveGroupe              = leaveGroupe;
window.toggleGroupAccordion     = toggleGroupAccordion;
window.toggleAccordionDocNotes  = toggleAccordionDocNotes;
window.addGroupNote             = addGroupNote;
window.addGroupNoteAccordion    = addGroupNoteAccordion;
window.deleteDocFromCatalogue   = deleteDocFromCatalogue;
window.onGroupDocSearch         = onGroupDocSearch;
window.addGroupDocSelection     = addGroupDocSelection;
window.removeGroupDocSelection  = removeGroupDocSelection;