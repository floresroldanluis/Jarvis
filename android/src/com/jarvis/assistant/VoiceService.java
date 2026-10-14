package com.jarvis.assistant;
import android.app.*;
import android.os.*;
import android.content.*;
import android.speech.*;
import android.speech.tts.*;
import org.json.*;
import java.util.*;
public class VoiceService extends Service implements RecognitionListener {
 public static final String SUSPEND="SUSPEND",RESUME="RESUME",STOP="STOP";
 public static volatile boolean running=false;
 public static volatile String status="Escucha pausada",lastHeard="",lastError="";
 private final Handler h=new Handler(Looper.getMainLooper());private final VoiceTrigger trigger=new VoiceTrigger();
 private PowerManager.WakeLock wakeLock;private long renewWakeAt=0;private SpeechRecognizer recognizer;private TextToSpeech tts;private boolean active=false,suspended=false,speaking=false,pending=false,ttsReady=false,recognizing=false,scheduled=false;private boolean systemFallback=false;private int errors=0;private long startedAt=0,ignoreUntil=0,speechDeadline=0;private String engine="";
 private final Runnable listenTask=()->{scheduled=false;listen();};
 private final Runnable versionsTask=new Runnable(){public void run(){if(active){AppUpdates.check(VoiceService.this,false,null);h.postDelayed(this,21600000);}}};
 private final Runnable watchdog=new Runnable(){public void run(){if(!active)return;long now=SystemClock.elapsedRealtime();if(!suspended)holdWakeLock();if(speaking&&now>speechDeadline){tts.stop();speaking=false;trigger.extend(now);schedule(1000);}if(!speaking&&!suspended){if(recognizing&&now-startedAt>45000){cancelRecognition();status="Recuperando el micrófono…";schedule(1000);}else if(!recognizing&&!scheduled)schedule(500);}h.postDelayed(this,5000);}};
 static boolean enabled(Context c){return c.getSharedPreferences("jarvis",0).getBoolean("alwaysListen",true);}
 private void setEnabled(boolean value){getSharedPreferences("jarvis",0).edit().putBoolean("alwaysListen",value).apply();}
 @Override public void onCreate(){super.onCreate();getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel("jarvis-listening","Escucha de JARVIS",NotificationManager.IMPORTANCE_LOW));tts=new TextToSpeech(this,s->{ttsReady=s==TextToSpeech.SUCCESS;if(ttsReady)ttsReady=tts.setLanguage(new Locale("es","ES"))>=TextToSpeech.LANG_AVAILABLE;});tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){}public void onDone(String id){h.post(()->{if(!active)return;speaking=false;trigger.extend(SystemClock.elapsedRealtime());schedule(1000);});}public void onError(String id){onDone(id);}});}
 private Notification notification(){PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE);PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,VoiceService.class).setAction(STOP),PendingIntent.FLAG_IMMUTABLE);return new Notification.Builder(this,"jarvis-listening").setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("JARVIS · di Hola Jarvis").setContentText(status).setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Pausar",stop).build()).build();}
 private void showStatus(String text){status=text;if(active)getSystemService(NotificationManager.class).notify(1,notification());}
 @Override public int onStartCommand(Intent intent,int flags,int startId){String action=intent==null?"":intent.getAction();
  if(STOP.equals(action)){setEnabled(false);status="Escucha pausada por ti";stopSelf();return START_NOT_STICKY;}
  if(intent==null&&!enabled(this)){stopSelf();return START_NOT_STICKY;}
  if(SUSPEND.equals(action)){if(!active){stopSelf();return START_NOT_STICKY;}suspended=true;trigger.armedUntil=0;releaseWakeLock();h.removeCallbacks(listenTask);scheduled=false;cancelRecognition();if(tts!=null)tts.stop();speaking=false;showStatus("Escucha pausada durante el dictado manual");return START_STICKY;}
  if(RESUME.equals(action)&&active){suspended=false;holdWakeLock();schedule(900);return START_STICKY;}
  if(active)return START_STICKY;
  status="Iniciando micrófono…";
  try{if(Build.VERSION.SDK_INT>=29)startForeground(1,notification(),android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);else startForeground(1,notification());}catch(Exception e){status="Android no permitió el micrófono. Abre JARVIS y revisa el permiso.";lastError=status;stopSelf();return START_NOT_STICKY;}
  try{setupRecognizer();active=true;running=true;holdWakeLock();setEnabled(true);lastError="";suspended=false;h.post(versionsTask);h.post(watchdog);schedule(200);}catch(Exception e){status=e.getMessage();lastError=status;stopSelf();}
  return active?START_STICKY:START_NOT_STICKY;
 }
 private void holdWakeLock(){try{long now=SystemClock.elapsedRealtime();if(wakeLock==null){wakeLock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Jarvis:VoiceListening");wakeLock.setReferenceCounted(false);}if(!wakeLock.isHeld()||now>=renewWakeAt){wakeLock.acquire(600000);renewWakeAt=now+480000;}}catch(Exception e){lastError="Android puede suspender el micrófono con pantalla apagada.";}}
 private void releaseWakeLock(){try{if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();}catch(Exception ignored){}renewWakeAt=0;}
 private void setupRecognizer()throws Exception{
  if(recognizer!=null){try{recognizer.destroy();}catch(Exception ignored){}recognizer=null;}
  if(!systemFallback&&Build.VERSION.SDK_INT>=31&&SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);engine="local";}
  else if(getSharedPreferences("jarvis",0).getBoolean("allowSystemRecognition",false)&&SpeechRecognizer.isRecognitionAvailable(this)){recognizer=SpeechRecognizer.createSpeechRecognizer(this);engine="sistema, puede usar Internet";}
  else throw new Exception("No hay reconocimiento local compatible. Instala español sin conexión o habilita el reconocimiento del sistema en JARVIS (puede usar Internet).");
  recognizer.setRecognitionListener(this);
 }
 private void schedule(long delay){h.removeCallbacks(listenTask);scheduled=false;if(active&&!speaking&&!suspended){scheduled=true;h.postDelayed(listenTask,delay);}}
 private void cancelRecognition(){recognizing=false;ignoreUntil=SystemClock.elapsedRealtime()+600;if(recognizer!=null)try{recognizer.cancel();}catch(Exception ignored){}}
 private void listen(){if(!active||speaking||suspended||recognizing)return;try{Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"es-ES").putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);startedAt=SystemClock.elapsedRealtime();recognizing=true;showStatus("Esperando «Hola Jarvis» · "+engine);recognizer.startListening(i);}catch(Exception e){recognizing=false;lastError="No se pudo iniciar el micrófono. Reintentando.";showStatus(lastError);schedule(5000);}}
 private void say(String text){if(!active)return;if(suspended){status="Respuesta recibida durante el dictado; consulta el chat.";return;}cancelRecognition();if(!ttsReady){trigger.extend(SystemClock.elapsedRealtime());schedule(1000);return;}speaking=true;speechDeadline=SystemClock.elapsedRealtime()+120000;int result=tts.speak(text.substring(0,Math.min(2000,text.length())),TextToSpeech.QUEUE_FLUSH,null,"jarvis-reply");if(result==TextToSpeech.ERROR){speaking=false;schedule(1000);}}
 @Override public void onResults(Bundle bundle){recognizing=false;if(!active||suspended||speaking||SystemClock.elapsedRealtime()<ignoreUntil)return;errors=0;ArrayList<String> values=bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(values==null||values.isEmpty()){schedule(500);return;}String raw=values.get(0).trim();float[] confidence=bundle.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);float score=confidence!=null&&confidence.length>0?confidence[0]:-1;VoiceTrigger.Result result=trigger.accept(raw,score,SystemClock.elapsedRealtime());
  if(result.kind.equals("ignore")){schedule(500);return;}lastHeard=raw;if(result.kind.equals("review")){showStatus("No entendí con claridad; repite Hola Jarvis y tu pedido.");say("No entendí con claridad. Repite hola Jarvis y tu pedido.");return;}if(result.kind.equals("arm")){showStatus("Te escucho. Di tu pedido.");say("Te escucho.");return;}
  String command=result.text;if(command.matches("(?i)^(pausa escucha|deja de escuchar|silénciate)[.!]?$")){setEnabled(false);status="Escucha pausada por voz";stopSelf();return;}
  DeviceCommand local=DeviceCommand.parse(command);if(local!=null){String answer=DeviceControl.execute(this,local);showStatus(answer);say(answer);return;}if(pending){say("Hay una petición en curso. Espera a que termine.");return;}
  pending=true;showStatus("Enviando: "+command);new Thread(()->{try{Api.request(this,"/api/chat",new JSONObject().put("text",command).put("mode","auto"));h.post(()->{showStatus("Pedido enviado. Esperando respuesta de la PC…");poll(0);});}catch(Exception e){h.post(()->{pending=false;lastError=e.getMessage();showStatus(lastError);say("No pude enviar el pedido. Revisa la vinculación y la conexión con tu PC.");});}},"jarvis-command").start();schedule(700);
 }
 private void poll(int attempt){if(!active)return;new Thread(()->{try{JSONObject s=Api.request(this,"/api/state",null);if(s.optBoolean("busy")&&attempt<150){h.postDelayed(()->poll(attempt+1),2000);return;}JSONArray messages=s.optJSONArray("messages");String reply="La tarea sigue en curso. Consulta la aplicación.";if(!s.optBoolean("busy")&&messages!=null)for(int i=messages.length()-1;i>=0;i--){JSONObject m=messages.getJSONObject(i);if("assistant".equals(m.optString("role"))||"error".equals(m.optString("role"))){reply=m.optString("text");break;}}final String answer=reply;h.post(()->{pending=false;showStatus("Respuesta recibida");say(answer);});}catch(Exception e){h.post(()->{pending=false;lastError=e.getMessage();showStatus(lastError);say("Perdí la conexión con tu PC.");});}},"jarvis-poll").start();}
 @Override public void onError(int code){recognizing=false;if(!active||suspended||speaking||SystemClock.elapsedRealtime()<ignoreUntil)return;
  if((code==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED||code==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)&&!systemFallback&&getSharedPreferences("jarvis",0).getBoolean("allowSystemRecognition",false)){systemFallback=true;cancelRecognition();try{setupRecognizer();showStatus("Español local no disponible; probando el proveedor del sistema autorizado.");schedule(1500);return;}catch(Exception e){lastError=e.getMessage();status=lastError;stopSelf();return;}}if(code==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS||code==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED||code==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE){lastError="Revisa el permiso de micrófono y el idioma español descargado. Código: "+code;status=lastError;stopSelf();return;}
  if(code==SpeechRecognizer.ERROR_NO_MATCH||code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT){errors=0;schedule(600);return;}
  errors++;lastError="Micrófono temporalmente no disponible ("+code+"). Reintentando…";showStatus(lastError);cancelRecognition();try{setupRecognizer();}catch(Exception e){lastError=e.getMessage();status=lastError;stopSelf();return;}schedule(Math.min(30000,1500L*errors));
 }
 @Override public void onReadyForSpeech(Bundle b){if(!active||suspended||speaking)return;lastError="";showStatus("Escuchando «Hola Jarvis» · "+engine);}
 @Override public void onDestroy(){active=false;running=false;releaseWakeLock();h.removeCallbacksAndMessages(null);if(recognizer!=null){try{recognizer.cancel();recognizer.destroy();}catch(Exception ignored){}}if(tts!=null){tts.stop();tts.shutdown();}stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
 @Override public IBinder onBind(Intent i){return null;}
 public void onBeginningOfSpeech(){}public void onRmsChanged(float f){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){}public void onPartialResults(Bundle b){}public void onEvent(int type,Bundle b){}
}
