from pathlib import Path
import hashlib

path = Path('app.js')
raw = path.read_bytes()
assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == '0f7892835eeedfc1944bc80f1028a597576387a6', 'Unexpected app revision'
s = raw.decode('utf-8')

def replace(old, new):
    global s
    assert s.count(old) == 1, 'Unexpected anchor: ' + old[:100]
    s = s.replace(old, new, 1)

replace('async function loadMailBodyPreview_(details){',
        '// Share pending body reads when a table is redrawn during a request.\n'
        'const MAIL_BODY_PREVIEW_PENDING_=new Map();\n'
        'async function loadMailBodyPreview_(details){')
replace("   const data=await rpc('getMailBodyUi',ref);\n   const normalized=storeMailBodyPreview_(ref,data);",
        "   let pending=MAIL_BODY_PREVIEW_PENDING_.get(ref);\n"
        "   if(!pending){\n"
        "     pending=rpc('getMailBodyUi',ref).then(data=>storeMailBodyPreview_(ref,data));\n"
        "     MAIL_BODY_PREVIEW_PENDING_.set(ref,pending);\n"
        "   }\n"
        "   let normalized;\n"
        "   try{normalized=await pending;}\n"
        "   finally{if(MAIL_BODY_PREVIEW_PENDING_.get(ref)===pending)MAIL_BODY_PREVIEW_PENDING_.delete(ref);}")
replace("function bindMailBodyPreviews_(){\n document.querySelectorAll('#mailRows .mail-body-preview')",
        "function bindMailBodyPreviews_(rootSelector='#mailRows'){\n document.querySelectorAll(rootSelector+' .mail-body-preview')")
replace('function renderNewsLetters(){',
        "function renderNewsLetters(){\n"
        " const openPreviews=new Set([...document.querySelectorAll('#newsRows .mail-body-preview[open]')].map(d=>d.dataset.bodyRef));")
replace('<td><b>${safeLink(x.sendsay,x.subject)||esc(x.subject)}</b></td>',
        '<td><b>${safeLink(x.sendsay,x.subject)||esc(x.subject)}</b>${mailBodyPreviewHtml_(x)}</td>')
replace(" document.getElementById('newsMore').classList.toggle('hidden',rows.length<=registryLimits.news);",
        " document.getElementById('newsMore').classList.toggle('hidden',rows.length<=registryLimits.news);\n"
        " bindMailBodyPreviews_('#newsRows');\n"
        " document.querySelectorAll('#newsRows .mail-body-preview').forEach(d=>{if(openPreviews.has(d.dataset.bodyRef))d.open=true;});")
path.write_text(s, encoding='utf-8')
for name in ['domain-auth.js', 'index.html']:
    path = Path(name)
    text = path.read_text(encoding='utf-8')
    assert text.count('20261016-demo-match-01') == 1
    path.write_text(text.replace('20261016-demo-match-01', '20261016-news-preview-01'), encoding='utf-8')
print('News preview assembled. No server, data or DEMO-calculation changes.')
