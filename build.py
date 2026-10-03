"""dist/index.html(일반 웹용)과 dist/artifact.html(Claude 아티팩트용)을 만든다.
docs/index.html은 GitHub Pages(https://yeondol26.github.io, 게시 폴더 /docs)에 그대로 올라가는 웹용 사본."""
from pathlib import Path
R = Path(__file__).parent
head = (R/"src/head.html").read_text(encoding="utf-8")
body = (R/"src/body.html").read_text(encoding="utf-8")
data = (R/"src/data.js").read_text(encoding="utf-8") + (R/"src/data2.js").read_text(encoding="utf-8")
app = (R/"src/app.js").read_text(encoding="utf-8")
scripts = f"<script>\n{data}</script>\n<script>\n{app}</script>\n"
(R/"dist").mkdir(exist_ok=True)
# Claude 아티팩트: doctype/html/head/body 없이 내용만 (게시할 때 뼈대가 자동으로 붙음)
(R/"dist/artifact.html").write_text(head + body + scripts, encoding="utf-8")
# 일반 웹: 완전한 HTML 문서
style = head[:head.index("</style>") + len("</style>")]
web = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
       '<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#23262D">'
       + style + '<style>body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);'
       'padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>'
       '</head><body>' + body + scripts + '</body></html>')
(R/"dist/index.html").write_text(web, encoding="utf-8")
(R/"docs").mkdir(exist_ok=True)
(R/"docs/index.html").write_text(web, encoding="utf-8")
print("built dist/index.html, dist/artifact.html, docs/index.html")
