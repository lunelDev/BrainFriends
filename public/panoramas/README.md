# 360° Panoramas

XR Model Viewer (`/select-page/xr/model-viewer`) 가 이 폴더의 `scene.jpg` 를 자동으로 시도합니다.

## 사용법

1. equirectangular 2:1 비율 360° 파노라마 이미지를 준비
   - 권장 해상도: 4096 × 2048
   - 포맷: JPG (PNG 도 가능)
   - 크기: 5MB 이하 권장 (브라우저 메모리)

2. 이 디렉토리에 `scene.jpg` 로 저장

3. `/select-page/xr/model-viewer` 진입 시 자동 사용
   - 파일이 없으면 프로시저럴 그라데이션 fallback

## 예시 출처

- 자체 촬영: 360° 카메라 (Insta360, Theta 등)
- 무료: poly haven (https://polyhaven.com/hdris) — HDRI 도 사용 가능
- 운영자 제공: 사이버 투어 운영처에서 원본 파일 요청

## 다중 씬 (TODO)

추후 `scene-1.jpg`, `scene-2.jpg` ... 다중 파노라마 + scene picker UI 추가 예정.
