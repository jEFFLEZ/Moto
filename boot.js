import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";

import { buildTrack } from "./track.js";
import { startGame } from "./main.js";

window.THREE = THREE; window.CANNON = CANNON; window.OrbitControls = OrbitControls;
startGame({ THREE, CANNON, buildTrack });
