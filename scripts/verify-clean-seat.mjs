/**
 * Numeric proof that the CLEAN block seats on the OUTER flat.
 * Mirrors jointBlockPlacement in src/data/turretSolids.ts, applies it to the
 * real toolblock-3x-clean.glb vertices, and reports (in the drum frame):
 *   • block +Z mounting-face radius   (target ≈ flat radius 19.7)
 *   • block body radial / axial range
 *   • tool-tip axial vs front face (+7.12)  → must overhang (>7.12)
 * Usage: node scripts/verify-clean-seat.mjs [station]
 */
import fs from "node:fs";

const joints = JSON.parse(fs.readFileSync(new URL("../src/data/turretJoints.json", import.meta.url), "utf8"));
const ring = JSON.parse(fs.readFileSync(new URL("../src/data/turretStations.json", import.meta.url), "utf8"));
const BLOCK = new URL("../src/assets/models/toolblock-3x-clean.glb", import.meta.url);

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sc=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a)=>{const m=Math.hypot(...a)||1;return[a[0]/m,a[1]/m,a[2]/m];};

const SEAT = { faceOffsetCm:0, radialNudgeCm:0, axialNudgeCm:0, scale:1 };

function placement(stationNumber){
  const st=joints.stations.find(s=>s.station===stationNumber);
  const center=joints.ringCenterGlb, axis=norm(joints.ringAxisGlb);
  const hole=st.origin;
  const dO=sub(hole,center);
  const radialOut=norm(sub(dO,sc(axis,dot(dO,axis))));
  const tX=axis, tZ=sc(radialOut,-1), tY=norm(cross(tZ,tX));
  const O=add(add(hole,sc(radialOut,SEAT.faceOffsetCm+SEAT.radialNudgeCm)),sc(axis,SEAT.axialNudgeCm));
  const s=SEAT.scale;
  return {m:[tX[0]*s,tX[1]*s,tX[2]*s,0, tY[0]*s,tY[1]*s,tY[2]*s,0, tZ[0]*s,tZ[1]*s,tZ[2]*s,0, O[0],O[1],O[2],1], center,axis,radialOut,tX,tY,tZ,hole};
}
function app(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}

function parseGlb(url){
  const buf=fs.readFileSync(url);const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  const total=dv.getUint32(8,true);let off=12,json=null,bin=null;
  while(off<total){const len=dv.getUint32(off,true);const t=dv.getUint32(off+4,true);off+=8;const c=buf.subarray(off,off+len);if(t===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(c));else if(t===0x004e4942)bin=c;off+=len;}
  return{json,bin};
}
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];r[i*4+j]=s;}return r;}
function verts({json,bin}){const world={};const visit=(i,p)=>{const n=json.nodes[i];const m=mul(p,n.matrix??I);world[i]=m;(n.children??[]).forEach(c=>visit(c,m));};const sc0=json.scenes[json.scene??0];(sc0.nodes??[]).forEach(r=>visit(r,I));const out=[];json.nodes.forEach((n,idx)=>{if(n.mesh===undefined)return;const wm=world[idx]??I;for(const pr of json.meshes[n.mesh].primitives){const a=json.accessors[pr.attributes.POSITION];const bv=json.bufferViews[a.bufferView];const stride=bv.byteStride??12;const base=(bv.byteOffset??0)+(a.byteOffset??0);const d=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);for(let i=0;i<a.count;i++){const o=base+i*stride;out.push(app(wm,[d.getFloat32(o,true),d.getFloat32(o+4,true),d.getFloat32(o+8,true)]));}}});return out;}

const stationNum=Number(process.argv[2]??1);
const pl=placement(stationNum);
const raw=verts(parseGlb(BLOCK));
const placed=raw.map(p=>app(pl.m,p));
// drum-frame coords
const co=placed.map(p=>{const d=sub(p,pl.center);const ax=dot(d,pl.axis);const rad=Math.hypot(...sub(d,sc(pl.axis,ax)));const rd=dot(sub(d,sc(pl.axis,ax)),pl.radialOut);return{ax,rad,rd};});
const axs=co.map(c=>c.ax), rads=co.map(c=>c.rad);
// mounting face = block local +Z max (z=1.2). find placed point of local [0.75,-2.52,1.2] approx body centre face
const faceCentreLocal=[0.75,-2.52,1.2];
const faceW=app(pl.m,faceCentreLocal);
const dF=sub(faceW,pl.center);const faceAx=dot(dF,pl.axis);const faceRad=Math.hypot(...sub(dF,sc(pl.axis,faceAx)));
const mcsW=app(pl.m,[0,0,0]);const dM=sub(mcsW,pl.center);const mcsRad=Math.hypot(...sub(dM,sc(pl.axis,dot(dM,pl.axis))));
const dH=sub(pl.hole,pl.center); const holeAx=dot(dH,pl.axis); const holeRad=dot(sub(dH,sc(pl.axis,holeAx)),pl.radialOut);
console.log(`station ${stationNum}  (drum frame; front face axial=+${ring.frontAxial})`);
console.log(`  locating hole (joint origin): radius ${holeRad.toFixed(3)}  axial ${holeAx.toFixed(3)}   O=[${pl.hole.map(x=>x.toFixed(3))}]`);
console.log(`  seat O=[${[pl.m[12],pl.m[13],pl.m[14]].map(x=>x.toFixed(3))}]`);
console.log(`  MCS origin: radius ${mcsRad.toFixed(3)}  axial ${dot(dM,pl.axis).toFixed(3)}`);
console.log(`  +Z mounting-face centre: radius ${faceRad.toFixed(3)}  axial ${faceAx.toFixed(3)}`);
console.log(`  mountFaceGap (face radius - hole radius): ${((faceRad-holeRad)*10).toFixed(2)} mm  (0 = face on flat)`);
console.log(`  Z-axis-through-hole check: face axial ${faceAx.toFixed(3)} vs hole axial ${holeAx.toFixed(3)} (Δ ${((faceAx-holeAx)*10).toFixed(2)} mm)`);
console.log(`  block radial range: [${Math.min(...rads).toFixed(2)}, ${Math.max(...rads).toFixed(2)}]`);
console.log(`  block axial range : [${Math.min(...axs).toFixed(2)}, ${Math.max(...axs).toFixed(2)}]  (max = tool tips; front=+${ring.frontAxial})`);
console.log(`  tools overhang front by: ${(Math.max(...axs)-ring.frontAxial).toFixed(2)} cm`);
