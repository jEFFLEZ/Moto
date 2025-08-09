// NE RIEN IMPORTER ICI
export function buildTrack(THREE){
  const pts = [];
  for(let a=0;a<Math.PI*2;a+=Math.PI/40){
    const r = 180 + 80*Math.sin(2*a);
    const x = (r+20*Math.sin(a*3.1))*Math.cos(a);
    const z = (r+20*Math.cos(a*2.7))*Math.sin(a*1.02);
    pts.push(new THREE.Vector3(x,0,z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.2);

  const ROAD_HALF = 6.0; // m
  const segs = 800;
  const positions = new Float32Array(segs*2*3);
  const uvs = new Float32Array(segs*2*2);
  const indices = [];
  let idx=0, uidx=0;

  for(let i=0;i<segs;i++){
    const t = i/(segs-1);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const left = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const a = p.clone().addScaledVector(left, -ROAD_HALF);
    const b = p.clone().addScaledVector(left,  ROAD_HALF);
    positions[idx++]=a.x; positions[idx++]=a.y; positions[idx++]=a.z;
    positions[idx++]=b.x; positions[idx++]=b.y; positions[idx++]=b.z;
    uvs[uidx++]=0; uvs[uidx++]=t*60;
    uvs[uidx++]=1; uvs[uidx++]=t*60;
    if(i<segs-1){
      const base=i*2;
      indices.push(base,base+1,base+2, base+1,base+3,base+2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const road = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x3a475a, roughness:0.9, metalness:0.0 })
  );
  road.receiveShadow = true;

  const shoulderGeo = geo.clone();
  const shoulder = new THREE.Mesh(
    shoulderGeo,
    new THREE.MeshStandardMaterial({ color:0x293241, roughness:1 })
  );
  shoulder.scale.set(1.35,1,1.35);
  shoulder.position.y = -0.01;

  const CP_EVERY = 80;
  const checkpoints = [];
  for(let i=0;i<segs;i+=CP_EVERY){
    const t=i/(segs-1);
    const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t).normalize();
    const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    checkpoints.push({ p, n });
  }

  function lateralInfo(x,z){
    const P = new THREE.Vector3(x,0,z);
    let bestD=Infinity, bestP=null, bestN=null;
    const steps=200;
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const p=curve.getPointAt(t);
      const d=P.distanceToSquared(p);
      if(d<bestD){
        bestD=d; bestP=p;
        const tan = curve.getTangentAt(t).normalize();
        bestN = new THREE.Vector3(-tan.z,0,tan.x).normalize();
      }
    }
    const to = new THREE.Vector3().subVectors(P,bestP);
    const lat = to.dot(bestN);
    return { lat, p:bestP, n:bestN, dist:Math.sqrt(bestD) };
  }

  return { curve, road, shoulder, checkpoints, ROAD_HALF, lateralInfo };
}
