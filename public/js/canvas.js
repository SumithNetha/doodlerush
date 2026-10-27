class DrawingEngine {
  constructor(canvasElement, onStrokeEmit, onFillEmit, onClearEmit, onUndoEmit) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    this.onStrokeEmit = onStrokeEmit;
    this.onFillEmit = onFillEmit;
    this.onClearEmit = onClearEmit;
    this.onUndoEmit = onUndoEmit;

    this.isDrawing = false;
    this.isDrawer = false;
    this.tool = 'brush'; // 'brush', 'eraser', 'fill'
    this.currentColor = '#111827';
    this.currentSize = 6;
    this.currentStroke = null;

    // Standard logical resolution
    this.INTERNAL_WIDTH = 1000;
    this.INTERNAL_HEIGHT = 700;

    this.initCanvasSize();
    this.bindEvents();
    window.addEventListener('resize', () => this.resizeDisplay());
  }

  initCanvasSize() {
    this.canvas.width = this.INTERNAL_WIDTH;
    this.canvas.height = this.INTERNAL_HEIGHT;
    this.clearLocal(false);
  }

  resizeDisplay() {
    // Canvas display size is governed by CSS, internal resolution stays 1000x700
  }

  setDrawer(isDrawer) {
    this.isDrawer = isDrawer;
    if (isDrawer) {
      this.canvas.style.cursor = 'crosshair';
      this.canvas.style.touchAction = 'none';
    } else {
      this.canvas.style.cursor = 'default';
      this.canvas.style.touchAction = 'auto';
    }
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.currentColor = color;
  }

  setSize(size) {
    this.currentSize = Number(size);
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = ((clientX - rect.left) / rect.width) * this.INTERNAL_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * this.INTERNAL_HEIGHT;

    return {
      x: Math.max(0, Math.min(this.INTERNAL_WIDTH, x)),
      y: Math.max(0, Math.min(this.INTERNAL_HEIGHT, y)),
      // Normalized between 0 and 1
      nx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      ny: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    };
  }

  bindEvents() {
    const start = (e) => {
      if (!this.isDrawer) return;
      if (e.cancelable) e.preventDefault();

      const coords = this.getCanvasCoords(e);

      if (this.tool === 'fill') {
        this.floodFill(Math.round(coords.x), Math.round(coords.y), this.currentColor);
        if (this.onFillEmit) {
          this.onFillEmit({
            nx: coords.nx,
            ny: coords.ny,
            color: this.currentColor
          });
        }
        return;
      }

      this.isDrawing = true;
      const color = this.tool === 'eraser' ? '#ffffff' : this.currentColor;
      const size = this.tool === 'eraser' ? this.currentSize * 2.5 : this.currentSize;

      this.currentStroke = {
        type: 'stroke',
        color: color,
        size: size,
        points: [{ nx: coords.nx, ny: coords.ny }]
      };

      this.drawPoint(coords.x, coords.y, color, size);
    };

    const move = (e) => {
      if (!this.isDrawing || !this.isDrawer) return;
      if (e.cancelable) e.preventDefault();

      const coords = this.getCanvasCoords(e);
      this.currentStroke.points.push({ nx: coords.nx, ny: coords.ny });

      const len = this.currentStroke.points.length;
      if (len >= 2) {
        const p1 = this.currentStroke.points[len - 2];
        const p2 = this.currentStroke.points[len - 1];

        this.drawLine(
          p1.nx * this.INTERNAL_WIDTH,
          p1.ny * this.INTERNAL_HEIGHT,
          p2.nx * this.INTERNAL_WIDTH,
          p2.ny * this.INTERNAL_HEIGHT,
          this.currentStroke.color,
          this.currentStroke.size
        );
      }
    };

    const end = (e) => {
      if (!this.isDrawing || !this.isDrawer) return;
      this.isDrawing = false;

      if (this.currentStroke && this.onStrokeEmit) {
        this.onStrokeEmit(this.currentStroke);
      }
      this.currentStroke = null;
    };

    this.canvas.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    this.canvas.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  drawPoint(x, y, color, size) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawLine(x1, y1, x2, y2, color, size) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  renderStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    const { color, size, points } = stroke;
    if (points.length === 1) {
      this.drawPoint(
        points[0].nx * this.INTERNAL_WIDTH,
        points[0].ny * this.INTERNAL_HEIGHT,
        color,
        size
      );
      return;
    }

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();

    const startX = points[0].nx * this.INTERNAL_WIDTH;
    const startY = points[0].ny * this.INTERNAL_HEIGHT;
    this.ctx.moveTo(startX, startY);

    for (let i = 1; i < points.length; i++) {
      const px = points[i].nx * this.INTERNAL_WIDTH;
      const py = points[i].ny * this.INTERNAL_HEIGHT;
      this.ctx.lineTo(px, py);
    }
    this.ctx.stroke();
  }

  clearLocal(emit = false) {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.INTERNAL_WIDTH, this.INTERNAL_HEIGHT);
    if (emit && this.onClearEmit) {
      this.onClearEmit();
    }
  }

  redrawHistory(history) {
    this.clearLocal(false);
    if (!Array.isArray(history)) return;

    for (const item of history) {
      if (item.type === 'stroke') {
        this.renderStroke(item);
      } else if (item.type === 'fill') {
        const x = Math.round(item.nx * this.INTERNAL_WIDTH);
        const y = Math.round(item.ny * this.INTERNAL_HEIGHT);
        this.floodFill(x, y, item.color);
      }
    }
  }

  floodFill(startX, startY, fillColorHex) {
    const imgData = this.ctx.getImageData(0, 0, this.INTERNAL_WIDTH, this.INTERNAL_HEIGHT);
    const data = imgData.data;

    const fillRGB = this.hexToRgb(fillColorHex);
    const startIndex = (startY * this.INTERNAL_WIDTH + startX) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];

    // Already the target color
    if (
      Math.abs(targetR - fillRGB.r) < 5 &&
      Math.abs(targetG - fillRGB.g) < 5 &&
      Math.abs(targetB - fillRGB.b) < 5
    ) {
      return;
    }

    const matchTarget = (idx) => {
      return (
        Math.abs(data[idx] - targetR) < 32 &&
        Math.abs(data[idx + 1] - targetG) < 32 &&
        Math.abs(data[idx + 2] - targetB) < 32
      );
    };

    const queue = [[startX, startY]];
    const visited = new Uint8Array(this.INTERNAL_WIDTH * this.INTERNAL_HEIGHT);

    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      const pos = cy * this.INTERNAL_WIDTH + cx;

      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      if (!matchTarget(idx)) continue;

      data[idx] = fillRGB.r;
      data[idx + 1] = fillRGB.g;
      data[idx + 2] = fillRGB.b;
      data[idx + 3] = 255;

      if (cx > 0) queue.push([cx - 1, cy]);
      if (cx < this.INTERNAL_WIDTH - 1) queue.push([cx + 1, cy]);
      if (cy > 0) queue.push([cx, cy - 1]);
      if (cy < this.INTERNAL_HEIGHT - 1) queue.push([cx, cy + 1]);
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(x => x + x).join('');
    }
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }
}

window.DrawingEngine = DrawingEngine;
