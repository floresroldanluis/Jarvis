package com.jarvis.assistant;
public class DeviceCommandTest {
 static void check(boolean condition){if(!condition)throw new AssertionError("Routing assertion failed");}
 public static void main(String[] args){check(DeviceCommand.parse("Jarvis, abre Chrome").action.equals("open"));check(DeviceCommand.parse("Abre Chrome en mi PC")==null);check(DeviceCommand.parse("Cierra mi Bloc de notas de mi pc")==null);check(DeviceCommand.parse("Abre WhatsApp en mi tablet").query.equals("whatsapp"));check(DeviceCommand.parse("Cierra esta aplicación").action.equals("close"));check(DeviceCommand.parse("Vuelve al inicio").action.equals("home"));check(DeviceCommand.parse("Atrás").action.equals("back"));check(DeviceCommand.parse("Muestra aplicaciones recientes").action.equals("recents"));check(DeviceCommand.parse("Abre Word y redacta una carta")==null);check(DeviceCommand.parse("Por qué no puedes cerrar una app")==null);System.out.println("Android device routing passed");}
}
