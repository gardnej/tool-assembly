/**
 * Measure the turret GLB's outer-flat radius and axial band per station sector,
 * plus overall radius/axial profile. Read-only diagnostics for seating.
 * Usage: node scripts/measure-turret-flat.mjs [station]
 */
import fs from "node:fs";

const ring = JSON.parse(
  fs.readFileSync(new URL("../src/data/turretStations.json", import.meta.url), "utf8"),
);
const joints = JSON.parse(
  fs.readFileSync(new URL("../src/data/turretJoints.json", import.meta.url), "utf8"),
);
const TURRET = new URL("../src/assets/models/turret-haas-st20y.glb", import.meta.url);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = (a) => { const m = Math.hypot(...a)||1; return [a[0]/m,a[1]/m,a[2]/m]; };

function parseGlb(url) {
  const buf = fs.readFileSync(url);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const total = dv.getUint32(8, true);
  let offset = 12, json = null, bin = null;
  while (offset < total) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    offset += 8;
    const chunk = buf.subarray(offset, offset + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    offset += len;
  }
  return { json, bin };
}
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];r[i*4+j]=s;}return r;}
function app(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function readVerts({json,bin}){
  const world={};
  const visit=(i,par)=>{const n=json.nodes[i];const m=mul(par,n.matrix??identity);world[i]=m;(n.children??[]).forEach(c=>visit(c,m));};
  const scene=json.scenes[json.scene??0];(scene.nodes??[]).forEach(r=>visit(r,identity));
  const out=[];
  json.nodes.forEach((node,index)=>{
    if(node.mesh===undefined)return;const wm=world[index]??identity;
    for(const prim of json.meshes[node.mesh].primitives){
      const acc=json.accessors[prim.attributes.POSITION];
      const bv=json.bufferViews[acc.bufferView];
      const stride=bv.byteStride??12;const base=(bv.byteOffset??0)+(acc.byteOffset??0);
      const dv=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
      for(let i=0;i<acc.count;i++){const o=base+i*stride;out.push(app(wm,[dv.getFloat32(o,true),dv.getFloat32(o+4,true),dv.getFloat32(o+8,true)]));}
    }
  });
  return out;
}

const center = ring.center;
const axis = norm(ring.axis);
const verts = readVerts(parseGlb(TURRET));

// overall
let axMin=Infinity,axMax=-Infinity,radMax=-Infinity,radMin=Infinity;
for(const p of verts){const d=sub(p,center);const ax=dot(d,axis);const rad=Math.hypot(...sub(d,axis.map(a=>a*ax)));axMin=Math.min(axMin,ax);axMax=Math.max(axMax,ax);radMax=Math.max(radMax,rad);radMin=Math.min(radMin,rad);}
console.log(`TURRET overall: axial [${axMin.toFixed(2)}, ${axMax.toFixed(2)}]  radial [${radMin.toFixed(2)}, ${radMax.toFixed(2)}]`);
console.log(`ring.radius=${ring.radius} labelRadius=${ring.labelRadius} frontAxial=${ring.frontAxial}`);

const stationNum = Number(process.argv[2] ?? 1);
const jst = joints.stations.find(s=>s.station===stationNum);
const O = jst.origin;
const dO = sub(O, center);
const axialO = dot(dO, axis);
const radialDir = norm(sub(dO, axis.map(a=>a*axialO)));
const tangent = norm(cross(axis, radialDir));
console.log(`\nStation ${stationNum}: joint origin axial=${axialO.toFixed(3)} radius=${Math.hypot(...sub(dO,axis.map(a=>a*axialO))).toFixed(3)}`);

// vertices within +-12deg tangential sector of this station's radial dir, look at radius vs axial
const sector = [];
for(const p of verts){
  const d=sub(p,center);const ax=dot(d,axis);
  const radialVec=sub(d,axis.map(a=>a*ax));
  const rad=Math.hypot(...radialVec);
  const rd=dot(radialVec,radialDir)/ (rad||1);
  const tan=dot(radialVec,tangent);
  const ang=Math.atan2(tan, dot(radialVec,radialDir))*180/Math.PI;
  if(Math.abs(ang)<12 && rad>10){ sector.push({ax,rad,tan,ang}); }
}
sector.sort((a,b)=>b.rad-a.rad);
const topRad = sector.slice(0, Math.max(1,Math.floor(sector.length*0.02)));
const outerR = topRad.reduce((s,v)=>s+v.rad,0)/topRad.length;
console.log(`  sector pts=${sector.length}  outer flat radius (top 2%): ${outerR.toFixed(3)}`);
// axial band of the outermost ring of vertices (within 0.5cm of outerR)
const band = sector.filter(v=>v.rad>outerR-0.6);
const bandAx = band.map(v=>v.ax);
console.log(`  outer-flat axial extent: [${Math.min(...bandAx).toFixed(3)}, ${Math.max(...bandAx).toFixed(3)}]  (n=${band.length})`);
console.log(`  outer-flat axial mid: ${((Math.min(...bandAx)+Math.max(...bandAx))/2).toFixed(3)}`);
