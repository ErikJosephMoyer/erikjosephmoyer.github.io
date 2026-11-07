# Retrieving GitHub PAT from macOS Keychain

Since you are using a MacBook Pro M3 Max and rely on terminal-first workflows, you likely stored your GitHub Personal Access Token (PAT) using the macOS `osxkeychain` credential helper. 

To retrieve the forgotten token, run the following command in your terminal:

```bash
security find-internet-password -s github.com -w
```

This will prompt you for your macOS user password. Once authenticated, it will output your raw GitHub PAT directly to the terminal.

If you need to see the full keychain entry details (including the account name):
```bash
security find-internet-password -s github.com -g
```
