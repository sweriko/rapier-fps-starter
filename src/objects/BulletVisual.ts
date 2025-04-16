import * as THREE from 'three';

// Interface for visual bullet properties
export interface VisualBullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  creationTime: number;
  lifetime: number;
}

// Collection to track all visual bullets
const visualBullets: VisualBullet[] = [];

/**
 * Creates a visual bullet with physics simulation
 * @param scene THREE.Scene to add the bullet to
 * @param position Starting position of the bullet
 * @param direction Direction vector for the bullet
 * @param speed Initial speed of the bullet in units per second
 * @param color Color of the bullet (hex value)
 * @param size Size of the bullet (diameter)
 * @param lifetime How long the bullet should exist (in milliseconds)
 * @returns The created visual bullet object
 */
export function createVisualBullet(
  scene: THREE.Scene,
  position: { x: number; y: number; z: number },
  direction: THREE.Vector3,
  speed: number = 40,
  color: number = 0xFFFF00,
  size: number = 0.1,
  lifetime: number = 10000
): VisualBullet {
  // Create a small sphere for the bullet
  const geometry = new THREE.SphereGeometry(size, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color });
  const bulletMesh = new THREE.Mesh(geometry, material);
  
  // Set the bullet position
  bulletMesh.position.set(position.x, position.y, position.z);
  
  // Add to scene
  scene.add(bulletMesh);
  
  // Calculate initial velocity
  const velocity = direction.clone().normalize().multiplyScalar(speed);
  
  // Create bullet object
  const bullet: VisualBullet = {
    mesh: bulletMesh,
    velocity,
    creationTime: Date.now(),
    lifetime
  };
  
  // Add to bullets array
  visualBullets.push(bullet);
  
  return bullet;
}

/**
 * Updates all visual bullets based on physics
 * @param deltaTime Time elapsed since last update in seconds
 * @param gravity Gravity force applied to bullets (y-axis)
 */
export function updateVisualBullets(deltaTime: number, gravity: number = 9.81) {
  const now = Date.now();
  const bulletsToRemove: VisualBullet[] = [];
  
  // Update each bullet
  for (const bullet of visualBullets) {
    // Check if bullet has exceeded its lifetime
    if (now - bullet.creationTime > bullet.lifetime) {
      bulletsToRemove.push(bullet);
      continue;
    }
    
    // Apply gravity to velocity
    bullet.velocity.y -= gravity * deltaTime;
    
    // Update position based on velocity
    bullet.mesh.position.x += bullet.velocity.x * deltaTime;
    bullet.mesh.position.y += bullet.velocity.y * deltaTime;
    bullet.mesh.position.z += bullet.velocity.z * deltaTime;
  }
  
  // Remove expired bullets
  for (const bullet of bulletsToRemove) {
    const index = visualBullets.indexOf(bullet);
    if (index !== -1) {
      // Remove from scene
      bullet.mesh.removeFromParent();
      // Remove from material
      (bullet.mesh.material as THREE.Material).dispose();
      // Remove geometry
      bullet.mesh.geometry.dispose();
      // Remove from array
      visualBullets.splice(index, 1);
    }
  }
}

/**
 * Clears all visual bullets from the scene
 */
export function clearAllVisualBullets() {
  for (const bullet of visualBullets) {
    bullet.mesh.removeFromParent();
    (bullet.mesh.material as THREE.Material).dispose();
    bullet.mesh.geometry.dispose();
  }
  
  // Clear the array
  visualBullets.length = 0;
}

/**
 * Returns the current count of visual bullets
 */
export function getVisualBulletCount(): number {
  return visualBullets.length;
} 