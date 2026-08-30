import os
import subprocess
import argparse
import sys
import shutil
import tkinter as tk
from tkinter import filedialog, simpledialog

"""
[Multi-View to 3DGS Automation Pipeline]
여러 장의 사진을 입력받아 3D Gaussian Splatting 모델(.ply)을 생성하는 스크립트입니다.
더블클릭해서 실행하면 폴더 선택창(GUI)이 뜹니다.
COLMAP 자동 감지, 한글 경로 자동 처리 포함.
"""

def get_colmap_path():
    """COLMAP 실행 파일을 자동으로 찾아주는 함수"""
    # 1. 시스템 PATH에서 찾기
    result = subprocess.run("where colmap", shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        return "colmap"
    
    # 2. 같은 폴더 내 다운로드된 COLMAP에서 찾기
    script_dir = os.path.dirname(os.path.abspath(__file__))
    local_colmap = os.path.join(script_dir, "COLMAP", "bin", "colmap.exe")
    if os.path.exists(local_colmap):
        return local_colmap

    # 3. 압축 해제된 다른 패턴 확인
    for item in os.listdir(script_dir):
        candidate = os.path.join(script_dir, item, "bin", "colmap.exe")
        if os.path.exists(candidate):
            return candidate

    return None

def run_command(command, error_msg, env=None):
    print(f"\n[실행 중...] {command}")
    result = subprocess.run(command, shell=True, env=env)
    if result.returncode != 0:
        print(f"[오류 발생] {error_msg}")
        input("\n오류를 확인했습니다. 창을 닫으려면 엔터를 누르세요...")
        sys.exit(1)

def safe_copy_folder(src_dir, temp_dir):
    """한글 경로 문제 해결: 이미지 폴더를 영문 전용 임시 폴더로 복사"""
    dest = os.path.join(temp_dir, "input")
    if os.path.exists(dest):
        shutil.rmtree(dest)
    shutil.copytree(src_dir, dest)
    print(f"[INFO] 이미지 폴더를 안전한 경로로 복사했습니다: {dest}")
    return dest

def main():
    parser = argparse.ArgumentParser(description="Multi-view images to 3DGS Pipeline")
    parser.add_argument("--image_dir", help="사진들이 들어있는 폴더 경로")
    parser.add_argument("--gs_repo_dir", help="공식 gaussian-splatting 폴더 경로")
    args = parser.parse_args()

    image_dir = args.image_dir
    gs_repo_dir = args.gs_repo_dir

    if not image_dir:
        root = tk.Tk()
        root.withdraw()
        print("사진이 들어있는 폴더를 선택해주세요 (팝업창 확인)...")
        image_dir = filedialog.askdirectory(title="사진이 들어있는 폴더를 선택하세요")
        if not image_dir:
            print("선택이 취소되었습니다.")
            input("종료하려면 엔터를 누르세요...")
            sys.exit(0)
            
        proj_name = simpledialog.askstring("프로젝트 이름", "결과물을 저장할 프로젝트 이름을 영어로 입력하세요:\n(예: porsche_3d)")
        if not proj_name:
            print("입력이 취소되었습니다.")
            input("종료하려면 엔터를 누르세요...")
            sys.exit(0)
            
        output_dir = os.path.join(os.path.expanduser("~"), "Desktop", "html-portpolio-3dgs", "3dgs-code", "result", proj_name)
    else:
        proj_name = "output"
        output_dir = "./output"

    if not gs_repo_dir:
        gs_repo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gs_repo")
        if not os.path.exists(gs_repo_dir):
            print(f"[오류] 엔진 폴더를 찾을 수 없습니다: {gs_repo_dir}")
            input("종료하려면 엔터를 누르세요...")
            sys.exit(1)

    image_dir = os.path.abspath(image_dir)
    gs_repo_dir = os.path.abspath(gs_repo_dir)
    os.makedirs(output_dir, exist_ok=True)

    # 한글 경로 문제 해결: 영문 임시 폴더로 복사
    script_dir = os.path.dirname(os.path.abspath(__file__))
    temp_dir = os.path.join(script_dir, "_temp_data")
    safe_image_dir = safe_copy_folder(image_dir, temp_dir)

    # COLMAP 경로 자동 감지
    colmap_path = get_colmap_path()
    if not colmap_path:
        print("[오류] COLMAP을 찾을 수 없습니다!")
        print("       이 폴더 안에 COLMAP이 압축 해제되어 있는지 확인하세요.")
        input("종료하려면 엔터를 누르세요...")
        sys.exit(1)
    
    print(f"[INFO] COLMAP 위치: {colmap_path}")

    # COLMAP 경로를 convert.py에 전달하기 위해 환경변수에 추가
    env = os.environ.copy()
    colmap_bin_dir = os.path.dirname(os.path.abspath(colmap_path))
    colmap_lib_dir = os.path.join(os.path.dirname(colmap_bin_dir), "lib")
    env["PATH"] = colmap_bin_dir + ";" + colmap_lib_dir + ";" + env.get("PATH", "")
    
    # Qt 플러그인 경로 설정 (COLMAP GUI/그래픽 모듈 로드용)
    env["QT_PLUGIN_PATH"] = os.path.join(colmap_lib_dir, "plugins")
    env["QT_QPA_PLATFORM_PLUGIN_PATH"] = os.path.join(colmap_lib_dir, "plugins", "platforms")

    # 1. COLMAP 실행
    print(f"\n=== STEP 1: 카메라 위치 추적 (COLMAP) 시작 ===")
    print(f"    프로젝트: {proj_name}")
    convert_script = os.path.join(gs_repo_dir, "convert.py")
    if not os.path.exists(convert_script):
        print(f"[오류] {convert_script} 를 찾을 수 없습니다.")
        input("종료하려면 엔터를 누르세요...")
        sys.exit(1)

    run_command(
        f"python \"{convert_script}\" -s \"{temp_dir}\" --colmap_executable \"{colmap_path}\"",
        "COLMAP 처리 중 오류가 발생했습니다.",
        env=env
    )

    # 2. 3D GS 학습
    print(f"\n=== STEP 2: 3D Gaussian Splatting 학습 시작 ===")
    train_script = os.path.join(gs_repo_dir, "train.py")
    iterations = 7000 
    
    run_command(
        f"python \"{train_script}\" -s \"{temp_dir}\" -m \"{output_dir}\" --iterations {iterations}",
        "학습 중 오류가 발생했습니다."
    )

    # 임시 폴더 정리
    try:
        shutil.rmtree(temp_dir)
    except:
        pass

    print("\n" + "=" * 50)
    print("   ✨ 학습 성공! ✨")
    print("=" * 50)
    print(f"\n결과물(.ply) 파일이 다음 경로에 저장되었습니다:")
    print(f"-> {output_dir}\\point_cloud\\iteration_{iterations}\\point_cloud.ply")
    input("\n종료하려면 엔터를 누르세요...")

if __name__ == "__main__":
    main()
