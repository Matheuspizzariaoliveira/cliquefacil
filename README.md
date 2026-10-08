# CliqueFácil

Base de uma plataforma para criar e gerenciar páginas digitais para vários clientes usando modelos reutilizáveis.

## Já implementado

- Painel administrativo
- Cadastro e edição de clientes
- 6 segmentos iniciais: pizzaria/restaurante, barbearia, salão, estética/manicure, loja e autônomo
- Slug individual por cliente
- Catálogo separado por cliente
- Cadastro, edição e exclusão de produtos/serviços
- Página pública individual por cliente usando `?site=slug`
- Botão de WhatsApp na página pública
- Layout responsivo

## Próxima etapa

Conectar o projeto ao Firebase para substituir o localStorage por autenticação e Firestore, permitindo que os dados fiquem persistentes e separados por cliente em produção.

## Arquitetura de dados planejada

- `clients`
- `clients/{clientId}/items`
- `clients/{clientId}/orders`
- `clients/{clientId}/appointments`

O protótipo continua usando localStorage enquanto a configuração do Firebase não é inserida.

## Arquivos principais

- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`
- `data-model.md`
