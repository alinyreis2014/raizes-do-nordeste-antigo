# 🌵 Raízes do Nordeste — Front-end multicanal

Projeto da **Trilha Front-End** (estudo de caso *Rede Raízes do Nordeste*): interface única para **App, Web e Totem** de uma rede de lanchonetes nordestinas, com cardápio por unidade, pedido completo, pagamento por serviço externo (simulado), acompanhamento do pedido, programa de fidelidade, promoções e conformidade explícita com a **LGPD**.

> **Entrega técnica: Opção B — Codificação.** HTML, CSS e JavaScript puros (ES Modules), com dados simulados (mock).

| | Link |
|---|---|
| 🌐 **Site publicado** | `https://alinyreis2014.github.io/raizes-do-nordeste/` |
| 📦 **Repositório** | `https://github.com/alinyreis2014/raizes-do-nordeste` |

---

## ✨ Funcionalidades

| Área | O que dá para fazer |
|---|---|
| **Cardápio dinâmico** | Escolher a unidade (Recife, Salvador, Fortaleza); preços e itens mudam por loja; busca e filtro por categoria |
| **Pedido** | Carrinho com quantidades, cupons com regras, retirada no balcão ou consumo no local |
| **Pagamento externo** | Pix (QR Code + Copia e Cola) e cartão; telas de processando, aprovado, recusado e serviço indisponível |
| **Status do pedido** | Linha do tempo: pagamento confirmado → em preparo → pronto → retirado, com código de retirada |
| **Fidelidade Raízes+** | 1 ponto por real; níveis Semente/Broto/Raiz; troca de pontos por cupons; extrato |
| **Promoções** | Campanhas por dia, unidade, pedido mínimo e primeiro pedido |
| **LGPD** | Banner de cookies, consentimento separado no cadastro, central de privacidade, exportar e excluir dados, política |
| **Equipe** | Painel da cozinha e confirmação de retirada pelo código |
| **Gerência** | Indicadores por unidade e liga/desliga de itens do cardápio em tempo real |
| **Totem** | Pedido como convidado, botões maiores, reinício por inatividade |

## 🧪 Dados para testar

| O quê | Valor |
|---|---|
| Conta de cliente | Crie uma no site (os dados ficam só no seu navegador) |
| Cupons | `ARRETADO` (R$ 5 acima de R$ 40) · `BEMVINDO10` (1º pedido) · `SEXTOU` (sextas) · `CUSCUZSSA` (só Salvador) |
| Cartão aprovado | `4111 1111 1111 1111` — qualquer validade futura, CVV `123` |
| Cartão recusado (limite) | `4000 0000 0000 0002` |
| Cartão recusado (operadora) | `4000 0000 0000 0069` |
| Gateway fora do ar | `4000 0000 0000 0119` |
| Pix | Aprovado sozinho em ~5 segundos |
| PIN da equipe / gerência | `1234` / `9999` |
| Modo totem | `?canal=totem` no fim do endereço, ou o link "Modo totem" no rodapé |
| Abrir já em uma unidade | `?unidade=ssa-pel` (ou `rec-bv`, `for-ald`) |

---

## 🚀 Como publicar no GitHub (passo a passo)

### 1. Criar o repositório
1. Acesse <https://github.com/new>.
2. Nome: `raizes-do-nordeste` · Visibilidade: **Public** (obrigatório para o avaliador acessar).
3. **Não** marque "Add a README" (este projeto já tem um). Clique em **Create repository**.

### 2. Enviar os arquivos

**Opção A — pelo terminal (Git instalado):**
```bash
cd raizes-do-nordeste
git init
git add .
git commit -m "Projeto Front-end Raízes do Nordeste"
git branch -M main
git remote add origin https://github.com/alinyreis2014/raizes-do-nordeste.git
git push -u origin main
```

**Opção B — pelo navegador (sem Git):** no repositório vazio, clique em **uploading an existing file**, arraste **todo o conteúdo** da pasta (incluindo as pastas `.github`, `css`, `js`, `docs`…) e clique em **Commit changes**.
> ⚠️ Pelo navegador, a pasta oculta `.github` às vezes não sobe. Se isso acontecer, use o caminho 3B abaixo.

### 3. Ligar o GitHub Pages
- **3A (recomendado, com testes automáticos):** *Settings → Pages → Build and deployment → Source:* **GitHub Actions**. A cada `push`, o workflow roda os testes e publica o site. Acompanhe na aba **Actions** (fica verde em ~1 min).
- **3B (mais simples):** *Settings → Pages → Source:* **Deploy from a branch** → Branch `main`, pasta `/ (root)` → **Save**.

Depois de 1–2 minutos o site aparece em `https://alinyreis2014.github.io/raizes-do-nordeste/`.

### 4. Conferir antes de entregar ✅
- [ ] Abrir o link numa **janela anônima** (garante que está público)
- [ ] Abrir o link no celular
- [ ] Trocar `alinyreis2014` pelos links reais neste README e no PDF

---

## 💻 Rodar no computador

Como o site usa *ES Modules*, abra-o por um servidor local (dar dois cliques no `index.html` não funciona):

```bash
# com Node.js
npm start            # http://localhost:5173

# ou com Python
python -m http.server 5173
```

### Testes
```bash
npm test                                               # 11 testes unitários (Node 20+)
pip install playwright && playwright install chromium
python tests/e2e/e2e_playwright.py . docs/evidencias   # fluxos completos + prints
```

---

## 🗂️ Estrutura

```
├── index.html                  Casca da aplicação
├── css/styles.css              Estilos mobile-first + modo totem
├── js/
│   ├── app.js                  Telas, rotas e eventos
│   ├── core.js                 Regras de negócio puras (testadas)
│   ├── data.js                 Dados simulados: unidades, cardápio, promoções
│   ├── store.js                Estado, persistência e consentimento
│   └── payment.js              Simulador do gateway de pagamento externo
├── tests/
│   ├── core.test.mjs           Testes unitários
│   └── e2e/e2e_playwright.py   Teste ponta a ponta
├── docs/                       Documentação do projeto (base do PDF)
│   ├── 01-requisitos.md
│   ├── 02-casos-de-uso.md      Casos de uso, feature "Realizar pagamento", sequência, estados
│   ├── 03-jornada-do-usuario.md
│   ├── 04-wireframes-e-interface.md
│   ├── 05-lgpd.md
│   ├── 06-plano-de-testes.md   41 cenários de teste + evidências
│   ├── 07-conclusao-e-referencias.md
│   ├── pdf/                    PDF do trabalho (ABNT) + script que o gera
│   ├── diagramas/              Diagramas em PNG (casos de uso, jornada, sequência, estados)
│   ├── wireframes/             Wireframes de baixa fidelidade (HTML + PNG)
│   └── evidencias/             Prints gerados pelos testes
└── .github/workflows/pages.yml Testes + deploy automático
```

## 🛠️ Decisões técnicas

- **Sem framework e sem build:** ~34 KB (com gzip) para todo o JS e CSS, deploy direto no GitHub Pages.
- **Roteamento por hash** (`#/carrinho`): funciona em hospedagem estática, e o botão voltar do navegador funciona.
- **Regras separadas da interface** (`core.js`): testáveis no Node e prontas para virar chamadas de API.
- **Pagamento como contrato isolado** (`payment.js`): trocar o simulador por um gateway real não muda as telas.

## 👩‍💻 Autoria

Desenvolvido por **Aliny Reis Ramos** — RU 5071671 — estudante de CST em Análise e Desenvolvimento de Sistemas (UNINTER).

## ⚠️ Aviso

Projeto acadêmico. Empresa, unidades, preços e pagamentos são **fictícios**: nenhuma cobrança real é feita e nenhum dado sai do seu navegador.
