import * as THREE from 'three';

// Create a simple sky background with basic colors
export function createSky() {
  // Create a group to hold our sky elements
  const skyGroup = new THREE.Group();
  
  // 1. Simple colored backdrop sphere
  const skyGeometry = new THREE.SphereGeometry(400, 32, 15);
  skyGeometry.scale(-1, 1, 1);
  
  const skyMaterial = new THREE.MeshBasicMaterial({
    color: 0x87CEEB,
    side: THREE.BackSide
  });
  
  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  skyGroup.add(skyMesh);
  
  return skyGroup;
} 