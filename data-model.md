# Modelo de dados do CliqueFácil

A aplicação foi pensada como multi-tenant: cada cliente possui seus próprios dados.

## clients
- id
- businessName
- slug
- segment
- description
- phone
- instagram
- address
- hours
- accentColor
- logoUrl
- active
- createdAt
- updatedAt

## clients/{clientId}/items
Produtos ou serviços da página.
- id
- name
- description
- price
- imageUrl
- active
- category

## clients/{clientId}/orders
Pedidos.
- id
- customerName
- customerPhone
- items
- total
- paymentMethod
- status
- createdAt

## clients/{clientId}/appointments
Agendamentos.
- id
- customerName
- customerPhone
- service
- date
- time
- status
- createdAt

## URLs
Cada cliente terá um slug próprio, por exemplo `/pizzaria-oliveira`.

## Segurança
O painel deverá exigir autenticação. As regras do Firestore devem impedir que um cliente leia ou altere dados de outro cliente.
