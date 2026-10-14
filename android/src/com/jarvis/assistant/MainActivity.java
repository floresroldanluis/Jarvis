package com.jarvis.assistant;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.speech.RecognizerIntent;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.io.*;
public class MainActivity extends Activity {
 private TextView status,conversation,voiceStatus;private EditText pairing,prompt;private final Handler h=new Handler(Looper.getMainLooper());private boolean visible=false,loading=false;private final Runnable poller=new Runnable(){public void run(){if(!visible)return;refresh();voiceStatus.setText(VoiceService.status);h.postDelayed(this,4000);}};
 @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().setStatusBarColor(Color.rgb(6,17,24));getWindow().setNavigationBarColor(Color.rgb(6,17,24));ScrollView scroll=new ScrollView(this);LinearLayout box=new LinearLayout(this);box.setOrientation(1);box.setPadding(24,36,24,32);box.setBackgroundColor(Color.rgb(6,17,24));scroll.addView(box);setContentView(scroll);
  TextView title=text("JARVIS  /  ANDROID",25);title.setTextColor(Color.rgb(70,222,241));box.addView(title);box.addView(text("Tu asistente de PC, desde tu celular o tablet. Versión 1.0.0",14));
  status=text("Vincula tu PC desde Ajustes > Android. Ambos deben estar en la misma red Wi-Fi o VPN privada.",15);box.addView(status);
  pairing=new EditText(this);pairing.setTextColor(Color.WHITE);pairing.setHintTextColor(Color.LTGRAY);pairing.setHint("Pega el código JSON de vinculación de tu PC");pairing.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);pairing.setMinLines(2);box.addView(pairing);
  button(box,"Importar archivo de vinculación",()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,20);});
  button(box,"Vincular PC",()->savePairing(pairing.getText().toString()));
  voiceStatus=text(VoiceService.status,15);box.addView(voiceStatus);button(box,"Activar escucha en segundo plano",()->activate());button(box,"Pausar escucha",()->{stopService(new Intent(this,VoiceService.class));VoiceService.status="Escucha pausada";voiceStatus.setText(VoiceService.status);});
  box.addView(text("Escucha experimental con reconocimiento local de Android 12 o posterior. Requiere español descargado y notificación visible. Android puede interrumpirla. Puedes escribir y usar otras apps mientras JARVIS trabaja.",13));
  prompt=new EditText(this);prompt.setTextColor(Color.WHITE);prompt.setHintTextColor(Color.LTGRAY);prompt.setHint("Escribe tu petición…");prompt.setMinLines(2);box.addView(prompt);
  button(box,"Enviar pedido",()->send(prompt.getText().toString()));button(box,"Hablar una vez",()->{try{Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"es-ES").putExtra(RecognizerIntent.EXTRA_PROMPT,"Habla con JARVIS");startActivityForResult(i,21);}catch(Exception e){status.setText("No hay servicio de dictado. Puedes escribir.");}});
  box.addView(text("El dictado manual utiliza el proveedor de reconocimiento configurado en Android y puede usar Internet. Puedes revisar el texto antes de enviarlo.",13));
  button(box,"Detener tarea de PC",()->new Thread(()->{try{Api.request(this,"/api/stop",new JSONObject());runOnUiThread(()->status.setText("Se solicitó detener la tarea."));}catch(Exception e){showError(e);}}).start());
  button(box,"Ver versiones en GitHub",()->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://github.com/floresroldanluis/Jarvis/releases"))));
  conversation=text("Aquí aparecerán tus pedidos y respuestas.",16);conversation.setTextIsSelectable(true);box.addView(conversation);
 }
 private TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextColor(Color.rgb(219,231,235));v.setTextSize(size);v.setPadding(0,10,0,10);return v;}
 private void button(LinearLayout parent,String label,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setOnClickListener(v->action.run());parent.addView(b,new LinearLayout.LayoutParams(-1,-2));}
 private void showError(Exception e){runOnUiThread(()->status.setText(e.getMessage()==null?"No se pudo conectar con tu PC.":e.getMessage()));}
 private void savePairing(String value){try{JSONObject p=new JSONObject(value);if(!p.getString("fingerprint").replace(":","").matches("[a-fA-F0-9]{64}")||!p.getString("token").matches("[a-f0-9]{64}"))throw new Exception("Código de vinculación inválido.");PairingStore.save(this,p.toString());pairing.setText("");status.setText("PC guardada. Probando conexión…");refresh();}catch(Exception e){showError(e);}}
 private void activate(){try{PairingStore.read(this);}catch(Exception e){showError(e);return;}if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO},10);return;}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},11);return;}try{startForegroundService(new Intent(this,VoiceService.class));h.postDelayed(()->voiceStatus.setText(VoiceService.status),1000);}catch(Exception e){showError(e);}}
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] grant){super.onRequestPermissionsResult(code,permissions,grant);if(grant.length>0&&grant[0]==PackageManager.PERMISSION_GRANTED)activate();else status.setText("Sin este permiso puedes seguir escribiendo. Activa micrófono y notificaciones para la escucha.");}
 private void send(String text){if(text.trim().isEmpty())return;status.setText("Enviando…");new Thread(()->{try{Api.request(this,"/api/chat",new JSONObject().put("text",text.trim()).put("mode","auto"));runOnUiThread(()->{prompt.setText("");status.setText("Pedido enviado a tu PC.");refresh();});}catch(Exception e){showError(e);}},"jarvis-send").start();}
 private void refresh(){if(loading)return;loading=true;new Thread(()->{try{JSONObject s=Api.request(this,"/api/state",null);JSONArray messages=s.optJSONArray("messages");StringBuilder out=new StringBuilder();if(messages!=null)for(int i=0;i<messages.length();i++){JSONObject m=messages.getJSONObject(i);out.append("user".equals(m.optString("role"))?"TÚ\n":"JARVIS\n").append(m.optString("text")).append("\n\n");}runOnUiThread(()->{conversation.setText(out.toString());status.setText(s.optBoolean("busy")?"JARVIS está trabajando en tu PC…":"Conectado a tu PC.");});}catch(Exception e){showError(e);}finally{loading=false;}},"jarvis-refresh").start();}
 @Override protected void onResume(){super.onResume();visible=true;h.post(poller);}
 @Override protected void onPause(){visible=false;h.removeCallbacks(poller);super.onPause();}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null)return;if(request==21){java.util.ArrayList<String> r=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);if(r!=null&&!r.isEmpty())prompt.setText(r.get(0));}if(request==20){try(InputStream in=getContentResolver().openInputStream(data.getData())){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[1024];int n;while((n=in.read(b))!=-1){if(out.size()+n>8192)throw new IOException("Archivo demasiado grande.");out.write(b,0,n);}savePairing(out.toString("UTF-8"));}catch(Exception e){showError(e);}}}
}
