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
  
  // 2. Add a simple plane for the "ground" that extends far
  const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
  groundGeometry.rotateX(-Math.PI / 2);
  
  const groundMaterial = new THREE.MeshBasicMaterial({
    color: 0x228833,
    side: THREE.DoubleSide
  });
  
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.position.y = -0.1; // Just below the physics ground
  skyGroup.add(groundMesh);
  
  return skyGroup;
}

// Create a cloud texture
function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  
  const context = canvas.getContext('2d');
  
  // Draw a soft-edged circle
  if (context) {
    const gradient = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  
  return texture;
} 