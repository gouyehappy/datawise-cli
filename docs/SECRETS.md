# Secrets & master key (G5)

DataWise encrypts sensitive fields (connection passwords, SSH keys, AI API keys) with a local AES-256 master key. This document covers portable master key, external secret references (`env` / `file` / **json-file** / **Vault**), and what remains for cloud KMS.

## Master key

Resolution order:

1. Environment variable `DATAWISE_MASTER_KEY` (Base64 of 32 raw bytes) — preferred for multi-node / containers
2. File `config/.datawise-master-key` if present
3. Otherwise generate a key, write it to that file (owner-only permissions), and use it

Inspect the active source in **Settings → Org & security → Secrets** (`GET /api/system/secrets`). The API never returns key material.

## Encrypted storage

Local ciphertext uses the prefix `dwenc:v1:…` (AES-GCM). The master key must stay the same across hosts that share encrypted config files.

## External secret references

Instead of storing a password (plain or encrypted), put a reference in the password field:

| Reference | Resolves to |
|-----------|-------------|
| `dwsecret:env:DB_PASSWORD` | `System.getenv("DB_PASSWORD")` |
| `dwsecret:file:secrets/db-password.txt` | Contents of `config/secrets/db-password.txt` (trimmed) |
| `dwsecret:file:/absolute/path` | Absolute file path |
| `dwsecret:vault:secret/data/myapp/db#password` | HashiCorp Vault KV — GET `{VAULT_ADDR}/v1/secret/data/myapp/db`, field `password` |

### Vault

- Address: `DATAWISE_VAULT_ADDR` or `VAULT_ADDR`
- Token: `DATAWISE_VAULT_TOKEN` or `VAULT_TOKEN`
- Path should be the **KV v2 API path** after `/v1/` (include the `/data/` segment), then `#field`
- KV v1 responses (`data.field` without nested `data.data`) are also accepted

References are **not** re-encrypted on save. They are resolved when the connection is used.

## Still open

- AWS KMS / Azure Key Vault providers
- UI wizard to insert references into connection forms
- Org-directory sync (G2) for automatic credential rotation policy
