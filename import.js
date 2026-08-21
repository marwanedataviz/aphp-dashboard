// Lit un fichier .xlsx côté navigateur et reconstruit la structure DEPLOYMENT_DATA
// (même logique que generate_data.py, en JS pour fonctionner sans script externe)

function buildDeploymentData(rows, fileName) {
  // rows[0] = ligne de métadonnées (date de maj dans la colonne statut)
  // rows[1..] = données : gh, hopital, service, uf, statut
  let dateMaj = new Date().toISOString().slice(0, 10);
  const rawDate = rows[0] && rows[0][4];
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d)) dateMaj = d.toISOString().slice(0, 10);
  }

  const byHopital = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue; // pas de nom d'hôpital
    const [gh, hopital, service, uf, statutRaw] = row;
    if (EXCLUDE_ENTITIES.includes(hopital)) continue;
    if (!HOPITAL_COORDS[hopital]) continue; // hôpital inconnu, pas de coordonnées

    const statut = statutRaw || 'Non renseigné';
    if (!byHopital[hopital]) {
      byHopital[hopital] = { gh: gh || '', services: [], deploye: 0, non_deploye: 0, non_concerne: 0 };
    }
    const h = byHopital[hopital];
    h.gh = h.gh || gh || '';
    h.services.push({ service: service || '', uf: uf || '', statut });
    if (statut === 'Déployé') h.deploye++;
    else if (statut === 'Non Déployé') h.non_deploye++;
    else h.non_concerne++;
  }

  const hopitaux = Object.keys(byHopital).sort().map(nom => {
    const h = byHopital[nom];
    const totalCalc = h.deploye + h.non_deploye;
    const taux = totalCalc > 0 ? Math.round((100 * h.deploye / totalCalc) * 10) / 10 : 0;
    const [lat, lon] = HOPITAL_COORDS[nom];
    return {
      nom, gh: h.gh, lat, lon,
      deploye: h.deploye, non_deploye: h.non_deploye, non_concerne: h.non_concerne,
      total: h.deploye + h.non_deploye + h.non_concerne,
      taux, services: h.services
    };
  });

  // Agrégats par GHU
  const ghMap = {};
  hopitaux.forEach(h => {
    if (!ghMap[h.gh]) ghMap[h.gh] = { nom: h.gh, hopitaux: [], deploye: 0, non_deploye: 0, non_concerne: 0, latSum: 0, lonSum: 0 };
    const g = ghMap[h.gh];
    g.hopitaux.push(h.nom);
    g.deploye += h.deploye;
    g.non_deploye += h.non_deploye;
    g.non_concerne += h.non_concerne;
    g.latSum += h.lat;
    g.lonSum += h.lon;
  });

  const ghu = Object.keys(ghMap).sort().map(nom => {
    const g = ghMap[nom];
    const n = g.hopitaux.length;
    const totalCalc = g.deploye + g.non_deploye;
    const taux = totalCalc > 0 ? Math.round((100 * g.deploye / totalCalc) * 10) / 10 : 0;
    return {
      nom, lat: g.latSum / n, lon: g.lonSum / n, nb_hopitaux: n,
      deploye: g.deploye, non_deploye: g.non_deploye, non_concerne: g.non_concerne,
      total: g.deploye + g.non_deploye + g.non_concerne, taux
    };
  });

  return { date_maj: dateMaj, source_file: fileName, hopitaux, ghu, is_demo_data: false };
}

function initImport() {
  const fileInput = document.getElementById('fileInput');
  const importMsg = document.getElementById('importMsg');
  const lastFileInfo = document.getElementById('lastFileInfo');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rows || rows.length < 2) {
          throw new Error('Fichier vide ou format inattendu.');
        }

        const newData = buildDeploymentData(rows, file.name);

        if (newData.hopitaux.length === 0) {
          throw new Error('Aucun hôpital reconnu — vérifiez que les colonnes sont dans le bon ordre (GH, Hôpital, Service, UF, Statut).');
        }

        window.DEPLOYMENT_DATA = newData;
        if (window.renderAll) window.renderAll();
        document.getElementById('demoBadge').style.display = 'none';

        importMsg.textContent = `✓ Import réussi (${newData.hopitaux.length} hôpitaux)`;
        importMsg.className = 'import-msg success';
        lastFileInfo.textContent = `Dernier fichier : ${file.name} — ${new Date().toLocaleString('fr-FR')}`;
      } catch (err) {
        importMsg.textContent = '✗ Erreur : ' + err.message;
        importMsg.className = 'import-msg error';
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

document.addEventListener('DOMContentLoaded', initImport);
