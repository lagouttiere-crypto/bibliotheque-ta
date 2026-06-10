// notes.js — module ES
// Dépendances attendues sur window : docs, currentUser, SHEET_URL

let noteDebounce = null;
let freeNoteDebounce = null;
let noteTagsLoaded = false;

function lsKey(type) {
  return `ta_${type}_${window.currentUser}`;
}

export function renderNotePreview(text) {
  const preview = document.getElementById('notesPreview');
  if (!text.trim()) {
    preview.innerHTML = '<span class="notes-preview-empty">Le rendu apparaît ici…</span>';
    return;
  }
  preview.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : text;
}

export function onNoteInput() {
  const text = document.getElementById('notesTextarea').value;
  renderNotePreview(text);
  document.getElementById('notesSaveStatus').textContent = 'Modification…';
  clearTimeout(noteDebounce);
  noteDebounce = setTimeout(() => saveNote(window._currentReaderId, text), 1000);
}

function extractTags(text) {
  const matches = text.match(/#[\wÀ-ÿ\-]+/g) || [];
  return [...new Set(matches.map(t => t.toLowerCase()))];
}

export async function saveNote(docId, text) {
  if (!docId || !window.currentUser) return;
  localStorage.setItem(lsKey('note_' + docId), text);
  document.getElementById('notesSaveStatus').textContent = 'Sauvegardée';
  renderNotesPanel();
  const tags = extractTags(text);
  try {
    await fetch(`${window.SHEET_URL}?sheet=notes&action=save&doc_id=${docId}&auteur=${encodeURIComponent(window.currentUser)}&texte=${encodeURIComponent(text)}`);
    if (tags.length > 0) {
      await fetch(`${window.SHEET_URL}?sheet=notes_tags&action=save&doc_id=${docId}&auteur=${encodeURIComponent(window.currentUser)}&tags=${encodeURIComponent(tags.join(','))}`);
    }
  } catch(e) { console.warn("Sync note Sheet", e); }
}

export function onFreeNoteInput() {
  const text = document.getElementById('mb-free-note').value;
  document.getElementById('free-note-status').textContent = 'Modification…';
  clearTimeout(freeNoteDebounce);
  freeNoteDebounce = setTimeout(() => saveFreeNote(text), 1000);
}

export async function saveFreeNote(text) {
  if (!window.currentUser) return;
  localStorage.setItem(lsKey('note_free'), text);
  document.getElementById('free-note-status').textContent = 'Sauvegardée';
  try {
    await fetch(`${window.SHEET_URL}?sheet=notes&action=save&doc_id=&auteur=${encodeURIComponent(window.currentUser)}&texte=${encodeURIComponent(text)}`);
  } catch(e) { console.warn("Sync free note Sheet", e); }
}

export function loadLocalNotes() {
  const freeArea = document.getElementById('mb-free-note');
  if (freeArea) freeArea.value = localStorage.getItem(lsKey('note_free')) || '';
}

export async function loadNotesFromSheet() {
  try {
    const res  = await fetch(`${window.SHEET_URL}?sheet=notes&auteur=${encodeURIComponent(window.currentUser)}&v=${Date.now()}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    rows.forEach(row => {
      const docId = String(row.doc_id || '').trim();
      const text  = String(row.texte  || '').trim();
      if (!text) return;
      const key = docId ? lsKey('note_' + docId) : lsKey('note_free');
      localStorage.setItem(key, text);
    });
    loadLocalNotes();
    renderNotesPanel();
  } catch(e) { console.warn("Notes Sheet non chargées", e); }
}

export async function loadNotesTags() {
  try {
    const res = await fetch(`${window.SHEET_URL}?sheet=notes_tags&auteur=${encodeURIComponent(window.currentUser)}&v=${Date.now()}`);
    const rows = await res.json();
    window.notesTagsState = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        const id = String(r.doc_id).trim();
        if (!window.notesTagsState[id]) window.notesTagsState[id] = [];
        if (r.tag) window.notesTagsState[id].push(r.tag);
      });
    }
    noteTagsLoaded = true;
  } catch(e) { console.warn("Notes tags non chargés", e); }
}

export function filterMyNotes() {
  if (window.currentUser !== 'Matthieu') return;
  const q = document.getElementById('ms-notes-search')?.value.trim().toLowerCase() || '';
  const docs = window.docs || [];
  const noteDocs = docs
    .map(d => ({ d, text: localStorage.getItem(lsKey('note_' + d.id)) || '' }))
    .filter(({ text }) => text.trim())
    .filter(({ text }) => !q || text.toLowerCase().includes(q));
  const freeNote = localStorage.getItem(lsKey('note_free')) || '';
  const container = document.getElementById('ms-notes-list');
  if (!container) return;

  let html = '';
  if (!q && freeNote.trim()) {
    html += `<div class="myspace-note-card" style="margin-bottom:8px">
      <div class="myspace-note-doc">Note libre</div>
      <div class="myspace-note-text">${freeNote.replace(/[#*>_]/g,'').substring(0,120)}…</div>
    </div>`;
  }
  if (noteDocs.length === 0 && !html) {
    container.innerHTML = `<span class="myspace-empty">Aucune note trouvée.</span>`;
    return;
  }
  html += noteDocs.map(({ d, text }) => {
    const extrait = q
      ? text.replace(/[#*>_]/g,'').substring(0,200).replace(
          new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi'),
          '<mark style="background:#FFF3B0;padding:0 2px">$1</mark>'
        )
      : text.replace(/[#*>_]/g,'').substring(0,120) + '…';
    return `<div class="myspace-note-card" style="position:relative">
      <div onclick="window.closeMySpace();window.openReader(${d.id})" style="cursor:pointer">
        <div class="myspace-note-doc">${d.title}</div>
        <div class="myspace-note-text">${extrait}</div>
      </div>
      <button onclick="event.stopPropagation();window.deleteNote(${d.id})"
        style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;font-size:12px;color:var(--ink-faint);padding:2px 5px"
        title="Supprimer cette note">✕</button>
    </div>`;
  }).join('');
  container.innerHTML = html;
}

export async function deleteNote(docId) {
  const docs = window.docs || [];
  const d = docs.find(doc => doc.id === docId);
  const titre = d ? d.title : 'cette note';
  if (!confirm('Supprimer la note sur "' + titre + '" ?')) return;
  localStorage.removeItem(lsKey('note_' + docId));
  try {
    await fetch(`${window.SHEET_URL}?sheet=notes&action=delete&doc_id=${docId}&auteur=${encodeURIComponent(window.currentUser)}`);
  } catch(e) { console.warn("Erreur suppression note", e); }
  window.renderMySpaceBody();
  if (window.currentUser === 'Matthieu') filterMyNotes();
}

export function renderMyCitations() {
  if (window.currentUser !== 'Matthieu') return;
  const wrap = document.getElementById('ms-citations-wrap');
  if (!wrap) return;
  const docs = window.docs || [];

  const citations = [];
  docs.forEach(d => {
    const text = localStorage.getItem('ta_note_' + d.id + '_' + window.currentUser) || '';
    if (!text.trim()) return;
    const lines = text.split('\n');
    let current = [];
    lines.forEach(line => {
      if (line.startsWith('>')) {
        current.push(line.replace(/^>\s*/, ''));
      } else {
        if (current.length > 0) {
          citations.push({ doc: d, text: current.join(' ') });
          current = [];
        }
      }
    });
    if (current.length > 0) {
      citations.push({ doc: d, text: current.join(' ') });
    }
  });

  if (citations.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  document.getElementById('ms-citations-list').innerHTML = citations.map(c => `
    <div class="myspace-note-card" onclick="window.closeMySpace();window.openReader(${c.doc.id})"
      style="border-left-color:var(--editorial);margin-bottom:6px">
      <div class="myspace-note-doc" style="color:var(--editorial)">${c.doc.title}</div>
      <div class="myspace-note-text" style="font-style:italic">"${c.text}"</div>
    </div>`).join('');
}

export function renderNotesPanel() {
  const container = document.getElementById('mb-list-notes');
  if (!container) return;
  const docs = window.docs || [];
  const docNotes = docs
    .map(d => ({ d, text: localStorage.getItem(lsKey('note_' + d.id)) || '' }))
    .filter(({ text }) => text.trim());
  if (docNotes.length === 0) {
    container.innerHTML = '<span class="mb-empty">Aucune note pour l\'instant.</span>';
    return;
  }
  container.innerHTML = docNotes.map(({ d, text }) => `
    <div class="mb-note-item" onclick="window.switchSidebarTab('catalogue');window.openReader(${d.id})">
      <div class="mb-note-doc">${d.title}</div>
      <div class="mb-note-preview">${text.replace(/[#*>_\`]/g, '').substring(0, 60)}…</div>
    </div>`).join('');
}

// Exposition sur window
window.onNoteInput      = onNoteInput;
window.filterMyNotes    = filterMyNotes;
window.deleteNote       = deleteNote;
window.renderMyCitations = renderMyCitations;
window.renderNotesPanel = renderNotesPanel;
window.loadNotesTags    = loadNotesTags;
window.loadNotesFromSheet = loadNotesFromSheet;
window.loadLocalNotes   = loadLocalNotes;
window.saveNote         = saveNote;