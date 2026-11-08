import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pdf as b
body, toc = b.number_headings(b.build_body())
body = body.replace('file://', '')
open(sys.argv[1], 'w', encoding='utf-8').write('<html><body>' + body + '</body></html>')
print('ok', len(toc))
