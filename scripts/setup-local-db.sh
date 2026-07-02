#!/usr/bin/env bash
# Cria a role e o banco de desenvolvimento do projeto num Postgres
# já rodando (assume Homebrew postgresql@16 na porta 5433 — ver
# README na raiz do repositório para o setup de máquina, que é
# manual e feito uma única vez).
#
# Idempotente: rodar de novo não dá erro se já existir.
set -euo pipefail

PSQL_BIN="/opt/homebrew/opt/postgresql@16/bin/psql"
PORT=5433
ADMIN_USER="$(whoami)"

role_exists=$("$PSQL_BIN" -p "$PORT" -U "$ADMIN_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_roles WHERE rolname='shift'")

if [ "$role_exists" != "1" ]; then
  "$PSQL_BIN" -p "$PORT" -U "$ADMIN_USER" -d postgres -c \
    "CREATE ROLE shift WITH LOGIN PASSWORD 'shift_dev_password';"
  echo "Role 'shift' criada."
else
  echo "Role 'shift' já existe — nada a fazer."
fi

db_exists=$("$PSQL_BIN" -p "$PORT" -U "$ADMIN_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='shift_dev'")

if [ "$db_exists" != "1" ]; then
  "$PSQL_BIN" -p "$PORT" -U "$ADMIN_USER" -d postgres -c \
    "CREATE DATABASE shift_dev OWNER shift;"
  echo "Banco 'shift_dev' criado."
else
  echo "Banco 'shift_dev' já existe — nada a fazer."
fi
