import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('actual Windows helper distinguishes close, save-pending, absent and denied using isolated process fixtures',{skip:process.platform!=='win32'},async()=>{for(const scenario of ['closed','pending','not_running','denied']){const result=await new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/windows-apps.fixture.ps1'),'-Scenario',scenario],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',error='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>error+=c);child.on('error',reject);child.on('close',code=>{if(code!==0)return reject(new Error(error));try{resolve(JSON.parse(output.replace(/^\uFEFF/,'')));}catch(e){reject(e);}});child.stdin.end(JSON.stringify({operation:'close',id:'notepad'}));});assert.equal(result.status,scenario,JSON.stringify(result));}});
