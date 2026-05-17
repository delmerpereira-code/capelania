// ═══════════════════════════════════════
// CONFIGURAÇÃO — troque pela URL do seu Apps Script
// ═══════════════════════════════════════
const SCRIPT = 'https://script.google.com/macros/s/AKfycbz-47sJIv9EdwLbfDSpKQfW_2qcjQ2I6AiodgpJApklGvOLoNtVZ520sdjb2WvufXJW/exec';

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
  const v = (val||'').toString().trim();
  // Tentar setar direto primeiro
  sel.value = v;
  if(sel.value === v) return;
  // Tentar case-insensitive
  const vUp = v.toUpperCase();
  for(const opt of sel.options) {
    if(opt.value.toUpperCase()===vUp || opt.text.toUpperCase()===vUp) {
      sel.value = opt.value; return;
    }
  }
  // Mapeamentos especiais
  const MAP = {
    'M':'Masculino','MASCULINO':'Masculino',
    'F':'Feminino','FEMININO':'Feminino',
    'LIDER':'LIDER','LÍDER':'LIDER',
    'MEMBRO':'Membro',
    'S':'S','N':'N',
    'SIM':'Sim','NÃO':'Não','NAO':'Não',
    'ATIVO':'Ativo','INATIVO':'Inativo'
  };
  const mapped = MAP[vUp];
  if(mapped){
    sel.value = mapped;
    if(sel.value !== mapped){
      for(const opt of sel.options){
        if(opt.value===mapped||opt.text===mapped){ sel.value=opt.value; return; }
      }
    }
  }
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
// Calcula semana igual ao Google Sheets NÚMSEMANA(data;2) — semana começa na segunda
function numSemana(d) {
  const data = d || new Date();
  const anoIni = new Date(data.getFullYear(), 0, 1);
  // Ajustar para segunda como primeiro dia (modo 2 do Sheets)
  const diaSemAnoIni = anoIni.getDay() || 7; // 1=seg...7=dom
  const diasPassados = Math.floor((data - anoIni) / 86400000);
  return Math.ceil((diasPassados + diaSemAnoIni) / 7);
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
  const scMap = {'integ-det':'sc-integ-det','resumo-det':'sc-resumo-det'};
  const scId = scMap[name] || 'sc-'+name;
  const sc = $(scId); if(sc) sc.classList.add('on');
  if(btn) {
    const nav = btn.closest('nav');
    if(nav) nav.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }
  if(name==='decisoes') loadDecSemana();
  if(name==='integracao') loadIntegracao();
  if(name==='resumo') loadResumo();
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

  const uTrim = u.trim(); // matrícula digitada
  let found = null;
  for(const r of S.loginData){
    // Login = matrícula (col C), Senha = col F
    if(String(r.pin) === uTrim && String(r.senha) === p){ found=r; break; }
  }

  if(!found){
    // Verificar se a matrícula existe (mas senha errada)
    const existe = S.loginData.some(r => String(r.pin) === uTrim);
    errEl.textContent = existe ? 'Senha incorreta.' : 'Matrícula não encontrada.';
    errEl.style.display='block'; return;
  }

  const nome = found.nomeSoc||found.usuario;
  const perfil = normPerfil(found.perfil);
  const equipes = (found.equipes||'').split(',').map(e=>e.trim()).filter(Boolean);
  S.user = {codigo:found.id||u, matricula:found.pin, nome, perfil};

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
    mods.push({ico:'📊',lbl:'Resumo',id:'resumo'});
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

  // Buscar foto do usuário logado
  buscarFotoUsuario();

  // ═══════════════════════════════════════
// MUDAR SENHA
// ═══════════════════════════════════════
function abrirMudarSenha() {
  $('s-atual').value=''; $('s-nova').value=''; $('s-conf').value='';
  $('sh-senha').classList.add('on');
}

async function confirmarMudarSenha() {
  const atual = $('s-atual').value.trim();
  const nova  = $('s-nova').value.trim();
  const conf  = $('s-conf').value.trim();
  if(!atual){ msg('Informe a senha atual.','er'); return; }
  if(!nova || nova.length < 4){ msg('Nova senha deve ter ao menos 4 caracteres.','er'); return; }
  if(nova !== conf){ msg('As senhas não coincidem.','er'); return; }
  load('Salvando...');
  try {
    const res = await callScript({
      acao:'mudarSenha',
      matricula: S.user.matricula||S.user.codigo,
      senhaAtual: atual,
      novaSenha: nova
    });
    unload();
    if(res.erro){ msg(res.erro,'er'); return; }
    $('sh-senha').classList.remove('on');
    msg('✅ Senha alterada com sucesso!','ok');
    // Atualizar senha na sessão local
    if(S.loginData){
      const u = S.loginData.find(r=>r.pin===(S.user.matricula||S.user.codigo));
      if(u) u.senha = nova;
    }
  } catch(e){ unload(); msg('Erro: '+e.message,'er'); }
}
async function mudarSenha(senhaAtual, novaSenha) {
  const res = await callScript({
    acao: 'mudarSenha',
    matricula: S.user.matricula || S.user.codigo,
    senhaAtual: senhaAtual,
    novaSenha: novaSenha
  });
  return res;
}

async function resetSenha(matricula) {
  const res = await callScript({acao: 'resetSenha', matricula: matricula});
  return res;
}

async function validarMatriculaDuplicada(matricula) {
  const res = await callScript({acao: 'validarMatricula', matricula: matricula});
  return res.existe || false;
}

// Buscar foto do usuário logado via Apps Script
async function buscarFotoUsuario() {
  try {
    const dados = await callScript({acao:'lerFotoUsuario', pin: S.user.matricula||S.user.codigo});
    const foto = dados.foto || '';
    const av = $('h-av');
    if(av){
      if(foto && foto.indexOf('http')===0){
        const url = converterUrlFoto(foto);
        // Usar <img> dentro mas manter onclick no div pai
        av.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"
          onerror="this.style.display='none';this.parentElement.querySelector('span').style.display='flex'">
          <span style="display:none;font-size:18px;font-weight:700;width:100%;height:100%;align-items:center;justify-content:center">${ini(S.user.nome)}</span>`;
      } else {
        av.innerHTML = `<span style="font-size:18px;font-weight:700">${ini(S.user.nome)}</span>`;
      }
      // Garantir que onclick funciona mesmo após trocar innerHTML
      av.onclick = abrirMudarSenha;
      av.style.cursor = 'pointer';
    }
  } catch(e) {
    const av = $('h-av');
    if(av) av.innerHTML = `<span style="font-size:18px;font-weight:700">${ini(S.user.nome)}</span>`;
  }
}

  // Gravar log de acesso — silencioso, sem bloquear o app
  try {
    const agora = new Date();
    const dataHora = fD(agora) + ' ' + agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    callScript({
      acao: 'gravar',
      aba:  'Log',
      dados: encodeURIComponent(JSON.stringify([
        dataHora,
        S.user.codigo,
        S.user.nome,
        S.equipe,
        S.user.perfil,
        navigator.userAgent.indexOf('Mobile')>=0 ? 'Celular' : 'Computador'
      ]))
    });
  } catch(e) { console.log('Log acesso:', e); }
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
  // Validar telefone — mínimo 10 dígitos, não pode ser só 92
  if(integ && tel){
    var telNum = tel.replace(/\D/g,'');
    if(telNum.length < 10 || telNum === '92' || telNum === '55'){
      msg('Telefone inválido — informe o número completo com DDD.','er'); return;
    }
  }
  if(integ&&!det){ msg('Informe as observações.','er'); return; }
  if(!integ&&!mot){ msg('Selecione o motivo.','er'); return; }
  const h=new Date(), hS=fD(h);
  if(!naSemanAtual(hS)){ msg('Fora da semana atual.','er'); return; }
  const dvS = fD(S.dv||h);
  const sem = numSemana(h); // igual ao NÚMSEMANA(data;2) do Sheets
  const vals = [gId(),hS,S.user.matricula||S.user.codigo,S.user.nome,S.equipe,dvS,
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

function setText(id, val) {
  const el = $(id); if(el) el.textContent = val||'-';
}

function fillView(m){
  const ns = m.nomeSoc||m.nomeComp;
  setText('m-name', ns);
  setText('m-id', m.id);

  // Avatar com foto
  const av = $('m-av');
  if(av){
    if(m.foto && m.foto.indexOf('http')===0){
      const fotoUrl = converterUrlFoto(m.foto);
      av.innerHTML=`<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover"
        onerror="this.style.display='none';this.parentElement.textContent='${ini(ns)}'">`;
    } else {
      av.textContent = ini(ns);
    }
  }
  // Botão câmera — só para Líder
  const camBtn = $('btn-cam-m');
  if(camBtn) camBtn.style.display = S.user?.perfil==='Líder' ? 'flex' : 'none';

  // Badge situação
  const bd = $('m-badge');
  if(bd){ bd.textContent=m.sit||'Ativo'; bd.className='badge '+(m.sit==='Ativo'?'bg-g':'bg-r'); }

  // Btn situação
  const bs = $('btn-sit');
  if(bs){ bs.textContent=m.sit==='Ativo'?'⛔ Desativar':'✅ Ativar membro'; bs.className='btn '+(m.sit==='Ativo'?'btn-r':'btn-g'); }

  // Dados pessoais
  setText('v-pin', m.pin);   setText('v-nc', m.nomeComp);
  setText('v-us', m.usuario); setText('v-sx', m.sexo);
  setText('v-tel', m.tel);    setText('v-rg', m.rg);
  setText('v-em', m.email);   setText('v-an', m.aniversario);

  // Ministerial
  setText('vm-dc', m.declaMinist); setText('vm-lg', m.liderGA);
  setText('vm-ucd', m.umComDeus);  setText('vm-bat', m.batizado);
  setText('vm-grp', m.grupo);      setText('vm-clt', m.culto);
  setText('vm-snb', m.senib);      setText('vm-fi', m.fazInteg);
  setText('vm-sit', m.sit);        setText('vm-pf', m.perfil);
  setText('vm-obs', m.obs);

  // Equipes
  renderEqList(m.equipes||'');
}

function setTab(idx, btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on'); $('p'+idx).classList.add('on');
}

function showEdit(pane, on){
  const vEl = $('v'+pane), eEl = $('e'+pane);
  if(vEl) vEl.style.display = on ? 'none' : 'block';
  if(eEl) eEl.style.display = on ? 'block' : 'none';
  if(!on || !S.cur) return;
  const m = S.cur;
  if(pane===0){
    if($('ep'))   $('ep').value   = m.pin||'';
    if($('enc'))  $('enc').value  = m.nomeComp||'';
    if($('ens'))  $('ens').value  = m.nomeSoc||'';
    if($('etel')) $('etel').value = m.tel||'';
    if($('erg'))  $('erg').value  = m.rg||'';
    if($('eem'))  $('eem').value  = m.email||'';
    if($('ean'))  $('ean').value  = m.aniversario||'';
    // Sexo — setar valor direto
    const esx = $('esx');
    if(esx) {
      const sx = (m.sexo||'').toString().trim();
      // Tentar setar direto primeiro
      esx.value = sx;
      // Se não encontrou, tentar variações
      if(!esx.value || esx.value !== sx) {
        for(const opt of esx.options) {
          if(opt.value===sx || opt.text===sx ||
             opt.value.toUpperCase()===sx.toUpperCase()) {
            esx.value = opt.value; break;
          }
        }
      }
    }
  }
  if(pane===1){
    if($('elg'))  $('elg').value  = m.liderGA||'';
    if($('eobs')) $('eobs').value = m.obs||'';
    setOpt('edc',  m.declaMinist);
    setOpt('eucd', m.umComDeus);
    setOpt('ebat', m.batizado);
    setOpt('egrp', m.grupo);
    setOpt('eclt', m.culto);
    setOpt('esnb', m.senib);
    setOpt('efi',  m.fazInteg);
    setOpt('esit', m.sit||'Ativo');
    setOpt('epf',  m.perfil||'Membro');
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
  const pin=$('ep').value.trim(),nc=$('enc').value.trim(),ns=$('ens').value.trim();
  if(!pin||!nc||!ns){ msg('Preencha os campos obrigatórios.','er'); return; }
  const ovr={pin,nomeComp:nc,nomeSoc:ns,usuario:m.usuario||pin,sexo:$('esx').value,tel:$('etel').value.trim(),rg:$('erg').value.trim(),email:$('eem').value.trim(),aniversario:$('ean').value.trim()};
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
  if(!pin||!nc||!ns){ msg('Preencha os campos obrigatórios.','er'); return; }
  // Validar matrícula duplicada
  load('Verificando matrícula...');
  try {
    const chk = await callScript({acao:'validarMatricula', matricula:pin});
    if(chk.existe){ unload(); msg('Matrícula '+pin+' já cadastrada!','er'); return; }
  } catch(e){ unload(); }
  const id='CP'+pin;
  // Col F = senha padrão = matrícula
  const vals=[id,'',pin,nc,ns,pin,$('nn-sx').value,$('nn-tel').value.trim(),'',
    $('nn-em').value.trim(),'','','','','','','','','','','Ativo','',$('nn-pf').value];
  load('Cadastrando...');
  try{
    await gravar('Cadastro',vals);
    const novo={linha:S.cadAll.length+2,id,foto:'',pin,nomeComp:nc,nomeSoc:ns,usuario:pin,
      sexo:$('nn-sx').value,tel:$('nn-tel').value.trim(),rg:'',email:$('nn-em').value.trim(),
      declaMinist:'',liderGA:'',umComDeus:'',batizado:'',grupo:'',culto:'',senib:'',
      aniversario:'',equipes:'',fazInteg:'',sit:'Ativo',obs:'',perfil:$('nn-pf').value};
    S.cadAll.push(novo); S.cad.push(novo);
    unload(); closeNovo(); renderCad();
    msg('✅ Membro cadastrado! Senha padrão: '+pin,'ok');
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

// Comprime imagem antes de enviar — maxWidth em pixels, quality 0-1
function comprimirImagem(file, maxWidth, quality) {
  return new Promise((ok, er) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if(w > maxWidth){ h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => ok(blob), 'image/jpeg', quality);
    };
    img.onerror = er;
    img.src = url;
  });
}
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
    // Comprimir antes de enviar
    const fileComp = await comprimirImagem(file, 800, 0.75);
    const formData = new FormData();
    formData.append('file', fileComp);
    formData.append('upload_preset', CLOUD_PRESET);
    formData.append('public_id', pin);
    formData.append('folder', 'capelania/Membros');

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
    console.log('Carregando integração...');
    const dados = await callScript({acao:'lerIntegracao'});
    console.log('Integração response:', JSON.stringify(dados).substr(0,200));
    const lista = dados.values || [];
    console.log('Total integrações:', lista.length);

    // Guardar lista completa para filtros
    S._integLista = lista;
    S._integFiltro = S._integFiltro || 'todos';

    // Contadores
    const totalSim = lista.filter(d => isIntegrado(d)).length;
    const totalNao = lista.length - totalSim;
    $('i-total').textContent = lista.length;
    if($('i-sim')) $('i-sim').textContent = totalSim;
    if($('i-nao')) $('i-nao').textContent = totalNao;

    if(!lista.length){
      ls.innerHTML = '<div class="empty"><div class="ei">🔗</div><p>Nenhuma integração<br>desta semana.</p></div>';
      return;
    }

    renderIntegLista();
  } catch(e) {
    ls.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>Erro: ${e.message}</p></div>`;
    console.error('Integração erro:', e);
  }
}

function isIntegrado(d) {
  const v = (d.integrado||'').toLowerCase();
  return v.indexOf('sim') >= 0 || v === 's';
}

function filtroInteg(tipo) {
  S._integFiltro = tipo;
  ['todos','nao','sim'].forEach(t => {
    const el = $('if-'+t);
    if(el) el.classList.toggle('on', t===tipo);
  });
  renderIntegLista();
}

function renderIntegLista() {
  const ls = $('i-lista');
  if(!S._integLista) return;
  let lista = S._integLista;
  if(S._integFiltro === 'sim') lista = lista.filter(d => isIntegrado(d));
  if(S._integFiltro === 'nao') lista = lista.filter(d => !isIntegrado(d));
  // Filtro de busca por nome
  const busca = ($('i-search') ? $('i-search').value : '').toLowerCase().trim();
  if(busca) lista = lista.filter(d =>
    (d.nome||'').toLowerCase().indexOf(busca) >= 0 ||
    (d.integrador||'').toLowerCase().indexOf(busca) >= 0 ||
    (d.capelao||'').toLowerCase().indexOf(busca) >= 0
  );
  if(!lista.length){
    const msgTxt = S._integFiltro==='sim' ? 'Nenhum integrado ainda.' : S._integFiltro==='nao' ? 'Todos já foram integrados! 🎉' : 'Nenhum registro.';
    ls.innerHTML = `<div class="empty"><div class="ei">${S._integFiltro==='nao'?'🎉':'🔗'}</div><p>${msgTxt}</p></div>`;
    return;
  }
  const grupos = {}, ordem = [];
  lista.forEach(d => {
    const cp = d.integrador || d.capelao || 'Sem integrador';
    if(!grupos[cp]){ grupos[cp]=[]; ordem.push(cp); }
    grupos[cp].push(d);
  });
  // Ordenar integradores: Feminino primeiro, depois Masculino, cada um por nome ASC
  function sexoInteg(nome) {
    const m = (S.cadAll||[]).find(x => (x.nomeSoc||x.nomeComp||'').toLowerCase()===nome.toLowerCase());
    return m ? (m.sexo||'').toUpperCase() : '';
  }
  ordem.sort((a,b) => {
    const sa = sexoInteg(a), sb = sexoInteg(b);
    const aF = sa==='FEMININO'||sa==='F', bF = sb==='FEMININO'||sb==='F';
    if(aF && !bF) return -1;
    if(!aF && bF) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
  // Dentro de cada grupo: pendentes primeiro, por nome ASC
  ordem.forEach(cp => {
    grupos[cp].sort((a,b) => {
      const okA = isIntegrado(a), okB = isIntegrado(b);
      if(okA !== okB) return okA - okB;
      return (a.nome||'').localeCompare(b.nome||'', 'pt-BR');
    });
  });
  // Guardar lista ordenada para navegação com setas
  S._integListaFiltrada = [];
  ordem.forEach(cp => { S._integListaFiltrada = S._integListaFiltrada.concat(grupos[cp]); });

  ls.innerHTML = ordem.map((cp, i) => {
    const simCnt = grupos[cp].filter(d=>isIntegrado(d)).length;
    const naoCnt = grupos[cp].length - simCnt;
    return `<div class="acc-hdr" id="iacc-hdr-${i}" onclick="toggleIAcc(${i})">
        <div class="acc-hdr-left">
          <span style="font-size:16px">👤</span>
          <span class="acc-hdr-eq">${cp}</span>
          <span class="acc-cnt">${grupos[cp].length}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${naoCnt>0?`<span style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700">🤍 ${naoCnt}</span>`:''}
          ${simCnt>0?`<span style="background:#dcfce7;color:#15803d;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700">❤️ ${simCnt}</span>`:''}
          <span class="acc-arr">▾</span>
        </div>
      </div>
      <div class="acc-body" id="iacc-body-${i}">
        ${grupos[cp].map(d => {
          const ok = isIntegrado(d);
          return `<div onclick="abrirDetInteg('${d.id}')" style="cursor:pointer;padding:14px 16px;border-bottom:1px solid var(--g1);display:flex;align-items:center;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="font-size:17px;font-weight:700;color:var(--navy)">${d.nome}</div>
              <div style="font-size:13px;color:var(--g5);margin-top:3px">${d.assistido} · ${d.hospital}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
              <span style="font-size:22px">${ok?'❤️':'🤍'}</span>
              <span style="font-size:11px;font-weight:700;color:${ok?'#15803d':'#991b1b'}">${ok?'SIM':'NÃO'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }).join('');
}


function navInteg(dir) {
  const lista = S._integListaAtual || [];
  const idx = (S._integIdx || 0) + dir;
  if(idx < 0 || idx >= lista.length) return;
  abrirDetInteg(lista[idx].id);
}

function proximoInteg(atual) {
  const lista = S._integLista || [];
  const integrador = atual.integrador || atual.capelao || '';

  // Buscar próximo pendente do mesmo integrador
  const doInteg = lista.filter(d =>
    (d.integrador||d.capelao||'') === integrador && !isIntegrado(d)
  ).sort((a,b) => (a.nome||'').localeCompare(b.nome||'', 'pt-BR'));

  if(doInteg.length > 0) {
    // Tem próximo — abrir automaticamente
    msg('➡️ Próximo: ' + doInteg[0].nome, '');
    setTimeout(() => abrirDetInteg(doInteg[0].id), 800);
  } else {
    // Acabou a lista do integrador
    msg('🎉 Sem pendências para ' + integrador.split(' ')[0] + '!', 'ok');
    setTimeout(() => ir('integracao'), 1500);
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

  $('id-nm').textContent  = d.nome     || '-';
  $('id-dv').textContent  = d.data     || '-';

  // Atualizar header com setas
  const navNome = $('nav-nome'), navPos = $('nav-pos');
  if(navNome) navNome.textContent = d.nome || '-';
  // Calcular posição na lista do integrador
  const listaInteg = (S._integListaFiltrada||S._integLista||[]).filter(x =>
    (x.integrador||x.capelao||'') === (d.integrador||d.capelao||'')
  );
  const posAtual = listaInteg.findIndex(x => x.id === d.id);
  if(navPos) navPos.textContent = (posAtual+1) + ' de ' + listaInteg.length;
  // Guardar índice atual para navegação
  S._integIdx = posAtual;
  S._integListaAtual = listaInteg;
  // Desabilitar setas nos extremos
  const btnP = $('btn-prev'), btnN = $('btn-next');
  if(btnP) btnP.style.opacity = posAtual <= 0 ? '0.3' : '1';
  if(btnN) btnN.style.opacity = posAtual >= listaInteg.length-1 ? '0.3' : '1';
  $('id-eq').textContent  = d.hospital || d.equipe || '-';
  $('id-cp').textContent  = d.capelao  || '-';
  $('id-as').textContent  = d.assistido? '🛏️ '+d.assistido : '-';
  const telNum = (d.tel||'').replace(/\D/g,'');
  const telValido = telNum.length >= 10 && telNum !== '92' && telNum !== '55';
  $('id-tel').textContent = d.tel || '⚠️ Sem telefone válido';
  $('id-tel').style.color = telValido ? 'var(--blue)' : 'var(--red)';
  $('id-obs').textContent = d.obs      || '-';

  // Desabilitar WhatsApp se não tem telefone válido
  const btn1 = document.querySelector('[onclick="abrirWpp1()"]');
  const btn2 = document.querySelector('[onclick="abrirWpp2()"]');
  if(btn1){ btn1.style.opacity = telValido?'1':'0.4'; btn1.style.pointerEvents = telValido?'auto':'none'; }
  if(btn2){ btn2.style.opacity = telValido?'1':'0.4'; btn2.style.pointerEvents = telValido?'auto':'none'; }

  const ok = (d.integrado||'').toLowerCase().indexOf('sim') >= 0 || d.integrado === 'S';
  const integEl = $('id-integ');
  integEl.innerHTML = ok
    ? '<span class="badge bg-g" style="font-size:15px;padding:6px 14px">❤️ SIM — Integrado</span>'
    : '<span class="badge bg-r" style="font-size:15px;padding:6px 14px">❤️ NÃO — Pendente</span>';

  // Botão registrar — desabilitar se já integrado
  const btnReg = $('btn-integ-reg');
  const btnDiv = btnReg.querySelector('div:last-child div:first-child');
  if(ok){
    btnReg.disabled = true;
    btnReg.style.opacity = '0.5';
    btnReg.style.background = '#27ae60';
    if(btnDiv) btnDiv.textContent = 'Já integrado ✓';
  } else {
    btnReg.disabled = false;
    btnReg.style.opacity = '1';
    btnReg.style.background = 'var(--navy)';
    if(btnDiv) btnDiv.textContent = 'Registrar Integração';
  }

  ir('integ-det');
}

function abrirWpp1() {
  const d = S._curInteg; if(!d) return;
  const tel = '55' + (d.tel||'').replace(/\D/g,'');
  // [Integrador] = col K — quem vai fazer o contato
  const integrador = d.integrador || d.capelao || S.user?.nome || '';
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
  // [Integrador] = col K
  const integrador = d.integrador || d.capelao || S.user?.nome || '';
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
  // Validar telefone antes de registrar
  const telNum = (d.tel||'').replace(/\D/g,'');
  const telValido = telNum.length >= 10 && telNum !== '92' && telNum !== '55';
  if(!telValido){
    msg('Não é possível registrar integração sem telefone válido.','er');
    return;
  }
  const btn = $('btn-integ-reg');
  btn.disabled = true; btn.textContent = 'Registrando...';
  load('Registrando integração...');
  try {
    // Gerar ID único
    const idInteg = 'INT' + Date.now().toString(36).toUpperCase();
    await callScript({
      acao:      'gravarIntegracao',
      idInteg:   idInteg,
      idDecisao: d.idDecisao || d.id,
      capelao:   d.integrador || d.capelao || S.user?.nome || ''
    });
    unload();
    // Atualizar localmente
    d.integrado = 'Sim';
    msg('✅ Integração registrada!', 'ok');
    // Recarregar lista em background
    loadIntegracao();
    // Ir automaticamente para o próximo pendente do mesmo integrador
    setTimeout(() => proximoInteg(d), 1200);
  } catch(e) {
    unload();
    btn.disabled = false;
    btn.textContent = '✅ Registrar Integração';
    msg('Erro ao registrar: ' + e.message, 'er');
  }
}

// ═══════════════════════════════════════
// MÓDULO RESUMO
// ═══════════════════════════════════════
var S_RES = { foto: '', fotoNome: '', dados: null };

async function loadResumo() {
  const ls = $('res-lista');
  ls.innerHTML = '<div class="empty"><div class="ei">⏳</div><p>Carregando...</p></div>';
  try {
    const dados = await callScript({acao:'lerResumos'});
    const lista = dados.values || [];
    if(!lista.length){
      ls.innerHTML = '<div class="empty"><div class="ei">📊</div><p>Nenhum resumo ainda.<br>Toque + para criar.</p></div>';
      return;
    }
    // Agrupar por data
    const grupos = {}, ordem = [];
    lista.forEach(r => {
      if(!grupos[r.data]){ grupos[r.data]=[]; ordem.push(r.data); }
      grupos[r.data].push(r);
    });
    ls.innerHTML = ordem.map(data => `
      <div class="eq-hdr"><span>📅 ${data}</span>
        <span class="eq-cnt">${grupos[data].reduce((s,r)=>s+r.total,0)}</span>
      </div>
      ${grupos[data].map(r => {
        const temFoto = r.foto && r.foto.indexOf('http')===0;
        return `<div class="mrow" onclick="abrirDetResumo('${r.id}')" style="gap:12px;padding:14px">
          <div style="width:56px;height:56px;border-radius:10px;background:var(--g2);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">
            ${temFoto ? `<img src="${converterUrlFoto(r.foto)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:24px">📷</span>'}
          </div>
          <div style="flex:1;min-width:0">
            <div class="mname" style="font-size:15px">${r.equipe}</div>
            <div class="member-sub" style="margin-top:4px;font-size:12px">
              ✝ ${r.total} decisões · 📋 ${r.lancadas} lançadas · Saldo: ${r.saldo}
            </div>
          </div>
          <span style="color:var(--g3);font-size:20px">›</span>
        </div>`;
      }).join('')}`).join('');
    S._resumos = lista;
  } catch(e) {
    ls.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>Erro: ${e.message}</p></div>`;
  }
}

function abrirDetResumo(id) {
  const r = (S._resumos||[]).find(x=>x.id===id);
  if(!r) return;
  S._curResumo = r;
  // Preencher card
  $('rc-equipe').textContent = r.equipe;
  $('rc-data').textContent   = r.data;
  $('rc-lider').textContent  = r.lider;
  $('rc-total').textContent  = r.total;
  $('rc-saldo').textContent  = r.saldo;
  // Foto
  const fotoDiv = $('res-card-foto');
  if(r.foto && r.foto.indexOf('http')===0){
    fotoDiv.innerHTML = `<img src="${converterUrlFoto(r.foto)}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    fotoDiv.innerHTML = '<span style="font-size:48px">📷</span>';
  }
  ir('resumo-det');
}

function compartilharResumo() {
  const r = S._curResumo; if(!r) return;
  const texto = encodeURIComponent(
    `✝ *RELATÓRIO DE VISITA*\n\n` +
    `🏥 *${r.equipe}*\n` +
    `📅 Data: ${r.data}\n` +
    `👤 Líder: ${r.lider}\n\n` +
    `✝ *Decisões:* ${r.total}\n` +
    `📋 *Lançadas:* ${r.lancadas}\n` +
    `📊 *Saldo:* ${r.saldo}\n\n` +
    `_Ministério de Capelania — Nova Igreja Batista_`
  );
  window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
}

function abrirNovoResumo() {
  S_RES = {foto:'', fotoNome:'', dados:null};
  $('res-foto-preview').style.display = 'none';
  $('res-total').value = '';
  // Data da visita do login
  $('res-data').value = fD(S.dv||new Date());
  // Equipe fixa do login — sem seleção
  const equipe = S.equipe || '';
  const inp = $('res-eq');
  const disp = $('res-eq-display');
  if(inp) inp.value = equipe;
  if(disp) disp.textContent = equipe || 'Nenhuma equipe selecionada';
  $('sh-resumo').classList.add('on');
}

function onResFotoChange(event) {
  const file = event.target.files[0]; if(!file) return;
  S_RES.dados = file;
  // Preview
  const url = URL.createObjectURL(file);
  $('res-foto-img').src = url;
  $('res-foto-preview').style.display = 'block';
  $('res-foto-status').textContent = '📷 ' + file.name;
  // Gerar nome do arquivo
  const data  = ($('res-data').value||fD(new Date())).split('/').reverse().join('-');
  const eqVal = ($('res-eq') ? $('res-eq').value : '') || S.equipe || 'equipe';
  const eq    = eqVal.replace(/[^a-zA-Z0-9]/g,'_').substring(0,30);
  const ext   = file.name.split('.').pop() || 'jpg';
  S_RES.fotoNome = `${data}_${eq}.${ext}`;
}

async function salvarResumo() {
  const eq    = ($('res-eq') ? $('res-eq').value : '') || S.equipe || '';
  const data  = $('res-data').value.trim();
  const total = $('res-total').value.trim();
  if(!eq){ msg('Equipe não identificada. Faça login novamente.','er'); return; }
  if(!data){ msg('Informe a data da visita.','er'); return; }
  if(!total){ msg('Informe o total de decisões.','er'); return; }

  let fotoUrl = '';

  // Upload foto direto para Cloudinary — comprimida para reduzir tamanho
  if(S_RES.dados){
    load('Enviando foto... aguarde');
    try {
      // Redimensionar e comprimir antes de enviar
      const blob = await comprimirImagem(S_RES.dados, 1024, 0.7);
      const formData = new FormData();
      formData.append('file', blob);
      formData.append('upload_preset', CLOUD_PRESET);
      formData.append('folder', 'capelania/Visitas');

      console.log('Upload visita para Cloudinary...');
      const resp = await fetch(CLOUD_URL, {method:'POST', body: formData});
      const data = await resp.json();
      console.log('Cloudinary result:', JSON.stringify(data).substr(0,200));

      if(data.secure_url){
        fotoUrl = data.secure_url;
        msg('📷 Foto enviada!', 'ok');
      } else {
        unload();
        const errMsg = data.error ? data.error.message : 'Erro desconhecido';
        if(!confirm('Erro ao salvar foto: '+errMsg+'. Continuar sem a foto?')) return;
      }
    } catch(e) {
      unload();
      console.error('Upload erro:', e);
      if(!confirm('Erro ao enviar foto. Continuar sem a foto?')) return;
    }
  }

  load('Salvando resumo...');
  try {
    const res = await callScript({
      acao:       'gravarResumo',
      equipe:     eq,
      dataVisita: data,
      lider:      S.user.nome,
      total:      parseInt(total),
      foto:       fotoUrl
    });
    unload();
    if(res.erro){ msg(res.erro,'er'); return; }
    $('sh-resumo').classList.remove('on');
    msg(`✅ Resumo salvo! Lançadas: ${res.lancadas} · Saldo: ${res.saldo}`,'ok');
    loadResumo();
  } catch(e){ unload(); msg('Erro ao salvar: '+e.message,'er'); }
}
