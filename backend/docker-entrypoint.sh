#!/bin/sh
# Sobe o backend: aplica as migrations pendentes e troca este processo pelo servidor.
set -e

echo "[DEPLOY] Aplicando migrations do banco"
prisma migrate deploy

echo "[DEPLOY] Iniciando o servidor"
# O exec troca o shell pelo Node: assim o SIGTERM do deploy chega direto ao servidor,
# que desliga de forma limpa (Fase 6) em vez de ser morto à força
exec node dist/server.js