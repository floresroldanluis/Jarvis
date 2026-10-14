package com.jarvis.assistant;
import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
public class DeviceAccessService extends AccessibilityService {
 static volatile DeviceAccessService current;static volatile String foregroundPackage="";
 @Override protected void onServiceConnected(){current=this;}
 @Override public void onAccessibilityEvent(AccessibilityEvent event){if(event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED&&event.getPackageName()!=null)foregroundPackage=event.getPackageName().toString();}
 @Override public void onInterrupt(){}
 @Override public void onDestroy(){if(current==this)current=null;foregroundPackage="";super.onDestroy();}
}
