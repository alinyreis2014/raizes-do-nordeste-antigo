# 2. Diagrama de casos de uso

> O GitHub desenha os diagramas Mermaid automaticamente. Para o PDF, abra este arquivo no GitHub ou cole o código em <https://mermaid.live> e exporte em PNG/SVG.

```mermaid
flowchart LR
  Cliente(["👤 Cliente"])
  Atendente(["🧑‍💼 Atendente"])
  Cozinha(["👩‍🍳 Cozinha"])
  Gerente(["📊 Gerente / Administrador"])
  Gateway(["🏦 Sistema de pagamento externo"])

  subgraph Sistema["Sistema Raízes do Nordeste (App · Web · Totem)"]
    UC1((Cadastrar-se))
    UC2((Autenticar-se))
    UC3((Escolher unidade))
    UC4((Ver cardápio da unidade))
    UC5((Montar carrinho))
    UC6((Aplicar cupom))
    UC7((Realizar pedido))
    UC8((Realizar pagamento))
    UC9((Acompanhar status))
    UC10((Gerenciar fidelidade))
    UC11((Resgatar recompensa))
    UC12((Ver promoções))
    UC13((Gerenciar privacidade LGPD))
    UC14((Atualizar preparo))
    UC15((Confirmar retirada))
    UC16((Ver indicadores))
    UC17((Gerenciar disponibilidade do cardápio))
  end

  Cliente --- UC1 & UC2 & UC3 & UC4 & UC5 & UC7 & UC9 & UC10 & UC12 & UC13
  UC4 -. include .-> UC3
  UC7 -. include .-> UC8
  UC6 -. extend .-> UC5
  UC11 -. extend .-> UC10
  UC10 -. include .-> UC2
  UC8 --- Gateway
  Cozinha --- UC14
  Atendente --- UC15
  Atendente --- UC14
  Gerente --- UC16 & UC17
  UC17 -. afeta .-> UC4
```

**Leitura do diagrama:** "Realizar pedido" sempre *inclui* "Realizar pagamento", que conversa com o sistema externo. "Aplicar cupom" *estende* o carrinho (é opcional). Quando o gerente desliga um item, isso afeta direto o cardápio visto pelo cliente em todos os canais.

---

## 2.1 Descrição de feature: **Realizar pagamento** (UC8)

| Campo | Descrição |
|---|---|
| **Ator principal** | Cliente |
| **Ator secundário** | Sistema de pagamento externo (gateway) |
| **Objetivo** | Pagar o pedido por Pix ou cartão e receber a confirmação visual |
| **Pré-condições** | 1) Unidade escolhida. 2) Carrinho com pelo menos 1 item disponível. 3) Cliente autenticado (web/app) **ou** nome informado (totem). 4) Cupom aplicado, se houver, válido. |
| **Pós-condição de sucesso** | Pedido criado com status "Pagamento confirmado", código de retirada gerado, pontos creditados, carrinho esvaziado e cozinha avisada |
| **Pós-condição de falha** | Nenhum pedido criado, nenhum valor cobrado, carrinho preservado |

### Fluxo principal (cartão)
1. O cliente toca em **Ir para pagamento** no carrinho.
2. O sistema mostra o resumo, a forma de recebimento e as formas de pagamento.
3. O cliente escolhe **Cartão de crédito** e preenche número, nome, validade e CVV.
4. O sistema valida no navegador: algoritmo de Luhn, validade não vencida (MM/AA), CVV de 3–4 dígitos.
5. O sistema mostra a tela **Processando pagamento**, com 3 etapas visuais: *pedido validado → enviando ao provedor → aguardando resposta do banco*.
6. O sistema envia `{ método, valor, dados do cartão }` **direto ao gateway externo** (`POST /payments`).
7. O gateway responde `approved` com `transactionId` e um token (bandeira + 4 últimos dígitos).
8. O sistema descarta os dados do cartão da memória, cria o pedido, gera o código de retirada, credita os pontos e redireciona para **Acompanhar pedido**.

### Fluxo alternativo A — Pix
- 3a. O cliente escolhe **Pix** e confirma.
- 6a. O gateway responde `pending` com o código Pix e o prazo de expiração (5 min).
- 7a. O sistema mostra o QR Code, o botão **Copiar** e a contagem regressiva, e consulta o status a cada segundo (`GET /payments/:id`).
- 8a. Quando o status vira `approved`, segue no passo 8. Se expirar, vai para a exceção E3.

### Exceções
| Código | Situação | Tratamento na interface |
|---|---|---|
| E1 | Dados do cartão inválidos (passo 4) | Mensagem abaixo do campo, borda vermelha, foco no primeiro campo com erro. Nada é enviado ao gateway |
| E2 | Gateway recusa (saldo, operadora) | Tela "Pagamento não aprovado" com o motivo, **"Nenhum valor foi cobrado"**, botões *Tentar novamente* e *Pagar com Pix* |
| E3 | Pix expira | Tela de erro com opção de gerar um novo pagamento |
| E4 | Falha de comunicação / timeout | Tela "Serviço de pagamento indisponível", carrinho preservado, nova tentativa |
| E5 | Cupom deixou de valer (ex.: mudou o dia) | Alerta no topo do formulário pedindo para remover o cupom |
| E6 | Cliente cancela o Pix | Volta ao formulário e a consulta de status é interrompida |

### Como o sistema lida com o processamento externo
- **Contrato isolado:** toda a comunicação fica em `js/payment.js`. Trocar o simulador pelo gateway real (Mercado Pago, Stripe, PagSeguro…) não mexe na interface.
- **Assíncrono com feedback:** a interface nunca fica "congelada"; cada estado (enviando, aguardando, aprovado, recusado, erro) tem uma tela própria.
- **Idempotência (em produção):** o back-end envia uma chave de idempotência por pedido para que um duplo clique não gere duas cobranças. Na interface, o botão some enquanto o pagamento é processado.
- **Confirmação no servidor (em produção):** o status final vem por *webhook* do gateway para o back-end; o front só exibe o que o back-end confirmar.
- **PCI/LGPD:** os dados do cartão não passam pelo nosso servidor nem são guardados (tokenização).

## 2.2 Diagrama de sequência — pagamento com cartão

```mermaid
sequenceDiagram
  actor C as Cliente
  participant UI as Front-end
  participant API as Back-end (API)
  participant GW as Gateway de pagamento
  participant K as Painel da cozinha

  C->>UI: Preenche cartão e toca em "Pagar"
  UI->>UI: Valida Luhn, validade, CVV
  alt dados inválidos
    UI-->>C: Erros nos campos (nada é enviado)
  else dados válidos
    UI-->>C: Tela "Processando pagamento"
    UI->>GW: Envia dados do cartão (tokenização)
    GW-->>UI: token (bandeira + final)
    UI->>API: POST /orders {itens, unidade, cupom, token}
    API->>GW: POST /payments {valor, token, chave de idempotência}
    alt aprovado
      GW-->>API: approved + transactionId
      API->>K: Novo pedido (status: recebido)
      API-->>UI: 201 {pedido, código de retirada}
      UI-->>C: "Pagamento confirmado" + código
    else recusado
      GW-->>API: declined + motivo
      API-->>UI: 402 {motivo}
      UI-->>C: "Pagamento não aprovado — nenhum valor cobrado"
    else timeout
      API-->>UI: 504
      UI-->>C: "Serviço indisponível — tente novamente"
    end
  end
```

> **Na demonstração**, a API e o gateway são simulados no próprio navegador (`payment.js`), com o mesmo formato de resposta.

## 2.3 Diagrama de estados do pedido

```mermaid
stateDiagram-v2
  [*] --> Carrinho
  Carrinho --> AguardandoPagamento: Ir para pagamento
  AguardandoPagamento --> Carrinho: Recusado / erro (nada cobrado)
  AguardandoPagamento --> Recebido: Pagamento aprovado
  Recebido --> EmPreparo: Cozinha inicia
  EmPreparo --> Pronto: Cozinha finaliza
  Pronto --> Retirado: Atendente confere o código
  Retirado --> [*]
```

---
**Imagens prontas para o PDF:** [`diagramas/casos-de-uso.png`](diagramas/casos-de-uso.png) · [`diagramas/sequencia-pagamento.png`](diagramas/sequencia-pagamento.png) · [`diagramas/estados-pedido.png`](diagramas/estados-pedido.png)
