Documento de Requisitos del Producto (PRD)

Nombre del Proyecto: Sistema de Gestión de Alertas de Seguridad en Tiempo Real (Web & PWA)

Fecha: 14 de Junio de 2026

Estado: Borrador / Propuesta

Autor: Miguel Cuadros

1. Resumen Ejecutivo

El objetivo de este proyecto es desarrollar una solución integral de seguridad ciudadana compuesta por dos interfaces principales:

Una Progressive Web App (PWA) para ciudadanos, que les permita enviar alertas de emergencia de forma inmediata (botón de pánico) o registrar incidencias detalladas con evidencia fotográfica.

Una aplicación web para operadores y monitores de seguridad, que permita visualizar, en tiempo real, las alertas generadas por los ciudadanos mediante un panel de control (Dashboard) actualizado instantáneamente por WebSockets, incluyendo la visualización de la ubicación en un mapa interactivo.

2. Objetivos del Producto

Empoderamiento Ciudadano: Proveer una herramienta accesible (PWA) para que cualquier ciudadano registrado pueda reportar emergencias en un solo toque o registrar incidencias con detalles y pruebas.

Visibilidad en Tiempo Real: Reducir el tiempo de respuesta ante incidencias mostrando alertas a los operadores en el instante en que ocurren, sin necesidad de refrescar la página.

Precisión Geográfica y Temporal: Dotar a los operadores de la ubicación exacta (GPS) y del contexto temporal (fecha de envío vs. fecha del suceso).

Evidencia Multimedia: Permitir la captura y visualización de imágenes que respalden las incidencias reportadas (asaltos, reportes generales, etc.).

3. Historias de Usuario

3.1. Usuarios Ciudadanos (PWA)

Como ciudadano, quiero poder registrarme e iniciar sesión en la aplicación para que mis reportes estén asociados a mi identidad.

Como ciudadano en peligro, quiero presionar un botón rojo gigante de "Alerta" para enviar inmediatamente mi ubicación GPS y la fecha/hora actual como un reporte de emergencia.

Como ciudadano, quiero tener un botón secundario para "Registrar otra incidencia" para reportar eventos que no requieren el botón de pánico (ej. reporte, asalto, vandalismo).

Como ciudadano reportando una incidencia, quiero poder añadir una descripción, seleccionar la fecha del suceso (actual o pasada) y subir fotos desde mi cámara o galería para proveer evidencia al centro de control.

3.2. Operadores de Seguridad (Web Admin)

Como operador de seguridad, quiero iniciar sesión con mis credenciales para acceder de forma segura al panel de control.

Como operador de seguridad, quiero ver las alertas aparecer automáticamente mediante WebSockets para actuar con inmediatez.

Como operador, quiero que el listado incluya la "Fecha de Ingreso" (cuando se envió el reporte) y la "Fecha del Suceso" para entender el marco temporal de la alerta.

Como operador, quiero hacer clic en una alerta para abrir un modal con un mapa para ver la ubicación exacta del incidente.

4. Requisitos Funcionales

4.1. Módulo Ciudadano (PWA - Progressive Web App)

Autenticación: Flujo de Registro (Nombre, DNI, Email/Teléfono, Contraseña) y Login.

Pantalla Principal (Dashboard Ciudadano):

Botón de Pánico ("ALERTA"): Botón rojo, grande y accesible. Al presionarlo:

Captura la ubicación GPS actual.

Envía automáticamente el reporte catalogado como "Emergencia".

Establece la "Fecha del suceso" y "Fecha de ingreso" como el mismo instante actual.

Botón "Registrar otra incidencia": Ubicado debajo del botón de alerta. Abre un formulario detallado.

Formulario de Incidencia Detallada:

Selector de Tipo de Incidencia (Asalto, Reporte, Accidente, etc.).

Campo de texto para Descripción.

Selector de Fecha: Permite elegir la fecha actual o una fecha/hora anterior (Fecha del suceso).

Evidencia Fotográfica: Integración con la API del dispositivo para abrir la cámara o seleccionar fotos de la galería local.

Captura de ubicación GPS obligatoria al momento del envío.

4.2. Módulo de Panel de Control (Web Admin)

Recepción en Tiempo Real: Conexión vía WebSockets activa para recibir datos al instante.

Listado de Alertas: Tabla o tarjetas ordenadas de la más reciente a la más antigua (basado en la Fecha de Ingreso).

Campos Requeridos en el Listado:

DNI / Identidad del ciudadano.

Tipo de Incidencia (Emergencia, Asalto, Reporte, etc.).

Fecha de Ingreso: Fecha y hora en que el servidor recibió la alerta.

Fecha del Suceso: Fecha y hora en que ocurrió el evento (enviado por el usuario).

Ubicación: Coordenadas o dirección aproximada.

Acciones: Botones para "Ver Mapa" y "Ver Detalles/Evidencia".

Visualización Geográfica (Modal de Mapa):

Mapa centrado en la latitud/longitud de la alerta usando una librería gratuita.

Pin marcador en la ubicación exacta.

Visualización de Detalles:

Un modal o vista expandida que muestre la descripción escrita y las fotos subidas por el ciudadano.

5. Arquitectura y Stack Tecnológico Requerido

El proyecto debe desarrollarse estrictamente utilizando las siguientes tecnologías:

Frontend (Web Admin y PWA):

Framework: Angular.

Estilos: Tailwind CSS.

Mapas: Leaflet (vía ngx-leaflet o similar) junto con OpenStreetMap (Solución 100% gratuita).

PWA: Uso del módulo @angular/pwa para Service Workers, manifiesto de aplicación web y capacidades offline/instalación en móviles.

Backend:

Entorno/Servidor: Node.js con Express.

WebSockets: Socket.IO para la comunicación bidireccional y emisión de eventos de nuevas alertas en tiempo real.

Almacenamiento de Archivos: Las imágenes pueden subirse a un bucket (ej. AWS S3) o guardarse en el servidor, guardando las URLs en la base de datos.

Base de Datos:

Motor: PostgreSQL (Relacional, ideal para almacenar usuarios, roles, incidencias estructuradas y datos geoespaciales opcionalmente con PostGIS).

6. Criterios de Aceptación (Casos de Prueba Iniciales)

PWA - Botón de Emergencia: Un ciudadano presiona el botón rojo; el sistema solicita permisos de ubicación (si no los tiene), captura lat/lng, e inserta el registro en la base de datos con fechas idénticas para suceso e ingreso.

PWA - Incidencia con Evidencia: Un ciudadano llena el formulario de "otra incidencia", selecciona una fecha de ayer, sube una foto y envía. El sistema lo registra correctamente en PostgreSQL.

Admin - Recepción WebSocket: Inmediatamente después de que el ciudadano ejecuta el punto 1 o 2, la pantalla del operador (sin recargar) muestra la nueva fila en la parte superior de la tabla.

Admin - Mapa y Fechas: En el panel admin, la fila muestra correctamente la discrepancia entre "Fecha de Ingreso" y "Fecha del Suceso" para el caso 2. Al presionar "Ver Mapa", Leaflet renderiza el marcador en las coordenadas correctas sin costos de API (como los de Google Maps).

7. Guía de Ejecución para Asistente IA (Slicing y Fases de Desarrollo)

Instrucciones para la IA generadora de código: No intentes generar todo el proyecto en una sola respuesta. Sigue estrictamente este plan de "Slicing" (desarrollo vertical iterativo). Para cada "Slice", debes crear tanto la parte necesaria del backend como la del frontend. Espera la confirmación del usuario de que el Slice actual funciona antes de proceder al siguiente.

Slice 1: Arquitectura Base y Autenticación (Fundamentos)

Backend: Inicializar proyecto Node.js + Express. Configurar conexión a PostgreSQL. Crear el esquema de base de datos para Usuarios (id, dni, password_hash, rol). Crear endpoints REST para registro y login (/api/auth/register, /api/auth/login) usando JWT.

Frontend (Angular): Inicializar workspace de Angular. Configurar Tailwind CSS. Crear componentes básicos: LoginComponent y RegisterComponent. Configurar HttpClient e interceptores para inyectar el JWT. Configurar rutas iniciales y un AuthGuard.

Criterio de éxito: Un usuario puede registrarse e iniciar sesión; el frontend guarda el JWT y redirige a una ruta protegida vacía.

Slice 2: El Tablero de Control y la API de Alertas (CRUD Básico)

Backend: Crear esquema de base de datos para Alertas (id, user_id, tipo_incidencia, descripcion, latitud, longitud, fecha_ingreso, fecha_suceso, evidencia_url). Crear endpoint REST protegido para crear una alerta (POST /api/alertas) y otro para listar alertas recientes (GET /api/alertas).

Frontend (Admin): Crear componente AdminDashboardComponent. Implementar una tabla usando Tailwind que consuma el endpoint GET /api/alertas y muestre los datos estáticos, ordenados por fecha_ingreso descendente.

Criterio de éxito: Se pueden insertar alertas (usando Postman o un script) y el Admin Dashboard de Angular las muestra correctamente al recargar la página.

Slice 3: Tiempo Real con WebSockets (La Magia)

Backend: Integrar Socket.IO en el servidor Node.js. Modificar el endpoint POST /api/alertas para que, justo después de guardar en PostgreSQL, emita un evento Socket.IO (ej. nueva_alerta) con la data de la alerta a todos los clientes conectados en la sala de "operadores".

Frontend (Admin): Instalar cliente de Socket.IO en Angular. Crear un SocketService. Conectarse al WebSocket al cargar el AdminDashboardComponent. Escuchar el evento nueva_alerta e insertar el nuevo objeto al inicio del array de la tabla en tiempo real (sin refrescar).

Criterio de éxito: Al simular una inserción REST, la tabla del frontend de administrador se actualiza automáticamente al instante.

Slice 4: Módulo Ciudadano y Geolocalización (Botón de Pánico)

Frontend (PWA): Crear componente CitizenDashboardComponent. Diseñar el "Botón Rojo Gigante". Implementar el servicio de geolocalización usando el API nativo del navegador (navigator.geolocation). Al presionar el botón, capturar ubicación, setear fechas actuales y consumir el endpoint POST /api/alertas.

Backend: Asegurarse de que el endpoint maneje correctamente la petición y dispare el WebSocket del Slice 3.

Criterio de éxito: El ciudadano presiona el botón en su vista, acepta permisos de GPS, y la alerta aparece en la pantalla del Admin en tiempo real.

Slice 5: Reportes Detallados y Multimedia (Manejo de Archivos)

Backend: Configurar multer (o similar) en Express para aceptar subida de imágenes form-data en un nuevo endpoint o modificando el de creación de alertas. Guardar la imagen localmente (carpeta /uploads pública por ahora) y guardar la URL en la DB.

Frontend (PWA): Crear el formulario "Registrar otra incidencia". Añadir selector de fecha/hora (para fecha_suceso), campo de texto y un input file <input type="file" accept="image/*" capture="environment"> para cámara/galería. Enviar como FormData.

Frontend (Admin): Añadir botón "Ver Detalles" en la tabla para abrir un modal básico que muestre la descripción y la imagen reportada.

Slice 6: Mapas Interactivos (Geovisualización)

Frontend (Admin): Instalar leaflet y configurarlo en Angular. Crear un componente MapModalComponent. Al hacer clic en "Ver Mapa" en una fila del dashboard, abrir este modal, inicializar el mapa centrado en las coordenadas de esa fila y colocar un marcador.

Criterio de éxito: El operador ve el pin exacto del ciudadano sobre el mapa al interactuar con cualquier alerta.

Slice 7: PWA y Pulido Final

Frontend: Añadir @angular/pwa. Configurar el manifest.webmanifest (iconos, colores de tema, standalone mode). Asegurar que el Service Worker almacene en caché el shell de la app para tiempos de carga rápidos.

General: Revisión de validaciones de formularios, manejo de errores de red, refinamiento visual con Tailwind (responsividad en móviles para el ciudadano).