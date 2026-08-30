# Multi-View to 3D Gaussian Splatting

여러 장의 사진이나 영상을 캡처해서 3D 모델로 만드는 정석적인 3DGS 코드 파이프라인입니다.

## 🛠 필수 준비물
이 파이프라인을 내 컴퓨터에서 직접 돌리려면 강력한 NVIDIA GPU가 필요합니다.

1. **Anaconda (miniconda)**
2. **CUDA Toolkit** (11.8 권장)
3. **COLMAP**: Structure from Motion(카메라 위치 추적) 프로그램
4. **공식 Gaussian Splatting 코드**:
   ```bash
   git clone https://github.com/graphdeco-inria/gaussian-splatting --recursive
   ```

## 🚀 사용 방법

1. 사진들을 한 폴더에 모아둡니다. (예: `C:/my_data/house_photos/input/`)
2. 터미널(아나콘다 프롬프트)을 열고 환경을 세팅합니다.
3. 제공해드린 자동화 파이썬 스크립트를 실행합니다.

```bash
# 사용 예시
python run_pipeline.py --image_dir "C:/my_data/house_photos" --gs_repo_dir "C:/path/to/gaussian-splatting"
```

위 코드를 실행하면 COLMAP을 통한 전처리부터, 7000번 반복 학습하는 3DGS Training까지 모두 자동으로 진행되며, 최종 결과물로 `.ply` 파일이 생성됩니다.
