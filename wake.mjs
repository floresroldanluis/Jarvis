export function wakeCommand(event){
  if(event?.type!=='command'||typeof event.text!=='string'||event.text.length>16000||!Number.isFinite(event.confidence))return null;
  let text=event.text.trim();
  if(event.withWake){if(!/^jarvis\b/i.test(text))return null;text=text.replace(/^jarvis\b[\s,:;.¡!¿?-]*/i,'').trim();}
  if(!text||event.confidence<.35)return null;
  return {text,review:event.confidence<.55};
}
