import {spawn,execFile} from 'node:child_process';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {wakeCommand} from './wake.mjs';
const exec=promisify(execFile);
export class BackgroundVoice {
  constructor({root,data,onChange,onCommand,isBusy}){Object.assign(this,{root,data,onChange,onCommand,isBusy});this.child=null;this.status={enabled:false,state:'paused',error:null};this.speechQueue=Promise.resolve();this.speaking=false;this.busy=false;this.generation=0;this.pauseUntil=0;}
  publish(state,error=null){this.status={enabled:!!this.child,state,error};this.onChange(this.status);}
  async pauseFor(milliseconds){this.pauseUntil=Math.max(this.pauseUntil,Date.now()+milliseconds);await fs.writeFile(path.join(this.data,'voice-control.json'),JSON.stringify({until:this.pauseUntil}));}
  async refreshPause(){if(this.speaking)await this.pauseFor(20000);else{this.pauseUntil=Date.now()+1800;await fs.writeFile(path.join(this.data,'voice-control.json'),JSON.stringify({until:this.pauseUntil}));}}
  async setBusy(value){this.busy=value;await this.refreshPause();if(this.child)this.publish(value?'working':this.speaking?'speaking':'listening');}
  async start(){
    if(this.child)return this.status;
    await this.refreshPause();
    const generation=++this.generation;
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(this.root,'wake-listener.ps1'),'-ControlPath',path.join(this.data,'voice-control.json'),'-OwnerProcessId',String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    this.child=child;this.publish('starting');let buffer='',settled=false;
    const ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{if(!settled){settled=true;this.stop();reject(new Error('El reconocimiento de voz tardó demasiado en iniciar.'));}},20000);
      const failed=message=>{if(generation!==this.generation)return;this.publish('error',message);if(!settled){settled=true;clearTimeout(timer);reject(new Error(message));}};
      child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).replace(/^\uFEFF/,'');buffer=buffer.slice(i+1);try{const event=JSON.parse(line);if(event.type==='ready'){this.publish(this.busy?'working':this.speaking?'speaking':'listening');if(!settled){settled=true;clearTimeout(timer);resolve(this.status);}}else if(event.type==='error')failed(event.message);else if(!this.speaking&&Date.now()>this.pauseUntil){if(event.type==='wake')this.publish('awake');else if(event.type==='waiting')this.publish(this.busy?'working':'listening');else{const command=wakeCommand(event);if(command){this.publish(command.review?'review':'working');this.onCommand(command);}else this.publish(this.busy?'working':'listening');}}}catch{}}});
      child.stderr.on('data',()=>{});child.once('error',()=>failed('No se pudo iniciar el reconocimiento de voz de Windows.'));child.once('close',()=>{clearTimeout(timer);if(generation===this.generation){clearInterval(this.refresh);this.child=null;failed(this.status.error||'La escucha se detuvo. Actívala de nuevo.');}});
    });
    this.refresh=setInterval(()=>{if(this.speaking)this.pauseFor(20000).catch(()=>{});},5000);this.refresh.unref();
    return ready;
  }
  stop(){++this.generation;if(this.child)this.child.kill();this.child=null;clearInterval(this.refresh);this.publish('paused');return this.status;}
  say(text){
    this.speechQueue=this.speechQueue.catch(()=>{}).then(async()=>{
      this.speaking=true;await this.refreshPause();if(this.child)this.publish('speaking');
      const input=path.join(this.data,'say-'+crypto.randomUUID()+'.txt');
      try{await fs.writeFile(input,text.slice(0,3500).replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[#*`]/g,''));await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(this.root,'voice.ps1'),'-Action','say','-InputPath',input],{windowsHide:true,timeout:180000});}
      finally{await fs.unlink(input).catch(()=>{});this.speaking=false;await this.refreshPause();if(this.child)this.publish(this.busy?'working':'listening');}
    });return this.speechQueue;
  }
}
