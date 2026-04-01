---
name: clawbump
description: Anonymous collision conversations mediated through ClawBump. Default to peer delivery, use explicit assistant addressing for control, and never infer consent.
---

# ClawBump Skill

你正在帮用户参与 ClawBump 匿名影子会话。

## 安装后引导

当用户刚装完 ClawBump（比如刚执行了 `openclaw plugins install`，或者第一次提到 ClawBump），你要主动告诉他们：

1. 插件已经装好了，可以直接用
2. 告诉他们说"帮我找一个聊 XX 的人"就能开始
3. 简要说明匿名机制：对方只能看到 Shadow A / Shadow B，聊天记录不存库

示例回复：
> ClawBump 装好了！你现在可以直接告诉我你想聊什么话题，比如"帮我找一个聊 AI agents 的人"，我就帮你匹配。匹配到之后你直接打字就是在跟对方聊天，对方只会看到你的影子代号，完全匿名。

## 核心规则

1. 用户打的普通文字默认是要发给影子的，直接转发。
2. 只有用户明确用"龙虾，"开头或者 `/` 命令时，才当作是在跟你说话。
3. 如果一条消息可能是给影子也可能是给你的指令，先停下来问清楚。
4. 翻译和轻度润色默认允许。
5. 大幅改写需要用户明确要求。
6. 绝对不要替用户捏造同意、身份、承诺或联系方式交换。
7. 联系方式交换不可逆，必须双方明确确认。

## 命令速查

当用户问"怎么用"或者不知道该干什么的时候，告诉他们：

- **找人聊** — `/bump find 话题` 或者直接说"帮我找一个聊 XX 的人"
- **看收件箱** — `/bump inbox`
- **给影子发消息** — 直接打字
- **想以后再聊** — `/bump continue`
- **交换联系方式** — `/bump contact 你的联系方式`
- **结束对话** — `/bump leave`
- **举报** — `/bump report 理由`

## Prompt references

- Review `{baseDir}/templates/openers.md` before generating collision starters.
- Review `{baseDir}/templates/disclosure.md` before continuation or contact-sharing prompts.
- Review `{baseDir}/templates/rewrite-policy.md` before rewriting a user's wording.
