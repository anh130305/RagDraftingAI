import React, { useEffect, useRef } from 'react';

interface NeuralCanvasProps {
  nodeCount?: number;
  lineColor?: string;
  nodeColor?: string;
  glowColor?: string;
  speed?: number;
  className?: string;
  opacity?: number;
}

/**
 * NeuralCanvas Component
 * ---------------------
 * A high-performance canvas-based animation of a neural network.
 * Nodes move randomly and connect when they are close.
 */
export default function NeuralCanvas({
  nodeCount = 85,
  lineColor = 'rgba(139, 92, 246, 0.6)',
  nodeColor = 'rgba(196, 181, 253, 0.9)',
  glowColor = 'rgba(167, 139, 250, 0.25)',
  speed = 0.65,
  className = '',
  opacity = 1
}: NeuralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    type Node = { 
      x: number; 
      y: number; 
      vx: number; 
      vy: number; 
      r: number 
    };
    
    let nodes: Node[] = [];

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
      }
    };

    const init = () => {
      resize();
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        r: Math.random() * 2 + 1.2,
      }));
    };

    const MAX_DIST = 145;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ── Move nodes ──
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }

      // ── Draw connections ──
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < MAX_DIST) {
            // Calculate alpha based on distance
            const alpha = (1 - dist / MAX_DIST) * 0.6;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            
            // Adjust line color alpha if it's a rgba string, or just use hardcoded if simple
            // For simplicity, we use the provided lineColor but adjust alpha
            // Note: This expects lineColor to be rgba for best results
            ctx.strokeStyle = lineColor.replace(/[\d.]+\)$/, `${alpha})`);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      // ── Draw nodes ──
      for (const n of nodes) {
        // Outer glow
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        grd.addColorStop(0, glowColor);
        grd.addColorStop(1, 'rgba(167, 139, 250, 0)');
        
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Solid core
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    init();
    draw();

    const ro = new ResizeObserver(() => init());
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [nodeCount, lineColor, nodeColor, glowColor, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ 
        position: 'absolute', 
        inset: 0, 
        width: '100%', 
        height: '100%', 
        display: 'block',
        pointerEvents: 'none',
        opacity: opacity
      }}
    />
  );
}
