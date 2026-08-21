"""
Régénère data.js à partir d'un export Excel AP-HP.
Usage : python generate_data.py chemin_vers_fichier.xlsx

Le fichier Excel doit avoir la même structure que Dep_APHP.xlsx :
colonnes = Libelle GH, Libelle Hopital, Libellé Service, Libellé UF, statut
avec la ligne 1 = date de mise à jour, et les vraies données commençant ligne 2.
"""
import sys
import json
import pandas as pd

# Coordonnées connues des hôpitaux Paris/IDF (à compléter si de nouveaux
# établissements apparaissent dans un futur export)
COORDS = {
    "GH A.CHENEVIER-H.MONDOR": [48.7975, 2.4497],
    "GH ARMAND TROUSSEAU-LA ROCHE GUYON": [48.8399, 2.4014],
    "GH BROCA-LA COLLEGIALE": [48.8339, 2.3417],
    "GH COCHIN": [48.8375, 2.3372],
    "GH LARIBOISIERE FERNAND WIDAL": [48.8814, 2.3554],
    "GROUPE HOSPITAL.NECKER ENFANTS MALADES": [48.8461, 2.3151],
    "GROUPE HOSPITALIER PITIE-LA SALPETRIERE": [48.8377, 2.3654],
    "HEGP": [48.8386, 2.2724],
    "HOPITAL ADELAIDE HAUTVAL": [48.8896, 2.3547],
    "HOPITAL AMBROISE PARE": [48.8347, 2.2019],
    "HOPITAL ANTOINE BECLERE": [48.7737, 2.2707],
    "HOPITAL AVICENNE": [48.9308, 2.3606],
    "HOPITAL BEAUJON": [48.9106, 2.3053],
    "HOPITAL BICHAT": [48.8975, 2.3316],
    "HOPITAL BRETONNEAU": [48.8976, 2.3378],
    "HOPITAL CHARLES FOIX": [48.7975, 2.3986],
    "HOPITAL CORENTIN CELTON": [48.8226, 2.2731],
    "HOPITAL DE BICETRE": [48.8020, 2.3573],
    "HOPITAL DE LA ROCHE-GUYON": [49.0847, 1.6167],
    "HOPITAL DE VAUGIRARD-GABRIEL PALLEZ": [48.8377, 2.2976],
    "HOPITAL DUPUYTREN": [48.7089, 2.4103],
    "HOPITAL EMILE ROUX": [48.7908, 2.4358],
    "HOPITAL GEORGES CLEMENCEAU": [48.7908, 2.4460],
    "HOPITAL JEAN VERDIER": [48.9346, 2.4308],
    "HOPITAL LOUIS MOURIER": [48.9083, 2.2489],
    "HOPITAL PAUL BROUSSE": [48.7891, 2.3673],
    "HOPITAL PAUL DOUMER": [48.9385, 2.3181],
    "HOPITAL RAYMOND POINCARE": [48.8022, 2.1289],
    "HOPITAL RENE MURET - BIGOTTINI": [48.9385, 2.4181],
    "HOPITAL ROBERT DEBRE": [48.8813, 2.3969],
    "HOPITAL ROTHSCHILD": [48.8532, 2.3934],
    "HOPITAL SAINT ANTOINE": [48.8494, 2.3822],
    "HOPITAL SAINT LOUIS": [48.8722, 2.3672],
    "HOPITAL STE PERINE": [48.8567, 2.2661],
    "HOPITAL TENON": [48.8600, 2.3986],
    "HOTEL-DIEU DE PARIS": [48.8531, 2.3486],
}

# Entités à exclure : hors Paris/IDF ou non-géographiques
EXCLUDE = [
    'ADMINISTRATION GENERALE A.P.H.P.', 'AGEPS', 'EEAP SAN SALVADOUR',
    'HOPITAL MARITIME DE BERCK', 'HOPITAL MARIN D HENDAYE',
    'HOPITAL SAN SALVADOUR', 'HOSPITALISATION A DOMICILE', 'MAS SAN SALVADOUR'
]


def main():
    if len(sys.argv) < 2:
        print("Usage : python generate_data.py chemin_vers_fichier.xlsx")
        sys.exit(1)

    path = sys.argv[1]
    raw = pd.read_excel(path, sheet_name=0)
    raw.columns = ['gh', 'hopital', 'service', 'uf', 'statut']

    # Récupère la date de mise à jour (ligne 0, colonne "statut" dans le fichier source)
    date_maj = raw.iloc[0]['statut']
    try:
        date_maj = pd.to_datetime(date_maj).strftime('%Y-%m-%d')
    except Exception:
        date_maj = str(date_maj)

    df = raw.iloc[1:].copy()
    df = df.dropna(subset=['hopital'])
    df = df[~df['hopital'].isin(EXCLUDE)]
    df['statut'] = df['statut'].fillna('Non renseigné')

    missing_coords = [h for h in df['hopital'].unique() if h not in COORDS]
    if missing_coords:
        print("ATTENTION - hôpitaux sans coordonnées connues (à ajouter dans COORDS) :")
        for m in missing_coords:
            print("  -", m)
        df = df[~df['hopital'].isin(missing_coords)]

    gh_lookup = df.groupby('hopital')['gh'].first().to_dict()

    hopitaux_data = []
    for h, coord in COORDS.items():
        sub = df[df['hopital'] == h]
        if sub.empty:
            continue
        deploye = int((sub['statut'] == 'Déployé').sum())
        non_deploye = int((sub['statut'] == 'Non Déployé').sum())
        non_concerne = int((sub['statut'] == 'Non concerné').sum())
        # "Non concerné" est exclu du calcul (hors périmètre) - affiché seulement à titre indicatif
        total_calc = deploye + non_deploye
        taux = round(100 * deploye / total_calc, 1) if total_calc > 0 else 0
        total = deploye + non_deploye + non_concerne
        services = [
            {
                "service": row['service'] if pd.notna(row['service']) else "",
                "uf": row['uf'] if pd.notna(row['uf']) else "",
                "statut": row['statut']
            }
            for _, row in sub.iterrows()
        ]
        hopitaux_data.append({
            "nom": h, "gh": gh_lookup.get(h, ""),
            "lat": coord[0], "lon": coord[1],
            "deploye": deploye, "non_deploye": non_deploye, "non_concerne": non_concerne,
            "total": total, "taux": taux, "services": services
        })

    hopitaux_data.sort(key=lambda x: x['nom'])
    output = {"date_maj": date_maj, "hopitaux": hopitaux_data}

    with open('data.js', 'w', encoding='utf-8') as f:
        f.write("// Données générées depuis " + path + "\n")
        f.write("const DEPLOYMENT_DATA = ")
        f.write(json.dumps(output, ensure_ascii=False, indent=2))
        f.write(";\n")

    print(f"OK — data.js régénéré ({len(hopitaux_data)} hôpitaux, "
          f"{sum(len(h['services']) for h in hopitaux_data)} lignes)")


if __name__ == '__main__':
    main()
