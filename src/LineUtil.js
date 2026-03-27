import * as THREE from 'three';

class LineUtilClass {
  constructor() {
    this.lines = [];
    this.lineIndex = 0;
    this.scene = null;
    this.materialCache = {};
    
    this.baseGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.baseGeometry.translate(0, 0.5, 0);
    this.baseGeometry.rotateX(Math.PI / 2);
  }

  init(scene) {
    this.scene = scene;
  }

  getMaterial(color) {
    if (!this.materialCache[color]) {
      this.materialCache[color] = new THREE.MeshBasicMaterial({ color: color });
    }
    return this.materialCache[color];
  }

  clear() {
    this.lineIndex = 0;
    for (let i = 0; i < this.lines.length; i++) {
      this.lines[i].visible = false;
    }
  }

  drawLine(point1, point2, color, thickness = 0.02) {
    if (!this.scene) return;

    let line;
    if (this.lineIndex < this.lines.length) {
      line = this.lines[this.lineIndex];
    } else {
      line = new THREE.Mesh(this.baseGeometry, this.getMaterial(color));
      this.scene.add(line);
      this.lines.push(line);
    }

    line.material = this.getMaterial(color);
    
    line.position.copy(point1);
    const distance = point1.distanceTo(point2);
    
    line.lookAt(point2);
    line.scale.set(thickness, thickness, distance);
    
    line.visible = true;

    this.lineIndex++;
  }
}

export const LineUtil = new LineUtilClass();