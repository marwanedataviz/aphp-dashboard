const ZOOM_THRESHOLD = 12;

let map, ghLayer, hopitalLayer;
let selectedHopital = null;
let cameFromGhu = null;
let selectedMarker = null;

const GHU_PALETTE = ['#8E8CF0', '#4FBE96', '#3FC1D6', '#F2879C', '#F0C24B', '#7D8CAE'];
let ghuColorMap = {};

function statusColor(taux) {
  if (taux >= 70) return '#2FB8CE';
  if (taux >= 10) return '#F2A33B';
  return '#E14E42';
}

function buildGhuColorMap() {
  const names = window.DEPLOYMENT_DATA.ghu.map(g => g.nom).sort();
  ghuColorMap = {};
  names.forEach((n, i) => { ghuColorMap[n] = GHU_PALETTE[i % GHU_PALETTE.length]; });
}

// ---- Carte ----

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([48.8566, 2.3522], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  ghLayer = L.layerGroup().addTo(map);
  hopitalLayer = L.layerGroup();

  map.on('zoomend', updateLayerVisibility);
  updateLayerVisibility();

  if (window.DEPLOYMENT_DATA.is_demo_data) {
    document.getElementById('demoBadge').style.display = 'block';
  }
}

function updateLayerVisibility() {
  const zoom = map.getZoom();
  const hint = document.getElementById('zoomHint');
  if (zoom >= ZOOM_THRESHOLD) {
    if (map.hasLayer(ghLayer)) map.removeLayer(ghLayer);
    if (!map.hasLayer(hopitalLayer)) map.addLayer(hopitalLayer);
    hint.textContent = 'Vue hôpitaux';
  } else {
    if (map.hasLayer(hopitalLayer)) map.removeLayer(hopitalLayer);
    if (!map.hasLayer(ghLayer)) map.addLayer(ghLayer);
    hint.textContent = 'Vue GHU — zoomez pour voir les hôpitaux';
  }
}

function highlightMarker(marker) {
  if (selectedMarker) selectedMarker.setStyle({ weight: 2 });
  marker.setStyle({ weight: 4 });
  selectedMarker = marker;
}

function popupHtml({ nom, gh, taux, deploye, nonDeploye }) {
  return `<div class="map-popup">
    <div class="mp-name">${nom}</div>
    <div class="mp-gh">${gh}</div>
    <div class="mp-row"><span>Taux</span><span class="mp-taux" style="color:${statusColor(taux)}">${taux}%</span></div>
    <div class="mp-row"><span>Déployé</span><span>${deploye}</span></div>
    <div class="mp-row"><span>Non déployé</span><span>${nonDeploye}</span></div>
  </div>`;
}

function buildMarkers() {
  ghLayer.clearLayers();
  hopitalLayer.clearLayers();

  const data = window.DEPLOYMENT_DATA;

  data.ghu.forEach(g => {
    const radius = 13 + Math.min(11, Math.sqrt(g.total) / 2);
    const color = ghuColorMap[g.nom] || '#3FC1D6';
    const marker = L.circleMarker([g.lat, g.lon], {
      radius, fillColor: color, fillOpacity: 0.85, color: '#fff', weight: 2.5
    });
    marker.bindPopup(popupHtml({ nom: g.nom, gh: `${g.nb_hopitaux} hôpitaux`, taux: g.taux, deploye: g.deploye, nonDeploye: g.non_deploye }));
    marker.bindTooltip(g.nom, { direction: 'top', offset: [0, -radius] });
    marker.on('click', () => {
      const bounds = data.hopitaux.filter(h => h.gh === g.nom).map(h => [h.lat, h.lon]);
      if (bounds.length) map.fitBounds(bounds, { padding: [60, 60], maxZoom: ZOOM_THRESHOLD + 1 });
      showGhuListe(g.nom);
      highlightMarker(marker);
    });
    ghLayer.addLayer(marker);
  });

  data.hopitaux.forEach(h => {
    const radius = 6 + Math.min(7, Math.sqrt(h.total) / 3);
    const color = ghuColorMap[h.gh] || '#3FC1D6';
    const marker = L.circleMarker([h.lat, h.lon], {
      radius, fillColor: color, fillOpacity: 0.9, color: '#fff', weight: 2
    });
    marker.bindPopup(popupHtml({ nom: h.nom, gh: h.gh, taux: h.taux, deploye: h.deploye, nonDeploye: h.non_deploye }));
    marker.bindTooltip(h.nom, { direction: 'top', offset: [0, -radius] });
    marker.on('click', () => { showHopitalDetail(h.nom, null); highlightMarker(marker); });
    hopitalLayer.addLayer(marker);
  });
}

// ---- Bandeau global ----

function renderSummaryBar() {
  const data = window.DEPLOYMENT_DATA;
  const totalDeploye = data.hopitaux.reduce((s, h) => s + h.deploye, 0);
  const totalNonDeploye = data.hopitaux.reduce((s, h) => s + h.non_deploye, 0);
  const totalCalc = totalDeploye + totalNonDeploye;
  const tauxGlobal = totalCalc > 0 ? Math.round((100 * totalDeploye / totalCalc) * 10) / 10 : 0;
  const nbAlerte = data.hopitaux.filter(h => h.taux < 10).length;

  document.getElementById('tauxGlobal').textContent = tauxGlobal + '%';
  document.getElementById('nbAlerte').textContent = nbAlerte;

  const strip = document.getElementById('ghuStrip');
  strip.innerHTML = '';
  data.ghu.forEach(g => {
    const ghColor = ghuColorMap[g.nom] || '#3FC1D6';
    const membres = data.hopitaux.filter(h => h.gh === g.nom);
    const nbAlerteGhu = membres.filter(h => h.taux < 10).length;

    const pill = document.createElement('div');
    pill.className = 'ghu-pill';
    pill.style.borderColor = ghColor + '55';
    pill.innerHTML = `<span class="dot" style="background:${ghColor}"></span>
      <span>${g.nom.replace('AP-HP.', '')}</span>
      <span class="taux" style="color:${statusColor(g.taux)}">${g.taux}%</span>
      ${nbAlerteGhu > 0 ? '<span class="alert-dot" title="' + nbAlerteGhu + ' hôpital(aux) en alerte"></span>' : ''}`;
    pill.addEventListener('click', () => {
      const bounds = membres.map(h => [h.lat, h.lon]);
      if (bounds.length) map.fitBounds(bounds, { padding: [60, 60], maxZoom: ZOOM_THRESHOLD + 1 });
      showGhuListe(g.nom);
    });
    strip.appendChild(pill);
  });

  const ghuLegend = document.getElementById('ghuLegend');
  ghuLegend.innerHTML = data.ghu.map(g =>
    `<div class="legend-row"><span class="legend-shape" style="background:${ghuColorMap[g.nom]}"></span> ${g.nom.replace('AP-HP.', '')}</div>`
  ).join('');
}

// ---- États de la fiche ----

function resetStates() {
  document.getElementById('stateEmpty').style.display = 'none';
  document.getElementById('stateListe').style.display = 'none';
  document.getElementById('stateDetail').style.display = 'none';
}

function showEmptyState() {
  resetStates();
  document.getElementById('stateEmpty').style.display = 'flex';
  selectedHopital = null;
  cameFromGhu = null;
}

function showGhuListe(ghNom) {
  resetStates();
  document.getElementById('stateListe').style.display = 'block';

  const data = window.DEPLOYMENT_DATA;
  const g = data.ghu.find(x => x.nom === ghNom);
  const hopitaux = data.hopitaux.filter(h => h.gh === ghNom).sort((a, b) => a.taux - b.taux);

  document.getElementById('ghuName').textContent = ghNom;
  document.getElementById('ghuMeta').textContent = `${hopitaux.length} hôpitaux`;
  const tauxEl = document.getElementById('ghuTaux');
  tauxEl.textContent = g.taux + '%';
  tauxEl.style.color = statusColor(g.taux);

  const list = document.getElementById('hopitalList');
  list.innerHTML = '';
  hopitaux.forEach(h => {
    const c = statusColor(h.taux);
    const row = document.createElement('div');
    row.className = 'hopital-row';
    row.innerHTML = `<span class="name">${h.nom}</span>
      <span class="mini-bar-track"><span class="mini-bar-fill" style="width:${h.taux}%;background:${c}"></span></span>
      <span class="taux-tag" style="background:${c}22;color:${c}">${h.taux}%</span>`;
    row.addEventListener('click', () => showHopitalDetail(h.nom, ghNom));
    list.appendChild(row);
  });
}

function showHopitalDetail(nom, fromGhu) {
  resetStates();
  document.getElementById('stateDetail').style.display = 'block';
  cameFromGhu = fromGhu;

  const backLink = document.getElementById('backLink');
  backLink.style.display = fromGhu ? 'inline-flex' : 'none';

  const h = window.DEPLOYMENT_DATA.hopitaux.find(x => x.nom === nom);
  if (!h) return;
  selectedHopital = h;

  document.getElementById('hName').textContent = h.nom;
  document.getElementById('hGh').textContent = h.gh;
  document.getElementById('kpiTaux').textContent = h.taux + '%';
  document.getElementById('kpiTaux').style.color = statusColor(h.taux);
  document.getElementById('kpiDeploye').textContent = h.deploye;
  document.getElementById('kpiNonDeploye').textContent = h.non_deploye;
  document.getElementById('kpiNonConcerne').textContent = h.non_concerne;

  const totalCalc = h.deploye + h.non_deploye;
  document.getElementById('hProgressFill').style.width = (totalCalc > 0 ? (100 * h.deploye / totalCalc) : 0) + '%';
  document.getElementById('hProgressFrac').textContent = `${h.deploye}/${totalCalc} déployés`;

  document.getElementById('tableSearch').value = '';
  document.getElementById('statutFilter').value = '';
  renderTable(h.services);

  map.flyTo([h.lat, h.lon], 14, { duration: 0.6 });
}

document.getElementById('backLink').addEventListener('click', () => {
  if (cameFromGhu) showGhuListe(cameFromGhu);
});

// tri : Non déployé en premier, puis Non concerné, puis Déployé
const STATUT_ORDER = { 'Non Déployé': 0, 'Non concerné': 1, 'Déployé': 2 };

function renderTable(services) {
  const tbody = document.getElementById('ufTableBody');
  tbody.innerHTML = '';
  const search = document.getElementById('tableSearch').value.toLowerCase();
  const statutFilter = document.getElementById('statutFilter').value;

  let filtered = services.filter(s => {
    const matchesSearch = !search || s.service.toLowerCase().includes(search) || s.uf.toLowerCase().includes(search);
    const matchesStatut = !statutFilter || s.statut === statutFilter;
    return matchesSearch && matchesStatut;
  });

  filtered = filtered.slice().sort((a, b) => (STATUT_ORDER[a.statut] ?? 3) - (STATUT_ORDER[b.statut] ?? 3));

  document.getElementById('rowCount').textContent = `${filtered.length} ligne(s) sur ${services.length}`;

  const rowClass = { 'Déployé': 'row-deploye', 'Non Déployé': 'row-non-deploye', 'Non concerné': 'row-non-concerne' };
  const shapeClass = { 'Déployé': 'deploye', 'Non Déployé': 'non-deploye', 'Non concerné': 'non-concerne' };

  filtered.forEach(s => {
    const cls = shapeClass[s.statut] || 'non-concerne';
    const tr = document.createElement('tr');
    tr.className = rowClass[s.statut] || '';
    tr.innerHTML = `
      <td>${s.service || '<em>—</em>'}</td>
      <td>${s.uf || '<em>—</em>'}</td>
      <td><span class="status-tag ${cls}"><span class="status-shape ${cls}"></span>${s.statut}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('tableSearch').addEventListener('input', () => { if (selectedHopital) renderTable(selectedHopital.services); });
document.getElementById('statutFilter').addEventListener('change', () => { if (selectedHopital) renderTable(selectedHopital.services); });

// ---- Recherche hôpital (carte) ----

const searchInput = document.getElementById('searchInput');
const suggestionsBox = document.getElementById('searchSuggestions');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  suggestionsBox.innerHTML = '';
  if (!q) { suggestionsBox.classList.remove('active'); return; }

  const matches = window.DEPLOYMENT_DATA.hopitaux.filter(h => h.nom.toLowerCase().includes(q)).slice(0, 8);
  if (matches.length === 0) { suggestionsBox.classList.remove('active'); return; }

  matches.forEach(h => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `<span>${h.nom}</span><span class="gh-tag">${h.taux}%</span>`;
    item.addEventListener('click', () => {
      searchInput.value = h.nom;
      suggestionsBox.classList.remove('active');
      showHopitalDetail(h.nom, null);
      map.flyTo([h.lat, h.lon], 14, { duration: 0.6 });
    });
    suggestionsBox.appendChild(item);
  });
  suggestionsBox.classList.add('active');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) suggestionsBox.classList.remove('active');
});

// ---- Bloc 4 : recherche globale par UF ----

const ufSearchInput = document.getElementById('ufSearchInput');
const ufSearchResults = document.getElementById('ufSearchResults');

function renderUfSearch() {
  const q = ufSearchInput.value.trim().toLowerCase();
  ufSearchResults.innerHTML = '';

  if (!q) {
    ufSearchResults.innerHTML = '<div class="uf-empty">Tapez le nom d\'une UF pour voir dans quels hôpitaux elle est déployée.</div>';
    return;
  }

  const data = window.DEPLOYMENT_DATA;
  const matchesByUf = {}; // nom UF exact -> [{hopital, gh, statut}]

  data.hopitaux.forEach(h => {
    h.services.forEach(s => {
      if (s.uf && s.uf.toLowerCase().includes(q)) {
        if (!matchesByUf[s.uf]) matchesByUf[s.uf] = [];
        matchesByUf[s.uf].push({ hopital: h.nom, gh: h.gh, statut: s.statut });
      }
    });
  });

  const ufNames = Object.keys(matchesByUf).sort();

  if (ufNames.length === 0) {
    ufSearchResults.innerHTML = '<div class="uf-empty">Aucune UF trouvée pour cette recherche.</div>';
    return;
  }

  const statusLabel = { 'Déployé': 'deploye', 'Non Déployé': 'non-deploye', 'Non concerné': 'non-concerne' };

  ufNames.slice(0, 25).forEach(ufNom => {
    const entries = matchesByUf[ufNom];
    const applicable = entries.filter(e => e.statut !== 'Non concerné');
    const deployedCount = entries.filter(e => e.statut === 'Déployé').length;
    const pct = applicable.length > 0 ? Math.round(100 * deployedCount / applicable.length) : 0;

    const group = document.createElement('div');
    group.className = 'uf-result-group';
    group.innerHTML = `<div class="uf-result-group-title">${ufNom}</div>
      <div class="uf-result-group-meta">Présente dans ${entries.length} hôpital(aux) · déployée dans ${pct}% des cas applicables</div>
      <div class="uf-result-cards"></div>`;

    const cardsWrap = group.querySelector('.uf-result-cards');
    entries.forEach(e => {
      const cls = statusLabel[e.statut] || 'non-concerne';
      const card = document.createElement('div');
      card.className = 'uf-mini-card';
      card.innerHTML = `
        <div class="umc-hopital">${e.hopital}</div>
        <div class="umc-gh">${e.gh}</div>
        <span class="umc-status status-tag ${cls}"><span class="status-shape ${cls}"></span>${e.statut}</span>
      `;
      cardsWrap.appendChild(card);
    });

    ufSearchResults.appendChild(group);
  });

  if (ufNames.length > 25) {
    const more = document.createElement('div');
    more.className = 'uf-empty';
    more.textContent = `+ ${ufNames.length - 25} autre(s) UF correspondante(s) — affinez la recherche pour les voir.`;
    ufSearchResults.appendChild(more);
  }
}

ufSearchInput.addEventListener('input', renderUfSearch);

// ---- Rendu global ----

window.renderAll = function () {
  buildGhuColorMap();
  buildMarkers();
  renderSummaryBar();
  showEmptyState();
  renderUfSearch();
};

initMap();
window.renderAll();
