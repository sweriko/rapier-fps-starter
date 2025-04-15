import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

// Create a single physics-enabled cube
export function createCube(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Mesh, RAPIER.RigidBody> },
  position: { x: number; y: number; z: number },
  size: number = 1,
  color: number = Math.random() * 0xffffff
) {
  // Create cube geometry and material
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.3
  });

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(position.x, position.y, position.z);

  // Create rigid body
  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z);
  
  const rigidBody = physics.world.createRigidBody(rigidBodyDesc);

  // Create collider (slightly smaller than the visual cube to avoid clipping)
  const colliderDesc = RAPIER.ColliderDesc.cuboid(size/2 * 0.98, size/2 * 0.98, size/2 * 0.98)
    .setRestitution(0.4)  // Bounciness
    .setFriction(0.5);    // Friction

  physics.world.createCollider(colliderDesc, rigidBody);
  
  // Add to physics tracking
  physics.rigidBodies.set(mesh, rigidBody);

  return { mesh, rigidBody };
}

// Create multiple random cubes
export function createRandomCubes(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Mesh, RAPIER.RigidBody> },
  count: number = 20,
  area: number = 20,
  heightRange: number = 10
) {
  const cubes = [];
  
  for (let i = 0; i < count; i++) {
    // Random position within area
    const position = {
      x: (Math.random() - 0.5) * area,
      y: 2 + Math.random() * heightRange,
      z: (Math.random() - 0.5) * area
    };
    
    // Random size between 0.5 and 2
    const size = 0.5 + Math.random() * 1.5;
    
    // Random color
    const color = Math.random() * 0xffffff;
    
    const cube = createCube(physics, position, size, color);
    cubes.push(cube);
  }
  
  return cubes;
} 