| Setting | Value |
| :-- | :-- |
| Server | `irc.exoduscommunity.com` |
| Port | `6667` (no SSL) |
| Channel | `#exodus-home` |

`#exodus-home` only lets in **registered nicknames**, so you have to register yours once ([step 4](#irc-step-4)).

### Free clients {#irc-clients}

| System | Client |
| :----- | :----- |
| {% include os-icon.html os="windows" label="Windows" %} | [HexChat](https://hexchat.github.io/), [AdiIRC](https://adiirc.com/) or [Halloy](https://github.com/squidowl/halloy) |
| {% include os-icon.html os="macos" label="macOS" %} | [LimeChat](https://github.com/psychs/limechat) or [Halloy](https://github.com/squidowl/halloy) |
| {% include os-icon.html os="linux" label="Linux" %} | [HexChat](https://hexchat.github.io/) or [Halloy](https://github.com/squidowl/halloy) (both usually in your package manager), or [WeeChat](https://weechat.org/) in a terminal |

While searching for IRC software, mIRC may appear: this is paid software with a free trial.

### How to connect {#irc-connect}

1. <span id="irc-step-1" class="step-anchor">**Add the server.**</span> In your client's server list, add a new network with server `irc.exoduscommunity.com`, port `6667`, and SSL/TLS turned **off**.
2. <span id="irc-step-2" class="step-anchor">**Pick a nickname.**</span> Using your in-game name makes you easy to recognise.
3. <span id="irc-step-3" class="step-anchor">**Connect.**</span> If you try to join the channel now you will get *"unable to join channel (not using registered nickname)"*, which is expected.
4. <span id="irc-step-4" class="step-anchor">**Register your nickname.**</span> Because of bot attacks, you must stay connected for **30 minutes** first. Then type:

   ```
   /msg NickServ REGISTER yourpassword youremail@example.com
   ```

   If you get a confirmation e-mail, follow it.
5. <span id="irc-step-5" class="step-anchor">**Join the channel:**</span>

   ```
   /join #exodus-home
   ```

From then on, log in each time you connect with `/msg NickServ IDENTIFY yourpassword`, or put the password in your client's *NickServ password* (or *SASL*) field so it happens automatically.
