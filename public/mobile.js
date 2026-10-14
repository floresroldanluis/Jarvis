const output=document.querySelector('#mobile-status');let pairing=null;
function render(s){pairing=s.pairing;output.textContent=s.enabled?'Puente Android activo. Tu PC debe seguir encendida.':(s.error||'Conexión móvil desactivada.');document.querySelector('#mobile-download').disabled=!pairing;}
async function request(enabled){const r=await fetch('/api/mobile',enabled===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});const s=await r.json();if(!r.ok)throw new Error(s.error);render(s);}
for(const [id,value] of [['mobile-enable',true],['mobile-disable',false]])document.querySelector('#'+id).addEventListener('click',()=>request(value).catch(e=>output.textContent=e.message));
document.querySelector('#mobile-download').addEventListener('click',()=>{if(!pairing)return;const url=URL.createObjectURL(new Blob([JSON.stringify(pairing)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jarvis-pairing.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
request().catch(e=>output.textContent=e.message);
