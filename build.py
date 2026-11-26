"""판(학기)마다 일반 웹용과 Claude 아티팩트용 HTML을 만든다.
- 1학기(Ⅰ단원): src/data.js + src/data2.js → dist/index.html, dist/artifact.html, docs/index.html
- 2학기(Ⅱ·Ⅲ단원): src/sem2/*.js(이름순) → dist/sem2/index.html, dist/sem2/artifact.html, docs/2/index.html
docs/ 아래 파일은 GitHub Pages(https://yeondol26.github.io, 게시 폴더 /docs)에 그대로 올라가는 웹용 사본."""
from pathlib import Path
R = Path(__file__).parent
HEAD = (R/"src/head.html").read_text(encoding="utf-8")
APP = (R/"src/app.js").read_text(encoding="utf-8")
EDITIONS = [
    dict(name="1학기", data=["src/data.js", "src/data2.js"], body="src/body.html", title=None,
         dist="dist", docs="docs"),
    dict(name="2학기", data=sorted(str(p.relative_to(R)) for p in (R/"src/sem2").glob("*.js")),
         body="src/sem2/body.html", title="현대사 암기 카드", dist="dist/sem2", docs="docs/2"),
]

def build(ed):
    head = HEAD
    if ed["title"]:
        old = head[head.index("<title>"):head.index("</title>") + len("</title>")]
        head = head.replace(old, f"<title>{ed['title']}</title>", 1)
    body = (R/ed["body"]).read_text(encoding="utf-8")
    data = "".join((R/f).read_text(encoding="utf-8") for f in ed["data"])
    scripts = f"<script>\n{data}</script>\n<script>\n{APP}</script>\n"
    (R/ed["dist"]).mkdir(parents=True, exist_ok=True)
    # Claude 아티팩트: doctype/html/head/body 없이 내용만 (게시할 때 뼈대가 자동으로 붙음)
    (R/ed["dist"]/"artifact.html").write_text(head + body + scripts, encoding="utf-8")
    # 일반 웹: 완전한 HTML 문서
    style = head[:head.index("</style>") + len("</style>")]
    web = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
           '<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#23262D">'
           + style + '<style>body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);'
           'padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>'
           '</head><body>' + body + scripts + '</body></html>')
    (R/ed["dist"]/"index.html").write_text(web, encoding="utf-8")
    (R/ed["docs"]).mkdir(parents=True, exist_ok=True)
    (R/ed["docs"]/"index.html").write_text(web, encoding="utf-8")
    print(f"built {ed['name']}: {ed['dist']}/index.html, {ed['dist']}/artifact.html, {ed['docs']}/index.html")

for ed in EDITIONS:
    if (R/ed["body"]).exists() and ed["data"]:
        build(ed)
