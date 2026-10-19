#!/usr/bin/env node
/* Orante feed builder. Reads the calendar engine out of ordo.html (single source of truth)
   and writes subscribable .ics layers.  Usage: node build-feeds.js [year ...] [--out dir] [--us] [--strict] */
const fs=require("fs"),path=require("path");
const args=process.argv.slice(2);
const years=args.filter(a=>/^\d{4}$/.test(a)).map(Number);if(!years.length)years.push(2026);
const out=args.includes("--out")?args[args.indexOf("--out")+1]:"feeds";
const opts={us:!args.includes("--no-us"),strict:args.includes("--strict")};
const src=fs.readFileSync(path.join(__dirname,"app","index.html"),"utf8");
const engine=src.slice(src.indexOf("const MON="),src.indexOf("/* ===================== UI"));
const E={};(new Function("E",engine+";Object.assign(E,{buildYear,computeTransfers,computeDay,D,DOW,MON,FASTLAW,PLEN_COND,DAILY_PLEN})"))(E);

const esc=s=>String(s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
const fold=l=>{const b=Buffer.from(l,"utf8");if(b.length<=75)return l;let o=[],i=0;while(i<b.length){let n=i?74:75;while(n>1&&i+n<b.length&&(b[i+n]&0xC0)===0x80)n--;o.push((i?" ":"")+b.slice(i,i+n).toString("utf8"));i+=n}return o.join("\r\n")};
const ymd=dt=>dt.getFullYear()+String(dt.getMonth()+1).padStart(2,"0")+String(dt.getDate()).padStart(2,"0");
const next=dt=>{const x=new Date(dt);x.setDate(x.getDate()+1);return x};
const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
const cls=c=>c===1?"I class":c===2?"II class":c===3?"III class":c===4?"IV class":"";

function cal(name,desc,color,events){
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Orante//Ordo 1962//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    "X-WR-CALNAME:"+esc(name),"X-WR-CALDESC:"+esc(desc),"X-APPLE-CALENDAR-COLOR:"+color,"REFRESH-INTERVAL;VALUE=DURATION:P1W","X-PUBLISHED-TTL:P1W"];
  events.forEach(e=>{
    L.push("BEGIN:VEVENT","UID:"+e.uid,"DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:"+ymd(e.dt),"DTEND;VALUE=DATE:"+ymd(next(e.dt)),
      "SUMMARY:"+esc(e.summary),"DESCRIPTION:"+esc(e.desc),"TRANSP:TRANSPARENT","CLASS:PUBLIC");
    if(e.cat)L.push("CATEGORIES:"+esc(e.cat));
    if(e.alarm)L.push("BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+esc(e.alarm),"TRIGGER:-PT6H","END:VALARM");
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n")+"\r\n";
}

/* saints.json: patronage + one prayer/litany link per celebration (2026 only, per request) */
let SAINTS={};try{JSON.parse(fs.readFileSync(path.join(__dirname,"saints.json"),"utf8")).forEach(x=>{SAINTS[x.key]=x})}catch(e){}
/* Divinum Officium: Mass propers and the Hours for the day, 1960 rubrics, Latin with English */
const DO="https://www.divinumofficium.com/cgi-bin/",DOV="&version=Rubrics%201960%20-%201960&lang2=English";
const doDate=dt=>String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0")+"-"+dt.getFullYear();
const doMass=dt=>DO+"missa/Pmissa.pl?date1="+doDate(dt)+"&command=prayMissa"+DOV;
const doHour=(dt,h)=>DO+"horas/Pofficium.pl?date1="+doDate(dt)+"&command=pray"+h+DOV;
const prayLines=dt=>["Mass propers (Divinum Officium): "+doMass(dt),"Lauds: "+doHour(dt,"Laudes"),"Vespers: "+doHour(dt,"Vesperae"),"Compline: "+doHour(dt,"Completorium")];
const saintLines=(names,y)=>{if(y!==2026)return[];const out=[];names.forEach(n=>{const x=SAINTS[n];if(!x)return;const who=n.replace(/,.*$/,"");
  if(x.blurb)out.push(x.blurb);
  if(x.patron_of)out.push(who+" · patron of "+x.patron_of);
  if(x.prayer_url)out.push((x.prayer_title||"Prayer")+": "+x.prayer_url)});return out};
const feasts=[],fasts=[],holy=[],ind=[],all=[];
years.forEach(y=>{
  const Y=E.buildYear(y);E.computeTransfers(Y,y,opts);
  for(let m=1;m<=12;m++)for(let d=1;d<=31;d++){
    const dt=E.D(y,m,d);if(dt.getMonth()!==m-1)continue;
    const r=E.computeDay(dt,Y,opts);
    const marks=[r.ember&&"Ember day",r.rogation&&"Rogation",r.vigil&&"Vigil",r.octave&&("Octave of "+r.octave)].filter(Boolean);
    const sw={white:"⚪",red:"🔴",green:"🟢",violet:"🟣",rose:"🩷",black:"⚫"}[r.color]||"";
    let desc=[cls(r.cel.cls)+" · "+r.color+" · "+r.season,
      "Mass: "+r.massLine, r.choice?r.choice:null,
      "Commemorations: "+(r.comms.length?r.comms.join("; "):"none"),
      "Gloria "+(r.gloria?"yes":"no")+" · Credo "+(r.credo?"yes":"no")+" · Preface: "+r.pref,
      r.omitted.length?"Not said: "+r.omitted.join("; "):null,
      marks.length?"Marks: "+marks.join("; "):null,
      r.notes.length?r.notes.join(" "):null,
      r.fast?"Fast: "+E.FASTLAW[r.fast]:null,
      r.univHDO&&!r.isSunday?"Holy day of obligation"+(r.usHDO?" (US)":" (universal list; not US)"):null,
      ...saintLines([r.cel.name,...r.comms],y),
      ...prayLines(dt)
    ].filter(Boolean).join("\n");
    const fe={uid:"feast-"+r.iso+"@orante",dt,summary:sw+" "+r.cel.name+(r.cel.cls<=2&&!r.isSunday?" ("+cls(r.cel.cls).replace(" class","")+")":""),desc,cat:"Orante/Feasts"};
    feasts.push(fe);all.push(fe);
    if(r.fast){const s=r.fast==="fastabs"?"Fast + abstinence":r.fast==="fast"?"Fast (meat at main meal)":"Abstinence";
      const why=r.ember?"Ember day":r.vigil||/Vigil/.test(r.cel.name)?"Vigil":(m===10&&d===31)?"Vigil of All Saints":r.fast==="abs"?"Friday":"Lent";
      const ev={uid:"fast-"+r.iso+"@orante",dt,summary:"🍞 "+s+" · "+why,desc:E.FASTLAW[r.fast]+"\n1917 Code: fast ages 21–59, one full meal + two collations; abstinence from age 7, no flesh meat.\n"+r.fastNotes.join(" "),cat:"Orante/Fasts",alarm:"Tomorrow: "+s+" ("+why+")"};
      fasts.push(ev);all.push(ev)}
    if(r.univHDO&&!r.isSunday){const ev={uid:"hdo-"+r.iso+"@orante",dt,summary:"✝ Holy day: "+r.cel.name.split(" (")[0]+(r.usHDO?"":" (not binding in US)"),desc:(r.usHDO?"Binding in the USA. ":"On the 1917 universal list of 10; US bishops keep 6. ")+"Mass obligatory; rest from servile work.",cat:"Orante/HolyDays",alarm:"Tomorrow is a holy day of obligation: "+r.cel.name.split(" (")[0]};
      holy.push(ev);all.push(ev)}
    if(r.ind.length){r.ind.forEach((x,i)=>{const ev={uid:"ind-"+r.iso+"-"+i+"@orante",dt,summary:"☩ Plenary: "+(x[3]||x[1]),desc:x[1]+"\nRef: "+x[2]+"\n"+E.PLEN_COND,cat:"Orante/Indulgences"};ind.push(ev);all.push(ev)})}
  }
});
fs.mkdirSync(out,{recursive:true});
const tag=years.join("-");
const files=[["orante-feasts.ics","Orante · Feasts","Ordo 1962: daily celebration, rank, color, Mass notes.","#5A3B7A",feasts],
 ["orante-fasts.ics","Orante · Fasts","Fast and abstinence under the 1917 Code (stricter than US norms).","#8A3B1C",fasts],
 ["orante-holydays.ics","Orante · Holy days","Holy days of obligation, universal (1917) and US.","#B8933B",holy],
 ["orante-indulgences.ics","Orante · Indulgences","Plenary indulgences tied to dates (Enchiridion 1999).","#1D5C6E",ind],
 ["orante-all.ics","Orante","All layers in one calendar.","#5A3B7A",all]];
files.forEach(f=>{fs.writeFileSync(path.join(out,f[0]),cal(f[1],f[2]+" Years: "+tag,f[3],f[4]));console.log(f[0],f[4].length,"events")});
