/**
 * 3D Gaussian Splatting WebGL Viewer Integration
 * 
 * 이 코드는 랩실에서 학습시킨 3D GS 모델(.splat 또는 .ply)을 
 * 포트폴리오의 Exhibition 페이지에 띄우기 위한 뷰어 연동 코드입니다.
 * 
 * 사용 라이브러리: https://github.com/mkkellogg/GaussianSplats3D
 */

import * as GaussianSplats3D from 'https://unpkg.com/@mkkellogg/gaussian-splats-3d@0.4.2/build/gaussian-splats-3d.module.js';

/**
 * 특정 HTML 요소 안에 3D GS 모델을 로드하는 함수
 * @param {string} containerId - 뷰어를 띄울 HTML 요소의 ID (예: 'viewer-arch')
 * @param {string} splatUrl - 로드할 .splat 또는 .ply 파일의 경로
 */
export async function loadGaussianSplat(containerId, splatUrl) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 기존의 Placeholder 텍스트 지우기
    container.innerHTML = '';

    // 뷰어 초기화
    const viewer = new GaussianSplats3D.Viewer({
        'rootElement': container,
        'cameraUp': [0, -1, -0.6], // 카메라 업 벡터 (데이터에 따라 조절 필요)
        'initialCameraPosition': [0, 2, 5],
        'initialCameraLookAt': [0, 0, 0],
        'halfPrecisionVideoTexture': true, // 메모리 최적화
        'useBuiltInControls': true // 마우스 드래그/줌 컨트롤 활성화
    });

    try {
        // 스플랫 데이터 로드 및 렌더링 시작
        await viewer.addSplatScene(splatUrl, {
            'splatAlphaCrop': 0.2, // 노이즈(Floaters) 제거 수치
            'showLoadingUI': true
        });
        
        viewer.start();
        console.log(`[Success] Loaded 3D GS model into #${containerId}`);
    } catch (error) {
        console.error(`[Error] Failed to load splat from ${splatUrl}:`, error);
        container.innerHTML = `<p style="color: red;">Failed to load 3D model.</p>`;
    }
}

// ---------------------------------------------------------
// [사용 방법]
// exhibition.html 파일의 맨 아래에 아래 코드를 추가하여 실행하세요.
//
// <script type="module">
//   import { loadGaussianSplat } from '../3dgs-code/gs_viewer_setup.js';
//   
//   // 파일 경로에는 실제 .splat 파일 경로를 넣으시면 됩니다.
//   // loadGaussianSplat('viewer-arch', './models/architecture.splat');
//   // loadGaussianSplat('viewer-car', './models/porsche.splat');
//   // loadGaussianSplat('viewer-art', './models/human_sculpture.splat');
// </script>
// ---------------------------------------------------------
