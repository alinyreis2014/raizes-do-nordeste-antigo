"""
Teste ponta a ponta (E2E) com Playwright: executa os fluxos principais e salva prints.

Instalação:  pip install playwright && playwright install chromium
Execução:    python tests/e2e/e2e_playwright.py . docs/evidencias
(sobe um servidor local na porta 5199 automaticamente)
"""
import sys, subprocess, time, os
CHROME = os.environ.get('CHROME_PATH')  # opcional: usar o Chrome instalado
from playwright.sync_api import sync_playwright

ROOT = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '5199'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
BASE = 'http://localhost:5199/'

def shot(page, name):
    page.screenshot(path=f'{OUT}/{name}.png', full_page=False)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox']) if CHROME else p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, accept_downloads=True)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto(BASE)
        page.wait_for_selector('.consent__box')
        shot(page, '01-mobile-unidade-e-consentimento')
        page.click('text=Somente essenciais')
        page.click('[data-action="set-unit"][data-id="rec-bv"]')
        page.wait_for_selector('.product')
        shot(page, '02-mobile-cardapio')
        page.click('[data-action="add"][data-id="tapioca-queijo"]')
        page.click('[data-action="add"][data-id="baiao"]')
        page.click('[data-action="add"][data-id="suco-caja"]')
        page.goto(BASE + '#/carrinho')
        page.fill('#f-code', 'CUSCUZSSA'); page.click('form[data-form="coupon"] button[type=submit]')
        assert 'não válido nesta unidade' in page.inner_text('#e-code'), 'cupom de outra unidade deveria falhar'
        page.fill('#f-code', 'ARRETADO'); page.click('form[data-form="coupon"] button[type=submit]')
        page.wait_for_selector('text=aplicado')
        shot(page, '03-mobile-carrinho-cupom')
        page.click('[data-action="go-checkout"]')
        page.wait_for_selector('form[data-form="login"]')
        page.click('text=Criar conta')
        page.wait_for_selector('form[data-form="register"]')
        # negativo: cadastro vazio
        page.click('form[data-form="register"] button[type=submit]')
        assert page.is_visible('text=Informe nome e sobrenome.')
        assert page.is_visible('text=é preciso aceitar os termos')
        page.fill('#f-name', 'Maria Silva'); page.fill('#f-email', 'maria@exemplo.com')
        page.fill('#f-cpf', '52998224726'); page.fill('#f-password', 'cuscuz2026'); page.fill('#f-confirm', 'cuscuz2026')
        page.click('form[data-form="register"] button[type=submit]')
        assert page.is_visible('text=CPF inválido')
        shot(page, '04-mobile-cadastro-erros')
        page.fill('#f-cpf', '')
        page.check('input[name=terms]')
        page.click('form[data-form="register"] button[type=submit]')
        page.wait_for_selector('form[data-form="checkout"]')
        # cartão recusado
        page.click('text=Cartão de crédito')
        page.click('form[data-form="checkout"] button[type=submit]')
        assert page.is_visible('text=Informe o número do cartão.')
        page.fill('#f-cardNumber', '4000000000000002'); page.fill('#f-cardName', 'MARIA SILVA')
        page.fill('#f-expiry', '1229'); page.fill('#f-cvv', '123')
        shot(page, '05-mobile-checkout-cartao')
        page.click('form[data-form="checkout"] button[type=submit]')
        page.wait_for_selector('.spinner'); shot(page, '06-mobile-processando')
        page.wait_for_selector('text=Pagamento não aprovado', timeout=8000)
        shot(page, '07-mobile-pagamento-recusado')
        # pix aprovado
        page.click('[data-action="retry-pix"]')
        page.click('form[data-form="checkout"] button[type=submit]')
        page.wait_for_selector('.qr', timeout=8000)
        shot(page, '08-mobile-pix')
        page.wait_for_selector('.order-hero', timeout=15000)
        shot(page, '09-mobile-pedido-confirmado')
        page.wait_for_selector('.order-hero.is-em_preparo', timeout=15000)
        code = page.inner_text('.pickup strong').strip()
        page.wait_for_selector('.order-hero.is-pronto', timeout=25000)
        shot(page, '10-mobile-pedido-pronto')
        page.goto(BASE + '#/fidelidade'); page.wait_for_selector('.points'); shot(page, '11-mobile-fidelidade')
        page.goto(BASE + '#/conta'); page.wait_for_selector('.privacy-center'); shot(page, '12-mobile-central-privacidade')
        with page.expect_download() as d:
            page.click('[data-action="export-data"]')
        assert d.value.suggested_filename.startswith('meus-dados')

        # equipe: retirada
        page.goto(BASE + '#/equipe'); page.fill('#f-pin', '0000'); page.click('form[data-form="pin"] button')
        assert page.is_visible('text=PIN incorreto.')
        page.fill('#f-pin', '1234'); page.click('form[data-form="pin"] button')
        page.click('[data-action="staff-tab"][data-id="atendimento"]')
        page.fill('#f-code', 'Z999'); page.click('form[data-form="pickup"] button')
        assert page.is_visible('text=Nenhum pedido em aberto')
        page.fill('#f-code', code); page.click('form[data-form="pickup"] button')
        page.wait_for_selector('text=entregue')

        # desktop
        dctx = b.new_context(viewport={'width': 1366, 'height': 860})
        d2 = dctx.new_page(); d2.on('pageerror', lambda e: errors.append(str(e)))
        d2.goto(BASE + '?unidade=ssa-pel'); d2.wait_for_selector('.product')
        d2.screenshot(path=f'{OUT}/13-desktop-cardapio.png')
        d2.click('text=Aceitar todos')
        d2.click('[data-action="add"][data-id="acaraje"]'); d2.click('[data-action="add"][data-id="cafe-coado"]')
        d2.goto(BASE + '#/carrinho'); d2.wait_for_selector('.cart-list'); d2.screenshot(path=f'{OUT}/14-desktop-carrinho.png')
        d2.goto(BASE + '#/admin'); d2.fill('#f-pin', '9999'); d2.click('form[data-form="pin"] button')
        d2.wait_for_selector('.kpis'); d2.screenshot(path=f'{OUT}/15-desktop-gerencia.png')
        d2.goto(BASE + '#/equipe'); d2.wait_for_selector('.kds'); d2.screenshot(path=f'{OUT}/16-desktop-cozinha.png')
        d2.goto(BASE + '#/privacidade'); d2.screenshot(path=f'{OUT}/17-desktop-politica.png')

        # totem
        tctx = b.new_context(viewport={'width': 1080, 'height': 1600})
        t = tctx.new_page(); t.on('pageerror', lambda e: errors.append(str(e)))
        t.goto(BASE + '?canal=totem&unidade=for-ald'); t.click('text=Somente essenciais')
        t.wait_for_selector('.product'); t.screenshot(path=f'{OUT}/18-totem-cardapio.png')
        t.click('[data-action="add"][data-id="cuscuz-ovo"]'); t.goto(BASE + '?canal=totem&unidade=for-ald#/carrinho')
        t.click('[data-action="go-checkout"]'); t.wait_for_selector('#f-name')
        t.click('form[data-form="checkout"] button[type=submit]')
        assert t.is_visible('text=Informe um nome')
        t.fill('#f-name', 'João'); t.click('text=Cartão de débito')
        t.fill('#f-cardNumber', '4000000000000119'); t.fill('#f-cardName', 'JOAO S'); t.fill('#f-expiry', '0128'); t.fill('#f-cvv', '321')
        t.click('form[data-form="checkout"] button[type=submit]')
        t.wait_for_selector('text=Serviço de pagamento indisponível', timeout=8000)
        t.screenshot(path=f'{OUT}/19-totem-gateway-indisponivel.png')
        b.close()
finally:
    srv.terminate()

print('Erros de console:', errors or 'nenhum')
print('E2E concluído: todos os fluxos passaram.')
sys.exit(1 if errors else 0)
