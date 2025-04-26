import * as THREE from 'three';
import { FPSController } from './controllers/FPSController';
import { createGround } from './objects/Ground';
import { createSky } from './objects/Sky';
import { setupLights } from './utils/Lights';
import { createCube, createRandomCubes } from './objects/Cube';
import { loadModel } from './objects/Model';
import { InputHandler } from './input/InputHandler';
import { ProjectileManager } from './controllers/ProjectileManager';
import Stats from 'stats.js';

// Import Rapier directly - the plugins will handle the WASM loading
import RAPIER from '@dimforge/rapier3d';

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

// Initialize stats.js
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

// Initialize Rapier physics
let physics: {
  world: RAPIER.World;
  rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody>;
};

let fpsController: FPSController;
let inputHandler: InputHandler;
let projectileManager: ProjectileManager;
let lastTime = 0;
let cubes: { mesh: THREE.Mesh, rigidBody: RAPIER.RigidBody }[] = [];

// Add debug stats display
const statsContainer = document.createElement('div');
statsContainer.style.position = 'absolute';
statsContainer.style.bottom = '10px';
statsContainer.style.right = '10px';
statsContainer.style.color = 'white';
statsContainer.style.fontFamily = 'monospace';
statsContainer.style.fontSize = '12px';
statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
statsContainer.style.padding = '5px';
statsContainer.style.borderRadius = '3px';
document.body.appendChild(statsContainer);

// Initialize the game
async function init() {
  // Create physics world with collision event handling
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

  // Initialize projectile manager
  projectileManager = new ProjectileManager(scene, physics);

  // Load the destructible house model
  try {
    const { model } = await loadModel(
      physics,
      '/destructiblehouse.glb',  // Path to the model
      { x: 8, y: 0, z: 0 },      // Position
      3,                         // Scale (3x original size)
      true                       // Static/fixed (like cubes)
    );
    scene.add(model);
    console.log('Destructible house model loaded successfully');
  } catch (error) {
    console.error('Failed to load house model:', error);
  }

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
  
  // Set the scene reference in the controller
  fpsController.setScene(scene);

  // Connect the debug visualizer to the projectile manager
  if (fpsController.debugVisualizer) {
    projectileManager.setDebugVisualizer(fpsController.debugVisualizer);
  }

  // Set up shooting callbacks
  fpsController.setShootCallback((position, direction) => {
    projectileManager.shoot(position, direction, {
      speed: 40,
      size: 0.1,
      color: 0xff9900,
      lifespan: 5000,
      restitution: 0.6
    });
  });

  // Initialize input handler
  inputHandler = new InputHandler();
  
  // Listen for debug toggle event
  document.addEventListener('toggle-debug', () => {
    if (fpsController.debugVisualizer) {
      fpsController.debugVisualizer.toggle();
      console.log("Debug visualization:", fpsController.debugVisualizer.isActive() ? "enabled" : "disabled");
    }
  });

  // Add help message to console
  console.log("Controls:");
  console.log("- WASD/Arrow Keys: Move");
  console.log("- Space: Jump");
  console.log("- Left Mouse Button: Shoot");
  console.log("- V: Toggle debug visualization");

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  requestAnimationFrame(animate);
}

// Create a stack of cubes
function createStackedCubes(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> },
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
  // Begin stats measurement
  stats.begin();

  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  // Step physics world
  physics.world.step();

  // Update input handler
  inputHandler.update();

  // Update controller
  fpsController.update(deltaTime);

  // Update projectiles
  projectileManager.update();

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

  // Update stats display
  statsContainer.innerHTML = 
    `FPS: ${Math.round(1 / deltaTime)}<br>` +
    `Active Projectiles: ${projectileManager.getProjectileCount()}<br>` +
    `Physics Bodies: ${physics.rigidBodies.size}`;

  // Render scene
  renderer.render(scene, camera);

  // End stats measurement
  stats.end();

  requestAnimationFrame(animate);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the game
init().catch(console.error); 