import test from 'node:test';
import assert from 'node:assert/strict';
import {wakeCommand} from '../wake.mjs';
test('requests require the name at the start of the wake phrase',()=>{
  const event={type:'command',withWake:true,confidence:.9};
  assert.deepEqual(wakeCommand({...event,text:'Jarvis, ayúdame a redactar un documento'}),{text:'ayúdame a redactar un documento',review:false});
  assert.equal(wakeCommand({...event,text:'abre la calculadora'}),null);
  assert.equal(wakeCommand({...event,text:'creo que Jarvis puede hacerlo'}),null);
  assert.equal(wakeCommand({...event,text:'Jarvista abre algo'}),null);
  assert.equal(wakeCommand({...event,text:'Jarvis'}),null);
});
test('uncertain requests require review and silence never creates an action',()=>{
  assert.equal(wakeCommand({type:'wake',confidence:1,text:'Jarvis'}),null);
  assert.equal(wakeCommand({type:'command',withWake:true,text:'Jarvis abre calculadora',confidence:.2}),null);
  assert.deepEqual(wakeCommand({type:'command',withWake:true,text:'Jarvis abre calculadora',confidence:.45}),{text:'abre calculadora',review:true});
  assert.equal(wakeCommand({type:'command',withWake:true,text:'Jarvis abre calculadora',confidence:NaN}),null);
});
test('follow-up speech from the armed native grammar retains the request',()=>{
  assert.deepEqual(wakeCommand({type:'command',withWake:false,text:'Ayúdame con mi documento',confidence:.8}),{text:'Ayúdame con mi documento',review:false});
});
