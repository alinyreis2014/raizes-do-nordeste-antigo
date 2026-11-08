"""
Gera o PDF do trabalho (padrão ABNT) a partir dos arquivos de docs/.

Uso:  python docs/pdf/build_pdf.py
Requer: pip install markdown playwright pypdf pdfplumber reportlab && playwright install chromium
Edite o bloco CONFIG abaixo (links do repositório e do site) e rode de novo.
"""
import html, os, re, sys
import markdown
import pdfplumber
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from playwright.sync_api import sync_playwright

# ======================= CONFIG =======================
CONFIG = {
    'instituicao': 'CENTRO UNIVERSITÁRIO INTERNACIONAL UNINTER',
    'aluno': 'ALINY REIS RAMOS',
    'ru': '5071671',
    'cidade': 'PINDAMONHANGABA – SP',
    'ano': '2026',
    'titulo': 'REDE RAÍZES DO NORDESTE',
    'subtitulo': 'projeto de interface multicanal (app, web e totem) com foco em experiência do usuário e LGPD',
    'trilha': 'Trilha Front-End',
    'repo': os.environ.get('REPO_URL', 'https://github.com/alinyreis2014/raizes-do-nordeste'),
    'site': os.environ.get('SITE_URL', 'https://alinyreis2014.github.io/raizes-do-nordeste/'),
}
# ======================================================

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.dirname(HERE)
OUT = os.path.join(HERE, f"{CONFIG['ru']}_Projeto_Front_End.pdf")
CHROME = os.environ.get('CHROME_PATH')

fig_counter = [0]


def a(url):
    u = html.escape(url)
    return f'<a href="{u}">{u}</a>'


def autolink(h):
    return re.sub(r'(?<!["=>])(https?://[^\s<]+[^\s<.,;)])', lambda m: f'<a href="{m.group(1)}">{m.group(1)}</a>', h)


def figure(path, caption, width='100%'):
    fig_counter[0] += 1
    src = 'file://' + os.path.join(DOCS, path)
    return (f'<figure style="--w:{width}"><figcaption>Figura {fig_counter[0]} – {html.escape(caption)}</figcaption>'
            f'<img src="{src}" alt=""><p class="fonte">Fonte: autoria própria ({CONFIG["ano"]}).</p></figure>')


def read(name):
    with open(os.path.join(DOCS, name), encoding='utf-8') as f:
        return f.read()


def prep(md, mermaid_figs=(), drop_after_rule=False):
    md = re.sub(r'^# .*\n', '', md, count=1)                       # remove o título do arquivo
    md = re.sub(r'^> O GitHub desenha.*\n', '', md, flags=re.M)
    md = re.sub(r'^> \*\*Na demonstração\*\*.*\n', '', md, flags=re.M)
    if drop_after_rule:
        md = re.split(r'\n---\n\*\*Image[mn]s? pront', md)[0]
    figs = iter(mermaid_figs)

    def mer(_m):
        path, cap = next(figs)
        return f'\n[[FIG:{path}|{cap}]]\n'
    md = re.sub(r'```mermaid\n.*?```', mer, md, flags=re.S)
    md = re.sub(r'^(#+)\s+\d+(\.\d+)*\.?\s+', r'\1 ', md, flags=re.M)   # numeração vem do script
    md = re.sub(r'\[([^\]]+)\]\((?!http)[^)]+\.(md|html|png)\)', r'\1', md)  # links internos → texto
    return md


def to_html(md, shift):
    """Converte markdown e desloca os níveis de título (## → h{2+shift-1}...)."""
    h = markdown.markdown(md, extensions=['tables', 'fenced_code', 'sane_lists'])

    def sh(m):
        lvl = min(int(m.group(2)) + shift, 6)
        return f'<{m.group(1)}h{lvl}'
    h = re.sub(r'<(/?)h([1-6])', lambda m: f'<{m.group(1)}h{min(int(m.group(2)) + shift, 6)}', h)
    h = re.sub(r'<p>\[\[FIG:([^|]+)\|([^\]]+)\]\]</p>', lambda m: figure(m.group(1), m.group(2)), h)
    return h


# ------------------------- conteúdo -------------------------
def build_body():
    c = CONFIG
    parts = []

    # 1 INTRODUÇÃO
    parts.append(f"""
<h1>Introdução</h1>
<p>A Rede Raízes do Nordeste é uma rede de lanchonetes de culinária nordestina em expansão, com unidades em Recife, Salvador e Fortaleza.
Com o crescimento, a rede passou a enfrentar filas no balcão em horários de pico, cardápios impressos que não acompanham a falta de itens
e pouca informação sobre os clientes que voltam. Este trabalho simula um cenário real de mercado: projetar e entregar a interface de um
sistema que atenda três canais de atendimento — <b>aplicativo</b>, <b>web</b> e <b>totem de autoatendimento</b> — com uma única base de código.</p>
<h2>Objetivos</h2>
<p><b>Objetivo geral:</b> projetar, justificar e implementar uma interface mobile-first e responsiva que permita ao cliente escolher a unidade,
consultar o cardápio daquela loja, fazer o pedido, pagar por um serviço externo, acompanhar o preparo e participar de um programa de fidelidade,
com a LGPD demonstrada de forma explícita nos fluxos.</p>
<p><b>Objetivos específicos:</b></p>
<ul>
<li>levantar os requisitos funcionais, não funcionais e as regras de negócio do sistema;</li>
<li>modelar os casos de uso dos cinco atores e a jornada do cliente, do cardápio à retirada do pedido;</li>
<li>validar a arquitetura de informação com wireframes de baixa fidelidade para celular, desktop e totem;</li>
<li>codificar a interface em HTML, CSS e JavaScript com dados simulados e publicá-la no GitHub Pages;</li>
<li>representar o fluxo de envio do pagamento a um serviço externo e o retorno visual ao usuário;</li>
<li>definir e executar um plano de testes de usabilidade, responsividade e privacidade.</li>
</ul>
<h2>Principais usuários</h2>
<p>O <b>cliente</b> (que pede pelo celular, computador ou totem), o <b>atendente</b> (que confirma a retirada), a <b>cozinha</b> (que prepara e atualiza o
status), o <b>gerente/administrador</b> (que acompanha indicadores e controla o cardápio de cada unidade) e o <b>sistema de pagamento externo</b>
(que aprova ou recusa as cobranças).</p>
<h2>Relevância</h2>
<p>Para o negócio, o pedido antecipado reduz filas, o cardápio dinâmico evita vender o que acabou e a fidelidade aumenta a recorrência.
Para o cliente, a interface oferece um fluxo curto, mensagens de erro claras e controle sobre os próprios dados. Do ponto de vista técnico,
o projeto mostra a integração entre front-end, back-end, garantia de qualidade (QA) e proteção de dados — exatamente as preocupações de
uma equipe de produto real.</p>
<p>A solução e o código-fonte estão disponíveis publicamente nos endereços abaixo:</p>
<ul class="links"><li><b>Site publicado:</b> {a(c['site'])}</li>
<li><b>Repositório Git:</b> {a(c['repo'])}</li></ul>
""")

    # 2 ANÁLISE E REQUISITOS
    parts.append('<h1>Análise do problema e requisitos</h1>' + to_html(prep(read('01-requisitos.md')), 0))

    # 3 MODELAGEM E ARQUITETURA
    m3 = '<h1>Modelagem e arquitetura da interface</h1>'
    m3 += '<h2>Diagrama de casos de uso</h2>' + to_html(prep(read('02-casos-de-uso.md'), [
        ('diagramas/casos-de-uso.png', 'Diagrama de casos de uso'),
        ('diagramas/sequencia-pagamento.png', 'Diagrama de sequência do pagamento com cartão'),
        ('diagramas/estados-pedido.png', 'Diagrama de estados do pedido'),
    ], drop_after_rule=True), 1)
    m3 += '<h2>Diagrama da jornada do usuário</h2>' + to_html(prep(read('03-jornada-do-usuario.md'), [
        ('diagramas/jornada-do-usuario.png', 'Diagrama da jornada do usuário, do cardápio à retirada'),
    ], drop_after_rule=True), 1)
    md4 = prep(read('04-wireframes-e-interface.md'))
    md4 = re.sub(r'\| Fluxo \| Telas \| Imagem \|.*?\n\n', '\n'.join([
        '[[FIG:wireframes/fluxo-1.png|Wireframes mobile — fluxo do cardápio ao carrinho (M1 a M4)]]', '',
        '[[FIG:wireframes/fluxo-2.png|Wireframes mobile — pagamento e acompanhamento (M5 a M8)]]', '',
        '[[FIG:wireframes/fluxo-3.png|Wireframes — fidelidade, privacidade e totem (M9, M10 e T1)]]', '',
        '[[FIG:wireframes/fluxo-4.png|Wireframes desktop — cardápio, checkout e painel da cozinha (D1 a D3)]]', '', '']), md4, flags=re.S)
    md4 = md4.replace('Fonte editável: wireframes/index.html, que pode ser aberta no navegador.',
                      'A fonte editável está no repositório, em docs/wireframes/index.html.')
    m3 += '<h2>Wireframes e interface</h2>' + to_html(md4, 1)
    parts.append(m3)

    # 4 LGPD
    md5 = prep(read('05-lgpd.md'))
    md5 = re.sub(r'## Evidências.*', '', md5, flags=re.S)
    h5 = to_html(md5, 0)
    h5 += '<h2>Evidências na interface</h2><div class="grid2">' + ''.join([
        figure('evidencias/01-mobile-unidade-e-consentimento.png', 'Banner de consentimento na primeira visita'),
        figure('evidencias/12-mobile-central-privacidade.png', 'Central de privacidade (direitos do titular)'),
    ]) + '</div>' + figure('evidencias/17-desktop-politica.png', 'Política de privacidade com finalidades e bases legais', '85%')
    parts.append('<h1>LGPD e privacidade da interface</h1>' + h5)

    # 5 ENTREGA TÉCNICA
    parts.append(f"""
<h1>Entrega técnica</h1>
<p>Foi escolhida a <b>Opção B — Codificação</b>. A interface foi desenvolvida em HTML, CSS e JavaScript puros (ES Modules), sem frameworks,
com dados simulados (mock data) para o cardápio, as promoções, o pagamento e o andamento dos pedidos.</p>
<h2>Links públicos</h2>
<table><thead><tr><th>Item</th><th>Endereço</th></tr></thead><tbody>
<tr><td>Site publicado (GitHub Pages)</td><td><b>{a(c['site'])}</b></td></tr>
<tr><td>Repositório Git</td><td><b>{a(c['repo'])}</b></td></tr>
</tbody></table>
<p>O repositório contém um <i>workflow</i> do GitHub Actions que executa os testes automatizados e só publica o site se todos passarem.</p>
<h2>Como acessar e testar</h2>
<table><thead><tr><th>Recurso</th><th>Como usar</th></tr></thead><tbody>
<tr><td>Conta de cliente</td><td>Criar no próprio site (os dados ficam apenas no navegador do avaliador)</td></tr>
<tr><td>Cupons</td><td>ARRETADO (R$ 5 acima de R$ 40), BEMVINDO10 (1º pedido), SEXTOU (sextas-feiras), CUSCUZSSA (só Salvador)</td></tr>
<tr><td>Cartão aprovado</td><td>4111 1111 1111 1111 — qualquer validade futura e CVV 123</td></tr>
<tr><td>Cartão recusado</td><td>4000 0000 0000 0002 (limite) · 4000 0000 0000 0069 (operadora)</td></tr>
<tr><td>Gateway indisponível</td><td>4000 0000 0000 0119</td></tr>
<tr><td>Pix</td><td>Confirmado automaticamente em cerca de 5 segundos</td></tr>
<tr><td>Painel da equipe / gerência</td><td>Links no rodapé · PIN 1234 / 9999</td></tr>
<tr><td>Modo totem</td><td>Acrescentar <code>?canal=totem</code> ao endereço ou usar o link "Modo totem" no rodapé</td></tr>
</tbody></table>
<h2>Estrutura do código</h2>
<table><thead><tr><th>Arquivo</th><th>Responsabilidade</th></tr></thead><tbody>
<tr><td>index.html</td><td>Estrutura da página: cabeçalho, conteúdo, rodapé, modal e avisos</td></tr>
<tr><td>css/styles.css</td><td>Estilos mobile-first, breakpoints de 600, 900 e 1200 px e modo totem</td></tr>
<tr><td>js/core.js</td><td>Regras de negócio puras: validações, cupons, totais, pontos e status (testadas)</td></tr>
<tr><td>js/data.js</td><td>Dados simulados: unidades, cardápio, promoções e recompensas</td></tr>
<tr><td>js/store.js</td><td>Estado, persistência local, hash de senha e registro de consentimento</td></tr>
<tr><td>js/payment.js</td><td>Simulador do serviço externo de pagamento (cartão e Pix)</td></tr>
<tr><td>js/app.js</td><td>Telas, rotas, eventos e simulação da cozinha</td></tr>
<tr><td>tests/</td><td>11 testes unitários (Node) e teste ponta a ponta (Playwright)</td></tr>
</tbody></table>
<h2>Telas da solução</h2>
<div class="grid3">
{figure('evidencias/02-mobile-cardapio.png', 'Cardápio da unidade (celular)')}
{figure('evidencias/05-mobile-checkout-cartao.png', 'Checkout com cartão (celular)')}
{figure('evidencias/10-mobile-pedido-pronto.png', 'Acompanhamento do pedido (celular)')}
</div>
<div class="grid3">
{figure('evidencias/08-mobile-pix.png', 'Pagamento por Pix (celular)')}
{figure('evidencias/07-mobile-pagamento-recusado.png', 'Retorno de pagamento recusado')}
{figure('evidencias/11-mobile-fidelidade.png', 'Programa de fidelidade (celular)')}
</div>
{figure('evidencias/13-desktop-cardapio.png', 'Cardápio no desktop')}
{figure('evidencias/14-desktop-carrinho.png', 'Carrinho no desktop')}
{figure('evidencias/16-desktop-cozinha.png', 'Painel da cozinha')}
{figure('evidencias/15-desktop-gerencia.png', 'Painel da gerência com controle do cardápio')}
<div class="grid2">
{figure('evidencias/18-totem-cardapio.png', 'Modo totem — cardápio')}
{figure('evidencias/19-totem-gateway-indisponivel.png', 'Modo totem — serviço de pagamento indisponível')}
</div>
""")

    # 6 PLANO DE TESTES
    md6 = prep(read('06-plano-de-testes.md'))
    md6 = re.sub(r'\*\*Prints gerados pelo E2E\*\*.*', '', md6, flags=re.S)
    h6 = to_html(md6, 0)
    h6 += '<p>Prints gerados automaticamente pelo teste ponta a ponta:</p><div class="grid3">' + ''.join([
        figure('evidencias/03-mobile-carrinho-cupom.png', 'CT-06: cupom aplicado'),
        figure('evidencias/04-mobile-cadastro-erros.png', 'CT-11 e CT-12: validações do cadastro'),
        figure('evidencias/06-mobile-processando.png', 'CT-20: envio ao serviço de pagamento'),
    ]) + '</div><div class="grid3">' + ''.join([
        figure('evidencias/07-mobile-pagamento-recusado.png', 'CT-20: pagamento recusado'),
        figure('evidencias/09-mobile-pedido-confirmado.png', 'CT-23: pedido confirmado'),
        figure('evidencias/10-mobile-pedido-pronto.png', 'CT-24: pedido pronto'),
    ]) + '</div>'
    parts.append('<h1>Plano de testes e evidências</h1>' + h6)

    # 7 CONCLUSÃO + REFERÊNCIAS
    md7 = read('07-conclusao-e-referencias.md')
    concl, refs = md7.split('# 8. Referências')
    parts.append('<h1>Conclusão</h1>' + to_html(prep(concl), 0))
    refs_html = autolink(markdown.markdown(refs.strip()))
    parts.append('<h1 class="nonum">Referências</h1><div class="refs">' + refs_html + '</div>')
    return '\n'.join(parts)


def number_headings(body):
    """Numera h1–h4 (1, 1.1, 1.1.1...) e devolve o HTML e a lista para o sumário."""
    counters = [0, 0, 0, 0]
    toc = []
    idx = [0]

    def rep(m):
        lvl = int(m.group(1))
        attrs = m.group(2) or ''
        text = re.sub(r'<[^>]+>', '', m.group(3)).strip()
        idx[0] += 1
        hid = f'h{idx[0]}'
        if 'nonum' in attrs:
            label = text.upper()
            num = ''
        else:
            counters[lvl - 1] += 1
            for i in range(lvl, 4):
                counters[i] = 0
            num = '.'.join(str(x) for x in counters[:lvl])
            label = text.upper() if lvl == 1 else text
        toc.append((lvl, num, label, hid))
        full = f'{num} {label}'.strip()
        return f'<h{lvl} id="{hid}"{attrs}>{html.escape(full)}</h{lvl}>'
    body = re.sub(r'<h([1-4])([^>]*)>(.*?)</h\1>', rep, body, flags=re.S)
    return body, toc


CSS = """
@page { size: A4; margin: 3cm 2cm 2cm 3cm; }
* { box-sizing: border-box; }
body { font-family: 'Liberation Sans', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; }
p, li { text-align: justify; }
p { margin: 0 0 6pt; text-indent: 1.25cm; }
li p, td p, figure p, .refs p, .center p, .cover p, .rosto p, .toc p { text-indent: 0; }
ul, ol { margin: 0 0 6pt; padding-left: 1.6cm; }
h1 { font-size: 12pt; font-weight: bold; margin: 0 0 18pt; break-before: page; text-transform: uppercase; }
h1.nonum { text-align: center; }
h2 { font-size: 12pt; font-weight: bold; margin: 18pt 0 9pt; break-after: avoid; }
h3 { font-size: 12pt; font-weight: normal; font-style: italic; margin: 14pt 0 6pt; break-after: avoid; }
h4 { font-size: 12pt; font-weight: normal; margin: 12pt 0 6pt; break-after: avoid; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; line-height: 1.25; margin: 6pt 0 12pt; break-inside: auto; }
th, td { border: 0.6pt solid #000; padding: 3pt 4pt; vertical-align: top; text-align: left; }
th { background: #e8e8e8; }
td:first-child { white-space: nowrap; }
tr { break-inside: avoid; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 9pt; }
pre { font-size: 8.5pt; line-height: 1.25; background: #f3f3f3; padding: 6pt; border: 0.5pt solid #bbb; white-space: pre-wrap; break-inside: avoid; }
pre code { font-size: 8.5pt; }
blockquote { margin: 6pt 0 6pt 2cm; font-size: 10.5pt; line-height: 1.2; }
blockquote p { text-indent: 0; }
figure { margin: 10pt auto 12pt; text-align: center; break-inside: avoid; width: var(--w, 100%); }
figure img { max-width: 100%; max-height: 19cm; border: 0.5pt solid #999; }
figcaption { font-size: 10pt; margin-bottom: 4pt; text-align: left; }
.fonte { font-size: 10pt; text-align: left !important; margin: 3pt 0 0; text-indent: 0; }
.grid2, .grid3 { display: grid; gap: 10pt; align-items: start; break-inside: avoid; }
.grid2 { grid-template-columns: 1fr 1fr; }
.grid3 { grid-template-columns: 1fr 1fr 1fr; }
.grid2 figure, .grid3 figure { margin: 4pt 0; }
.grid3 figcaption, .grid3 .fonte { font-size: 8.5pt; line-height: 1.2; }
a { color: #0563C1; text-decoration: underline; overflow-wrap: anywhere; }
ul.links li { text-align: left; }
.refs p { text-align: left; line-height: 1.0; margin: 0 0 12pt; }
input[type=checkbox] { display: none; }

@page capa { margin: 0; }
.cover { page: capa; position: relative; width: 210mm; height: 296mm; break-after: page; text-align: center; font-family: Arial, 'Liberation Sans', sans-serif; overflow: hidden; }
.cover p { text-indent: 0; text-align: center; margin: 0; line-height: 1.2; }
.cover .ano { position: absolute; top: 25.5mm; right: 21mm; background: #FAD893; color: #113162; font-weight: bold; font-size: 14pt; line-height: 1.75; width: 24mm; padding: 1.5mm 0; display: flex; flex-direction: column; align-items: center; }
.cover .logo { position: absolute; top: 79mm; left: 50%; transform: translateX(-50%); width: 111mm; }
.cover .c-navy { position: absolute; top: 153mm; left: 0; right: 0; color: #113162; font-weight: bold; font-size: 25pt; }
.cover .c-yellow { position: absolute; top: 170mm; left: 0; right: 0; color: #FFC000; font-weight: bold; font-size: 25pt; }
.cover .c-case { top: 186mm; }
.cover .c-sub { position: absolute; top: 205mm; left: 28mm; right: 28mm; color: #113162; font-size: 13pt; }
.cover .onda { position: absolute; left: 19mm; right: 19mm; top: 236mm; height: 36mm; }
.cover .onda img { width: 100%; height: 100%; display: block; }
.cover .onda__txt { position: absolute; right: 6mm; bottom: 4.5mm; color: #fff; text-align: right; font-size: 12pt; line-height: 1.35; }
.rosto { height: 24.6cm; display: flex; flex-direction: column; text-align: center; break-after: page; }
.rosto p { text-align: center; }
.rosto .title { margin-top: auto; font-weight: bold; }
.rosto .bottom { margin-top: auto; font-weight: bold; }
.rosto .author { font-weight: bold; }
.rosto .title { margin-top: 5cm; }
.rosto .nature { margin: 2cm 0 0 8cm; text-align: justify !important; font-size: 10.5pt; line-height: 1.2; }
.resumo { break-after: page; }
.resumo h1, .toc h1 { text-align: center; break-before: auto; }
.resumo p { text-indent: 0; line-height: 1.5; }
.toc { break-after: page; }
.toc .row { display: flex; align-items: baseline; gap: 4pt; margin: 0 0 4pt; }
.toc .row .t { white-space: nowrap; overflow: hidden; }
.toc .row .dots { flex: 1; border-bottom: 1pt dotted #000; transform: translateY(-3pt); min-width: 1cm; }
.toc .l1 { font-weight: bold; text-transform: uppercase; margin-top: 6pt; }
.toc .l2 { padding-left: 0; }
.toc .l3 { padding-left: 0; font-style: italic; }
.toc .num { display: inline-block; min-width: 1.4cm; }
"""


def doc_html(body, toc, pages):
    c = CONFIG
    rows = []
    for lvl, num, label, hid in toc:
        if lvl > 3:
            continue
        pg = pages.get(hid, '')
        rows.append(f'<div class="row l{lvl}"><span class="t"><span class="num">{num}</span>{html.escape(label)}</span>'
                    f'<span class="dots"></span><span class="p">{pg}</span></div>')
    pre = f"""
<section class="cover">
  <div class="ano"><span>ANO</span><span>{c['ano']}</span></div>
  <img class="logo" src="file://{os.path.join(HERE, 'assets', 'logo-uninter.png')}" alt="UNINTER">
  <p class="c-navy">PROJETO MULTIDISCIPLINAR</p>
  <p class="c-yellow">TRILHA FRONT-END</p>
  <p class="c-yellow c-case">REDE “RAÍZES DO NORDESTE”</p>
  <p class="c-sub">{c['subtitulo'][0].upper() + c['subtitulo'][1:]}</p>
  <div class="onda">
    <img src="file://{os.path.join(HERE, 'assets', 'onda.svg')}" alt="">
    <div class="onda__txt"><b>{c['aluno'].title().replace(' Dos ', ' dos ')}</b><br>RU {c['ru']}<br>{c['cidade'].title().replace('– Sp', '– SP')}</div>
  </div>
</section>
<section class="rosto">
  <p class="author">{c['aluno']}<br>RU {c['ru']}</p>
  <p class="title">{c['titulo']}:<br><span style="font-weight:normal">{c['subtitulo']}</span></p>
  <p class="nature">Trabalho apresentado ao {c['instituicao'].title().replace('Uninter', 'UNINTER')} como requisito
  de avaliação da {c['trilha']}, com o estudo de caso Rede Raízes do Nordeste.</p>
  <p class="bottom">{c['cidade']}<br>{c['ano']}</p>
</section>
<section class="resumo">
  <h1>Resumo</h1>
  <p>Este trabalho apresenta o projeto e a implementação da interface de um sistema multicanal — aplicativo, web e totem de autoatendimento —
  para a Rede Raízes do Nordeste, uma rede de lanchonetes em expansão. A partir da análise do problema foram definidos 24 requisitos funcionais,
  9 requisitos não funcionais e 7 regras de negócio. A solução foi modelada com diagramas de casos de uso, sequência, estados e jornada do usuário,
  e validada com wireframes de baixa fidelidade antes da codificação. A interface foi desenvolvida em HTML, CSS e JavaScript puros, seguindo a
  abordagem mobile-first, com dados simulados, e publicada no GitHub Pages. Ela contempla cardápio dinâmico por unidade, pedido completo,
  pagamento por serviço externo simulado (Pix e cartão, com retorno visual de aprovação, recusa e indisponibilidade), acompanhamento do pedido,
  programa de fidelidade, promoções, painéis para cozinha, atendimento e gerência, e recursos explícitos da LGPD, como consentimento granular,
  exportação e exclusão de dados. A qualidade foi verificada por 41 cenários de teste, 11 testes unitários automatizados e um teste ponta a ponta
  que gerou as evidências apresentadas.</p>
  <p style="margin-top:12pt"><b>Palavras-chave:</b> front-end; mobile-first; experiência do usuário; LGPD; sistema de pedidos.</p>
</section>
<section class="toc"><h1>Sumário</h1>{''.join(rows)}</section>
"""
    return f'<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>{CSS}</style></head><body>{pre}{body}</body></html>'


def render(page, content, path):
    tmp = os.path.join(HERE, '_tmp.html')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(content)
    page.goto('file://' + tmp)
    page.wait_for_load_state('networkidle')
    page.pdf(path=path, format='A4', print_background=True, prefer_css_page_size=True)
    os.remove(tmp)


def find_pages(pdf_path, toc):
    with pdfplumber.open(pdf_path) as pdf:
        texts = [re.sub(r'\s+', ' ', (p.extract_text() or '')) for p in pdf.pages]
    start = next(i for i, t in enumerate(texts) if t.strip().startswith('1 INTRODUÇÃO'))
    pages, cur = {}, start
    for lvl, num, label, hid in toc:
        key = re.sub(r'\s+', ' ', f'{num} {label}'.strip())[:40]
        for i in range(cur, len(texts)):
            if key in texts[i]:
                pages[hid] = i  # índice físico (0 = capa)
                cur = i
                break
    return pages, start, len(texts)


NAVY = (0x11 / 255, 0x31 / 255, 0x62 / 255)
ORANGE = (0xF5 / 255, 0xA6 / 255, 0x07 / 255)
HEADER_LINES = ['Projeto Multidisciplinar', 'Trilha Front-End', 'Rede Raízes do Nordeste']


def draw_header_footer(cv, number):
    """Cabeçalho e rodapé no padrão do modelo da UNINTER."""
    w, h = A4
    left, right = 3 * cm, w - 2 * cm
    logo = os.path.join(HERE, 'assets', 'logo-uninter-horizontal.png')
    lw = 6.6 * cm
    lh = lw * 69 / 335
    cv.drawImage(logo, left - 2, h - 0.75 * cm - lh, width=lw, height=lh, mask='auto')
    cv.setFillColorRGB(*NAVY)
    cv.setFont('Helvetica', 9)
    for k, line in enumerate(HEADER_LINES):
        cv.drawRightString(right, h - 1.35 * cm - k * 11, line)
    cv.setFillColorRGB(*ORANGE)
    cv.rect(left, h - 2.62 * cm, right - left, 2.6, stroke=0, fill=1)
    # traço do rodapé: linha azul afinando nas pontas
    cx, y = (left + right) / 2, 1.45 * cm
    half = (right - left) / 2
    path = cv.beginPath()
    path.moveTo(cx - half, y)
    path.curveTo(cx - half * 0.5, y + 1.0, cx - half * 0.2, y + 1.9, cx, y + 1.9)
    path.curveTo(cx + half * 0.2, y + 1.9, cx + half * 0.5, y + 1.0, cx + half, y)
    path.curveTo(cx + half * 0.5, y - 1.0, cx + half * 0.2, y - 1.9, cx, y - 1.9)
    path.curveTo(cx - half * 0.2, y - 1.9, cx - half * 0.5, y - 1.0, cx - half, y)
    path.close()
    cv.setFillColorRGB(*NAVY)
    cv.drawPath(path, stroke=0, fill=1)
    if number is not None:
        cv.setFillColorRGB(0, 0, 0)
        cv.setFont('Helvetica', 10)
        cv.drawCentredString(cx, 0.95 * cm, str(number))


def stamp(src, dst, start):
    reader = PdfReader(src)
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i >= 1:  # todas as páginas menos a capa
            ov = os.path.join(HERE, '_n.pdf')
            cv = canvas.Canvas(ov, pagesize=A4)
            draw_header_footer(cv, i if i >= start else None)  # capa não conta; folha de rosto = 1
            cv.save()
            page.merge_page(PdfReader(ov).pages[0])
            os.remove(ov)
        writer.add_page(page)
    writer.add_metadata({'/Title': f"{CONFIG['titulo']} — Projeto Front-End", '/Author': CONFIG['aluno'].title()})
    with open(dst, 'wb') as f:
        writer.write(f)


def main():
    body, toc = number_headings(build_body())
    draft = os.path.join(HERE, '_draft.pdf')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox']) if CHROME else p.chromium.launch()
        page = b.new_page()
        render(page, doc_html(body, toc, {}), draft)
        pages, start, n1 = find_pages(draft, toc)
        render(page, doc_html(body, toc, {k: v for k, v in pages.items()}), draft)
        pages2, start2, n2 = find_pages(draft, toc)
        if pages2 != pages:  # o sumário mudou de tamanho: mais uma passada
            render(page, doc_html(body, toc, pages2), draft)
            pages2, start2, n2 = find_pages(draft, toc)
        b.close()
    missing = [t for t in toc if t[3] not in pages2]
    stamp(draft, OUT, start2)
    os.remove(draft)
    print(f'PDF: {OUT} — {n2} páginas; títulos sem página encontrada: {len(missing)}')
    for m in missing:
        print('  ', m)


if __name__ == '__main__':
    main()
