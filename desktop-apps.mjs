import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
export function normalizeApp(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
export function desktopCommand(text){
 let value=String(text||'').trim().replace(/^jarvis[, :]+/i,'').replace(/[.!]+$/,'').replace(/[, ]*por favor$/i,'');
 const match=/^(abre(?:me)?|abrir|inicia|ejecuta|lanza|cierra(?:me)?|cerrar)\s+(.+)$/i.exec(value);if(!match||/\b(?:y luego|despu[eé]s|cuando|y (?:abre|cierra|redacta|escribe|crea|calcula))\b/i.test(match[2]))return null;
 let name=match[2].replace(/^(?:la aplicaci[oó]n|el programa|la app)\s+/i,'').replace(/^(?:mi|el|la)\s+/i,'');
 const android=/\b(?:en|de)\s+(?:(?:mi|el|la)\s+)?(?:celular|tel[eé]fono|tablet|android)\b/i.test(name);
 name=name.replace(/\s+(?:(?:en|de)\s+)?(?:(?:mi|la|el)\s+)?(?:pc|computadora(?: de escritorio)?|ordenador|escritorio)$/i,'').trim();
 if(!name||name.length>120||/[;|&<>`$\r\n]/.test(name))return null;
 return {operation:/^cierr|^cerr/i.test(match[1])?'close':'open',query:name,device:android?'android':'windows'};
}
const aliases={calculadora:'calculator',calculator:'calculator','bloc de notas':'notepad',notepad:'notepad',word:'microsoft word',excel:'microsoft excel',powerpoint:'microsoft powerpoint',chrome:'google chrome',edge:'microsoft edge','visual studio code':'visual studio code',vscode:'visual studio code'};
export function resolveApp(query,apps){
 const q=normalizeApp(query),alias=aliases[q]||q;
 const exact=apps.filter(a=>[normalizeApp(a.name),normalizeApp(a.id),...(a.aliases||[]).map(normalizeApp)].includes(q)||[normalizeApp(a.name),normalizeApp(a.id)].includes(alias));
 const matches=exact.length?exact:apps.filter(a=>q.length>=3&&normalizeApp(a.name).includes(q));
 const unique=[...new Map(matches.map(a=>[a.id,a])).values()];return {app:unique.length===1?unique[0]:null,candidates:unique};
}
export class DesktopApps{
 constructor({runner}={}){this.runner=runner||this.run;this.cache=null;}
 async run(input){const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'windows-apps.ps1');return new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',error='';const timeout=setTimeout(()=>{child.kill();reject(new Error('Windows tardó demasiado en responder al control de aplicaciones.'));},30000);child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>error=(error+c).slice(-2000));child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('close',code=>{clearTimeout(timeout);try{if(code!==0)throw new Error('Windows no pudo completar la operación.');const result=JSON.parse(output.replace(/^\uFEFF/,''));if(result.error)throw new Error(result.error);resolve(result);}catch(e){reject(e);}});child.stdin.end(JSON.stringify(input));});}
 async list(){if(this.cache&&Date.now()-this.cache.time<300000)return this.cache.apps;const result=await this.runner({operation:'list'});this.cache={time:Date.now(),apps:result.apps};return result.apps;}
 async execute(command){
 if(command.device!=='windows')return {status:'blocked',text:'Ese pedido es para Android. Hazlo desde JARVIS en el celular o tablet; este agente controla la PC.'};
 const {app,candidates}=resolveApp(command.query,await this.list());if(!app)return {status:'blocked',text:candidates.length?'Encontré varias aplicaciones: '+candidates.slice(0,8).map(a=>a.name).join(', ')+'. Dime el nombre completo.':'No encontré «'+command.query+'» entre las aplicaciones del menú Inicio de esta PC.'};
 const result=await this.runner({operation:command.operation,id:app.id});
 const texts={opened:'Windows aceptó la solicitud de abrir '+app.name+'.',closed:'Las ventanas de '+app.name+' se cerraron.',pending:'Solicité cerrar '+app.name+', pero todavía tiene ventanas abiertas. Puede estar esperando que guardes cambios o que confirmes el cierre.',not_running:app.name+' no tiene ventanas abiertas.',unavailable:'No pude identificar de forma segura las ventanas de '+app.name+'.',denied:'Windows no permitió controlar '+app.name+'. Puede estar ejecutándose con otros permisos.'};
 return {status:result.status==='pending'||result.status==='unavailable'||result.status==='denied'?'blocked':'completed',text:texts[result.status]||'Windows no confirmó el resultado. Comprueba la aplicación.'};
 }
}
