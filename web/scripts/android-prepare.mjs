// Generate and configure the Android project (web/android is not committed; it is rebuilt from here).
// Usage: npm run build && node scripts/android-prepare.mjs [versionCode] [versionName]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const versionCode = Number(process.argv[2] ?? 1);
const versionName = process.argv[3] ?? '1.0.0';

if (!fs.existsSync(path.join(root, 'android'))) run('npx cap add android');
run("npx -y @capacitor/assets@3.0.5 generate --android --iconBackgroundColor '#e08a1e' --iconBackgroundColorDark '#e08a1e' --splashBackgroundColor '#131416' --splashBackgroundColorDark '#131416'");
run('npx cap sync android');

const edit = (file, fn) => {
  const p = path.join(root, 'android', file);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`android-prepare: nothing changed in ${file}`);
  fs.writeFileSync(p, after);
};

// Haptics use navigator.vibrate, which the WebView only honours with this permission.
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
if (!manifest.includes('android.permission.VIBRATE')) edit('app/src/main/AndroidManifest.xml', (s) => s.replace(
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.VIBRATE" />'));

// The game server runs on plain HTTP (http://<vps-ip>:5555), so allow cleartext traffic.
const manifest2 = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
if (!manifest2.includes('usesCleartextTraffic')) edit('app/src/main/AndroidManifest.xml', (s) => s.replace('<application', '<application\n        android:usesCleartextTraffic="true"'));

// Stable version numbers and a committed debug key, so each new build installs over the previous one.
edit('app/build.gradle', (s) => s
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${versionName}"`)
  .replace(s.includes('android-config/debug.keystore') ? /^\b$/ : /\nandroid \{\n/, `\nandroid {\n    signingConfigs {\n        debug {\n            storeFile file("../../android-config/debug.keystore")\n            storePassword "android"\n            keyAlias "androiddebugkey"\n            keyPassword "android"\n        }\n    }\n`));

console.log(`android project ready: versionCode ${versionCode}, versionName ${versionName}`);
