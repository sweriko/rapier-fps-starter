import * as THREE from 'three';
import { FPSController } from './controllers/FPSController';
import { createGround } from './objects/Ground';
import { createSky } from './objects/Sky';
import { setupLights } from './utils/Lights';
import { createCube, createRandomCubes } from './objects/Cube';

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
  rigidBodies: Map<THREE.Mesh, RAPIER.RigidBody>;
};

let fpsController: FPSController;
let lastTime = 0;
let cubes: { mesh: THREE.Mesh, rigidBody: RAPIER.RigidBody }[] = [];
// Track bullets that need to be cleaned up
const bulletsToRemove: number[] = [];

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

// Create explosion effect
function createExplosion(position: THREE.Vector3, color: number = 0xFF5500) {
  // Create particle system for the explosion
  const particleCount = 50;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3] = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Material for particles
  const material = new THREE.PointsMaterial({
    color: color,
    size: 0.2,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Add explosion light
  const light = new THREE.PointLight(color, 2, 3);
  light.position.copy(position);
  scene.add(light);

  // Animate the explosion
  interface Velocity {
    x: number;
    y: number;
    z: number;
  }
  
  const velocities: Velocity[] = [];
  for (let i = 0; i < particleCount; i++) {
    velocities.push({
      x: (Math.random() - 0.5) * 5,
      y: (Math.random() - 0.5) * 5,
      z: (Math.random() - 0.5) * 5
    });
  }

  const explosionDuration = 1000; // 1 second
  const startTime = Date.now();

  function updateExplosion() {
    const positions = particles.geometry.attributes.position.array as Float32Array;
    const elapsed = Date.now() - startTime;
    const opacity = 1 - (elapsed / explosionDuration);

    if (opacity <= 0) {
      // Remove particles and light when animation is complete
      scene.remove(particles);
      scene.remove(light);
      return;
    }

    // Update particle positions
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] += velocities[i].x * 0.016; // Approximating delta time
      positions[i3 + 1] += velocities[i].y * 0.016;
      positions[i3 + 2] += velocities[i].z * 0.016;
    }

    particles.geometry.attributes.position.needsUpdate = true;
    material.opacity = opacity;
    light.intensity = opacity * 2;

    requestAnimationFrame(updateExplosion);
  }

  updateExplosion();
}

// Improved bullet collision detection that handles sensor colliders
function handleBulletCollisions() {
  if (!fpsController || !fpsController.bullets || fpsController.bullets.length === 0) return;
  
  // Clear the removal list
  bulletsToRemove.length = 0;
  
  // Process each bullet
  for (let i = 0; i < fpsController.bullets.length; i++) {
    const bullet = fpsController.bullets[i];
    
    // Get bullet position
    const bulletPos = bullet.rigidBody.translation();
    
    // Check if bullet is way out of bounds (failsafe)
    if (bulletPos.y < -50 || bulletPos.y > 50 || 
        Math.abs(bulletPos.x) > 100 || Math.abs(bulletPos.z) > 100) {
      bulletsToRemove.push(i);
      continue;
    }
    
    // Check if bullet hasn't moved in the last frame (stuck detection)
    const bulletVel = bullet.rigidBody.linvel();
    const bulletSpeed = Math.sqrt(
      bulletVel.x * bulletVel.x + 
      bulletVel.y * bulletVel.y + 
      bulletVel.z * bulletVel.z
    );
    
    // If bullet is moving too slow, it's probably stuck - remove it
    if (bulletSpeed < 5) {
      bulletsToRemove.push(i);
      continue;
    }
    
    // Manual collision detection with cubes
    let hitSomething = false;
    
    for (const cube of cubes) {
      const cubePos = cube.rigidBody.translation();
      
      // Distance check between bullet and cube center
      const dx = bulletPos.x - cubePos.x;
      const dy = bulletPos.y - cubePos.y;
      const dz = bulletPos.z - cubePos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // If within collision distance
      if (distance < 0.7) { // Collision threshold
        hitSomething = true;
        
        // Create explosion effect at impact point
        createExplosion(new THREE.Vector3(bulletPos.x, bulletPos.y, bulletPos.z));
        
        // Apply impulse to the cube based on bullet velocity
        const impulseStrength = bulletSpeed * 0.5; // Lower impulse for better physics
        const impulseDir = { 
          x: bulletVel.x / bulletSpeed, 
          y: bulletVel.y / bulletSpeed, 
          z: bulletVel.z / bulletSpeed 
        };
        
        // Apply impulse to push the cube
        cube.rigidBody.applyImpulse(
          { 
            x: impulseDir.x * impulseStrength, 
            y: impulseDir.y * impulseStrength, 
            z: impulseDir.z * impulseStrength 
          }, 
          true
        );
        
        // Add some random rotation for more realistic impact
        cube.rigidBody.applyTorqueImpulse(
          {
            x: (Math.random() - 0.5) * impulseStrength * 0.5,
            y: (Math.random() - 0.5) * impulseStrength * 0.5,
            z: (Math.random() - 0.5) * impulseStrength * 0.5
          },
          true
        );
        
        // Mark for removal
        bulletsToRemove.push(i);
        break;
      }
    }
    
    // Ground collision check (y near 0)
    if (!hitSomething && bulletPos.y < 0.3) {
      createExplosion(
        new THREE.Vector3(bulletPos.x, 0.05, bulletPos.z),
        0x777777 // Gray color for ground impact
      );
      bulletsToRemove.push(i);
    }
    
    // Check lifetime (destroy bullets after their time is up)
    const now = Date.now();
    if (now - bullet.creationTime > bullet.lifetime) {
      bulletsToRemove.push(i);
    }
  }
  
  // Remove bullets (in reverse order to keep indices valid)
  if (bulletsToRemove.length > 0) {
    for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
      const index = bulletsToRemove[i];
      const bullet = fpsController.bullets[index];
      
      // Remove from scene
      if (fpsController.scene) {
        fpsController.scene.remove(bullet.mesh);
      }
      
      // Remove from physics world
      physics.world.removeRigidBody(bullet.rigidBody);
      physics.rigidBodies.delete(bullet.mesh);
      
      // Remove from bullets array
      fpsController.bullets.splice(index, 1);
    }
  }
}

function animate(time: number) {
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  // Step physics world
  physics.world.step();

  // Handle bullet collisions
  handleBulletCollisions();

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