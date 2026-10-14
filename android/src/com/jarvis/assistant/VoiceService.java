package com.jarvis.assistant;
import android.app.*;
import android.os.*;
import android.content.*;
import android.speech.*;
import android.speech.tts.*;
import org.json.*;
import java.util.*;
public class VoiceService extends Service implements RecognitionListener {
 private final Handler h=new Handler(Looper.getMainLooper());
 private SpeechRecognizer recognizer;private TextToSpeech tts;private boolean active=false,speaking=false,pending=false,ttsReady=false;private long armedUntil=0;private int errors=0;private String lastReply="";
 private final Runnable listenTask=()->listen();private final Runnable versionsTask=new Runnable(){public void run(){if(active){AppUpdates.check(VoiceService.this,false,null);h.postDelayed(this,21600000);}}};
 public static volatile String status="Escucha pausada";
 @Override public void onCreate(){super.onCreate();NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("jarvis-listening","Escucha de JARVIS",NotificationManager.IMPORTANCE_LOW));tts=new TextToSpeech(this,s->{ttsReady=s==TextToSpeech.SUCCESS;if(ttsReady)tts.setLanguage(new Locale("es","ES"));});tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){}public void onDone(String id){h.post(()->{speaking=false;schedule(1000);});}public void onError(String id){onDone(id);}});}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent!=null&&"STOP".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
  Intent open=new Intent(this,MainActivity.class);PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_IMMUTABLE);
  Intent stop=new Intent(this,VoiceService.class).setAction("STOP");PendingIntent sp=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_IMMUTABLE);
  Notification n=new Notification.Builder(this,"jarvis-listening").setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("JARVIS: micrófono activo").setContentText("Di Jarvis y tu petición. Toca para abrir.").setContentIntent(pi).setOngoing(true).addAction(new Notification.Action.Builder(null,"Pausar",sp).build()).build();
  try{if(Build.VERSION.SDK_INT>=29)startForeground(1,n,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);else startForeground(1,n);}catch(Exception e){status="Android no permitió activar el micrófono. Abre la app.";stopSelf();return START_NOT_STICKY;}
  if(active)return START_NOT_STICKY;
  if(Build.VERSION.SDK_INT<31||!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){status="Este equipo no ofrece reconocimiento local compatible. Usa Hablar o escribir.";stopSelf();return START_NOT_STICKY;}
  try{recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);recognizer.setRecognitionListener(this);active=true;h.post(versionsTask);status="Esperando Jarvis · modo experimental";schedule(200);}catch(Exception e){status=e.getMessage();stopSelf();}
  return START_NOT_STICKY;
 }
 private void schedule(long delay){h.removeCallbacks(listenTask);if(active&&!speaking)h.postDelayed(listenTask,delay);}
 private void listen(){if(!active||speaking)return;try{Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"es-ES").putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);recognizer.startListening(i);}catch(Exception e){status="No se pudo iniciar el reconocimiento local.";stopSelf();}}
 private void say(String text){if(!active)return;if(!ttsReady){schedule(500);return;}speaking=true;recognizer.cancel();tts.speak(text,TextToSpeech.QUEUE_FLUSH,null,"jarvis-reply");}
 @Override public void onResults(Bundle bundle){errors=0;ArrayList<String> values=bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(values==null||values.isEmpty()){schedule(400);return;}String raw=values.get(0).trim();float[] confidence=bundle.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);float score=confidence!=null&&confidence.length>0?confidence[0]:-1;
  boolean named=raw.toLowerCase(Locale.ROOT).matches("^jarvis\\b.*");boolean armed=System.currentTimeMillis()<armedUntil;
  if(!named&&!armed){schedule(400);return;}
  if(score>=0&&score<0.55f){armedUntil=0;say("No entendí con claridad. Repite Jarvis y tu pedido.");return;}
  String command=named?raw.replaceFirst("(?i)^jarvis[ ,:.]*","").trim():raw;armedUntil=0;
  if(command.isEmpty()){armedUntil=System.currentTimeMillis()+15000;say("Te escucho.");return;}
  if(command.matches("(?i)^(pausa escucha|deja de escuchar|silénciate)[.!]?$")){status="Escucha pausada por voz";stopSelf();return;}
  DeviceCommand local=DeviceCommand.parse(command);if(local!=null){String answer=DeviceControl.execute(this,local);status=answer;say(answer);return;}if(pending){say("Hay una petición en curso. Espera a que termine.");return;}
  pending=true;status="Enviando: "+command;
  new Thread(()->{try{JSONObject request=new JSONObject().put("text",command).put("mode","auto");Api.request(this,"/api/chat",request);h.post(()->poll(0));}catch(Exception e){h.post(()->{pending=false;status=e.getMessage();say("No pude enviar el pedido. Revisa la conexión en la aplicación.");});}},"jarvis-command").start();schedule(600);
 }
 private void poll(int attempt){if(!active)return;new Thread(()->{try{JSONObject s=Api.request(this,"/api/state",null);if(s.optBoolean("busy")&&attempt<150){h.postDelayed(()->poll(attempt+1),2000);return;}JSONArray messages=s.optJSONArray("messages");String reply="La tarea sigue en curso. Consulta la aplicación.";if(!s.optBoolean("busy")&&messages!=null){for(int i=messages.length()-1;i>=0;i--){JSONObject m=messages.getJSONObject(i);if("assistant".equals(m.optString("role"))||"error".equals(m.optString("role"))){reply=m.optString("text");break;}}}final String answer=reply;h.post(()->{pending=false;lastReply=answer;status="Esperando Jarvis · modo experimental";say(answer.substring(0,Math.min(3000,answer.length())));});}catch(Exception e){h.post(()->{pending=false;status=e.getMessage();say("Perdí la conexión con tu PC.");});}},"jarvis-poll").start();}
 @Override public void onError(int code){if(!active||speaking)return;if(code==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS||code==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED||code==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE){status="Instala el reconocimiento de español local y revisa el permiso de micrófono. Código: "+code;stopSelf();return;}if(code!=SpeechRecognizer.ERROR_NO_MATCH&&code!=SpeechRecognizer.ERROR_SPEECH_TIMEOUT&&++errors>=5){status="Reconocimiento detenido por Android. Abre la app para reactivar. Código: "+code;stopSelf();return;}schedule(code==SpeechRecognizer.ERROR_NO_MATCH||code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT?500:3000);}
 @Override public void onDestroy(){active=false;h.removeCallbacksAndMessages(null);if(recognizer!=null){recognizer.cancel();recognizer.destroy();}if(tts!=null){tts.stop();tts.shutdown();}stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
 @Override public IBinder onBind(Intent i){return null;}
 public void onReadyForSpeech(Bundle b){}public void onBeginningOfSpeech(){}public void onRmsChanged(float f){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){}public void onPartialResults(Bundle b){}public void onEvent(int type,Bundle b){}
}
