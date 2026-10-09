# 仙剑AVG 剧本格式规范

## 文件
每章一个 JSON：`js/story_ch0.json` … `js/story_ch7.json`，外加 `js/story_endings.json`。
顶层为节点数组，每个节点有唯一 `id`。

## 节点格式
```json
{
  "id": "ch0_001",
  "bg": "bg_xianling",
  "bgm": "dielian",
  "show": [{"c": "linger", "pos": "right"}],
  "hide": ["yueru"],
  "name": "赵灵儿",
  "text": "……",
  "do": {"linger": 2},
  "choice": [
    {"t": "选项文字", "do": {"linger": 2}, "go": "ch0_005"},
    {"t": "选项文字", "do": {"yueru": 1}, "go": "ch0_006"}
  ],
  "go": "ch0_002",
  "set": {"flag_name": 1},
  "if": {"flag": "k傀儡虫", "gte": 5, "go": "end_yueru_true", "else": "end_yueru_memory"},
  "ending": "end_linger_fate"
}
```

## 字段说明
- `bg`: 背景图 key（省略=保持上一个）
- `bgm`: 音乐 key（dielian/taohuayuan/moshi_baiyue/junmobai/huainian/ningjing/zhandou），省略=保持
- `show`: 出场立绘，`c`=角色key，`pos`=left/center/right
- `hide`: 退场角色 key 列表
- `name`: 说话人（旁白时省略或用"旁白"）
- `text`: 对白/旁白文本，简体中文
- `do`: 显示该节点时好感度变化
- `choice`: 选项数组，每个选项 `t`=文字，`do`=好感变化，`go`=跳转节点
- `go`: 无选项时下一节点（省略=数组下一条）
- `set`: 设置 flag（如傀儡虫收集数）
- `if`: 条件跳转，`flag`+`gte`/`eq`，`go`/`else`
- `ending`: 触发结局（结局内容在 story_endings.json）

## 角色 key
xiaoyao（李逍遥） linger（赵灵儿） yueru（林月如） anu（阿奴）
jinyuan（刘晋元） caiyi（彩依） jiujianxian（酒剑仙） baiyue（拜月教主）
laolao（姥姥） daniang（李大娘） tiannan（林天南） jiansheng（剑圣）
shigu（圣姑） gailuojiao（盖罗娇） pangbai（旁白用 null）

## 好感度
- linger / yueru / anu 三个计数器
- 每章 2-4 个选项影响好感，每次 ±1~3
- 结局判定看三者最高值

## 背景 key
bg_yuhang（余杭镇） bg_inn（客栈） bg_xianling（仙灵岛） bg_suzhou（苏州）
bg_linjia（林家堡） bg_baihe（白河村） bg_tomb（将军墓） bg_yangzhou（扬州）
bg_capital（京城） bg_shushan（蜀山） bg_suoyaota（锁妖塔） bg_dali（大理）
bg_shrine（女娲神庙） bg_palace（南诏王宫） bg_battle（决战） bg_snow（雪原）
bg_forest（树林） bg_temple（玉佛寺） bg_cave（山洞）

## CG key（关键剧情图，全屏）
cg_meet（仙灵岛初遇） cg_wedding（拜堂） cg_biwu（比武招亲）
cg_fly（御剑飞行） cg_tower（锁妖塔底） cg_death（月如之死）
cg_past（十年前南诏） cg_rain（灵儿祈雨） cg_final（决战水魔兽） cg_snow（雪中尾声）

## 章节与字数
- ch0 序章：余杭/仙灵岛（~3500字）
- ch1 苏州比武招亲（~4000字）
- ch2 白河村/将军墓（~3500字）
- ch3 扬州女飞贼（~3500字）
- ch4 京城/晋元彩依（~4000字）
- ch5 蜀山锁妖塔（~4500字）
- ch6 大理/十年前南诏（~4000字）
- ch7 决战拜月（~3500字）
- endings 结局集（6个结局，各800-1200字）

总计约 3.2 万字，游玩 2 小时以上。

## 写作要求
1. 严格按 plot-research.md 剧情走，不许魔改主线
2. 对白用简体中文，符合人物性格（逍遥机灵、灵儿温柔、月如直率、阿奴活泼）
3. 选项要有意义，影响好感度和少量剧情细节，不改变主线
4. 名场面必须保留：仙灵岛成亲、比武招亲、酒剑仙传剑、锁妖塔、月如之死、穿越十年前、灵儿祈雨、最终决战、雪中尾声
5. 每章至少 2 个选项，全程至少 20 个选项
6. 傀儡虫收集：在 ch6 安排 2-3 处可收集 flag（影响隐藏结局）
