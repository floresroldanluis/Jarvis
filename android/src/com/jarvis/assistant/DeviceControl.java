package com.jarvis.assistant;
import android.app.Activity;
import android.content.*;
import android.content.pm.*;
import android.accessibilityservice.AccessibilityService;
import java.util.*;
final class DeviceControl {
 static String execute(Context context,DeviceCommand command){
  DeviceAccessService access=DeviceAccessService.current;
  if(!command.action.equals("open")&&!command.action.equals("close")){
   if(access==null)return "Activa Control del dispositivo en Accesibilidad para usar inicio, atrás y aplicaciones recientes.";
   int action=command.action.equals("home")?AccessibilityService.GLOBAL_ACTION_HOME:command.action.equals("back")?AccessibilityService.GLOBAL_ACTION_BACK:AccessibilityService.GLOBAL_ACTION_RECENTS;
   boolean done=access.performGlobalAction(action);return done?(command.action.equals("home")?"Volví a la pantalla de inicio.":command.action.equals("back")?"Solicité volver atrás.":"Abrí aplicaciones recientes."):"Android no permitió esa acción en este momento.";
  }
  if(command.action.equals("close")&&command.query.matches("(?:esta|la actual|aplicacion actual|esta aplicacion|esta app)"))return homeInstead(access);
  PackageManager pm=context.getPackageManager();Intent query=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);List<ResolveInfo> all=pm.queryIntentActivities(query,0);Map<String,ResolveInfo> exact=new LinkedHashMap<>(),partial=new LinkedHashMap<>();
  String wanted=DeviceCommand.normal(command.query);for(ResolveInfo app:all){String label=DeviceCommand.normal(app.loadLabel(pm).toString());String pkg=app.activityInfo.packageName;if(label.equals(wanted)||DeviceCommand.normal(pkg).equals(wanted))exact.put(pkg,app);else if(wanted.length()>=3&&label.contains(wanted))partial.put(pkg,app);}
  Map<String,ResolveInfo> choices=exact.isEmpty()?partial:exact;
  if(choices.isEmpty())return "No encontré «"+command.query+"» entre las aplicaciones instaladas de este Android.";
  if(choices.size()>1){StringBuilder names=new StringBuilder();for(ResolveInfo r:choices.values()){if(names.length()>0)names.append(", ");names.append(r.loadLabel(pm));}return "Hay varias aplicaciones: "+names+". Dime el nombre completo.";}
  ResolveInfo app=choices.values().iterator().next();String pkg=app.activityInfo.packageName,label=app.loadLabel(pm).toString();
  if(command.action.equals("close")){
   if(access==null)return "Para salir de "+label+", activa Control del dispositivo en Accesibilidad. Android no permite que JARVIS fuerce la detención de otras apps.";
   if(!pkg.equals(DeviceAccessService.foregroundPackage))return label+" no está en primer plano. Android no permite que JARVIS fuerce su cierre. Puedes revisar su estado en Ajustes de Android.";
   return homeInstead(access);
  }
  if(!(context instanceof Activity)&&access==null)return "Para abrir "+label+" desde la escucha en segundo plano, activa Control del dispositivo en Accesibilidad o envía el pedido desde la pantalla de JARVIS.";
  Intent launch=pm.getLaunchIntentForPackage(pkg);if(launch==null)return "Android no ofrece un acceso para abrir "+label+".";
  launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);try{if(access!=null)access.startActivity(launch);else context.startActivity(launch);return "Android aceptó la solicitud de abrir "+label+".";}catch(Exception e){return "Android no permitió abrir "+label+". Prueba desde la pantalla de JARVIS.";}
 }
 private static String homeInstead(DeviceAccessService access){if(access==null)return "Activa Control del dispositivo en Accesibilidad para volver al inicio.";return access.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)?"Volví al inicio. La aplicación puede seguir en segundo plano; no la forcé a detenerse.":"Android no permitió volver al inicio.";}
}
