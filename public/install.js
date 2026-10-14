let deferred=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;document.querySelector('#install-app').hidden=false;});
document.querySelector('#install-app').onclick=async()=>{if(!deferred)return;await deferred.prompt();await deferred.userChoice;deferred=null;document.querySelector('#install-app').hidden=true;};
