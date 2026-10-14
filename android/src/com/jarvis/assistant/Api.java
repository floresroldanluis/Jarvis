package com.jarvis.assistant;
import android.content.Context;
import org.json.*;
import java.net.*;
import java.io.*;
import java.security.*;
import java.security.cert.*;
import javax.net.ssl.*;
final class Api {
 static JSONObject request(Context c,String route,JSONObject body)throws Exception{
  JSONObject pairing=new JSONObject(PairingStore.read(c));URL base=new URL(pairing.getString("url"));
  if(!base.getProtocol().equals("https")||base.getUserInfo()!=null||!base.getPath().isEmpty())throw new Exception("La dirección de PC debe ser HTTPS sin ruta.");
  final String pin=pairing.getString("fingerprint").replace(":","").toLowerCase(java.util.Locale.ROOT);
  if(!pin.matches("[a-f0-9]{64}"))throw new Exception("Huella del certificado inválida.");
  TrustManager[] tm={new X509TrustManager(){public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}public void checkClientTrusted(X509Certificate[] chain,String type)throws CertificateException{throw new CertificateException("Unsupported");}public void checkServerTrusted(X509Certificate[] chain,String type)throws CertificateException{try{chain[0].checkValidity();byte[] hash=MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded());StringBuilder s=new StringBuilder();for(byte b:hash)s.append(String.format("%02x",b&255));if(!MessageDigest.isEqual(s.toString().getBytes("UTF-8"),pin.getBytes("UTF-8")))throw new CertificateException("El certificado no coincide con tu PC.");}catch(CertificateException e){throw e;}catch(Exception e){throw new CertificateException(e);}}}};
  SSLContext ssl=SSLContext.getInstance("TLS");ssl.init(null,tm,new SecureRandom());
  HttpsURLConnection conn=(HttpsURLConnection)new URL(base.toString()+route).openConnection();conn.setSSLSocketFactory(ssl.getSocketFactory());
  // Identity is the exact certificate pinned during local pairing, not a public DNS name.
  conn.setHostnameVerifier((h,s)->true);conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(10000);conn.setReadTimeout(20000);conn.setRequestProperty("Authorization","Bearer "+pairing.getString("token"));
  try{if(body!=null){conn.setRequestMethod("POST");conn.setDoOutput(true);conn.setRequestProperty("Content-Type","application/json");try(OutputStream out=conn.getOutputStream()){out.write(body.toString().getBytes("UTF-8"));}}
   int code=conn.getResponseCode();InputStream stream=code<400?conn.getInputStream():conn.getErrorStream();if(stream==null)throw new Exception("Respuesta de PC: "+code);ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=stream){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>2000000)throw new IOException("Respuesta demasiado grande");out.write(b,0,n);}}
   JSONObject result=new JSONObject(out.toString("UTF-8"));if(code<200||code>=300)throw new Exception(result.optString("error","Error "+code));return result;
  }finally{conn.disconnect();}
 }
}
