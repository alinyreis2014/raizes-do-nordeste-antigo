# 1. Análise do problema e requisitos

## 1.1 Contexto

A **Rede Raízes do Nordeste** é uma rede de lanchonetes de comida nordestina em expansão, com unidades em Recife, Salvador e Fortaleza. Cada unidade tem cardápio, preços e horários próprios. A rede precisa de uma interface única que atenda três canais:

| Canal | Onde | Perfil de uso |
|---|---|---|
| **App** (mobile) | Celular do cliente | Pedido antecipado, fidelidade, acompanhamento do pedido |
| **Web** | Navegador (celular ou computador) | Mesmo fluxo do app, sem instalação |
| **Totem** | Autoatendimento na loja | Pedido rápido como convidado, aparelho compartilhado |

**Problema de negócio:** filas no balcão em horários de pico, falta de dados sobre os clientes recorrentes e cardápio impresso que não acompanha a falta de itens. **Objetivo do projeto:** reduzir o tempo de fila, aumentar a recorrência com um programa de fidelidade e manter o cardápio sempre atualizado em todos os canais, cumprindo a LGPD.

## 1.2 Atores

| Ator | Papel |
|---|---|
| Cliente | Consulta o cardápio, faz pedidos, paga, acompanha o status e acumula pontos |
| Atendente | Confirma a retirada pelo código do pedido |
| Cozinha | Recebe os pedidos pagos e atualiza o preparo |
| Gerente / Administrador | Acompanha indicadores e liga/desliga itens do cardápio por unidade |
| Sistema de pagamento externo | Processa cartão e Pix e devolve aprovação ou recusa |

## 1.3 Requisitos funcionais (RF)

| ID | Requisito | Prioridade | Onde está na interface |
|---|---|---|---|
| RF01 | Cadastrar cliente com nome, e-mail e senha; celular e CPF opcionais | Alta | `#/cadastro` |
| RF02 | Autenticar cliente com e-mail e senha; bloquear após 5 tentativas erradas por 30 s | Alta | `#/login` |
| RF03 | Escolher a unidade e exibir o cardápio daquela unidade (itens, preços e disponibilidade) | Alta | `#/` |
| RF04 | Buscar e filtrar itens por categoria | Média | `#/` |
| RF05 | Adicionar, alterar quantidade e remover itens do carrinho | Alta | `#/carrinho` |
| RF06 | Recalcular o carrinho ao trocar de unidade (preço e itens indisponíveis) | Alta | Troca de unidade |
| RF07 | Aplicar cupom de promoção com regras (pedido mínimo, dia, unidade, primeiro pedido, validade) | Alta | `#/carrinho`, `#/promocoes` |
| RF08 | Escolher a forma de recebimento (balcão ou comer no local) | Média | `#/checkout` |
| RF09 | Solicitar pagamento ao serviço externo (Pix, crédito, débito) e mostrar o retorno ao usuário | Alta | `#/checkout` |
| RF10 | Tratar recusa e falha de comunicação do pagamento, com nova tentativa sem perder o carrinho | Alta | `#/checkout` |
| RF11 | Gerar o pedido só após o pagamento aprovado, com código de retirada | Alta | `#/pedido/:id` |
| RF12 | Acompanhar o status: pagamento confirmado → em preparo → pronto → retirado | Alta | `#/pedido/:id` |
| RF13 | Avisar o cliente quando o pedido ficar pronto | Média | Notificação na tela |
| RF14 | Listar o histórico de pedidos do cliente | Média | `#/pedidos` |
| RF15 | Programa de fidelidade: 1 ponto por real pago, níveis e extrato | Alta | `#/fidelidade` |
| RF16 | Resgatar pontos por recompensas que viram cupons pessoais | Alta | `#/fidelidade` |
| RF17 | Listar promoções e campanhas, indicando se valem na unidade atual | Média | `#/promocoes` |
| RF18 | Painel da cozinha com pedidos por status e botão para avançar | Alta | `#/equipe` |
| RF19 | Atendimento confirma a retirada pelo código (e recusa código inválido ou pedido não pronto) | Alta | `#/equipe` |
| RF20 | Gerência vê indicadores por unidade e liga/desliga itens do cardápio em tempo real | Média | `#/admin` |
| RF21 | Modo totem: pedido como convidado (só o nome), botões maiores, reinício após 90 s sem uso | Média | `?canal=totem` |
| RF22 | Aviso de cookies com aceitar, recusar e personalizar | Alta | Banner LGPD |
| RF23 | Central de privacidade: revogar consentimentos, baixar os dados, corrigir e excluir a conta | Alta | `#/conta` |
| RF24 | Política de privacidade com finalidades e bases legais | Alta | `#/privacidade` |

## 1.4 Requisitos não funcionais (RNF)

| ID | Requisito | Como foi atendido |
|---|---|---|
| RNF01 | **Mobile-first** | CSS escrito para 360 px primeiro; `min-width` em 600, 900 e 1200 px. Barra de abas no rodapé no celular, que vai para o topo no desktop |
| RNF02 | **Responsividade** | Grid fluido de 1 a 4 colunas; resumo do pedido fixo no desktop; testado em 390 px, 1080 px (totem) e 1366 px |
| RNF03 | **Performance** | Sem framework nem dependência em tempo de execução: ~28 KB de JS e ~6 KB de CSS com gzip (o GitHub Pages já comprime). Ícones em emoji/SVG (nenhuma imagem pesada). A busca atualiza só a grade |
| RNF04 | **Escalabilidade** | Cardápio, unidades e promoções orientados a dados (`data.js`): uma nova unidade é um registro, sem código novo. Regras isoladas em `core.js`, prontas para virar chamadas de API |
| RNF05 | **Acessibilidade** | HTML semântico, `label` em todos os campos, `aria-live` nos status e erros, foco visível, alvos de toque ≥ 44 px (56 px no totem), `prefers-reduced-motion` |
| RNF06 | **Segurança** | Senha com hash e salt; mensagem de login genérica; bloqueio por tentativas; o número do cartão nunca é armazenado; escape de todo texto digitado (contra XSS) |
| RNF07 | **Privacidade (LGPD)** | Ver [05-lgpd.md](05-lgpd.md) |
| RNF08 | **Disponibilidade** | Site estático no GitHub Pages (CDN). Funciona com o armazenamento local bloqueado (modo em memória) |
| RNF09 | **Manutenibilidade** | Módulos ES separados (dados, regras, estado, pagamento, interface); 11 testes automatizados no CI |

## 1.5 Regras de negócio

| ID | Regra |
|---|---|
| RN01 | O preço e a disponibilidade de um item dependem da unidade |
| RN02 | Um item marcado como indisponível pela gerência não pode ser adicionado ao carrinho |
| RN03 | O pedido só é criado e enviado à cozinha depois do pagamento aprovado |
| RN04 | O desconto nunca deixa o total negativo; cupons percentuais podem ter teto |
| RN05 | Os pontos são creditados só para clientes logados (fora do totem), com base no valor pago |
| RN06 | Cupom de fidelidade é de uso único |
| RN07 | O status do pedido só avança em sequência; a retirada exige status "pronto" e o código correto |
