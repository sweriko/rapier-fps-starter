import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

// Create a ground plane with physics
export function createGround(physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> }) {
  // Create a large flat plane for the ground
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  
  // Rotate it to be horizontal (by default PlaneGeometry is vertical)
  groundGeometry.rotateX(-Math.PI / 2);
  
  // Create a material for the ground
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a5f2a,  // Green color
    roughness: 0.8,
    metalness: 0.2,
  });
  
  // Create the mesh
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.receiveShadow = true;
  
  // Create a rigid body for the ground
  const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
  const groundBody = physics.world.createRigidBody(groundBodyDesc);
  
  // Create a collider for the ground
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
  physics.world.createCollider(groundColliderDesc, groundBody);
  
  // Add the rigid body to our collection, linked to the mesh
  physics.rigidBodies.set(groundMesh, groundBody);
  
  return groundMesh;
} 