# JARVIS OS

Aplicación personal para Windows, por voz o texto, con Codex y tu sesión de ChatGPT. Se usa desde el navegador en http://127.0.0.1:4317 y admite instalación como aplicación web en Chrome o Edge. El servidor local debe estar encendido. No está publicada en Internet.

## Abrir

Haz doble clic en **Abrir JARVIS.cmd**. También puedes ejecutar `npm start`. Necesita Node.js y Codex CLI autenticado; ambos están verificados en este equipo. No usa una clave API adicional y consume los límites de tu plan Codex. Si copias la carpeta, ejecuta `npm install` para instalar Nodemailer.

## Hablar o escribir

**JARVIS decide** es el modo predeterminado. Escribe o pulsa **Hablar con JARVIS**. Una pausa de aproximadamente 1,7 segundos termina el dictado y envía la solicitud si Windows lo reconoce con suficiente confianza. También puedes pulsar otra vez para terminar. La grabación dura como máximo 45 segundos. Los dictados poco claros se dejan en el cuadro para revisar y enviar. Además del dictado manual, hay escucha continua local por la palabra Jarvis, descrita a continuación.

Ejemplos:

- Redacta un documento Word con una carta para solicitar una reunión con mi proveedor.
- Prepara un correo para ana@ejemplo.com avisando que entregaré el informe mañana.
- Recuerda que prefiero correos breves y un tono profesional.
- Abre la calculadora.
- Crea una plantilla de presupuesto en mi espacio de trabajo.

JARVIS redacta documentos Word reales, prepara correos, guarda notas, abre las aplicaciones admitidas o ejecuta tareas técnicas con Codex. Si falta un dato esencial, pregunta. **Solo conversar** responde sin ejecutar tareas.

## Conectar Gmail una vez

1. Activa la verificación en dos pasos en Google.
2. Crea una contraseña de aplicación en https://myaccount.google.com/apppasswords. Algunas cuentas de empresa o con Protección Avanzada no ofrecen esta opción.
3. Abre **Ajustes → Conectar mi correo**. Usa tu Gmail, servidor `smtp.gmail.com`, puerto 465 y la contraseña de aplicación. No uses tu contraseña habitual.
4. Pulsa **Conectar y verificar**. La conexión solo se guarda si la autenticación funciona. La credencial se cifra con Windows DPAPI para tu usuario; no se envía a Codex ni aparece en diagnósticos.

JARVIS redacta el correo en una tarjeta editable. Revisa destinatario, asunto y mensaje; pulsa **Enviar correo** o, con un único borrador pendiente, di **envíalo**. Enviado significa que el servidor SMTP aceptó el mensaje, no que la persona lo leyó. El envío necesita conectar una cuenta real. No se enviaron correos externos durante las pruebas. Los adjuntos no están implementados.

Guarda contactos en **Ajustes → Mis contactos**, con una línea por persona: `Ana = ana@ejemplo.com`. Así puedes pedir un correo usando su nombre. JARVIS no inventa direcciones.

## Datos y archivos

- `memory/`: notas Markdown, compatibles con una bóveda de Obsidian.
- `workspace/`: documentos Word y otros archivos generados, descargables desde **Archivos**.
- `data/`: historial, ajustes, borradores y credenciales cifradas. No publiques esta carpeta.

Los DOCX se generan con el Python y python-docx del runtime de Codex. Para otra instalación, define `JARVIS_PYTHON_PATH`. Para otra instalación de Codex, define `JARVIS_CODEX_PATH` apuntando a su archivo `bin/codex.js`.

## Capacidades

El audio, la memoria y la interfaz son locales. Codex procesa tus solicitudes y las notas incluidas en la nube. Las tareas técnicas escriben en `workspace/` usando el sandbox de Codex. **Detener** finaliza la tarea activa y conserva lo ya escrito.

Los conectores de Codex devolvieron un error 403 desde el cliente independiente; el correo usa una conexión SMTP propia. No están conectados calendario, WhatsApp ni automatización general de escritorio. JARVIS no promete tareas para las que faltan herramientas o permisos.

Ollama sigue disponible en Ajustes si está instalado en 127.0.0.1:11434. Conversa si tienes un modelo instalado; el control local de abrir/cerrar apps funciona también sin invocar Codex. No se instaló ni verificó un modelo local.

## Verificación

`npm test` verifica rutas, contexto, destinatarios y envío a un servidor SMTP de prueba exclusivamente local. Se verificaron generación de DOCX por petición natural, renderizado de una página en Microsoft Word, memoria, borrador de correo, bloqueo de envío sin conexión, voz local y descargas. El micrófono requiere permiso del navegador y una prueba con tu voz; su precisión depende del reconocedor de Windows.

Fuentes: https://learn.chatgpt.com/docs/non-interactive-mode, https://support.google.com/accounts/answer/185833, https://nodemailer.com/smtp.


## Escucha continua por nombre

La escucha continua está activada por defecto según la petición del usuario. Usa el micrófono predeterminado de Windows y espera a que comiences con **Jarvis**. Puedes decir “Jarvis, ayúdame a redactar una carta” en una frase, o decir “Jarvis”, esperar el aviso sonoro y formular la petición en los siguientes 15 segundos.

El micrófono se procesa localmente con System.Speech. No se guardan grabaciones del modo continuo ni se envía audio a Codex. Solo una petición reconocida tras la activación se envía al motor. Las peticiones poco claras se muestran para revisión. La precisión depende del reconocimiento de voz de Windows.

El indicador Micrófono activo muestra el estado real del proceso. **Pausar escucha** o “Jarvis, deja de escuchar” detiene el micrófono. Para volver a activarlo usa **Activar escucha**. La preferencia se recuerda al reiniciar JARVIS. El dictado manual sigue disponible cuando la escucha continua está pausada.

Funciona aunque cierres o minimices el navegador, mientras el servidor JARVIS y la computadora estén encendidos y Windows permita usar el micrófono. No funciona con el equipo suspendido o apagado. Install-Windows.ps1 permite registrarlo al iniciar tu sesión de Windows.

También lee respuestas por los altavoces de Windows sin depender del navegador. Mientras reproduce su voz, suspende el reconocimiento y descarta audio de ese intervalo para evitar que sus propias respuestas se conviertan en órdenes. Después vuelve a esperar su nombre.

Mientras trabaja puede recibir hasta cinco peticiones adicionales en cola. “Jarvis, detente” solicita detener la tarea y vacía la cola. La pausa del micrófono es independiente de la cancelación de tareas.

## Windows: inicio de sesión y segundo plano

Ejecuta `Install-Windows.ps1` una vez. Registra el inicio automático para tu usuario y un acceso en Inicio > JARVIS OS. El servidor y el micrófono funcionan con la ventana cerrada; Windows debe estar encendido, despierto y con tu sesión iniciada. El registro apunta a esta carpeta: no la muevas. `Unregister-Windows.ps1` desactiva el arranque automático sin borrar datos. Pausar escucha se conserva entre reinicios.

## Versiones de GitHub

En Ajustes > Versiones y actualizaciones indica `usuario/repositorio`. Se consulta la última Release pública al arrancar y cada seis horas con el servidor activo. El botón permite consultar en cualquier momento. El instalador de Windows solo acepta publicaciones de floresroldanluis/Jarvis. Si hay una versión superior se ofrece su publicación. **Actualizar ahora** descarga la versión oficial, verifica SHA256, prepara las dependencias y reinicia el servidor conservando datos, memoria y documentos. También puedes ejecutar Update-Windows.ps1. La copia anterior queda en data/update-*/backup y se restaura si falla el arranque. La instalación se inicia al pulsar el botón; no se aplican cambios silenciosos mientras trabajas. Un repositorio privado necesita un canal de distribución autenticado que aún no está implementado; nunca introduzcas tokens en este campo.

El workflow `.github/workflows/release.yml` prueba la app y genera ZIP + SHA256 al subir una etiqueta `vX.Y.Z` que coincida con package.json. No subas `data/`, `memory/`, `workspace/`, archivos `.env` ni credenciales. GitHub aloja el código y las publicaciones; GitHub Pages no ejecuta este servidor Windows.

## Android: celular y tablet

APK inicial: `downloads/JARVIS-Android-1.2.1.apk` (firmada para desarrollo). Admite Android 8 o posterior; la escucha local experimental requiere Android 12 o posterior con reconocimiento de español local disponible. La APK se compiló y su firma se verificó; todavía no se ha probado en un dispositivo real.

1. Instala la APK en Android usando el instalador del sistema.
2. En la PC abre Ajustes > Conectar Android y pulsa Activar conexión móvil.
3. Descarga el archivo de vinculación y transfiérelo al teléfono por un medio privado, por ejemplo USB. Contiene una credencial de acceso; no lo subas a GitHub.
4. Abre JARVIS en Android, pulsa Importar archivo de vinculación y selecciona el JSON.
5. Ambos equipos deben estar en la misma Wi-Fi o VPN privada. El puente usa HTTPS 4318, certificado fijado y token aleatorio; no admite direcciones públicas ni peticiones web con Origin. El puerto local 4317 sigue restringido a la PC.
6. Si Windows bloquea 4318, permite el servidor Node únicamente en red privada desde el diálogo del sistema. No abras puertos en tu router.
7. Puedes escribir y pulsar Enviar, o usar Hablar y enviar para mandar el dictado al terminar. Para escuchar al usar otras apps pulsa Activar escucha en segundo plano y concede micrófono y notificaciones. Empieza con Hola Jarvis o Jarvis. Pausa desde la app o la notificación.

La escucha Android es experimental: el servicio de reconocimiento del equipo puede detenerla, consumir batería o no disponer del idioma local. No garantiza funcionamiento sin interrupciones con la pantalla bloqueada. No se inicia sola al reiniciar el teléfono: abre la app y actívala. Por defecto se intenta solo reconocimiento local. Si autorizas la opción de reconocimiento del sistema, su proveedor puede procesar audio usando Internet, incluso antes de decir la frase de activación. El dictado manual usa el proveedor configurado en Android y puede emplear Internet.

La PC ejecuta los pedidos y debe permanecer encendida, despierta y conectada. La APK ejecuta localmente los pedidos de abrir apps y navegación de Android. Los documentos, correos y consultas a Codex siguen requiriendo la PC vinculada. No descarga todavía los documentos generados dentro de la app (están en la PC).

La vinculación se cifra con Android Keystore; el respaldo de la app está deshabilitado. Desactiva el puente desde la PC para cortar el acceso. Para revocar definitivamente un código: desactiva el puente, cierra el servidor JARVIS, elimina exclusivamente `data/mobile.json` y vuelve a abrir JARVIS antes de activar el puente. Eso cambia el token y el certificado.

### Compilar Android

Usa `android/Build-Android.ps1` con JAVA_HOME (JDK 17), ANDROID_HOME, Android SDK plataforma 35 y build-tools 36.0.0. Genera la APK en `data/JARVIS-Android.apk`. Conserva de forma privada `data/android-development.jks`: las actualizaciones Android deben firmarse con la misma clave. No se incluye esta clave en GitHub. Para distribución de producción hace falta configurar una clave de lanzamiento privada y probar los dispositivos objetivo. La app consulta versiones al abrirse y cada seis horas mientras la escucha esté activa; avisa si hay una APK superior. También ofrece acceso a las versiones en GitHub; instalar una APK nueva requiere la acción del usuario en Android.


## Perfil y aprendizaje personal (1.1.0)

La primera vez JARVIS pregunta cómo te llamas. Contesta «Me llamo Luis» o guarda tu nombre en Ajustes > Mi perfil y aprendizaje. El perfil es compartido por la PC y sus Android vinculados.

- «Prefiero respuestas breves»: guarda una preferencia explícita.
- «Corrección: en mis cartas usa un saludo formal»: guarda una corrección para tareas pertinentes.
- «Eso está mal»: pregunta qué debe cambiar, sin inventar una regla.
- «Eso está bien»: guarda tu valoración de la tarea anterior.
- «¿Qué recuerdas de mí?»: muestra tu nombre y los aprendizajes guardados.
- «Olvida mi perfil»: borra tu nombre y estos aprendizajes, conservando notas Markdown e historial.

En cada respuesta puedes pulsar Me sirvió o abrir Corregir para la próxima vez y describir el cambio. Ajustes permite editar tu nombre, pausar el aprendizaje y eliminar recuerdos individuales. Al pausarlo, las preferencias guardadas dejan de incluirse en las consultas; tu nombre se conserva. Pausar no borra notas Markdown ni historial de conversación.

Los intentos fallidos se registran como evidencia pendiente de revisar; un fallo no se trata como una corrección confirmada ni una tarea exitosa. Se conservan hasta 100 aprendizajes y los 30 más recientes se incluyen como contexto del motor. Las correcciones más recientes tienen prioridad para el mismo tema y la solicitud actual puede indicar una excepción. Los archivos, correos y páginas no se convierten automáticamente en reglas. No se guardan claves reconocibles como aprendizajes.

El perfil se guarda únicamente en `data/personal-memory.json`, excluido de GitHub. Al usar Codex, el perfil y los recuerdos incluidos se envían como contexto de esa consulta. Es memoria de preferencias y resultados: no reentrena el modelo, no cambia su código ni amplía permisos. Los aprendizajes se conservan al reiniciar y actualizar Windows.

## Control de aplicaciones y dispositivo (1.2.0)

### Windows

Puedes pedir «Jarvis, abre Word», «cierra mi Bloc de notas de mi PC» o «abre Google Chrome». Las peticiones simples se resuelven localmente sin llamar al modelo; las compuestas también pueden usar las acciones open/close del planificador. Solo conversar conserva su significado: no ejecuta estas acciones.

JARVIS consulta el catálogo del menú Inicio del usuario y resuelve nombres exactos o coincidencias únicas. Si hay varias, pide precisar el nombre. Para cerrar identifica ventanas de la misma sesión y, para aplicaciones genéricas, comprueba el ejecutable registrado. Solicita el cierre normal, sin matar procesos ni responder a diálogos de guardado. Si quedan ventanas, informa de cierre pendiente; no afirma haber cerrado. Aplicaciones elevadas o sin un ejecutable identificable pueden no admitir cierre desde este agente. No se han ampliado los permisos del sandbox de las tareas generales de Codex.

### Android y tablet

Instala JARVIS-Android-1.2.1.apk sobre la anterior; usa la misma clave de firma y conserva la vinculación. Las solicitudes de apps sin destino explícito se resuelven en ese Android, por texto o voz: «abre Chrome», «abre Gmail», «vuelve al inicio», «atrás», «muestra aplicaciones recientes». Añade «en mi PC» o «de mi PC» para enviarlas a la computadora vinculada. El control local puede usarse sin vincular una PC; las otras tareas siguen necesitándola.

Para inicio/atrás/recientes y apertura desde la escucha en segundo plano, pulsa Habilitar control del dispositivo en JARVIS, lee la explicación y activa tú el servicio JARVIS en Accesibilidad de Android. La aplicación no activa permisos por sí misma. El servicio solo observa cambios de app en primer plano y usa acciones globales; no lee textos de pantallas, no obtiene capturas ni pulsa controles de otras apps. Puedes desactivarlo en los ajustes del sistema.

«Cierra esta aplicación» o «cierra [app en primer plano]» vuelve al inicio mediante accesibilidad. JARVIS lo describe como salir de la app, que puede seguir en segundo plano. No fuerza la detención de apps de terceros, no requiere root y no promete control administrativo total. Si la app indicada no está al frente, informa ese hecho y no actúa sobre otra. Android puede impedir aperturas desde el fondo o con pantalla bloqueada; en ese caso informa del límite.

Se verificaron el catálogo real de Windows, el protocolo y cierre con procesos simulados, el enrutamiento Java y la compilación/firma Android. No se cerraron ventanas del usuario durante las pruebas. Falta validar apertura y accesibilidad en los dispositivos Android físicos.

## Corrección de voz Android (1.2.1)

- La escucha reconoce «Hola Jarvis, [pedido]» y conserva «Jarvis, [pedido]». Un saludo solo responde Te escucho y abre una ventana de 15 segundos para decir la petición sin repetir el nombre. La frase de activación debe estar al principio; una mención de Jarvis dentro de una conversación no ejecuta nada.
- Hablar y enviar remite el resultado del dictado automáticamente a la acción local o a la PC vinculada. Ya no lo deja únicamente escrito. El botón implica una petición explícita, por lo que no exige repetir la frase de activación. Cancelar el dictado no envía nada. El micrófono del teclado es independiente y no se trata automáticamente como una petición.
- El dictado manual suspende temporalmente la escucha del servicio para que ambos no disputen el micrófono, y la reanuda si estaba activa. Conserva ese estado al recrearse la actividad.
- La escucha se reanuda al abrir JARVIS si estaba habilitada y ya tiene micrófono y notificaciones autorizados. Pausar se conserva y evita esa reanudación automática. Tras reiniciar el teléfono debes abrir JARVIS; no se inicia un micrófono desde BOOT_COMPLETED.
- Los errores temporales del proveedor se reintentan con espera creciente, sin detenerse después de cinco errores. Un vigilante recupera sesiones sin respuesta y una lectura de voz que no termine. Mientras JARVIS habla pausa el micrófono para evitar escucharse a sí mismo.
- La pantalla y la notificación muestran el estado. El último pedido mostrado corresponde a una activación; el habla que no activa JARVIS no se guarda como conversación ni se envía a la PC.
- Si falta reconocimiento local o español sin conexión, la app muestra el motivo. Puedes instalar español para el proveedor local o, voluntariamente, habilitar Permitir reconocimiento del sistema si falta el local. Esta opción puede enviar audio al proveedor y requiere Internet; está deshabilitada por defecto. Si un motor local existe pero no admite español, la alternativa solo se prueba si autorizaste esa opción.

La API de reconocimiento de Android no garantiza escucha ininterrumpida y no está diseñada como motor permanente de hotword. El ahorro de batería, micrófonos usados por otras apps, bloqueo y servicios del fabricante pueden suspenderla. Estas correcciones se comprobaron con pruebas de activación, envío/enrutamiento y compilación/firma; falta validarlas con el micrófono del dispositivo físico del usuario. No se afirma funcionamiento 24/7 en todos los dispositivos.

Mientras la escucha está activa, el servicio solicita un bloqueo parcial de CPU con vencimiento y renovación para reducir suspensiones al apagar la pantalla. Lo libera al pausar, durante el dictado externo y al destruirse. Solicita además recuperación de servicio por Android si su proceso termina, respetando la preferencia de pausa. Estas medidas no impiden que el fabricante o un cierre forzado del usuario lo detengan y consumen batería.
