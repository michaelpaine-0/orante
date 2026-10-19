const Romcal=require('romcal');const us=require('@romcal/calendar.united-states');const fs=require('fs');
const year=+process.argv[2]||2026;
const rc=new Romcal({localizedCalendar:us.UnitedStates_En,scope:'gregorian',epiphanyOnSunday:true,corpusChristiOnSunday:true,ascensionOnSunday:false});
const easter=y=>{const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(Date.UTC(y,mo-1,da))};
const E=easter(year),ash=new Date(E);ash.setUTCDate(E.getUTCDate()-46);const gf=new Date(E);gf.setUTCDate(E.getUTCDate()-2);
const iso=d=>d.toISOString().slice(0,10);
rc.generateCalendar(year).then(c=>{const out={};
 for(const [d,days] of Object.entries(c)){const p=days[0];const dt=new Date(d+'T00:00:00Z');const dow=dt.getUTCDay();
  const opt=days.slice(1).map(x=>x.name);
  let hd=p.isHolyDayOfObligation&&dow!==0;
  let note=[];
  const md=d.slice(5);
  if(hd&&['01-01','08-15','11-01'].includes(md)&&(dow===6||dow===1)){hd=false;note.push('Obligation lifted this year (falls on a '+(dow===6?'Saturday':'Monday')+').')}
  if(md===iso(new Date(Date.UTC(year,4,1)))&&false){}
  if(/Ascension/.test(p.name)&&dow===4)note.push('Most US dioceses keep the Ascension on the following Sunday; Boston, Hartford, New York, Newark, Omaha and Philadelphia keep Thursday.');
  let fast=null;
  if(d===iso(ash)||d===iso(gf))fast='Fast and abstinence (1983 Code: ages 18–59 fast, from 14 abstain).';
  else if(dow===5&&dt>ash&&dt<E)fast='Abstinence from meat (Friday of Lent).';
  else if(dow===5&&!(p.rank==='solemnity'))fast='Friday penance: abstinence or another work of penance (USCCB 1966).';
  out[d]={name:p.name,rank:p.rankName||p.rank,color:(p.colorNames||p.colors||[])[0],season:(p.seasonNames||[])[0],week:p.calendar&&p.calendar.weekOfSeason,opt,hdo:hd,sunday:dow===0,fast,note:note.join(' ')};
 }
 fs.writeFileSync('novus-'+year+'.json',JSON.stringify(out));console.log(Object.keys(out).length,'days; hdo',Object.values(out).filter(x=>x.hdo).length, 'optional-memorial days',Object.values(out).filter(x=>x.opt.length).length);
 console.log(out['2026-08-15'],out['2026-03-19'],out['2026-12-08']);
});
