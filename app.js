// ═══════════════════════════════════════
// CONFIGURAÇÃO — troque pela URL do seu Apps Script
// ═══════════════════════════════════════
const SCRIPT = 'https://script.google.com/macros/s/AKfycbwShiN7voIiOC9DaYfeAFmBrybU3BM_xREDwtHWt3yCjLMMKlq-rn5wXXUhA8HWBZa8/exec';

// ═══════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════
const S = {
  user: null, equipe: null, dv: null,
  loginData: null,
  dec: { assistido:'Paciente', sexo:'Masculino', integ:false },
  decSession: [],
  cadAll: [], cad: [], eqList: [],
  cadFiltEq: 'todas',
  cur: null  // membro atual
};

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════
const $ = id => document.getElementById(id);
function load(m)  { $('lov').classList.add('on'); $('lov-p').textContent = m||'Carregando...'; }
function unload() { $('lov').classList.remove('on'); }

function msg(m, t) {
  const el = $('toast');
  el.textContent = m; el.className = 'toast on ' + (t||'');
  clearTimeout(el._t); el._t = setTimeout(() => el.className = 'toast', 3200);
}

function fD(d) {
  return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'});
}
function gId() { return Math.random().toString(36).substr(2,8); }
function ini(n) {
  return (n||'').trim().split(' ').filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join('');
}
function normPerfil(r) {
  const s = (r||'').toString().trim().toUpperCase().replace(/Í/g,'I');
  return (s==='LIDER'||s==='LÍDER') ? 'Líder' : 'Membro';
}
function setOpt(id, val) {
  const sel = $(id); if(!sel||val===undefined||val===null) return;
  const v = (val||'').toString().trim().toUpperCase();
  const MAP = {
    'M':'Masculino','MASCULINO':'Masculino',
    'F':'Feminino','FEMININO':'Feminino',
    'LIDER':'LIDER','LÍDER':'LIDER',
    'MEMBRO':'Membro',
    'S':'S','N':'N',
    'SIM':'Sim','NÃO':'Não','NAO':'Não',
    'ATIVO':'Ativo','INATIVO':'Inativo'
  };
  const mapped = MAP[v];
  for(const opt of sel.options) {
    const ov = opt.value.trim().toUpperCase();
    const ot = opt.text.trim().toUpperCase();
    if(ov===v||ot===v||(mapped&&(ov===mapped.toUpperCase()||ot===mapped.toUpperCase()))) {
      sel.value = opt.value; return;
    }
  }
  sel.value = val;
}
function getSemana() {
  const h = new Date(), d = h.getDay();
  const dom = new Date(h); dom.setDate(h.getDate()-d);
  const sab = new Date(dom); sab.setDate(dom.getDate()+6);
  return {ini:dom, fim:sab};
}
function calcDv(eq) {
  const MAP = {seg:1,ter:2,qua:3,qui:4,sex:5,sab:6,dom:0};
  const s = (eq||'').toLowerCase();
  let alvo = -1;
  for(const k in MAP){ if(s.indexOf(k)>=0){ alvo=MAP[k]; break; } }
  const h = new Date();
  if(alvo<0) return h;
  const dv = new Date(h); dv.setDate(h.getDate()+(alvo-h.getDay()));
  return dv;
}
function naSemanAtual(str) {
  const p = str.split('/'); if(p.length<3) return false;
  const d = new Date(p[2],p[1]-1,p[0]);
  const sw = getSemana();
  sw.ini.setHours(0,0,0,0); sw.fim.setHours(23,59,59,999);
  return d>=sw.ini && d<=sw.fim;
}

// ═══════════════════════════════════════
// API via JSONP — funciona sem CORS
// ═══════════════════════════════════════
function callScript(params) {
  return new Promise((ok, er) => {
    const cb = '_cb' + Date.now() + Math.floor(Math.random()*9999);
    const sc = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup(); er(new Error('Timeout — verifique o Apps Script'));
    }, 20000);
    function cleanup() { clearTimeout(timer); delete window[cb]; if(sc.parentNode) sc.remove(); }
    window[cb] = data => { cleanup(); ok(data||{}); };
    sc.onerror = () => { cleanup(); er(new Error('Erro ao chamar Apps Script')); };
    const qs = Object.entries({...params, callback:cb})
      .map(([k,v]) => encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
    sc.src = SCRIPT + '?' + qs;
    document.head.appendChild(sc);
  });
}

async function lerUsuarios() {
  const r = await callScript({acao:'lerUsuarios'});
  return r.values || [];
}
async function lerCadastro() {
  const r = await callScript({acao:'lerCadastro'});
  return r.values || [];
}
async function lerEquipes() {
  const r = await callScript({acao:'lerEquipes'});
  return r.values || [];
}
async function gravar(aba, vals) {
  await callScript({acao:'gravar', aba, dados: JSON.stringify(vals)});
  return true;
}
async function atualizar(aba, linha, vals) {
  await callScript({acao:'atualizar', aba, linha: String(linha), dados: JSON.stringify(vals)});
  return true;
}

// ═══════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════
function ir(name, navIdx, btn) {
  document.querySelectorAll('.sc').forEach(s => s.classList.remove('on'));
  const scId = name === 'integ-det' ? 'sc-integ-det' : 'sc-'+name;
  const sc = $(scId); if(sc) sc.classList.add('on');
  if(btn) {
    const nav = btn.closest('nav');
    if(nav) nav.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }
  if(name==='decisoes') loadDecSemana();
  if(name==='integracao') loadIntegracao();
  if(name==='cadastro' && !S.cad.length) loadCad();
}

// ═══════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════
async function doLogin() {
  const u = $('lu').value.trim(), p = $('lp').value.trim();
  const errEl = $('lerr');
  errEl.style.display = 'none';
  if(!u||!p){ errEl.textContent='Informe usuário e PIN.'; errEl.style.display='block'; return; }

  if(!S.loginData||!S.loginData.length){
    load('Verificando...');
    try { S.loginData = await lerUsuarios(); }
    catch(e) { unload(); errEl.textContent='Erro de conexão: '+e.message; errEl.style.display='block'; return; }
    unload();
  }

  const uL = u.toLowerCase().trim();
  let found = null;
  for(const r of S.loginData){
    const uOk = r.usuario.toLowerCase()===uL || r.nomeSoc.toLowerCase()===uL || r.nomeSoc.toLowerCase().split(' ')[0]===uL;
    if(uOk && String(r.pin)===p){ found=r; break; }
  }

  if(!found){
    const existe = S.loginData.some(r => r.usuario.toLowerCase()===uL||r.nomeSoc.toLowerCase()===uL||r.nomeSoc.toLowerCase().split(' ')[0]===uL);
    errEl.textContent = existe ? 'PIN incorreto.' : 'Usuário não encontrado.';
    errEl.style.display='block'; return;
  }

  const nome = found.nomeSoc||found.usuario;
  const perfil = normPerfil(found.perfil);
  const equipes = (found.equipes||'').split(',').map(e=>e.trim()).filter(Boolean);
  S.user = {codigo:found.id||u, nome, perfil};

  if(!equipes.length){ errEl.textContent='Sem equipe cadastrada.'; errEl.style.display='block'; return; }

  if(equipes.length===1){ S.equipe=equipes[0]; startSession(); return; }

  const sel = $('leq');
  sel.innerHTML = '<option value="">Selecione sua equipe</option>';
  equipes.forEach(eq => { const o=document.createElement('option'); o.value=o.textContent=eq; sel.appendChild(o); });
  $('leqc').style.display='block';
  const btn = $('lbtn');
  btn.textContent = 'Entrar ✝';
  btn.onclick = () => {
    const eq = sel.value;
    if(!eq){ errEl.textContent='Selecione a equipe.'; errEl.style.display='block'; return; }
    S.equipe=eq; startSession();
  };
}

function startSession() {
  const h = new Date(), sw = getSemana(), dv = calcDv(S.equipe||'');
  S.dv = dv;
  $('h-name').textContent = S.user.nome;
  $('h-eq').textContent   = '📍 ' + S.equipe;
  $('h-dv').textContent   = fD(dv);
  $('h-sw').textContent   = fD(sw.ini).slice(0,5)+' – '+fD(sw.fim).slice(0,5);
  // Buscar foto do usuário logado no cadAll
  const userMembro = S.cadAll.find(m=>m.pin===S.user.codigo||m.id===S.user.codigo||m.usuario.toLowerCase()===S.user.nome.split(' ')[0].toLowerCase());
  const fotoUser = (userMembro&&userMembro.foto)?converterUrlFoto(userMembro.foto):'';
  updateBannerFoto(fotoUser);

  const mods = [];
  if(S.user.perfil==='Líder'){
    mods.push({ico:'👥',lbl:'Cadastro',id:'cadastro'});
    mods.push({ico:'📊',lbl:'Resumo',id:'home'});
  }
  mods.push({ico:'✝',lbl:'Decisões',id:'decisoes'});
  mods.push({ico:'🔗',lbl:'Integração',id:'integracao'});
  mods.push({ico:'🎂',lbl:'Aniversários',id:'aniversarios'});

  $('mods').innerHTML = mods.map(m =>
    `<div class="mod" onclick="ir('${m.id}')"><div class="mico">${m.ico}</div><div class="mlbl">${m.lbl}</div></div>`
  ).join('');

  document.querySelectorAll('.sc').forEach(s=>s.classList.remove('on'));
  $('sc-home').classList.add('on');
  msg('Bem-vindo(a), '+S.user.nome.split(' ')[0]+'! 🙏','ok');
}

function doSair() {
  S.user=null; S.equipe=null; S.loginData=null; S.decSession=[];
  S.cad=[]; S.cadAll=[]; S.eqList=[]; S.cur=null;
  $('lu').value=''; $('lp').value=''; $('leqc').style.display='none';
  $('lbtn').textContent='Verificar acesso'; $('lbtn').onclick=doLogin; $('lerr').style.display='none';
  document.querySelectorAll('.sc').forEach(s=>s.classList.remove('on'));
  $('sc-login').classList.add('on');
}

// ═══════════════════════════════════════
// DECISÕES
// ═══════════════════════════════════════
function fillDecInfo() {
  $('d-dt').textContent = fD(S.dv||new Date());
  $('d-cp').textContent = S.user?.nome||'-';
  $('d-eq').textContent = S.equipe||'-';
}

async function loadDecSemana() {
  const sw = getSemana();
  $('d-sw').textContent = fD(sw.ini).slice(0,5)+' – '+fD(sw.fim).slice(0,5);
  const ls = $('d-lista-semana');
  ls.innerHTML = '<div class="empty"><div class="ei">⏳</div><p>Carregando...</p></div>';
  try {
    const dados = await callScript({acao:'lerDecisoesSemana'});
    const lista = dados.values || [];
    $('d-total').textContent = lista.length;
    if(!lista.length){
      ls.innerHTML='<div class="empty"><div class="ei">✝</div><p>Nenhuma decisão esta semana.</p></div>';
      return;
    }
    // Agrupar por equipe
    const grupos = {};
    lista.forEach(d=>{
      const eq = d.equipe||'Sem equipe';
      if(!grupos[eq]) grupos[eq]=[];
      grupos[eq].push(d);
    });
    let html='';
    Object.keys(grupos).sort().forEach(eq=>{
      html+=`<div class="eq-hdr"><span>📍 ${eq}</span><span class="eq-cnt">${grupos[eq].length}</span></div>`;
      grupos[eq].forEach(d=>{
        const badge = d.integ==='S'
          ? '<span class="badge bg-g">✅ Integrar</span>'
          : '<span class="badge bg-y">⏭ Não</span>';
        html+=`<div style="background:#fff;border-radius:12px;padding:12px 14px;margin-bottom:6px;border:1.5px solid var(--g2)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div style="font-size:15px;font-weight:600;color:var(--navy)">${d.nome}</div>
            ${badge}
          </div>
          <div style="font-size:12px;color:var(--g4)">
            ${d.assistido} · ${d.sexo||'-'} · 👤 ${d.capelao}
            ${d.tel?'· 📞 '+d.tel:''}
          </div>
        </div>`;
      });
    });
    ls.innerHTML = html;
  } catch(e) {
    ls.innerHTML='<div class="empty"><div class="ei">⚠️</div><p>Erro ao carregar decisões.</p></div>';
  }
}

function openFormDec() {
  // Reset form
  ['d-nm','d-tel','d-obs'].forEach(id=>$(id).value=''); $('d-mot').value='';
  S.dec = {assistido:'Paciente', sexo:'Masculino', integ:false};
  document.querySelectorAll('#sh-dec .tg').forEach(tg=>{
    const bs=tg.querySelectorAll('.tb'); bs.forEach(b=>b.classList.remove('on')); bs[0].classList.add('on');
  });
  $('d-nao').classList.add('on'); $('d-sim').classList.remove('on');
  $('blk-sim').style.display='none'; $('blk-nao').style.display='block';
  fillDecInfo();
  $('sh-dec').classList.add('on');
}
function tog(campo, val, btn) {
  S.dec[campo] = val;
  btn.closest('.tg').querySelectorAll('.tb').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
}
function setInteg(sim) {
  S.dec.integ = sim;
  $('d-sim').classList.toggle('on', sim);
  $('d-nao').classList.toggle('on', !sim);
  $('blk-sim').style.display = sim ? 'block' : 'none';
  $('blk-nao').style.display = sim ? 'none' : 'block';
}
async function salvarDec() {
  const nm=$('d-nm').value.trim(), tel=$('d-tel').value.trim();
  const integ=S.dec.integ, det=$('d-obs').value.trim(), mot=$('d-mot').value;
  if(!nm){ msg('Informe o nome do assistido.','er'); return; }
  if(integ&&!tel){ msg('Informe o telefone.','er'); return; }
  if(integ&&!det){ msg('Informe as observações.','er'); return; }
  if(!integ&&!mot){ msg('Selecione o motivo.','er'); return; }
  const h=new Date(), hS=fD(h);
  if(!naSemanAtual(hS)){ msg('Fora da semana atual.','er'); return; }
  const dvS = fD(S.dv||h);
  const anoI = new Date(h.getFullYear(),0,1);
  const sem = Math.ceil(((h-anoI)/86400000+anoI.getDay()+1)/7);
  const vals = [gId(),hS,S.user.codigo,S.user.nome,S.equipe,dvS,
    S.dec.assistido,nm,S.dec.sexo==='Masculino'?'M':'F',
    tel,integ?'S':'N',integ?'':mot,integ?det:'',sem,''];
  load('Salvando...');
  try {
    await gravar('Decisões', vals);
    unload();
    // Adicionar à sessão local e renderizar — NÃO fechar o sheet
    S.decSession.push({nm, assistido:S.dec.assistido, integ, tel});
    renderSessao();
    // Resetar só os campos editáveis, manter sheet aberto
    resetFormDec();
    msg('✅ Decisão salva!','ok');
    // Recarregar lista da semana em background
    loadDecSemana();
  } catch(e){ unload(); msg('Erro: '+e.message,'er'); }
}

// ═══════════════════════════════════════
// CADASTRO
// ═══════════════════════════════════════
async function loadCad() {
  load('Carregando membros...');
  try {
    const [todos, eqs] = await Promise.all([
      lerCadastro(),
      S.eqList.length ? Promise.resolve(S.eqList) : lerEquipes()
    ]);
    S.cadAll = todos;
    S.eqList = eqs;
    // Filtrar só ativos
    S.cad = todos.filter(m=>(m.sit||'').toLowerCase()==='ativo');
    unload();
    buildChips();
    renderCad();
  } catch(e){ unload(); msg('Erro ao carregar: '+e.message,'er'); }
}

function buildChips() {
  const fc = $('c-chips'); fc.innerHTML='';
  const eqSet = new Set();
  S.cad.forEach(m=>(m.equipes||'').split(',').map(e=>e.trim()).filter(Boolean).forEach(e=>eqSet.add(e)));

  const all = document.createElement('button');
  all.className='chip on'; all.textContent='Todas';
  all.onclick=()=>{ S.cadFiltEq='todas'; fc.querySelectorAll('.chip').forEach(c=>c.classList.remove('on')); all.classList.add('on'); renderCad(); };
  fc.appendChild(all);

  [...eqSet].sort().forEach(e=>{
    const b=document.createElement('button');
    b.className='chip'; b.textContent=e;
    b.onclick=()=>{ S.cadFiltEq=e; fc.querySelectorAll('.chip').forEach(c=>c.classList.remove('on')); b.classList.add('on'); renderCad(); };
    fc.appendChild(b);
  });
}

function renderCad() {
  const ls = $('c-list');
  const busca = ($('c-search')?.value||'').toLowerCase();
  let mbs = S.cad;
  if(busca) mbs = mbs.filter(m=>(m.nomeSoc+m.nomeComp+m.usuario).toLowerCase().indexOf(busca)>=0);

  // Agrupar — cada membro aparece UMA VEZ na primeira equipe que bater o filtro
  const grupos = {}, ordem = [];
  mbs.forEach(m=>{
    const eqs = (m.equipes||'').split(',').map(e=>e.trim()).filter(Boolean);
    if(!eqs.length) eqs.push('Sem equipe');
    if(S.cadFiltEq==='todas'){
      const eq = eqs[0];
      if(!grupos[eq]){ grupos[eq]=[]; ordem.push(eq); }
      grupos[eq].push(m);
    } else {
      if(eqs.indexOf(S.cadFiltEq)>=0){
        if(!grupos[S.cadFiltEq]){ grupos[S.cadFiltEq]=[]; ordem.push(S.cadFiltEq); }
        grupos[S.cadFiltEq].push(m);
      }
    }
  });

  if(!ordem.length){ ls.innerHTML='<div class="empty"><div class="ei">🔍</div><p>Nenhum membro encontrado.</p></div>'; return; }

  let html='';
  ordem.sort().forEach(eq=>{
    html+=`<div class="eq-hdr"><span>📍 ${eq}</span><span class="eq-cnt">${grupos[eq].length}</span></div>`;
    grupos[eq].forEach(m=>{
      const temFoto = m.foto&&m.foto.indexOf('http')===0;
      const fotoUrl = temFoto ? converterUrlFoto(m.foto) : '';
      html+=`<div class="mrow" onclick="openMembro(${m.linha})">`;
      if(temFoto) html+=`<div class="av"><img src="${fotoUrl}" onerror="this.parentElement.textContent='${ini(m.nomeSoc||m.nomeComp)}'"></div>`;
      else html+=`<div class="av">${ini(m.nomeSoc||m.nomeComp)}</div>`;
      html+=`<div style="flex:1;min-width:0"><div class="mname">${m.nomeSoc||m.nomeComp}</div></div>
        <span style="color:var(--g3);font-size:20px">›</span></div>`;
    });
  });
  ls.innerHTML = html;
}

// ═══════════════════════════════════════
// MEMBRO DETALHE
// ═══════════════════════════════════════
function openMembro(linha){
  const m = S.cadAll.find(x=>x.linha===linha);
  if(!m) return;
  S.cur = m;
  fillView(m);
  // Reset tabs
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.querySelector('.tab').classList.add('on');
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  $('p0').classList.add('on');
  showEdit(0,false); showEdit(1,false);
  ir('membro');
}

function fillView(m){
  const ns = m.nomeSoc||m.nomeComp;
  $('m-name').textContent = ns;
  $('m-id').textContent = m.id;

  // Avatar
  const av = $('m-av');
  if(m.foto && m.foto.indexOf('http')===0){
    const fotoUrl = converterUrlFoto(m.foto);
    av.innerHTML=`<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='${ini(ns)}'">`;
  } else av.textContent = ini(ns);

  // Badge
  const bd = $('m-badge');
  bd.textContent = m.sit||'Ativo';
  bd.className = 'badge '+(m.sit==='Ativo'?'bg-g':'bg-r');

  // Btn situação
  const bs = $('btn-sit');
  bs.textContent = m.sit==='Ativo'?'⛔ Desativar':'✅ Ativar membro';
  bs.className = 'btn '+(m.sit==='Ativo'?'btn-r':'btn-g');

  // Dados pessoais
  $('v-pin').textContent=m.pin||'-';   $('v-nc').textContent=m.nomeComp||'-';
  $('v-us').textContent=m.usuario||'-'; $('v-sx').textContent=m.sexo||'-';
  $('v-tel').textContent=m.tel||'-';    $('v-rg').textContent=m.rg||'-';
  $('v-em').textContent=m.email||'-';   $('v-an').textContent=m.aniversario||'-';

  // Ministerial
  $('vm-dc').textContent=m.declaMinist||'-'; $('vm-lg').textContent=m.liderGA||'-';
  $('vm-ucd').textContent=m.umComDeus||'-';  $('vm-bat').textContent=m.batizado||'-';
  $('vm-grp').textContent=m.grupo||'-';      $('vm-clt').textContent=m.culto||'-';
  $('vm-snb').textContent=m.senib||'-';      $('vm-fi').textContent=m.fazInteg||'-';
  $('vm-sit').textContent=m.sit||'-';        $('vm-pf').textContent=m.perfil||'-';
  $('vm-obs').textContent=m.obs||'-';

  // Botão câmera: só para Líder
  const camBtn = $('btn-cam-m');
  if(camBtn) camBtn.style.display = S.user?.perfil==='Líder' ? 'flex' : 'none';

  // Equipes
  renderEqList(m.equipes||'');
}

function setTab(idx, btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on'); $('p'+idx).classList.add('on');
}

function showEdit(pane, on){
  $('v'+pane).style.display = on?'none':'block';
  $('e'+pane).style.display = on?'block':'none';
  if(on && pane===0){
    const m=S.cur;
    $('ep').value=m.pin||''; $('enc').value=m.nomeComp||''; $('ens').value=m.nomeSoc||'';
    $('eus').value=m.usuario||''; setOpt('esx',m.sexo);
    $('etel').value=m.tel||''; $('erg').value=m.rg||''; $('eem').value=m.email||'';
    $('ean').value=m.aniversario||'';
  }
  if(on && pane===1){
    const m=S.cur;
    setOpt('edc',m.declaMinist); $('elg').value=m.liderGA||'';
    setOpt('eucd',m.umComDeus); setOpt('ebat',m.batizado);
    setOpt('egrp',m.grupo); setOpt('eclt',m.culto); setOpt('esnb',m.senib);
    setOpt('efi',m.fazInteg); setOpt('esit',m.sit||'Ativo'); setOpt('epf',m.perfil||'Membro');
    $('eobs').value=m.obs||'';
  }
}

function buildVals(m, overrides){
  const o = {...m, ...overrides};
  return [o.id,o.foto||'',o.pin,o.nomeComp,o.nomeSoc,o.usuario,o.sexo||'',o.tel||'',o.rg||'',o.email||'',
    o.declaMinist||'',o.liderGA||'',o.umComDeus||'',o.batizado||'',o.grupo||'',o.culto||'',o.senib||'',
    o.aniversario||'',o.equipes||'',o.fazInteg||'',o.sit||'Ativo',o.obs||'',o.perfil||'Membro'];
}

async function salvarDados(){
  const m=S.cur;
  const pin=$('ep').value.trim(),nc=$('enc').value.trim(),ns=$('ens').value.trim(),us=$('eus').value.trim();
  if(!pin||!nc||!ns||!us){ msg('Preencha os campos obrigatórios.','er'); return; }
  const ovr={pin,nomeComp:nc,nomeSoc:ns,usuario:us,sexo:$('esx').value,tel:$('etel').value.trim(),rg:$('erg').value.trim(),email:$('eem').value.trim(),aniversario:$('ean').value.trim()};
  load('Salvando...');
  try{
    await atualizar('Cadastro', m.linha, buildVals(m,ovr));
    Object.assign(m,ovr);
    S.cad=S.cadAll.filter(x=>x.sit==='Ativo');
    unload(); fillView(m); showEdit(0,false);
    msg('✅ Dados salvos!','ok');
  }catch(e){unload();msg('Erro: '+e.message,'er');}
}

async function salvarMin(){
  const m=S.cur;
  const ovr={declaMinist:$('edc').value,liderGA:$('elg').value.trim(),umComDeus:$('eucd').value,
    batizado:$('ebat').value,grupo:$('egrp').value,culto:$('eclt').value,senib:$('esnb').value,
    fazInteg:$('efi').value,sit:$('esit').value,perfil:$('epf').value,obs:$('eobs').value.trim()};
  load('Salvando...');
  try{
    await atualizar('Cadastro', m.linha, buildVals(m,ovr));
    Object.assign(m,ovr);
    S.cad=S.cadAll.filter(x=>x.sit==='Ativo');
    unload(); fillView(m); showEdit(1,false);
    msg('✅ Dados ministeriais salvos!','ok');
  }catch(e){unload();msg('Erro: '+e.message,'er');}
}

function renderEqList(selecionadas){
  const sel=(selecionadas||'').split(',').map(e=>e.trim()).filter(Boolean);
  const el=$('eq-list');
  if(!S.eqList.length){ el.innerHTML='<div style="color:var(--g4);padding:12px">Nenhuma equipe disponível.</div>'; return; }
  el.innerHTML='';
  S.eqList.forEach(eq=>{
    const item=document.createElement('div');
    item.className='eq-item'+(sel.indexOf(eq)>=0?' on':'');
    item.dataset.eq=eq;
    item.innerHTML=`<div class="eq-box">${sel.indexOf(eq)>=0?'✓':''}</div><div class="eq-lbl">${eq}</div>`;
    item.onclick=()=>{
      item.classList.toggle('on');
      const box=item.querySelector('.eq-box');
      box.textContent=item.classList.contains('on')?'✓':'';
    };
    el.appendChild(item);
  });
}

async function salvarEq(){
  const checks=$('eq-list').querySelectorAll('.eq-item.on');
  const equipes=[...checks].map(c=>c.dataset.eq).join(',');
  const m=S.cur;
  load('Salvando equipes...');
  try{
    await atualizar('Cadastro', m.linha, buildVals(m,{equipes}));
    m.equipes=equipes;
    unload(); msg('✅ Equipes salvas!','ok');
  }catch(e){unload();msg('Erro: '+e.message,'er');}
}

async function alterarSit(){
  const m=S.cur;
  const novo=m.sit==='Ativo'?'Inativo':'Ativo';
  if(!confirm((novo==='Inativo'?'Desativar':'Ativar')+' '+(m.nomeSoc||m.nomeComp)+'?')) return;
  load('Atualizando...');
  try{
    await atualizar('Cadastro', m.linha, buildVals(m,{sit:novo}));
    m.sit=novo;
    S.cad=S.cadAll.filter(x=>x.sit==='Ativo');
    unload(); fillView(m);
    msg(novo==='Ativo'?'✅ Membro ativado!':'⛔ Membro desativado!','ok');
  }catch(e){unload();msg('Erro: '+e.message,'er');}
}

// ═══════════════════════════════════════
// NOVO MEMBRO
// ═══════════════════════════════════════
function openNovo(){
  ['nn-pin','nn-nc','nn-ns','nn-us','nn-tel','nn-em'].forEach(id=>$(id).value='');
  $('nn-sx').value=''; $('nn-pf').value='Membro';
  $('sh-novo').classList.add('on');
}
function closeNovo(){ $('sh-novo').classList.remove('on'); }

async function salvarNovo(){
  const pin=$('nn-pin').value.trim(),nc=$('nn-nc').value.trim();
  const ns=$('nn-ns').value.trim(),us=$('nn-us').value.trim();
  if(!pin||!nc||!ns||!us){ msg('Preencha os campos obrigatórios.','er'); return; }
  const id='CP'+pin;
  const vals=[id,'',pin,nc,ns,us,$('nn-sx').value,$('nn-tel').value.trim(),'',
    $('nn-em').value.trim(),'','','','','','','','','','','Ativo','',$('nn-pf').value];
  load('Cadastrando...');
  try{
    await gravar('Cadastro',vals);
    const novo={linha:S.cadAll.length+2,id,foto:'',pin,nomeComp:nc,nomeSoc:ns,usuario:us,
      sexo:$('nn-sx').value,tel:$('nn-tel').value.trim(),rg:'',email:$('nn-em').value.trim(),
      declaMinist:'',liderGA:'',umComDeus:'',batizado:'',grupo:'',culto:'',senib:'',
      aniversario:'',equipes:'',fazInteg:'',sit:'Ativo',obs:'',$:'nn-pf'&&($('nn-pf').value),perfil:$('nn-pf').value};
    S.cadAll.push(novo); S.cad.push(novo);
    unload(); closeNovo(); renderCad();
    msg('✅ Membro cadastrado!','ok');
  }catch(e){unload();msg('Erro: '+e.message,'er');}
}

// ═══════════════════════════════════════
// ACCORDION DECISÕES
// ═══════════════════════════════════════
async function loadDecSemana() {
  const sw = getSemana();
  $('d-sw').textContent = fD(sw.ini).slice(0,5)+' – '+fD(sw.fim).slice(0,5);
  const ls = $('d-lista-semana');
  ls.innerHTML = '<div class="empty"><div class="ei">⏳</div><p>Carregando...</p></div>';
  try {
    const dados = await callScript({acao:'lerDecisoesSemana'});
    const lista = dados.values || [];
    $('d-total').textContent = lista.length;
    if(!lista.length){
      ls.innerHTML='<div class="empty"><div class="ei">✝</div><p>Nenhuma decisão esta semana.<br>Toque + para registrar.</p></div>';
      return;
    }
    // Agrupar por equipe
    const grupos = {}, ordem = [];
    lista.forEach(d=>{
      const eq = d.equipe||'Sem equipe';
      if(!grupos[eq]){ grupos[eq]=[]; ordem.push(eq); }
      grupos[eq].push(d);
    });
    ls.innerHTML = ordem.map((eq,i) => `
      <div class="acc-hdr" id="acc-hdr-${i}" onclick="toggleAcc(${i})">
        <div class="acc-hdr-left">
          <span style="font-size:14px">📍</span>
          <span class="acc-hdr-eq">${eq}</span>
          <span class="acc-cnt">${grupos[eq].length}</span>
        </div>
        <span class="acc-arr">▾</span>
      </div>
      <div class="acc-body" id="acc-body-${i}">
        ${grupos[eq].map(d=>`
          <div class="dec-item">
            <div class="dec-name">${d.nome}</div>
            <div class="dec-sub">
              ${d.assistido} · ${d.sexo||'-'}
              ${d.tel?'· 📞 '+d.tel:''}
              · <span class="badge ${d.integ==='S'?'bg-g':'bg-y'}">${d.integ==='S'?'✅ Integrar':'⏭ Não'}</span>
            </div>
          </div>`).join('')}
      </div>`).join('');
  } catch(e) {
    ls.innerHTML='<div class="empty"><div class="ei">⚠️</div><p>Erro ao carregar decisões.</p></div>';
  }
}

function toggleAcc(idx) {
  const hdr = $('acc-hdr-'+idx);
  const body = $('acc-body-'+idx);
  const isOpen = hdr.classList.contains('on');
  // Fechar todos
  document.querySelectorAll('.acc-hdr').forEach(h=>h.classList.remove('on'));
  document.querySelectorAll('.acc-body').forEach(b=>b.classList.remove('on'));
  // Abrir o clicado (se estava fechado)
  if(!isOpen){ hdr.classList.add('on'); body.classList.add('on'); }
}

// ═══════════════════════════════════════
// FORMULÁRIO DECISÃO — salva e continua
// ═══════════════════════════════════════
function openFormDec() {
  fillDecInfo();
  resetFormDec();
  renderSessao();
  $('sh-dec').classList.add('on');
}

function fecharFormDec() {
  $('sh-dec').classList.remove('on');
  // Limpar sessão local (as decisões já foram salvas no Sheets)
  S.decSession = [];
  // Recarregar lista da semana com os novos registros
  loadDecSemana();
}

function resetFormDec() {
  ['d-nm','d-tel','d-obs'].forEach(id=>$(id).value='');
  $('d-mot').value='';
  S.dec = {assistido:'Paciente', sexo:'Masculino', integ:false};
  document.querySelectorAll('#sh-dec .tg').forEach(tg=>{
    const bs=tg.querySelectorAll('.tb');
    bs.forEach(b=>b.classList.remove('on'));
    bs[0].classList.add('on');
  });
  $('d-nao').classList.add('on'); $('d-sim').classList.remove('on');
  $('blk-sim').style.display='none'; $('blk-nao').style.display='block';
}

function renderSessao() {
  const bl = $('d-sessao'), ls = $('d-lista-sessao');
  if(!S.decSession.length){ bl.style.display='none'; return; }
  bl.style.display='block';
  $('d-qtd').textContent = S.decSession.length;
  ls.innerHTML = S.decSession.map(d=>`
    <div class="dec-item" style="margin-bottom:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="dec-name">${d.nm}</div>
        <span class="badge ${d.integ?'bg-g':'bg-y'}">${d.integ?'✅':'⏭'}</span>
      </div>
      <div class="dec-sub">${d.assistido}${d.tel?' · '+d.tel:''}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════
// FOTO — Cloudinary (upload direto, sem CORS)
// ═══════════════════════════════════════
const CLOUD_NAME   = 'divxtp2wh';
const CLOUD_PRESET = 'capelania';
const CLOUD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

function abrirCameraM() {
  if(S.user?.perfil !== 'Líder') return;
  $('foto-input-m').click();
}

async function onFotoChangeM(event) {
  const file = event.target.files[0];
  if(!file || !S.cur) return;

  const prog = $('foto-prog');
  prog.classList.add('on');

  // Preview imediato no avatar
  const localUrl = URL.createObjectURL(file);
  const av = $('m-av');
  av.innerHTML = `<img src="${localUrl}" style="width:100%;height:100%;object-fit:cover">`;

  try {
    // Upload direto para Cloudinary — sem Apps Script, sem CORS
    const pin = (S.cur.pin || S.cur.id || 'sem-pin').toString().trim();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUD_PRESET);
    formData.append('public_id', pin);
    formData.append('folder', 'capelania');

    const resp = await fetch(CLOUD_URL, {method:'POST', body: formData});
    const data = await resp.json();
    console.log('Cloudinary response:', JSON.stringify(data));
    if(!resp.ok) throw new Error('HTTP ' + resp.status + ' - ' + (data.error?.message||JSON.stringify(data)));
    const fotoUrl = data.secure_url;
    if(!fotoUrl) throw new Error('URL não retornada: ' + JSON.stringify(data));

    // Salvar URL na planilha via Apps Script
    S.cur.foto = fotoUrl;
    const vals = buildVals(S.cur, {foto: fotoUrl});
    await atualizar('Cadastro', S.cur.linha, vals);

    // Atualizar cache local
    const idx = S.cadAll.findIndex(x=>x.linha===S.cur.linha);
    if(idx>=0) S.cadAll[idx].foto = fotoUrl;
    S.cad = S.cadAll.filter(x=>x.sit==='Ativo');

    prog.classList.remove('on');
    msg('✅ Foto salva!', 'ok');

  } catch(e) {
    prog.classList.remove('on');
    console.error('Upload Cloudinary:', e);
    msg('Erro ao salvar foto: ' + e.message, 'er');
  }
}

// ═══════════════════════════════════════
// Banner foto — só exibe, não permite câmera
// ═══════════════════════════════════════
function updateBannerFoto(foto) {
  const av = $('h-av');
  if(!av) return;
  if(foto && foto.indexOf('http')===0){
    // Converter URL do Drive se necessário
    const url = converterUrlFoto(foto);
    av.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.innerHTML='<span style=\'font-size:18px;font-weight:700\'>${ini(S.user?.nome||'')}</span>'">`;
  } else {
    av.innerHTML = `<span style="font-size:18px;font-weight:700">${ini(S.user?.nome||'')}</span>`;
  }
}

// Converte URL do Drive para formato que funciona no <img>
function converterUrlFoto(url) {
  if(!url) return '';
  // Já é URL direta do lh3 (AppSheets usa este formato)
  if(url.indexOf('lh3.google')>=0) return url;
  // URL do Drive: https://drive.google.com/file/d/ID/view
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if(m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  // URL open do Drive: https://drive.google.com/open?id=ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if(m2) return 'https://lh3.googleusercontent.com/d/' + m2[1];
  return url;
}

// ═══════════════════════════════════════
// INTEGRAÇÃO
// ═══════════════════════════════════════
async function loadIntegracao() {
  const sw = getSemana();
  // Semana anterior
  const swAnt = new Date(sw.ini);
  swAnt.setDate(swAnt.getDate() - 7);
  const swAntFim = new Date(sw.ini);
  swAntFim.setDate(swAntFim.getDate() - 1);
  $('i-sw').textContent = fD(swAnt).slice(0,5) + ' – ' + fD(swAntFim).slice(0,5);

  const ls = $('i-lista');
  ls.innerHTML = '<div class="empty"><div class="ei">⏳</div><p>Carregando...</p></div>';

  try {
    const dados = await callScript({acao:'lerIntegracao'});
    const lista = dados.values || [];
    $('i-total').textContent = lista.length;

    if(!lista.length){
      ls.innerHTML = '<div class="empty"><div class="ei">🔗</div><p>Nenhuma integração pendente<br>desta semana.</p></div>';
      return;
    }

    // Agrupar por capelão
    const grupos = {}, ordem = [];
    lista.forEach(d => {
      const cp = d.capelao || 'Sem capelão';
      if(!grupos[cp]){ grupos[cp]=[]; ordem.push(cp); }
      grupos[cp].push(d);
    });

    ls.innerHTML = ordem.map((cp, i) => `
      <div class="acc-hdr" id="iacc-hdr-${i}" onclick="toggleIAcc(${i})">
        <div class="acc-hdr-left">
          <span style="font-size:14px">👤</span>
          <span class="acc-hdr-eq">${cp}</span>
          <span class="acc-cnt">${grupos[cp].length}</span>
        </div>
        <span class="acc-arr">▾</span>
      </div>
      <div class="acc-body" id="iacc-body-${i}">
        ${grupos[cp].map(d => {
          const ok = (d.integrado||'').toLowerCase().indexOf('sim') >= 0 || d.integrado === 'S';
          return `<div class="dec-item" onclick="abrirDetInteg('${d.id}')" style="cursor:pointer">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <div class="dec-name">${d.nome}</div>
              <span class="badge ${ok?'bg-g':'bg-r'}">${ok?'❤️ SIM':'❤️ NÃO'}</span>
            </div>
            <div class="dec-sub">${d.assistido} · ${d.equipe}</div>
          </div>`;
        }).join('')}
      </div>`).join('');

    // Guardar dados para acesso rápido
    S._integLista = lista;

  } catch(e) {
    ls.innerHTML = '<div class="empty"><div class="ei">⚠️</div><p>Erro ao carregar.</p></div>';
    console.error(e);
  }
}

function toggleIAcc(idx) {
  const hdr  = $('iacc-hdr-'+idx);
  const body = $('iacc-body-'+idx);
  const isOpen = hdr.classList.contains('on');
  document.querySelectorAll('.acc-hdr').forEach(h=>h.classList.remove('on'));
  document.querySelectorAll('.acc-body').forEach(b=>b.classList.remove('on'));
  if(!isOpen){ hdr.classList.add('on'); body.classList.add('on'); }
}

function abrirDetInteg(id) {
  const lista = S._integLista || [];
  const d = lista.find(x => x.id === id);
  if(!d) return;
  S._curInteg = d;

  $('id-dv').textContent  = d.dvVisita || d.data || '-';
  $('id-eq').textContent  = d.equipe   || '-';
  $('id-cp').textContent  = d.capelao  || '-';
  $('id-as').textContent  = d.assistido|| '-';
  $('id-nm').textContent  = d.nome     || '-';
  $('id-tel').textContent = d.tel      || '-';
  $('id-obs').textContent = d.obs      || '-';

  const ok = (d.integrado||'').toLowerCase().indexOf('sim') >= 0 || d.integrado === 'S';
  const integEl = $('id-integ');
  integEl.innerHTML = ok
    ? '<span class="badge bg-g">❤️ SIM</span>'
    : '<span class="badge bg-r">❤️ NÃO</span>';

  // Botão registrar — desabilitar se já integrado
  const btnReg = $('btn-integ-reg');
  if(ok){
    btnReg.textContent = '✅ Já integrado';
    btnReg.disabled = true;
    btnReg.style.opacity = '0.5';
  } else {
    btnReg.textContent = '✅ Registrar Integração';
    btnReg.disabled = false;
    btnReg.style.opacity = '1';
  }

  ir('integ-det');
}

function abrirWpp1() {
  const d = S._curInteg; if(!d) return;
  const tel = '55' + (d.tel||'').replace(/\D/g,'');
  const integrador = S.user?.nome || '';
  const msg = encodeURIComponent(
    `Oi, tudo bem? Aqui é o ${integrador} !!\n\n` +
    `Estive com você durante uma de nossas visitas de capelania hospitalar e desde então tenho lembrado de você em minhas orações.\n\n` +
    `Gostaria muito de saber como você está, como tem sido sua recuperação e sua saúde nesse momento. Estamos orando por você e crendo que Deus está cuidando de cada detalhe.\n\n` +
    `Aproveito também para te fazer um convite especial: estamos com um curso gratuito chamado "Um com Deus", da Nova Igreja Batista. É uma oportunidade linda para fortalecer a fé, conhecer mais sobre Deus e pode ser feito online ou presencialmente, do jeitinho que for melhor pra você.\n\n` +
    `Se quiser saber mais ou participar, estou aqui à disposição!`
  );
  window.open(`https://api.whatsapp.com/send?phone=${tel}&text=${msg}`, '_blank');
}

function abrirWpp2() {
  const d = S._curInteg; if(!d) return;
  const tel = '55' + (d.tel||'').replace(/\D/g,'');
  const msg = 'Parabéns pela sua decisão de seguir a Cristo! 🎉' +
    '%20%0A%0AQuero te convidar para assistir às palestras UM COM DEUS, onde você vai fortalecer ainda mais sua fé. São gratuitas e acontecem num ambiente acolhedor: 👇🏼' +
    '%20%0A%20%0A📍 *_Auditório da NOVA IGREJA BATISTA_*' +
    '%20%0AAv. Torquato Tapajós, 4444 - Col. Santo Antônio' +
    '%20%0ADomingos: 8h, 10h30, 16h e 18h30.' +
    '%20%0ALocalizador: https://maps.app.goo.gl/DCnLW5b2qLubYCdv6' +
    '%20%0AOutros endereços próximos a você: https://bit.ly/3YOWU5c' +
    '%20%0A%20%0ASe não puder ir, acompanhe pelo YouTube:' +
    '%20%0Ahttps://youtube.com/playlist?list=PLsToeSg6pZF90VbxctNhCkd8i8FC7DPpZ' +
    '%20%0A%0AEstou à disposição para conversar! Que Deus te abençoe nessa caminhada. 😊';
  window.open(`https://api.whatsapp.com/send?phone=${tel}&text=${msg}`, '_blank');
}

async function registrarIntegracao() {
  const d = S._curInteg; if(!d) return;
  const btn = $('btn-integ-reg');
  btn.disabled = true; btn.textContent = 'Registrando...';
  load('Registrando integração...');
  try {
    // Gerar ID único
    const idInteg = 'INT' + Date.now().toString(36).toUpperCase();
    await callScript({
      acao:      'gravarIntegracao',
      idInteg:   idInteg,
      idDecisao: d.id,
      capelao:   S.user?.nome || d.capelao
    });
    unload();
    // Atualizar localmente
    d.integrado = 'Sim';
    // Atualizar badge na tela
    $('id-integ').innerHTML = '<span class="badge bg-g">❤️ SIM</span>';
    btn.textContent = '✅ Já integrado';
    btn.style.opacity = '0.5';
    msg('✅ Integração registrada!', 'ok');
    // Recarregar lista em background
    loadIntegracao();
  } catch(e) {
    unload();
    btn.disabled = false;
    btn.textContent = '✅ Registrar Integração';
    msg('Erro ao registrar: ' + e.message, 'er');
  }
}
