// Dedicated three-age Spine rigs, skinned from the new Ignisaur source drawings.
// All pixels share one continuous mesh and skin field: no cut-out hip/ankle seams.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import spec from '../../rig-lab/data/species-ignisaur.mjs';
import { build } from '../../rig-lab/scripts/build.mjs';
import { readPNG } from '../../rig-lab/scripts/lib/png.mjs';
import { pose } from '../../rig-lab/scripts/lib/spine.mjs';
import { inside, segDist, smooth, rot } from '../../rig-lab/scripts/lib/geom.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAB = path.resolve(ROOT, '../rig-lab');
const PUBLIC = path.join(ROOT, 'public/dinosaurs');
const degrees = (r) => r * 180 / Math.PI;
const wrap = (d) => ((d + 180) % 360 + 360) % 360 - 180;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const wanted = process.argv.slice(2);

function authorMotion(skeleton, worlds, stageScale, age) {
  const setup = Object.fromEntries(skeleton.bones.map((b) => [b.name, b]));
  const angle = (w) => degrees(Math.atan2(w.c, w.a));
  const body = worlds.body;
  const legs = Object.fromEntries(['near', 'far'].map((side) => {
    const hip = worlds[side + 'Thigh'], knee = worlds[side + 'Shin'], ankle = worlds[side + 'Foot'];
    return [side, { hip, knee, ankle, l1: setup[side + 'Thigh'].length, l2: setup[side + 'Shin'].length,
      bend: Math.sign(wrap(degrees(Math.atan2(knee.y-hip.y,knee.x-hip.x)) - degrees(Math.atan2(ankle.y-hip.y,ankle.x-hip.x)))) || 1 }];
  }));
  const durations = { idle: 3.2, walk: age === 'pui' ? 1.25 : age === 'juvenil' ? 1.45 : 1.65, attack: 1.8, ultimate: 3.2 };
  const pulse = (t, a, b) => t <= a || t >= b ? 0 : Math.sin(Math.PI * (t-a)/(b-a)) ** 2;
  const animations = {};
  for (const [name, duration] of Object.entries(durations)) {
    const bones = {}, n = Math.round(duration * 30);
    const put = (bone, channel, key) => ((bones[bone] ??= {})[channel] ??= []).push(key);
    for (let i = 0; i <= n; i++) {
      const t = duration*i/n, phase = t/duration, w = phase*Math.PI*2;
      const wind = pulse(t,0.1,0.7), strike = pulse(t,0.65,1.45), roar = pulse(t,0.7,2.6);
      let bx=0, by=0, br=0, chest=0, neck=0, head=0, jaw=0;
      if (name === 'idle') { by=1.5*stageScale*Math.sin(w); br=.4*Math.sin(w); chest=.5*Math.sin(w); neck=.9*Math.sin(w); head=-.8*Math.sin(w); }
      if (name === 'walk') { by=-2*stageScale*(1-Math.cos(2*w)); br=.6*Math.sin(2*w); chest=-.4*Math.sin(2*w); neck=.7*Math.sin(2*w); head=-br-neck; }
      if (name === 'attack') { bx=stageScale*(-8*wind+20*strike); by=-3*stageScale*wind; br=2*wind-3*strike; chest=wind-strike; neck=3*wind-4*strike; head=2*wind-3*strike; jaw=-5*strike; }
      if (name === 'ultimate') { by=-4*stageScale*wind+5*stageScale*roar; br=-3*roar; chest=roar; neck=4*roar; head=5*roar; jaw=-7*roar; }
      put('body','translate',{time:t,x:bx,y:by}); put('body','rotate',{time:t,angle:br});
      for (const [bone, value] of Object.entries({chest,neck1:neck/2,neck2:neck/2,head,jaw})) put(bone,'rotate',{time:t,angle:value});
      for(let k=1;k<=4;k++) put(`tail${k}`,'rotate',{time:t,angle:(name==='idle' ? .6 : name==='walk' ? 1.1 : 1.4)*Math.sin(w)*k/2});
      for(const prefix of ['arm','farArm']) for(const [suffix,amp] of [['Upper',1.8],['Fore',1.1],['Hand',.5]])
        put(prefix+suffix,'rotate',{time:t,angle:amp*Math.sin(w)*(name==='attack'?1.5:1)});
      for(const [side,g] of Object.entries(legs)) {
        let x=g.ankle.x,y=g.ankle.y,tilt=0;
        if(name==='walk') {
          const q=(phase+(side==='far'?.5:0))%1, stance=.62, stride=Math.min(g.l1+g.l2,140*stageScale)*.32;
          if(q<stance) x+=stride/2-stride*q/stance;
          else {const u=(q-stance)/(1-stance); x+=-stride/2+stride*smooth(u); y+=12*stageScale*Math.sin(Math.PI*u); tilt=-8*Math.sin(Math.PI*u);}
        }
        if(name==='attack'&&side==='near') {x+=12*stageScale*strike;y+=8*stageScale*pulse(t,.65,1.1);}
        if(name==='ultimate'&&side==='near') y+=18*stageScale*pulse(t,1.65,2.3);
        const local=rot([x-body.x-bx,y-body.y-by],-br), hx=g.hip.x-body.x,hy=g.hip.y-body.y;
        const dx=local[0]-hx,dy=local[1]-hy,d=clamp(Math.hypot(dx,dy),Math.abs(g.l1-g.l2)+.001,g.l1+g.l2-.001);
        const alpha=degrees(Math.acos(clamp((g.l1*g.l1+d*d-g.l2*g.l2)/(2*g.l1*d),-1,1)));
        const upper=degrees(Math.atan2(dy,dx))+g.bend*alpha;
        const knee=rot([g.l1,0],upper),lower=degrees(Math.atan2(local[1]-hy-knee[1],local[0]-hx-knee[0]));
        put(side+'Thigh','rotate',{time:t,angle:wrap(upper-setup[side+'Thigh'].rotation)});
        put(side+'Shin','rotate',{time:t,angle:wrap(lower-upper-setup[side+'Shin'].rotation)});
        put(side+'Foot','rotate',{time:t,angle:wrap(angle(g.ankle)+tilt-br-lower-setup[side+'Foot'].rotation)});
      }
    }
    animations[name]={bones};
  }
  return {animations,list:Object.entries(durations).map(([name,duration])=>({name,label:{idle:'Repaus',walk:'Mers',attack:'Mușcătură',ultimate:'Răget de jar'}[name],duration,loop:name==='idle'||name==='walk'}))};
}

for (const [ageId, age] of Object.entries(spec.ages)) {
  if(wanted.length&&!wanted.includes(ageId)) continue;
  const meta = build(spec, ageId), dir=path.join(LAB,'public/rigs',meta.id), P=age.points;
  const skeleton=JSON.parse(fs.readFileSync(path.join(dir,'skeleton.json'),'utf8'));
  const art=readPNG(path.join(dir,'art.png'));
  let x0=art.width,y0=art.height,x1=0,y1=0,opaqueX0=art.width,opaqueX1=0,ground=0;
  for(let y=0;y<art.height;y++)for(let x=0;x<art.width;x++){
    const a=art.data[(y*art.width+x)*4+3];
    if(a){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    if(a>40){opaqueX0=Math.min(opaqueX0,x);opaqueX1=Math.max(opaqueX1,x);ground=Math.max(ground,y);}
  }
  const s=900*spec.length*age.size/(opaqueX1-opaqueX0),cx=(opaqueX0+opaqueX1)/2;
  meta.artRect={x:-cx*s,y:(ground-art.height)*s,width:art.width*s,height:art.height*s};
  x0=Math.max(0,x0-2);y0=Math.max(0,y0-2);
  const world=([x,y])=>[meta.artRect.x+x*s,meta.artRect.y+(art.height-y)*s];
  let worlds=pose(skeleton);
  function addBone(name,parent,a,b) {
    const A=world(a),B=world(b),p=worlds[parent],pa=degrees(Math.atan2(p.c,p.a)),local=rot([A[0]-p.x,A[1]-p.y],-pa);
    skeleton.bones.push({name,parent,x:local[0],y:local[1],rotation:degrees(Math.atan2(B[1]-A[1],B[0]-A[0]))-pa,length:Math.hypot(B[0]-A[0],B[1]-A[1])});
    worlds=pose(skeleton);
  }
  for(const [part,a,b,parent] of [['Upper',P.farArm.shoulder,P.farArm.elbow,'chest'],['Fore',P.farArm.elbow,P.farArm.wrist,'farArmUpper'],['Hand',P.farArm.wrist,P.farArm.tip,'farArmFore']]) addBone('farArm'+part,parent,a,b);
  addBone('jaw','head',...P.jaw);
  const attachment=skeleton.skins[0].attachments.body.body;
  const points=[];
  for(let i=0;i<attachment.uvs.length;i+=2){
    const x=Math.round(attachment.uvs[i]*attachment.width),y=Math.round(attachment.uvs[i+1]*attachment.height);
    attachment.uvs[i]=x/attachment.width;attachment.uvs[i+1]=y/attachment.height;
    points.push(world([x0+x,y0+y]));
  }
  const boneIndexes=new Map(skeleton.bones.map((b,i)=>[b.name,i]));
  const R=age.regions, smooth01=(x)=>smooth(clamp(x,0,1));
  // Extend the nearest opaque surface into transparent mesh margins, so empty
  // space beside a claw never assigns it to the torso or another limb.
  const nearest=new Int32Array(art.width*art.height).fill(-1),queue=new Int32Array(nearest.length);let h=0,end=0;
  for(let i=0;i<nearest.length;i++) if(art.data[i*4+3]>32){nearest[i]=i;queue[end++]=i;}
  while(h<end){const i=queue[h++],x=i%art.width;for(const j of [x>0?i-1:-1,x<art.width-1?i+1:-1,i-art.width,i+art.width])if(j>=0&&j<nearest.length&&nearest[j]<0){nearest[j]=nearest[i];queue[end++]=j;}}
  const distChain=(q,names)=> {
    const w=world(q),scores=names.map(name=>{const b=worlds[name],angle=degrees(Math.atan2(b.c,b.a)),v=rot([skeleton.bones[boneIndexes.get(name)].length,0],angle);return[name,1/Math.max(14*s,segDist(w,[b.x,b.y],[b.x+v[0],b.y+v[1]]))**3];});
    const total=scores.reduce((sum,[,v])=>sum+v,0);return scores.map(([n,v])=>[n,v/total]);
  };
  const torso=(q)=>{
    if(inside(R.head,...q)){
      const strength=smooth01((P.neck[0][1]-q[1]+15)/130);
      return[['head',strength],['chest',1-strength]];
    }
    if(inside(R.tail,...q)){const strength=smooth01((P.tail[0][0]-q[0]+15)/120);return [['body',1-strength],...distChain(q,['tail1','tail2','tail3','tail4']).map(([n,v])=>[n,v*strength])];}
    if(inside(R.neck,...q)){
      const strength=smooth01((P.neck[0][1]-q[1]+15)/130);
      return [['chest',1-strength],...distChain(q,['neck1','neck2','head']).map(([n,v])=>[n,v*strength])];
    }
    const chest=smooth01((q[0]-P.body[0])/Math.max(60,P.chest[0]-P.body[0]));return[['body',1-chest],['chest',chest]];
  };
  const raw=(q)=>{
    for(const prefix of ['arm','farArm'])if(inside(R[prefix],...q)){
      const points=prefix==='arm'?P.arm:P.farArm,strength=smooth01(Math.hypot(q[0]-points.shoulder[0],q[1]-points.shoulder[1])/75);
      return [['chest',1-strength],...distChain(q,[prefix+'Upper',prefix+'Fore',prefix+'Hand']).map(([n,v])=>[n,v*strength])];
    }
    for(const side of ['near','far'])if(inside(R[side+'Leg'],...q)){
      const leg=P[side+'Leg'],strength=smooth01((q[1]-leg.hip[1]+15)/100),lower=smooth01((q[1]-leg.knee[1]+35)/70),foot=smooth01((q[1]-leg.ankle[1]+18)/36);
      return [...torso(q).map(([n,v])=>[n,v*(1-strength)]),[side+'Thigh',strength*(1-lower)*(1-foot)],[side+'Shin',strength*lower*(1-foot)],[side+'Foot',strength*foot]];
    }
    if(inside(R.jaw,...q))return[['jaw',1]];
    return torso(q);
  };
  const field=(q)=>{
    const result=new Map();
    const step=ageId==='adult'?12:24,radius=ageId==='adult'?18:32;
    for(const dy of [-2*step,-step,0,step,2*step])for(const dx of [-2*step,-step,0,step,2*step]){
      const x=clamp(Math.round(q[0]+dx),0,art.width-1),y=clamp(Math.round(q[1]+dy),0,art.height-1),i=nearest[y*art.width+x];
      const point=[i%art.width,Math.floor(i/art.width)],kernel=Math.exp(-(dx*dx+dy*dy)/(2*radius*radius));
      for(const[n,v]of raw(point))result.set(n,(result.get(n)||0)+v*kernel);
    }
    const sum=[...result.values()].reduce((a,b)=>a+b,0);return [...result].map(([n,v])=>[n,v/sum]).filter(([,v])=>v>1e-9);
  };
  const vertices=[];
  for(const pt of points){
    const q=[(pt[0]-meta.artRect.x)/s,art.height-(pt[1]-meta.artRect.y)/s],weights=field(q),sum=weights.reduce((a,[,v])=>a+v,0);
    vertices.push(weights.length);
    for(const[n,v]of weights){const b=worlds[n],a=degrees(Math.atan2(b.c,b.a)),local=rot([pt[0]-b.x,pt[1]-b.y],-a);vertices.push(boneIndexes.get(n),local[0],local[1],v/sum);}
  }
  attachment.vertices=vertices;
  const motion=authorMotion(skeleton,worlds,age.size,ageId);skeleton.animations=motion.animations;meta.animations=motion.list;
  fs.writeFileSync(path.join(dir,'skeleton.json'),JSON.stringify(skeleton));
  fs.writeFileSync(path.join(dir,'meta.json'),JSON.stringify(meta,null,2)+'\n');
  const out=path.join(PUBLIC,meta.id);fs.mkdirSync(out,{recursive:true});
  for(const name of ['skeleton.json','rig.atlas','rig.png'])fs.copyFileSync(path.join(dir,name),path.join(out,name));
  const atlas=fs.readFileSync(path.join(out,'rig.atlas'),'utf8');
  const mapAtlas=atlas.replace('rig.png','rig-map.webp').replace(/(size:|xy:|orig:|offset:)\s*(\d+),\s*(\d+)/g,(_,key,x,y)=>`${key} ${Math.round(Number(x)/2)},${Math.round(Number(y)/2)}`);
  fs.writeFileSync(path.join(out,'rig-map.atlas'),mapAtlas);
  const mapTexture=spawnSync('python',['-c',
    "from PIL import Image; import sys; im=Image.open(sys.argv[1]); im.resize((im.width//2,im.height//2),Image.Resampling.LANCZOS).save(sys.argv[2],'WEBP',quality=88,method=4)",
    path.join(out,'rig.png'),path.join(out,'rig-map.webp')],{stdio:'inherit'});
  if(mapTexture.status!==0)throw new Error('Unable to package Ignisaur map texture (Pillow required).');
  fs.copyFileSync(path.join(dir,'art.png'),path.join(out,'art.png'));
  const manifestPath=path.join(PUBLIC,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const entry={id:meta.id,name:meta.name,body:'biped',skeleton:`${meta.id}/skeleton.json`,atlas:`${meta.id}/rig.atlas`,texture:`${meta.id}/rig.png`,bounds:meta.bounds,animations:motion.list};
  manifest.rigs=manifest.rigs.filter(r=>r.id!==meta.id);manifest.rigs.push(entry);
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log(`Exported ${meta.id}: ${skeleton.bones.length} bones, one continuous painted mesh, four authored animations`);
}
const rigsPath=path.join(LAB,'public/rigs');
const index=fs.readdirSync(rigsPath,{withFileTypes:true})
  .filter(d=>d.isDirectory()&&fs.existsSync(path.join(rigsPath,d.name,'meta.json')))
  .map(d=>JSON.parse(fs.readFileSync(path.join(rigsPath,d.name,'meta.json'),'utf8')));
fs.writeFileSync(path.join(rigsPath,'index.json'),JSON.stringify({rigs:index},null,2)+'\n');
