const brochureContent = {
  safras: {
    name: 'SAFRAS INÉDITAS',
    website: 'https://www.safrasineditas.com',
    logo: '/brand-assets/safras-ineditas.png',
    color: '#17483f', accent: '#c59a53',
    eyebrow: 'Déstockage structuré & sourcing international',
    headline: 'Des produits reconnus, dans un cadre d’achat clair et maîtrisé.',
    intro: 'SAFRAS INÉDITAS accompagne les professionnels dans la qualification d’opportunités, la structuration des conditions commerciales et l’organisation de la remise des marchandises.',
    pillars: [
      ['Sourcing et qualification', 'Sélection de lots selon les références, formats, volumes et besoins du marché.'],
      ['Conditions lisibles', 'Offres clarifiées avec une base de prix EXW et des informations utiles à la décision.'],
      ['Remise et logistique', 'Enlèvement, point relais ou transport selon l’offre et la situation.'],
      ['Suivi de l’opération', 'Un interlocuteur accompagne les étapes, de la demande jusqu’à la remise.'],
    ],
    families: ['Boissons', 'Épicerie sucrée', 'Café & petit déjeuner', 'Snacks & biscuits', 'Hygiène & cosmétique', 'Entretien & maison'],
    footer: 'Négoce professionnel · Opportunités de lots · Sourcing international',
  },
  fikra: {
    name: 'FIKRA MATIF',
    website: 'https://fikramatif.com',
    logo: '/brand-assets/fikra-matif.png',
    color: '#153b55', accent: '#c48749',
    eyebrow: 'Intermédiation & réseau d’affaires',
    headline: 'Les bons interlocuteurs, réunis autour d’opportunités concrètes.',
    intro: 'FIKRA MATIF facilite les mises en relation entre fournisseurs et acheteurs professionnels. Le réseau qualifie le besoin, vérifie la compatibilité et présente chaque partie avec le bon contexte.',
    pillars: [
      ['Qualification du besoin', 'Comprendre le produit recherché, les volumes et les attentes de chaque partie.'],
      ['Réseau professionnel', 'Identifier des contacts et des opportunités cohérents avec le besoin exprimé.'],
      ['Mise en relation contextualisée', 'Présenter les interlocuteurs avec les informations nécessaires pour engager la discussion.'],
      ['Suivi après présentation', 'Rester disponible pour faciliter la suite et lever les points de blocage.'],
    ],
    families: ['Boissons', 'Café', 'Épicerie', 'Snacks & biscuits', 'Hygiène', 'Entretien'],
    footer: 'Intermédiation · Mise en relation · Réseau professionnel France–Algérie',
  },
};

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function printMarketingBrochure(brand, issuer = {}, recipient = '') {
  const content = brochureContent[brand];
  if (!content) throw new Error('Choisis SAFRAS INÉDITAS ou FIKRA MATIF.');
  const windowRef = window.open('', '_blank');
  if (!windowRef) throw new Error('Autorise les fenêtres contextuelles pour préparer la plaquette.');
  const phone = [issuer.phone_country_code, issuer.phone_number].filter(Boolean).join(' ');
  const email = issuer.email || '';
  const address = [issuer.address, issuer.postal_code, issuer.city, issuer.country].filter(Boolean).join(', ');
  const recipientLine = recipient ? `<p class="recipient">Document préparé pour <strong>${escapeHtml(recipient)}</strong></p>` : '';
  const contactItems = [phone, email, issuer.website || content.website, address].filter(Boolean);
  const contactHtml = contactItems.map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  windowRef.document.write(`<!doctype html><html lang="fr"><head><base href="${location.origin}/"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plaquette ${escapeHtml(content.name)}</title><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9edf0;color:#15202b;font:11pt/1.5 Arial,sans-serif}.sheet{width:210mm;min-height:297mm;margin:12mm auto;background:white;overflow:hidden;position:relative}.hero{padding:17mm 18mm 15mm;color:#fff;background:linear-gradient(125deg,${content.color},#10242f)}.brand{display:flex;align-items:center;gap:9mm}.brand img{display:block;max-width:57mm;max-height:25mm;object-fit:contain;background:#fff;border-radius:4mm;padding:3mm}.brand strong{font-size:12pt;letter-spacing:1.3pt}.eyebrow{margin:12mm 0 3mm;color:${content.accent};font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1pt}.hero h1{margin:0;max-width:160mm;font-size:29pt;line-height:1.12}.intro{margin:6mm 0 0;max-width:160mm;color:#e6edf0;font-size:12pt}.recipient{margin:8mm 0 0;color:#fff}.body{padding:13mm 18mm 12mm}.section-title{margin:0 0 6mm;color:${content.color};font-size:15pt}.pillars{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.pillar{padding:5mm;border:1px solid #e0e5e7;border-radius:3mm}.pillar h3{margin:0 0 2mm;color:${content.color};font-size:11pt}.pillar p{margin:0;color:#4f5c62;font-size:9.5pt}.family-wrap{margin-top:10mm;padding:7mm;border-radius:3mm;background:#f2f5f5}.families{display:flex;flex-wrap:wrap;gap:2.5mm}.family{padding:2mm 3.5mm;border-radius:10mm;background:#fff;border:1px solid #dfe5e4;font-size:9pt}.closing{margin-top:9mm;color:#46545b}.footer{position:absolute;left:0;right:0;bottom:0;padding:7mm 18mm;background:${content.color};color:#fff;display:flex;justify-content:space-between;gap:6mm;align-items:center;font-size:8.5pt}.footer span{max-width:48%}.footer .accent{color:#f1d29c;text-align:right}.toolbar{position:sticky;top:0;z-index:1;width:210mm;margin:0 auto 8mm;padding:4mm;background:#fff;display:flex;justify-content:flex-end;gap:3mm}.toolbar button{border:0;border-radius:2mm;padding:3mm 5mm;background:${content.color};color:#fff;font-weight:bold;cursor:pointer}@media print{body{background:#fff}.toolbar{display:none}.sheet{margin:0;width:210mm;height:297mm;min-height:297mm;page-break-after:avoid}}
    </style></head><body><nav class="toolbar"><button onclick="window.print()">Imprimer / enregistrer en PDF</button><button onclick="window.close()">Fermer</button></nav><main class="sheet"><header class="hero"><div class="brand"><img src="${content.logo}" alt="Logo ${escapeHtml(content.name)}"><strong>${escapeHtml(content.name)}</strong></div><p class="eyebrow">${escapeHtml(content.eyebrow)}</p><h1>${escapeHtml(content.headline)}</h1><p class="intro">${escapeHtml(content.intro)}</p>${recipientLine}</header><section class="body"><h2 class="section-title">Un accompagnement pensé pour les professionnels</h2><div class="pillars">${content.pillars.map(([title, description]) => `<article class="pillar"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></article>`).join('')}</div><div class="family-wrap"><h2 class="section-title">Univers suivis</h2><div class="families">${content.families.map((family) => `<span class="family">${escapeHtml(family)}</span>`).join('')}</div></div><p class="closing">Parlons de votre besoin, des volumes recherchés et des conditions souhaitées. Une présentation claire permet d’avancer rapidement vers une proposition adaptée.</p></section><footer class="footer"><span>${escapeHtml(content.footer)}</span><span class="accent">${contactHtml}</span></footer></main><script>window.addEventListener('load',()=>{const logo=document.querySelector('.brand img');if(logo)logo.addEventListener('error',()=>logo.style.display='none')});</script></body></html>`);
  windowRef.document.close();
}
