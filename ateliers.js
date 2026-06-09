// ateliers.js
const SHEET_URL = window.SHEET_URL;

let ateliersState = [];

// ── CHARGEMENT ──
export async function loadAteliers() {
  try {
    const res = await fetch(SHEET_URL + "?sheet=ateliers&owner=Matthieu&v=" + Date.now());
    const rows = await res.json();
    if (Array.isArray(rows)) {
      ateliersState = rows.map(r => ({
        id:     String(r.id     || "").trim(),
        titre:  String(r.titre  || "").trim(),
        owner:  String(r.owner  || "").trim(),
        statut: String(r.statut || "").trim(),
        docs:   String(r.docs   || "").split(",").map(d => d.trim()).filter(Boolean),
        notes:  String(r.notes  || "").trim(),
        date:   String(r.date   || "").trim()
      }));
    }
  } catch(e) { console.warn("Ateliers non chargés", e); }
  renderAteliers();
}

// ── CRÉER ──
export async function creerAtelier(titre) {
  if (!titre) return;
  try {
    const res = await fetch(SHEET_URL + "?sheet=ateliers&action=create&titre=" + encodeURIComponent(titre) + "&owner=Matthieu");
    const r = await res.json();
    if (r.status === "created") {
      ateliersState.push({ id: r.id, titre, owner: "Matthieu", statut: "en cours", docs: [], notes: "", date: "" });
      renderAteliers();
    }
  } catch(e) { console.warn("Erreur création atelier", e); }
}

// ── SUPPRIMER ──
export async function supprimerAtelier(atelierId) {
  if (!confirm("Supprimer cet atelier ? Les documents du catalogue ne seront pas affectés.")) return;
  try {
    await fetch(SHEET_URL + "?sheet=ateliers&action=delete&atelier_id=" + atelierId);
    ateliersState = ateliersState.filter(a => a.id !== atelierId);
    renderAteliers();
  } catch(e) { console.warn("Erreur suppression atelier", e); }
}

// ── AJOUTER UN DOC ──
export async function ajouterDocAtelier(atelierId, docId) {
  try {
    await fetch(SHEET_URL + "?sheet=ateliers&action=add_doc&atelier_id=" + atelierId + "&doc_id=" + docId);
    const a = ateliersState.find(a => a.id === atelierId);
    if (a && !a.docs.includes(String(docId))) a.docs.push(String(docId));
    renderAteliers();
  } catch(e) { console.warn("Erreur ajout doc atelier", e); }
}

// ── RETIRER UN DOC ──
export async function retirerDocAtelier(atelierId, docId) {
  try {
    await fetch(SHEET_URL + "?sheet=ateliers&action=remove_doc&atelier_id=" + atelierId + "&doc_id=" + docId);
    const a = ateliersState.find(a => a.id === atelierId);
    if (a) a.docs = a.docs.filter(d => d !== String(docId));
    renderAteliers();
  } catch(e) { console.warn("Erreur retrait doc atelier", e); }
}

// ── RENDU ──
function renderAteliers() {
  const container = document.getElementById("ms-panel-ateliers");
  if (!container) return;
  const docs = window.docs || [];

  let html = ateliersState.length === 0
    ? '<span style="font-size:12px;color:var(--ink-faint);font-style:italic">Aucun atelier pour l\'instant.</span>'
    : ateliersState.map(a => {
        const atelierDocs = a.docs
          .map(id => docs.find(d => String(d.id) === id))
          .filter(Boolean);
        return `
          <div style="border:1px solid var(--border);background:var(--white);margin-bottom:10px">
            <div style="padding:10px 14px;background:var(--cream);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <span style="font-family:'Cormorant Garamond',serif;font-size:16px">${a.titre}</span>
              <button onclick="window._supprimerAtelier('${a.id}')"
                style="font-size:10px;color:#B75D4A;background:none;border:1px solid #B75D4A;padding:3px 8px;cursor:pointer;font-family:'DM Sans',sans-serif">
                Supprimer
              </button>
            </div>
            <div style="padding:10px 14px">
              ${atelierDocs.length === 0
                ? '<span style="font-size:12px;color:var(--ink-faint);font-style:italic">Aucun document.</span>'
                : atelierDocs.map(d => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                      <div>
                        <div style="font-family:'Cormorant Garamond',serif;font-size:14px">${d.title}</div>
                        <div style="font-size:11px;color:var(--ink-faint);font-style:italic">${d.author || ''}</div>
                      </div>
                      <button onclick="window._retirerDoc('${a.id}',${d.id})"
                        style="font-size:10px;color:var(--ink-faint);background:none;border:1px solid var(--border);padding:3px 8px;cursor:pointer;font-family:'DM Sans',sans-serif">
                        Retirer
                      </button>
                    </div>`).join('')
              }
              <div style="margin-top:10px;display:flex;gap:6px">
                <input type="text" id="doc-search-${a.id}"
                  placeholder="Ajouter un document…"
                  oninput="window._onDocSearch('${a.id}')"
                  autocomplete="off"
                  style="flex:1;border:1px solid var(--border);background:var(--cream);padding:6px 10px;font-family:'DM Sans',sans-serif;font-size:13px;outline:none" />
              </div>
              <div id="doc-dropdown-${a.id}"
                style="display:none;border:1px solid var(--border);border-top:none;background:var(--white);max-height:180px;overflow-y:auto"></div>
            </div>
          </div>`;
      }).join('');

  // Formulaire création
  html += `
    <div style="margin-top:12px">
      <div id="atelier-form-wrap" style="display:none;background:var(--cream);border:1px solid var(--border);padding:14px;margin-bottom:8px">
        <input type="text" id="atelier-titre-input"
          placeholder="Nom de l'atelier…"
          style="width:100%;border:1px solid var(--border);background:var(--white);padding:8px 10px;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;margin-bottom:8px" />
        <div style="display:flex;gap:6px">
          <button onclick="window._creerAtelier()"
            style="background:var(--accent);color:var(--white);border:none;padding:8px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif">
            Créer
          </button>
          <button onclick="document.getElementById('atelier-form-wrap').style.display='none'"
            style="background:none;border:1px solid var(--border);padding:8px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif">
            Annuler
          </button>
        </div>
      </div>
      <button onclick="document.getElementById('atelier-form-wrap').style.display='block';document.getElementById('atelier-titre-input').focus()"
        style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent-light);background:var(--accent-light);padding:6px 12px;cursor:pointer;font-family:'DM Sans',sans-serif">
        + Nouvel atelier
      </button>
    </div>`;

  container.innerHTML = html;
}

// ── RECHERCHE DOC DANS ATELIER ──
function onDocSearch(atelierId) {
  const input = document.getElementById("doc-search-" + atelierId);
  const dropdown = document.getElementById("doc-dropdown-" + atelierId);
  if (!input || !dropdown) return;
  const q = input.value.trim().toLowerCase();
  if (!q || q.length < 2) { dropdown.style.display = "none"; return; }
  const docs = window.docs || [];
  const atelier = ateliersState.find(a => a.id === atelierId);
  const matches = docs.filter(d =>
    !atelier.docs.includes(String(d.id)) &&
    ((d.title || "").toLowerCase().includes(q) || (d.author || "").toLowerCase().includes(q))
  ).slice(0, 8);
  if (matches.length === 0) { dropdown.style.display = "none"; return; }
  dropdown.innerHTML = matches.map(d => `
    <div onclick="window._ajouterDoc('${atelierId}', ${d.id})"
      style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
      onmouseover="this.style.background='var(--accent-light)'"
      onmouseout="this.style.background='var(--white)'">
      <div>${d.title}</div>
      <div style="font-size:11px;color:var(--ink-faint);font-style:italic">${d.author || ''}</div>
    </div>`).join('');
  dropdown.style.display = "block";
}

// ── EXPOSITION SUR WINDOW ──
window._creerAtelier = () => {
  const input = document.getElementById("atelier-titre-input");
  if (!input) return;
  creerAtelier(input.value.trim());
  input.value = "";
  document.getElementById("atelier-form-wrap").style.display = "none";
};
window._supprimerAtelier = (id) => supprimerAtelier(id);
window._ajouterDoc       = (atelierId, docId) => { ajouterDocAtelier(atelierId, docId); document.getElementById("doc-search-" + atelierId).value = ""; document.getElementById("doc-dropdown-" + atelierId).style.display = "none"; };
window._retirerDoc       = (atelierId, docId) => retirerDocAtelier(atelierId, docId);
window._onDocSearch      = (atelierId) => onDocSearch(atelierId);