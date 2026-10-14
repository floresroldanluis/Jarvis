package com.jarvis.assistant;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import org.json.*;
import java.net.*;
import java.io.*;
final class AppUpdates {
 static volatile String message="Consulta de versiones pendiente";static volatile boolean checking=false;
 static void check(Context c,boolean force,Runnable done){if(checking)return;long last=c.getSharedPreferences("jarvis",0).getLong("versionCheck",0);if(!force&&System.currentTimeMillis()-last<21600000){if(done!=null)done.run();return;}checking=true;
 new Thread(()->{try{
  HttpURLConnection conn=(HttpURLConnection)new URL("https://api.github.com/repos/floresroldanluis/Jarvis/releases/latest").openConnection();conn.setConnectTimeout(10000);conn.setReadTimeout(10000);conn.setInstanceFollowRedirects(false);conn.setRequestProperty("Accept","application/vnd.github+json");conn.setRequestProperty("User-Agent","JarvisOS-Android");
  String json;try{if(conn.getResponseCode()!=200)throw new IOException("No se pudo consultar GitHub.");ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=conn.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>1000000)throw new IOException("Respuesta de versiones demasiado grande");out.write(b,0,n);}}json=out.toString("UTF-8");}finally{conn.disconnect();}
  JSONObject release=new JSONObject(json);if(release.optBoolean("draft")||release.optBoolean("prerelease"))throw new IOException("No hay versión estable.");String installed=c.getPackageManager().getPackageInfo(c.getPackageName(),0).versionName;JSONArray assets=release.getJSONArray("assets");String newer=null;
  for(int i=0;i<assets.length();i++){JSONObject a=assets.getJSONObject(i);String name=a.optString("name");java.util.regex.Matcher m=java.util.regex.Pattern.compile("JARVIS-Android-(\\d+\\.\\d+\\.\\d+)\\.apk").matcher(name);if(m.matches()&&greater(m.group(1),installed)&&a.optString("browser_download_url").startsWith("https://github.com/floresroldanluis/Jarvis/releases/download/"))newer=m.group(1);}
  message=newer==null?"Android actualizado: "+installed:"Nueva versión Android: "+newer;
  c.getSharedPreferences("jarvis",0).edit().putLong("versionCheck",System.currentTimeMillis()).apply();
  if(newer!=null&&(Build.VERSION.SDK_INT<33||c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==android.content.pm.PackageManager.PERMISSION_GRANTED)){
   NotificationManager nm=c.getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("jarvis-updates","Versiones de JARVIS",NotificationManager.IMPORTANCE_DEFAULT));PendingIntent pi=PendingIntent.getActivity(c,3,new Intent(Intent.ACTION_VIEW,Uri.parse("https://github.com/floresroldanluis/Jarvis/releases/latest")),PendingIntent.FLAG_IMMUTABLE);nm.notify(2,new Notification.Builder(c,"jarvis-updates").setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle(message).setContentText("Toca para descargar e instalar desde GitHub.").setContentIntent(pi).setAutoCancel(true).build());
  }
 }catch(Exception e){message="No se pudieron consultar las versiones. Inténtalo de nuevo.";}finally{checking=false;if(done!=null)new Handler(Looper.getMainLooper()).post(done);}},"jarvis-versions").start();
 }
 static boolean greater(String a,String b){try{String[] x=a.split("\\."),y=b.split("\\.");for(int i=0;i<3;i++){int d=Integer.parseInt(x[i])-Integer.parseInt(y[i]);if(d!=0)return d>0;}return false;}catch(Exception e){return false;}}
}
