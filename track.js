// Génère une piste: courbe fermée + ruban extrudé + checkpoints
export function buildTrack(THREE){
  const pts = [];
  const seedRand = (i)=> Math.sin(i*1337.77)*0.5+0.5;
  for(let a=0;a<Math.PI*2;a+=Math.PI/40){
    const r = 180 + 80*Math.sin(2*a);
    const x = (r+20*Math.sin(a*3.1))*Math.cos(a);
    const z = (r+20*Math.cos(a*2.7))*Math.sin(a*1.02);
    pts.push(new THREE.Vector3(x,0,z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.2);

  // Géométrie route (ruban plat extrudé le long de la courbe)
  const ROAD_HALF = 6.0; // m
  const segs = 800;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(segs*2*3);
  const uvs = new Float32Array(segs*2*2);
  const indices = [];
  let idx=0, uidx=0;

  let prevTangent = new THREE.Vector3(1,0,0);
  for(let i=0;i<segs;i++){
    const t = i/(segs-1);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    // normal latérale (XZ)
    const left = new THREE.Vector3(-tan.z,0,tan.x).normalize(); // croix (up=[0,1,0])
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
    prevTangent.copy(tan);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Mat route simple (dégradé)
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a475a, roughness:0.9, metalness:0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // Bas-côtés
  const shoulderGeo = geo.clone();
  const shoulderMat = new THREE.MeshStandardMaterial({ color:0x293241, roughness:1 });
  const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
  shoulder.scale.set(1.35,1,1.35);
  shoulder.position.y = -0.01;

  // Checkpoints (tous les N)
  const CP_EVERY = 80;
  const checkpoints = [];
  for(let i=0;i<segs;i+=CP_EVERY){
    const t=i/(segs-1);
    const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t).normalize();
    const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    checkpoints.push({ p, n }); // p: Vector3, n: latérale
  }

  // Helper distance latérale pour gestion off-track
  function lateralInfo(x,z){
    // On échantillonne la courbe pour approx. le point le plus proche
    let bestT = 0, bestD = Infinity, bestP = null, bestN = null;
    const P = new THREE.Vector3(x,0,z);
    const steps=200;
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const p=curve.getPointAt(t);
      const d=P.distanceToSquared(p);
      if(d<bestD){
        bestD=d; bestT=t; bestP=p;
        const tan = curve.getTangentAt(t).normalize();
        bestN = new THREE.Vector3(-tan.z,0,tan.x).normalize();
      }
    }
    const to = new THREE.Vector3().subVectors(P,bestP);
    const lat = to.dot(bestN); // <0: côté gauche, >0: droite
    return { lat, p:bestP, n:bestN, t:bestT, dist:Math.sqrt(bestD) };
  }

  return { curve, road:mesh, shoulder, checkpoints, ROAD_HALF, lateralInfo };
}
