# 5. LGPD e privacidade na interface

A Lei nº 13.709/2018 (LGPD) foi tratada como requisito de **interface**, não só de back-end: o usuário vê, entende e controla o uso dos seus dados.

## 5.1 Princípios aplicados (art. 6º)

| Princípio | Onde aparece |
|---|---|
| **Finalidade** | Cada campo opcional explica para que serve ("Usado apenas para nota fiscal com CPF") |
| **Necessidade (minimização)** | Só nome, e-mail e senha são obrigatórios. No totem, só o primeiro nome, descartado após a retirada. A cozinha vê só o primeiro nome e o código |
| **Transparência** | Política de privacidade com tabela dado → finalidade → base legal; aviso de cookies na primeira visita |
| **Livre acesso** | Botão **Baixar meus dados** gera um JSON com perfil, pedidos e preferências |
| **Segurança** | Senha com hash e salt; cartão não armazenado (só bandeira e 4 últimos dígitos); escape contra XSS; bloqueio após 5 tentativas de login |
| **Prevenção** | Totem desconecta qualquer conta e reinicia após 90 s sem uso |
| **Não discriminação** | Recusar cookies ou marketing não bloqueia nenhuma função |
| **Responsabilização** | Histórico de consentimentos com data e hora, visível ao titular |

## 5.2 Consentimento (art. 7º, I e art. 8º)

| Momento | Implementação |
|---|---|
| Primeira visita | Banner com **Somente essenciais**, **Personalizar** e **Aceitar todos**, com o mesmo peso visual (sem *dark pattern*) |
| Antes do consentimento | Nenhum evento de análise é registrado (`track()` só grava com `consent.analytics = true`) |
| Cadastro | Duas caixas separadas e **desmarcadas**: termos (obrigatória para o contrato) e marketing (opcional) |
| A qualquer momento | Chaves na Central de privacidade e link "Preferências de cookies" no rodapé |
| Revogação | Revogar análise apaga os eventos já coletados; revogar marketing é registrado no histórico |

## 5.3 Bases legais usadas

| Dado | Base legal |
|---|---|
| Conta, pedido, pagamento, fidelidade | Execução de contrato (art. 7º, V) |
| CPF para nota fiscal; guarda fiscal dos pedidos | Cumprimento de obrigação legal (art. 7º, II) |
| Marketing e cookies de análise | Consentimento (art. 7º, I) |

## 5.4 Direitos do titular (art. 18) na interface

| Direito | Como o usuário exerce |
|---|---|
| Confirmação e acesso (I, II) | Conta › **Baixar meus dados** |
| Correção (III) | Conta › Meus dados › Salvar |
| Eliminação (VI) | Conta › **Excluir minha conta** (confirmação digitando EXCLUIR). Pedidos são anonimizados e mantidos só para fins fiscais |
| Portabilidade (V) | Arquivo JSON exportado, em formato estruturado |
| Informação sobre compartilhamento (VII) | Seção 4 da Política de privacidade |
| Revogação do consentimento (IX) | Chaves da Central de privacidade |
| Contato com o Encarregado (art. 41) | E-mail do DPO na Central e na Política |

## 5.5 Pagamento e dados sensíveis

- Os dados do cartão vão **direto ao provedor externo** (tokenização) e são descartados da memória logo após a resposta.
- O comprovante guarda só a bandeira, os 4 últimos dígitos e o código da transação.
- O CPF aparece mascarado na conta (`***.982.247-**`).
- O CVV usa campo do tipo senha e `autocomplete="cc-csc"`.

## 5.6 Evidências

| Evidência | Arquivo |
|---|---|
| Banner de consentimento | `evidencias/01-mobile-unidade-e-consentimento.png` |
| Cadastro com finalidades e consentimento separado | `evidencias/04-mobile-cadastro-erros.png` |
| Aviso de não armazenamento do cartão | `evidencias/05-mobile-checkout-cartao.png` |
| Central de privacidade | `evidencias/12-mobile-central-privacidade.png` |
| Política de privacidade | `evidencias/17-desktop-politica.png` |
