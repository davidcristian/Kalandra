---
title: Command-line options
---

A command-line option is text you add after the program's path when you start it. Kalandra reads three options:
`--no-overlay`, `--listen` and `--no-updates`.

## How to add an option

Quit Kalandra first. Only one copy of Kalandra runs at a time, so a second copy started with an option exits at once.

- **Windows.** Right-click a Kalandra shortcut, such as the one on the desktop, and click **Properties**. In the
  **Target** field, add a space and the option after the program path, for example
  `"C:\path\to\Kalandra.exe" --no-updates`. Click **OK** and start Kalandra from that shortcut. For the portable
  download, create a shortcut to its `.exe` file first.
- **Linux.** Start the AppImage from a terminal with the option after its path, for example
  `./Kalandra-<version>.AppImage --no-overlay`. The AppImage adds `--sandbox` to the command line by itself.
- **macOS.** Start Kalandra from Terminal with `open -a Kalandra --args --no-overlay`.

## `--no-overlay`

Kalandra starts without the overlay window. It opens its page in your default web browser instead, and the tray menu
item **Open in Browser** opens it again. Use it to run Kalandra in a browser when the overlay window does not work on
your system.

## `--listen=[host][:port]`

Sets the address of Kalandra's local web server. This server sends the app page to the overlay and to browsers, and
it forwards the app's requests to the sites it uses, such as the trade site. By default the server listens on
`127.0.0.1`, the loopback address that only this computer can reach, on a random free port that changes on each
start.

The host and the port are both optional. Write the value after `=` with no space. With `--listen` alone, a space in
place of `=`, or a value Kalandra cannot read, Kalandra writes an error to its log (Settings, **Debug** page) and uses
the default address. It does the same when it cannot listen on the address, such as a port another program uses or a
host address this computer does not have. When the default address fails too, it shows the error `Kalandra cannot
start` and quits. Write an IPv6 host in brackets, such as `--listen=[::1]:9001`.

- `--listen=:9001` keeps the loopback address and sets port 9001. The page then always opens at
  `http://localhost:9001`, so you can bookmark it.
- `--listen=0.0.0.0` makes the server listen on every network interface of this computer. Use it when a VPN client
  blocks connections to `127.0.0.1`.
- `--listen=0.0.0.0:9001` does both.

A host other than the loopback address lets other devices on your network open Kalandra's page at this computer's IP
address and the port, such as `http://192.168.1.20:9001`. Kalandra rejects a request that names this computer by a
host name, such as `computer.local`, because a web page can make a name like that point at this computer. The overlay
always opens the page at `localhost`, so use `0.0.0.0`, which includes the loopback address. With a single network
address as the host, the overlay cannot load its page. A page on another device takes the price check from the
overlay when it connects or gets the focus, as [The price check opens in a browser
page](/nothing-happens#the-price-check-opens-in-a-browser-page) explains.

**The server has no password.** When it listens on any address other than the loopback address, any device that
reaches it can read and change your Kalandra settings. It can also send requests to the trade site with the sign-in of
the [built-in browser](/price-check#built-in-browser). Use such a host only on a network you trust.

## `--no-updates`

On the Windows installer and the Linux AppImage, Kalandra does not download or install updates. It still checks for
them and shows "You have disabled automatic updates download" in Settings, About when one exists. The portable
Windows download and the macOS download do not update themselves, so the option changes nothing there.
[Updates](/download#updates) describes what each download does.

## Electron switches

Kalandra is an Electron app: Electron runs Kalandra's page in a Chromium browser window. Electron also reads its own
[command-line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) and those of Chromium.
