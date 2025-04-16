import * as THREE from 'three';
import { FPSController } from './controllers/FPSController';
import { createGround } from './objects/Ground';
import { createSky } from './objects/Sky';
import { setupLights } from './utils/Lights';
import { createCube, createRandomCubes } from './objects/Cube';
import { loadModel } from './objects/Model';

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

// Initialize Rapier physics
let physics: {
  world: RAPIER.World;
  rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody>;
};

let fpsController: FPSController;
let lastTime = 0;
let cubes: { mesh: THREE.Mesh, rigidBody: RAPIER.RigidBody }[] = [];
// Bullets are now handled via raycasting

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
  
  // Set the scene reference in the controller to allow bullet management
  fpsController.setScene(scene);

  // Add crosshair
  createCrosshair();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  requestAnimationFrame(animate);
}

// Add a simple crosshair to the center of the screen
function createCrosshair() {
  const crosshairSize = 20;
  const crosshairThickness = 2;
  
  // Create container
  const crosshair = document.createElement('div');
  crosshair.style.position = 'absolute';
  crosshair.style.top = '50%';
  crosshair.style.left = '50%';
  crosshair.style.transform = 'translate(-50%, -50%)';
  crosshair.style.width = `${crosshairSize}px`;
  crosshair.style.height = `${crosshairSize}px`;
  crosshair.style.zIndex = '100';
  
  // Create horizontal line
  const horizontalLine = document.createElement('div');
  horizontalLine.style.position = 'absolute';
  horizontalLine.style.top = '50%';
  horizontalLine.style.left = '0';
  horizontalLine.style.width = '100%';
  horizontalLine.style.height = `${crosshairThickness}px`;
  horizontalLine.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  horizontalLine.style.transform = 'translateY(-50%)';
  
  // Create vertical line
  const verticalLine = document.createElement('div');
  verticalLine.style.position = 'absolute';
  verticalLine.style.top = '0';
  verticalLine.style.left = '50%';
  verticalLine.style.width = `${crosshairThickness}px`;
  verticalLine.style.height = '100%';
  verticalLine.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  verticalLine.style.transform = 'translateX(-50%)';
  
  // Add lines to crosshair
  crosshair.appendChild(horizontalLine);
  crosshair.appendChild(verticalLine);
  
  // Add crosshair to body
  document.body.appendChild(crosshair);
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
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  // Step physics world
  physics.world.step();

  // Handle bullet collisions - removed since we now use raycasts

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