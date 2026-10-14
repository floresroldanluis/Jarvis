import {promises as fs} from 'node:fs';
import path from 'node:path';
export function repositoryName(value){
 if(typeof value!=='string'||!value.length||value.length>200||!/^[-\w]+\/[-\w.]+$/.test(value)||value.endsWith('.git'))throw new Error('Indica el repositorio como usuario/nombre.');return value;
}
export function newerVersion(candidate,current){const parse=s=>/^v?(\d+)\.(\d+)\.(\d+)$/.exec(s)?.slice(1).map(Number);const a=parse(candidate),b=parse(current);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
export class UpdateChecker{
 constructor({data,version,fetcher=fetch}){this.file=path.join(data,'updates.json');this.fetcher=fetcher;this.status={version,repository:'floresroldanluis/Jarvis',checkedAt:null,available:false,message:'Consulta de versiones pendiente.'};}
 async init(){try{this.status.repository=repositoryName(JSON.parse(await fs.readFile(this.file,'utf8')).repository);}catch{}return this;}
 async configure(value){const repository=value===''?'':repositoryName(value);await fs.writeFile(this.file,JSON.stringify({repository}));this.status={version:this.status.version,repository,checkedAt:null,available:false,message:repository?'Repositorio guardado.':'Falta vincular el repositorio de GitHub.'};return this.check();}
 async check(){if(!this.status.repository)return this.status;if(this.pending)return this.pending;this.pending=this.perform().finally(()=>{this.pending=null;});return this.pending;}
 async perform(){const repository=this.status.repository;try{
 const response=await this.fetcher(`https://api.github.com/repos/${repository}/releases/latest`,{headers:{Accept:'application/vnd.github+json','User-Agent':'JarvisOS-VersionCheck'},signal:AbortSignal.timeout(12000),redirect:'error'});
 if(response.status===404)throw new Error('No hay una versión pública publicada o el repositorio es privado.');if(!response.ok)throw new Error(`GitHub no respondió correctamente (${response.status}).`);
 const release=await response.json();if(typeof release.tag_name!=='string'||release.draft||release.prerelease)throw new Error('La publicación no es una versión estable.');
 const expected=`https://github.com/${repository}/releases/tag/`;if(typeof release.html_url!=='string'||!release.html_url.startsWith(expected))throw new Error('El enlace de actualización no pertenece al repositorio.');
 if(repository!==this.status.repository)return this.status;
 const available=newerVersion(release.tag_name,this.status.version);Object.assign(this.status,{checkedAt:new Date().toISOString(),latest:release.tag_name,available,url:release.html_url,message:available?'Hay una versión nueva disponible.':'Tienes la versión actual o una versión más reciente.'});
 }catch(error){if(repository===this.status.repository)Object.assign(this.status,{checkedAt:new Date().toISOString(),available:false,url:null,message:error.message});}return this.status;}
}
