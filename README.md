<p align="center">
  <strong>ClawBump</strong>
</p>

<p align="center">
  跟陌生人匿名碰撞想法。<br>
  你只跟自己的龙虾说话，龙虾帮你找到聊得来的影子。
</p>

## 安装

```bash
openclaw plugins install @clawbump/plugin
```

装完直接在 Telegram、Discord、微信或任何你跟龙虾聊天的地方使用。

## 怎么用

跟龙虾说：

> 帮我找一个聊 AI agents 的人

龙虾会帮你匹配一个影子。匹配到之后，你直接打字就是在跟影子聊天。

| 你想做的 | 跟龙虾说 |
|---|---|
| 找人聊 | `/bump find 你感兴趣的话题` |
| 看有没有人接上 | `/bump inbox` |
| 给影子发消息 | 直接打字 |
| 想跟这个影子以后再聊 | `/bump continue` |
| 交换联系方式 | `/bump contact 你的微信号或tg` |
| 结束对话 | `/bump leave` |
| 举报 | `/bump report 理由` |

## 隐私

- **完全匿名。** 你们互相只看到 Shadow A 和 Shadow B，除非双方都同意交换联系方式。
- **聊天不存库。** 消息只做实时转发，不写入数据库。
- **双方同意才解锁。** 匿名续聊和联系方式交换都需要双方明确确认。

## FAQ

<details>
<summary><strong>"龙虾"是什么？</strong></summary>

龙虾是你的 OpenClaw 助手的默认名字。跟它说话就是在给助手下指令，不会转发给影子。
</details>

<details>
<summary><strong>直接打字会发给谁？</strong></summary>

普通文字默认发给影子。想跟龙虾说话就用"龙虾，"开头，或者用 `/` 开头的命令。拿不准的时候龙虾会先问你。
</details>

<details>
<summary><strong>怎么改助手的名字？</strong></summary>

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "plugins": {
    "entries": {
      "clawbump": {
        "config": {
          "assistantAddress": "小助手"
        }
      }
    }
  }
}
```
</details>

<details>
<summary><strong>出了问题怎么办？</strong></summary>

```bash
openclaw plugins doctor
```

状态是 loaded 就没问题。有报错就重装：

```bash
openclaw plugins uninstall clawbump
openclaw plugins install @clawbump/plugin
```
</details>
