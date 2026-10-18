(function(){
const RATE=655.957;
const CATS=['Carburant','Entretien & pièces','Réparation','Assurance','Visite technique & vignette','Amende / police','Ménage & linge','Eau, électricité, internet','Charges & loyer','Commission plateforme','Salaire','Autre','Non classé'];
const PRESETS=['Assurance','Visite technique','Vignette','Vidange','Révision','Contrôle des pneus','Permis / carte grise','Loyer / charges'];
const MS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const MF=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const TABS=[['dash','Tableau de bord'],['saisie','Saisie de la semaine'],['veh','Véhicules'],['bnb','Airbnb'],['rem','Échéances'],['jou','Journal'],['data','Données']];

const pd=s=>{const a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addDays=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return iso(d)};
const monday=s=>{const d=pd(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d)};
const today=iso(new Date());
const fd=s=>{const d=pd(s);return d.getDate()+' '+MS[d.getMonth()]};
const fdy=s=>fd(s)+' '+pd(s).getFullYear();
const nf=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const uid=()=>Math.random().toString(36).slice(2,10);
const sum=(a,f)=>a.reduce((t,x)=>t+(f?f(x):x),0);

let store=null, dl=null;
const S={vehicles:[],ops:[],rems:[],stays:[],tab:'dash',period:'y'+today.slice(0,4),cur:'FCFA',week:monday(today),
  calMonth:today.slice(0,7),editOp:null,jv:'all',jt:'all',ready:false,nodb:false};
try{const t=localStorage.getItem('hs_tab'),c=localStorage.getItem('hs_cur');if(t&&TABS.some(x=>x[0]===t))S.tab=t;if(c==='EUR'||c==='FCFA')S.cur=c}catch(e){}

function fmt(n,c){c=c||S.cur;return c==='EUR'?nf.format(Math.round(n/RATE))+' €':nf.format(Math.round(n))+' F'}
const other=()=>S.cur==='EUR'?'FCFA':'EUR';
const sgn=n=>n>=0?'pos':'neg';
function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2600)}
const vname=id=>{const v=S.vehicles.find(x=>x.id===id);return v?v.name:'—'};
const vget=id=>S.vehicles.find(x=>x.id===id);
const vcol=v=>'var(--'+(v&&v.color?v.color:'c'+(v&&v.order?v.order:1))+')';
const COLORS=[['c1','Turquoise'],['c2','Or'],['c3','Indigo'],['c4','Rose'],['c5','Vert'],['c6','Ardoise']];
const vcode=v=>v?(v.code||v.name):'—';
const tag=v=>v?'<span class="tag"><i style="background:'+vcol(v)+'"></i>'+esc(vcode(v))+'</span>':'';
const plate=v=>v&&v.plate?'<span class="plate">'+esc(v.plate)+'</span>':'';
const isDrv=v=>v.kind==='taxi'||v.kind==='camion';

/* ---------- périodes ---------- */
function years(){const s=new Set([today.slice(0,4)]);S.ops.forEach(o=>s.add(o.week.slice(0,4)));return [...s].sort().reverse()}
function inP(w,p){p=p||S.period;if(p==='all')return true;
  if(p[0]==='y')return w.slice(0,4)===p.slice(1);
  if(p[0]==='q'){const y=p.slice(1,5),q=+p.slice(6);return w.slice(0,4)===y&&Math.ceil(+w.slice(5,7)/3)===q}
  if(p[0]==='m')return w.slice(0,7)===p.slice(1);return true}
function pRange(p){p=p||S.period;const y=p[0]==='y'?+p.slice(1):p[0]==='q'||p[0]==='m'?+p.slice(1,5):+today.slice(0,4);
  if(p[0]==='m'){const m=+p.slice(6);return [iso(new Date(y,m-1,1)),iso(new Date(y,m,0))]}
  if(p[0]==='q'){const q=+p.slice(6);return [iso(new Date(y,(q-1)*3,1)),iso(new Date(y,q*3,0))]}
  return [y+'-01-01',y+'-12-31']}
function pLabel(p){p=p||S.period;if(p==='all')return 'Toute la période';if(p[0]==='y')return 'Année '+p.slice(1);
  if(p[0]==='q')return 'T'+p.slice(6)+' '+p.slice(1,5);return MF[+p.slice(6)-1]+' '+p.slice(1,5)}
function periodSelect(){let h='<select id="period" aria-label="Période"><option value="all"'+(S.period==='all'?' selected':'')+'>Toute la période</option>';
  years().forEach(y=>{h+='<optgroup label="'+y+'"><option value="y'+y+'">Année '+y+'</option>';
    for(let q=1;q<=4;q++)h+='<option value="q'+y+'-'+q+'">T'+q+' '+y+'</option>';
    for(let m=1;m<=12;m++)h+='<option value="m'+y+'-'+String(m).padStart(2,'0')+'">'+MF[m-1]+' '+y+'</option>';
    h+='</optgroup>'});
  h+='</select>';return h.replace('value="'+S.period+'"','value="'+S.period+'" selected')}

/* ---------- calculs ---------- */
function vstat(vid,flt){const o=S.ops.filter(x=>x.vid===vid&&(!flt||flt(x)));
  const rec=sum(o.filter(x=>x.type==='recette'),x=>x.amount),chg=sum(o.filter(x=>x.type==='charge'),x=>x.amount);
  return {rec,chg,res:rec-chg,ops:o}}
function byCat(ops){const m={};ops.filter(o=>o.type==='charge').forEach(o=>m[o.cat||'Autre']=(m[o.cat||'Autre']||0)+o.amount);
  return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function compact(v){const x=S.cur==='EUR'?v/RATE:v;if(x>=1e6)return (x/1e6).toFixed(1).replace('.',',')+' M';if(x>=1e3)return Math.round(x/1e3)+' k';return String(Math.round(x))}
function niceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p}

/* ---------- composants ---------- */
function dual(n){return '<b>'+fmt(n)+'</b><small>'+fmt(n,other())+'</small>'}
function kpi(l,n,cls,sub){return '<div class="kpi"><div class="l">'+l+'</div><div class="v '+(cls||'')+'">'+fmt(n)+'</div><div class="s">'+(sub||fmt(n,other()))+'</div></div>'}
function vopts(sel,only){return S.vehicles.filter(v=>!only||only(v)).map(v=>'<option value="'+v.id+'"'+(v.id===sel?' selected':'')+'>'+esc(vcode(v)+' · '+v.name)+'</option>').join('')}
function catOpts(sel){return CATS.map(c=>'<option'+(c===sel?' selected':'')+'>'+c+'</option>').join('')}

/* ---------- vues ---------- */
function viewDash(){
  const ops=S.ops.filter(o=>inP(o.week));
  const rec=sum(ops.filter(o=>o.type==='recette'),o=>o.amount),chg=sum(ops.filter(o=>o.type==='charge'),o=>o.amount),res=rec-chg;
  const margin=rec>0?Math.round(res/rec*100):0;
  const owed=sum(ops.filter(o=>o.expected!=null),o=>o.expected-o.amount);
  const hasExp=ops.some(o=>o.expected!=null);
  let h='';
  if(!S.vehicles.length)h+='<div class="panel"><h2>Bienvenue</h2><p>Aucune donnée pour le moment. Importez la sauvegarde de votre ancien outil ou créez vos 4 activités.</p><div class="ac" style="flex-wrap:wrap;gap:10px"><label class="btn pri" style="cursor:pointer">Importer ma sauvegarde<input type="file" id="imp_file" accept="application/json,.json" hidden></label><button class="btn" data-act="initdefaults">Créer les activités</button></div></div>';
  h+='<div class="toolbar"><label for="period">Période</label>'+periodSelect()+'</div>';
  h+='<div class="kpis">'+kpi('Recettes',rec)+kpi('Charges',chg)+kpi('Résultat',res,sgn(res),'Marge '+margin+' % des recettes')+
     (hasExp?kpi('Versements en retard',Math.max(0,owed),owed>0?'neg':'pos','Attendu moins reçu, chauffeurs'):kpi('Résultat moyen / semaine',res/Math.max(1,new Set(ops.map(o=>o.week)).size),'', 'Sur les semaines saisies'))+'</div>';
  h+=rankPanel(ops);
  // véhicules
  let rows='<div class="vrow vhead"><div>Activité</div><div>Recettes</div><div>Charges</div><div>Résultat</div><div class="pct">Part</div></div>';
  const totRes=Math.max(1,sum(S.vehicles,v=>Math.max(0,vstat(v.id,o=>inP(o.week)).res)));
  S.vehicles.forEach(v=>{const s=vstat(v.id,o=>inP(o.week));
    rows+='<div class="vrow"><div class="n"><span>'+tag(v)+' '+esc(v.name)+' '+plate(v)+'<small>'+esc(v.driver?'Chauffeur : '+v.driver:v.kind==='logement'?'Airbnb':'')+'</small></span></div>'+
      '<div class="cell">'+dual(s.rec)+'</div><div class="cell">'+dual(s.chg)+'</div><div class="cell '+sgn(s.res)+'">'+dual(s.res)+'</div><div class="pct chip">'+(s.res>0?Math.round(s.res/totRes*100):0)+' %</div></div>'});
  h+='<div class="panel"><h2>Par véhicule et activité</h2>'+rows+'</div>';
  // graphique + catégories
  h+='<div class="grid2"><div class="panel"><h2>Mois par mois</h2>'+monthChart()+'</div>';
  const cats=byCat(ops),mx=cats.length?cats[0][1]:1;
  h+='<div class="panel"><h2>Où part l\'argent</h2>'+(cats.length?'<div class="bars">'+cats.slice(0,8).map(c=>'<div class="brow"><span>'+esc(c[0])+'</span><span class="t"><b style="width:'+Math.max(2,c[1]/mx*100)+'%"></b></span><span>'+fmt(c[1])+'</span></div>').join('')+'</div>'+
    (cats[0][0]==='Non classé'?'<p class="hint">Les charges de l\'ancien fichier sont « Non classé ». Classez les nouvelles dépenses pour voir le détail.</p>':''):'<div class="empty">Aucune charge sur cette période.</div>')+'</div></div>';
  // échéances proches
  const soon=S.rems.filter(r=>!r.done).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3);
  if(soon.length)h+='<div class="panel"><h2>Prochaines échéances</h2><div class="list">'+soon.map(remItem).join('')+'</div></div>';
  return h}

function rankPanel(ops){
  const L=S.vehicles.filter(isDrv).map(v=>{const o=ops.filter(x=>x.vid===v.id),rec=sum(o.filter(x=>x.type==='recette'),x=>x.amount),chg=sum(o.filter(x=>x.type==='charge'),x=>x.amount),wk=new Set(o.filter(x=>x.type==='recette'&&x.amount>0).map(x=>x.week)).size;
    return {v,rec,chg,res:rec-chg,wk}}).sort((a,b)=>b.res-a.res);
  if(!L.length)return '';
  const mx=Math.max(1,...L.map(x=>Math.abs(x.res)));
  return '<div class="panel"><h2>Quel véhicule et quel chauffeur rapportent le plus</h2>'+L.map((x,i)=>
    '<div class="rank"><div class="pos1">'+(i+1)+'</div><div class="id"><span class="nm">'+tag(x.v)+' '+esc(x.v.name)+'</span><span class="hint">'+esc(x.v.driver?'Chauffeur : '+x.v.driver:'Chauffeur non renseigné')+' '+plate(x.v)+'</span></div>'+
    '<div class="bw"><div class="t"><b style="width:'+Math.max(2,Math.abs(x.res)/mx*100)+'%;background:'+vcol(x.v)+'"></b></div><div class="hint" style="margin-top:4px">Marge '+(x.rec>0?Math.round(x.res/x.rec*100):0)+' % · charges '+(x.rec>0?Math.round(x.chg/x.rec*100):0)+' % des recettes'+(x.wk?' · '+fmt(x.res/x.wk)+' / semaine travaillée':'')+'</div></div>'+
    '<div class="cell rs '+sgn(x.res)+'">'+dual(x.res)+'</div></div>').join('')+
    '<p class="hint" style="margin-bottom:0">Classement sur la période choisie. Si un chauffeur change de véhicule, l\'historique reste rattaché au véhicule.</p></div>'}

function monthChart(){
  const y=S.period==='all'?today.slice(0,4):pRange()[0].slice(0,4);
  const R=Array(12).fill(0),C=Array(12).fill(0);
  S.ops.filter(o=>o.week.slice(0,4)===y).forEach(o=>{const m=+o.week.slice(5,7)-1;if(o.type==='recette')R[m]+=o.amount;else C[m]+=o.amount});
  const top=niceMax(Math.max(...R,...C,1)),W=640,H=230,L=48,B=26,T=10,pw=W-L-4,ph=H-B-T,gw=pw/12;
  let s='<div class="legend"><span><i style="background:var(--accent)"></i>Recettes</span><span><i style="background:var(--muted2)"></i>Charges</span><span>'+y+'</span></div>';
  s+='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Recettes et charges par mois en '+y+'">';
  for(let i=0;i<=4;i++){const v=top*i/4,yy=T+ph-ph*i/4;s+='<line class="gl" x1="'+L+'" x2="'+W+'" y1="'+yy+'" y2="'+yy+'"/><text x="'+(L-6)+'" y="'+(yy+4)+'" text-anchor="end">'+compact(v)+'</text>'}
  for(let m=0;m<12;m++){const x=L+m*gw,bw=gw*.36,hr=R[m]/top*ph,hc=C[m]/top*ph;
    s+='<rect class="b-rec" x="'+(x+gw*.1)+'" y="'+(T+ph-hr)+'" width="'+bw+'" height="'+hr+'" rx="2"/><rect class="b-chg" x="'+(x+gw*.1+bw+2)+'" y="'+(T+ph-hc)+'" width="'+bw+'" height="'+hc+'" rx="2"/>';
    s+='<text x="'+(x+gw/2)+'" y="'+(H-8)+'" text-anchor="middle">'+MS[m].replace('.','')+'</text>'}
  return s+'</svg>'}

function weekNav(){return '<div class="wk"><button class="btn sm" data-act="wprev" aria-label="Semaine précédente">‹</button><b>Semaine du '+fdy(S.week)+'</b><button class="btn sm" data-act="wnext" aria-label="Semaine suivante">›</button><input type="date" id="w_date" value="'+S.week+'" aria-label="Choisir une date"></div>'}

function viewSaisie(){
  const drv=S.vehicles.filter(isDrv);
  let h='<div class="panel">'+weekNav()+'</div>';
  h+='<div class="panel"><h2>Versements des chauffeurs</h2><p class="hint" style="margin:-6px 0 6px">Jours travaillés et montant reçu. L\'écart avec le versement attendu est calculé pour vous.</p>';
  drv.forEach(v=>{const op=S.ops.find(o=>o.id==='rv_'+v.id+'_'+S.week);
    h+='<div class="drow" data-vid="'+v.id+'"><div>'+tag(v)+' <b>'+esc(v.name)+'</b><div class="hint">'+(v.driver?esc(v.driver)+' · ':'')+fmt(v.rate)+' / jour '+plate(v)+'</div></div>'+
      '<label class="field"><span>Jours</span><input type="number" min="0" max="7" id="d_'+v.id+'" value="'+(op&&op.days!=null?op.days:6)+'"></label>'+
      '<label class="field"><span>Reçu (F CFA)</span><input type="number" min="0" step="500" id="r_'+v.id+'" value="'+(op?op.amount:'')+'" placeholder="'+(6*v.rate)+'"></label>'+
      '<div id="e_'+v.id+'" class="hint"></div><button class="btn sm" data-act="fillexp" data-vid="'+v.id+'">Tout reçu</button></div>'});
  h+='<div style="margin-top:10px"><button class="btn pri" data-act="savevers">Enregistrer les versements</button></div></div>';
  h+='<div class="panel"><h2>Ajouter une charge</h2><div class="form">'+
    '<label class="field"><span>Véhicule / activité</span><select id="c_vid">'+vopts()+'</select></label>'+
    '<label class="field"><span>Catégorie</span><select id="c_cat">'+catOpts('Carburant')+'</select></label>'+
    '<label class="field"><span>Montant</span><div class="amt"><input type="number" min="0" id="c_amt" placeholder="0"><select id="c_unit"><option>FCFA</option><option>EUR</option></select></div><span class="hint" id="c_eq"></span></label>'+
    '<label class="field"><span>Note</span><input type="text" id="c_note" placeholder="ex. plein, vidange…"></label>'+
    '<button class="btn pri" data-act="addcharge">Ajouter</button></div></div>';
  const bn=S.vehicles.filter(v=>!isDrv(v));
  h+='<div class="panel"><h2>Recette Airbnb ou autre</h2><div class="form">'+
    '<label class="field"><span>Activité</span><select id="a_vid">'+vopts(bn[0]&&bn[0].id,v=>!isDrv(v))+'</select></label>'+
    '<label class="field"><span>Canal</span><select id="a_chan"><option>Airbnb</option><option>Réservation directe</option><option>Autre</option></select></label>'+
    '<label class="field"><span>Montant</span><div class="amt"><input type="number" min="0" id="a_amt" placeholder="0"><select id="a_unit"><option>FCFA</option><option>EUR</option></select></div><span class="hint" id="a_eq"></span></label>'+
    '<label class="field"><span>Note</span><input type="text" id="a_note" placeholder="ex. séjour de Marie"></label>'+
    '<button class="btn pri" data-act="addrec">Ajouter</button></div><p class="hint">Pour suivre les nuits et le taux d\'occupation, utilisez plutôt l\'onglet Airbnb avec les dates du séjour.</p></div>';
  const wk=S.ops.filter(o=>o.week===S.week&&!o.id.startsWith('rv_'));
  if(wk.length)h+='<div class="panel"><h2>Autres opérations de cette semaine</h2><div class="list">'+wk.map(opItem).join('')+'</div></div>';
  return h}

function opItem(o){
  if(S.editOp===o.id)return '<div class="it"><div class="edit">'+
    '<div class="form"><label class="field"><span>Montant (F CFA)</span><input type="number" id="x_amt" value="'+o.amount+'"></label>'+
    '<label class="field"><span>Catégorie</span><select id="x_cat">'+catOpts(o.cat)+'</select></label>'+
    '<label class="field"><span>Note</span><input type="text" id="x_note" value="'+esc(o.note||'')+'"></label>'+
    '<span class="ac"><button class="btn sm pri" data-act="saveop" data-id="'+o.id+'">Enregistrer</button><button class="btn sm" data-act="cancel">Annuler</button></span></div></div></div>';
  return '<div class="it"><div class="d">'+fd(o.week)+'</div><div class="w">'+tag(vget(o.vid))+' '+esc(o.cat||'')+(o.note?'<small>'+esc(o.note)+'</small>':'')+(o.expected!=null&&o.amount<o.expected?'<small class="neg">Écart : −'+fmt(o.expected-o.amount)+'</small>':'')+'</div>'+
    '<div class="'+(o.type==='recette'?'pos':'neg')+'"><b>'+(o.type==='recette'?'+':'−')+fmt(o.amount)+'</b></div>'+
    '<div class="ac"><button class="btn sm" data-act="editop" data-id="'+o.id+'">Modifier</button><button class="btn sm danger" data-act="del" data-kind="ops" data-id="'+o.id+'">Supprimer</button></div></div>'}

function viewVeh(){
  let h='<div class="toolbar"><label for="period">Période</label>'+periodSelect()+'</div><div class="grid2">';
  S.vehicles.forEach(v=>{
    const p=vstat(v.id,o=>inP(o.week)),a=vstat(v.id);
    const wks=a.ops.map(o=>o.week).sort(),span=wks.length?Math.max(1,Math.round((pd(wks[wks.length-1])-pd(wks[0]))/6048e5)+1):1;
    const avg=a.res/span, cost=+v.cost||0;
    const back=cost>0?Math.min(100,Math.max(0,a.res/cost*100)):0;
    const weeksLeft=cost>0&&avg>0?Math.max(0,(cost-a.res)/avg):null;
    const cats=byCat(p.ops).slice(0,3);
    h+='<div class="panel vcard"><h2>'+tag(v)+' '+esc(v.name)+'</h2>'+
      '<div class="hint">'+plate(v)+' '+(isDrv(v)?(v.driver?'Chauffeur : '+esc(v.driver)+' · ':'')+'Versement '+fmt(v.rate)+' / jour':'Prix de base '+fmt(v.rate)+' / nuit')+'</div>'+
      '<div class="mini"><div class="cell"><h3>Recettes</h3>'+dual(p.rec)+'</div><div class="cell"><h3>Charges</h3>'+dual(p.chg)+'</div><div class="cell '+sgn(p.res)+'"><h3>Résultat</h3>'+dual(p.res)+'</div></div>'+
      '<div class="hint">'+pLabel()+' · marge '+(p.rec>0?Math.round(p.res/p.rec*100):0)+' % · '+(cats.length?'plus gros poste : '+esc(cats[0][0])+' ('+fmt(cats[0][1])+')':'aucune charge')+'</div>'+
      '<h3 style="margin-top:14px">Rentabilité depuis le début</h3>'+
      '<div>Résultat cumulé <b class="'+sgn(a.res)+'">'+fmt(a.res)+'</b> <span class="hint">('+fmt(a.res,other())+') · moyenne '+fmt(avg)+' / semaine</span></div>'+
      (cost>0?'<div class="prog"><b style="width:'+back+'%"></b></div><div class="hint">'+Math.round(back)+' % du prix d\'achat ('+fmt(cost)+') récupéré'+(weeksLeft!=null?' · environ '+Math.ceil(weeksLeft/4.35)+' mois restants au rythme actuel':'')+'</div>':'<div class="hint">Renseignez le prix d\'achat pour suivre le retour sur investissement.</div>')+
      '<details style="margin-top:12px"><summary class="btn sm" style="display:inline-block">Modifier</summary><div class="form" style="margin-top:10px" data-vf="'+v.id+'">'+
      '<label class="field"><span>Nom</span><input type="text" id="vn_'+v.id+'" value="'+esc(v.name)+'"></label>'+
      '<label class="field"><span>Code court</span><input type="text" id="vk_'+v.id+'" maxlength="6" value="'+esc(v.code||'')+'" placeholder="D1"></label>'+
      (v.kind!=='logement'?'<label class="field"><span>Immatriculation</span><input type="text" id="vp_'+v.id+'" value="'+esc(v.plate||'')+'" placeholder="1234 AB 01"></label>':'')+
      '<div class="field"><span>Couleur</span><div class="swatches" role="radiogroup" aria-label="Couleur">'+COLORS.map(c=>'<label><input type="radio" name="vcol_'+v.id+'" value="'+c[0]+'"'+((v.color||'c'+v.order)===c[0]?' checked':'')+'><span title="'+c[1]+'" style="background:var(--'+c[0]+')"></span></label>').join('')+'</div></div>'+
      (isDrv(v)?'<label class="field"><span>Chauffeur</span><input type="text" id="vd_'+v.id+'" value="'+esc(v.driver||'')+'"></label>':'')+
      '<label class="field"><span>'+(isDrv(v)?'Versement / jour (F)':'Prix de base / nuit (F)')+'</span><input type="number" id="vr_'+v.id+'" value="'+v.rate+'"></label>'+
      '<label class="field"><span>Prix d\'achat (F)</span><input type="number" id="vc_'+v.id+'" value="'+cost+'"></label>'+
      '<button class="btn pri sm" data-act="savevehicle" data-id="'+v.id+'">Enregistrer</button></div></details></div>'});
  return h+'</div>'}

function viewBnb(){
  const v4=S.vehicles.find(v=>v.kind==='logement')||{rate:30000};
  const st=S.stays.slice().sort((a,b)=>b.start.localeCompare(a.start));
  const [r0,r1]=pRange(),end=r1>today&&r0<=today?today:r1;
  let nights=0;S.stays.forEach(s=>{const a=s.start>r0?s.start:r0,b=s.end<addDays(end,1)?s.end:addDays(end,1);if(b>a)nights+=Math.round((pd(b)-pd(a))/864e5)});
  const days=Math.max(1,Math.round((pd(end)-pd(r0))/864e5)+1);
  const inS=S.stays.filter(s=>inP(s.start)),tot=sum(inS,s=>s.total),nn=sum(inS,s=>s.nights);
  const dir=sum(inS.filter(s=>s.channel==='Direct'),s=>s.total);
  const hist=sum(S.ops.filter(o=>o.vid===v4.id&&o.type==='recette'&&!o.stayId&&inP(o.week)),o=>o.amount);
  let h='<div class="toolbar"><label for="period">Période</label>'+periodSelect()+'</div>';
  h+='<div class="kpis">'+
    '<div class="kpi"><div class="l">Nuits vendues</div><div class="v">'+nights+'</div><div class="s">sur '+days+' jours</div></div>'+
    '<div class="kpi"><div class="l">Taux d\'occupation</div><div class="v">'+Math.round(nights/days*100)+' %</div><div class="s">réservations saisies</div></div>'+
    '<div class="kpi"><div class="l">Prix moyen / nuit</div><div class="v">'+fmt(nn?tot/nn:0)+'</div><div class="s">'+fmt(nn?tot/nn:0,other())+'</div></div>'+
    '<div class="kpi"><div class="l">Réservations directes</div><div class="v">'+(tot?Math.round(dir/tot*100):0)+' %</div><div class="s">du chiffre des séjours</div></div></div>';
  if(hist>0)h+='<div class="panel"><span class="chip warn">Ancien fichier</span> '+fmt(hist)+' de recettes Airbnb de cette période viennent de votre ancien suivi, sans dates de séjour. Elles comptent dans le tableau de bord mais pas dans les nuits vendues.</div>';
  h+='<div class="panel"><h2>Nouvelle réservation</h2><div class="form">'+
    '<label class="field"><span>Arrivée</span><input type="date" id="s_start"></label><label class="field"><span>Départ</span><input type="date" id="s_end"></label>'+
    '<label class="field"><span>Prix / nuit (F)</span><input type="number" id="s_rate" value="'+v4.rate+'"></label>'+
    '<label class="field"><span>Total (F)</span><input type="number" id="s_total" placeholder="auto"></label>'+
    '<label class="field"><span>Canal</span><select id="s_chan"><option>Airbnb</option><option>Direct</option><option>Autre</option></select></label>'+
    '<label class="field"><span>Voyageur</span><input type="text" id="s_guest" placeholder="Nom"></label>'+
    '<button class="btn pri" data-act="savestay">Ajouter</button></div><p class="hint" id="s_info">Tarif : 30 000 F la nuit, 25 000 F à partir de 7 nuits.</p></div>';
  // calendrier
  const [cy,cm]=S.calMonth.split('-').map(Number),first=new Date(cy,cm-1,1),dim=new Date(cy,cm,0).getDate(),off=(first.getDay()+6)%7;
  let cal='<div class="cal">'+['L','M','M','J','V','S','D'].map(x=>'<div class="h">'+x+'</div>').join('')+'<div class="z"></div>'.repeat(off);
  for(let d=1;d<=dim;d++){const ds=cy+'-'+String(cm).padStart(2,'0')+'-'+String(d).padStart(2,'0'),bk=S.stays.some(s=>s.start<=ds&&ds<s.end);
    cal+='<div class="'+(bk?'bk ':'')+(ds===today?'td':'')+'">'+d+'</div>'}
  cal+='</div>';
  h+='<div class="grid2"><div class="panel"><div class="wk" style="justify-content:space-between;margin-bottom:10px"><button class="btn sm" data-act="cprev">‹</button><b>'+MF[cm-1]+' '+cy+'</b><button class="btn sm" data-act="cnext">›</button></div>'+cal+'</div>';
  h+='<div class="panel"><h2>Séjours</h2>'+(st.length?'<div class="list">'+st.map(s=>'<div class="it"><div class="d">'+fd(s.start)+'</div><div class="w">'+esc(s.guest||'Voyageur')+' · '+s.nights+' nuit'+(s.nights>1?'s':'')+'<small>→ '+fdy(s.end)+' · '+esc(s.channel)+'</small></div><div class="pos"><b>'+fmt(s.total)+'</b></div><div class="ac"><button class="btn sm danger" data-act="del" data-kind="stays" data-id="'+s.id+'">Supprimer</button></div></div>').join('')+'</div>':'<div class="empty">Aucune réservation saisie.<br>Ajoutez la première avec le formulaire.</div>')+'</div></div>';
  return h}

function remItem(r){
  const diff=Math.round((pd(r.due)-pd(today))/864e5);
  const chip=r.done?'<span class="chip gain">Fait</span>':diff<0?'<span class="chip loss">En retard de '+(-diff)+' j</span>':diff<=30?'<span class="chip warn">Dans '+diff+' j</span>':'<span class="chip">Dans '+diff+' j</span>';
  return '<div class="it"><div class="d">'+fd(r.due)+'</div><div class="w">'+esc(r.label)+' · '+tag(vget(r.vid))+(r.est?'<small>Budget estimé '+fmt(r.est)+'</small>':'')+'</div><div>'+chip+'</div><div class="ac">'+
    (r.done?'':'<button class="btn sm" data-act="donerem" data-id="'+r.id+'">Fait</button>')+'<button class="btn sm danger" data-act="del" data-kind="rems" data-id="'+r.id+'">Supprimer</button></div></div>'}
function viewRem(){
  const l=S.rems.slice().sort((a,b)=>(a.done-b.done)||a.due.localeCompare(b.due));
  return '<div class="panel"><h2>Nouvelle échéance</h2><div class="form">'+
    '<label class="field"><span>Véhicule</span><select id="r_vid">'+vopts()+'</select></label>'+
    '<label class="field"><span>Quoi</span><input type="text" id="r_label" list="presets" placeholder="Assurance, vidange…"><datalist id="presets">'+PRESETS.map(p=>'<option>'+p+'</option>').join('')+'</datalist></label>'+
    '<label class="field"><span>Date limite</span><input type="date" id="r_due"></label>'+
    '<label class="field"><span>Budget estimé (F)</span><input type="number" id="r_est" placeholder="0"></label>'+
    '<button class="btn pri" data-act="addrem">Ajouter</button></div></div>'+
    '<div class="panel"><h2>À surveiller</h2>'+(l.length?'<div class="list">'+l.map(remItem).join('')+'</div>':'<div class="empty">Aucune échéance. Ajoutez l\'assurance, la visite technique, la vignette ou la prochaine vidange de chaque véhicule.</div>')+'</div>'}

function viewJou(){
  const [a,b]=[S.jv,S.jt];
  const l=S.ops.filter(o=>inP(o.week)&&(a==='all'||o.vid===a)&&(b==='all'||o.type===b)).sort((x,y)=>y.week.localeCompare(x.week)||(y.created||0)-(x.created||0));
  return '<div class="toolbar"><label for="period">Période</label>'+periodSelect()+
    '<select id="j_vid" aria-label="Véhicule"><option value="all">Tous</option>'+vopts(a)+'</select>'+
    '<select id="j_type" aria-label="Type"><option value="all">Recettes et charges</option><option value="recette"'+(b==='recette'?' selected':'')+'>Recettes</option><option value="charge"'+(b==='charge'?' selected':'')+'>Charges</option></select></div>'+
    '<div class="panel"><h2>'+l.length+' opération'+(l.length>1?'s':'')+'</h2><div class="list">'+(l.length?l.slice(0,200).map(opItem).join(''):'<div class="empty">Rien sur cette période.</div>')+'</div>'+(l.length>200?'<p class="hint">200 premières lignes. L\'export Excel contient tout.</p>':'')+'</div>'}

function viewData(){
  return '<div class="panel"><h2>Vos données</h2><p class="hint" style="margin-top:-6px">Compte : '+esc((S.user&&S.user.email)||'')+'. Les données sont enregistrées en ligne et aussi sur ce téléphone, elles restent disponibles sans réseau et se synchronisent au retour de la connexion.</p>'+
   '<div class="ac" style="flex-wrap:wrap;gap:10px"><button class="btn pri" data-act="export">Exporter en Excel</button><button class="btn" data-act="backup">Télécharger une sauvegarde</button>'+
   '<label class="btn" style="cursor:pointer">Importer une sauvegarde<input type="file" id="imp_file" accept="application/json,.json" hidden></label></div>'+
   '<p class="hint">L\'import ajoute ou remplace les lignes du fichier, il n\'efface rien d\'autre.</p></div>'+
   '<div class="panel"><h2>Compte</h2><button class="btn danger" data-act="logout">Se déconnecter</button></div>'}

/* ---------- rendu ---------- */
function render(){
  $('tools').innerHTML='<div class="seg" role="group" aria-label="Devise"><button data-act="cur" data-v="FCFA" aria-pressed="'+(S.cur==='FCFA')+'">F CFA</button><button data-act="cur" data-v="EUR" aria-pressed="'+(S.cur==='EUR')+'">€ Euro</button></div><button class="btn" data-act="export">Exporter Excel</button>';
  $('tabs').innerHTML=TABS.map(t=>'<button role="tab" data-act="tab" data-v="'+t[0]+'" aria-selected="'+(S.tab===t[0])+'">'+t[1]+'</button>').join('');
  if(S.nodb){$('app').innerHTML='<div class="panel empty">Connectez-vous à Claude pour ouvrir vos données.</div>';return}
  if(!S.ready){return}
  const v={dash:viewDash,saisie:viewSaisie,veh:viewVeh,bnb:viewBnb,rem:viewRem,jou:viewJou,data:viewData}[S.tab]();
  const sig=S.tab+'|'+S.week+'|'+S.editOp+'|'+S.calMonth+'|'+S.period+'|'+S.jv+'|'+S.jt;
  const keep=[];
  if(render.sig===sig)$('app').querySelectorAll('input[id],select[id]').forEach(e=>{
    if(e.type==='radio'||e.type==='checkbox')keep.push([e.id,e.checked,1]);else if(e.id!=='period'&&e.id!=='j_vid'&&e.id!=='j_type'&&e.id!=='w_date')keep.push([e.id,e.value,0,e.dataset.t])});
  const fid=document.activeElement&&document.activeElement.id;
  $('app').innerHTML=v;
  keep.forEach(k=>{const e=$(k[0]);if(!e)return;if(k[2])e.checked=k[1];else{const same=e.value===k[1];if(!same&&(k[1]!==''||e.tagName==='SELECT')){e.value=k[1]}if(k[3])e.dataset.t=k[3]}});
  render.sig=sig;if(fid&&$(fid)&&$(fid).tagName==='INPUT'&&document.activeElement!==$(fid))try{$(fid).focus()}catch(e){}
  if(S.tab==='saisie')S.vehicles.filter(isDrv).forEach(x=>rowCalc(x.id));
}
function rowCalc(vid){const v=S.vehicles.find(x=>x.id===vid),d=$('d_'+vid),r=$('r_'+vid),e=$('e_'+vid);if(!v||!d||!e)return;
  const exp=(+d.value||0)*v.rate,got=r.value===''?null:+r.value;
  e.innerHTML='Attendu '+fmt(exp)+(got==null?'':got>=exp?' · <span class="pos">complet</span>':' · <span class="neg">manque '+fmt(exp-got)+'</span>')+(got!=null?'<br>'+fmt(got,other())+' reçus':'')}

/* ---------- écritures ---------- */
async function put(col,id,data){if(!store)return toast('Connexion aux données indisponible');try{await store.doc(col+'/'+id).set(data);return true}catch(e){toast('Enregistrement impossible : '+(e&&e.message||e));return false}}
async function del(col,id){try{await store.doc(col+'/'+id).delete();return true}catch(e){toast('Suppression impossible');return false}}
const toF=(val,unit)=>Math.round(unit==='EUR'?val*RATE:val);

const ACT={
 tab(b){S.tab=b.dataset.v;S.editOp=null;try{localStorage.setItem('hs_tab',S.tab)}catch(e){}render()},
 cur(b){S.cur=b.dataset.v;try{localStorage.setItem('hs_cur',S.cur)}catch(e){}render()},
 wprev(){S.week=addDays(S.week,-7);render()}, wnext(){S.week=addDays(S.week,7);render()},
 cprev(){const[y,m]=S.calMonth.split('-').map(Number);const d=new Date(y,m-2,1);S.calMonth=iso(d).slice(0,7);render()},
 cnext(){const[y,m]=S.calMonth.split('-').map(Number);const d=new Date(y,m,1);S.calMonth=iso(d).slice(0,7);render()},
 fillexp(b){const v=S.vehicles.find(x=>x.id===b.dataset.vid);$('r_'+v.id).value=(+$('d_'+v.id).value||0)*v.rate;rowCalc(v.id)},
 async savevers(){let n=0;const jobs=[];
   for(const v of S.vehicles.filter(isDrv)){const r=$('r_'+v.id).value;if(r==='')continue;const days=+$('d_'+v.id).value||0;
     jobs.push([v.id,{vid:v.id,type:'recette',week:S.week,amount:Math.round(+r),cat:'Versement chauffeur',note:'',days,expected:days*v.rate,created:Date.now()}])}
   for(const j of jobs){if(await put('ops','rv_'+j[0]+'_'+S.week,j[1]))n++}
   toast(n?n+' versement'+(n>1?'s':'')+' enregistré'+(n>1?'s':''):'Saisissez au moins un montant reçu')},
 async addrec(){const amt=+$('a_amt').value;if(!(amt>0))return toast('Saisissez un montant');
   const ok=await put('ops',uid(),{vid:$('a_vid').value,type:'recette',week:S.week,amount:toF(amt,$('a_unit').value),cat:$('a_chan').value,note:$('a_note').value.trim(),created:Date.now()});
   if(ok){toast('Recette ajoutée');$('a_amt').value='';$('a_note').value='';$('a_eq').textContent=''}},
 async addcharge(){const amt=+$('c_amt').value;if(!(amt>0))return toast('Saisissez un montant');
   const ok=await put('ops',uid(),{vid:$('c_vid').value,type:'charge',week:S.week,amount:toF(amt,$('c_unit').value),cat:$('c_cat').value,note:$('c_note').value.trim(),created:Date.now()});
   if(ok){toast('Charge ajoutée');$('c_amt').value='';$('c_note').value='';$('c_eq').textContent=''}},
 editop(b){S.editOp=b.dataset.id;render()}, cancel(){S.editOp=null;render()},
 async saveop(b){const o=S.ops.find(x=>x.id===b.dataset.id);if(!o)return;const d=Object.assign({},o);delete d.id;
   d.amount=Math.round(+$('x_amt').value||0);d.cat=$('x_cat').value;d.note=$('x_note').value.trim();
   if(await put('ops',o.id,d)){S.editOp=null;toast('Modifié')}},
 async del(b){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Confirmer ?';setTimeout(()=>{b.dataset.armed='';b.textContent='Supprimer'},3000);return}
   const k=b.dataset.kind,id=b.dataset.id;
   if(k==='stays'){const s=S.stays.find(x=>x.id===id);if(s&&s.opId)await del('ops',s.opId)}
   if(await del(k,id))toast('Supprimé')},
 async savestay(){const a=$('s_start').value,e=$('s_end').value;if(!a||!e||e<=a)return toast('Choisissez une arrivée et un départ valides');
   const n=Math.round((pd(e)-pd(a))/864e5),rate=+$('s_rate').value||0,total=+$('s_total').value||n*rate,chan=$('s_chan').value,id=uid(),opId='st_'+id;
   const v4=S.vehicles.find(v=>v.kind==='logement');
   if(!(await put('ops',opId,{vid:v4?v4.id:'v4',type:'recette',week:monday(a),amount:total,cat:chan==='Direct'?'Réservation directe':'Airbnb',note:$('s_guest').value.trim(),stayId:id,created:Date.now()})))return;
   if(await put('stays',id,{start:a,end:e,nights:n,rate,total,channel:chan,guest:$('s_guest').value.trim(),opId}))toast('Réservation ajoutée')},
 async addrem(){const l=$('r_label').value.trim(),d=$('r_due').value;if(!l||!d)return toast('Indiquez quoi et la date limite');
   if(await put('rems',uid(),{vid:$('r_vid').value,label:l,due:d,est:+$('r_est').value||0,done:false}))toast('Échéance ajoutée')},
 async donerem(b){const r=S.rems.find(x=>x.id===b.dataset.id);if(!r)return;const d=Object.assign({},r);delete d.id;d.done=true;if(await put('rems',r.id,d))toast('Marquée comme faite')},
 async savevehicle(b){const id=b.dataset.id,v=S.vehicles.find(x=>x.id===id),d=Object.assign({},v);delete d.id;
   d.name=$('vn_'+id).value.trim()||v.name;d.code=$('vk_'+id).value.trim().toUpperCase();if($('vp_'+id))d.plate=$('vp_'+id).value.trim().toUpperCase();
   const col=document.querySelector('input[name="vcol_'+id+'"]:checked');if(col)d.color=col.value;if($('vd_'+id))d.driver=$('vd_'+id).value.trim();d.rate=+$('vr_'+id).value||0;d.cost=+$('vc_'+id).value||0;
   if(await put('vehicles',id,d))toast('Véhicule mis à jour')},
 async export(){exportXlsx()},
 async backup(){backupJson()},
 async initdefaults(){await store.setMany([['vehicles/v1',{name:'Dzire 1',driver:'',kind:'taxi',rate:23000,cost:0,order:1,code:'D1',color:'c1',plate:''}],['vehicles/v2',{name:'Dzire 2',driver:'',kind:'taxi',rate:23000,cost:0,order:2,code:'D2',color:'c3',plate:''}],['vehicles/v3',{name:'Camionnette Mercedes',driver:'',kind:'camion',rate:35000,cost:0,order:3,code:'MB',color:'c2',plate:''}],['vehicles/v4',{name:'Appartement Oradou',driver:'',kind:'logement',rate:30000,cost:0,order:4,code:'APT',color:'c4',plate:''}]]);toast('Activités créées')},
 logout(){if(S.user&&S.user.logout)S.user.logout()}
};

document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&ACT[b.dataset.act])ACT[b.dataset.act](b)});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='imp_file'){importJson(t.files&&t.files[0]);t.value='';return}
  if(t.id==='period'){S.period=t.value;render()}
  else if(t.id==='w_date'&&t.value){S.week=monday(t.value);render()}
  else if(t.id==='j_vid'){S.jv=t.value;render()} else if(t.id==='j_type'){S.jt=t.value;render()}});
document.addEventListener('input',e=>{const t=e.target,id=t.id||'';
  if(/^[dr]_/.test(id)&&$('e_'+id.slice(2)))rowCalc(id.slice(2));
  else if(id==='c_amt'||id==='c_unit'){const a=+$('c_amt').value,u=$('c_unit').value;$('c_eq').textContent=a>0?'≈ '+(u==='EUR'?fmt(a*RATE,'FCFA'):fmt(a,'EUR')):''}
  else if(id==='a_amt'||id==='a_unit'){const a=+$('a_amt').value,u=$('a_unit').value;$('a_eq').textContent=a>0?'≈ '+(u==='EUR'?fmt(a*RATE,'FCFA'):fmt(a,'EUR')):''}
  else if(/^s_/.test(id)){if(id==='s_rate')t.dataset.t='1';if(id==='s_total')t.dataset.t='1';
    const a=$('s_start').value,b=$('s_end').value;if(a&&b&&b>a){const n=Math.round((pd(b)-pd(a))/864e5);
      if(!$('s_rate').dataset.t)$('s_rate').value=n>=7?25000:30000;
      const tot=n*(+$('s_rate').value||0);if(!$('s_total').dataset.t)$('s_total').value=tot;
      $('s_info').textContent=n+' nuit'+(n>1?'s':'')+' · '+fmt(+$('s_total').value||tot)+' soit '+fmt(+$('s_total').value||tot,'EUR')}}});

/* ---------- export Excel ---------- */
async function exportXlsx(){
  if(!window.XLSX)return toast('Export indisponible');
  const e=n=>Math.round(n/RATE*100)/100;
  const wb=XLSX.utils.book_new();
  const add=(name,rows,w)=>{const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{'Aucune donnée':''}]);ws['!cols']=(w||[]).map(x=>({wch:x}));XLSX.utils.book_append_sheet(wb,ws,name)};
  add('Synthèse',S.vehicles.map(v=>{const s=vstat(v.id,o=>inP(o.week));return {'Période':pLabel(),'Code':v.code||'','Véhicule / activité':v.name,'Chauffeur':v.driver||'','Immatriculation':v.plate||'','Recettes (F CFA)':s.rec,'Charges (F CFA)':s.chg,'Résultat (F CFA)':s.res,'Recettes (€)':e(s.rec),'Charges (€)':e(s.chg),'Résultat (€)':e(s.res)}}),[18,8,24,14,16,16,16,16,12,12,12]);
  const mk=new Set(S.ops.map(o=>o.week.slice(0,7)));const mrows=[];
  [...mk].sort().forEach(m=>S.vehicles.forEach(v=>{const s=vstat(v.id,o=>o.week.slice(0,7)===m);if(s.rec||s.chg)mrows.push({'Mois':m,'Véhicule / activité':v.name,'Recettes (F CFA)':s.rec,'Charges (F CFA)':s.chg,'Résultat (F CFA)':s.res,'Recettes (€)':e(s.rec),'Charges (€)':e(s.chg),'Résultat (€)':e(s.res)})}));
  add('Mensuel',mrows,[10,24,16,16,16,12,12,12]);
  add('Opérations',S.ops.slice().sort((a,b)=>a.week.localeCompare(b.week)).map(o=>({'Semaine du':o.week,'Code':vcode(vget(o.vid)),'Véhicule / activité':vname(o.vid),'Chauffeur':(vget(o.vid)||{}).driver||'','Type':o.type==='recette'?'Recette':'Charge','Catégorie':o.cat||'','Montant (F CFA)':o.amount,'Montant (€)':e(o.amount),'Jours':o.days==null?'':o.days,'Attendu (F CFA)':o.expected==null?'':o.expected,'Note':o.note||''})),[12,8,24,14,10,24,16,12,8,16,30]);
  add('Réservations',S.stays.slice().sort((a,b)=>a.start.localeCompare(b.start)).map(s=>({'Arrivée':s.start,'Départ':s.end,'Nuits':s.nights,'Prix/nuit (F CFA)':s.rate,'Total (F CFA)':s.total,'Total (€)':e(s.total),'Canal':s.channel,'Voyageur':s.guest||''})),[12,12,8,16,14,12,10,20]);
  add('Échéances',S.rems.slice().sort((a,b)=>a.due.localeCompare(b.due)).map(r=>({'Date limite':r.due,'Véhicule':vname(r.vid),'Quoi':r.label,'Budget (F CFA)':r.est||0,'Budget (€)':e(r.est||0),'Fait':r.done?'Oui':'Non'})),[12,22,26,14,12,8]);
  try{
    const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
    await saveFile('Hamanien-Services_'+today+'.xlsx',new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  }catch(err){if(!err||err.name!=='AbortError')toast('Export impossible')}
}
async function saveFile(name,blob){
  try{const f=new File([blob],name,{type:blob.type});
    if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}catch(e){if(e&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);toast('Fichier prêt')}
function backupJson(){
  const o={app:'hamanien',version:1,exportedAt:new Date().toISOString()};
  [['vehicles',S.vehicles],['ops',S.ops],['rems',S.rems],['stays',S.stays]].forEach(p=>{o[p[0]]={};p[1].forEach(x=>{const d=Object.assign({},x);delete d.id;o[p[0]][x.id]=d})});
  saveFile('Hamanien-sauvegarde_'+today+'.json',new Blob([JSON.stringify(o)],{type:'application/json'}))}
async function importJson(file){
  if(!file)return;
  try{const o=JSON.parse(await file.text());const list=[];
    ['vehicles','ops','rems','stays'].forEach(c=>{const m=o[c]||{};Object.keys(m).forEach(id=>list.push([c+'/'+id,m[id]]))});
    if(!list.length)return toast('Ce fichier ne contient aucune donnée');
    await store.setMany(list);toast(list.length+' lignes importées')}
  catch(e){toast('Fichier illisible')}}

/* ---------- données ---------- */
function sub(name,key,sort){return store.collection(name).onSnapshot(snap=>{
  S[key]=snap.docs.map(d=>Object.assign({id:d.id},d.data()));if(sort)S[key].sort(sort);
  S.loaded=(S.loaded||0)+1;S.ready=true;
  const a=document.activeElement;if(a&&$('app').contains(a)&&/^(INPUT|SELECT)$/.test(a.tagName)&&S.tab==='saisie')return;
  render()},()=>{S.ready=true;render()})}
let unsubs=[];
function start(st,opts){
  store=st;S.user=opts||{};S.vehicles=[];S.ops=[];S.rems=[];S.stays=[];S.ready=false;
  unsubs.forEach(u=>{try{u&&u()}catch(e){}});
  $('app').innerHTML='<div class="empty">Chargement de vos données…</div>';render();
  unsubs=[sub('vehicles','vehicles',(a,b)=>(a.order||9)-(b.order||9)),sub('ops','ops'),sub('rems','rems'),sub('stays','stays')]}
render();
window.HSApp={start:start};
})();
