# Screenify

Plataforma de compartilhamento de tela em tempo real com anotações colaborativas.

Um usuário cria uma sala, compartilha a tela e os espectadores assistem e desenham sobre ela, com os desenhos sincronizados para todos.

## Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand, Socket.IO Client, WebRTC, Canvas

**Backend:** Node.js, TypeScript, Express, Socket.IO, mediasoup (SFU), Prisma, PostgreSQL, Zod, Pino

## Estrutura

    screenify/
    ├── frontend/   Aplicação React (Vercel)
    ├── backend/    API, WebSocket e SFU mediasoup (Coolify)
    └── shared/     Tipos compartilhados entre frontend e backend

## Ambientes

| Serviço  | URL                               |
|----------|-----------------------------------|
| Frontend | https://screenify.jcrldev.com     |
| API      | https://api-screenify.jcrldev.com |

## Status

Em desenvolvimento.