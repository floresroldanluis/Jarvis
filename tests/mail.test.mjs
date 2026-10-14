import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import nodemailer from 'nodemailer';
import {deliverEmail,emailAddress} from '../mail.mjs';
test('recipients cannot inject headers or multiple destinations',()=>{assert.ok(emailAddress('ana@example.com'));for(const address of ['Ana','ana@example.com\r\nBcc:evil@example.com','a@example.com,b@example.com','a@localhost',''])assert.ok(!emailAddress(address));});
test('mail is actually handed to an isolated local SMTP server',async()=>{
  let transcript='',inData=false;const server=net.createServer(socket=>{socket.write('220 localhost JARVIS test\r\n');let buffer='';socket.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+2);if(inData){if(line==='.'){inData=false;socket.write('250 queued for local test\r\n');}else transcript+=line+'\n';continue;}if(line.startsWith('EHLO'))socket.write('250 localhost\r\n');else if(line.startsWith('DATA')){inData=true;socket.write('354 send content\r\n');}else if(line.startsWith('QUIT')){socket.write('221 bye\r\n');socket.end();}else socket.write('250 OK\r\n');}});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const transport=nodemailer.createTransport({host:'127.0.0.1',port:server.address().port,secure:false,ignoreTLS:true});const result=await deliverEmail({to:'test@example.invalid',subject:'JARVIS local test',body:'This stays on this computer.'},transport);assert.ok(result.accepted.includes('test@example.invalid'));assert.match(transcript,/This stays on this computer/);assert.match(transcript,/Subject: JARVIS local test/);}finally{await new Promise(resolve=>server.close(resolve));}
});
test('invalid outgoing message is rejected before SMTP',async()=>{await assert.rejects(()=>deliverEmail({to:'test@example.com',subject:'ok\r\nBcc: injected',body:'x'}),/válidos/);});
