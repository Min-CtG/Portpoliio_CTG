// --- Lenis Smooth Scrolling Setup ---
const lenis = new Lenis({
    duration: 1.0, 
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true
});
window.lenis = lenis;

lenis.on('scroll', ScrollTrigger.update)

gsap.ticker.add((time)=>{
    lenis.raf(time * 1000)
});
gsap.ticker.lagSmoothing(0)

// --- GSAP Animations ---

gsap.to(['.hero-content', '.scroll-indicator'], {
    scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: '500px top',
        scrub: true
    },
    opacity: 0,
    y: -50,
    pointerEvents: 'none'
});

gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", function() {
    if(document.querySelector('.reveal-text')) {
        const tl = gsap.timeline();
        tl.to(".reveal-text", { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: "power3.out", delay: 0.2 });
        if(document.getElementById('scroll-indicator')) {
            tl.to("#scroll-indicator", { opacity: 1, duration: 1, ease: "power2.inOut" }, "-=0.5");
        }
    }

    gsap.utils.toArray(".gs_reveal").forEach(function(elem) {
        gsap.set(elem, {autoAlpha: 0});
        ScrollTrigger.create({
            trigger: elem, start: "top 85%", 
            onEnter: function() { 
                gsap.fromTo(elem, {y: 40, autoAlpha: 0}, { duration: 1.2, y: 0, autoAlpha: 1, ease: "power3.out", overwrite: "auto" });
            }, 
            once: true 
        });
    });
});

document.querySelectorAll('[data-speed]').forEach(elem => {
    const speed = parseFloat(elem.getAttribute('data-speed'));
    gsap.to(elem, {
        y: () => (1 - speed) * 150, 
        ease: "none",
        scrollTrigger: {
            trigger: elem,
            start: "top bottom",
            end: "bottom top",
            scrub: true 
        }
    });
});

// --- Mouse Tracking State ---
let mouseX = 0;
let mouseY = 0;
let normX = 0;
let normY = 0;

document.addEventListener('mousemove', (event) => {
    // 1. 화면 상단 5% 영역(사이드바/네비게이션)에서는 3D 모델 반응 무시
    if (event.clientY < window.innerHeight * 0.05) return;

    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;
    
    // 기본 정규화 좌표 (-1 ~ 1)
    let rawNormX = (event.clientX / window.innerWidth) * 2 - 1;
    let rawNormY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // 2. 거리별 감도 저하 로직 (중앙은 현재 감도 유지, 멀어질수록 둔해짐)
    let distance = Math.sqrt(rawNormX * rawNormX + rawNormY * rawNormY);
    // 거리가 1일 때 감도가 약 절반으로 떨어지도록 설정
    let falloff = Math.max(0.3, 1.0 - Math.pow(distance * 0.7, 2));
    
    normX = rawNormX * falloff;
    normY = rawNormY * falloff;
    
    mouseX = (event.clientX - windowHalfX) * falloff;
    mouseY = (event.clientY - windowHalfY) * falloff;
});

// --- Three.js Main Background (Geometric Sphere) ---
const canvas = document.getElementById('bg-canvas');
let mainParticlesMaterial; 

// 3DGS(가우시안 스플래팅) 느낌을 내기 위한 부드러운 가우시안 텍스처(타원체/Splat) 생성기
function createSplatTexture() {
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 64;
    texCanvas.height = 64;
    const ctx = texCanvas.getContext('2d');
    
    // 중심이 진하고 가장자리로 갈수록 부드럽게 퍼지는 가우시안(Gaussian) 그래디언트
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(texCanvas);
}
const splatTexture = createSplatTexture();

if(canvas) {
    const scene = new THREE.Scene();
    
    // 핵심 최적화 1: 캔버스의 투명 배경(alpha)을 끄고 CSS 배경색과 똑같이 칠함
    // 브라우저가 투명 캔버스와 HTML을 합성(Compositing)하느라 생기는 엄청난 렉을 원천 차단 (가만히 있어도 렉 걸리는 현상 해결)
    scene.background = new THREE.Color('#030508'); 
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 45;
    camera.position.y = 5;

    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        alpha: false, // 투명도를 꺼서 렌더링 속도 2배 향상
        antialias: false,
        powerPreference: 'high-performance'
    });
    // 해상도는 원상복구(뭉개짐 해결)하되, 고해상도 뻥튀기는 방지
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);

    const isExhibition = document.body.classList.contains('exhibition-page');
    const isArtworks = document.body.classList.contains('artworks-page');
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 10000; // 최적화: 20000 -> 10000
    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);
    const radius = 22;

    if (!isExhibition && !isArtworks) {
        // Home 페이지: 메인 구(Sphere) 형태
        for(let i = 0; i < particlesCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / particlesCount);
            const theta = Math.sqrt(particlesCount * Math.PI) * phi;
            const r = radius + (Math.random() * 1.5 - 0.75); 

            const x = r * Math.cos(theta) * Math.sin(phi);
            const y = r * Math.sin(theta) * Math.sin(phi);
            const z = r * Math.cos(phi);

            posArray[i*3] = x;
            posArray[i*3+1] = y;
            posArray[i*3+2] = z;

            colorsArray[i*3] = (x / radius) * 0.5 + 0.5; 
            colorsArray[i*3+1] = (y / radius) * 0.5 + 0.5; 
            colorsArray[i*3+2] = (z / radius) * 0.5 + 0.8; 
        }
    } else {
        // Exhibition(얼굴) 또는 Artworks(말) 페이지: OBJ 스캔 로직
        for(let i = 0; i < particlesCount; i++) {
            // Scatter particles like ambient dust in a large area
            posArray[i*3] = (Math.random() - 0.5) * 120;
            posArray[i*3+1] = (Math.random() - 0.5) * 120;
            posArray[i*3+2] = (Math.random() - 0.5) * 120;

            // Subtle, dim colors for the dust so it's not overpowering
            colorsArray[i*3] = 0.2 + Math.random() * 0.1; 
            colorsArray[i*3+1] = 0.2 + Math.random() * 0.1; 
            colorsArray[i*3+2] = 0.3 + Math.random() * 0.2; 
        }

        setTimeout(() => {
            try {
                const loader = new THREE.OBJLoader();
                // 페이지에 따라 데이터를 다르게 로드
                const objDataToLoad = isArtworks ? lucyObjData : faceObjData;
                const object = loader.parse(objDataToLoad);
                
                let mesh;
                object.traverse((child) => {
                    if (child.isMesh && !mesh) mesh = child;
                });
                
                if (mesh) {
                    let geom = mesh.geometry;
                    if (geom.index) {
                        geom = geom.toNonIndexed();
                    }
                    
                    // Artworks(Lucy/Horse 등) 모델은 Z축이 위로 되어 있어서 정수리가 보이는 문제가 있습니다.
                    // X축을 기준으로 -90도 회전시켜서 똑바로 서게 만듭니다.
                    if (isArtworks) {
                        geom.rotateX(-Math.PI / 2);
                        // 뒷모습이 보이므로 Y축을 기준으로 180도 회전시켜 정면을 보도록 수정합니다.
                        geom.rotateY(Math.PI);
                    }

                    const pos = geom.attributes.position.array;
                    
                    geom.computeBoundingBox();
                    const bb = geom.boundingBox;
                    const size = new THREE.Vector3();
                    bb.getSize(size);
                    const center = new THREE.Vector3();
                    bb.getCenter(center);
                    
                    // 천사의 크기를 더 키우기 위해 타겟 사이즈를 45에서 65로 증가
                    const targetSize = isArtworks ? 65 : 45;
                    const scale = targetSize / Math.max(size.x, size.y, size.z);
                    const triCount = pos.length / 9;
                    
                    for(let i = 0; i < particlesCount; i++) {
                        const triIndex = Math.floor(Math.random() * triCount) * 9;
                        
                        let r1 = Math.random();
                        let r2 = Math.random();
                        if(r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
                        const r3 = 1 - r1 - r2;
                        
                        const px = pos[triIndex] * r1 + pos[triIndex+3] * r2 + pos[triIndex+6] * r3;
                        const py = pos[triIndex+1] * r1 + pos[triIndex+4] * r2 + pos[triIndex+7] * r3;
                        const pz = pos[triIndex+2] * r1 + pos[triIndex+5] * r2 + pos[triIndex+8] * r3;
                        
                        const finalX = (px - center.x) * scale;
                        const finalY = (py - center.y) * scale - 5; 
                        const finalZ = (pz - center.z) * scale;
                        
                        posArray[i*3] = finalX;
                        posArray[i*3+1] = finalY;
                        posArray[i*3+2] = finalZ;
                        
                        colorsArray[i*3] = 0.5 + (finalX / 30); 
                        colorsArray[i*3+1] = 0.6 + (finalY / 30); 
                        colorsArray[i*3+2] = 0.9 + (finalZ / 20);
                    }
                    
                    particlesGeometry.attributes.position.needsUpdate = true;
                    particlesGeometry.attributes.color.needsUpdate = true;
                }
            } catch (error) {
                console.error("OBJ Parse error:", error);
            }
        }, 100); // UI가 먼저 렌더링되도록 아주 짧은 지연(0.1초) 추가
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

    mainParticlesMaterial = new THREE.PointsMaterial({
        size: 0.55, // 0.35 -> 0.55 (개수 감소 보완)
        map: splatTexture, // 사각형 픽셀 대신 3DGS 가우시안 텍스처 적용
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particlesMesh = new THREE.Points(particlesGeometry, mainParticlesMaterial);
    scene.add(particlesMesh);

    lenis.on('scroll', (e) => {
        const progress = Math.min(e.scroll / (window.innerHeight * 0.6), 1); 
        const scaleFactor = 1 + (progress * 1.5); 
        particlesMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        mainParticlesMaterial.opacity = 0.8 * (1 - Math.pow(progress, 0.5));
        particlesMesh.visible = mainParticlesMaterial.opacity > 0.05;
    });

    // --- 깔끔하고 통일성 있는 배경: Cinematic Ambient Gaussian Dust (Bokeh Effect) ---
    const dustGeometry = new THREE.BufferGeometry();
    // 최적화: 1660 Super를 위해 먼지 입자 수를 15000 -> 8000으로 줄임
    const dustCount = 8000; 
    const dustPos = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustSpeeds = [];

    for(let i = 0; i < dustCount; i++) {
        // 360도로 화면을 꽉 채우기 위해 구(Sphere) 형태로 넓게 배치
        // 반경 50 ~ 250 사이에 랜덤하게 분포
        const radius = 50 + Math.random() * 200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        dustPos[i*3] = radius * Math.sin(phi) * Math.cos(theta);
        dustPos[i*3+1] = radius * Math.cos(phi);
        dustPos[i*3+2] = radius * Math.sin(phi) * Math.sin(theta); 

        // 떠오르는 속도와 방향
        dustSpeeds.push({
            y: Math.random() * 0.02 + 0.01,
            x: (Math.random() - 0.5) * 0.015
        });
        
        const colorChoice = Math.random();
        
        if (!isExhibition && !isArtworks) {
            // Main page: Faint Blue, Faint Gray
            if(colorChoice < 0.4) {
                dustColors[i*3] = 0.05; dustColors[i*3+1] = 0.1; dustColors[i*3+2] = 0.4; // 희미한 파랑
            } else if(colorChoice < 0.7) {
                dustColors[i*3] = 0.2; dustColors[i*3+1] = 0.2; dustColors[i*3+2] = 0.2; // 어두운 회색
            } else {
                dustColors[i*3] = 0.1; dustColors[i*3+1] = 0.2; dustColors[i*3+2] = 0.35; // 연하고 희미한 파랑
            }
        } else if (isExhibition) {
            // Exhibition page: Bright Orange, Gray
            if(colorChoice < 0.5) {
                dustColors[i*3] = 0.9; dustColors[i*3+1] = 0.5; dustColors[i*3+2] = 0.1; // 밝은 주황
            } else {
                dustColors[i*3] = 0.3; dustColors[i*3+1] = 0.3; dustColors[i*3+2] = 0.3; // 회색
            }
        } else if (isArtworks) {
            // Artworks page: Sky blue, Cyan, Pink (전체적으로 살짝 톤다운)
            if(colorChoice < 0.33) {
                dustColors[i*3] = 0.2; dustColors[i*3+1] = 0.4; dustColors[i*3+2] = 0.6; // Sky Blue
            } else if(colorChoice < 0.66) {
                dustColors[i*3] = 0.05; dustColors[i*3+1] = 0.5; dustColors[i*3+2] = 0.5; // Cyan
            } else {
                dustColors[i*3] = 0.6; dustColors[i*3+1] = 0.2; dustColors[i*3+2] = 0.4; // Pink
            }
        }
    }

    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

    const dustMaterial = new THREE.PointsMaterial({
        size: 2.5, // 1.5 -> 2.5 (먼지 수를 줄인 대신 크기를 키워서 볼륨감 유지)
        map: splatTexture, 
        vertexColors: true,
        transparent: true,
        opacity: 0.2, // 0.2로 미세 상향 (기존 0.3 -> 0.12 -> 0.2)
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const dustMesh = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustMesh);

    let targetRotationX = 0;
    let targetRotationY = 0;
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        
        if (particlesMesh.visible) {
            if (isExhibition || isArtworks) {
                // 조각상 모드 (Exhibition & Artworks):
                // 마우스가 화면 끝으로 가면 고개를 완전히 돌릴 수 있도록 민감도를 높임
                targetRotationY = normX * 1.2;
                targetRotationX = -normY * 1.2;
            } else {
                // 기본 홈 화면 모드 (Sphere):
                // 은은하게 계속 자전하는 효과 + 마우스 미세 반응
                targetRotationY = (normX * 0.3) + (elapsedTime * 0.02);
                targetRotationX = (-normY * 0.3) + (elapsedTime * 0.01);
            }

            particlesMesh.rotation.y += (targetRotationY - particlesMesh.rotation.y) * 0.05;
            particlesMesh.rotation.x += (targetRotationX - particlesMesh.rotation.x) * 0.05;
        }

        // [최적화] 전체 Mesh 자체를 미세하게 회전시켜 완벽하게 동일한 '먼지가 부유하는 느낌'을 주면서 CPU 부하를 0으로 만듭니다.
        // 먼지 파티클은 아주 천천히 자전하며 마우스 움직임에 매우 둔하게 반응
        dustMesh.rotation.z = elapsedTime * 0.02;
        dustMesh.rotation.y = (elapsedTime * 0.015) + (normX * 0.03);
        dustMesh.rotation.x = -normY * 0.03;

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- Three.js Mini Scenes ---
// Generate a 3D Lissajous curve (Oscilloscope Signal) point cloud
function generateSignalArtGeometry(count) {
    const posArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);
    
    // 전자공학(신호처리, DSP)의 상징인 Sinc 함수 (sin(x)/x) 형태의 3D 파동 그리드 생성
    const gridSize = Math.floor(Math.sqrt(count));
    const size = 7.0; // 그리드 전체 크기
    
    let i = 0;
    for(let x = 0; x < gridSize; x++) {
        for(let z = 0; z < gridSize; z++) {
            if(i >= count) break;
            
            // -size/2 부터 size/2 까지 좌표 매핑
            const px = (x / gridSize - 0.5) * size;
            const pz = (z / gridSize - 0.5) * size;
            
            // 중앙으로부터의 거리
            const distance = Math.sqrt(px*px + pz*pz);
            
            // Sinc 파동 계산 (물방울이 떨어진 듯한 파형, 신호처리의 이상적인 필터 형태)
            // 주기를 늘려달라는 요청에 따라 거리에 곱해지는 값을 3에서 8.5로 대폭 증가시켜 3번 출렁이도록 수정
            let py = 0;
            if (distance === 0) {
                py = 1.5;
            } else {
                py = (Math.sin(distance * 8.5) / (distance * 1.5)) * 1.5;
            }
            
            // 디지털적인 느낌을 주기 위해 약간의 고주파 노이즈(리플) 추가
            py += Math.cos(px * 8 + pz * 8) * 0.05;
            
            // 약간의 흩뿌림(Scatter)을 추가하여 3D Point Cloud(가우시안 스플래팅) 느낌 부여
            const scatter = 0.1;
            posArray[i*3] = px + (Math.random() - 0.5) * scatter;
            posArray[i*3+1] = py + (Math.random() - 0.5) * scatter;
            posArray[i*3+2] = pz + (Math.random() - 0.5) * scatter;

            // 색상: 글자 읽는 데 방해되지 않는 '고급스러운 무채색 + 아주 은은한 얼음빛(Cyan)'
            // 파동의 높이(py)에 따라 밝기가 미세하게 달라짐
            const intensity = 0.6 + (py * 0.2); 
            
            colorArray[i*3] = intensity * 0.85;      // R: 살짝 낮춤
            colorArray[i*3+1] = intensity * 0.90;    // G: 중간
            colorArray[i*3+2] = intensity * 1.0;     // B: 가장 높여서 차갑고 세련된 느낌
            
            i++;
        }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    return geometry;
}


function generateSpaceGeometry(count) {
    const posArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);
    
    const citySize = 50;
    const blockSize = 5;
    const gridCount = Math.floor(citySize / blockSize);
    
    // Generate deterministic buildings array
    const buildings = [];
    for (let x = -gridCount/2; x < gridCount/2; x++) {
        for (let z = -gridCount/2; z < gridCount/2; z++) {
            if (Math.random() < 0.15) continue; // Some empty lots/plazas
            const seed = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
            const rand = seed - Math.floor(seed);
            const h = 4.0 + rand * 22.0;
            const w = 2.5 + rand * 2.0;
            buildings.push({
                cx: x * blockSize,
                cz: z * blockSize,
                w: w,
                d: w,
                h: h
            });
        }
    }
    
    for(let i=0; i<count; i++) {
        let px, py, pz;
        let r, g, b;
        
        const type = Math.random();
        const groundY = -10.0; // Lower ground to give massive scale
        
        if (type < 0.15) {
            // Ground
            px = (Math.random() - 0.5) * citySize;
            pz = (Math.random() - 0.5) * citySize;
            py = groundY;
            
            // Grid neon lines
            if (Math.abs(px % blockSize) < 0.2 || Math.abs(pz % blockSize) < 0.2) {
                r = 0.0; g = 1.0; b = 1.0; // Cyan neon streets
                py += 0.05;
            } else {
                r = 0.02; g = 0.02; b = 0.05; // Dark void
            }
        } else {
            // Building surfaces
            const b_idx = Math.floor(Math.random() * buildings.length);
            const bld = buildings[b_idx];
            
            const face = Math.random();
            if (face < 0.15) { // Roof
                px = bld.cx + (Math.random() - 0.5) * bld.w;
                py = groundY + bld.h;
                pz = bld.cz + (Math.random() - 0.5) * bld.d;
            } else if (face < 0.575) { // X Walls
                px = bld.cx + (Math.random() < 0.5 ? -0.5 : 0.5) * bld.w;
                py = groundY + Math.random() * bld.h;
                pz = bld.cz + (Math.random() - 0.5) * bld.d;
            } else { // Z Walls
                px = bld.cx + (Math.random() - 0.5) * bld.w;
                py = groundY + Math.random() * bld.h;
                pz = bld.cz + (Math.random() < 0.5 ? -0.5 : 0.5) * bld.d;
            }
            
            // High quality details: Glowing windows
            const floorHeight = 1.2;
            const isWindow = (py - groundY) % floorHeight < 0.2 && Math.random() < 0.4;
            
            if (isWindow && face >= 0.15) { // Windows only on walls
                r = 1.0; g = 0.85; b = 0.3; // Warm gold light
            } else {
                // Cyberpunk dark blue/purple building gradient
                const hf = (py - groundY) / 26.0; 
                r = 0.1 + hf * 0.6; // pinkish at top
                g = 0.1 + hf * 0.1;
                b = 0.2 + hf * 0.8; // deep blue base, bright top
            }
            
            // Add antennas on roof
            if (face < 0.15 && Math.random() < 0.005) {
                py += Math.random() * 5.0;
                r = 1.0; g = 0.1; b = 0.1; // Red blinking light effect
            }
        }
        
        posArray[i*3] = px; posArray[i*3+1] = py; posArray[i*3+2] = pz;
        colorArray[i*3] = r; colorArray[i*3+1] = g; colorArray[i*3+2] = b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    return geometry;
}

function generateArtworkGeometry(count) {
    const posArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
        const t = Math.random() * Math.PI * 2;
        const offset = (Math.random() - 0.5) * 2.5;
        const x = Math.sin(t) + 2 * Math.sin(2 * t) + offset * Math.cos(t);
        const y = Math.cos(t) - 2 * Math.cos(2 * t) + offset * Math.sin(t);
        const z = -Math.sin(3 * t) + offset;
        const scale = 2.0;
        posArray[i*3] = x * scale;
        posArray[i*3+1] = y * scale;
        posArray[i*3+2] = z * scale;
        const hue = Math.random();
        if (hue < 0.3) { colorArray[i*3] = 0.9; colorArray[i*3+1] = 0.1; colorArray[i*3+2] = 0.5; }
        else if (hue < 0.6) { colorArray[i*3] = 0.9; colorArray[i*3+1] = 0.8; colorArray[i*3+2] = 0.1; }
        else if (hue < 0.8) { colorArray[i*3] = 0.1; colorArray[i*3+1] = 0.8; colorArray[i*3+2] = 0.9; }
        else { colorArray[i*3] = 0.1; colorArray[i*3+1] = 0.2; colorArray[i*3+2] = 0.9; }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    return geometry;
}

function createMiniScene(containerId, type = "signal") {
    const container = document.getElementById(containerId);
    if(!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 150);
    camera.position.z = type === 'space' ? 38 : (type === 'artworks' ? 12 : 8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    // 최적화: 미니 캔버스는 무조건 픽셀 비율 1.0으로 고정하여 과도한 연산(4K 모니터 등) 방지
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    container.appendChild(renderer.domElement);

    let particlesCount = type === 'space' ? 25000 : 25000;
    let geometry;

    if (type === 'signal') {
        geometry = generateSignalArtGeometry(particlesCount);
    } else if (type === 'space') {
        geometry = generateSpaceGeometry(particlesCount);
    } else if (type === 'artworks') {
        geometry = generateArtworkGeometry(particlesCount);
    }

    const material = new THREE.PointsMaterial({
        size: type === 'space' ? 1.3 : (type === 'artworks' ? 0.3 : 0.18), 
        map: splatTexture, 
        alphaTest: 0.01,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const mesh = new THREE.Points(geometry, material);
    scene.add(mesh);

    let localTargetX = 0;
    let localTargetY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let isHovering = false;

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        localTargetX = y * 2.5; 
        localTargetY = x * 2.5; 
    });

    container.addEventListener('mouseenter', () => { isHovering = true; });
    container.addEventListener('mouseleave', () => { 
        isHovering = false; 
        localTargetX = 0;
        localTargetY = 0;
    });

    let isVisible = false;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isVisible = entry.isIntersecting;
        });
    }, { threshold: 0 });
    observer.observe(container);

    function animateMini() {
        requestAnimationFrame(animateMini);
        
        // 화면에 안 보이면 GPU 연산 스킵
        if (!isVisible) return;

        // 마우스를 따라가는 부드러운 회전 (안에 있을 때만) - 추적 속도(관성) 복구
        currentRotX += (localTargetX - currentRotX) * 0.05;
        currentRotY += (localTargetY - currentRotY) * 0.05;

        // Base spin (기본 회전) + Mouse rotation (마우스 반응 회전)
        if (type === 'space') {
            mesh.rotation.y = (Date.now() * 0.0001) + currentRotY;
            mesh.rotation.x = currentRotX * 0.5 + Math.PI / 5.5; // Steeper angle looking down
        } else if (type === 'artworks') {
            mesh.rotation.x = (Date.now() * 0.0002) + currentRotX;
            mesh.rotation.y = (Date.now() * 0.0004) + currentRotY;
            mesh.rotation.z = (Date.now() * 0.0001);
        } else {
            mesh.rotation.x = (Date.now() * 0.0002) + currentRotX;
            mesh.rotation.y = (Date.now() * 0.0004) + currentRotY;
        }

        renderer.render(scene, camera);
    }
    animateMini();

    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight, false);
        }
    });
    resizeObserver.observe(container);
}

window.addEventListener('load', () => {
    createMiniScene('mini-canvas-1', 'signal'); 
    createMiniScene('mini-canvas-2', 'space');  
    createMiniScene('mini-canvas-3', 'artworks');
});

// --- Sidebar Toggle ---
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
};
