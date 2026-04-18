# Sistema de Seguimiento de Visitas Clínicas
**Fundación Scherbovsky — Mendoza, Argentina**
*Documento de diseño y especificaciones funcionales — Versión 1.0 — Abril 2026*

---

## 1. Contexto y diagnóstico

La Fundación Scherbovsky es un centro de investigación médica ubicado en Mendoza, Argentina, con aproximadamente 300 pacientes activos, especialización principal en el área respiratoria y en proceso de expansión hacia otras especialidades. El equipo está compuesto por coordinadores de estudios clínicos que gestionan actualmente alrededor de 30 protocolos activos.

El sistema actual de seguimiento se basa en planillas Excel individuales y registros en papel. Cada coordinador lleva su propio tracker sin un criterio unificado, lo que genera los siguientes problemas identificados:

- Ventanas de visita calculadas con fórmulas rotas o desactualizadas, sin alertas automáticas.
- Checklists de visita en papel abrochados a la hoja de ruta, susceptibles de perderse sin dejar registro digital.
- Reportes de laboratorio trackeados en planillas dispersas o directamente en el tracker personal de cada coordinador, sin criterio unificado.
- Sin vista centralizada del estado de todos los protocolos ni de la carga de trabajo por coordinador.
- Durante visitas de monitoreo del sponsor, el equipo debe revisar carpetas físicas una por una para verificar el estado de cada visita.
- El conocimiento operativo es personal, no institucional: si un coordinador falta, no hay forma simple de que otro cubra sus pacientes.

---

## 2. Solución propuesta

Se propone desarrollar una **web app centralizada** que reemplace los trackers individuales, accesible desde navegador en computadora y celular, sin necesidad de instalación. La arquitectura recomendada es:

- **Frontend:** React
- **Base de datos:** Supabase (gratuito para instituciones, escalable)
- **Hosting:** Vercel (gratuito, acceso por link compartido)

La app está diseñada para escalar desde el protocolo FLAIR hacia los 30 protocolos actuales y los que se incorporen en el futuro, sin necesidad de rediseño.

---

## 3. Estructura de pantallas

### 3.1 Dashboard general

Pantalla de entrada para todos los coordinadores. Muestra de un vistazo:

- Métricas globales: protocolos activos, pacientes activos, reportes de lab pendientes, ventanas por vencer.
- Panel de alertas que requieren acción inmediata.
- Agenda de visitas de la semana en todos los protocolos, con coordinador asignado.

### 3.2 Vista de protocolo — lista de pacientes

Pantalla con todos los pacientes de un protocolo, filtrable por coordinador. Cada fila muestra:

- ID del paciente.
- Estado general (Activo / Falla de selección).
- Chips de visita con estado visual por color y fecha incluida dentro del chip.

### 3.3 Detalle de paciente y visita

Al seleccionar un paciente se despliega el detalle con todas sus visitas. Al seleccionar una visita específica se muestra:

- Fecha estimada según protocolo y ventana de tolerancia.
- Fecha real de realización (si ya ocurrió).
- Checklist con estado de cada ítem y plazo correspondiente.
- Campo de aclaraciones o notas vinculado a esa visita específica, que queda guardado permanentemente.

---

## 4. Sistema de estados de visita

Cada visita tiene un estado representado visualmente mediante colores en el chip. Existen cinco estados posibles:

| Estado | Color | Significado |
|--------|-------|-------------|
| Futura | Gris | La visita todavía no corresponde según el cronograma del protocolo. |
| Próxima | Azul | La visita está dentro de los próximos 7 días. |
| Realizada | Verde claro + punto | El paciente vino. Checklist en progreso (ítems diferidos pendientes). |
| Realizada con ítems vencidos | Amarillo | La visita se realizó pero algún ítem venció sin completarse (ej: lab no archivado). |
| Completa | Verde sólido | Visita realizada y todos los ítems del checklist cerrados y archivados. |

El flujo natural de una visita sigue la secuencia:

**Futura → Próxima → Realizada → Completa**

Si los ítems de checklist comienzan a vencer sin completarse, el estado pasa de Realizada a Realizada con ítems vencidos (amarillo).

---

## 5. Chips de visita — diseño y formato

Cada visita se representa mediante un chip compacto que contiene:

- Identificador de la visita (ej: V1, CT2, V4) en texto de mayor tamaño.
- Fecha en formato `DD/MM/AA` dentro del mismo chip, en texto más pequeño.

**Regla de fecha mostrada en el chip:**
- Si la visita ya fue realizada → se muestra la **fecha real** en que ocurrió.
- Si la visita es futura o próxima → se muestra la **fecha estimada** según el protocolo.

En el detalle de la visita, las fechas se muestran en formato completo `DD/MM/AAAA`, incluyendo la fecha estimada, la ventana de tolerancia y la fecha real de realización.

Esta solución de año corto en el chip y año completo en el detalle permite manejar protocolos de larga duración (2-3 años o más) sin desbordar el espacio del chip ni perder legibilidad.

---

## 6. Tipos de visita

El sistema distingue dos tipos de visita con comportamientos diferentes:

- **V (visita presencial):** el paciente concurre físicamente al centro. Tiene checklist completo incluyendo documentación, medicación, EDC y laboratorio.
- **CT (contacto telefónico):** seguimiento realizado por teléfono. Tiene checklist reducido: contacto realizado, EDC completado, adherencia a medicación chequeada.

---

## 7. Checklist de visita

Cada visita tiene un checklist con ítems organizados por plazo de cumplimiento. Esta estructura reconoce que no todos los ítems se completan en el momento de la visita, sino que algunos tienen plazos diferidos.

| Plazo | Ítems incluidos |
|-------|----------------|
| Al momento de la visita | Consentimiento firmado (solo V1), medicación dispensada/devuelta, adherencia chequeada (CT), contacto telefónico realizado (CT). |
| Dentro de las 48 hs | EDC (sistema del sponsor) completado. |
| Hasta 7 días | Reporte de laboratorio recibido. Reporte archivado en el folio correspondiente de la carpeta física del paciente. |

Esta distinción de plazos es fundamental: una visita puede estar marcada como **realizada** pero no estar **completa** hasta que el último ítem diferido se cierre. El sistema trackea ambos estados de forma independiente.

El reporte de espirometría u otros estudios complementarios pueden sumarse al checklist según los requerimientos específicos de cada protocolo y visita.

---

## 8. Sistema de alertas

La app genera alertas automáticas visibles en el dashboard y en la vista de protocolo para los siguientes casos:

- Ítems de checklist con plazo vencido sin completar (especialmente reporte de lab no recibido o no archivado).
- Visitas con ventana por vencer en los próximos días.
- Visitas marcadas como realizadas con checklist incompleto por más tiempo del esperado.

---

## 9. Consideraciones de escalabilidad

El sistema está diseñado desde el inicio para crecer junto con la Fundación:

- Nuevos protocolos se incorporan con sus propias ventanas y checklists personalizados sin modificar la estructura base.
- Cada protocolo puede tener ítems de checklist distintos según los requisitos del sponsor.
- En el futuro se pueden agregar notificaciones por email o WhatsApp ante vencimientos.
- Se puede implementar un módulo de reportes pre-monitoreo que consolide el estado de todos los pacientes de un protocolo.
- Se pueden definir roles y permisos diferenciados (coordinador ve solo sus pacientes, dirección ve todo).
- Los datos pueden exportarse en formatos que requieran los sponsors.

---

## 10. Pendiente para completar el desarrollo

Para arrancar el desarrollo del código con datos reales del protocolo FLAIR se necesita:

- **Ventanas exactas del protocolo:** días entre cada visita y días de margen de cada una.
- **Checklist detallado por visita:** qué ítems corresponden a cada V y CT específicamente.

Una vez definidos estos datos, el sistema puede construirse con información real desde el primer día, evitando correcciones posteriores.
