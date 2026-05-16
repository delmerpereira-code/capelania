var ID = '17U6MBGBF63jxObmBzRprtIr3I3nlDsbZEMJWC-mr0lo';

function doGet(e) {
  var p  = e.parameter;
  var cb = p.callback || '';

  try {
    var result;
    var acao = p.acao || '';

    if(acao === 'lerUsuarios') result = lerUsuarios_();
    else if(acao === 'lerCadastro') result = lerCadastro_();
    else if(acao === 'lerEquipes')  result = lerEquipes_();
    else if(acao === 'gravar') {
      var aba  = p.aba;
      var vals = JSON.parse(decodeURIComponent(p.dados));
      SpreadsheetApp.openById(ID).getSheetByName(aba).appendRow(vals);
      result = {status:'ok'};
    }
    else result = {erro: 'Ação não reconhecida: ' + acao};

    return resp(cb, result);
  } catch(err) {
    return resp(cb, {erro: err.toString()});
  }
}

function resp(cb, obj) {
  var json = JSON.stringify(obj);
  var body = cb ? cb + '(' + json + ');' : json;
  var mime = cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mime);
}

function lerUsuarios_() {
  var sheet = SpreadsheetApp.openById(ID).getSheetByName('Cadastro');
  var data  = sheet.getDataRange().getValues();
  var res   = [];
  for(var i=1;i<data.length;i++){
    var r=data[i], colF=(r[5]||'').toString().trim();
    if(!colF) continue;
    res.push({
      id:      (r[0] ||'').toString().trim(),
      pin:     (r[2] ||'').toString().trim(),
      nomeSoc: (r[4] ||'').toString().trim(),
      usuario: colF,
      equipes: (r[18]||'').toString().trim(),
      perfil:  (r[22]||'').toString().trim()
    });
  }
  return {values: res};
}

function lerCadastro_() {
  var sheet = SpreadsheetApp.openById(ID).getSheetByName('Cadastro');
  var data  = sheet.getDataRange().getValues();
  var res   = [];
  for(var i=1;i<data.length;i++){
    var r=data[i];
    var nc=(r[3]||'').toString().trim(), ns=(r[4]||'').toString().trim();
    if(!nc&&!ns) continue;
    var aniv='';
    if(r[17]){
      if(r[17] instanceof Date){ var d=r[17]; aniv=('0'+(d.getMonth()+1)).slice(-2)+'/'+('0'+d.getDate()).slice(-2); }
      else aniv=r[17].toString().trim();
    }
    res.push({
      linha:i+1, id:(r[0]||'').toString().trim(), foto:(r[1]||'').toString().trim(),
      pin:(r[2]||'').toString().trim(), nomeComp:nc, nomeSoc:ns,
      usuario:(r[5]||'').toString().trim(), sexo:(r[6]||'').toString().trim(),
      tel:(r[7]||'').toString().trim(), rg:(r[8]||'').toString().trim(),
      email:(r[9]||'').toString().trim(), declaMinist:(r[10]||'').toString().trim(),
      liderGA:(r[11]||'').toString().trim(), umComDeus:(r[12]||'').toString().trim(),
      batizado:(r[13]||'').toString().trim(), grupo:(r[14]||'').toString().trim(),
      culto:(r[15]||'').toString().trim(), senib:(r[16]||'').toString().trim(),
      aniversario:aniv, equipes:(r[18]||'').toString().trim(),
      fazInteg:(r[19]||'').toString().trim(), sit:(r[20]||'Ativo').toString().trim(),
      obs:(r[21]||'').toString().trim(), perfil:(r[22]||'Membro').toString().trim()
    });
  }
  return {values: res};
}

function lerEquipes_() {
  var sheet = SpreadsheetApp.openById(ID).getSheetByName('Equipes');
  var data  = sheet.getDataRange().getValues();
  var res   = [];
  for(var i=1;i<data.length;i++){
    var eq=(data[i][1]||'').toString().trim(); // Coluna B
    if(eq) res.push(eq);
  }
  return {values: res};
}
