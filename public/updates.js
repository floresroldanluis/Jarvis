const form=document.querySelector('#updates-form'),status=document.querySelector('#updates-status'),repo=document.querySelector('#updates-repo'),link=document.querySelector('#updates-link');
function render(value){document.querySelector('#installed-version').textContent=value.version;repo.value=value.repository;status.textContent=value.message+(value.checkedAt?' Última consulta: '+new Date(value.checkedAt).toLocaleString(): '');link.hidden=!value.available;if(value.available)link.href=value.url;}
async function request(method='GET',body){const r=await fetch('/api/updates',{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw new Error(v.error);render(v);}
form.addEventListener('submit',async e=>{e.preventDefault();try{await request('POST',{repository:repo.value.trim()});}catch(e){status.textContent=e.message;}});
document.querySelector('#updates-check').addEventListener('click',async()=>{status.textContent='Consultando GitHub…';try{await request('POST',{check:true});}catch(e){status.textContent=e.message;}});
request().catch(e=>{status.textContent=e.message;});
