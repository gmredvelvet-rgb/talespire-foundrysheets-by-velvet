# Changelog — Talespire Foundry Sheets by Velvet

## 1.0.0 — Nuevo módulo

- Separado de «Stoneshard Sheet PF2e & 5e - By Fatmorbus» 3.5.2 con el identificador `talespire-foundrysheets-by-velvet`.
- Migración automática (una vez, al entrar un DJ): copia las banderas de cada actor y su hoja elegida desde el identificador antiguo, sin borrar nada.
- Los tamaños de inventario guardados con el identificador antiguo se siguen leyendo.
- Los ajustes del módulo empiezan con sus valores por defecto.
- Soft gate de licencia de la familia Velvet (`scripts/license/`): ninguna función se bloquea; sin licencia solo aparece el recordatorio de prueba gratuita. Con Velvet License Hub activo, la licencia la gestiona el hub.
- Traducción al inglés de la tarjeta de licencia.

_Historial heredado de la hoja de Fatmorbus:_

## 3.5.2 — Symbiote Optimized reorganizado

- El modo `Symbiote Optimized` ya no recorta la hoja Stoneshard: pasa a una sola columna de 520 px.
- El raíl se convierte en barra superior (nivel, nombre, acciones rápidas y pestañas en 4×2).
- El retrato queda como banda; con el paperdoll crece lo justo para mostrarlo completo.
- El panel ocupa todo el ancho y la grilla de inventario ajusta el tamaño de celda para entrar entera.
- La columna única se activa sola dentro de TaleSpire (`TALESPIRE_COMPAT` o API `TS`), con viewport menor de 900 px o ventana menor de 760 px; además la ventana se ajusta al ancho del panel (~599 px), porque el ajuste es por cliente y TaleSpire seguía en Standard a 1040 px.
- Las pestañas, el paperdoll, los filtros y la búsqueda funcionan aunque el usuario no sea dueño del actor (Foundry desactivaba todos los botones de la hoja).
- Sin `:has()` ni unidades `cqi`, para funcionar en el navegador integrado de TaleSpire.
- D&D 5e recibe lo mismo: nuevo ajuste de cliente `Diseño de hoja 5e` (Standard / Symbiote Optimized), detección automática de TaleSpire, ajuste de la ventana al panel y navegación para usuarios que no son dueños del actor.

## 3.5.0 — Hoja Stoneshard completa para PF2e

- Reemplaza el tema sobre la hoja oficial por la interfaz Stoneshard real.
- PF2e usa la misma plantilla, assets, paper doll y diseño de tres columnas que D&D 5e.
- Conecta estadísticas, tiradas, strikes, conjuros, dotes, acciones, inventario y efectos a PF2e.

## 3.4.2 — Registro de hoja PF2e corregido

- Registra Stoneshard después de que PF2e haya creado su hoja oficial, por lo que ahora aparece en la configuración de hoja de personaje.
- Añade un reintento seguro al terminar de cargar Foundry si otro módulo altera el orden de inicialización.
- Evita heredar por accidente de hojas alternativas como Velvet PF2e.
- La hoja queda disponible para elegir sin reemplazar automáticamente la hoja predeterminada actual.

## 3.4.1 — Elemental Blasts e impulsos cinéticos

- `Elemental Blast` ahora aparece como categoría propia dentro de Actions en `Symbiote Optimized`.
- Conserva los ataques cuerpo a cuerpo y a distancia, MAP, selección de daño, daño normal y crítico preparados por PF2e.
- Los feats y actions con traits `impulse`, `infusion`, `kineticist` u `overflow` se agrupan en `Impulses & Kinetic Actions`.
- Las acciones especiales se mueven después de renderizarse, sin duplicarlas ni sustituir sus listeners nativos.
- Elemental Blasts, ataques e impulsos comienzan expandidos y participan en la búsqueda de Actions.

## 3.4.0 — Modo Symbiote Optimized para PF2e

- Añadida una tercera opción de diseño: `Symbiote Optimized (TaleSpire)`.
- Mantiene intactos los modos `Standard` y `VN Enhanced` existentes.
- Actions muestra de forma clara las categorías nativas Encounter, Exploration y Downtime.
- Actions, Feats, Inventory y Spells incluyen buscador, secciones plegables y controles para expandir o contraer todo.
- El estado de cada sección se recuerda durante la sesión y por personaje.
- Las listas, strikes, conjuros, feats e inventario se adaptan a 440 px sin perder los listeners ni las automatizaciones nativas de PF2e.

## 3.3.0 — Compatibilidad PF2e y modo VN Enhanced

- Añadida una hoja para personajes de Pathfinder 2e basada directamente en la hoja oficial de PF2e 8.5.1.
- Conserva acciones, strikes, daño, inventario, hechizos, crafting, feats, efectos, drag-and-drop y automatizaciones nativas de PF2e.
- Añadido el ajuste de cliente `Diseño de hoja PF2e` con los modos `Standard` y `VN Enhanced (TaleSpire)`.
- El modo VN Enhanced reorganiza la hoja a una sola columna de 440 px y evita recortes laterales en el Symbiote de TaleSpire.
- La implementación 5e queda aislada y ya no ejecuta sus hooks dentro de mundos PF2e.

## 3.2.0 — Hoja personalizada solo para personajes

- La hoja Stoneshard continúa disponible exclusivamente para actores
  `character`, sin alterar su diseño ni sus funciones de la versión 3.1.0.
- Retirada la hoja personalizada de objetos: armas, armaduras, consumibles,
  conjuros y demás documentos vuelven a sus hojas Vanilla de D&D 5e.
- PNJ, vehículos y grupos permanecen completamente Vanilla; el módulo ya no
  añade controles de ventana a sus cabeceras.
- La separación de ventana se conserva únicamente en personajes que estén
  usando la hoja Stoneshard.

## 3.1.0 — Tamaños reales de los compendios Stoneshard 5e

- La grilla ahora lee `inventorySize` de Stoneshard Items 5e en vez de
  recalcular esos objetos únicamente por peso.
- Food & Drink 5e obtiene automáticamente su huella `1×1`, `1×2`, `2×1`,
  `2×2` o `3×3` desde el lienzo original del PNG.
- Las huellas exactas de ambos compendios se respetan aunque el cálculo por
  peso para objetos 5e genéricos esté desactivado.
- Armas largas, arcos y armaduras quedan encerrados en el rectángulo que
  ocupan; ninguna imagen conserva su tamaño nativo ni invade otras casillas.
- El arrastre, la silueta de destino, las colisiones y la recolocación usan el
  mismo tamaño exacto que se muestra en pantalla.

## 3.0.0 — Mejoras Shadowdark adaptadas a D&D 5e y Foundry 14

- Nuevo tablero de equipo escalable, con cinco cartucheras y ranura 5e de arma
  a distancia conservada.
- Retrato encuadrable con ratón; el inventario mantiene visible el paperdoll.
- El conjunto de Combat Hub muestra su número activo.
- Resumen de armas conectado a Activities para usar los modificadores reales
  ya preparados por D&D 5e.
- Operaciones con las cinco denominaciones 5e, entrega entre jugadores por DJ
  activo y conversión limitada a escenas autorizadas.
- Administración completa de efectos desde la ficha.
- Hoja grimdark para objetos físicos con Resumen primero y las pestañas
  nativas de Detalles, Actividades, Descripción y Efectos preservadas.
- Separación nativa de ventanas en Foundry 14 para personaje Stoneshard y PNJ
  Vanilla, con respaldo compatible en Foundry 13.
- Manifest actualizado a Foundry 13/14 y D&D 5e 4.0–5.2.5.

## 2.6.0 — Cinturón de cuatro cartucheras, y arrastrar fuera de la hoja

### Ya se puede arrastrar al directorio de objetos y a los compendios
Era un fallo mío de la versión anterior: al empezar a arrastrar se marcaba el
gesto como **«solo mover»**, y el directorio de objetos, los compendios y la
barra de macros piden **«copiar»** al pasar por encima. Cuando el origen no lo
permite, el navegador cancela el soltado sin avisar — de ahí que no pasara
nada. Ahora se marca como «copiar o mover», así que vale para todo: sacar un
objeto de la hoja, guardarlo en un compendio o llevar un conjuro a la barra de
macros.

De paso, al soltar **dentro** de la hoja algo que venga de un compendio se
respeta su modo de copia, y las ranuras que **no admiten** lo que arrastras se
ponen en rojo en vez de dejarte soltar sin efecto.

### El cinturón pasa a ser cuatro cartucheras
En vez de una sola ranura suelta abajo, el cinturón es ahora una **fila de
cuatro casillas centradas**, en su propio renglón entre el cuerpo y las armas,
numeradas del 1 al 4.

Admiten **pociones, venenos, pergaminos** y demás consumibles de un solo uso,
más bagatelas con carga como varitas o piedras rúnicas. La **munición no**: se
gestiona sola y llenaría el cinturón sin aportar nada.

Lo que pongas ahí queda equipado, y por eso **aparece solo en el menú de
objetos del Combat Hub**, listo para usar en combate sin abrir la hoja.

Si ya tenías algo en el cinturón antiguo, **no se pierde**: al abrir la hoja
pasa solo a la primera cartuchera libre.

## 2.5.0 — El inventario entra entero, y los objetos ocupan sitio

### La grilla ya no se sale del panel
La celda era fija de 52 px, así que con nueve columnas el inventario se salía
por la derecha y quedaban objetos fuera de vista. Ahora el tamaño de celda es
una variable que se ajusta al ancho disponible al abrir la hoja y cada vez que
la redimensionas: **la grilla siempre entra entera**. No baja de 28 px ni sube
de los 52 originales.

### Apilar y desapilar, como Item Piles
- **Suelta un montón encima de otro igual** y se funden. Mientras arrastras, el
  montón destino se marca en verde.
- **Dividir pila…** (clic derecho) pregunta cuántas unidades separar y crea un
  montón nuevo con ellas.
- **Juntar pilas** reúne de una vez todos los montones equivalentes del
  inventario, con el número entre paréntesis.

No se apilan objetos **equipados**, **sintonizados** ni con **cargas ya
gastadas**: fundirlos regalaría o robaría usos, y un objeto sintonizado es
*ese* objeto, no uno más del montón.

### Objetos voluminosos (opción de mundo, apagada por defecto)
Dos ajustes nuevos en la configuración del módulo, que afectan a todos los
jugadores:

- **Objetos voluminosos ocupan varios cuadros** — cada objeto ocupa cuadros
  según su peso: una daga 1×1, una espada larga 1×2, un espadón o un escudo
  2×2, una ballesta pesada 2×3, una cota de malla 3×3. Cuenta el peso *por
  unidad*, así que cuarenta flechas siguen cabiendo en un cuadro. Las armaduras
  medias y pesadas, los escudos, los contenedores y las armas a dos manos
  tienen un mínimo propio, porque son aparatosos aunque pesen poco.
- **Tamaño de la mochila según la carga** — el inventario tendrá tantos cuadros
  como libras pueda cargar el personaje.

Al arrastrar se dibuja la **silueta del hueco** con el tamaño real del objeto, y
se pone roja si no cabe. Un objeto se intercambia con otro del mismo tamaño; si
estorba a varios, estos se sueltan y se recolocan solos.

### Ranuras de equipo más grandes y con dibujo propio
Las ranuras del paperdoll pasan de 56 a **72 px**, y cada una lleva su propio
dibujo a línea (yelmo, coraza, manoplas, botas, amuleto, capa, dos anillos
distintos, cinturón, espada, escudo y arco) en vez de un icono de fuente, que a
ese tamaño se veía blando.

### El botón de conjunto de equipo responde al momento
Tenía retraso por tres motivos, los tres arreglados: el primer clic pagaba la
carga del Combat Hub (ahora se precarga al entrar al mundo), no pasaba nada
visible hasta que terminaba (ahora el icono gira desde el primer instante), y
se redibujaba la hoja dos veces (la actualización del actor ya la redibuja).
Pulsarlo dos veces seguidas ya no se salta un conjunto.

### Además
- Había **dos métodos `close`** y el segundo pisaba al primero, así que al
  cerrar la hoja quedaban vivos el menú contextual y el observador de tamaño.
  Ahora la limpieza está en un solo sitio.

## 2.4.0 — Los rasgos, como un árbol de habilidades

La pestaña de Rasgos deja de ser dos listas («activos» y «pasivos») y pasa a
ser una **escalera de niveles del 1 al 20**, con su carril y un nodo por nivel:

- Los niveles **alcanzados** llevan el nodo en dorado y la línea continua. El
  **nivel actual** se marca además con un halo.
- Los niveles **que faltan** llevan el nodo apagado y la línea a trazos.
- Dentro de cada nivel salen los rasgos. Los que el personaje **ya tiene** van
  en color, se pueden arrastrar y traen su botón de usar si son activos (los
  pasivos se distinguen con un filete a la izquierda).
- Los que **aún no ha ganado** salen en gris y con el borde punteado, con el
  nombre real del rasgo y de dónde viene. Los opcionales se etiquetan.

### De dónde sale el nivel de cada rasgo
Cuando dnd5e concede algo por progresión le deja al objeto la bandera
`advancementOrigin`, que apunta al avance concreto de la clase — y ese avance
sabe en qué niveles actúa. Es lo que se usa. Si el rasgo se añadió a mano se
intenta leer el número de sus requisitos («Explorador 3»), y lo que no encaje
en ningún nivel se agrupa aparte en **«Sin nivel asignado»**, para dotes
sueltas o cosas que haya puesto el DM.

Los rasgos de **especie y trasfondo** se conceden en el nivel 0 (van antes de
la clase); en un árbol que empieza en 1, se muestran ahí.

### Y de dónde salen los rasgos futuros
De los avances de las propias clases y subclases del personaje, así que
funciona con cualquier clase, incluidas las de módulos de terceros. Los nombres
se leen del índice del compendio sin cargar los documentos. Los avances que
solo suben números o marcan competencias (puntos de golpe, competencias,
valores de escala, tamaño) se dejan fuera: no son rasgos y llenarían el árbol
de ruido.

El buscador sigue funcionando y ahora también esconde los peldaños que se
quedan sin nada.

## 2.3.0 — Más compacta, con la información base de 5e

### La armadura sale sola del casco
En 2.2.0 se arreglaron las reglas de ranura, pero una asignación **guardada de
antes** seguía viva: una cota de malla puesta en el casco cuando aún se admitía
cualquier `equipment` se quedaba ahí. Ahora, al abrir la hoja, cada ranura se
revisa contra las reglas actuales y lo que ya no encaja **salta solo a la
ranura que le corresponde** — la cota se va a Armadura sin tocar nada.

### Hoja más compacta
Siguiendo el tamaño de la hoja de referencia: raíl izquierdo de 216 a **180 px**,
navegación más apretada, rombo de nivel más pequeño y cabecera de ventana baja.
Los bloques y filas del panel derecho también respiran menos, así que cabe más
sin desplazarse.

### Conjuros
- **Aptitud, CD y ataque** calculados de verdad: la característica de
  lanzamiento, su modificador y la competencia, más los bonos de
  `system.bonuses.spell.attack`. Antes el ataque se deducía restando 8 a la CD,
  que falla si un efecto toca solo uno de los dos. Un clic en el ataque tira.
- **Espacios de conjuro** con sus llamitas, incluidos los de pacto: clic para
  gastar uno, clic derecho para recuperarlo.
- **Filtro por nivel** (Todos, Trucos, 1º…9º); los niveles sin conjuros se ven
  apagados. Este filtro ya se calculaba pero no llegó a pintarse en 2.0.

### Atributos: toda la información base
- **Sentidos** (visión en la oscuridad, ciega, sísmica, verdadera y especiales).
- **Clases con su subclase y nivel**, **especie** y **trasfondo**, cada uno con
  su botón de editar.
- **Defensas**: resistencias, inmunidades, vulnerabilidades e inmunidad a
  estados.
- **Competencias**: idiomas, armadura, armas y herramientas (que desde dnd5e 4.x
  viven en `system.tools`, aparte del resto).

### Rasgos
Botón junto al título que abre los **Rasgos Especiales** de dnd5e, donde
Midi-QOL cuelga sus banderas por personaje. En dnd5e 5.x es una pestaña de la
hoja del sistema y se abre directamente en ella; en 4.x era una ventana propia.

### Inventario
- Los objetos se crean con **clic derecho** en una celda vacía (antes era clic
  izquierdo, que chocaba con el uso normal de la grilla).
- **Suenan monedas** al cambiar el dinero: un sonido al subir y otro al bajar.
- Debajo de la barra de peso, un **resumen de combate**: CA, iniciativa,
  competencia, la CD de conjuros y —si el personaje no lanza— la CD de sus
  rasgos de clase, calculada con la mejor característica en la que tenga
  competencia en salvación (un guerrero suele dar FUE o CON). Y la lista de
  **armas equipadas con su ataque y su daño**.
- Los objetos **sintonizados** laten con un aro anaranjado alrededor de la
  celda. Se queda quieto si tienes activado el movimiento reducido del sistema.

### Conjuntos de equipo
Si el Combat Hub está activo, junto al botón del paperdoll aparece otro para
**cambiar de conjunto** (I, II, III…), igual que el suyo.

## 2.2.0 — Ranuras correctas, filtros, rareza y conjuros

### La armadura ya no cabe en el yelmo
Cada ranura del paperdoll acepta solo lo suyo:

- **Armadura** — únicamente armaduras de cuerpo (ligera, media, pesada,
  natural). Antes admitía cualquier `equipment`, y por eso una cota de malla
  entraba también en la ranura del casco.
- **Casco, guantes, botas, capa, amuleto y anillos** — bagatelas, objetos
  maravillosos, ropa, anillos, varas, varitas y botín suelto. Es donde caen los
  yelmos de 5e, que el sistema no distingue y se configuran como **bagatelas**.
  El icono del yelmo se mantiene.
- **Cinturón** — lo anterior más pociones, que es donde se llevan.
- **Mano secundaria** — armas y escudos; **principal** y **a distancia**, armas.

### Barra de filtros y sintonización
Entre las monedas y la grilla hay ahora una fila de botones para ver solo
**Armas, Armadura, Consumibles, Contenedores o Botín** — o todo. Filtrar no
mueve nada: los objetos que no son del grupo se atenúan y conservan su sitio,
que es el sentido de la grilla libre. Un grupo sin objetos se ve apagado.

A la derecha, el contador de **objetos sintonizados** (por ejemplo 1/3), con la
lista al pasar el ratón. Si te pasas del límite se pone en rojo.

### Crear objetos desde la grilla
Un clic en una celda vacía pregunta nombre y tipo, crea el objeto **en ese
hueco** y abre su ficha.

### Rareza en el inventario
Los objetos que no son comunes se enmarcan con el color de su rareza y un
halo suave; los comunes se quedan como están para no convertir la grilla en un
semáforo. Los sintonizados llevan un solecito en la esquina.

Si tienes **Special Item Reveal** activo, la hoja usa su misma lectura de
rareza y su misma paleta, así que un objeto se ve igual aquí que en el
directorio, los compendios o Item Piles. Sin ese módulo la hoja lee la rareza
por su cuenta.

### Conjuros
- **Clic derecho** sobre un conjuro: Preparar, Añadir Favorito, Vista, Editar,
  Duplicar, Eliminar, Mostrar en el Chat, Anclar a Atributos, **Crear
  Pergamino** (con la utilidad del propio dnd5e) y **Selecciona una Sección**
  (mueve el conjuro entre a voluntad, innato, ritual, pacto o preparado).
- **Se reordenan arrastrándolos** dentro de su nivel, y el orden se guarda.
- Los **no preparados** se ven apagados y en gris, para distinguir de un
  vistazo lo que puedes lanzar hoy.

Por dentro, la preparación se lee y escribe con los campos nuevos de dnd5e 5.1
(`system.method` y `system.prepared`) cuando están disponibles, y con los
antiguos en dnd5e 4.x. Así no salen avisos de compatibilidad en consola.

### Tooltip legible
El título va en su propia banda, más grande y con contorno, teñido del color de
la rareza. Debajo, el tipo y la rareza, el **tiempo de activación** (acción,
acción adicional, reacción…), el daño, el peso, el **valor con su moneda** y un
resumen de la descripción en texto claro sobre fondo oscuro.

## 2.1.0 — Menú contextual, Combat Hub y acabado

### Clic derecho sobre cualquier objeto
Aparece un menú con todo lo que se puede hacer con él, sin salir de la hoja:

- **Sintonizarse al Objeto** (solo si el objeto admite sintonía).
- **Equipar / Quitar** — busca la primera ranura libre que lo acepte.
- **Añadir Favorito** — usa los favoritos **nativos** de dnd5e, así que el
  objeto queda marcado también en la hoja del sistema, en Tidy 5e y en el
  Combat Hub.
- **Vista** (solo lectura) y **Editar**.
- **Duplicar** y **Borrar** (con confirmación).
- **Mostrar en el Chat**.
- **Dar a un personaje** — elige destinatario y, si hay varias unidades,
  cuántas. El objeto llega desequipado al nuevo dueño.
- **Anclar a Atributos** — el objeto sale en un bloque «Anclados» al principio
  de la pestaña de Atributos, con sus usos o su cantidad y un botón de usar.
  Pensado para pociones y varas que quieres tener siempre a mano.

El menú también funciona sobre los objetos ya puestos en el paperdoll.

### Integración con el Combat Hub
Si «Combat Hub – D&D 5e (By Fatmorbus)» está activo, la hoja y el Hub comparten
un único estado de equipo:

- Lo que equipas en el paperdoll queda equipado en el Hub, porque ambos usan
  `system.equipped`. Cascos, capas, anillos y consumibles aparecen solos en los
  menús del Hub sin tocar nada.
- Las dos ranuras de mano **delegan en la lógica del propio Hub** en vez de
  duplicarla: un arma a dos manos desequipa lo demás y ocupa las dos ranuras
  (la secundaria se ve rayada), ocupar la izquierda retira cualquier otro
  escudo, y así con el resto de sus reglas.
- En sentido contrario, si equipas desde el Hub o cambias de conjunto con los
  numerales I/II/III, el paperdoll se actualiza al instante.
- Un objeto que se desequipe por cualquier otra vía se cae solo de su ranura.

La ranura «a distancia» no tiene equivalente en el Hub: queda equipada pero sin
ocupar mano, como un arma a la espalda.

Sin el Combat Hub instalado la hoja funciona exactamente igual que antes.

### Acabado
- Fuera los bordes pixelados: el marco de la ventana, las celdas y los tooltips
  se dibujan por CSS, y las imágenes vuelven a suavizarse.
- Las monedas usan los iconos de moneda de dnd5e (platino, oro, electro, plata
  y cobre) en vez de las siglas sueltas.
- Iconos de ranura más claros: manoplas, capa con capucha y dos anillos
  distinguibles entre sí.

## 2.0.0 — De medio inventario a hoja completa

### Distribución nueva (siguiendo el diseño de referencia)
La hoja pasa de una columna a **tres**:

- **Raíl izquierdo**: rombo con el nivel, nombre, clase y raza, y la navegación
  — Atributos, Habilidades, Inventario, Conjuros, Rasgos, Biografía y Efectos.
  Abajo, cuatro botones: descanso corto, descanso largo, iniciativa y cambiar
  retrato.
- **Centro**: retrato a cuerpo entero, difuminado hacia el pie, con el nombre y
  la línea «Raza · Clase · Nivel» debajo. El botón de la camiseta superpone el
  **paperdoll** de equipamiento sobre el retrato; el del engranaje abre la hoja
  completa del sistema.
- **Derecha**: el contenido de la pestaña activa.

### Ya no hace falta otra hoja para jugar
Antes todo lo que no fuera el inventario se delegaba en Tidy 5e. Ahora la hoja
resuelve por sí sola:

- **Atributos**: CA, iniciativa, velocidad y competencia; las seis
  características (clic para tirar); barra de PG con PG temporales; barra de
  experiencia; salvaciones de muerte con sus casillas; dados de golpe; y la
  lista de tiradas de salvación.
- **Habilidades**: todas, con su característica, competencia/pericia, total y
  valor pasivo. Un clic tira.
- **Conjuros**: buscador, aptitud/CD/ataque, agrupados por nivel con los
  espacios disponibles, casilla de preparado y botón para lanzar.
- **Rasgos**: buscador y separación entre activos y pasivos, con sus usos.
- **Biografía** y **Efectos activos** (con interruptor para activar o desactivar).

### El inventario sigue siendo el de Stoneshard
Se conserva tal cual la **grilla libre de celdas**: cada objeto va donde lo
sueltes, con su cantidad, los tooltips, el daño coloreado y los sonidos por
material. Se le añaden arriba las cinco monedas (PP, GP, EP, SP, CP) editables y
abajo la barra de peso.

### Aspecto
Tema **negro y dorado** con versalitas serif, en vez del pixel-art. El
`image-rendering: pixelated` se acotó a las celdas del inventario, para que el
retrato y los iconos de las listas se vean suavizados.

## 1.0.0

Primera versión: inventario Stoneshard (paperdoll, grilla de celdas, tooltips,
sonidos por material) sobre la hoja de dnd5e, delegando el resto en Tidy 5e.
# 3.5.1

- Separa Dotes y Acciones en pestañas independientes para PF2e.
- Clasifica acciones de encuentro, reacciones, acciones libres, exploración y downtime con las reglas nativas de PF2e.
- Incluye Strikes y Elemental Blasts preparados por el sistema, con MAP, daño y daño crítico.
- Muestra la categoría PF2e de cada dote y permite activar actividades de exploración.

