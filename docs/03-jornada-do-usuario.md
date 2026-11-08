# 3. Jornada do usuário

Percurso do cliente **do primeiro contato com o cardápio até o pagamento confirmado e a retirada do pedido**, com etapas, decisões, estados do sistema e integrações.

## 3.1 Diagrama da jornada

```mermaid
flowchart TD
  A([Cliente abre o app / site / totem]) --> B{Já aceitou o aviso<br/>de privacidade?}
  B -- Não --> B1[Banner LGPD:<br/>Aceitar · Somente essenciais · Personalizar]
  B1 --> C
  B -- Sim --> C{Unidade escolhida?}
  C -- Não --> C1[Lista de unidades<br/>endereço, horário, aberto/fechado]
  C1 --> D
  C -- Sim --> D[Cardápio da unidade<br/>busca + categorias + promoções]
  D --> E{Item disponível?}
  E -- Não --> E1[Selo 'Indisponível hoje'<br/>botão desativado] --> D
  E -- Sim --> F[Adicionar ao carrinho<br/>contador atualizado]
  F --> G{Continuar comprando?}
  G -- Sim --> D
  G -- Não --> H[Carrinho: quantidades e total]
  H --> I{Tem cupom?}
  I -- Sim --> I1{Cupom válido?<br/>mínimo, dia, unidade, 1º pedido}
  I1 -- Não --> I2[Mensagem com o motivo] --> H
  I1 -- Sim --> I3[Desconto aplicado] --> J
  I -- Não --> J{Canal totem?}
  J -- Sim --> K2[Informar nome para chamada]
  J -- Não --> K{Está logado?}
  K -- Não --> K1[Entrar ou criar conta<br/>consentimento explícito] --> L
  K -- Sim --> L
  K2 --> L[Checkout: recebimento + forma de pagamento]
  L --> M{Pix ou cartão?}
  M -- Cartão --> M1{Dados válidos?}
  M1 -- Não --> M2[Erros nos campos] --> L
  M1 -- Sim --> N[[Integração: gateway de pagamento]]
  M -- Pix --> N
  N --> O{Resposta do gateway}
  O -- Pix pendente --> O1[QR Code + Copia e Cola<br/>consulta de status] --> O
  O -- Recusado --> O2[Pagamento não aprovado<br/>nada cobrado] --> L
  O -- Erro / timeout --> O3[Serviço indisponível<br/>carrinho preservado] --> L
  O -- Aprovado --> P[(Pedido criado<br/>status: Pagamento confirmado)]
  P --> P1[Código de retirada + pontos creditados]
  P1 --> Q[[Integração: painel da cozinha]]
  Q --> R[Status: Em preparo]
  R --> S[Status: Pronto<br/>aviso na tela]
  S --> T[Cliente mostra o código no balcão]
  T --> U{Código confere e<br/>pedido está pronto?}
  U -- Não --> U1[Atendente vê o motivo] --> T
  U -- Sim --> V([Pedido retirado ✔])
```

**Legenda:** losangos = decisões · retângulos = telas/ações · `[[ ]]` = integrações externas ou entre módulos · `[( )]` = estado gravado.

## 3.2 Mapa da jornada (emoções e oportunidades)

| Etapa | O que o cliente faz | Tela | Estado do sistema | Sentimento | Decisão de interface |
|---|---|---|---|---|---|
| 1. Descoberta | Abre o site pelo link ou QR na loja | Aviso LGPD + unidades | Sem consentimento | Curioso | Banner com botões de mesmo peso; nada é rastreado antes da escolha |
| 2. Unidade | Escolhe onde vai retirar | Lista de unidades | `unitId` definido | Orientado | Mostra "Aberto agora" para evitar frustração |
| 3. Cardápio | Busca, filtra, adiciona | Cardápio | Carrinho em memória/local | Com fome 😋 | Preço visível em todo cartão; itens esgotados vão para o fim, com selo |
| 4. Carrinho | Revisa e aplica cupom | Carrinho | Totais recalculados | Atento ao preço | O motivo do cupom inválido aparece na hora (ex.: "Pedido mínimo de R$ 40") |
| 5. Identificação | Entra ou cria conta (web) / informa o nome (totem) | Login/Cadastro | Sessão criada | Pode desistir ⚠️ | Só 3 campos obrigatórios; o login volta direto para o pagamento |
| 6. Pagamento | Escolhe Pix ou cartão | Checkout | Aguardando gateway | Ansioso | Etapas visuais do processamento; aviso de que o cartão não é armazenado |
| 7. Retorno | Vê aprovado/recusado | Status do pagamento | Pedido criado ou não | Aliviado / frustrado | A recusa explica o motivo, garante que "nada foi cobrado" e oferece o Pix |
| 8. Espera | Acompanha o preparo | Acompanhar pedido | recebido → em preparo → pronto | Tranquilo | Linha do tempo com horários; aviso quando fica pronto |
| 9. Retirada | Mostra o código | Código grande na tela | retirado | Satisfeito 😊 | Código curto (letra + 3 números), fácil de falar no balcão |
| 10. Fidelização | Vê os pontos ganhos | Fidelidade | Pontos creditados | Valorizado | Barra de progresso até o próximo nível incentiva a voltar |

---
**Imagem pronta para o PDF:** [`diagramas/jornada-do-usuario.png`](diagramas/jornada-do-usuario.png)
