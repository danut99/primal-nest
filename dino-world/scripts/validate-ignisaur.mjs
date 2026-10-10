// Dense motion validation, including poses between the 30 Hz authored keys.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRig, meshes, pose } from '../../rig-lab/scripts/lib/spine.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report=[];
const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
for(const age of ['pui','juvenil','adult']){
  const id=`ignisaur-${age}`,rig=loadRig(path.resolve(ROOT,'../rig-lab/public/rigs',id)),errors=[];
  const rest=meshes(rig,pose(rig.skeleton)).body;
  const vertices=rig.skeleton.skins[0].attachments.body.body.vertices;
  for(let i=0;i<vertices.length;){const n=vertices[i++];let sum=0;for(let j=0;j<n;j++){sum+=vertices[i+3];i+=4;}if(Math.abs(sum-1)>1e-8)errors.push('Skin weights are not normalized');}
  let frames=0,flipped=0,minArea=1;
  for(const animation of rig.meta.animations){
    const n=Math.ceil(animation.duration*60);
    for(let frame=0;frame<=n;frame++){
      const t=animation.duration*frame/n,current=meshes(rig,pose(rig.skeleton,animation.name,t)).body;
      frames++;
      for(let i=0;i<rest.triangles.length;i+=3){
        const ids=rest.triangles.slice(i,i+3),original=area(...ids.map(i=>rest.pts[i])),now=area(...ids.map(i=>current.pts[i]));
        if(!Number.isFinite(now))errors.push('Non-finite mesh coordinates');
        if(Math.abs(original)<1e-6)continue;
        const ratio=now/original;minArea=Math.min(minArea,ratio);
        if(ratio<=0){flipped++;if(flipped===1)errors.push(`${animation.name} at ${t.toFixed(3)}s: folded triangle`);}
      }
    }
    if(animation.loop){
      const first=meshes(rig,pose(rig.skeleton,animation.name,0)).body,last=meshes(rig,pose(rig.skeleton,animation.name,animation.duration)).body;
      const seam=Math.max(...first.pts.map((p,i)=>Math.hypot(p[0]-last.pts[i][0],p[1]-last.pts[i][1])));
      if(seam>.001)errors.push(`${animation.name}: animation loop jumps by ${seam}`);
    }
  }
  const item={id,bones:rig.skeleton.bones.length,frames,flipped,minAreaRatio:minArea,errors,ok:errors.length===0};
  report.push(item);console.log(JSON.stringify(item));
}
fs.mkdirSync(path.join(ROOT,'output/ignisaur'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'output/ignisaur/rig-validation.json'),JSON.stringify(report,null,2)+'\n');
if(report.some(r=>!r.ok))process.exitCode=1;
