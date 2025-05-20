import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

// Load a GLTF model with physics collider
export async function loadModel(
  physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> },
  modelPath: string,
  position: { x: number; y: number; z: number },
  scale: number = 1,
  isStatic: boolean = true
) {
  return new Promise<{ model: THREE.Group, rigidBody: RAPIER.RigidBody }>((resolve, reject) => {
    const loader = new GLTFLoader();
    
    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;
        
        // Scale the model
        model.scale.set(scale, scale, scale);
        
        // Set position
        model.position.set(position.x, position.y, position.z);
        
        // Enable shadows
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        // Create a rigid body for the model
        const rigidBodyDesc = isStatic 
          ? RAPIER.RigidBodyDesc.fixed()
          : RAPIER.RigidBodyDesc.dynamic();
        
        rigidBodyDesc.setTranslation(position.x, position.y, position.z);
        const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
        
        // Create a simplified box collider based on model's bounding box
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        // Scale the dimensions to match the model's scale
        const sizeX = size.x * 0.95; // Slightly smaller to avoid clipping
        const sizeY = size.y * 0.95;
        const sizeZ = size.z * 0.95;
        
        // Calculate the collider offset relative to the model position
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const offsetX = center.x - position.x;
        const offsetY = center.y - position.y;
        const offsetZ = center.z - position.z;
        
        // Create a box collider with proper size and offset
        const colliderDesc = RAPIER.ColliderDesc.cuboid(sizeX/2, sizeY/2, sizeZ/2)
          .setTranslation(offsetX, offsetY, offsetZ)
          .setRestitution(0.4)
          .setFriction(0.5);
        
        physics.world.createCollider(colliderDesc, rigidBody);
        
        // For tracking physics
        physics.rigidBodies.set(model, rigidBody);
        
        resolve({ model, rigidBody });
      },
      undefined, // onProgress callback not needed
      (error) => {
        console.error('Error loading model:', error);
        reject(error);
      }
    );
  });
} 