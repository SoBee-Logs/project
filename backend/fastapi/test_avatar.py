import subprocess
import sys
from pathlib import Path

import httpx

USER_ID = 1
OUTPUT_DIR = Path("test_output")
OUTPUT_DIR.mkdir(exist_ok=True)

print(f"아바타 생성 중... (user_id: {USER_ID})")

response = httpx.post(
    "http://localhost:8000/api/avatar",
    json={"user_id": USER_ID},
    timeout=120,
)

if response.status_code != 200:
    print(f"오류: {response.status_code}")
    print(response.text)
    sys.exit(1)

data = response.json()
print(f"\n타이틀: {data['avatar_title']}")
print(f"설명:   {data['avatar_description']}")
print(f"이미지: {data['avatar_image']}")

persona_path = OUTPUT_DIR / "persona.txt"
persona_path.write_text(
    f"[아바타 타이틀]\n{data['avatar_title']}\n\n"
    f"[페르소나 선정 이유]\n{data['avatar_description']}\n\n"
    f"[이미지 URL]\n{data['avatar_image']}",
    encoding="utf-8",
)

print(f"\n페르소나 설명: {persona_path}")
subprocess.run(["open", str(persona_path)])
