import * as THREE from 'three';

// Create a gun model that will be shown in the first-person view
export function createGun() {
  // Create a group to hold all gun parts
  const gunGroup = new THREE.Group();
  
  // Materials
  const gunMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.5,
    metalness: 0.7
  });
  
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.9,
    metalness: 0.2
  });
  
  // Gun barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 16);
  const barrel = new THREE.Mesh(barrelGeometry, gunMetalMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.35;
  barrel.position.y = -0.05;
  
  // Gun body
  const bodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
  const body = new THREE.Mesh(bodyGeometry, gunMetalMaterial);
  body.position.z = -0.1;
  body.position.y = -0.05;
  
  // Gun grip
  const gripGeometry = new THREE.BoxGeometry(0.08, 0.2, 0.1);
  const grip = new THREE.Mesh(gripGeometry, gripMaterial);
  grip.position.y = -0.15;
  
  // Gun details - sight
  const sightGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.02);
  const sight = new THREE.Mesh(sightGeometry, gunMetalMaterial);
  sight.position.y = 0.02;
  sight.position.z = -0.1;

  // Add all parts to the gun group
  gunGroup.add(barrel);
  gunGroup.add(body);
  gunGroup.add(grip);
  gunGroup.add(sight);
  
  // Position the gun in the bottom right of the screen
  gunGroup.position.set(0.2, -0.2, -0.5);
  
  // Breathing animation removed
  
  return gunGroup;
}

// Empty muzzle flash function that returns an empty group (to maintain API compatibility)
export function createMuzzleFlash() {
  return new THREE.Group(); // Returns an empty group instead of particles and light
} 