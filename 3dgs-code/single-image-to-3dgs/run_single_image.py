import os
import subprocess
import argparse
import sys
import shutil
import tkinter as tk
from tkinter import filedialog, simpledialog

"""
[Single Image to 3DGS Automation Pipeline (TripoSR 기반)]
더블클릭해서 실행하면 2D 이미지 파일을 고르는 탐색기 창이 뜹니다.
C++ 컴파일러 없이도, GTX 1660 SUPER(6GB)에서 작동합니다.
"""

def run_command(command, error_msg, cwd=None):
    print(f"\n[실행 중...] {command}")
    result = subprocess.run(command, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"[오류 발생] {error_msg}")
        input("\n오류를 확인했습니다. 창을 닫으려면 엔터를 누르세요...")
        sys.exit(1)

def safe_copy_image(img_path, temp_dir):
    """한글 경로 문제 해결: 영문 전용 임시 폴더로 이미지 복사"""
    os.makedirs(temp_dir, exist_ok=True)
    _, ext = os.path.splitext(img_path)
    safe_name = f"input_image{ext}"
    safe_path = os.path.join(temp_dir, safe_name)
    shutil.copy2(img_path, safe_path)
    print(f"[INFO] 이미지를 안전한 경로로 복사했습니다: {safe_path}")
    return safe_path

def main():
    parser = argparse.ArgumentParser(description="Single 2D Image to 3D Model Pipeline")
    parser.add_argument("--image_path", help="입력할 2D 이미지 경로")
    args = parser.parse_args()

    img_path = args.image_path

    if not img_path:
        root = tk.Tk()
        root.withdraw()
        print("학습할 2D 이미지(그림)를 선택해주세요 (팝업창 확인)...")
        img_path = filedialog.askopenfilename(
            title="3D로 만들 그림/이미지를 선택하세요", 
            filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")]
        )
        if not img_path:
            print("선택이 취소되었습니다.")
            input("종료하려면 엔터를 누르세요...")
            sys.exit(0)
            
        proj_name = simpledialog.askstring(
            "프로젝트 이름", 
            "결과물 이름을 영어로 입력하세요:\n(예: my_masterpiece)"
        )
        if not proj_name:
            print("입력이 취소되었습니다.")
            input("종료하려면 엔터를 누르세요...")
            sys.exit(0)
    else:
        proj_name = "output_3d"

    # 결과물 저장 경로
    result_base = os.path.join(
        os.path.expanduser("~"), "Desktop", 
        "html-portpolio-3dgs", "3dgs-code", "result", proj_name
    )
    os.makedirs(result_base, exist_ok=True)

    # TripoSR 엔진 경로
    engine_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "triposr_engine")
    if not os.path.exists(engine_dir):
        print(f"[오류] TripoSR 엔진을 찾을 수 없습니다: {engine_dir}")
        input("종료하려면 엔터를 누르세요...")
        sys.exit(1)

    img_path = os.path.abspath(img_path)

    # 한글 경로 문제 해결
    temp_dir = os.path.join(engine_dir, "_temp_input")
    safe_img_path = safe_copy_image(img_path, temp_dir)

    # TripoSR의 run.py 실행
    output_obj = os.path.join(result_base, f"{proj_name}.obj")

    print(f"\n=== 3D 모델 생성 시작 ({proj_name}) ===")
    print(f"엔진: TripoSR (StabilityAI)")
    print(f"GPU: NVIDIA GeForce GTX 1660 SUPER (6GB)")
    print(f"이 작업은 1~3분 정도 소요됩니다...\n")

    run_command(
        f'python run.py "{safe_img_path}" '
        f'--output-dir "{result_base}" '
        f'--model-save-format obj '
        f'--render '
        f'--mc-resolution 128 '       # 6GB VRAM에 맞춘 낮은 해상도 (기본 256)
        f'--no-remove-bg ',            # 이미 rembg 없이 원본 그대로 처리
        "3D 모델 생성 실패",
        cwd=engine_dir
    )

    # 임시 파일 정리
    try:
        shutil.rmtree(temp_dir)
    except:
        pass
    
    print("\n" + "=" * 50)
    print("   ✨ 3D 모델 생성 완료! ✨")
    print("=" * 50)
    print(f"\n결과물이 아래 폴더에 저장되었습니다:")
    print(f"-> {result_base}")
    print(f"\n생성된 파일:")
    for f in os.listdir(result_base):
        print(f"   📄 {f}")
    print(f"\n.obj 파일을 3D 뷰어(Windows 3D 뷰어, Blender 등)로 열어보세요!")
    input("\n종료하려면 엔터를 누르세요...")

if __name__ == "__main__":
    main()
