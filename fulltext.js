// fulltext.js — module ES
// Dépendances attendues sur window : docs, currentUser, SHEET_URL

let fulltextState = [];
let fulltextDebounce = null;

export async function loadFulltextIndex() {
  if (fulltextState.length > 0) return;
  document.getElementById('fulltext-count').textContent = 'Chargement…';
  try {
    const res = await fetch(`https://lagouttiere-crypto.github.io/bibliotheque-ta/fulltext.json?v=${Date.now()}`);
    if (!res.ok) throw new Error('GitHub indisponible');
    const rows = await res.json();
    if (Array.isArray(rows)) fulltextState = rows;
    document.getElementById('fulltext-count').textContent = '';
    document.getElementById('fulltextResults').innerHTML = '<span style="font-size:13px;color:var(--ink-faint);font-style:italic">Index prêt, tapez votre recherche…</span>';
  } catch(e) {
    console.warn("Fallback sur le Sheet", e);
    try {
      const res2 = await fetch(`${window.SHEET_URL}?sheet=fulltext&v=${Date.now()}`);
      const rows2 = await res2.json();
      if (Array.isArray(rows2)) fulltextState = rows2;
      document.getElementById('fulltext-count').textContent = '';
      document.getElementById('fulltextResults').innerHTML = '<span style="font-size:13px;color:var(--ink-faint);font-style:italic">Index prêt, tapez votre recherche…</span>';
    } catch(e2) { console.warn("Fulltext non chargé", e2); }
  }
}

export function openFulltextSearch() {
  document.getElementById('fulltextOverlay').style.display = 'block';
  document.getElementById('fulltextPanel').style.transform = 'translateX(0)';
  document.body.style.overflow = 'hidden';
  document.getElementById('fulltextInput').focus();
  loadFulltextIndex();
}

export function closeFulltextSearch() {
  document.getElementById('fulltextOverlay').style.display = 'none';
  document.getElementById('fulltextPanel').style.transform = 'translateX(100%)';
  document.body.style.overflow = '';
  window._advQ = null;
  window._advAuthor = null;
  window._advType = null;
  document.getElementById('adv-q').value = '';
  document.getElementById('adv-author').value = '';
  document.getElementById('adv-type').value = '';
  document.getElementById('fulltextInput').value = '';
  document.getElementById('fulltextResults').innerHTML = '';
  document.getElementById('fulltext-count').textContent = '';
}

export function toggleAdvancedSearch() {
  const bar = document.getElementById('advSearchBar');
  const btn = document.getElementById('advSearchBtn');
  const open = bar.classList.toggle('open');
  btn.style.color = open ? 'var(--accent)' : 'var(--ink-light)';
  if (open) {
    const input = document.getElementById('adv-q');
    if (fulltextState.length === 0) {
      input.disabled = true;
      input.placeholder = 'Chargement de l\'index…';
    }
    document.getElementById('adv-author').focus();
    loadFulltextIndex().then(() => {
      input.disabled = false;
      input.placeholder = 'Mot, expression…';
      input.focus();
    });
  }
}

export function lancerRechercheAvancee() {
  const q      = document.getElementById('adv-q').value.trim();
  const author = document.getElementById('adv-author').value.trim();
  const type   = document.getElementById('adv-type').value;
  window._advQ      = q;
  window._advAuthor = author.toLowerCase();
  window._advType   = type;
  document.getElementById('advSearchBar').classList.remove('open');
  openFulltextSearch();
  searchFulltext();
}

function renderFulltextPageResult(d, p, q) {
  const idx = normalizeText(p.texte).indexOf(q);
  const start = Math.max(0, idx - 60);
  const end = Math.min(p.texte.length, idx + q.length + 60);
  const extraitBrut = (start > 0 ? '…' : '') + p.texte.substring(start, end) + (end < p.texte.length ? '…' : '');
  const extrait = extraitBrut.replace(
    new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'),
    '<mark style="background:#FFF3B0;color:var(--ink);padding:0 2px;border-radius:2px">$1</mark>'
  );
  return '<div style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'
    + '<div style="flex:1">'
    + '<span style="font-size:10px;color:var(--accent);font-weight:500;letter-spacing:0.05em">PAGE ' + p.page + '</span>'
    + '<div style="font-size:12px;color:var(--ink-light);line-height:1.5;margin-top:3px">' + extrait + '</div>'
    + '</div>'
    + '<button onclick="window._pdfSearchTerm=window._advQ||document.getElementById(\'adv-q\').value.trim();window.closeFulltextSearch();setTimeout(()=>window.openReader(' + d.id + ',' + p.page + '),50)"    + '</div>';
}

function normalizeText(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function searchFulltext() {
  clearTimeout(fulltextDebounce);
  fulltextDebounce = setTimeout(() => {
    const docs = window.docs || [];
    const qRaw = window._advQ || document.getElementById('fulltextInput').value.trim();
    const q = normalizeText(qRaw);
    const countEl = document.getElementById('fulltext-count');
    const resultsEl = document.getElementById('fulltextResults');
    const hasAuthor = !!(window._advAuthor && window._advAuthor.length >= 2);

    if ((!q || q.length < 3) && !hasAuthor) {
      countEl.textContent = '';
      resultsEl.innerHTML = '<span style="font-size:13px;color:var(--ink-faint);font-style:italic">Tapez au moins 3 caractères…</span>';
      return;
    }

    const fuse = new Fuse(docs, { keys: ['titre', 'auteur'], threshold: 0.35, ignoreLocation: true });
    const fuseDocIds = new Set(fuse.search(qRaw).map(r => String(r.item.id)));

    const fuseAuteurIds = window._advAuthor
      ? new Set(new Fuse(docs, { keys: ['auteur'], threshold: 0.35, ignoreLocation: true })
          .search(window._advAuthor).map(r => String(r.item.id)))
      : null;

    const byDoc = {};
    fulltextState.forEach(row => {
      const texte = normalizeText(String(row.texte || ''));
      const docId = String(row.doc_id).trim();
      const docObj = docs.find(doc => String(doc.id) === docId);
      if (fuseAuteurIds && !fuseAuteurIds.has(docId)) return;
      if (window._advType && docObj && docObj.type !== window._advType) return;
      if (texte.includes(q)) {
        if (!byDoc[docId]) byDoc[docId] = [];
        byDoc[docId].push({ page: row.page, texte: String(row.texte || '') });
      }
    });

    fuseDocIds.forEach(docId => {
      if (!byDoc[docId]) byDoc[docId] = [];
    });

    const docIds = Object.keys(byDoc);
    countEl.textContent = docIds.length + ' document' + (docIds.length !== 1 ? 's' : '');
    if (docIds.length === 0) {
      resultsEl.innerHTML = '<span style="font-size:13px;color:var(--ink-faint);font-style:italic">Aucun résultat.</span>';
      return;
    }

    resultsEl.innerHTML = docIds.map(docId => {
      const d = docs.find(doc => String(doc.id) === docId);
      if (!d) return '';
      const pages = byDoc[docId];
      const pagesHtml = q ? pages.slice(0, 20).map(p => renderFulltextPageResult(d, p, q)).join('') : '';
      const label = pages.length > 0
        ? pages.length + ' page' + (pages.length !== 1 ? 's' : '') + ' trouvée' + (pages.length !== 1 ? 's' : '')
        : 'trouvé via titre ou auteur';
      return '<div style="margin-bottom:16px;border:1px solid var(--border);background:var(--white)">'
        + '<div style="padding:10px 14px;background:var(--cream);border-bottom:1px solid var(--border)">'
        + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:16px;font-weight:400;color:var(--ink)">' + d.titre + '</div>'
        + '<div style="font-size:11px;color:var(--ink-faint);font-style:italic;margin-bottom:8px">' + (d.auteur || '') + ' · ' + label + '</div>'
        + '<button onclick="window._pdfSearchTerm=document.getElementById(\'adv-q\').value.trim();window.closeFulltextSearch();setTimeout(()=>window.openReader(' + d.id + ',' + (pages[0] ? pages[0].page : 1) + '),50)"'        + ' style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent-light);background:var(--accent-light);padding:4px 10px;cursor:pointer;font-family:\'DM Sans\',sans-serif">Ouvrir le document ↗</button>'
        + '</div>'
        + '<div style="padding:0 14px">' + pagesHtml + '</div>'
        + '</div>';
    }).join('');
  }, 300);
}

export async function indexerDocScaleway(docId, url) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const texte = content.items.map(item => item.str).join(' ').trim();
      if (!texte) continue;
      await fetch(window.SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sheet: 'fulltext', action: 'save', doc_id: docId, page: i, texte })
      });
    }
    return { status: 'ok', pages: pdf.numPages };
  } catch(e) {
    console.warn("Erreur indexation", e);
    return { status: 'error' };
  }
}

export async function indexerTousLesDocsScaleway() {
  const docs = window.docs || [];
  const docsScaleway = docs.filter(d =>
    d.driveUrl &&
    d.driveUrl.includes('scw.cloud') &&
    d.type !== 'pad' &&
    d.id !== 80
  );
  const statusEl = document.getElementById('index-status');
  if (statusEl) statusEl.textContent = 'Chargement de l\'index…';
  await loadFulltextIndex();
  const aIndexer = docsScaleway.filter(d => {
    const pages = fulltextState.filter(row => String(row.doc_id).trim() === String(d.id).trim());
    return pages.length < 3;
  });
  if (statusEl) statusEl.textContent = `${aIndexer.length} document(s) à indexer sur ${docsScaleway.length}…`;
  if (aIndexer.length === 0) {
    if (statusEl) statusEl.textContent = '✓ Tout est déjà indexé !';
    return;
  }
  let count = 0;
  for (const d of aIndexer) {
    if (statusEl) statusEl.textContent = `${count} / ${aIndexer.length} — ${d.title}…`;
    const result = await indexerDocScaleway(d.id, d.driveUrl);
    if (result.status === 'ok') count++;
    await new Promise(r => setTimeout(r, 300));
  }
  if (statusEl) statusEl.textContent = `✓ ${count} documents indexés !`;
  fulltextState = [];
  await loadFulltextIndex();
}

// Exposition sur window pour les onclick HTML
window.toggleAdvancedSearch  = toggleAdvancedSearch;
window.lancerRechercheAvancee = lancerRechercheAvancee;
window.closeFulltextSearch   = closeFulltextSearch;
window.openFulltextSearch    = openFulltextSearch;
window.searchFulltext        = searchFulltext;
window.indexerTousLesDocsScaleway = indexerTousLesDocsScaleway;