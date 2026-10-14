package com.jarvis.assistant;
import java.util.regex.*;
final class VoiceTrigger {
 static final Pattern WAKE=Pattern.compile("^\\s*(?:hola[\\s,!.:;]+)?jarvis\\b[\\s,!.:;\u2014-]*(.*)$",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE|Pattern.DOTALL);
 long armedUntil=0;
 static final class Result {final String kind,text;Result(String k,String t){kind=k;text=t;}}
 Result accept(String raw,float confidence,long now){String text=raw==null?"":raw.trim();if(text.isEmpty())return new Result("ignore","");Matcher wake=WAKE.matcher(text);boolean named=wake.matches();if(!named&&now>=armedUntil)return new Result("ignore","");if(confidence>=0&&confidence<0.55f){armedUntil=0;return new Result("review",text);}String command=named?wake.group(1).trim():text;armedUntil=0;if(command.isEmpty()){armedUntil=now+15000;return new Result("arm","");}return new Result("command",command);}
 void extend(long now){if(armedUntil>now)armedUntil=now+15000;else armedUntil=0;}
 static String manual(String text){String value=text==null?"":text.trim();Matcher wake=WAKE.matcher(value);return wake.matches()?wake.group(1).trim():value;}
}
