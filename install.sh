#!/bin/sh
set -eu

REPOSITORY="sir-mirr/agent-local-mailer"
BINARY_NAME="agent-local-mailer"
VERSION="${AGENT_MAILER_VERSION:-latest}"
INSTALL_DIRECTORY="${AGENT_MAILER_INSTALL_DIR:-$HOME/.local/bin}"

# uname 출력을 릴리스 자산 이름에 맞춥니다.
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

ARCHIVE="$BINARY_NAME-$TARGET.tar.gz"
TEMP_DIRECTORY="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIRECTORY"' EXIT HUP INT TERM

printf '%s\n' "⚡ [Agent Local Mailer] $TARGET 바이너리 다운로드 중..."

# -f: HTTP 오류를 실패로 처리
# -L: 릴리스 리다이렉트 추적
curl -fL --proto '=https' --tlsv1.2 "$RELEASE_URL/$ARCHIVE" -o "$TEMP_DIRECTORY/$ARCHIVE"
curl -fL --proto '=https' --tlsv1.2 "$RELEASE_URL/SHA256SUMS" -o "$TEMP_DIRECTORY/SHA256SUMS"

EXPECTED="$(awk -v file="$ARCHIVE" '$2 == file { print $1 }' "$TEMP_DIRECTORY/SHA256SUMS")"
if [ -z "$EXPECTED" ]; then
  printf '%s\n' "❌ 오류: $ARCHIVE 의 체크섬을 SHA256SUMS 에서 찾을 수 없습니다." >&2
  exit 1
fi

# macOS는 shasum, 리눅스는 sha256sum 사용
if command -v shasum >/dev/null 2>&1; then
  ACTUAL="$(shasum -a 256 "$TEMP_DIRECTORY/$ARCHIVE" | awk '{ print $1 }')"
else
  ACTUAL="$(sha256sum "$TEMP_DIRECTORY/$ARCHIVE" | awk '{ print $1 }')"
fi

if [ "$EXPECTED" != "$ACTUAL" ]; then
  printf '%s\n' "❌ 오류: 체크섬 불일치 (위변조 또는 다운로드 손상 가능성)" >&2
  exit 1
fi

printf '%s\n' "🔒 체크섬 무결성 검증 완료: $ACTUAL"

mkdir -p "$INSTALL_DIRECTORY"
tar -xzf "$TEMP_DIRECTORY/$ARCHIVE" -C "$TEMP_DIRECTORY"
install -m 0755 "$TEMP_DIRECTORY/$BINARY_NAME" "$INSTALL_DIRECTORY/$BINARY_NAME"
ln -sf "$INSTALL_DIRECTORY/$BINARY_NAME" "$INSTALL_DIRECTORY/alm"

printf '\n%s\n' "🎉 설치 완료!"
printf '%s\n' "  실행 파일: $INSTALL_DIRECTORY/$BINARY_NAME"
printf '%s\n' "  단축 별칭: $INSTALL_DIRECTORY/alm"

case ":$PATH:" in
  *":$INSTALL_DIRECTORY:"*) ;;
  *)
    printf '\n%s\n' "⚠️  경고: $INSTALL_DIRECTORY 경로가 PATH 에 포함되어 있지 않습니다."
    printf '%s\n' "  아래 명령을 쉘 설정(~/.zshrc 또는 ~/.bashrc)에 추가하세요:"
    printf '%s\n' "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac
