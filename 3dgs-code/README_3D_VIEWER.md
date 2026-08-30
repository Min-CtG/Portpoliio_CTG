# 3D Gaussian Splatting 웹 뷰어 연동 가이드

랩실에서 학습시킨 3D GS 결과를 웹 포트폴리오(Exhibition 페이지)에 띄우는 방법입니다.

## 1. 파일 형식 변환 (.ply -> .splat)
COLMAP이나 3D GS 원본 코드로 학습시킨 결과물은 보통 무거운 `.ply` 파일입니다. 
웹에서 빠르게 띄우려면 용량이 최적화된 `.splat` 포맷으로 변환하는 것이 좋습니다.

* 변환 툴: 뷰어 라이브러리(GaussianSplats3D)에서 제공하는 컨버터를 사용하거나, 파이썬 스크립트를 통해 `.ply`를 `.splat`으로 변환하세요.

## 2. 웹에 띄우기 적용 순서

1. `homepage/exhibition.html` 파일을 에디터로 엽니다.
2. 실제 렌더링할 3D 모델 파일(`.splat`)들을 `homepage/models/` 같은 폴더를 만들어 그 안에 넣습니다.
3. `exhibition.html` 파일의 맨 아랫부분( `</body>` 태그 바로 위)에 다음 코드를 삽입합니다.

```html
<script type="module">
  // 방금 3dgs-code 폴더에 만들어둔 뷰어 스크립트를 불러옵니다.
  import { loadGaussianSplat } from '../3dgs-code/gs_viewer_setup.js';
  
  // HTML의 ID 값과 3D 모델 파일 경로를 연결합니다.
  // 'viewer-arch'는 건축물 박스의 ID입니다.
  loadGaussianSplat('viewer-arch', './models/your_architecture_model.splat');
  
  // 자동차 모델
  loadGaussianSplat('viewer-car', './models/your_car_model.splat');
</script>
```

4. 로컬 웹 서버(예: 파이썬 `python -m http.server`)를 켜고 접속하면 브라우저에서 3D 모델을 마우스로 돌려볼 수 있습니다!
