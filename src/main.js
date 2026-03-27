
// procedural walk example ported from the unbound engine puppet: https://unbound.io/
// ported using gemini in 20 minutes, don't bash me for the code quality :p 

// to run, cd into the autoWalk root dir, then run
// npm install
// npm run dev

import './style.css';
import * as THREE from 'three';
import app from './firebase.js'; // Ensures firebase initializes
import { Character } from './Character.js';
import { LineUtil } from './LineUtil.js';

console.log("Firebase initialized:", app.name);

const container = document.getElementById('app');
if (!container) throw new Error("No #app container found");

// Setup scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Setup camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 10);
camera.lookAt(0, 2, 0);

// Setup renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Setup Mouse Controls
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Setup 1 Character
const char = new Character(scene, {
  hipHeight: 4.0,
  legsDistance: 1.5
});

const targetPos = new THREE.Vector3();
const charVel = new THREE.Vector3();

// Setup Physics Parameters
const maxSpeed = 100.0;
const acceleration = 10.0;
const deceleration = 10.0;

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();
  
  LineUtil.clear();

  // Project Mouse onto Ground Plane
  raycaster.setFromCamera(mouse, camera);
  const intersectPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
    targetPos.copy(intersectPoint);
  }

  // 1. Calculate direction to mouse target (Seek)
  let desiredVelocity = new THREE.Vector3();
  
  // Integrate Z to converge on target.z, but looser
  const looseDeceleration = deceleration * 0.5; // Looser deceleration on Z
  const looseMaxSpeed = maxSpeed * 0.8; // Slightly slower max speed on Z
  const distZ = Math.abs(targetPos.z - char.rootCube.position.z);
  if (distZ > 0.001) {
    const safeSpeed = Math.sqrt(2 * looseDeceleration * distZ);
    const speedToTarget = Math.min(looseMaxSpeed, safeSpeed);
    desiredVelocity.z = Math.sign(targetPos.z - char.rootCube.position.z) * speedToTarget;
  }

  // Pull X tightly
  const distX = Math.abs(targetPos.x - char.rootCube.position.x);
  if (distX > 0.001) {
    const safeSpeed = Math.sqrt(2 * deceleration * distX);
    const speedToTarget = Math.min(maxSpeed, safeSpeed);
    desiredVelocity.x = Math.sign(targetPos.x - char.rootCube.position.x) * speedToTarget;
  }

  // 2. Apply Acceleration / Deceleration
  const velocityDiff = new THREE.Vector3().subVectors(desiredVelocity, charVel);
  const diffLen = velocityDiff.length();

  if (diffLen > 0) {
    const isAccelerating = desiredVelocity.lengthSq() > charVel.lengthSq();
    const rate = isAccelerating ? acceleration : deceleration;
    const change = Math.min(diffLen, rate * deltaTime);
    charVel.add(velocityDiff.normalize().multiplyScalar(change));
  }

  // 3. Update character position
  char.rootCube.position.add(charVel.clone().multiplyScalar(deltaTime));
  char.update(deltaTime);

  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
