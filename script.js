// --- Configuration ---
const CONFIG = {
    particleCount: 20000,
    particleSize: 0.4,
    baseColor: new THREE.Color("rgb(129, 121, 54)"),
    noiseStrength: 1,
    lerpSpeed: 0.05,
    cameraEnabled: false
};

// --- Globals ---
let scene, camera, renderer;
let particles, material, geometry;
let clock = new THREE.Clock();
let time = 0;
let mouse = new THREE.Vector2();
let targetShape = 'heart';

// Gesture State
let gestureState = {
    scale: 1.0,
    spread: 0.0, // 0 to 1 (contracted to expanded)
    handDistance: 0.0,
    hasHands: false,
    handPosition: new THREE.Vector2(0, 0), // Normalized -1 to 1 (x), -1 to 1 (y)
    prevHandPosition: new THREE.Vector2(0, 0),
    handVelocity: 0.0
};

// Game State
let gameState = {
    active: false,
    points: [],
    currentPointIndex: 0,
    scoreTime: 0,
    completed: false
};
const SECRET_POINTS = [
    { x: 0.35, y: 0.35 }, { x: 0.65, y: 0.35 }, { x: 0.5, y: 0.5 }, { x: 0.4, y: 0.65 }, { x: 0.6, y: 0.65 }
];

// Shapes Data (Position Arrays)
const shapes = {
    heart: [],
    flower: [],
    saturn: [],
    buddha: [],

    fireworks: [],
    galaxy: []
};

// --- Shapes Generation ---
function generateShapes(count) {
    // 1. Heart
    shapes.heart = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        // Parametric heart
        let t = Math.random() * Math.PI * 2;
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        let z = (Math.random() - 0.5) * 5; // Thickness
        // Randomize slightly to fill volume
        let r = Math.random() * 0.5;
        x += (Math.random() - 0.5) * r;
        y += (Math.random() - 0.5) * r;

        let i3 = i * 3;
        shapes.heart[i3] = x * 0.5;
        shapes.heart[i3 + 1] = y * 0.5;
        shapes.heart[i3 + 2] = z;
    }

    // 2. Flower (Phyllotaxis)
    shapes.flower = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        let angle = i * 137.5 * (Math.PI / 180);
        let r = 0.3 * Math.sqrt(i);
        // Add curve for petal shape (bowl like)
        let x = r * Math.cos(angle);
        let z = r * Math.sin(angle);
        let y = Math.sin(r * 0.2) * 5 + (Math.random() - 0.5);

        let i3 = i * 3;
        shapes.flower[i3] = x;
        shapes.flower[i3 + 1] = y - 5; // Center it
        shapes.flower[i3 + 2] = z;
    }

    // 3. Saturn
    shapes.saturn = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        let i3 = i * 3;
        if (i < count * 0.3) {
            // Planet Body (Sphere)
            let phi = Math.acos(-1 + (2 * i) / (count * 0.3));
            let theta = Math.sqrt((count * 0.3) * Math.PI) * phi;
            let r = 4;
            shapes.saturn[i3] = r * Math.cos(theta) * Math.sin(phi);
            shapes.saturn[i3 + 1] = r * Math.sin(theta) * Math.sin(phi);
            shapes.saturn[i3 + 2] = r * Math.cos(phi);
        } else {
            // Rings
            let angle = Math.random() * Math.PI * 2;
            let dist = 6 + Math.random() * 6;
            shapes.saturn[i3] = Math.cos(angle) * dist;
            shapes.saturn[i3 + 1] = (Math.random() - 0.5) * 0.5; // Flat
            shapes.saturn[i3 + 2] = Math.sin(angle) * dist;

            // Tilt the ring
            let x = shapes.saturn[i3];
            let y = shapes.saturn[i3 + 1];
            let z = shapes.saturn[i3 + 2];
            let tilt = 0.4;
            shapes.saturn[i3] = x * Math.cos(tilt) - y * Math.sin(tilt);
            shapes.saturn[i3 + 1] = x * Math.sin(tilt) + y * Math.cos(tilt);
        }
    }

    // 4. Buddha (2D Silhouette approximation)
    shapes.buddha = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        let done = false;
        let x, y, z;
        // Simple rejection sampling for a silhouette
        // Head: Circle at (0, 4) r=1.5
        // Body: Triangle/Oval base
        while (!done) {
            x = (Math.random() - 0.5) * 8;
            y = (Math.random() - 0.5) * 10;
            z = (Math.random() - 0.5) * 2;

            // Head
            let dx = x - 0;
            let dy = y - 3;
            if (dx * dx + dy * dy < 2.0) { done = true; continue; }

            // Body (Seated triangle)
            // Approx bound: bottom width 8, top width 2, height 6
            // Linear check
            let bodyY = y + 3; // Shift to 0..6
            if (bodyY >= 0 && bodyY < 6) {
                let widthAtY = 4 - (bodyY * 0.5);
                if (Math.abs(x) < widthAtY) { done = true; continue; }
            }
        }
        let i3 = i * 3;
        shapes.buddha[i3] = x;
        shapes.buddha[i3 + 1] = y;
        shapes.buddha[i3 + 2] = z;
    }

    // 5. Fireworks (Explosion starter points - all at center)
    shapes.fireworks = new Float32Array(count * 3);
    // Actually fireworks are dynamic, but for morph target we can just set them to sphere
    // and let the shader/physics handle the expansion.
    // Let's make the "Target" a large sphere so they expand out.
    for (let i = 0; i < count; i++) {
        let r = 20 * Math.cbrt(Math.random()); // Uniform sphere
        let theta = Math.random() * 2 * Math.PI;
        let phi = Math.acos(2 * Math.random() - 1);
        let x = r * Math.sin(phi) * Math.cos(theta);
        let y = r * Math.sin(phi) * Math.sin(theta);
        let z = r * Math.cos(phi);

        let i3 = i * 3;
        shapes.fireworks[i3] = x;
        shapes.fireworks[i3 + 1] = y;
        shapes.fireworks[i3 + 2] = z;
    }


    // 6. Galaxy
    shapes.galaxy = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        let i3 = i * 3;
        let arm = i % 3;
        let r = Math.random() * Math.random() * 25 + 1; // Bias towards center
        let spin = r * 0.5;
        let angle = spin + (arm * (Math.PI * 2 / 3));

        // Random spread
        let spread = (Math.random() - 0.5) * 5;
        let x = Math.cos(angle) * r + (Math.random() - 0.5) * 2;
        let y = (Math.random() - 0.5) * (10 - r * 0.3); // Thicker at center
        let z = Math.sin(angle) * r + (Math.random() - 0.5) * 2;

        shapes.galaxy[i3] = x;
        shapes.galaxy[i3 + 1] = y;
        shapes.galaxy[i3 + 2] = z;
    }
}

// --- Init Three.js ---
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.02);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('output_canvas'), antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Generate Shapes
    generateShapes(CONFIG.particleCount);

    // Particles
    geometry = new THREE.BufferGeometry();

    // Attributes
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const targetPositions = new Float32Array(CONFIG.particleCount * 3); // To store current target
    const randoms = new Float32Array(CONFIG.particleCount);

    // Init positions (start at random)
    for (let i = 0; i < CONFIG.particleCount; i++) {
        let i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 50;
        positions[i3 + 1] = (Math.random() - 0.5) * 50;
        positions[i3 + 2] = (Math.random() - 0.5) * 50;
        randoms[i] = Math.random();

        // Init target to Heart
        targetPositions[i3] = shapes.heart[i3];
        targetPositions[i3 + 1] = shapes.heart[i3 + 1];
        targetPositions[i3 + 2] = shapes.heart[i3 + 2];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('targetPos', new THREE.BufferAttribute(targetPositions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    // Shader Material
    const vertexShader = `
        uniform float uTime;
        uniform float uSize;
        uniform float uMorphFactor;
        uniform float uNoiseStrength;
        uniform float uSpread;

        uniform vec3 uOffset;
        
        attribute vec3 targetPos;
        attribute float aRandom;
        
        varying float vAlpha;
        varying vec3 vColor;

        // Simplex noise function (simplified)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
            vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
            i = mod289(i);
            vec4 p = permute( permute( permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857; // 1.0/7.0
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            // Morphing
            vec3 finalPos = mix(position, targetPos, uMorphFactor); // We actually update 'position' in JS, this is for smoothing if needed, but here we can just use position directly.
            // Actually, let's just use 'position' as the base, and add noise in shader. The physical position update happens in JS for the 'attraction'.
            
            // Per-particle noise movement
            float noiseVal = snoise(vec3(position.x * 0.1, position.y * 0.1, uTime * 0.5 + aRandom));
            vec3 noiseOffset = vec3(
                sin(uTime * 2.0 + aRandom * 10.0),
                cos(uTime * 1.5 + aRandom * 10.0),
                sin(uTime * 2.2 + aRandom * 10.0)
            ) * uNoiseStrength * (1.0 + uSpread * 2.0); // More noise when spread

            // Spread Effect (Gesture)
            // If spread > 0, particles move away from center
            vec3 dir = normalize(position);
            vec3 spreadOffset = dir * uSpread * 10.0 * (0.5 + aRandom);

            vec3 newPos = position + noiseOffset + spreadOffset + uOffset;

            vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
            gl_PointSize = uSize * (300.0 / -mvPosition.z); // Scale by distance
            
            gl_Position = projectionMatrix * mvPosition;
            
            vAlpha = 0.5 + 0.5 * sin(uTime + aRandom * 10.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
            // Circular particle
            float r = distance(gl_PointCoord, vec2(0.5, 0.5));
            if (r > 0.5) discard;

            // Soft edge
            float glow = 1.0 - (r * 2.0);
            glow = pow(glow, 1.5); 

            gl_FragColor = vec4(uColor, glow * vAlpha);
        }
    `;

    material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: CONFIG.baseColor },
            uSize: { value: CONFIG.particleSize },
            uNoiseStrength: { value: CONFIG.noiseStrength },
            uSpread: { value: 0.0 },
            uMorphFactor: { value: 0.0 },
            uOffset: { value: new THREE.Vector3(0, 0, 0) }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Initial transition to flower
    updateTargetShape('flower');

    // Events
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove, false);

    // UI Events
    setupUI();

    // Start Loop
    animate();
}

// --- Logic ---

function updateTargetShape(shapeName) {
    targetShape = shapeName;
    const targetArr = shapes[shapeName];
    const attr = geometry.attributes.targetPos;

    for (let i = 0; i < CONFIG.particleCount; i++) {
        let i3 = i * 3;
        // If we have data for this particle in the shape
        if (i3 + 2 < targetArr.length) {
            attr.array[i3] = targetArr[i3];
            attr.array[i3 + 1] = targetArr[i3 + 1];
            attr.array[i3 + 2] = targetArr[i3 + 2];
        } else {
            // Fallback to center if shape has fewer points (unlikely with fixed count, but safe)
            attr.array[i3] = 0;
            attr.array[i3 + 1] = 0;
            attr.array[i3 + 2] = 0;
        }
    }
    attr.needsUpdate = true;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    // Only use mouse if camera not driving
    if (!CONFIG.cameraEnabled) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Map mouse Y to spread
        // Top = spread out, Bottom = contract
        // Let's say center is neutral.
        // Actually, let's map X to rotation, Y to spread.

        // Simple mapping:
        gestureState.spread = Math.max(0, mouse.y); // Up = expand

        // Mouse click holds?
        // Let's just use position.
    }
}

function animate() {
    requestAnimationFrame(animate);

    time += clock.getDelta();

    // Fluid Motion Logic
    // If hand is moving, increase time speed and noise strength
    let speed = gestureState.handVelocity;
    let speedFactor = 1.0 + speed * 20.0; // Boost

    // Modulate time step based on speed for "Fast Flow" effect
    material.uniforms.uTime.value += clock.getDelta() * speedFactor;
    // Actually we added delta twice. Fix:
    // material.uniforms.uTime.value = time; // This strictly uses wall clock.
    // To vary speed we need cumulative time.
    // Let's just modulate Noise Strength and maybe use a separate "flow time"

    // Simpler: Modulate Noise Strength using speed
    let baseNoise = CONFIG.noiseStrength;
    if (gestureState.hasHands) {
        // Add speed influence
        let targetNoise = baseNoise + speed * 2.0;

        // "Contracted Chaos" - High noise and flow when contracted in Galaxy/Secret mode
        if (targetShape === 'galaxy' && gestureState.spread < -0.1) {
            targetNoise = 3.0; // Max chaos
            material.uniforms.uTime.value += 0.05; // Extra flow speed boost
        }

        material.uniforms.uNoiseStrength.value = THREE.MathUtils.lerp(material.uniforms.uNoiseStrength.value, targetNoise, 0.1);
    } else {
        material.uniforms.uNoiseStrength.value = THREE.MathUtils.lerp(material.uniforms.uNoiseStrength.value, baseNoise, 0.1);
    }

    // physics step: move current positions towards target positions
    const positions = geometry.attributes.position.array;
    const targets = geometry.attributes.targetPos.array;

    let moveSpeed = CONFIG.lerpSpeed;

    // If 'contracted' (fist), we want to pull everything to center
    // If 'spread' (open hand), we loosen the attraction to target

    // Gesture influence
    let targetSpread = gestureState.spread;

    // Celebration Overrides (Win State)
    if (gameState.completed) {
        // 1. Rainbow Color Cycle
        let hue = (time * 0.2) % 1; // Cycle every 5 seconds
        material.uniforms.uColor.value.setHSL(hue, 1.0, 0.6); // Vibrance

        // 2. Pulse / Breathing Effect (Heartbeat or Fireworks)
        // Base spread + Sine wave
        targetSpread = 0.5 + 0.4 * Math.sin(time * 2.0);

        // 3. Extra Noise/Sparkle for joy
        material.uniforms.uNoiseStrength.value = 0.5 + 0.2 * Math.sin(time * 5.0);

        // 4. Faster Rotation
        particles.rotation.y += 0.005;

        // Smoothly interpolate current spread to the pulsing target
        material.uniforms.uSpread.value = THREE.MathUtils.lerp(material.uniforms.uSpread.value, targetSpread, 0.05);

    } else {
        material.uniforms.uSpread.value = THREE.MathUtils.lerp(material.uniforms.uSpread.value, targetSpread, 0.1);
        particles.rotation.y += 0.001;

        // Reset color if coming back from game? (Handled in startGame or Reset)
    }
    // Map hand rotation? No, keep it simple.

    // Update positions
    for (let i = 0; i < CONFIG.particleCount; i++) {
        let i3 = i * 3;

        let tx = targets[i3];
        let ty = targets[i3 + 1];
        let tz = targets[i3 + 2];

        // If 'explode' / spread is high, push target outward
        if (material.uniforms.uSpread.value > 0.5) {
            tx *= 1.5; ty *= 1.5; tz *= 1.5;
        }

        // Lerp position
        positions[i3] += (tx - positions[i3]) * moveSpeed;
        positions[i3 + 1] += (ty - positions[i3 + 1]) * moveSpeed;
        positions[i3 + 2] += (tz - positions[i3 + 2]) * moveSpeed;
    }

    geometry.attributes.position.needsUpdate = true;

    geometry.attributes.position.needsUpdate = true;

    // Game Logic
    if (gameState.active && !gameState.completed) {
        checkGameStatus();
    }

    // Hand Offset Logic (Only in Galaxy Mode or if requested)
    // Map hand position (-1..1) to world space offset
    // Let's say world view is approx -20..20
    if (targetShape === 'galaxy' && gestureState.hasHands && CONFIG.cameraEnabled) {
        let targetOffset = new THREE.Vector3(gestureState.handPosition.x * 50, gestureState.handPosition.y * 30, 0);
        // Apply if spread is negative (contracted) -> "Move all particle... by hand movement"
        // Only move if contracted? Or always? User said "contracts hand so particle contracts and move all particle"
        // Let's move always for better feedback, but maybe stronger when contracted.
        material.uniforms.uOffset.value.lerp(targetOffset, 0.1);
    } else {
        material.uniforms.uOffset.value.lerp(new THREE.Vector3(0, 0, 0), 0.05);
    }

    renderer.render(scene, camera);
}

function startGame() {
    console.log("Starting Secret Game");
    gameState.active = true;
    gameState.currentPointIndex = 0;
    gameState.completed = false;
    document.getElementById('game-ui').style.display = 'block';
    showNextPoint();
}

function showNextPoint() {
    if (gameState.currentPointIndex >= SECRET_POINTS.length) {
        winGame();
        return;
    }

    let pt = SECRET_POINTS[gameState.currentPointIndex];
    const el = document.getElementById('target-point');
    el.style.display = 'block';
    // Map 0..1 to percentage
    el.style.left = (pt.x * 100) + '%';
    el.style.top = (pt.y * 100) + '%';
}

function checkGameStatus() {
    if (gameState.currentPointIndex >= SECRET_POINTS.length) return;

    let target = SECRET_POINTS[gameState.currentPointIndex];

    // Hand position is -1..1 (center 0)
    // Target is 0..1 (center 0.5)
    // Convert Hand to 0..1
    let hx = (gestureState.handPosition.x + 1) / 2;
    let hy = 1 - (gestureState.handPosition.y + 1) / 2; // Unflip Y?
    // Wait, gestureState.y was -(y-0.5)*2 => -2y + 1. 
    // If y=0 (top), gesture=1. If y=1 (bottom), gesture=-1.
    // So hy should be convert gesture (-1..1) back to 0..1 (top..bottom).
    // range -1 (bottom) to 1 (top).
    // 0..1 y is top..bottom.
    // So if gesture is 1 (top), texture y is 0. 
    // formula: (1 - gesture) / 2 ? 
    // 1 -> 0. -1 -> 1. Correct.
    let normalizedHandY = (1 - gestureState.handPosition.y) / 2;
    let normalizedHandX = (gestureState.handPosition.x + 1) / 2;

    let dx = normalizedHandX - target.x;
    let dy = normalizedHandY - target.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    // Condition: Hand near point AND Contracted (spread < 0.1)
    if (dist < 0.15 && gestureState.spread < 0.1) {
        gameState.scoreTime += 0.05; // increment
        // Visual feedback?
        document.getElementById('target-point').style.borderColor = '#00ff00';

        if (gameState.scoreTime > 2.0) { // Hold for a bit
            // Success
            gameState.currentPointIndex++;
            gameState.scoreTime = 0;
            document.getElementById('target-point').style.borderColor = '#00ffff';
            document.getElementById('target-progress').style.background = `conic-gradient(#00ff00 0%, transparent 0%)`; // Reset
            showNextPoint();
        } else {
            // Update progress ring
            // Max scoreTime is 2.0. Percentage = (scoreTime / 2.0) * 100
            let pct = (gameState.scoreTime / 2.0) * 100;
            document.getElementById('target-progress').style.background = `conic-gradient(#00ff00 ${pct}%, transparent ${pct}%)`;
        }
    } else {
        gameState.scoreTime = Math.max(0, gameState.scoreTime - 0.05); // Decay
        document.getElementById('target-point').style.borderColor = '#00ffff';
        let pct = (gameState.scoreTime / 2.0) * 100;
        document.getElementById('target-progress').style.background = `conic-gradient(#00ff00 ${pct}%, transparent ${pct}%)`;
    }
}

function winGame() {
    gameState.completed = true;
    document.getElementById('target-point').style.display = 'none';
    document.getElementById('secret-message').style.display = 'block';

    // Inject Decrypted Messages
    document.getElementById('msg-title').innerText = reveal(SECRETS.title);
    document.getElementById('msg-body').innerText = reveal(SECRETS.body);
    document.getElementById('msg-sig').innerText = reveal(SECRETS.sig);

    // Firework effect automatically?
    // Transition back to Galaxy shape as requested
    updateTargetShape('galaxy');

    // Auto-enable camera if not already on
    if (!CONFIG.cameraEnabled) {
        enableCamera();
    }
}

// --- MediaPipe Hands ---
const videoElement = document.querySelector('.input_video');
let hands;
let cameraUtils;

function setupMediaPipe() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandsResults);

    cameraUtils = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
}

function onHandsResults(results) {
    if (!CONFIG.cameraEnabled) return;

    // 1. Detect Hands
    if (results.multiHandLandmarks.length > 0) {
        gestureState.hasHands = true;
        document.getElementById('cam-status-text').innerText = "Hands Detected";
        document.getElementById('cam-status-dot').style.backgroundColor = "#22c55e"; // Green

        // Logic:
        // Calculate average "openness" of hands.
        // Openness = distance between wrist (0) and finger tips (4, 8, 12, 16, 20).
        // Or simply distance between index tip (8) and thumb tip (4)? -> Pinch
        // Better: Average distance of tips from wrist.

        let totalOpenness = 0;
        let handCount = results.multiHandLandmarks.length;

        for (const landmarks of results.multiHandLandmarks) {
            // Wrist is 0
            // Tips: 4 (Thumb), 8 (Index), 12, 16, 20
            let wrist = landmarks[0];
            let tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];

            let avgDist = 0;
            for (let tip of tips) {
                let dx = tip.x - wrist.x;
                let dy = tip.y - wrist.y;
                avgDist += Math.sqrt(dx * dx + dy * dy);
            }
            avgDist /= 5;

            // Normalize: Closed fist is approx 0.1-0.2, Open hand is 0.3-0.5
            // Let's map 0.15 to 0.4 -> 0 to 1
            let openness = (avgDist - 0.2) * 5.0;
            openness = Math.max(0, Math.min(1, openness));
            totalOpenness += openness;
        }

        let finalOpenness = totalOpenness / handCount;

        // Map to spread
        // If fist (openness ~ 0) -> Contract (Spread = -0.5 ?)
        // If open (openness ~ 1) -> Expand (Spread = 1.0)

        // Let's set spread range: 0 is normal. 
        // We want: Fist -> Contract tightly. Open -> Explode.
        // Let's map 0..1 to -0.2 .. 1.0
        gestureState.spread = (finalOpenness * 1.5) - 0.2;

    } else {
        gestureState.hasHands = false;
        document.getElementById('cam-status-text').innerText = "Looking for hands...";
        document.getElementById('cam-status-dot').style.backgroundColor = "orange";

        // Slowly return to neutral
        gestureState.spread = THREE.MathUtils.lerp(gestureState.spread, 0, 0.05);
        gestureState.handPosition.set(0, 0);
    }

    // 2. Detect Position (Center of hands) for Galaxy Game
    if (gestureState.hasHands && results.multiHandLandmarks.length > 0) {
        let cx = 0, cy = 0;
        let count = 0;
        for (const landmarks of results.multiHandLandmarks) {
            cx += landmarks[9].x; // Middle finger knuckle as center approx
            cy += landmarks[9].y;
            count++;
        }
        cx /= count;
        cy /= count;

        // MediaPipe coords: 0,0 top-left, 1,1 bottom-right
        // WebGL/Three: -1,-1 to 1,1 (but Y flipped)
        // Map to -1..1 range AND FLIP X for "Mirror" feel (User moves Left -> Screen Left)
        // If user moves Left (Physical), Camera sees them on Right (Video x > 0.5).
        // We want final x to be negative (Left).
        // If x > 0.5 -> We want Negative.
        // So: (0.5 - cx) * factor.

        let nx = (0.5 - cx) * 2; // Inverted mapping for Mirror effect
        let ny = -(cy - 0.5) * 2; // Flip Y (Standard)

        // Smooth
        gestureState.prevHandPosition.copy(gestureState.handPosition); // Save prev
        gestureState.handPosition.x = THREE.MathUtils.lerp(gestureState.handPosition.x, nx, 0.1);
        gestureState.handPosition.y = THREE.MathUtils.lerp(gestureState.handPosition.y, ny, 0.1);

        // Calc Velocity
        let dx = gestureState.handPosition.x - gestureState.prevHandPosition.x;
        let dy = gestureState.handPosition.y - gestureState.prevHandPosition.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        // Smooth velocity
        gestureState.handVelocity = THREE.MathUtils.lerp(gestureState.handVelocity, dist, 0.2);
    }
}


// --- Global Camera Toggle ---
const enableCamera = () => {
    const toggleBtn = document.getElementById('toggle-cam-btn');
    const inputToggle = document.getElementById('input-mode-toggle');

    if (!cameraUtils) {
        setupMediaPipe();
        document.getElementById('loader').style.display = 'flex'; // Show loader while model loads
        cameraUtils.start().then(() => {
            document.getElementById('loader').style.display = 'none';
            CONFIG.cameraEnabled = true;
            toggleBtn.innerText = "Disable Camera";
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-secondary');
            inputToggle.checked = false; // Switch UI toggle to 'Hands' side visually if I had wired it that way, but here checked=Mouse. So unchecked.
            inputToggle.checked = false;
        });
    } else {
        // Toggle state
        CONFIG.cameraEnabled = !CONFIG.cameraEnabled;
        if (CONFIG.cameraEnabled) {
            cameraUtils.start();
            toggleBtn.innerText = "Disable Camera";
            inputToggle.checked = false;
        } else {
            cameraUtils.stop();
            toggleBtn.innerText = "Enable Camera";
            inputToggle.checked = true;
            document.getElementById('cam-status-text').innerText = "Camera Off";
            document.getElementById('cam-status-dot').style.backgroundColor = "#ef4444";
        }
    }
};

// --- UI Integration ---
function setupUI() {
    // Template Buttons
    document.querySelectorAll('.template-btn').forEach(btn => {

        btn.addEventListener('click', (e) => {
            // UI Update
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Logic Update
            let shape = e.target.dataset.shape;
            updateTargetShape(shape);

            // Galaxy Start Logic
            if (shape === 'galaxy') {
                // Wait 3 seconds then start game if not completed?
                // Or just start immediately? User said "after start one game time"
                setTimeout(() => {
                    if (targetShape === 'galaxy' && !gameState.active) {
                        // Show Intro Modal instead of direct start
                        document.getElementById('game-intro-modal').style.display = 'flex';
                    }
                }, 1000);
            } else {
                // Reset game ui if leaving?
                document.getElementById('game-ui').style.display = 'none';
                gameState.active = false;
            }
        });
    });

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const uiContainer = document.getElementById('ui-container');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            uiContainer.classList.toggle('mobile-menu-open');
        });

        // Close when clicking outside (on canvas) if open
        const canvas = document.querySelector('canvas');
        canvas.addEventListener('click', () => {
            if (uiContainer.classList.contains('mobile-menu-open')) {
                uiContainer.classList.remove('mobile-menu-open');
            }
        });
    }

    // Color
    const colorInput = document.getElementById('particle-color');
    colorInput.addEventListener('input', (e) => {
        const c = new THREE.Color(e.target.value);
        material.uniforms.uColor.value = c;
        document.getElementById('color-preview').style.color = e.target.value;
    });

    // Sliders
    document.getElementById('particle-size').addEventListener('input', (e) => {
        material.uniforms.uSize.value = parseFloat(e.target.value);
    });

    document.getElementById('motion-noise').addEventListener('input', (e) => {
        material.uniforms.uNoiseStrength.value = parseFloat(e.target.value);
    });

    // Toggle Camera
    const toggleBtn = document.getElementById('toggle-cam-btn');
    const inputToggle = document.getElementById('input-mode-toggle');

    toggleBtn.addEventListener('click', enableCamera);

    // The switch toggle also does the same
    inputToggle.addEventListener('change', (e) => {
        if (!e.target.checked) {
            // User wants Hands
            if (!CONFIG.cameraEnabled) enableCamera();
        } else {
            // User wants Mouse
            if (CONFIG.cameraEnabled) enableCamera(); // Toggle off
        }
    });

    // Instructions
    setTimeout(() => {
        document.getElementById('instructions').style.display = 'block';
    }, 1000);

    document.getElementById('close-instructions').addEventListener('click', () => {
        document.getElementById('instructions').style.display = 'none';
    });

    // Screenshot
    document.getElementById('screenshot-btn').addEventListener('click', () => {
        renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'particle_magic.png';
        a.click();
    });

    // Hide loader initially
    // Hide loader initially
    document.getElementById('loader').style.display = 'none';

    // Count Slider Listener
    document.getElementById('particle-count').addEventListener('change', (e) => {
        let newCount = parseInt(e.target.value);
        updateParticleCount(newCount);
    });

    // Help Button
    document.getElementById('help-btn').addEventListener('click', () => {
        document.getElementById('instructions').style.display = 'block';
    });

    // Locked Message Logic
    let lockedTimerInterval;

    const updateLockedMessage = () => {
        const now = new Date();
        const unlockDate = new Date('2031-12-13T00:00:00');
        const diff = unlockDate - now;

        const container = document.getElementById('locked-message-container');
        const textSpan = document.getElementById('locked-text');
        const timerDiv = document.getElementById('locked-timer');
        // Icon removed

        if (diff > 0) {
            // Locked
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            textSpan.style.display = 'none'; // Hide text while locked
            timerDiv.style.display = 'block';
            timerDiv.innerText = `Unlocks in: ${days}d ${hours}h ${minutes}m ${seconds}s`;

            container.classList.remove('unlocked-message');
        } else {
            // Unlocked
            textSpan.style.display = 'block';
            textSpan.innerText = "When you are reading this msg i think long time has been passed. while writing this message yes still today i have same feelings for you as we have met first time. i always hoping that we will be partners for life. but life has always played with me. 2020 - 2025 was my worst years i've faced. this is the last december now i will fool my heart to move on. but my feelings will always stays with me until im alive. i will always remember you. >3";
            textSpan.classList.add('unlocked-text');
            timerDiv.style.display = 'none';
            container.classList.add('unlocked-message');

            if (lockedTimerInterval) clearInterval(lockedTimerInterval);
        }
    };

    // Info Button (Secret Message)
    document.getElementById('info-btn').addEventListener('click', () => {
        document.getElementById('info-modal').style.display = 'flex';
        document.getElementById('stat-particles').innerText = CONFIG.particleCount.toLocaleString();

        updateLockedMessage();
        lockedTimerInterval = setInterval(updateLockedMessage, 1000);
    });

    // Close Info Button
    document.getElementById('close-info-btn').addEventListener('click', () => {
        document.getElementById('info-modal').style.display = 'none';
        if (lockedTimerInterval) clearInterval(lockedTimerInterval);
    });

    // Close modal on click outside
    document.getElementById('info-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('info-modal')) {
            document.getElementById('info-modal').style.display = 'none';
            if (lockedTimerInterval) clearInterval(lockedTimerInterval);
        }
    });

    // Replay Button
    // Start Game Button (Intro Modal)
    document.getElementById('start-game-btn').addEventListener('click', () => {
        document.getElementById('game-intro-modal').style.display = 'none';
        startGame();
    });

    // Replay Button
    document.getElementById('replay-btn').addEventListener('click', () => {
        document.getElementById('secret-message').style.display = 'none';
        document.getElementById('game-intro-modal').style.display = 'flex';
    });
}

// --- Obfuscation ---
const SECRETS = {
    title: "4p2SSnLCi8KawprCo0pswpPCnMKewpLCjsKLwqNKbsKTwpXCncKSwotLSuKdkg==",
    body: "woHCk8KdwpLCk8KYwpFKwqPCmcKfSsKWwpnCnsKdSsKZwpBKwpLCi8KawprCk8KYwo/CncKdVkrCkcKZwpnCjkrCksKPwovClsKewpJWSsKLwpjCjkrCncKfwo3CjcKPwp3CnVhKcsKLwqDCj0rCi8KYSsKLwpfCi8KkwpPCmMKRSsKjwo/Ci8KcSsKLwpLCj8KLwo5KwovCmMKOSsKPwpjClMKZwqNKwqPCmcKfwpxKwo7Ci8KjSzRKSkpKSkpKSkpKSkpKSkpK8Km4tOKdkkrino7vuLk=",
    sig: "wqhKbsKSwpzCn8KgSsKAwovCnMKTwos=",
    locked: "woHCksKPwphKwqPCmcKfSsKLwpzCj0rCnMKPwovCjsKTwpjCkUrCnsKSwpPCnUrCl8KdwpFKwpNKwp7CksKTwpjClUrClsKZwpjCkUrCnsKTwpfCj0rCksKLwp1KwozCj8KPwphKwprCi8Kdwp3Cj8KOWErCocKSwpPClsKPSsKhwpzCk8KewpPCmMKRSsKewpLCk8KdSsKXwo/CncKdwovCkcKPSsKjwo/CnUrCncKewpPClsKWSsKewpnCjsKLwqNKwpNKwpLCi8Kgwo9Kwp3Ci8KXwo9KwpDCj8KPwpbCk8KYwpHCnUrCkMKZwpxKwqPCmcKfSsKLwp1KwqHCj0rCksKLwqDCj0rCl8KPwp5KwpDCk8Kcwp3CnkrCnsKTwpfCj1hKwpNKwovClsKhwovCo8KdSsKSwpnCmsKTwpjCkUrCnsKSwovCnkrCocKPSsKhwpPClsKWSsKMwo9KwprCi8Kcwp7CmMKPwpzCnUrCkMKZwpxKwpbCk8KQwo9YSsKMwp/CnkrClsKTwpDCj0rCksKLwp1KwovClsKhwovCo8KdSsKawpbCi8Kjwo/CjkrCocKTwp7CkkrCl8KPWEpcWlxaSldKXFpcX0rCocKLwp1KwpfCo0rCocKZwpzCncKeSsKjwo/Ci8Kcwp1KwpNRwqDCj0rCkMKLwo3Cj8KOWErCnsKSwpPCnUrCk8KdSsKewpLCj0rClsKLwp3CnkrCjsKPwo3Cj8KXwozCj8KcSsKYwpnCoUrCk0rCocKTwpbClkrCkMKZwpnClkrCl8KjSsKSwo/Ci8Kcwp5Kwp7CmUrCl8KZwqDCj0rCmcKYWErCjMKfwp5KwpfCo0rCkMKPwo/ClsKTwpjCkcKdSsKhwpPClsKWSsKLwpbCocKLwqPCnUrCncKewovCo8KdSsKhwpPCnsKSSsKXwo9Kwp/CmMKewpPClkrCk8KXSsKLwpbCk8Kgwo9YSsKTSsKhwpPClsKWSsKLwpbCocKLwqPCnUrCnMKPwpfCj8KXwozCj8KcSsKjwpnCn1hKaF0="
};

function reveal(str) {
    try {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        // Decode UTF-8 bytes back to the shifted string
        const shifted = new TextDecoder('utf-8').decode(bytes);
        return shifted.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 42)).join('');
    } catch (e) {
        console.error("Decryption error:", e);
        return "???";
    }
}

function updateParticleCount(newCount) {
    CONFIG.particleCount = newCount;
    // ... rest of function ... (I need to be careful not to delete logic, wait `replace_file_content` replaces the block.
    // The previous code block was just `setupUI` end. Wait, `updateParticleCount` is *after* `setupUI`.
    // I am replacing the end of `setupUI` and adding the new functions.
    // I need to make sure I don't delete `updateParticleCount`.

    CONFIG.particleCount = newCount;

    // Remove old
    scene.remove(particles);
    if (geometry) geometry.dispose();

    // Regenerate
    generateShapes(newCount);

    // Create new
    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const targetPositions = new Float32Array(CONFIG.particleCount * 3);
    const randoms = new Float32Array(CONFIG.particleCount);

    for (let i = 0; i < CONFIG.particleCount; i++) {
        let i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 50;
        positions[i3 + 1] = (Math.random() - 0.5) * 50;
        positions[i3 + 2] = (Math.random() - 0.5) * 50;
        randoms[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('targetPos', new THREE.BufferAttribute(targetPositions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    updateTargetShape(targetShape);
}

// Init
init();
