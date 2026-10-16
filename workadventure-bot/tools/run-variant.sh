#!/bin/bash
# usage: run-variant.sh "<WA_TAP value>"   -> runs bot + speaking test client in the room, prints the captured block pattern
cd "$(dirname "$0")/.."
killbots() { powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*src/bot.mjs*' -or \$_.CommandLine -like '*test-human.mjs*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1; }
URL="https://play.workadventu.re/@/team-php/team-php/startup"
for attempt in 1 2 3 4; do
  killbots; sleep 2; rm -rf out/debug-audio
  (WA_TAP="$1" WA_DEBUG_AUDIO=1 WANDER=0 WA_FILLER=0 WA_MAP_URL="$URL" RUN_SECONDS=175 node src/bot.mjs > /dev/null 2>&1 &)
  sleep 34
  out=$(WA_MAP_URL="$URL" MSG="hola" SPEAK=1 SPEAK_FILE="test/fixtures/voice/2.m4a" WAIT=10 timeout 150 node test/manual/test-human.mjs 2>&1 | grep -a -E "bubble formed")
  if echo "$out" | grep -q "true"; then sleep 25; break; fi
done
killbots
node -e '
const fs=require("fs");
if(!fs.existsSync("out/debug-audio")){console.log("no segments captured");process.exit()}
for (const f of fs.readdirSync("out/debug-audio").filter(x=>x.endsWith(".wav")).sort()) {
  const b=fs.readFileSync("out/debug-audio/"+f); const n=(b.length-44)/2; let p="", z=0, t=0;
  for (let i=0;i+4096<=n;i+=4096){let s=0,nz=0;for(let j=0;j<4096;j++){const v=b.readInt16LE(44+(i+j)*2);s+=v*v;if(v!==0)nz++;} const zero=nz<80; t++; if(zero)z++; p+=zero?"0":Math.sqrt(s/4096)/32768>0.01?"S":"n";}
  console.log(f,(n/16000).toFixed(1)+"s empty blocks "+Math.round(100*z/t)+"% :",p, "|", fs.readFileSync("out/debug-audio/"+f.replace(".wav",".txt"),"utf8").split("\n")[1]);
}'
