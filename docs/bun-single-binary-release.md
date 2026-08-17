# Bun 프로젝트를 `curl | sh` 로 설치되게 만들기

Bun으로 만든 CLI를 **받는 쪽에 Bun·Node·npm 없이** 설치되게 하는 방법.

원리는 하나입니다. `bun build --compile` 이 Bun 런타임을 실행 파일 안에 통째로 넣습니다. 결과물은 의존성 없는 단일 바이너리라, 사용자는 그냥 내려받아 실행하면 됩니다.

전체 그림:

```
git tag v1.0.0  →  GitHub Actions  →  플랫폼별 바이너리 + SHA256SUMS  →  Release
                                                                          ↓
                                          사용자: curl … install.sh | sh
```

예시 프로젝트는 `acme/widget`, 명령 이름은 `widget`, 진입점은 `src/cli.ts` 로 둡니다.

---

## 1. 로컬에서 컴파일 확인

먼저 손으로 한 번 만들어 봅니다. 워크플로부터 쓰면 실패했을 때 원인이 컴파일인지 CI인지 모릅니다.

```bash
bun build --compile ./src/cli.ts --outfile=widget
./widget --help
```

`package.json` 에 넣어둡니다.

```json
{
  "scripts": {
    "compile": "bun build --compile ./src/cli.ts --outfile=dist/widget"
  }
}
```

바이너리는 **50~100 MB** 쯤 됩니다. 런타임이 들어 있으니 당연하고, 줄이려 하지 않는 게 맞습니다.

### 크로스 컴파일

`--target` 으로 다른 플랫폼 바이너리를 한 기계에서 만들 수 있습니다.

```bash
bun build --compile --target=bun-linux-x64     ./src/cli.ts --outfile=dist/widget-linux-x64
bun build --compile --target=bun-linux-arm64   ./src/cli.ts --outfile=dist/widget-linux-arm64
bun build --compile --target=bun-darwin-arm64  ./src/cli.ts --outfile=dist/widget-darwin-arm64
bun build --compile --target=bun-darwin-x64    ./src/cli.ts --outfile=dist/widget-darwin-x64
```

되는지 **로컬에서 먼저 확인**하세요. 되면 CI를 러너 하나로 끝낼 수 있습니다. 다만 아래 워크플로는 러너별 네이티브 빌드로 씁니다 — 플랫폼마다 테스트도 같이 돌리려면 어차피 그 플랫폼 러너가 필요하고, 크로스 컴파일은 "빌드는 됐는데 그 OS에서 실행은 안 해봤다"가 되기 쉽습니다.

---

## 2. 릴리스 워크플로

`.github/workflows/release.yml`. **태그 push에만** 반응합니다.

```yaml
name: release

on:
  push:
    tags:
      - "v*"

# 릴리스를 만들려면 쓰기 권한이 필요합니다. 없으면 publish 단계에서 403.
permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - runner: macos-14         # Apple Silicon
            target: bun-darwin-arm64
            asset: darwin-arm64
          - runner: macos-13         # Intel
            target: bun-darwin-x64
            asset: darwin-x64
          - runner: ubuntu-latest
            target: bun-linux-x64
            asset: linux-x64
          - runner: ubuntu-24.04-arm
            target: bun-linux-arm64
            asset: linux-arm64
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.13        # 고정. latest 로 두면 릴리스마다 런타임이 바뀝니다
      - run: bun install --frozen-lockfile

      # 릴리스에 들어가는 빌드는 평소 CI보다 약하면 안 됩니다.
      # 평소 돌리는 검증을 여기에도 그대로 넣으세요.
      - run: bun run check
      - run: bun test

      - run: bun build --compile --target=${{ matrix.target }} ./src/cli.ts --outfile=widget
      - run: tar -czf widget-${{ matrix.asset }}.tar.gz widget
      - uses: actions/upload-artifact@v4
        with:
          name: widget-${{ matrix.asset }}
          path: widget-${{ matrix.asset }}.tar.gz

  publish:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: dist
          merge-multiple: true       # 네 아티팩트를 한 디렉터리로 모읍니다

      # 체크섬은 모든 아카이브가 모인 뒤 한 번에. 파일명이 SHA256SUMS 안의
      # 이름과 정확히 같아야 설치 스크립트가 찾습니다.
      - run: cd dist && sha256sum *.tar.gz > SHA256SUMS

      - uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/*.tar.gz
            dist/SHA256SUMS
```

**태그 없이 먼저 시험하고 싶으면** `on:` 에 `workflow_dispatch:` 를 추가하세요. Actions 탭에서 수동 실행으로 빌드까지 확인하고, 그 다음에 태그를 밉니다. 첫 릴리스는 되돌리기 번거로우니 이 순서를 권합니다.

---

## 3. 설치 스크립트

저장소 루트에 `install.sh`. 사용자가 `curl | sh` 로 실행하는 파일입니다.

```sh
#!/bin/sh
set -eu

REPOSITORY="acme/widget"
VERSION="${WIDGET_VERSION:-latest}"
INSTALL_DIRECTORY="${WIDGET_INSTALL_DIR:-$HOME/.local/bin}"

# uname 출력을 릴리스 자산 이름에 맞춥니다. 모르는 플랫폼은 조용히
# 넘어가지 말고 거절해야 합니다 — 안 그러면 404를 받고 이유를 모릅니다.
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)            TARGET="darwin-arm64" ;;
  Darwin-x86_64)           TARGET="darwin-x64" ;;
  Linux-x86_64)            TARGET="linux-x64" ;;
  Linux-aarch64|Linux-arm64) TARGET="linux-arm64" ;;
  *) printf '%s\n' "지원하지 않는 플랫폼: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

if [ "$VERSION" = "latest" ]; then
  RELEASE_URL="https://github.com/$REPOSITORY/releases/latest/download"
else
  RELEASE_URL="https://github.com/$REPOSITORY/releases/download/$VERSION"
fi

ARCHIVE="widget-$TARGET.tar.gz"
TEMP_DIRECTORY="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIRECTORY"' EXIT HUP INT TERM

# -f: HTTP 오류를 실패로. 없으면 404 본문을 tar.gz 로 저장하고 압축 해제에서 죽습니다.
# -L: 릴리스 자산은 리다이렉트됩니다.
curl -fL --proto '=https' --tlsv1.2 "$RELEASE_URL/$ARCHIVE" -o "$TEMP_DIRECTORY/$ARCHIVE"
curl -fL --proto '=https' --tlsv1.2 "$RELEASE_URL/SHA256SUMS" -o "$TEMP_DIRECTORY/SHA256SUMS"

EXPECTED="$(awk -v file="$ARCHIVE" '$2 == file { print $1 }' "$TEMP_DIRECTORY/SHA256SUMS")"
if [ -z "$EXPECTED" ]; then
  printf '%s\n' "$ARCHIVE 의 체크섬이 없습니다" >&2
  exit 1
fi

# macOS 는 shasum, 리눅스는 sha256sum. 둘 다 없으면 검증을 건너뛰지 말고 죽어야 합니다.
if command -v shasum >/dev/null 2>&1; then
  ACTUAL="$(shasum -a 256 "$TEMP_DIRECTORY/$ARCHIVE" | awk '{ print $1 }')"
else
  ACTUAL="$(sha256sum "$TEMP_DIRECTORY/$ARCHIVE" | awk '{ print $1 }')"
fi
[ "$EXPECTED" = "$ACTUAL" ] || { printf '%s\n' "체크섬 불일치" >&2; exit 1; }

mkdir -p "$INSTALL_DIRECTORY"
tar -xzf "$TEMP_DIRECTORY/$ARCHIVE" -C "$TEMP_DIRECTORY"
install -m 0755 "$TEMP_DIRECTORY/widget" "$INSTALL_DIRECTORY/widget"

printf '%s\n' "설치 완료: $INSTALL_DIRECTORY/widget"

case ":$PATH:" in
  *":$INSTALL_DIRECTORY:"*) ;;
  *) printf '%s\n' "PATH 에 $INSTALL_DIRECTORY 를 추가하세요" >&2 ;;
esac
```

설계에서 중요한 것 셋:

- **체크섬을 검증하고, 검증할 수 없으면 설치하지 않습니다.** `curl | sh` 는 사용자가 내용을 안 보고 실행하는 방식이라, 스크립트가 내려받는 것에 대해서만큼은 확인해야 합니다.
- **환경변수로 버전과 경로를 열어둡니다.** `WIDGET_VERSION=v0.9.0` 로 고정 설치, `WIDGET_INSTALL_DIR` 로 위치 변경. `sudo` 없이 되는 `~/.local/bin` 이 기본이어야 합니다.
- **임시 디렉터리는 `trap` 으로 정리합니다.** 중간에 실패해도 남지 않게.

---

## 4. 릴리스 내기

```bash
git tag v1.0.0
git push origin v1.0.0
```

워크플로가 돌고 나면 확인:

```bash
gh release list
gh run list --workflow=release.yml --limit 1

# 문서에 적은 URL 이 실제로 살아 있는지. 404 면 아직 아무것도 안 나간 것입니다.
curl -sSI -o /dev/null -w '%{http_code}\n' -L \
  https://github.com/acme/widget/releases/latest/download/widget-darwin-arm64.tar.gz
```

마지막 확인을 꼭 하세요. README에 설치 명령을 적어두는 것과 그 명령이 동작하는 것은 다른 얘기고, 태그를 한 번도 안 밀었으면 문서만 맞고 링크는 404입니다.

---

## 5. 사용자가 쓰는 명령

README에 적을 내용:

````markdown
```sh
curl -fsSL https://raw.githubusercontent.com/acme/widget/main/install.sh | sh
widget --help
```

특정 버전: `WIDGET_VERSION=v0.9.0 curl -fsSL … | sh`
````

---

## 흔한 함정

| 증상 | 원인 |
|---|---|
| publish 단계 403 | `permissions: contents: write` 누락 |
| 릴리스에 자산이 하나만 | `merge-multiple: true` 없이 다운로드해 디렉터리가 갈림 |
| 설치 스크립트가 체크섬을 못 찾음 | `SHA256SUMS` 의 파일명과 실제 자산 이름 불일치 |
| 압축 해제 실패 | `curl` 에 `-f` 가 없어 404 HTML 을 저장 |
| 릴리스마다 동작이 달라짐 | `bun-version: latest` — 고정하세요 |
| macOS에서 "확인되지 않은 개발자" | 서명·공증 안 함. 배포 규모가 커지면 `codesign` + `notarytool` 필요 |
| arm64 리눅스 빌드 없음 | `ubuntu-24.04-arm` 러너 사용. 공개 저장소는 무료, 비공개는 요금 확인 |

**Windows** 는 이 경로 밖입니다. `--target=bun-windows-x64` 로 `.exe` 는 나오지만 `install.sh` 가 안 돌아가므로 PowerShell 설치 스크립트를 따로 두거나 `.zip` 직접 내려받기로 안내합니다.
