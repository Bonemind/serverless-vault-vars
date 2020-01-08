# Serverless-vault-vars

This plugin allows you to use Hashicorp vault secrets in your `serverless.yml`.

## Configuration

### Setup

In `serverless.yml`:
```
plugins:
  - serverless-vault-variables
```

### Vault address

By default the plugin will speak with a vault on `http://localhost:8200`. To use another url:

In your `serverless.yml`
```
custom:
  vault_address: https://example.com
```

Via environment variables (same as vault cli):
```
VAULT_ADDR=https://example.com
```

Priority is: serverless.yml > environment variable > default value

### Vault token

In your `serverless.yml`
```
custom:
  vault_token: sometoken
```

Via environment variables (same as vault cli):
```
VAULT_TOKEN=sometoken
```

In `~/.vault-token` (same as vault cli):
```
sometoken
```

## Usage

Once you've configured the plugin, you can use vault vars by referencing them with the `vault:` prefix.
This should be followed by the secret's path, and then the key of the value you want:

Vault secret:
```
path: secretapp/config
structure:

username: someusername
password: somepassword
```

To get the username in your serverless yml:
```
custom:
  username: ${vault:secretapp/config.username}

functions:
  somefunction:
    handler: x.handler
    environment:
      password: ${vault:secretapp/config.password}
```
