import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FPSController } from './controllers/FPSController';
import { createGround } from './objects/Ground';
import { createSky } from './objects/Sky';
import { setupLights } from './utils/Lights';
import { createCube, createRandomCubes } from './objects/Cube';

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
// Set explicit background color
scene.background = new THREE.Color(0x87CEEB);
// No fog for now until we get the basic scene working
// scene.fog = new THREE.FogExp2(0x88BBFF, 0.0025);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance' 
});
renderer.setClearColor(0x87CEEB, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Initialize Rapier physics
let physics: {
  world: RAPIER.World;
  rigidBodies: Map<THREE.Mesh, RAPIER.RigidBody>;
};

let fpsController: FPSController;
let lastTime = 0;
let cubes: { mesh: THREE.Mesh, rigidBody: RAPIER.RigidBody }[] = [];

// Initialize the game
async function init() {
  // Initialize Rapier
  await RAPIER.init();
  
  // Create physics world
  physics = {
    world: new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    rigidBodies: new Map()
  };

  // Create ground
  const ground = createGround(physics);
  scene.add(ground);

  // Create sky
  const sky = createSky();
  scene.add(sky);

  // Setup lights
  setupLights(scene);

  // Create a stack of cubes in the center
  const stackCubes = createStackedCubes(physics, 5, 5, { x: -8, y: 0, z: 0 });
  cubes.push(...stackCubes);
  stackCubes.forEach(cube => scene.add(cube.mesh));

  // Create some random cubes around the scene
  const randomCubes = createRandomCubes(physics, 20, 15, 8);
  cubes.push(...randomCubes);
  randomCubes.forEach(cube => scene.add(cube.mesh));

  // Setup FPS controller
  fpsController = new FPSController(camera, physics, renderer.domElement);
  fpsController.position.set(0, 5, 10);
  scene.add(fpsController.object);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  requestAnimationFrame(animate);
}

// Create a stack of cubes
function createStackedCubes(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Mesh, RAPIER.RigidBody> },
  width: number,
  height: number,
  position: { x: number, y: number, z: number }
) {
  const cubes = [];
  const cubeSize = 1;
  
  // Create a stack of cubes
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - (y % 2); x++) {
      for (let z = 0; z < width - (y % 2); z++) {
        // Alternate layers for stability
        const offsetX = y % 2 === 0 ? 0 : cubeSize / 2;
        const offsetZ = y % 2 === 0 ? 0 : cubeSize / 2;
        
        const cubePos = {
          x: position.x + x * cubeSize + offsetX,
          y: position.y + y * cubeSize + cubeSize / 2,
          z: position.z + z * cubeSize + offsetZ
        };
        
        // Use a consistent color per layer for a nice visual effect
        const hue = (y / height) * 0.8;
        const color = new THREE.Color().setHSL(hue, 0.8, 0.5).getHex();
        
        const cube = createCube(physics, cubePos, cubeSize, color);
        cubes.push(cube);
      }
    }
  }
  
  return cubes;
}

function animate(time: number) {
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  // Step physics world
  physics.world.step();

  // Update controller
  fpsController.update(deltaTime);

  // Update cube positions based on physics
  cubes.forEach(({ mesh, rigidBody }) => {
    const position = rigidBody.translation();
    mesh.position.set(position.x, position.y, position.z);
    
    const rotation = rigidBody.rotation();
    mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    // Check if cube fell out of bounds and reset it
    if (position.y < -20) {
      rigidBody.setTranslation(
        { x: (Math.random() - 0.5) * 20, y: 20, z: (Math.random() - 0.5) * 20 },
        true
      );
      rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  // Render scene
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the game
init().catch(console.error); 