/** Full Stoneshard presentation backed by PF2e actor data. */
const MODULE_ID = "talespire-foundrysheets-by-velvet";
const PATH = `modules/${MODULE_ID}`;
const PHYSICAL = new Set(["weapon","armor","shield","equipment","consumable","ammo","treasure","book","backpack"]);
const SLOT_ROWS = [
  ["main","Mano principal","hand",0,2,17.5,43],["off","Mano secundaria","hand",82.5,2,17.5,43],
  ["head","Cabeza","head",39,0,22,19],["body","Armadura","body",38.5,20,23,29],
  ["belt","Cinturón","belt",37.5,50.5,25,9],["amulet","Amuleto","amulet",65,1.5,13,15],
  ["ring1","Anillo","ring",22,27,11.5,12.5],["ring2","Anillo","ring",66,37.5,11.5,12.5],
  ["gloves","Guantes","gloves",17,61,20,17],["cape","Capa","cape",.5,59.5,15,20],
  ["boots","Botas","boots",63,61,20,17],["ranged","Distancia","hand",83,49,17,31],
  ...[1,2,3,4,5].map((n,i)=>[`belt${n}`,`Acceso rápido ${n}`,null,26.1+i*9.8,85,9.8,14.5])
];
const SLOTS = SLOT_ROWS.map(([key,labelText,frame,x,y,w,h],i)=>({
  key,labelText,pos:{x,y,w,h},beltIndex:i>11?i-11:null,
  frameUrl:frame?`${PATH}/assets/slots/frame-${frame}.png`:null,
  artUrl:frame?`${PATH}/assets/slots/${frame==="ring"?"ring.svg":key==="ranged"?"ranged.svg":`art-${frame}.png`}`:null
}));
const GROUPS=[["all","Todo","fa-border-all"],["weapons","Armas","fa-sword"],["armor","Armaduras","fa-shield-halved"],["consumables","Consumibles","fa-flask"],["gear","Equipo","fa-toolbox"],["treasure","Tesoro","fa-gem"]].map(([key,label,icon])=>({key,label,icon}));
let SheetClass=null;
const signed=(v)=>(Number(v)||0)>=0?`+${Number(v)||0}`:String(Number(v));
const group=(i)=>i.type==="weapon"?"weapons":["armor","shield"].includes(i.type)?"armor":["consumable","ammo"].includes(i.type)?"consumables":i.type==="treasure"?"treasure":"gear";
const itemView=(i)=>({id:i.id,name:i.name,img:i.img,group:group(i),iconClass:`sss-${i.type}`,qty:Number(i.system?.quantity)>1?Number(i.system.quantity):null,attuned:i.isInvested===true,equipped:i.isEquipped===true,uses:i.system?.uses??null});
function layout(){try{return game.settings.get(MODULE_ID,"pf2eLayout")??"standard";}catch{return "standard";}}
/** Symbiote de TaleSpire (capa de compatibilidad, API `TS`) o viewport estrecho: su ajuste de cliente es independiente de Foundry. */
function narrowClient(){return !!globalThis.TALESPIRE_COMPAT||typeof globalThis.TS!=="undefined"||window.innerWidth<900;}
function compactWidth(){return Math.max(340,Math.min(520,window.innerWidth-8));}
function width(){return narrowClient()?compactWidth():{standard:1040,"vn-enhanced":720,"symbiote-optimized":520}[layout()]??1040;}
function nativeSheet(){const s=CONFIG.Actor?.sheetClasses?.character??{};return s["pf2e.CharacterSheetPF2e"]?.cls??Object.entries(s).find(([id,d])=>id.startsWith("pf2e.")&&d?.cls?.name==="CharacterSheetPF2e")?.[1]?.cls??null;}
function registerSheet(){
  if(game.system?.id!=="pf2e")return false;
  if(SheetClass)return true;
  const Base=nativeSheet();if(!Base)return false;
  SheetClass=class StoneshardPF2eSheet extends Base{
    static stoneshardPF2e=true;
    _tab="attributes";_showDoll=false;_filter="all";_spellLevel="all";
    get template(){return `${PATH}/templates/sheet.hbs`;}
    static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{classes:["sss-window","sheet","actor","stoneshard-pf2e-real"],template:`${PATH}/templates/sheet.hbs`,width:width(),height:820,resizable:true,submitOnChange:true,closeOnSubmit:false,tabs:[],scrollY:[".sss-panel",".sss-grid-wrap"],dragDrop:[{dragSelector:".sss-draggable",dropSelector:null}]},{inplace:false});}
    async getData(options){let c;try{c=await super.getData(options);}catch{c={actor:this.actor,system:this.actor.system};}c.ss=await this._model();return c;}
    async _model(){
      const a=this.actor,s=a.system,level=Number(s.details?.level?.value)||0,physical=a.items.filter(i=>PHYSICAL.has(i.type));
      const slots=this._slots(physical),slotted=new Set(Object.values(slots).map(x=>x.item?.id).filter(Boolean));
      const tiles=physical.filter(i=>!slotted.has(i.id)).map((i,n)=>({...itemView(i),x:n%9,y:Math.floor(n/9),w:1,h:1}));
      const hp=s.attributes?.hp??{},bulk=a.inventory?.bulk??{},coins=a.inventory?.coins??{},effects=this._effects();
      const ancestry=a.ancestry?.name??"",classText=a.class?.name??"",bio=s.details?.biography??{};
      const identity={name:a.name,level,race:[ancestry,a.heritage?.name].filter(Boolean).join(" · "),background:a.background?.name??"",classText,subtitle:[ancestry,classText].filter(Boolean).join(" · "),biography:await TextEditor.enrichHTML(bio.backstory??bio.appearance??"",{async:true,secrets:a.isOwner,relativeTo:a})};
      const init=a.initiative?.statistic?.check?.mod??a.perception?.mod??0,xp=s.details?.xp??{},dying=Number(s.attributes?.dying?.value)||0,wounded=Number(s.attributes?.wounded?.value)||0;
      const vitals={prof:level,init,initText:signed(init),speed:s.attributes?.speed?.value??0,ac:s.attributes?.ac?.value??0,xp:{value:xp.value??0,max:xp.max??1000,pct:Math.clamp((xp.value??0)/Math.max(1,xp.max??1000)*100,0,100),show:true},death:{successBoxes:[1,2,3].map(n=>({n,on:n<=wounded})),failureBoxes:[1,2,3,4].map(n=>({n,on:n<=dying}))},hitDice:{value:s.resources?.heroPoints?.value??0,max:s.resources?.heroPoints?.max??3,denom:"Héroe"}};
      const abilities=Object.entries(s.abilities??{}).map(([key,v])=>({key,label:key.toUpperCase(),abbr:({str:"FUE",dex:"DES",con:"CON",int:"INT",wis:"SAB",cha:"CAR"})[key],value:v.value??10+(v.mod??0)*2,modText:signed(v.mod)}));
      const saves=Object.entries(a.saves??{}).map(([key,v])=>({key,label:({fortitude:"Fortaleza",reflex:"Reflejos",will:"Voluntad"})[key]??v.label??key,proficient:(v.rank??0)>0,totalText:signed(v.mod)}));
      const skills=Object.entries(a.skills??{}).map(([key,v])=>({key,label:game.i18n.localize(v.label??key),ability:String(v.attribute??"").toUpperCase(),proficient:(v.rank??0)>0,expertise:(v.rank??0)>=2,totalText:signed(v.mod),passive:10+(v.mod??0)})).sort((x,y)=>x.label.localeCompare(y.label));
      const encValue=Number(bulk.value?.normal??bulk.value)||0,encMax=Number(bulk.max)||0;
      return {isPf2e:true,cols:9,rows:Math.max(7,Math.ceil(tiles.length/9)),cell:52,tiles,slots,slotList:SLOTS.map(d=>slots[d.key]),hp:{value:hp.value??0,max:hp.max??0,temp:hp.temp??0,pct:Math.clamp((hp.value??0)/Math.max(1,hp.max??1)*100,0,100)},ac:s.attributes?.ac?.value??"—",speed:s.attributes?.speed?.value??"—",gold:Number(coins.gp)||0,enc:{value:encValue,max:encMax,pct:encMax?Math.clamp(encValue/encMax*100,0,100):0},portrait:a.img,editable:a.isOwner,portraitOffset:"translate(0px, 0px) scale(1)",portraitAdjust:false,tab:this._tab,is:Object.fromEntries(["attributes","skills","actions","inventory","spells","features","biography","effects"].map(k=>[k,k===this._tab])),tabs:this._ssBuildTabs(effects.length),showDoll:this._showDoll||this._tab==="inventory",dollForced:this._tab==="inventory",identity,vitals,abilities,saves,skills,currency:["pp","gp","sp","cp"].map(key=>({key,label:key.toUpperCase(),title:key.toUpperCase(),icon:"icons/commodities/currency/coin-embossed-crown-gold.webp",value:Number(coins[key])||0})),coinExchange:{allowed:false,tooltip:"PF2e administra monedas como objetos"},spellbook:this._spells(),actions:this._actions(),features:this._features(level),effects,pinned:[],filters:GROUPS.map(g=>{const count=g.key==="all"?tiles.length:tiles.filter(t=>t.group===g.key).length;return{...g,count,empty:!count,active:this._filter===g.key};}),attunement:{value:physical.filter(i=>i.isInvested).length,max:10,over:false,names:physical.filter(i=>i.isInvested).map(i=>i.name).join(", ")},details:this._details(),combat:this._combat(),hasLoadouts:false};
    }
    _ssBuildTabs(e){return[["attributes","Atributos","fa-shield-halved"],["skills","Habilidades","fa-person-running"],["actions","Acciones","fa-bolt"],["inventory","Inventario","fa-briefcase"],["spells","Conjuros","fa-book-sparkles",this.actor.itemTypes?.spell?.length],["features","Dotes","fa-star"],["biography","Biografía","fa-book"],["effects","Efectos","fa-wand-magic-sparkles",e]].map(([key,label,icon,badge])=>({key,label,icon,badge:badge||null,active:key===this._tab}));}
    _slots(items){const saved=this.actor.getFlag(MODULE_ID,"pf2eSlots")??{},used=new Set(),find=fn=>items.find(i=>!used.has(i.id)&&fn(i));return Object.fromEntries(SLOTS.map(d=>{let i=saved[d.key]?this.actor.items.get(saved[d.key]):null;if(!i&&d.key==="main")i=find(x=>x.type==="weapon"&&x.isEquipped);if(!i&&d.key==="off")i=find(x=>["weapon","shield"].includes(x.type)&&x.isEquipped);if(!i&&d.key==="body")i=find(x=>x.type==="armor"&&x.isEquipped);if(i)used.add(i.id);return[d.key,{...d,item:i?itemView(i):null,twoHanded:false}];}));}
    _details(){const a=this.actor,s=a.system,row=i=>i?{id:i.id,name:i.name,img:i.img}:null;return{classes:[row(a.class)].filter(Boolean),species:row(a.ancestry),background:row(a.background),defenses:[...(s.attributes?.immunities??[]).map(x=>({label:"Inmunidad",values:x.label??x.type})),...(s.attributes?.resistances??[]).map(x=>({label:"Resistencia",values:`${x.label??x.type} ${x.value??""}`})),...(s.attributes?.weaknesses??[]).map(x=>({label:"Debilidad",values:`${x.label??x.type} ${x.value??""}`}))],proficiencies:Object.entries(s.proficiencies?.defenses??{}).filter(([,p])=>p.rank).map(([key,p])=>({icon:"fa-shield",label:p.label??key,values:["No entrenado","Entrenado","Experto","Maestro","Legendario"][p.rank]})),senses:(a.perception?.senses?.contents??[]).map(x=>`${x.label??x.type}${x.range?` ${x.range}`:""}`)};}
    _combat(){const a=this.actor,weapons=(a.system.actions??[]).map((x,index)=>({id:x.item?.id??`strike-${index}`,img:x.item?.img??"icons/svg/sword.svg",name:x.label??x.item?.name??"Strike",attack:signed(x.totalModifier),damage:x.damageFormula??"Daño",activityId:String(index)}));const saveDcs=Object.values(a.system.proficiencies?.classDCs??{}).filter(x=>x.rank).slice(0,2).map(x=>({label:x.label??"CD de clase",ability:"CD",value:x.dc??x.value??"—"}));return{ac:a.system.attributes?.ac?.value??"—",initiative:signed(a.initiative?.statistic?.check?.mod??a.perception?.mod),prof:a.system.details?.level?.value??0,saveDcs,weapons};}
    _spells(){const spells=this.actor.itemTypes?.spell??[],groups=new Map();for(const s of spells){const l=Number(s.rank??s.system.level?.value)||0;if(!groups.has(l))groups.set(l,[]);groups.get(l).push({id:s.id,name:s.name,img:s.img,level:l,school:(s.system.traits?.value??[]).slice(0,2).join(" · "),active:true});}const entries=this.actor.itemTypes?.spellcastingEntry??[],slots=[];for(const e of entries)for(let l=1;l<=10;l++){const s=e.system.slots?.[`slot${l}`];if(s?.max)slots.push({key:`${e.id}:slot${l}`,label:`${e.name} ${l}`,value:s.value??0,max:s.max,pips:Array.from({length:s.max},(_,index)=>({index,filled:index<(s.value??0)}))});}const p=entries[0],levels=[...groups.keys()];return{groups:[...groups].sort((a,b)=>a[0]-b[0]).map(([level,list])=>({level,label:level?`Rango ${level}`:"Trucos",spells:list})),hasSpells:spells.length>0,ability:String(this.actor.system.details?.keyability?.value??"—").toUpperCase(),abilityFull:"Atributo clave",dc:p?.statistic?.dc?.value??p?.system.spelldc?.dc??"—",attack:signed(p?.statistic?.check?.mod??p?.system.spelldc?.value),slots,filters:[{level:"all",label:"Todos",has:true,active:true},...Array.from({length:11},(_,level)=>({level,label:level?`${level}º`:"Trucos",has:levels.includes(level)}))]};}
    _actions(){
      const actor=this.actor,activeExploration=actor.system.exploration??[],groups={encounter:[{key:"actions",label:"Acciones",items:[]},{key:"reactions",label:"Reacciones",items:[]},{key:"free",label:"Acciones libres",items:[]}],exploration:[],downtime:[]};
      const glyph=(type,value)=>type==="reaction"?"↩":type==="free"?"◇":String(value??1);
      const view=item=>{const traits=item.system.traits?.value??[],cost=item.actionCost??{},freq=item.system.frequency??null;return{id:item.id,name:item.name,img:item.img,traits:traits.join(" · "),actionType:cost.type??"free",actionGlyph:glyph(cost.type,cost.value),frequency:freq?`${freq.value??freq.max??0}/${freq.max??0}${freq.per?` ${freq.per}`:""}`:null,active:activeExploration.includes(item.id)};};
      for(const item of actor.items){
        if(item.suppressed||!(item.type==="action"||(item.type==="feat"&&item.actionCost)))continue;
        const data=view(item),traits=item.system.traits?.value??[];
        if(traits.includes("exploration")){groups.exploration.push(data);continue;}
        if(traits.includes("downtime")){groups.downtime.push(data);continue;}
        const key=data.actionType==="reaction"?"reactions":data.actionType==="free"?"free":"actions";
        groups.encounter.find(g=>g.key===key).items.push(data);
      }
      for(const group of groups.encounter)group.items.sort((a,b)=>a.name.localeCompare(b.name));
      groups.exploration.sort((a,b)=>a.name.localeCompare(b.name));groups.downtime.sort((a,b)=>a.name.localeCompare(b.name));
      const strikes=(actor.system.actions??[]).map((strike,index)=>({index,id:strike.item?.id??`strike-${index}`,name:strike.label??strike.item?.name??"Strike",img:strike.item?.img??"icons/svg/sword.svg",traits:(strike.traits??strike.item?.system?.traits?.value??[]).map?.(t=>t.label??t)?.join(" · ")??"",variants:(strike.variants??[]).map((variant,variantIndex)=>({variantIndex,label:variant.label??signed(variant.modifier)})),canDamage:Boolean(strike.damage),canCritical:Boolean(strike.critical)}));
      return{...groups,strikes,total:strikes.length+groups.exploration.length+groups.downtime.length+groups.encounter.reduce((n,g)=>n+g.items.length,0)};
    }
    _features(level){const categories={ancestry:"Ascendencia",ancestryfeature:"Ascendencia",class:"Clase",classfeature:"Clase",skill:"Habilidad",general:"General",bonus:"Bonificación"},items=this.actor.items.filter(i=>i.type==="feat"),view=i=>{const category=i.system.category??i.category??"bonus";return{id:i.id,name:i.name,img:i.img,owned:true,active:Boolean(i.actionCost),categoryLabel:categories[category]??category,hasUses:Boolean(i.system.frequency),uses:i.system.frequency?{value:i.system.frequency.value??i.system.frequency.max??0,max:i.system.frequency.max??0}:null};},map=new Map(),loose=[];for(const i of items){const l=Number(i.system.level?.value)||0,node=view(i);if(l){if(!map.has(l))map.set(l,[]);map.get(l).push(node);}else loose.push(node);}for(const nodes of map.values())nodes.sort((a,b)=>a.name.localeCompare(b.name));loose.sort((a,b)=>a.name.localeCompare(b.name));return{total:items.length,tree:{levels:Array.from({length:20},(_,i)=>{const n=i+1,nodes=map.get(n)??[];return{level:n,reached:n<=level,current:n===level,empty:!nodes.length,nodes};}),loose}};}
    _effects(){return[...this.actor.items.filter(i=>["condition","effect"].includes(i.type)).map(i=>({uuid:i.uuid,name:i.name,img:i.img,source:i.type==="condition"?"Condición PF2e":"Efecto PF2e",disabled:i.isExpired??false,suppressed:i.suppressed??false,editable:this.actor.isOwner})),...[...this.actor.effects].map(e=>({uuid:e.uuid,name:e.name,img:e.img,source:e.origin??"Efecto activo",disabled:e.disabled,suppressed:e.isSuppressed,editable:this.actor.isOwner}))];}
    activateListeners(html){try{super.activateListeners(html);}catch(e){console.debug(MODULE_ID,e);}const r=html?.[0]??html;if(!(r instanceof HTMLElement))return;
      // Foundry desactiva todos los botones si el usuario no es dueño (p. ej. jugador en el Symbiote); la navegación solo cambia la vista.
      if(!this.isEditable)r.querySelectorAll('[data-sss-tab],[data-action="sss-toggle-doll"],[data-action="sss-filter"],input[data-sss-filter]').forEach(e=>e.disabled=false);
      try{this._sssApplyLayout();}catch(e){console.warn(MODULE_ID,"layout",e);}
      r.querySelectorAll("[data-sss-tab]").forEach(e=>e.onclick=()=>{this._tab=e.dataset.sssTab;this.render(false);});
      r.querySelector('[data-action="sss-toggle-doll"]')?.addEventListener("click",()=>{this._showDoll=!this._showDoll;this.render(false);});
      r.querySelectorAll('[data-action="sss-roll-ability"]').forEach(e=>e.onclick=ev=>this.actor.getStatistic?.(e.dataset.ability)?.roll?.({event:ev}));
      r.querySelectorAll('[data-action="sss-roll-save"]').forEach(e=>e.onclick=ev=>this.actor.saves?.[e.dataset.ability]?.roll?.({event:ev}));
      r.querySelectorAll('[data-action="sss-roll-skill"]').forEach(e=>e.onclick=ev=>this.actor.skills?.[e.dataset.skill]?.roll?.({event:ev}));
      r.querySelectorAll('[data-action="sss-initiative"]').forEach(e=>e.onclick=ev=>this.actor.initiative?.roll?.({event:ev,statistic:"perception"}));
      r.querySelectorAll('[data-action="sss-use"]').forEach(e=>e.onclick=ev=>this._use(e.dataset.itemId,ev));
      r.querySelectorAll('[data-action="sss-use-activity"]').forEach(e=>e.onclick=ev=>this.actor.system.actions?.[Number(e.dataset.activityId)]?.variants?.[0]?.roll?.({event:ev}));
      r.querySelectorAll('[data-action="sss-strike-attack"]').forEach(e=>e.onclick=ev=>this.actor.system.actions?.[Number(e.dataset.strikeIndex)]?.variants?.[Number(e.dataset.variant)]?.roll?.({event:ev}));
      r.querySelectorAll('[data-action="sss-strike-damage"]').forEach(e=>e.onclick=ev=>this.actor.system.actions?.[Number(e.dataset.strikeIndex)]?.damage?.({event:ev}));
      r.querySelectorAll('[data-action="sss-strike-critical"]').forEach(e=>e.onclick=ev=>this.actor.system.actions?.[Number(e.dataset.strikeIndex)]?.critical?.({event:ev}));
      r.querySelectorAll('[data-action="sss-toggle-exploration"]').forEach(e=>e.onclick=()=>this._toggleExploration(e.dataset.itemId));
      r.querySelectorAll("[data-sss-item]").forEach(e=>e.ondblclick=()=>this.actor.items.get(e.dataset.sssItem)?.sheet?.render(true));
      r.querySelectorAll('[data-action="sss-filter"]').forEach(e=>e.onclick=()=>r.querySelectorAll(".sss-tile").forEach(t=>t.classList.toggle("is-dimmed",e.dataset.group!=="all"&&t.dataset.group!==e.dataset.group)));
      r.querySelectorAll("[data-sss-filter]").forEach(i=>i.oninput=()=>{const q=i.value.trim().toLowerCase();r.querySelectorAll(i.dataset.sssFilter==="spells"?".sss-spell":"[data-sss-entry]").forEach(x=>x.hidden=!!q&&!String(x.dataset.name??x.textContent).toLowerCase().includes(q));});
      r.querySelectorAll('[data-action="sss-slot-pip"]').forEach(e=>{e.onclick=()=>this._slot(e.dataset.key,-1);e.oncontextmenu=ev=>{ev.preventDefault();this._slot(e.dataset.key,1);};});
      r.querySelector('[data-action="sss-long-rest"]')?.addEventListener("click",()=>game.pf2e?.actions?.restForTheNight?.({actors:[this.actor]}));
      r.querySelector('[data-action="sss-portrait"]')?.addEventListener("click",()=>new FilePicker({type:"imagevideo",current:this.actor.img,callback:path=>this.actor.update({img:path})}).browse());
      r.querySelectorAll("[data-effect-uuid]").forEach(e=>e.onclick=()=>this._effect(e.dataset.action,e.dataset.effectUuid));
      this._drag(r);
    }
    setPosition(pos){const r=super.setPosition(pos);try{this._sssApplyLayout();}catch(e){console.warn(MODULE_ID,"layout",e);}return r;}
    /** Una sola columna si el ajuste lo pide o si la ventana real es estrecha (p. ej. el Symbiote de TaleSpire, cuyo ajuste de cliente es independiente). */
    _sssApplyLayout(){const win=this.element?.[0]??this.element;if(!(win instanceof HTMLElement))return;const l=layout(),narrow=narrowClient(),w=win.offsetWidth||this.position?.width||0,compact=narrow||l==="symbiote-optimized"||(w>0&&w<760);
      if(narrow&&!this._sssFitting&&(this.position?.width??0)>compactWidth()+1){this._sssFitting=true;try{this.setPosition({width:compactWidth(),left:Math.max(0,Math.min(this.position.left??0,window.innerWidth-compactWidth()))});}finally{this._sssFitting=false;}return;}
      win.classList.toggle("sss-layout-symbiote",compact);win.classList.toggle("sss-layout-vn",!compact&&l==="vn-enhanced");
      win.querySelector(".sss-stage-art")?.classList.toggle("sss-has-doll",!!win.querySelector(".sss-doll-overlay"));
      const grid=win.querySelector(".sss-grid"),panel=win.querySelector(".sss-panel");if(!grid)return;
      if(compact&&panel?.clientWidth){const cols=Number(grid.dataset.cols)||9;grid.style.setProperty("--sss-cell",`${Math.max(28,Math.min(52,Math.floor((panel.clientWidth-32)/cols)))}px`);}else grid.style.removeProperty("--sss-cell");}
    async _use(id,event){const i=this.actor.items.get(id);if(!i)return;if(i.type==="spell"){const e=this.actor.items.get(i.system.location?.value);if(e?.cast)return e.cast(i,{rank:i.rank??i.system.level?.value??0});}return game.pf2e?.rollItemMacro?game.pf2e.rollItemMacro(i.uuid,event):i.toMessage?.(event);}
    async _toggleExploration(id){if(!this.isEditable||!id)return;const current=this.actor.system.exploration??[],next=current.includes(id)?current.filter(x=>x!==id):[...current,id];await this.actor.update({"system.exploration":next});}
    async _slot(value,delta){const[id,key]=String(value).split(":"),e=this.actor.items.get(id),s=e?.system.slots?.[key];if(s)await e.update({[`system.slots.${key}.value`]:Math.clamp((Number(s.value)||0)+delta,0,Number(s.max)||0)});}
    async _effect(action,uuid){const e=await fromUuid(uuid);if(!e)return;if(action==="sss-edit-effect")return e.sheet?.render(true);if(action==="sss-delete-effect"||e.type==="condition")return e.delete?.();return"disabled"in e?e.update?.({disabled:!e.disabled}):e.update?.({"system.expired":!(e.isExpired??false)});}
    _drag(r){r.querySelectorAll(".sss-draggable[data-sss-item]").forEach(e=>e.ondragstart=ev=>{const i=this.actor.items.get(e.dataset.sssItem);if(i)ev.dataTransfer.setData("text/plain",JSON.stringify({type:"Item",uuid:i.uuid}));});r.querySelectorAll("[data-sss-slot]").forEach(s=>{s.ondragover=e=>e.preventDefault();s.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();this._removeSlot(s.dataset.sssSlot,s.querySelector("[data-sss-item]")?.dataset.sssItem);};s.ondrop=async e=>{e.preventDefault();let d;try{d=JSON.parse(e.dataTransfer.getData("text/plain"));}catch{return;}const i=await fromUuid(d.uuid);if(!i||i.actor!==this.actor)return;const f=foundry.utils.deepClone(this.actor.getFlag(MODULE_ID,"pf2eSlots")??{});for(const[key,id]of Object.entries(f))if(id===i.id)delete f[key];f[s.dataset.sssSlot]=i.id;await this.actor.setFlag(MODULE_ID,"pf2eSlots",f);};});}
    async _removeSlot(key,fallbackId){const f=foundry.utils.deepClone(this.actor.getFlag(MODULE_ID,"pf2eSlots")??{}),id=f[key]??fallbackId;if(!id)return;delete f[key];await this.actor.setFlag(MODULE_ID,"pf2eSlots",f);const i=this.actor.items.get(id);if(i?.system?.equipped){await i.update({"system.equipped.carryType":"stowed","system.equipped.handsHeld":0}).catch(error=>console.warn(MODULE_ID,"No se pudo guardar el objeto",error));}this.render(false);}
  };
  (foundry.documents?.collections?.Actors??Actors).registerSheet(MODULE_ID,SheetClass,{types:["character"],makeDefault:false,label:"Talespire Foundry Sheets by Velvet (PF2e)"});
  return true;
}
Hooks.once("init",()=>{if(game.system?.id==="pf2e")game.settings.register(MODULE_ID,"pf2eLayout",{name:"Diseño de hoja PF2e",hint:"Standard muestra la hoja Stoneshard completa.",scope:"client",config:true,type:String,choices:{standard:"Standard","vn-enhanced":"VN Enhanced (TaleSpire)","symbiote-optimized":"Symbiote Optimized (TaleSpire)"},default:"standard",onChange:()=>{for(const a of Object.values(ui.windows??{}))if(a?.constructor?.stoneshardPF2e){a.setPosition({width:width()});a.render(false);}}});});
Hooks.once("setup",()=>{if(game.system?.id==="pf2e"&&!registerSheet())console.warn(MODULE_ID,"reintentando registro en ready");});
Hooks.once("ready",()=>{if(game.system?.id==="pf2e"&&!registerSheet())ui.notifications?.error("No se pudo registrar Stoneshard PF2e.");});
