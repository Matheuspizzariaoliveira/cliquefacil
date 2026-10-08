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


## Agendamentos com horários disponíveis

- A página pública mostra horários em intervalos de 30 minutos, usando o horário de funcionamento cadastrado quando ele contém um intervalo reconhecível (por exemplo, \`09:00 às 18:00\`); se não conseguir identificar o intervalo, usa 09:00–18:00.
- Ao reservar, o horário é gravado em \`clients/{clientId}/slots/{data_hora}\` e fica indisponível para outros clientes.
- Ao cancelar um agendamento pelo painel, o horário volta a ficar disponível.
- A reserva usa transação do Firestore para impedir que duas pessoas reservem simultaneamente o mesmo horário.

### Regra adicional obrigatória do Firestore

Na regra atual, dentro de \`match /clients/{clientId}\`, adicione este bloco junto às regras de \`items\`, \`orders\` e \`appointments\`. Ele permite que a página pública consulte apenas os documentos de horários (sem nome ou telefone dos clientes); só o dono da página pode apagar ou alterar reservas:

\`\`\`text
match /slots/{slotId} {
  allow read: if get(/databases/$(database)/documents/clients/$(clientId)).data.active == true
    || ownsClient(clientId);
  allow create: if get(/databases/$(database)/documents/clients/$(clientId)).data.active == true
    && request.resource.data.keys().hasOnly(['date', 'time', 'createdAt'])
    && request.resource.data.date is string
    && request.resource.data.time is string;
  allow update, delete: if ownsClient(clientId);
}
\`\`\`

Publique as regras no Console do Firebase antes de testar os horários. Sem essa regra adicional, a consulta de disponibilidade e a reserva não funcionarão.
