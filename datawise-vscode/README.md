# DataWise VS Code Extension

MVP bridge between VS Code and the [DataWise CLI](https://github.com/apache/datawise-cli) desktop app.

## Features

- **Open in DataWise** — send the current selection (or entire file) to the SQL console via the `datawise://` deep link.

## Requirements

- [DataWise CLI desktop app](../datawise-frontend/) installed and registered as the handler for `datawise://` URLs.

## Settings

| Setting | Description |
|---------|-------------|
| `datawise.connectionId` | Connection ID from `connections.xml` (recommended) |
| `datawise.database` | Optional default database/schema |

Example workspace settings (`.vscode/settings.json`):

```json
{
  "datawise.connectionId": "mysql-local",
  "datawise.database": "app_db"
}
```

## Usage

1. Open or select SQL in the editor.
2. Run **DataWise: Open in DataWise** from the Command Palette, or right-click → **Open in DataWise**.
3. DataWise opens (or focuses) and loads the SQL in a console tab.

Without `datawise.connectionId`, the desktop app still opens but may prompt you to pick a connection.

## Development

```bash
cd datawise-vscode
npm install
npm run compile
npm test
```

Launch from VS Code: open this folder, press **F5** (Run Extension).

Package a `.vsix` (optional):

```bash
npx @vscode/vsce package
```

## Deep link format

```
datawise://open?connectionId=<id>&database=<db>&sql=<encoded-sql>
```

See also **Settings → Basic → Deep Link** in the desktop app.
