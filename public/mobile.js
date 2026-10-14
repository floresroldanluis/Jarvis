const output=document.querySelector('#mobile-status'),code=document.querySelector('#mobile-pairing');
function render(s){output.textContent=s.enabled?'Puente Android activo. Tu PC debe seguir encendida.':(s.error||'Conexión móvil desactivada.');code.value=s.pairing?JSON.stringify(s.pairing):'';document.querySelector('#mobile-download').disabled=!s.pairing;}
async function request(enabled){const r=await fetch('/api/mobile',enabled===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});const s=await r.json();if(!r.ok)throw new Error(s.error);render(s);}
for(const [id,value] of [['mobile-enable',true],['mobile-disable',false]])document.querySelector('#'+id).addEventListener('click',()=>request(value).catch(e=>output.textContent=e.message));
document.querySelector('#mobile-download').addEventListener('click',()=>{if(!code.value)return;const url=URL.createObjectURL(new Blob([code.value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jarvis-pairing.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
request().catch(e=>output.textContent=e.message);
