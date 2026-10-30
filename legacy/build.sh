#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

export JAVA_HOME="$PREFIX/lib/jvm/java-21-openjdk"
export PATH="$JAVA_HOME/bin:$PREFIX/bin:$PATH"
export TMPDIR="$PREFIX/tmp"

BUILD_DIR="${BUILD_DIR:-$HOME/medbuild}"
OUT_DIR="${OUT_DIR:-$HOME/medout}"
KEYSTORE="$OUT_DIR/medtimer.jks"
PROJECT_KEYSTORE="$PWD/signing/medtimer.jks"
if [ -f "$PROJECT_KEYSTORE" ]; then
  KEYSTORE="$PROJECT_KEYSTORE"
fi
cd "$BUILD_DIR"

rm -rf build
mkdir -p build/gen build/classes build/dex "$OUT_DIR"

echo "== aapt2 compile =="
aapt2 compile --dir res -o build/res.zip

echo "== aapt2 link =="
aapt2 link -o build/app-unsigned.apk \
  -I android.jar \
  --manifest AndroidManifest.xml \
  --java build/gen \
  --min-sdk-version 26 \
  --target-sdk-version 34 \
  --version-code 13 \
  --version-name 1.6.2 \
  build/res.zip

echo "== javac =="
find src build/gen -name '*.java' > build/sources.txt
javac -encoding UTF-8 --release 8 -Xlint:-options \
  -classpath android.jar \
  -d build/classes \
  @build/sources.txt

echo "== d8 =="
find build/classes -name '*.class' > build/classes.txt
d8 --release --min-api 26 --lib android.jar --output build/dex @build/classes.txt

echo "== package =="
cp build/app-unsigned.apk build/app-with-dex.apk
(cd build && zip -q -j app-with-dex.apk dex/classes.dex)

if [ ! -f "$KEYSTORE" ]; then
  echo "== keystore =="
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias medtimer \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass medtimer123 -keypass medtimer123 \
    -dname "CN=MedTimer, OU=Personal, O=DSH, L=Local, ST=Local, C=CN"
fi

echo "== sign =="
apksigner sign --ks "$KEYSTORE" --ks-key-alias medtimer \
  --ks-pass pass:medtimer123 --key-pass pass:medtimer123 \
  --out "$OUT_DIR/medtimer.apk" build/app-with-dex.apk

echo "== verify =="
apksigner verify --verbose "$OUT_DIR/medtimer.apk" | head -30

ls -lh "$OUT_DIR/medtimer.apk"
