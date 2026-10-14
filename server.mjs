import http from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {safeNoteName,inside,promptFor} from './core.mjs';
import {infer,plannerPrompt} from './codex.mjs';
import {mailStatus,connectMail,disconnectMail,deliverEmail,emailAddress} from './mail.mjs';
import {BackgroundVoice} from './background-voice.mjs';
import {UpdateChecker} from './updates.mjs';
import {MobileBridge} from './mobile.mjs';
import {PersonalMemory,personalStatement} from './personal-memory.mjs';
const exec=promisify(execFile), root=path.dirname(fileURLToPath(import.meta.url));
const data=path.join(root,'data'), vault=path.join(root,'memory'), workspace=path.join(root,'workspace');
await Promise.all([data,vault,workspace].map(p=>fs.mkdir(p,{recursive:true})));
const stateFile=path.join(data,'state.json');
const personal=await new PersonalMemory(data).init();
const appVersion=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const updates=await new UpdateChecker({data,version:appVersion}).init();
void updates.check();
const updateTimer=setInterval(()=>void updates.check(),6*60*60*1000);updateTimer.unref();
let state; try {state=JSON.parse(await fs.readFile(stateFile,'utf8'));} catch {state={messages:[],jobs:[],settings:{engine:'codex',model:'',speak:true}};}
state.drafts ||= [];
state.settings={voiceAutoSend:true,alwaysListen:true,contacts:[],...state.settings};
let mailbox=await mailStatus();
const pythonPath=process.env.JARVIS_PYTHON_PATH||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
for(const job of state.jobs){if(job.status==='running'){job.status='cancelled';job.error='Servidor reiniciado durante la tarea.';}}
// Do not inherit the desktop host's per-turn permission profile or IPC identity.
const childEnv={...process.env};
for(const name of Object.keys(childEnv)){if(name.startsWith('CODEX_')&&!['CODEX_HOME','CODEX_ACCESS_TOKEN'].includes(name))delete childEnv[name];}
let saveQueue=Promise.resolve();
function save(){const snapshot=JSON.stringify(state,null,2);saveQueue=saveQueue.then(async()=>{await fs.writeFile(stateFile+'.tmp',snapshot);await fs.rename(stateFile+'.tmp',stateFile);});return saveQueue;}
const codexCandidates=[process.env.JARVIS_CODEX_PATH,path.join(process.env.APPDATA||'','npm/node_modules/@openai/codex/bin/codex.js')].filter(Boolean);
let codexPath; for(const p of codexCandidates){try{await fs.access(p);codexPath=p;break;}catch{}}
async function runCodex(args,options={}){if(!codexPath)throw new Error('Codex CLI no encontrado. Instala @openai/codex y ejecuta codex login.');return exec(process.execPath,[codexPath,...args],{timeout:20000,maxBuffer:2e6,env:childEnv,...options});}
async function voice(action,args=[]){return exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'voice.ps1'),'-Action',action,...args],{timeout:45000,maxBuffer:2e6,windowsHide:true});}
let voiceInfo={voices:[],recognizers:[],error:null}; try{voiceInfo=JSON.parse((await voice('status')).stdout.replace(/^\uFEFF/,''));}catch(e){voiceInfo.error='La voz local de Windows no está disponible.';}
async function notes(){const names=(await fs.readdir(vault)).filter(x=>x.endsWith('.md'));return Promise.all(names.map(async name=>({name,text:(await fs.readFile(path.join(vault,name),'utf8')).slice(0,20000)})));}
async function ollamaModels(){try{const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(2000)});if(!r.ok)throw 0;return (await r.json()).models.map(x=>x.name);}catch{return [];}}
const streams=new Set(); let active=null;
let listenerReview=null;
const voiceQueue=[];
const backgroundVoice=new BackgroundVoice({root,data,isBusy:()=>!!active,onChange:status=>emit('background_voice',{status}),onCommand:command=>{
  if(command.review){listenerReview=command.text;emit('voice_review',{text:command.text});backgroundVoice.say('No entendí la petición con suficiente claridad. Vuelve a llamarme Jarvis y repítela, o revisa el texto en la aplicación.').catch(()=>{});return;}
  listenerReview=null;
  if(updates.status.installing){backgroundVoice.say('JARVIS se está actualizando. Espera a que termine.').catch(()=>{});return;}
  if(/^(?:detente|para|cancela(?: la tarea| todo)?|det[eé]n(?: la tarea)?)[.!]?$/i.test(command.text)){
    voiceQueue.length=0;if(active){active.job.status='cancelled';stopChild(active);emit('job',{job:active.job});backgroundVoice.say('Deteniendo la tarea.').catch(()=>{});}else backgroundVoice.say('No hay ninguna tarea en curso.').catch(()=>{});return;
  }
  if(/^(?:pausa(?:r)?(?: la)? escucha|deja de escuchar|silencia(?:te)?|desactiva(?:r)?(?: el)? micr[oó]fono)[.!]?$/i.test(command.text)){
    backgroundVoice.stop();state.settings.alwaysListen=false;save().catch(()=>{});backgroundVoice.say('Escucha pausada. Puedes activarla de nuevo desde la aplicación.').catch(()=>{});return;
  }
  if(!active)void startJob(command.text,'auto');
  else if(voiceQueue.length<5){voiceQueue.push(command.text);emit('voice_notice',{text:'Petición añadida a la cola de tareas.'});backgroundVoice.say('He anotado tu petición. La atenderé al terminar la tarea actual.').catch(()=>{});}
  else backgroundVoice.say('Hay cinco peticiones pendientes. Espera a que termine alguna.').catch(()=>{});
}});
const localActions={calculator:{command:'calc.exe',args:[],label:'Calculadora'},notepad:{command:'notepad.exe',args:[],label:'Bloc de notas'},memory:{command:'explorer.exe',args:[vault],label:'la carpeta de memoria'}};
async function localAction(id){const action=localActions[id];if(!action)throw new Error('Acción local desconocida');await new Promise((resolve,reject)=>{const child=spawn(action.command,action.args,{detached:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});return {text:`Abrí ${action.label}.`};}
async function autoRequest({text,history,memory,current}){
  if(/^(s[ií][, ]+)?(env[ií]alo|env[ií]a el correo|enviar el correo|confirmo el env[ií]o)[.!]?$/i.test(text.trim())){
    const drafts=state.drafts.filter(d=>d.status==='draft');
    if(drafts.length!==1){current.job.status='blocked';message('assistant',drafts.length?'Hay varios correos preparados. Elige el que quieres enviar en su tarjeta.':'No hay ningún correo pendiente. Dime el destinatario y el mensaje.');return;}
    try{await sendDraft(drafts[0].id,drafts[0]);current.job.status='completed';}catch(e){current.job.status='blocked';message('assistant',e.message);}return;
  }
  const event=item=>{if(!['command_execution','file_change'].includes(item.item?.type))return;const source=item.item,detail={type:source.type,text:source.command||source.changes?.map(x=>x.path).join(', ')||'Archivo',status:source.status,output:(source.aggregated_output||'').slice(-2000)};current.job.events.push(detail);emit('activity',{jobId:current.job.id,event:detail});};
  const plan=await infer({codexPath,env:childEnv,cwd:workspace,prompt:plannerPrompt({text,history,notes:memory,profile:personal.context(),contacts:state.settings.contacts,mailConnected:mailbox.configured}),schema:path.join(root,'plan-schema.json'),current});
  if(!Array.isArray(plan.actions)||plan.actions.length>5)throw new Error('El plan de acciones no es válido.');
  let replies=[],pending=false;
  for(const action of plan.actions){
    if(current.abort.signal.aborted)return;
    if(action.type==='document'){
      if(!action.content?.trim())throw new Error('El documento no contiene texto.');
      const title=action.title||'Documento',filename=safeNoteName(title)+'-'+Date.now()+'.docx';
      const input=path.join(data,crypto.randomUUID()+'.json'),output=path.join(workspace,filename);
      try{await fs.writeFile(input,JSON.stringify({title,content:action.content}));await exec(pythonPath,[path.join(root,'document.py'),input,output],{timeout:30000,windowsHide:true});await fs.access(output);replies.push(`Documento creado: [${filename}](${output.replaceAll('\\','/')}).`);}finally{await fs.unlink(input).catch(()=>{});}
    }else if(action.type==='email'){
      if(!emailAddress(action.to)){replies.push('Necesito la dirección de correo del destinatario. Puedes guardarla en Contactos.');continue;}
      const draft={id:crypto.randomUUID(),to:action.to,subject:action.subject,body:action.content,status:'draft',jobId:current.job.id,time:new Date().toISOString()};state.drafts.unshift(draft);state.drafts=state.drafts.slice(0,60);pending=true;emit('draft',{draft});replies.push(`Correo redactado para ${draft.to}. Revisa el mensaje y di “envíalo” o pulsa Enviar${mailbox.configured?'.':'; primero conecta tu cuenta en Ajustes.'}`);
    }else if(action.type==='memory'){
      const name=safeNoteName(action.title||'Recuerdo')+'.md';await fs.writeFile(path.join(vault,name),action.content);emit('notes',{notes:await notes()});replies.push('Guardado en memoria: '+name+'.');
    }else if(action.type==='open')replies.push((await localAction(action.app)).text);
    else if(action.type==='answer')replies.push(action.content||plan.reply);
    else if(action.type==='general'){
      const result=await infer({codexPath,env:childEnv,cwd:workspace,prompt:promptFor({text:action.content||text,history,notes:memory,profile:personal.context(),mode:'task'}),schema:path.join(root,'task-schema.json'),sandbox:'workspace-write',current,onEvent:event});replies.push(result.reply);if(result.status==='blocked')current.job.status='blocked';
    }
    const progress={type:action.type,text:action.title||action.subject||action.type,status:'completed',output:''};current.job.events.push(progress);emit('activity',{jobId:current.job.id,event:progress});
  }
  if(current.abort.signal.aborted)return;
  current.job.status=pending?'awaiting_confirmation':current.job.status==='blocked'?'blocked':'completed';
  message('assistant',replies.join('\n\n')||plan.reply||'Necesito más detalles para completar la solicitud.');
}
function emit(type,payload){const msg=`data: ${JSON.stringify({type,...payload})}\n\n`;for(const s of streams)s.write(msg);}
function message(role,text){const spokenBySystem=(role==='assistant'||role==='error')&&state.settings.alwaysListen&&state.settings.speak;const m={id:crypto.randomUUID(),role,text,time:new Date().toISOString(),spokenBySystem,jobId:active?.job.id||null,personal:!!active?.job.personal};state.messages.push(m);if(state.messages.length>200)state.messages.shift();emit('message',{message:m});if(spokenBySystem)backgroundVoice.say(text).catch(()=>emit('voice_notice',{text:'No se pudo reproducir la respuesta en los altavoces de Windows.'}));return m;}
async function sendDraft(id,updates){
  const draft=state.drafts.find(d=>d.id===id);
  if(!draft||!['draft','failed'].includes(draft.status))throw Object.assign(new Error('Este correo ya fue enviado o está en proceso.'),{status:409});
  if(!mailbox.configured)throw Object.assign(new Error('Conecta tu Gmail en Ajustes antes de enviar.'),{status:400});
  if(!emailAddress(updates.to)||typeof updates.subject!=='string'||typeof updates.body!=='string')throw Object.assign(new Error('Correo inválido'),{status:400});
  Object.assign(draft,{to:updates.to,subject:updates.subject,body:updates.body,status:'sending'});await save();emit('draft',{draft});
  try{const result=await deliverEmail(draft);draft.status='sent';draft.messageId=result.messageId;const job=state.jobs.find(j=>j.id===draft.jobId);if(job&&state.drafts.filter(d=>d.jobId===job.id).every(d=>d.status==='sent')){job.status='completed';emit('job',{job});}message('assistant',`El servidor de correo aceptó el envío a ${draft.to}.`);await save();emit('draft',{draft});return {ok:true,messageId:result.messageId};}catch(e){draft.status='failed';await save();emit('draft',{draft});throw e;}
}
async function handlePersonal(text){
 const previous=state.messages.slice(0,-1).findLast(m=>m.role==='assistant');
 const action=personalStatement(text,{awaitingName:!personal.value.name&&previous?.text.endsWith('¿Cómo te llamas?')});
 if(!action)return false;
 active.job.personal=true;
 const priorJob=state.jobs.find(j=>j.id!==active.job.id&&!j.personal);
 if(action.type==='name'){await personal.setName(action.value);message('assistant',`Mucho gusto, ${personal.value.name}. Recordaré tu nombre. Puedes decirme «prefiero respuestas breves» y corregirme con «corrección: ...». ¿En qué te ayudo?`);}
 else if(action.type==='invalid-name')message('assistant','Dime solo tu nombre, por ejemplo: «Me llamo Luis». ¿Cómo te llamas?');
 else if(action.type==='preference'){
  const correction=/^(?:corrige|correcci[oó]n|no vuelvas)/i.test(action.value);
  const saved=await personal.remember({kind:correction?'correction':'preference',text:action.value,task:correction?priorJob?.text:'',jobId:correction?priorJob?.id:null});
  message('assistant',saved?'Lo he guardado. Lo tendré en cuenta en las próximas peticiones pertinentes. Puedes revisar o borrar este aprendizaje en Ajustes.':'El aprendizaje está pausado. No guardé esta indicación; puedes activarlo en Ajustes.');
 }else if(action.type==='negative')message('assistant','Dime qué hice mal y cómo debería hacerlo. Empieza con «corrección: ...» para que guarde la regla concreta y la aplique en tareas similares. No voy a adivinar la corrección.');
 else if(action.type==='positive'){
  if(!priorJob)message('assistant','Gracias. Cuando terminemos una tarea puedes decir «eso está bien» para guardar tu valoración.');
  else{const saved=await personal.remember({kind:'positive',text:'El usuario aprobó el resultado de esta tarea. Es una valoración de ese resultado, no una regla para todas las tareas.',task:priorJob.text,jobId:priorJob.id});message('assistant',saved?'Gracias. Guardé que este resultado te sirvió para esta tarea.':'Gracias. El aprendizaje está pausado; no guardé la valoración.');}
 }else if(action.type==='recall')message('assistant',personal.recall());
 else if(action.type==='reset'){await personal.reset();message('assistant','Borré tu perfil y los aprendizajes personales. Las notas Markdown y el historial de conversación se conservan. Si quieres, vuelve a presentarte. ¿Cómo te llamas?');}
 emit('personal',{profile:personal.snapshot()});return true;
}

async function startJob(text,mode){
  const history=state.messages.slice(-12).map(({role,text})=>({role,text}));
  message('user',text);
  const job={id:crypto.randomUUID(),text,mode,status:'running',started:new Date().toISOString(),events:[]};state.jobs.unshift(job);state.jobs=state.jobs.slice(0,40);active={job,child:null,abort:new AbortController()};emit('job',{job});await backgroundVoice.setBusy(true);await save();
  const current=active;
  try{
    if(await handlePersonal(text)){job.status='completed';return;}
    const memory=(await notes()).slice(0,20).map(n=>`${n.name}\n${n.text}`).join('\n').slice(0,30000);
    if(job.status==='cancelled')return;
    if(mode==='auto'&&state.settings.engine==='codex'){await autoRequest({text,history,memory,current});return;}
    const prompt=promptFor({text,history,notes:memory,profile:personal.context(),mode});let answer='';
    if(state.settings.engine==='ollama'){
      if(mode==='task')throw new Error('El motor local solo conversa en esta versión. Selecciona Codex para ejecutar tareas.');
      if(!state.settings.model)throw new Error('Selecciona un modelo local instalado.');
      const r=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:state.settings.model,stream:false,messages:[{role:'user',content:prompt}]}),signal:current.abort.signal});
      const body=await r.json();if(!r.ok||body.error)throw new Error(body.error||'Ollama no pudo responder.');answer=body.message.content;
    } else {
      if(!codexPath)throw new Error('Codex CLI no está instalado.');
      const args=[codexPath,'exec','--ignore-user-config','--skip-git-repo-check','--ephemeral','--json','--color','never','--sandbox',mode==='task'?'workspace-write':'read-only','-c','approval_policy="never"','-c','windows.sandbox="elevated"','-C',workspace];
      if(mode==='task')args.push('--output-schema',path.join(root,'task-schema.json'));
      args.push('-');
      const child=spawn(process.execPath,args,{windowsHide:true,env:childEnv,stdio:['pipe','pipe','pipe']});current.child=child;let buffer='',errors='';
      const timer=setTimeout(()=>{job.timedOut=true;stopChild(current);},600000);
      child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{const event=JSON.parse(line);const item=event.item;if(event.type==='item.completed'&&item?.type==='agent_message')answer=item.text;if(item?.type==='command_execution'||item?.type==='file_change'){const detail={type:item.type==='file_change'?'file':'command',text:item.command||item.changes?.map(x=>x.path).join(', ')||'Cambio de archivo',status:item.status,output:(item.aggregated_output||'').slice(-3000)};job.events.push(detail);job.events=job.events.slice(-30);emit('activity',{jobId:job.id,event:detail});}if(event.type==='error'||event.type==='turn.failed')errors+=(event.message||event.error?.message||'Codex falló')+'\n';}catch{}}});
      child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-6000);});child.stdin.end(prompt);
      try{const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});if(job.status==='cancelled')return;if(job.timedOut)throw new Error('La tarea excedió 10 minutos. Divide la solicitud en pasos más pequeños.');if(code!==0||!answer.trim())throw new Error(errors.trim()||`Codex terminó sin respuesta (código ${code}).`);}finally{clearTimeout(timer);}
    }
    if(job.status==='cancelled')return;
    if(mode==='task'&&state.settings.engine==='codex'){const result=JSON.parse(answer);answer=result.reply;job.status=result.status==='completed'?'completed':'blocked';}else job.status='completed';
    message('assistant',answer.trim());
  }catch(e){if(job.status!=='cancelled'){job.status='failed';job.error=e.message;message('error',e.message);}}
  finally{if(job.status==='failed'&&job.error){await personal.remember({kind:'failure',text:'Falló un intento: '+job.error.slice(0,500)+'. Revisar la causa antes de repetir el método.',task:job.text,jobId:job.id}).catch(()=>{});emit('personal',{profile:personal.snapshot()});}job.finished=new Date().toISOString();if(active===current)active=null;await backgroundVoice.setBusy(false);emit('job',{job});await save();if(!active&&voiceQueue.length){const next=voiceQueue.shift();void startJob(next,'auto');}}
}
function stopChild(current){current.abort.abort();if(current.child){if(process.platform==='win32')execFile('taskkill.exe',['/PID',String(current.child.pid),'/T','/F'],{windowsHide:true},()=>{});else current.child.kill('SIGTERM');}}
function json(res,obj,code=200){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
async function body(req,max=100000){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Object.assign(new Error('Solicitud demasiado grande'),{status:413});parts.push(chunk);}return Buffer.concat(parts);}
async function parsed(req){return JSON.parse((await body(req)).toString());}
const port=Number(process.env.JARVIS_PORT||4317);
const mobile=await new MobileBridge({root,data,python:pythonPath,localPort:port}).init();
const server=http.createServer(async(req,res)=>{
  try{
    const base=`http://127.0.0.1:${port}`,url=new URL(req.url,base);
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){return json(res,{error:'Host rechazado'},403);}
    if(req.headers.origin&&!([base,`http://localhost:${port}`].includes(req.headers.origin)))return json(res,{error:'Origen rechazado'},403);
    if(req.method==='POST'&&url.pathname!=='/api/listen'&&!(req.headers['content-type']||'').startsWith('application/json'))return json(res,{error:'Content-Type inválido'},415);
    if(req.method==='GET'&&url.pathname==='/api/updates')return json(res,updates.status);
    if(req.method==='GET'&&url.pathname==='/api/personal')return json(res,personal.snapshot());
    if(req.method==='POST'&&url.pathname==='/api/personal'){
      const b=await parsed(req);try{
        if(b.action==='name')await personal.setName(b.name);
        else if(b.action==='enabled')await personal.enabled(b.enabled);
        else if(b.action==='remove')await personal.remove(b.id);
        else if(b.action==='reset')await personal.reset();
        else return json(res,{error:'Acción de perfil inválida.'},400);
        emit('personal',{profile:personal.snapshot()});return json(res,personal.snapshot());
      }catch(e){return json(res,{error:e.message},400);}
    }
    if(req.method==='POST'&&url.pathname==='/api/feedback'){
      if(active)return json(res,{error:'Espera a que termine la tarea para valorar el resultado.'},409);
      const b=await parsed(req),index=state.messages.findIndex(m=>m.id===b.messageId),target=state.messages[index];
      if(!target||target.role!=='assistant'||target.personal||!['positive','correction'].includes(b.kind))return json(res,{error:'Resultado o valoración inválida.'},400);
      const job=state.jobs.find(j=>j.id===target.jobId),task=job?.text||state.messages.slice(0,index).findLast(m=>m.role==='user')?.text||'';
      try{
        const lesson=await personal.remember({kind:b.kind,text:b.kind==='positive'?'Resultado aprobado por el usuario para esta tarea: '+target.text.slice(0,900):b.text,task,jobId:target.jobId,messageId:target.id});
        emit('personal',{profile:personal.snapshot()});return json(res,{saved:!!lesson,profile:personal.snapshot()});
      }catch(e){return json(res,{error:e.message},400);}
    }
    if(req.method==='POST'&&url.pathname==='/api/updates/install'){
      if(active||updates.status.installing)return json(res,{error:'Espera a que termine la tarea o actualización activa.'},409);
      await updates.check();
      if(!updates.status.available||updates.status.repository!=='floresroldanluis/Jarvis')return json(res,{error:'No hay una actualización oficial disponible.'},400);
      const log=await fs.open(path.join(data,'update.log'),'a');
      try{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'Update-Windows.ps1')],{detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});updates.status.installing=true;child.once('exit',()=>{updates.status.installing=false;});child.unref();}finally{await log.close();}
      return json(res,{ok:true,message:'Descargando y verificando. JARVIS se reiniciará; vuelve a abrir la aplicación. Si falla antes del reinicio, consulta data/update.log.'},202);
    }
    if(req.method==='GET'&&url.pathname==='/api/mobile')return json(res,{...mobile.status(),pairing:mobile.pairing()});
    if(req.method==='POST'&&url.pathname==='/api/mobile'){const b=await parsed(req);if(typeof b.enabled!=='boolean')return json(res,{error:'Estado inválido'},400);await(b.enabled?mobile.start():mobile.stop());return json(res,{...mobile.status(),pairing:mobile.pairing()});}
    if(req.method==='POST'&&url.pathname==='/api/updates'){const b=await parsed(req);try{return json(res,b.check===true?await updates.check():await updates.configure(b.repository));}catch(e){return json(res,{error:e.message},400);}}
    if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');streams.add(res);const pulse=setInterval(()=>res.write(': ping\n\n'),20000);req.on('close',()=>{streams.delete(res);clearInterval(pulse);});return;}
    if(req.method==='GET'&&url.pathname==='/api/state')return json(res,{...state,notes:await notes(),profile:personal.snapshot(),busy:!!active,voice:voiceInfo,workspace,vault,mailbox,backgroundVoice:backgroundVoice.status,listenerReview});
    if(req.method==='POST'&&url.pathname==='/api/background-voice'){const b=await parsed(req);if(typeof b.enabled!=='boolean')return json(res,{error:'Estado de escucha inválido'},400);state.settings.alwaysListen=b.enabled;await save();if(b.enabled){await backgroundVoice.start();return json(res,backgroundVoice.status);}return json(res,backgroundVoice.stop());}
    if(req.method==='POST'&&url.pathname==='/api/background-voice/say'){const b=await parsed(req);if(typeof b.text!=='string'||b.text.length>6000)return json(res,{error:'Texto inválido'},400);void backgroundVoice.say(b.text).catch(()=>emit('voice_notice',{text:'No se pudo reproducir el audio.'}));return json(res,{ok:true});}
    if(req.method==='GET'&&url.pathname==='/api/status'){let login='No disponible';try{const r=await runCodex(['login','status']);login=(r.stdout+r.stderr).trim();}catch{}return json(res,{codex:!!codexPath,login,ollama:await ollamaModels(),voice:voiceInfo,ramGB:Math.round(os.totalmem()/1073741824)});}
    if(req.method==='POST'&&url.pathname==='/api/chat'){if(updates.status.installing)return json(res,{error:'JARVIS se está actualizando. Espera a que termine.'},409);if(active)return json(res,{error:'Hay una tarea en marcha. Deténla o espera.'},409);const b=await parsed(req);if(typeof b.text!=='string'||!b.text.trim()||b.text.length>16000)return json(res,{error:'Escribe una solicitud de hasta 16 000 caracteres.'},400);if(!['auto','chat','task'].includes(b.mode))return json(res,{error:'Modo inválido'},400);void startJob(b.text.trim(),b.mode);return json(res,{ok:true},202);}
    if(req.method==='POST'&&url.pathname==='/api/stop'){voiceQueue.length=0;if(active){active.job.status='cancelled';stopChild(active);emit('job',{job:active.job});}return json(res,{ok:true});}
    if(req.method==='POST'&&url.pathname==='/api/action'){const b=await parsed(req);if(typeof b.action!=='string'||!Object.hasOwn(localActions,b.action))return json(res,{error:'Acción no disponible'},400);return json(res,await localAction(b.action));}
    if(req.method==='POST'&&url.pathname==='/api/settings'){if(active)return json(res,{error:'Espera a que termine la tarea.'},409);const b=await parsed(req);if(!['codex','ollama'].includes(b.engine)||typeof b.model!=='string'||b.model.length>150)return json(res,{error:'Ajustes inválidos'},400);state.settings={...state.settings,engine:b.engine,model:b.model,speak:!!b.speak,voiceAutoSend:b.voiceAutoSend!==false};await save();return json(res,{ok:true});}
    if(req.method==='POST'&&url.pathname==='/api/contacts'){const b=await parsed(req);if(!Array.isArray(b.contacts)||b.contacts.length>100||b.contacts.some(c=>typeof c.name!=='string'||c.name.length>100||!emailAddress(c.email)))return json(res,{error:'Contactos inválidos'},400);state.settings.contacts=b.contacts;await save();return json(res,{ok:true});}
    if(req.method==='POST'&&url.pathname==='/api/mail/connect'){const b=await parsed(req);mailbox=await connectMail(b);emit('mailbox',{mailbox});return json(res,mailbox);}
    if(req.method==='POST'&&url.pathname==='/api/mail/disconnect'){mailbox=await disconnectMail();emit('mailbox',{mailbox});return json(res,mailbox);}
    if(req.method==='POST'&&url.pathname==='/api/mail/send'){const b=await parsed(req);return json(res,await sendDraft(b.id,b));}
    if(req.method==='POST'&&url.pathname==='/api/mail/cancel'){const b=await parsed(req),draft=state.drafts.find(d=>d.id===b.id);if(!draft||draft.status==='sending'||draft.status==='sent')return json(res,{error:'No se puede cancelar este correo.'},409);draft.status='cancelled';await save();emit('draft',{draft});return json(res,{ok:true});}
    if(req.method==='POST'&&url.pathname==='/api/notes'){const b=await parsed(req);if(typeof b.title!=='string'||typeof b.text!=='string'||b.text.length>20000)return json(res,{error:'Nota inválida'},400);const name=safeNoteName(b.title)+'.md';await fs.writeFile(path.join(vault,name),b.text,'utf8');return json(res,{name,notes:await notes()});}
    if(req.method==='POST'&&url.pathname==='/api/speak'){const b=await parsed(req);if(typeof b.text!=='string'||b.text.length>6000)return json(res,{error:'Texto inválido'},400);const id=crypto.randomUUID(),input=path.join(data,id+'.txt'),output=path.join(data,id+'.wav');try{await fs.writeFile(input,b.text);await voice('speak',['-InputPath',input,'-OutputPath',output]);res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store'});res.end(await fs.readFile(output));}finally{await Promise.all([input,output].map(p=>fs.unlink(p).catch(()=>{})));}return;}
    if(req.method==='POST'&&url.pathname==='/api/listen'){if(!(req.headers['content-type']||'').startsWith('audio/wav'))return json(res,{error:'Se requiere WAV'},415);const input=path.join(data,crypto.randomUUID()+'.wav');try{const audio=await body(req,5e6);if(audio.toString('ascii',0,4)!=='RIFF')throw new Error('Audio WAV inválido');await fs.writeFile(input,audio);const r=await voice('listen',['-InputPath',input]);return json(res,JSON.parse(r.stdout.replace(/^\uFEFF/,'')));}finally{await fs.unlink(input).catch(()=>{});}}
    if(req.method==='GET'&&url.pathname==='/api/files'){const list=await fs.readdir(workspace,{withFileTypes:true});return json(res,list.map(x=>({name:x.name,directory:x.isDirectory()})));}
    if(req.method==='GET'&&url.pathname.startsWith('/files/')){const file=path.resolve(workspace,decodeURIComponent(url.pathname.slice(7)));if(!inside(workspace,file)||!inside(workspace,await fs.realpath(file)))return json(res,{error:'Ruta inválida'},403);const stat=await fs.stat(file);if(!stat.isFile()||stat.size>25e6)return json(res,{error:'Archivo no disponible'},400);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`});return res.end(await fs.readFile(file));}
    if(req.method==='GET'){const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const file=path.resolve(root,'public',relative);if(!inside(path.join(root,'public'),file))return json(res,{error:'Ruta inválida'},403);const content=await fs.readFile(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});return res.end(content);}
    json(res,{error:'No encontrado'},404);
  }catch(e){json(res,{error:e.code==='ENOENT'?'No encontrado':e.message},e.status|| (e.code==='ENOENT'?404:500));}
});
server.listen(port,'127.0.0.1',async()=>{console.log(`JARVIS OS · http://127.0.0.1:${port}`);if(state.settings.alwaysListen)await backgroundVoice.start().catch(()=>{});if(await personal.introduce()){message('assistant','Hola, soy JARVIS. Quiero conocerte para ayudarte a tu manera. ¿Cómo te llamas?');await save();}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{backgroundVoice.stop();if(active)stopChild(active);server.close();process.exit(0);});
