# 7. Conclusão

## 7.1 Integrações e impacto das decisões de interface

- **Front-end × back-end.** As regras foram isoladas em `core.js` e o acesso a dados em `data.js`, `store.js` e `payment.js`. Trocar os mocks pela API real (contrato na seção 4.6) não exige mudar as telas. A interface valida para dar retorno rápido, mas preço, cupom, pontos e status precisam ser **revalidados no servidor**, para que ninguém consiga manipular o valor pelo navegador.
- **Front-end × pagamento externo.** Tratar o pagamento como um processo assíncrono, com uma tela para cada resposta, foi a decisão de maior impacto na experiência. Uma recusa deixa de ser um beco sem saída: o cliente sabe que nada foi cobrado e tem uma alternativa (Pix) a um toque.
- **Front-end × operação da loja.** O mesmo pedido percorre cliente → cozinha → atendimento. O código curto de retirada e o painel da cozinha mostram que a interface também organiza o trabalho da equipe, não só o do cliente.
- **Front-end × QA.** Separar regras puras permitiu 11 testes unitários sem navegador e um pipeline que **bloqueia o deploy** se algo quebrar. O teste E2E cobre os fluxos críticos e gera as próprias evidências.
- **Front-end × LGPD.** A privacidade foi tratada como parte do design: consentimento granular, finalidade explicada em cada campo, exportação e exclusão de dados com um toque, e minimização (totem sem conta, cozinha só com o primeiro nome).

## 7.2 Lições aprendidas e desafios

1. **Começar pelo mobile** simplificou o desktop: quem cabe em 360 px só precisa ganhar colunas.
2. **Os estados de erro dão mais trabalho que o caminho feliz.** Pagamento, cupom e retirada têm mais telas de exceção que de sucesso.
3. **Cardápio por unidade** exigiu recalcular o carrinho na troca de loja, um caso que só apareceu ao montar a jornada.
4. **Sem framework**, foi preciso cuidar à mão do escape de HTML (XSS) e da atualização parcial da tela (a busca não pode perder o foco).

## 7.3 Pontos de atenção e evolução

| Evolução | Motivo |
|---|---|
| Back-end real (Node/NestJS ou Java/Spring) com JWT e perfis de acesso | Substituir o localStorage e o PIN de demonstração |
| Atualização do status por WebSocket/SSE e notificações *push* | Hoje a atualização é simulada por temporizador |
| Integração com um gateway real em ambiente *sandbox* | Validar webhooks e idempotência |
| PWA com *service worker* (cardápio offline) | O manifesto já existe; falta o cache |
| Personalização de itens (sem cebola, ponto da carne) | Pedido frequente em lanchonetes |
| Migração para React/Vue se a equipe crescer | A separação atual em módulos facilita a migração |
| Relatório de impacto (RIPD) e revisão jurídica | Necessário antes de ir para produção |

---

# 8. Referências

ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. **NBR 6023**: informação e documentação: referências: elaboração. Rio de Janeiro: ABNT, 2018.

BRASIL. **Lei nº 13.709, de 14 de agosto de 2018**. Lei Geral de Proteção de Dados Pessoais (LGPD). Presidência da República, 2018. Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm. Acesso em: 8 nov. 2026.

AUTORIDADE NACIONAL DE PROTEÇÃO DE DADOS (ANPD). **Guia orientativo: cookies e proteção de dados pessoais**. ANPD, 2022. Disponível em: https://www.gov.br/anpd. Acesso em: 8 nov. 2026.

BANCO CENTRAL DO BRASIL. **Pix: manual de padrões para iniciação do Pix**. BCB, [2020]. Disponível em: https://www.bcb.gov.br/estabilidadefinanceira/pix. Acesso em: 8 nov. 2026.

GARRETT, Jesse James. **The elements of user experience**: user-centered design for the web and beyond. 2. ed. Berkeley: New Riders, 2011.

KRUG, Steve. **Não me faça pensar**: uma abordagem de bom senso à usabilidade na web e mobile. 3. ed. Rio de Janeiro: Alta Books, 2014.

MDN WEB DOCS. **Responsive design**. Mozilla, 2025. Disponível em: https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design. Acesso em: 8 nov. 2026.

NIELSEN, Jakob. **10 usability heuristics for user interface design**. Nielsen Norman Group, 1994, atualizado em 2024. Disponível em: https://www.nngroup.com/articles/ten-usability-heuristics/. Acesso em: 8 nov. 2026.

PCI SECURITY STANDARDS COUNCIL. **PCI DSS v4.0**: Payment Card Industry Data Security Standard. 2022. Disponível em: https://www.pcisecuritystandards.org. Acesso em: 8 nov. 2026.

PRESSMAN, Roger S.; MAXIM, Bruce R. **Engenharia de software**: uma abordagem profissional. 9. ed. Porto Alegre: AMGH, 2021.

SOMMERVILLE, Ian. **Engenharia de software**. 10. ed. São Paulo: Pearson, 2019.

W3C. **Web Content Accessibility Guidelines (WCAG) 2.2**. 2023. Disponível em: https://www.w3.org/TR/WCAG22/. Acesso em: 8 nov. 2026.

WROBLEWSKI, Luke. **Mobile first**. New York: A Book Apart, 2011.
