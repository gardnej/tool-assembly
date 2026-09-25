/**
 * Measure, per station, the turret's mounting-flat contact radius AT THE
 * LOCATING HOLE (the joint origin), plus the joint origin's axial/radius, so
 * the block seat can be anchored deterministically to the hole.
 * Usage: node scripts/measure-hole-flat.mjs [station]
 */
import fs from "node:fs";

const joints = JSON.parse(fs.readFileSync(new URL("../src/data/turretJoints.json", import.meta.url), "utf8"));
const ring = JSON.parse(fs.readFileSync(new URL("../src/data/turretStations.json", import.meta.url), "utf8"));
const TURRET = new URL("../src/assets/models/turret-haas-st20y.glb", import.meta.url);

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a)=>{const m=Math.hypot(...a)||1;return[a[0]/m,a[1]/m,a[2]/m];};
const sc=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];

function parseGlb(url){const buf=fs.readFileSync(url);const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);const total=dv.getUint32(8,true);let off=12,json=null,bin=null;while(off<total){const len=dv.getUint32(off,true);const t=dv.getUint32(off+4,true);off+=8;const c=buf.subarray(off,off+len);if(t===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(c));else if(t===0x004e4942)bin=c;off+=len;}return{json,bin};}
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];r[i*4+j]=s;}return r;}
function app(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function verts({json,bin}){const world={};const visit=(i,p)=>{const n=json.nodes[i];const m=mul(p,n.matrix??I);world[i]=m;(n.children??[]).forEach(c=>visit(c,m));};const s0=json.scenes[json.scene??0];(s0.nodes??[]).forEach(r=>visit(r,I));const out=[];json.nodes.forEach((n,idx)=>{if(n.mesh===undefined)return;const wm=world[idx]??I;for(const pr of json.meshes[n.mesh].primitives){const a=json.accessors[pr.attributes.POSITION];const bv=json.bufferViews[a.bufferView];const stride=bv.byteStride??12;const base=(bv.byteOffset??0)+(a.byteOffset??0);const d=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);for(let i=0;i<a.count;i++){const o=base+i*stride;out.push(app(wm,[d.getFloat32(o,true),d.getFloat32(o+4,true),d.getFloat32(o+8,true)]));}}});return out;}

const center=joints.ringCenterGlb, axis=norm(joints.ringAxisGlb);
const V=verts(parseGlb(TURRET));

function measure(stn){
  const O=joints.stations.find(s=>s.station===stn).origin;
  const dO=sub(O,center);
  const axO=dot(dO,axis);
  const radVec=sub(dO,sc(axis,axO));
  const rO=Math.hypot(...radVec);
  const radialOut=norm(radVec);
  const tangent=norm(cross(axis,radialOut));
  // vertices near the hole in (axial, tangential) — a tight patch on the flat
  const near=[];
  for(const p of V){const d=sub(p,center);const ax=dot(d,axis);const rv=sub(d,sc(axis,ax));const rad=dot(rv,radialOut);const tan=dot(rv,tangent);
    if(Math.abs(ax-axO)<2.0 && Math.abs(tan)<2.0){ near.push({ax,rad,tan}); }
  }
  near.sort((a,b)=>b.rad-a.rad);
  const top=near.slice(0,Math.max(1,Math.floor(near.length*0.05)));
  const flatR=top.reduce((s,v)=>s+v.rad,0)/top.length;
  // also the outermost single radius in the patch
  const maxR=near[0]?.rad;
  return {axO,rO,flatR,maxR,n:near.length};
}

const list = process.argv[2]?[Number(process.argv[2])]:[1,4,7,10];
console.log(`ring center=${center.map(x=>x.toFixed(2))} axis=${axis.map(x=>x.toFixed(4))} frontAxial=${ring.frontAxial}`);
for(const s of list){const m=measure(s);
  console.log(`st ${s}: joint origin axial=${m.axO.toFixed(3)} radius=${m.rO.toFixed(3)} | flat contact radius near hole (top5%)=${m.flatR.toFixed(3)}  max=${m.maxR.toFixed(3)}  (n=${m.n})`);
}
