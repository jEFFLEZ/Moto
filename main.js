import { buildTrack } from "./track.js";
export function startGame({ THREE, CANNON, buildTrack }){
  // --- Scene ---
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e14);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,6,12);

  const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x091018, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(30,60,30);
  sun.castShadow = false;
  scene.add(sun);

  // Sol (collider pour le raycast)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), new THREE.MeshStandardMaterial({color:0x0e141b, roughness:1}));
  plane.rotation.x = -Math.PI/2;
  plane.position.y = -0.02;
  plane.receiveShadow = true;
  scene.add(plane);

  // --- Track ---
  const track = buildTrack(THREE);
  track.road.position.y = 0; scene.add(track.shoulder); scene.add(track.road);

  // Ligne centrale (joli)
  {
    const line = new THREE.Group();
    const dashGeo = new THREE.BoxGeometry(0.2, 0.02, 1.6);
    const dashMat = new THREE.MeshStandardMaterial({ color:0xb7c9ff });
    const segs = 240;
    for(let i=0;i<segs;i++){
      const t=i/segs;
      const p=track.curve.getPointAt(t);
      const tan=track.curve.getTangentAt(t);
      const m=new THREE.Mesh(dashGeo,dashMat);
      m.position.set(p.x,0.01,p.z);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), new THREE.Vector3(tan.x,0,tan.z).normalize());
      line.add(m);
    }
    scene.add(line);
  }

  // --- Physics world ---
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0,-9.82,0) });
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 12;

  // Ground body
  const groundMat = new CANNON.Material('ground');
  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMat
  });
  groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
  world.addBody(groundBody);

  // --- Bike (RaycastVehicle) ---
  const chassisShape = new CANNON.Box(new CANNON.Vec3(0.6,0.3,1.0));
  const chassisBody = new CANNON.Body({ mass: 180, shape: chassisShape, position: new CANNON.Vec3(track.curve.getPointAt(0).x, 0.5, track.curve.getPointAt(0).z) });
  world.addBody(chassisBody);

  const wheelMaterial = new CANNON.Material('wheel');
  const wheelOptions = {
    radius: 0.35,
    directionLocal: new CANNON.Vec3(0,-1,0),
    suspensionStiffness: 35,
    suspensionRestLength: 0.25,
    frictionSlip: 2.0,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4,
    axleLocal: new CANNON.Vec3(1,0,0),
    chassisConnectionPointLocal: new CANNON.Vec3(0,0,0),
    maxSuspensionForce: 1e4,
    maxSuspensionTravel: 0.35,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  };
  const vehicle = new CANNON.RaycastVehicle({ chassisBody });
  // roue avant
  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0.9), radius:0.33 });
  // roue arrière
  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(0, 0, -0.9), radius:0.36 });
  vehicle.addToWorld(world);

  const wheelBodies = [];
  vehicle.wheelInfos.forEach((wheel)=>{
    const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, 0.22, 16);
    const wheelBody = new CANNON.Body({ mass: 1, material: wheelMaterial });
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(0,0,1), Math.PI/2);
    wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
    wheelBodies.push(wheelBody);
    world.addBody(wheelBody);
  });

  // Visuel moto simple
  const moto = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6*2,0.3*2,1.0*2), new THREE.MeshStandardMaterial({color:0xf5f6f8, metalness:0.1, roughness:0.6}));
  body.position.y = 0.35;
  const accent1 = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.15,0.6), new THREE.MeshStandardMaterial({color:0x7cdfff}));
  accent1.position.set(0.0,0.55,0.1);
  const accent2 = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.15,0.5), new THREE.MeshStandardMaterial({color:0xff8aa0}));
  accent2.position.set(0.0,0.55,-0.2);
  moto.add(body, accent1, accent2);
  const wheelFront = new THREE.Mesh(new THREE.TorusGeometry(0.33,0.06,12,24), new THREE.MeshStandardMaterial({color:0x222222}));
  wheelFront.rotation.x = Math.PI/2; wheelFront.position.set(0,0.35,0.9);
  const wheelRear = wheelFront.clone(); wheelRear.position.set(0,0.35,-0.9); wheelRear.scale.set(1.05,1.05,1.05);
  moto.add(wheelFront, wheelRear);
  scene.add(moto);

  // --- Input ---
  const input = { steer:0, throttle:0, brake:0, handbrake:false };
  const keys = {};
  window.addEventListener('keydown', e=>{ keys[e.code]=true; });
  window.addEventListener('keyup', e=>{ keys[e.code]=false; });

  // Touch pads
  const padL = document.getElementById('padL'), stickL = document.getElementById('stickL');
  const padR = document.getElementById('padR'), stickR = document.getElementById('stickR');
  bindPad(padL, stickL, (dx,dy)=>{ input.steer = clamp(dx,-1,1); });
  bindPad(padR, stickR, (dx,dy)=>{ input.throttle = clamp(-dy,0,1); input.brake = clamp(dy>0?dy:0,0,1); });

  function bindPad(pad, stick, cb){
    let active=false, id=null, cx=0, cy=0, r=0;
    function pos(t){ const rect=pad.getBoundingClientRect(); return {x:(t.clientX-rect.left), y:(t.clientY-rect.top)};}
    function start(t){ if(active) return; active=true; id=t.pointerId; pad.setPointerCapture(id); const rect=pad.getBoundingClientRect(); cx=rect.width/2; cy=rect.height/2; r=rect.width/2; move(t); }
    function move(t){ if(!active||t.pointerId!==id) return; const p=pos(t); let dx=p.x-cx, dy=p.y-cy; const m=Math.hypot(dx,dy); if(m>r){ dx*=r/m; dy*=r/m; } stick.style.left=(50+dx/r*50)+'%'; stick.style.top=(50+dy/r*50)+'%'; cb(dx/r,dy/r); }
    function end(t){ if(!active||t.pointerId!==id) return; active=false; try{pad.releasePointerCapture(id)}catch{}; stick.style.left='50%'; stick.style.top='50%'; cb(0,0); }
    pad.addEventListener('pointerdown', start); pad.addEventListener('pointermove', move); pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  }

  // --- HUD ---
  const spdEl = document.getElementById('spd'), lapEl=document.getElementById('lap'), timeEl=document.getElementById('time'), bestEl=document.getElementById('best');
  let laps=0, best=null, lapStart=performance.now(), nextCP=0;

  // --- Helpers ---
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function fmt(ms){ const m = Math.floor(ms/60000); ms-=m*60000; const s=Math.floor(ms/1000); const r=Math.floor(ms%1000); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(r).padStart(3,'0')}`; }

  // --- Game loop ---
  let last = performance.now();
  function tick(now){
    requestAnimationFrame(tick);
    const dt = Math.min(1/60, (now-last)/1000); last=now;

    // Keyboard/gamepad
    const up = keys['ArrowUp']||keys['KeyW']||false;
    const dn = keys['ArrowDown']||keys['KeyS']||false;
    const lf = keys['ArrowLeft']||keys['KeyA']||false;
    const rt = keys['ArrowRight']||keys['KeyD']||false;
    const hb = keys['Space']||false;
    input.throttle = Math.max(input.throttle, up?1:0);
    input.brake = Math.max(input.brake, dn?1:0);
    input.steer += ((lf?-1:0)+(rt?1:0) - input.steer)*0.2;
    input.handbrake = hb;

    // Arcade params
    const MAX_ENGINE = 1800;          // moteur “virtuel”
    const MAX_STEER  = 0.45;
    const BRAKE_FORCE = 45;
    const HBRAKE_FORCE = 80;

    // Off-track slowdown: si on dépasse ROAD_HALF*1.15 → on réduit moteur
    const pos = chassisBody.position;
    const { lat } = track.lateralInfo(pos.x, pos.z);
    const onTrack = Math.abs(lat) <= track.ROAD_HALF*1.15;
    const gripMul = onTrack?1:0.55;

    // Appliquer aux roues (deux roues index 0=avant,1=arrière)
    vehicle.setSteeringValue(clamp(input.steer, -1,1)*MAX_STEER*gripMul, 0);
    vehicle.setSteeringValue(0, 1);

    const engine = (input.throttle*MAX_ENGINE)*(onTrack?1:0.55);
    vehicle.applyEngineForce(-engine, 1); // propulsion par roue arrière (négatif dans Cannon)
    vehicle.applyEngineForce(0, 0);

    const brake = (input.brake? BRAKE_FORCE:0) + (input.handbrake? HBRAKE_FORCE:0);
    vehicle.setBrake(brake, 0);
    vehicle.setBrake(brake, 1);

    world.step(1/60, dt);

    // Sync visuel
    moto.position.copy(chassisBody.position);
    moto.quaternion.copy(chassisBody.quaternion);

    // Caméra chase avec look-ahead
    const forward = new THREE.Vector3(0,0,1).applyQuaternion(moto.quaternion);
    const camTarget = moto.position.clone().add(forward.clone().multiplyScalar(4)).add(new THREE.Vector3(0,1.5,0));
    const camPos = moto.position.clone().add(forward.clone().multiplyScalar(-10)).add(new THREE.Vector3(0,4,0));
    camera.position.lerp(camPos, 0.12);
    camera.lookAt(camTarget);

    // MàJ roues (visuel seulement)
    vehicle.wheelInfos.forEach((wheel, i)=>{
      vehicle.updateWheelTransform(i);
      const t = wheel.worldTransform;
      const mesh = i===0 ? wheelFront : wheelRear;
      mesh.position.set(t.position.x, t.position.y, t.position.z);
      mesh.quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);
    });

    // Checkpoints / tours
    const cp = track.checkpoints[nextCP];
    if(cp){
      const v = new THREE.Vector3(pos.x-cp.p.x, 0, pos.z-cp.p.z);
      const pass = v.length() < track.ROAD_HALF*1.2 && Math.abs(v.dot(cp.n)) < track.ROAD_HALF*0.9;
      if(pass){
        nextCP++;
        if(nextCP>=track.checkpoints.length){
          nextCP=0; laps++;
          const lapTime = now - lapStart;
          if(!best || lapTime<best) best=lapTime;
          lapStart = now;
        }
      }
    }

    // HUD
    const spd = chassisBody.velocity.length()*3.6;
    document.getElementById('spd').textContent = Math.round(spd);
    document.getElementById('lap').textContent = Math.min(laps,3);
    document.getElementById('time').textContent = fmt(now - lapStart);
    document.getElementById('best').textContent = best?fmt(best):'--:--.---';

    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  // Resize
  window.addEventListener('resize', ()=>{
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });
}
