import * as THREE from 'three';
import { AutoWalk } from './AutoWalk.js';
import { LineUtil } from './LineUtil.js';

export class Character {
  constructor(scene, options = {}) {
    this.scene = scene;
    const hipHeight = options.hipHeight !== undefined ? options.hipHeight : 2.0;
    const legsDistance = options.legsDistance !== undefined ? options.legsDistance : 1.0;
    
    this.showLegs = true;
    this.showModel = true;
    
    // Create the rootCube (parent)
    const rootGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const rootMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.rootCube = new THREE.Mesh(rootGeometry, rootMaterial);
    
    // Create the hip child cube
    const childGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const childMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    this.hip = new THREE.Mesh(childGeometry, childMaterial);
    
    // Lift child by hipHeight along Y axis
    this.hip.position.y = hipHeight;

    LineUtil.init(scene);

    // Create the left leg cube
    const leftLegGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const leftLegMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 }); // Orange
    this.legLeft = new THREE.Mesh(leftLegGeometry, leftLegMaterial);
    
    // Position left leg
    this.legLeft.position.set(-legsDistance / 2, 0, 0);

    // Create the right leg cube
    const rightLegGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const rightLegMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 }); // Orange
    this.legRight = new THREE.Mesh(rightLegGeometry, rightLegMaterial);
    
    // Position right leg
    this.legRight.position.set(legsDistance / 2, 0, 0);

    // Create the left knee cube
    const leftKneeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const leftKneeMaterial = new THREE.MeshStandardMaterial({ color: 0x800080 }); // Purple
    this.leftKnee = new THREE.Mesh(leftKneeGeometry, leftKneeMaterial);
    
    // Position left knee halfway down and slightly forward
    this.leftKnee.position.set(-legsDistance / 4, -hipHeight / 2, -0.5);

    // Create the right knee cube
    const rightKneeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const rightKneeMaterial = new THREE.MeshStandardMaterial({ color: 0x800080 }); // Purple
    this.rightKnee = new THREE.Mesh(rightKneeGeometry, rightKneeMaterial);
    
    // Position right knee halfway down and slightly forward
    this.rightKnee.position.set(legsDistance / 4, -hipHeight / 2, -0.5);

    // Add knees to the legs
    this.legLeft.add(this.leftKnee);
    this.legRight.add(this.rightKnee);

    // Add legs to the hip
    this.hip.add(this.legLeft);
    this.hip.add(this.legRight);
    
    // Create the left foot cube
    const leftFootGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const leftFootMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.footLeft = new THREE.Mesh(leftFootGeometry, leftFootMaterial);
    
    // Position left foot
    this.footLeft.position.set(-legsDistance, 0, 0);
    
    // Create the right foot cube
    const rightFootGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const rightFootMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.footRight = new THREE.Mesh(rightFootGeometry, rightFootMaterial);
    
    // Position right foot
    this.footRight.position.set(legsDistance, 0, 0);

    this.rootCube.add(this.hip);
    this.rootCube.add(this.footLeft);
    this.rootCube.add(this.footRight);
    this.scene.add(this.rootCube);

    this.debugDrawing = true;
    this.setDebugDrawing(this.debugDrawing);

    // Initialize AutoWalk from mesh positions
    this.rootCube.updateMatrixWorld(true);

    this.autoWalk = new AutoWalk();
    this.autoWalk.hipHeight = this.hip.position.y;
    
    // Left Leg Setup
    this.autoWalk.legLeft.legAutoPosition.copy(this.legLeft.position);
    this.autoWalk.legLeft.legLen = this.leftKnee.position.length();
    
    const leftKneeGlobal = new THREE.Vector3();
    this.leftKnee.getWorldPosition(leftKneeGlobal);
    const leftFootGlobal = new THREE.Vector3();
    this.footLeft.getWorldPosition(leftFootGlobal);
    this.autoWalk.legLeft.shinLen = leftKneeGlobal.distanceTo(leftFootGlobal);
    this.autoWalk.legLeft.footAutoPosition.copy(leftFootGlobal); // Initialize starting rest pose

    // Right Leg Setup
    this.autoWalk.legRight.legAutoPosition.copy(this.legRight.position);
    this.autoWalk.legRight.legLen = this.rightKnee.position.length();

    const rightKneeGlobal = new THREE.Vector3();
    this.rightKnee.getWorldPosition(rightKneeGlobal);
    const rightFootGlobal = new THREE.Vector3();
    this.footRight.getWorldPosition(rightFootGlobal);
    this.autoWalk.legRight.shinLen = rightKneeGlobal.distanceTo(rightFootGlobal);
    this.autoWalk.legRight.footAutoPosition.copy(rightFootGlobal); // Initialize starting rest pose

  }

  setDebugDrawing(enabled) {
    this.debugDrawing = enabled;
    this.rootCube.material.visible = this.debugDrawing;
    this.hip.material.visible = this.debugDrawing;
    this.legLeft.visible = this.debugDrawing;
    this.legRight.visible = this.debugDrawing;
    this.footLeft.visible = this.debugDrawing;
    this.footRight.visible = this.debugDrawing;
  }

  update(deltaTime) {
    // Prepare AutoWalk inputs
    this.rootCube.updateMatrixWorld();
    
    const rootPosition = this.rootCube.position;
    const rootForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.rootCube.quaternion);
    const rootUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.rootCube.quaternion);
    const rootOrientation = this.rootCube.quaternion;
    const rootScale = this.rootCube.scale;

    // Update AutoWalk
    this.autoWalk.update(deltaTime, rootPosition, rootForward, rootUp, rootOrientation, rootScale);

    // Apply AutoWalk results to Hip (Local)
    this.hip.position.copy(this.autoWalk.hip.position);

    // Apply AutoWalk results to Legs and Knees
    this.legLeft.quaternion.copy(this.autoWalk.legLeft.legAutoOrientation);
    this.leftKnee.quaternion.copy(this.autoWalk.legLeft.kneeAutoOrientation);
    // Align knee mesh position to point along the solved bone vector
    this.leftKnee.position.set(0, 0, -this.autoWalk.legLeft.legLen);

    this.legRight.quaternion.copy(this.autoWalk.legRight.legAutoOrientation);
    this.rightKnee.quaternion.copy(this.autoWalk.legRight.kneeAutoOrientation);
    // Align knee mesh position to point along the solved bone vector
    this.rightKnee.position.set(0, 0, -this.autoWalk.legRight.legLen);

    // Apply AutoWalk results to Feet (Global -> Local)
    const leftFootGlobal = this.autoWalk.legLeft.footAutoPosition.clone();
    this.rootCube.worldToLocal(leftFootGlobal);
    this.footLeft.position.copy(leftFootGlobal);
    this.footLeft.quaternion.copy(this.rootCube.quaternion.clone().invert().multiply(this.autoWalk.legLeft.footAutoOrientation));

    const rightFootGlobal = this.autoWalk.legRight.footAutoPosition.clone();
    this.rootCube.worldToLocal(rightFootGlobal);
    this.footRight.position.copy(rightFootGlobal);
    this.footRight.quaternion.copy(this.rootCube.quaternion.clone().invert().multiply(this.autoWalk.legRight.footAutoOrientation));

    // Left leg bones
    const leftLegPos = new THREE.Vector3();
    this.legLeft.getWorldPosition(leftLegPos);
    const leftKneePos = new THREE.Vector3();
    this.leftKnee.getWorldPosition(leftKneePos);
    const leftFootPos = new THREE.Vector3();
    this.footLeft.getWorldPosition(leftFootPos);

    // Right leg bones
    const rightLegPos = new THREE.Vector3();
    this.legRight.getWorldPosition(rightLegPos);
    const rightKneePos = new THREE.Vector3();
    this.rightKnee.getWorldPosition(rightKneePos);
    const rightFootPos = new THREE.Vector3();
    this.footRight.getWorldPosition(rightFootPos);

    // Update LineUtil debug visuals
    const hipPos = new THREE.Vector3();
    this.hip.getWorldPosition(hipPos);
    const hipQuat = new THREE.Quaternion();
    this.hip.getWorldQuaternion(hipQuat);

    if (this.debugDrawing) {
      // Hip axes
      const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(hipQuat).add(hipPos);
      const axisY = new THREE.Vector3(0, 1, 0).applyQuaternion(hipQuat).add(hipPos);
      const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(hipQuat).add(hipPos);
      
      LineUtil.drawLine(hipPos, axisX, 0xff0000);
      LineUtil.drawLine(hipPos, axisY, 0x00ff00);
      LineUtil.drawLine(hipPos, axisZ, 0x0000ff);

      // Skeleton Debug Lines
      LineUtil.drawLine(leftLegPos, leftKneePos, 0xffffff);
      LineUtil.drawLine(leftKneePos, leftFootPos, 0xffffff);
      LineUtil.drawLine(rightLegPos, rightKneePos, 0xffffff);
      LineUtil.drawLine(rightKneePos, rightFootPos, 0xffffff);
    }
  }

  dispose() {
    this.scene.remove(this.rootCube);
  }
}
