package com.jarvis.assistant;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.*;
final class DeviceCommand {
 final String action,query;DeviceCommand(String a,String q){action=a;query=q;}
 static String normal(String s){return Normalizer.normalize(s,Normalizer.Form.NFKD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]"," ").replaceAll("\\s+"," ").trim();}
 static DeviceCommand parse(String text){String t=normal(text).replaceFirst("^(?:hola +)?jarvis +","").replaceFirst(" +por favor$","");
  if(t.matches(".*\\b(?:en|de) (?:mi |el |la )?(?:pc|computadora|ordenador|escritorio)\\b.*"))return null;
  t=t.replaceFirst(" +(?:en|de) (?:mi |el |la )?(?:celular|telefono|tablet|android)$","");
  if(t.matches("(?:vuelve|ve|ir) (?:al |a |a la )?(?:inicio|pantalla de inicio)|inicio|pantalla de inicio"))return new DeviceCommand("home","");
  if(t.matches("(?:vuelve |ir )?atras|retrocede"))return new DeviceCommand("back","");
  if(t.matches("(?:abre |muestra |ver )?(?:las )?(?:aplicaciones|apps) recientes"))return new DeviceCommand("recents","");
  Matcher m=Pattern.compile("^(abre(?:me)?|abrir|inicia|lanza|cierra(?:me)?|cerrar) +(.+)$").matcher(t);if(!m.matches())return null;
  String q=m.group(2).replaceFirst("^(?:la aplicacion|la app|el programa) +","").replaceFirst("^(?:mi|el|la) +","");
  if(q.matches(".*\\b(?:y luego|despues|cuando|y (?:abre|cierra|redacta|escribe|crea|calcula))\\b.*"))return null;
  return new DeviceCommand(m.group(1).startsWith("cierr")||m.group(1).startsWith("cerr")?"close":"open",q);
 }
}
