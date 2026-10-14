package com.jarvis.assistant;
import android.content.*;
import android.security.keystore.*;
import android.util.Base64;
import java.security.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
final class PairingStore {
 static void save(Context c,String text)throws Exception{
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias("jarvis-pairing")){KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder("jarvis-pairing",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,ks.getKey("jarvis-pairing",null));
  c.getSharedPreferences("jarvis",0).edit().putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).putString("pairing",Base64.encodeToString(cipher.doFinal(text.getBytes("UTF-8")),Base64.NO_WRAP)).apply();
 }
 static String read(Context c)throws Exception{
  android.content.SharedPreferences p=c.getSharedPreferences("jarvis",0);String encrypted=p.getString("pairing","");if(encrypted.isEmpty())throw new Exception("Primero vincula la PC en esta pantalla.");
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,ks.getKey("jarvis-pairing",null),new GCMParameterSpec(128,Base64.decode(p.getString("iv",""),Base64.NO_WRAP)));return new String(cipher.doFinal(Base64.decode(encrypted,Base64.NO_WRAP)),"UTF-8");
 }
}
