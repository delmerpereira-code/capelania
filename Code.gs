var ID = '17U6MBGBF63jxObmBzRprtIr3I3nlDsbZEMJWC-mr0lo';

function doGet(e) {
  var p = e.parameter, cb = p.callback||'';
  try {
    var r;
    switch(p.acao) {
      case 'lerUsuarios':       r = lerUsuarios_(); break;
      case 'lerCadastro':       r = lerCadastro_(); break;
      case 'lerEquipes':        r = lerEquipes_(); break;
      case 'lerDecisoesSemana': r = lerDecisoesSemana_(); break;
      case 'gravar':
        var ss = SpreadsheetApp.openById(ID);
        var sh = ss.getSheetByName(p.aba);
        if(!sh) throw new Error('Aba nao encontrada: '+p.aba);
        sh.appendRow(JSON.parse(decodeURIComponent(p.dados)));
        // Garantir fórmulas auxiliares na aba Decisões
        if(p.aba === 'Decisões') garantirFormulas_(ss);
        r = {status:'ok'}; break;
      case 'atualizar':
        var ss2 = SpreadsheetApp.openById(ID);
        var sh2 = ss2.getSheetByName(p.aba);
        if(!sh2) throw new Error('Aba nao encontrada: '+p.aba);
        var vals = JSON.parse(decodeURIComponent(p.dados));
        var linha = parseInt(p.linha);
        sh2.getRange(linha, 1, 1, vals.length).setValues([vals]);
        r = {status:'ok'}; break;
      case 'lerIntegracao':
        r = lerIntegracao_(); break;
      case 'gravarIntegracao':
        var ss3  = SpreadsheetApp.openById(ID);
        var sh3  = ss3.getSheetByName('Resultado_Integracao');
        if(!sh3) throw new Error('Aba Resultado_Integracao nao encontrada');
        var now3 = new Date();
        var dataStr3 = formatDate_(now3)+' '+('0'+now3.getHours()).slice(-2)+':'+('0'+now3.getMinutes()).slice(-2);
        // 1. Gravar em Resultado_Integracao
        sh3.appendRow([p.idInteg, p.idDecisao, p.capelao, dataStr3, 'Sim']);
        // 2. Atualizar col D (StatusIntegracao) na aba Integração
        var shI  = ss3.getSheetByName('Integração');
        if(shI) {
          var dI = shI.getDataRange().getValues();
          for(var ii=1; ii<dI.length; ii++){
            var idLinha = (dI[ii][0]||'').toString().trim();
            var idDecLinha = (dI[ii][11]||'').toString().trim();
            if(idLinha === p.idDecisao || idDecLinha === p.idDecisao || idLinha === p.idInteg) {
              shI.getRange(ii+1, 4).setValue('Sim'); // col D = StatusIntegracao
              Logger.log('Integração atualizada na linha ' + (ii+1));
              break;
            }
          }
        }
        r = {status:'ok'}; break;
      case 'mudarSenha':
        // Muda senha do próprio usuário (col F)
        var ssMud = SpreadsheetApp.openById(ID);
        var shMud = ssMud.getSheetByName('Cadastro');
        var datMud = shMud.getDataRange().getValues();
        var mudOk = false;
        var matMud = decodeURIComponent(p.matricula||'').trim();
        var senhaAtualMud = decodeURIComponent(p.senhaAtual||'').trim();
        var novaSenhaMud = decodeURIComponent(p.novaSenha||'').trim();
        for(var mi=1; mi<datMud.length; mi++){
          var mat2 = (datMud[mi][2]||'').toString().trim();
          if(mat2 !== matMud) continue;
          var senhaAtual = (datMud[mi][5]||mat2).toString().trim();
          if(senhaAtual !== senhaAtualMud){ r={erro:'Senha atual incorreta.'}; mudOk=true; break; }
          shMud.getRange(mi+1, 6).setValue(novaSenhaMud);
          mudOk = true; r={status:'ok'}; break;
        }
        if(!mudOk) r={erro:'Matrícula não encontrada.'};
        break;
      case 'resetSenha':
        // Só Líder pode resetar — redefine col F para a matrícula
        var ssRes = SpreadsheetApp.openById(ID);
        var shRes = ssRes.getSheetByName('Cadastro');
        var datRes = shRes.getDataRange().getValues();
        for(var ri2=1; ri2<datRes.length; ri2++){
          var mat3 = (datRes[ri2][2]||'').toString().trim();
          if(mat3 !== p.matricula) continue;
          shRes.getRange(ri2+1, 6).setValue(mat3); // reset para matrícula
          r={status:'ok'}; break;
        }
        if(!r) r={erro:'Matrícula não encontrada.'};
        break;
      case 'validarMatricula':
        // Verifica se matrícula já existe
        var ssVal = SpreadsheetApp.openById(ID);
        var shVal = ssVal.getSheetByName('Cadastro');
        var datVal = shVal.getDataRange().getValues();
        var existe = false;
        for(var vi=1; vi<datVal.length; vi++){
          if((datVal[vi][2]||'').toString().trim() === p.matricula){ existe=true; break; }
        }
        r={existe:existe}; break;
      case 'lerAniv':
        r = lerAniv_(); break;
      case 'lerResumos':
        r = lerResumos_(); break;
      case 'gravarResumo':
        r = gravarResumo_(p); break;
      case 'uploadFotoVisita':
        r = uploadFotoVisita_(p.nome, p.tipo, p.dados); break;
      case 'lerFotoUsuario':
        var ssCad = SpreadsheetApp.openById(ID).getSheetByName('Cadastro');
        var cadRows = ssCad.getDataRange().getValues();
        var fotoEncontrada = '';
        for(var fi=1; fi<cadRows.length; fi++){
          var pinCad = (cadRows[fi][2]||'').toString().trim();
          if(pinCad === p.pin){
            fotoEncontrada = (cadRows[fi][1]||'').toString().trim();
            break;
          }
        }
        r = {foto: fotoEncontrada}; break;
      case 'uploadFoto':
        r = uploadFoto_(p.nome, p.tipo, p.dados, p.pasta); break;
      default: r = {erro:'Ação desconhecida: '+p.acao};
    }
    return resp(cb, r);
  } catch(err) { return resp(cb, {erro:err.toString()}); }
}

function resp(cb, obj) {
  var json = JSON.stringify(obj);
  var body = cb ? cb+'('+json+');' : json;
  var mime = cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mime);
}

function lerUsuarios_() {
  // col C (Matrícula) = login, col F = senha (padrão: própria matrícula)
  var data = SpreadsheetApp.openById(ID).getSheetByName('Cadastro').getDataRange().getValues();
  var res = [];
  for(var i=1;i<data.length;i++){
    var r   = data[i];
    var mat = (r[2]||'').toString().trim(); // col C = Matrícula
    var sit = (r[20]||'').toString().trim().toLowerCase();
    if(!mat || sit === 'inativo') continue;
    var senha = (r[5]||'').toString().trim(); // col F = Senha
    if(!senha) senha = mat; // senha padrão = matrícula
    res.push({
      id:      (r[0] ||'').toString().trim(),
      pin:     mat,   // login = matrícula
      senha:   senha, // col F
      nomeSoc: (r[4] ||'').toString().trim(),
      usuario: mat,
      equipes: (r[18]||'').toString().trim(),
      perfil:  (r[22]||'').toString().trim()
    });
  }
  return {values:res};
}

function lerCadastro_() {
  var data = SpreadsheetApp.openById(ID).getSheetByName('Cadastro').getDataRange().getValues();
  var res = [];
  for(var i=1;i<data.length;i++){
    var r=data[i], nc=(r[3]||'').toString().trim(), ns=(r[4]||'').toString().trim();
    if(!nc&&!ns) continue;
    var aniv='';
    if(r[17]){ if(r[17] instanceof Date){var d=r[17];aniv=('0'+(d.getMonth()+1)).slice(-2)+'/'+('0'+d.getDate()).slice(-2);}else aniv=r[17].toString().trim(); }
    res.push({linha:i+1, id:(r[0]||'').toString().trim(), foto:(r[1]||'').toString().trim(),
      pin:(r[2]||'').toString().trim(), nomeComp:nc, nomeSoc:ns,
      usuario:(r[5]||'').toString().trim(), sexo:(r[6]||'').toString().trim(),
      tel:(r[7]||'').toString().trim(), rg:(r[8]||'').toString().trim(),
      email:(r[9]||'').toString().trim(), declaMinist:(r[10]||'').toString().trim(),
      liderGA:(r[11]||'').toString().trim(), umComDeus:(r[12]||'').toString().trim(),
      batizado:(r[13]||'').toString().trim(), grupo:(r[14]||'').toString().trim(),
      culto:(r[15]||'').toString().trim(), senib:(r[16]||'').toString().trim(),
      aniversario:aniv, equipes:(r[18]||'').toString().trim(),
      fazInteg:(r[19]||'').toString().trim(), sit:(r[20]||'Ativo').toString().trim(),
      obs:(r[21]||'').toString().trim(), perfil:(r[22]||'Membro').toString().trim()});
  }
  return {values:res};
}

function lerEquipes_() {
  var data = SpreadsheetApp.openById(ID).getSheetByName('Equipes').getDataRange().getValues();
  var res = [];
  for(var i=1;i<data.length;i++){
    var eq=(data[i][1]||'').toString().trim(); // Coluna B
    if(eq) res.push(eq);
  }
  return {values:res};
}

function lerDecisoesSemana_() {
  // Calcular Dom e Sáb da semana atual
  var hoje = new Date();
  var dom = new Date(hoje); dom.setDate(hoje.getDate()-hoje.getDay()); dom.setHours(0,0,0,0);
  var sab = new Date(dom); sab.setDate(dom.getDate()+6); sab.setHours(23,59,59,999);

  var data = SpreadsheetApp.openById(ID).getSheetByName('Decisões').getDataRange().getValues();
  var res = [];
  // Colunas: A=ID B=CarimboData C=MatCapelao D=NomeCapelao E=Equipe F=DataVisita
  // G=TipoAssistido H=NomeAssistido I=Sexo J=Tel K=Integrar L=MotivoNao M=Obs N=Semana
  for(var i=1;i<data.length;i++){
    var r = data[i];
    // Usar coluna B (carimbo) para filtrar semana
    var dt = r[1];
    if(!dt) continue;
    var d;
    if(dt instanceof Date){ d=dt; }
    else {
      var p=dt.toString().split('/');
      if(p.length<3) continue;
      d=new Date(p[2],p[1]-1,p[0]);
    }
    if(d<dom||d>sab) continue;
    res.push({
      id:(r[0]||'').toString(), data:(r[1]||'').toString(), capelao:(r[3]||'').toString(),
      equipe:(r[4]||'').toString(), dataVisita:(r[5]||'').toString(),
      assistido:(r[6]||'').toString(), nome:(r[7]||'').toString(),
      sexo:(r[8]||'').toString(), tel:(r[9]||'').toString(),
      integ:(r[10]||'').toString(), motivo:(r[11]||'').toString(), obs:(r[12]||'').toString()
    });
  }
  return {values:res};
}

function uploadFoto_(nome, tipo, dadosBase64, pastaId) {
  try {
    var bytes   = Utilities.base64Decode(dadosBase64);
    var blob    = Utilities.newBlob(bytes, tipo, nome);
    var pasta   = DriveApp.getFolderById(pastaId);
    // Remover arquivo anterior com mesmo nome se existir
    var existentes = pasta.getFilesByName(nome);
    while(existentes.hasNext()) existentes.next().setTrashed(true);
    var arquivo = pasta.createFile(blob);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId  = arquivo.getId();
    var url     = 'https://lh3.googleusercontent.com/d/' + fileId;
    return {url: url, id: fileId};
  } catch(err) {
    return {erro: err.toString()};
  }
}

function lerIntegracao_() {
  // Aba Integração — colunas:
  // A=ID B=Data C=Hospital D=Capelão E=Assistido F=Nome G=Fone H=Sexo I=OBS J=Integrador K=DecisaoID
  // Status de integração vem da fórmula PROCX que busca em Resultado_Integracao
  var ss = SpreadsheetApp.openById(ID);
  var sheet = ss.getSheetByName('Integração');
  if(!sheet) return {erro: 'Aba Integração não encontrada'};
  var data = sheet.getDataRange().getValues();

  // Buscar status de cada decisão na aba Resultado_Integracao
  var resSheet = ss.getSheetByName('Resultado_Integracao');
  var statusMap = {};
  if(resSheet){
    var resData = resSheet.getDataRange().getValues();
    // Colunas Resultado_Integracao: A=ID B=ID_Decisao C=Capelao D=Data E=Status
    for(var j=1; j<resData.length; j++){
      var rr = resData[j];
      var idDec = (rr[1]||'').toString().trim();
      var status = (rr[4]||'').toString().trim();
      if(idDec) statusMap[idDec] = status;
    }
  }

  var res = [];
  // Colunas: A=ID B=Data C=Hospital D=StatusIntegracao E=Capelão F=Assistido
  //           G=Nome H=Fone I=Sexo J=OBS K=Integrador L=DecisaoID
  for(var i=1; i<data.length; i++){
    var r = data[i];
    var id   = (r[0]||'').toString().trim();
    var nome = (r[6]||'').toString().trim();
    if(!id && !nome) continue;
    var dataVal = r[1];
    var dataStr = dataVal instanceof Date ? formatDate_(dataVal) : (dataVal||'').toString().trim();
    var idDecisao = (r[11]||id).toString().trim();
    // Status vem direto da coluna D (PROCX já calcula)
    var integrado = (r[3]||'Não').toString().trim();
    res.push({
      linha:     i+1,
      id:        id,
      data:      dataStr,
      hospital:  (r[2]||'').toString().trim(),
      integrado: integrado,
      capelao:   (r[4]||'').toString().trim(),   // col E — capelão original
      assistido: (r[5]||'').toString().trim(),
      nome:      nome,
      tel:       (r[7]||'').toString().trim(),
      sexo:      (r[8]||'').toString().trim(),
      obs:       (r[9]||'').toString().trim(),
      integrador:(r[10]||'').toString().trim(),  // col K — quem vai integrar
      idDecisao: idDecisao,
      equipe:    (r[2]||'').toString().trim()
    });
  }
  Logger.log('lerIntegracao: ' + res.length + ' registros, status map: ' + Object.keys(statusMap).length);
  return {values: res};
}

function getSemanaNum_(d) {
  // Igual ao NÚMSEMANA(data;2) do Sheets — semana começa na segunda-feira
  var anoIni = new Date(d.getFullYear(), 0, 1);
  var diaSemAnoIni = anoIni.getDay() || 7; // 1=seg...7=dom
  var diasPassados = Math.floor((d - anoIni) / 86400000);
  return Math.ceil((diasPassados + diaSemAnoIni) / 7);
}

function formatDate_(d) {
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
}

function garantirFormulas_(ss) {
  try {
    var sh = ss.getSheetByName('Decisões');
    if(!sh) return;
    // Col O linha 2 — ArrayFormula status integração
    var colO = sh.getRange('O2');
    if(!colO.getFormula()) {
      colO.setFormula('=ARRAYFORMULA(SE(A2:A<>"";PROCX(A2:A;Resultado_Integracao!B:B;Resultado_Integracao!E:E;"Não");""))');
    }
    // Col P linha 2 — ArrayFormula nome da equipe
    var colP = sh.getRange('P2');
    if(!colP.getFormula()) {
      colP.setFormula('=ARRAYFORMULA(SE(E2:E<>"";PROCX(E2:E;Equipes!B:B;Equipes!C:C;"");""))');
    }
  } catch(e) {
    Logger.log('garantirFormulas erro: ' + e.toString());
  }
}

// ═══════════════════════════════════════
// SNAPSHOT SEMANAL — roda todo domingo 23:59
// Fonte da verdade: Resultado_Integracao
// ═══════════════════════════════════════
var SEMANA_CORTE = 20; // Ignora decisões anteriores a esta semana

function snapshotSemanal() {
  try {
    var ss = SpreadsheetApp.openById(ID);
    var agora = new Date();
    Logger.log('=== SNAPSHOT SEMANAL INICIADO: ' + agora + ' ===');

    // 1. Buscar IDs já integrados em Resultado_Integracao (col B = ID_Decisao)
    var resSheet = ss.getSheetByName('Resultado_Integracao');
    var integradosSet = {};
    if(resSheet) {
      var resData = resSheet.getDataRange().getValues();
      for(var r=1; r<resData.length; r++){
        var idDec = (resData[r][1]||'').toString().trim();
        if(idDec) integradosSet[idDec] = true;
      }
    }
    Logger.log('Já integrados: ' + Object.keys(integradosSet).length);

    // 2. Buscar membros ativos com FAZ_INTEGRACAO='S'
    // Cadastro: G(6)=Sexo, T(19)=FazInteg, U(20)=Sit, E(4)=NomeSoc, D(3)=NomeComp
    var cadSheet = ss.getSheetByName('Cadastro');
    var cadData  = cadSheet.getDataRange().getValues();
    var integMasc = [], integFem = [];
    for(var i=1; i<cadData.length; i++){
      var rc = cadData[i];
      var sit  = (rc[20]||'').toString().trim().toLowerCase();
      var fazI = (rc[19]||'').toString().trim().toUpperCase();
      var sexo = (rc[6] ||'').toString().trim().toUpperCase();
      var nome = (rc[4] ||rc[3]||'').toString().trim();
      if(sit !== 'ativo' || fazI !== 'S' || !nome) continue;
      if(sexo === 'F' || sexo === 'FEMININO') integFem.push(nome);
      else integMasc.push(nome);
    }
    Logger.log('Integradores M: ' + integMasc.length + ' F: ' + integFem.length);
    if(!integMasc.length && !integFem.length){
      Logger.log('Nenhum integrador ativo. Abortando.');
      return;
    }

    // 3. Buscar TODAS as decisões com K='S' a partir da semana de corte
    //    que ainda NÃO foram integradas (não estão em Resultado_Integracao)
    // Decisões: A(0)=ID B(1)=Data C(2)=MatCap D(3)=NomeCap E(4)=Equipe
    // F(5)=DataVisita G(6)=Assistido H(7)=Nome I(8)=Sexo J(9)=Tel
    // K(10)=Integrar L(11)=MotivoNao M(12)=Obs N(13)=Semana
    var decSheet = ss.getSheetByName('Decisões');
    var decData  = decSheet.getDataRange().getValues();
    // Domingo = último dia da semana de visitas
    // Pega decisões da semana ATUAL (que acabou hoje domingo) e anteriores pendentes
    var semVisitas = getSemanaNum_(agora); // semana que acabou hoje
    var pendentes = [];

    for(var d=1; d<decData.length; d++){
      var rd  = decData[d];
      var idD = (rd[0]||'').toString().trim();
      if(!idD) continue;
      var kVal = (rd[10]||'').toString().trim().toUpperCase();
      if(kVal !== 'S') continue;
      var sem = parseInt(rd[13]||0);
      // A partir do corte e até a semana atual (inclusive — pois domingo encerra a semana)
      if(sem < SEMANA_CORTE || sem > semVisitas) continue;
      // Telefone obrigatório — sem telefone válido não entra na integração
      var tel = (rd[9]||'').toString().trim().replace(/\D/g,'');
      if(tel.length < 10) continue; // mínimo 10 dígitos (sem 55)
      if(tel === '92' || tel === '55' || tel.length < 10) continue;
      // Já foi integrado? Pula
      if(integradosSet[idD]) continue;

      pendentes.push({
        id:        idD,
        data:      rd[1],
        hospital:  (rd[4]||'').toString().trim(), // equipe
        capelao:   (rd[3]||'').toString().trim(),
        assistido: (rd[6]||'').toString().trim(),
        nome:      (rd[7]||'').toString().trim(),
        fone:      (rd[9]||'').toString().trim(),
        sexo:      (rd[8]||'').toString().trim().toUpperCase(),
        obs:       (rd[12]||'').toString().trim(),
        semana:    sem
      });
    }
    Logger.log('Pendentes para redistribuir: ' + pendentes.length);

    if(!pendentes.length){
      Logger.log('Nenhum pendente. Limpando aba Integração.');
      var integSheet2 = ss.getSheetByName('Integração');
      var hdr2 = integSheet2.getRange(1,1,1,integSheet2.getLastColumn()).getValues()[0];
      integSheet2.clearContents();
      integSheet2.getRange(1,1,1,hdr2.length).setValues([hdr2]);
      return;
    }

    // 4. Distribuir round-robin por sexo
    var idxM = 0, idxF = 0;
    pendentes.forEach(function(p) {
      var sexoP = (p.sexo === 'F' || p.sexo === 'FEMININO') ? 'F' : 'M';
      var integrador = '';
      if(sexoP === 'F' && integFem.length > 0){
        integrador = integFem[idxF % integFem.length]; idxF++;
      } else if(sexoP === 'M' && integMasc.length > 0){
        integrador = integMasc[idxM % integMasc.length]; idxM++;
      } else if(integFem.length > 0){
        integrador = integFem[idxF % integFem.length]; idxF++;
      } else {
        integrador = integMasc[idxM % integMasc.length]; idxM++;
      }
      p.integrador = integrador;
    });

    // 5. Apagar aba Integração e regravar com valores fixos
    var integSheet = ss.getSheetByName('Integração');
    var hdr = integSheet.getRange(1,1,1,integSheet.getLastColumn()).getValues()[0];
    integSheet.clearContents();
    integSheet.getRange(1,1,1,hdr.length).setValues([hdr]);

    var linhas = pendentes.map(function(p) {
      var dataStr = p.data instanceof Date ? formatDate_(p.data) : (p.data||'').toString();
      return [p.id, dataStr, p.hospital, 'Não', p.capelao,
              p.assistido, p.nome, p.fone, p.sexo, p.obs,
              p.integrador, p.id];
    });
    integSheet.getRange(2,1,linhas.length,linhas[0].length).setValues(linhas);

    // 6. Log
    var logSheet = ss.getSheetByName('Log');
    if(logSheet){
      logSheet.appendRow([formatDate_(agora),'SISTEMA','Snapshot Semanal',
        'Semana visitas: '+semVisitas+' | Redistribuídos: '+pendentes.length,
        '','']);
    }
    Logger.log('=== SNAPSHOT CONCLUÍDO: ' + pendentes.length + ' registros ===');
  } catch(e) {
    Logger.log('ERRO snapshot: ' + e.toString());
    throw e;
  }
}

// Executar UMA VEZ para agendar o trigger automático
function configurarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'snapshotSemanal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('snapshotSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(23)
    .create();
  Logger.log('Trigger configurado: todo domingo às 23h');
}

// ═══════════════════════════════════════
// MÓDULO RESUMO
// ═══════════════════════════════════════
var PASTA_VISITAS = '19_Nu8LSWQcuPDlHH9sQbjy3vwuyCYbW_';

function lerResumos_() {
  try {
    var ss    = SpreadsheetApp.openById(ID);
    var sh    = ss.getSheetByName('Resumo');
    if(!sh) return {erro: 'Aba Resumo não encontrada'};
    var data  = sh.getDataRange().getValues();
    // Colunas Resumo: A=ID B=Data C=Equipe D=Lider E=TotalDecisoes F=Foto G=Lançadas H=Saldo
    var res = [];
    for(var i=1; i<data.length; i++){
      var r = data[i];
      var id = (r[0]||'').toString().trim();
      if(!id) continue;
      var dataVal = r[1];
      var dataStr = dataVal instanceof Date ? formatDate_(dataVal) : (dataVal||'').toString().trim();
      res.push({
        linha:    i+1,
        id:       id,
        data:     dataStr,
        equipe:   (r[2]||'').toString().trim(),
        lider:    (r[3]||'').toString().trim(),
        total:    parseInt(r[4]||0),
        foto:     (r[5]||'').toString().trim(),
        lancadas: parseInt(r[6]||0),
        saldo:    parseInt(r[7]||0)
      });
    }
    // Ordenar por data mais recente
    res.sort(function(a,b){ return b.data.localeCompare(a.data); });
    return {values: res};
  } catch(e) { return {erro: e.toString()}; }
}

function gravarResumo_(p) {
  try {
    var ss  = SpreadsheetApp.openById(ID);
    var sh  = ss.getSheetByName('Resumo');
    if(!sh) return {erro: 'Aba Resumo não encontrada'};

    // Contar decisões lançadas no app para esta equipe nesta data
    var decSh   = ss.getSheetByName('Decisões');
    var decData = decSh.getDataRange().getValues();
    var lancadas = 0;
    for(var i=1; i<decData.length; i++){
      var rd = decData[i];
      var dvLinha = rd[5] instanceof Date ? formatDate_(rd[5]) : (rd[5]||'').toString().trim();
      var eqLinha = (rd[4]||'').toString().trim();
      if(dvLinha === p.dataVisita && eqLinha === p.equipe) lancadas++;
    }
    var saldo = parseInt(p.total||0) - lancadas;

    // Verificar se já existe resumo desta equipe + data (substituir)
    var shData  = sh.getDataRange().getValues();
    var linhaEx = -1;
    for(var j=1; j<shData.length; j++){
      var dataLinha = shData[j][1] instanceof Date ? formatDate_(shData[j][1]) : (shData[j][1]||'').toString().trim();
      var eqLinha2  = (shData[j][2]||'').toString().trim();
      if(dataLinha === p.dataVisita && eqLinha2 === p.equipe){ linhaEx = j+1; break; }
    }

    var id   = 'RES' + Date.now().toString(36).toUpperCase();
    var vals = [id, p.dataVisita, p.equipe, p.lider, parseInt(p.total||0),
                p.foto||'', lancadas, saldo];

    if(linhaEx > 0){
      // Substituir linha existente
      vals[0] = shData[linhaEx-1][0] || id; // manter ID original
      sh.getRange(linhaEx, 1, 1, vals.length).setValues([vals]);
    } else {
      sh.appendRow(vals);
    }

    return {status:'ok', lancadas:lancadas, saldo:saldo};
  } catch(e) { return {erro: e.toString()}; }
}

function uploadFotoVisita_(nome, tipo, dadosBase64) {
  try {
    var bytes   = Utilities.base64Decode(dadosBase64);
    var blob    = Utilities.newBlob(bytes, tipo, nome);
    var pasta   = DriveApp.getFolderById(PASTA_VISITAS);
    // Remover arquivo anterior com mesmo nome
    var existentes = pasta.getFilesByName(nome);
    while(existentes.hasNext()) existentes.next().setTrashed(true);
    var arquivo = pasta.createFile(blob);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = 'https://lh3.googleusercontent.com/d/' + arquivo.getId();
    return {url: url, id: arquivo.getId()};
  } catch(e) { return {erro: e.toString()}; }
}

function lerAniv_() {
  try {
    var sh = SpreadsheetApp.openById(ID).getSheetByName('Aniv');
    if(!sh) return {erro: 'Aba Aniv não encontrada'};
    var data = sh.getDataRange().getValues();
    // Colunas: A=Foto B=NomeSocial C=DataAniversario D=Telefone E=Niver F=Mes
    var res = [];
    for(var i=1; i<data.length; i++){
      var r = data[i];
      var nome = (r[1]||'').toString().trim();
      if(!nome) continue;
      var mes = parseInt(r[5]||0);
      if(!mes || mes < 1 || mes > 12) continue;
      // Extrair dia da data (col C)
      var dia = 0;
      var dataVal = r[2];
      if(dataVal instanceof Date){ dia = dataVal.getDate(); }
      else {
        var p = (dataVal||'').toString().split('/');
        if(p.length >= 1) dia = parseInt(p[0]||0);
      }
      res.push({
        foto:  (r[0]||'').toString().trim(),
        nome:  nome,
        tel:   (r[3]||'').toString().trim(),
        dia:   dia,
        mes:   mes,
        niver: (r[4]||'').toString().trim()
      });
    }
    return {values: res};
  } catch(e) { return {erro: e.toString()}; }
}
