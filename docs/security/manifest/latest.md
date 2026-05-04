# Release Manifest (BrainFriends)

생성: 2026-04-30T05:32:09.744Z
제품: golden 0.1.0
Manifest Hash (SHA-256): `97079f5ff913e6eb825f3d08171ea0b2fd4878d6607f018622c08c7d306a7810`

## 형상요소 (5개)

| ID | 설명 | SHA-256 (앞 16자) | 메타 |
|---|---|---|---|
| git-sha | Git HEAD commit (코드 base) | `22853fc9f2b3d00d…` | dirty=true, gitSha=f18702e5baeb968eee562da4e4118b689d6f156a |
| package-lock | npm 의존성 lock (정확한 트리) | `8b39d7c218fa3314…` | path=package-lock.json |
| python-requirements | voice-analysis-service Python 의존성 동결 | `b357a8b79899718a…` | path=voice-analysis-service/requirements.txt |
| sbom | SBOM (CycloneDX, npm 트리) | `9204cf7cc0d1eed1…` | path=docs/security/sbom/latest.json |
| soup | SOUP 목록 (npm + pypi + model) | `8a7dc2ea950a616c…` | path=docs/security/soup/latest.json |

## 검증

- 서버 시작 시 `verifyManifest` (src/lib/server/releaseManifest.ts) 가 위 manifestHash 를 재계산해 일치 여부 확인
- 불일치 (sha 변조 / version 불일치 / 누락 / 추가) 시 audit log 기록 + 정책에 따라 시작 차단
- 본 manifest 자체의 무결성은 `manifestHash` 와 components 배열의 결정성 정렬로 보장
