package com.jarvis.assistant;
public class VoiceTriggerTest {
 static void check(boolean x,String detail){if(!x)throw new AssertionError(detail);}
 public static void main(String[] args){
  VoiceTrigger trigger=new VoiceTrigger();check(trigger.accept("abre Chrome",0.9f,100).kind.equals("ignore"),"Unaddressed speech must be ignored");
  VoiceTrigger.Result r=trigger.accept("Hola Jarvis, abre Chrome",0.9f,200);check(r.kind.equals("command")&&r.text.equals("abre Chrome"),"Greeting and request must execute automatically");
  r=trigger.accept("HOLA, JARVIS: redacta una carta",0.9f,300);check(r.text.equals("redacta una carta"),"Punctuation and case");
  check(trigger.accept("Jarvis abre Gmail",-1f,400).kind.equals("command"),"Keep original wake word and unavailable confidence");
  check(trigger.accept("Hola Jarvis",0.9f,1000).kind.equals("arm"),"Greeting alone arms follow-up");trigger.extend(2000);r=trigger.accept("Me llamo Luis",0.9f,3000);check(r.text.equals("Me llamo Luis"),"Follow-up must be sent without repeating wake");check(trigger.accept("otra cosa",0.9f,3100).kind.equals("ignore"),"Arm is one-shot");
  trigger.accept("Hola Jarvis",0.9f,4000);check(trigger.accept("envía un correo",0.9f,20000).kind.equals("ignore"),"Expired follow-up cannot execute");trigger.extend(20500);check(trigger.accept("otra orden",0.9f,20600).kind.equals("ignore"),"A late voice response must not revive an expired wake");
  check(trigger.accept("Hola Jarvis borra algo",0.2f,21000).kind.equals("review"),"Low confidence must not execute");
  check(trigger.accept("Estaba hablando de Jarvis",0.9f,22000).kind.equals("ignore"),"Name in conversation is not a wake phrase");
  check(VoiceTrigger.manual("Hola Jarvis, calcula 2 más 2").equals("calcula 2 más 2"),"Manual send strips greeting");check(VoiceTrigger.manual("Hola Jarvis").isEmpty(),"Greeting alone is not a manual task");check(VoiceTrigger.manual("redacta una carta").equals("redacta una carta"),"Manual button explicitly authorizes voice without wake");
  System.out.println("Android voice wake and auto-send routing passed");
 }
}
