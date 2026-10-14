import https from 'node:https';
import crypto from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
const exec=promisify(execFile);
export function privateAddress(ip=''){ip=ip.replace(/^::ffff:/,'');return ip==='127.0.0.1'||ip==='::1'||/^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip)||/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);}
export function validToken(received,expected){if(typeof received!=='string'||typeof expected!=='string')return false;const a=Buffer.from(received),b=Buffer.from('Bearer '+expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
export class MobileBridge{
 constructor({root,data,python,localPort}){Object.assign(this,{root,data,python,localPort});this.server=null;this.config=null;this.error=null;this.port=4318;}
 async init(){try{this.config=JSON.parse(await fs.readFile(path.join(this.data,'mobile.json'),'utf8'));if(this.config.enabled)await this.start();}catch(e){if(e.code!=='ENOENT')this.error=e.message;}return this;}
 status(){return {enabled:!!this.server,error:this.error,port:this.port};}
 async start(){
 if(this.server)return this.status();
 try{
 if(!this.config?.token){await exec(this.python,[path.join(this.root,'mobile-certificate.py'),this.data],{windowsHide:true,timeout:30000});this.config={enabled:true,token:crypto.randomBytes(32).toString('hex')};}
 const [key,cert]=await Promise.all(['mobile-key.pem','mobile-cert.pem'].map(f=>fs.readFile(path.join(this.data,f))));
 this.fingerprint=new crypto.X509Certificate(cert).fingerprint256.replaceAll(':','').toLowerCase();
 const server=https.createServer({key,cert,minVersion:'TLSv1.2'},async(req,res)=>{
 const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(!privateAddress(req.socket.remoteAddress)||req.headers.origin||!validToken(req.headers.authorization,this.config.token))return json(403,{error:'Conexión no autorizada.'});
 const allowed=(req.method==='GET'&&req.url==='/api/state')||(req.method==='POST'&&['/api/chat','/api/stop'].includes(req.url));if(!allowed)return json(404,{error:'Ruta no disponible.'});
 try{
 let input; if(req.method==='POST'){if(!(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'Se requiere JSON.'});let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>80000)return json(413,{error:'Petición demasiado grande.'});chunks.push(c);}input=Buffer.concat(chunks);}
 const result=await fetch(`http://127.0.0.1:${this.localPort}${req.url}`,{method:req.method,headers:input?{'Content-Type':'application/json'}:{},body:input,signal:AbortSignal.timeout(15000)});const value=await result.json();
 if(req.url==='/api/state'&&result.ok)return json(200,{messages:value.messages.slice(-30).map(({role,text,id})=>({role,text,id})),busy:value.busy,jobs:value.jobs.slice(0,5).map(({status,text})=>({status,text}))});
 return json(result.status,value);
 }catch{return json(502,{error:'No se pudo contactar al agente de PC.'});}
 });
 server.requestTimeout=20000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(this.port,'0.0.0.0',resolve);});
 server.on('error',e=>{this.error=e.message;});this.server=server;this.error=null;this.config.enabled=true;await fs.writeFile(path.join(this.data,'mobile.json'),JSON.stringify(this.config));return this.status();
 }catch(e){this.error=e.message;throw e;}
 }
 async stop(){if(this.server){this.server.closeAllConnections();await new Promise(r=>this.server.close(r));this.server=null;}if(this.config){this.config.enabled=false;await fs.writeFile(path.join(this.data,'mobile.json'),JSON.stringify(this.config));}return this.status();}
 pairing(){if(!this.server)return null;const ips=Object.values(os.networkInterfaces()).flat().filter(n=>n&&n.family==='IPv4'&&!n.internal&&privateAddress(n.address)).map(n=>n.address);return {url:`https://${ips[0]||'IP-DE-TU-PC'}:${this.port}`,fingerprint:this.fingerprint,token:this.config.token};}
}
