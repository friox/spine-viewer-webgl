# Spine Viewer WebGL

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)
![Spine](https://img.shields.io/badge/Spine_WebGL-4.1%20/%204.2-E9572B)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white)

`spine-webgl`을 활용하여 다양한 버전의 Spine 데이터를 웹 브라우저에서 간단하게 렌더링하고 테스트할 수 있는 뷰어입니다.

## ✨ Features

* **다양한 포맷 지원**: `.skel` (바이너리 또는 `.bytes`), `.atlas` (텍스트 또는 `.txt`), `.png` 파일로 구성된 Spine 데이터를 웹 브라우저에서 즉시 렌더링합니다.
* **자동 스케일링**: 업로드된 `.png` 텍스처 파일의 해상도가 `.atlas` 파일에 정의된 사이즈와 다를 경우 자동으로 스케일링을 수행하여 깨짐 현상을 방지합니다.
* **파츠 활성화/비활성화**: 슬롯을 활성화/비활성화하여 원하는 파츠만 렌더링할 수 있습니다.

## 🚀 Getting Started

```bash
git clone https://github.com/friox/spine-viewer-webgl.git
cd spine-viewer-webgl
yarn install
yarn dev
```
명령어 실행 후 로컬 서버(`http://localhost:5173`)가 열리면 브라우저에서 접속하여 확인할 수 있습니다.

## 💡 Usage

뷰어 화면 우측의 `스파인 데이터 선택` 버튼을 통해 다음 파일들을 **모두 함께 선택(다중 선택)**하여 업로드합니다.
1. 스켈레톤 바이너리 데이터 (`.skel` 또는 `.bytes`)
2. 아틀라스 텍스트 데이터 (`.atlas` 또는 `.txt`)
3. 아틀라스 데이터에서 요구하는 모든 이미지 파일 (`.png`)
또는, 스파인 데이터가 포함된 폴더를 좌측 캔버스로 드래그 앤 드롭하여 업로드합니다.

## 📝 License

이 프로젝트에 포함된 소스 코드 자체는 [MIT License](LICENSE)를 따릅니다.

> **⚠️ Spine Runtimes License Notice**  
> 이 프로젝트에서 사용된 `@esotericsoftware/spine-webgl` 런타임 패키지와 관련된 렌더링 엔진 코드는 Esoteric Software의 [Spine Runtimes License Agreement](http://esotericsoftware.com/spine-in-depth#Licensing)를 따릅니다. Spine 런타임을 상업적인 제품이나 앱에 통합하여 배포하려면 정식 Spine 라이선스가 필요합니다.