# Single 2D PNG to 3D Gaussian Splatting (Art to 3D)

미술을 하셨던 이력을 살려, 직접 그리신 2D 이미지나 그림 1장만으로 3D Gaussian Splatting 모델을 뚝딱 만들어내는 최신 AI 파이프라인입니다.

이 스크립트는 전 세계적으로 가장 널리 쓰이는 **DreamGaussian** 아키텍처를 기반으로 작성되었습니다.

## 🛠 필수 준비물
이 코드를 로컬 컴퓨터에서 돌리려면 Stable Diffusion/Zero123 류의 모델을 메모리에 올려야 하므로, VRAM이 넉넉한 NVIDIA GPU(최소 12GB 이상 권장)가 필요합니다.

1. **DreamGaussian 리포지토리 클론**:
   ```bash
   git clone https://github.com/dreamgaussian/dreamgaussian
   cd dreamgaussian
   ```
2. **가상환경(Conda) 및 라이브러리 설치**:
   ```bash
   conda create -n dreamgaussian python=3.10
   conda activate dreamgaussian
   pip install -r requirements.txt
   ```
3. **디퓨전(Diffusion) 가중치 모델**: `run_single_image.py` 스크립트를 실행하면 필요한 Zero123 가중치 파일들을 자동으로 다운로드합니다.

## 🚀 사용 방법

준비된 단일 2D 이미지(예: `my_art.png`)를 가지고 아래와 같이 스크립트를 실행합니다.

```bash
# 사용 예시
python run_single_image.py --image_path "C:/my_art_folder/drawing.png" --dreamgaussian_dir "C:/path/to/dreamgaussian" --name "my_masterpiece"
```

### 실행 흐름:
1. **전처리 (Pre-processing)**: `rembg` AI가 이미지의 배경을 자동으로 지우고 객체를 중앙에 정렬합니다.
2. **Coarse 3DGS Training**: Zero123 AI가 2D 이미지를 보고 옆면과 뒷면을 상상하여 3D Point Cloud(Gaussian)로 빠르게 학습시킵니다. (보통 3~5분 소요)
3. **추출 (Export)**: 학습이 끝나면 웹 뷰어에서 돌려볼 수 있는 `.ply` 3D 모델 파일이 떨어집니다.

이제 이 `.ply` 파일을 `.splat`으로 압축하여 아까 만든 포트폴리오의 Exhibition 페이지에 연동하시면 됩니다!
