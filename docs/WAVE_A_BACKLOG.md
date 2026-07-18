# Wave A Backlog 鈥?浼佷笟鍑嗗叆锛圥0锛?

> 鏇存柊锛?026-07-17  
> 鏉ユ簮锛歔PRODUCT_GAP_ANALYSIS.md](./PRODUCT_GAP_ANALYSIS.md) Wave A锛圙3 鈫?G1 鈫?G4锛? 
> 鍘熷垯锛氬厛鎵撻€氥€屼簨浠跺嚭寰楀幓銆嶏紝鍐嶆帴浼佷笟韬唤锛屾渶鍚庤ˉ鍚堣瀹¤鍑哄彛锛涙瘡鏉″彲鐙珛鍚堝苟銆佸彲楠屾敹銆?

鐘舵€侊細`todo` 路 `in_progress` 路 `done`

---

## 鐩爣涓庨潪鐩爣

| 鍋?| 涓嶅仛锛堟湰 Wave锛?|
|----|-----------------|
| Webhook 澶栧彂 + 璁剧疆 UI | 椋炰功/閽夐拤/閭欢姝ｅ紡閫氶亾锛堝彲鐣?adapter 鎺ュ彛锛屽疄鐜版斁鍒?A.1 鍚庣画灏忚凯浠ｏ級 |
| OIDC 鐧诲綍锛堟湰鍦板苟瀛橈級 | LDAP/SAML銆佺粍缁囨爲鍚屾锛圙2锛?|
| 瀹¤鏈嶅姟绔鍑?+ SIEM Webhook | 涓嶅彲绡℃敼鍝堝笇閾?/ 瀹屾暣 SIEM 浜у搧锛堝彲浣滀负鍚庣画锛?|

**鎴愬姛鏍囧噯锛圵ave 缁撴潫锛?*

1. 瀹氭椂澶辫触 / 鐢熶骇瀹℃壒寰呭 / Schema 婕傜Щ 鑷冲皯鍚勮兘鎺ㄥ埌鍙厤缃?Webhook锛屽甫娴嬭瘯鎸夐挳銆? 
2. 鑷冲皯涓€绉?OIDC IdP锛堝 Keycloak / Authing / Azure AD锛夊彲鐧诲綍锛涙湰鍦拌处鍙峰彲寮€鍏炽€? 
3. 鍥㈤槦瀹¤鍙寜鏃堕棿鑼冨洿鏈嶅姟绔鍑?CSV/JSON锛涘彲閫夊疄鏃?audit Webhook銆?

---

## 鐜扮姸閿氱偣锛堝鐢紝鍕块噸閫狅級

| 鑳藉姏 | 宸叉湁钀界偣 | Wave A 缂哄彛 |
|------|----------|-------------|
| 搴旂敤鍐呴€氱煡 | `WorkspaceNotificationService` + 閫氱煡鎶藉眽锛沗ScheduledTaskService.pushTaskNotification` | 鏃犲鍙戦€氶亾 |
| 鐢熶骇瀹℃壒 | `TeamProductionApprovalService`锛坰ubmit / finalize / reject + audit锛?| 鎻愪氦鍚?*涓?*閫氱煡瀹℃壒浜?|
| Schema 婕傜Щ | `ScheduledTaskService` `TYPE_SCHEMA_DRIFT` 鈫?`SchemaDriftService.runMonitor` | 缁撴灉浠呬换鍔＄姸鎬?/ 搴旂敤鍐呴€氱煡 |
| 璁よ瘉 | `AuthService` 鏈湴瀵嗙爜锛沗LoginResult` 宸叉湁 provider 瀛楁 `"LOCAL"` | 鏃?OIDC |
| 瀹¤瀵煎嚭 | 鍓嶇 `team-audit-export.service.ts` + `TeamAuditPanel` 鏈満涓嬭浇 | 鍙?list limit 闄愬埗锛涙棤鏈嶅姟绔祦寮?/ SIEM |

---

## 鎵ц椤哄簭鎬昏

```text
A1 閫氱煡浜嬩欢鎬荤嚎锛堝唴閮級 鈫?A2 Webhook 閫氶亾 鈫?A3 鎸傛帴涓夌被浜嬩欢 鈫?A4 璁剧疆 UI
         鈫?
A5 OIDC 閰嶇疆涓庡洖璋?鈫?A6 鐧诲綍 UI / 浼氳瘽 鈫?A7 鏈湴骞跺瓨寮€鍏?
         鈫?
A8 鏈嶅姟绔璁″鍑?API 鈫?A9 Audit 澶栧彂 Webhook 鈫?A10 鍓嶇瀵煎嚭鍒囨湇鍔＄
```

寤鸿鍚堝苟鑺傚锛?*3 涓?PR**锛圓1鈥揂4 / A5鈥揂7 / A8鈥揂10锛夛紝鎴栨寜鏉℃媶鏇村皬 PR銆?

---

## A1 鈥?鍑虹珯閫氱煡浜嬩欢妯″瀷锛堝唴閮ㄦ€荤嚎锛?

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G3 鍩虹 |
| **鍋氫粈涔?* | 瀹氫箟缁熶竴 `OutboundEvent`锛坱ype銆乻everity銆乻everity銆乸ayload銆乷ccurredAt锛夛紱鍦?`pushNotification` 鎴愬姛璺緞鏃佸苟琛?fan-out锛堝け璐ヤ笉闃绘柇涓绘祦绋嬶級 |
| **涓昏钀界偣** | 鏂板缓濡?`datawise-config` 鎴?`datawise-server` 涓?`outbound/`锛歚OutboundEventType`銆乣OutboundEventPublisher`锛涗粠 `WorkspaceNotificationService` / 浠诲姟 / 瀹℃壒璋冪敤 publisher |
| **浜嬩欢鏋氫妇锛堥鎵癸級** | `scheduled_task.ok` 路 `scheduled_task.failed` 路 `prod.approval.pending` 路 `prod.approval.decided` 路 `schema_drift.detected` 路 `schema_drift.clean` 路 `audit.appended`锛圓9 鐢級 |
| **楠屾敹** | 鍗曟祴锛歱ublish 鍚庢墍鏈夋敞鍐?Channel 琚皟鐢紱Channel 鎶涢敊涓嶅奖鍝嶈皟鐢ㄦ柟 |
| **棰勪及** | S |

---

## A2 鈥?Webhook Channel锛堥€氱敤 HTTP POST锛?

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G3 |
| **鍋氫粈涔?* | 瀹炵幇 `WebhookOutboundChannel`锛氱鍚嶅ご锛圚MAC-SHA256锛夈€佽秴鏃躲€侀噸璇曪紙濡?2 娆￠€€閬匡級銆佸彲閫変簨浠剁櫧鍚嶅崟锛涢厤缃瓨鐢ㄦ埛/鍥㈤槦绾?JSON锛堜笌鐜版湁 `config/` 椋庢牸涓€鑷达級 |
| **閰嶇疆瀛楁寤鸿** | `enabled` 路 `url` 路 `secret` 路 `eventTypes[]` 路 `timeoutMs` 路 `includeSql`锛堥粯璁?false锛?|
| **涓昏钀界偣** | Store锛歚OutboundWebhookStore`锛汼ervice锛氭姇閫?+ `testWebhook`锛堝彂 `outbound.test`锛夛紱Controller锛欳RUD + test |
| **楠屾敹** | 闆嗘垚娴嬶細mock HTTP server 鏀跺埌 JSON锛涢敊璇?URL 璁板け璐ユ鏁颁絾涓嶇偢涓绘祦绋?|
| **棰勪及** | M |

**Payload 绾﹀畾锛堢ǔ瀹氬瓧娈碉紝渚夸簬瀹㈡埛瑙ｆ瀽锛?*

```json
{
  "id": "evt-鈥?,
  "type": "scheduled_task.failed",
  "occurredAt": "2026-07-17T06:00:00Z",
  "severity": "user",
  "severityId": "1",
  "title": "鈥?,
  "body": "鈥?,
  "data": { }
}
```

---

## A3 鈥?鎸傛帴涓夌被涓氬姟浜嬩欢

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G3 楠屾敹鍙ｅ緞 |
| **鍋氫粈涔?* | 鍦ㄧ幇鏈夋垚鍔熻矾寰勬梺 `publisher.publish(...)` |
| **鎸傛帴鐐?* | 鈶?`ScheduledTaskService.pushTaskNotification` 鍚庢寜 ok/failed 鍙?outbound  
鈶?`TeamProductionApprovalService.submitProductionApproval` 鈫?`prod.approval.pending`锛坧ayload锛歛pprovalId銆乧onnectionId銆乺equester锛?*閫氱煡瀵硅薄**锛氬洟闃?manager 鐨?webhook / 鐢ㄦ埛绾?webhook 鎸夐厤缃級  
鈶?finalize / reject 鈫?`prod.approval.decided`  
鈶?`SchemaDriftService.runMonitor`锛堟垨浠诲姟鍖呰澶勶級鍦ㄥ彂鐜板樊寮傛椂 `schema_drift.detected` |
| **娉ㄦ剰** | 瀹℃壒 pending 闇€鑳芥帹鍒?*瀹℃壒浜?*渚ч厤缃紝涓嶅彧鎻愪氦浜猴紱鍥㈤槦绾?webhook 浼樺厛 |
| **楠屾敹** | 鎵嬪伐锛氶厤 Webhook 鈫?璺戝け璐ュ畾鏃朵换鍔?/ 鎻愪氦瀹℃壒 / 鍒堕€犳紓绉?鈫?鎺ユ敹绔悇鑷冲皯 1 鏉?|
| **棰勪及** | M |

---

## A4 鈥?璁剧疆 UI锛氬嚭绔?Webhook

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G3 |
| **鍋氫粈涔?* | 璁剧疆椤碉紙鍥㈤槦璁剧疆鎴栥€岄€氱煡 / 闆嗘垚銆嶏級鍙鍒犳敼 Webhook銆佸嬀閫変簨浠躲€佹祴璇曞彂閫侊紱i18n zh/en |
| **涓昏钀界偣** | `datawise-frontend` settings / team 闈㈡澘锛汚PI 妯″潡锛涘鐢ㄧ幇鏈?Settings 琛ㄥ崟缁勪欢 |
| **楠屾敹** | 娴嬭瘯鎸夐挳鎴愬姛/澶辫触鏈?toast锛涗繚瀛樺悗閲嶅惎鍚庣閰嶇疆浠嶅湪 |
| **棰勪及** | M |

**A1鈥揂4 瀹屾垚鍚庡嵆鍙澶栧绉般€屽憡璀﹀彲鍑哄伐浣嶃€嶃€?*

---

## A5 鈥?OIDC 閰嶇疆涓庡洖璋?

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G1 |
| **鍋氫粈涔?* | 瀹炰緥绾?OIDC锛歚issuer` 路 `clientId` 路 `clientSecret` 路 `redirectUri` 路 `scopes`锛汚uthorization Code + PKCE锛堟闈?Electron 娉ㄦ剰 redirect锛夛紱鍥炶皟鎹?token銆佸彇 `sub`/`email`/`preferred_username` |
| **涓昏钀界偣** | `AuthService` / 鏂?`OidcAuthService`锛沗AuthController`锛歚GET /api/auth/oidc/login`銆乣GET /api/auth/oidc/callback`锛涢厤缃?example 鍏?`config/` |
| **鐢ㄦ埛鏄犲皠** | 棣栨鐧诲綍锛氭寜 email/username 鍏宠仈宸叉湁鐢ㄦ埛锛屽惁鍒欒嚜鍔ㄥ垱寤猴紙瑙掕壊榛樿涓?guest 鍖哄垎鐨勬敞鍐岀敤鎴凤級锛沗LoginResult` provider = `"OIDC"` |
| **楠屾敹** | 鏈湴 Keycloak锛堟垨鏂囨。鎸囧畾涓€绉嶏級璺戦€氱櫥褰曟嬁 session |
| **棰勪及** | L |

---

## A6 鈥?鐧诲綍 UI 涓庝細璇?

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G1 |
| **鍋氫粈涔?* | 鐧诲綍椤靛鍔犮€屼娇鐢ㄤ紒涓氳处鍙风櫥褰曘€嶏紱鍥炶皟钀藉湴鍚庡啓鐜版湁 session cookie/header 娴侊紱澶辫触閿欒鐮佸彲璇?|
| **涓昏钀界偣** | 鍓嶇 auth 瑙嗗浘锛汦lectron deep link / 鏈湴 callback 绔彛绛栫暐锛堣嫢妗岄潰锛夛細浼樺厛 Web 鑱旇皟锛屾闈㈢浜岃凯浠?|
| **楠屾敹** | Web 妯″紡瀹屾暣鐧诲綍 鈫?宸ヤ綔鍙帮紱鐧诲嚭娓?session |
| **棰勪及** | M |

---

## A7 鈥?鏈湴璐﹀彿骞跺瓨寮€鍏?

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G1 鐏板害 |
| **鍋氫粈涔?* | 绛栫暐锛歚localLoginEnabled`锛堥粯璁?true锛夛紱鍏抽棴鍚庝粎 OIDC锛坅dmin 鐮寸獥锛氶厤缃枃浠朵粛鍙紑锛夛紱OIDC 鏈厤缃椂涓嶅緱鍏抽棴鏈湴鐧诲綍 |
| **楠屾敹** | 鍏虫湰鍦?鈫?瀵嗙爜鐧诲綍 403/绂佺敤锛涘紑鏈湴 鈫?鍙岄€氶亾鍙敤 |
| **棰勪及** | S |

**A5鈥揂7 瀹屾垚鍚庡嵆鍙澶栧绉般€屽彲鎺ヤ紒涓?IdP銆嶃€?*

---

## A8 鈥?鏈嶅姟绔璁″鍑?API

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G4 |
| **鍋氫粈涔?* | `GET /api/teams/{id}/audit-logs/export?format=csv|json&since=&until=&actorUserId=&includeFullSql=`锛涙湇鍔＄娴佸紡鍐?response锛岀獊鐮村墠绔?list limit锛涙潈闄愶細鍥㈤槦 member锛沗includeFullSql` 浠?manager |
| **涓昏钀界偣** | `TeamController` + `TeamAuditService`锛涘簭鍒楀寲鍙榻愬墠绔垪锛坈reatedAt / actor / action / detail / sql锛?|
| **楠屾敹** | 瀵煎嚭 1涓? 鏉′笉 OOM锛堟祦寮忥級锛涙潈闄愬崟娴?|
| **棰勪及** | M |

---

## A9 鈥?Audit 杩藉姞鏃跺彲閫?Webhook

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G4 SIEM 杞婚噺 |
| **鍋氫粈涔?* | `TeamAuditService.audit` 鎴愬姛 append 鍚庡彂 `audit.appended`锛堝彲閰嶇疆鍏抽棴锛涢粯璁や笉鍙戝叏閲?SQL锛夛紱涓?A2 鍚岄€氶亾锛屼簨浠剁櫧鍚嶅崟鍕鹃€夊嵆鍙?|
| **楠屾敹** | 鍕鹃€夊悗鎵ц鍐?SQL 鈫?SIEM mock 鏀跺埌锛涘彇娑堝嬀閫夋棤娴侀噺 |
| **棰勪及** | S |

---

## A10 鈥?鍓嶇瀵煎嚭鍒囧埌鏈嶅姟绔?

| 瀛楁 | 鍐呭 |
|------|------|
| 鐘舵€?| todo |
| **鐘舵€?* | done锛?026-07-17锛?|
| **瀵瑰簲** | G4 |
| **鍋氫粈涔?* | `TeamAuditPanel` 瀵煎嚭鎸夐挳鏀逛负璋?A8锛涗繚鐣欐湰鏈哄簭鍒楀寲浣?fallback 鎴栧垹闄わ紱鏃堕棿鑼冨洿绛涢€変笌瀵煎嚭鍙傛暟涓€鑷?|
| **楠屾敹** | UI 瀵煎嚭涓?API 鏂囦欢涓€鑷达紱鍥炲綊娴嬫洿鏂?|
| **棰勪及** | S |

**A8鈥揂10 瀹屾垚鍚庡嵆鍙澶栧绉般€屽璁″彲瀵煎嚭 / 鍙繘 SIEM銆嶃€?*

---

## 渚濊禆涓庨闄?

| 椋庨櫓 | 缂撹В |
|------|------|
| Webhook 娉勯湶 SQL | 榛樿 `includeSql=false`锛涢潰鏉垮己鎻愮ず |
| OIDC + Electron redirect | Wave A 鍏堜氦 Web锛涙闈?PKCE/鑷畾涔夊崗璁崟鍒?follow-up |
| 瀹℃壒閫氱煡鎵句笉鍒?manager | 鍥㈤槦绾?webhook + 鎺ㄩ€佺粰鎵€鏈?`canManageTeam` 鐢ㄦ埛鐨勫簲鐢ㄥ唴閫氱煡锛堝弻鍐欙級 |
| 瀹¤ Webhook 椋庢毚 | 鍙噰鏍锋垨浠?`sql.write` / `sql.dangerous` / `prod.*`锛涢粯璁や笉璁㈤槄 `audit.appended` |

---

## 寤鸿鎺掓湡锛堢害 2锝? 鍛紝1 浜哄叏鑱屽彛寰勶級

| 鍛?| 鏉＄洰 |
|----|------|
| W1 | A1 A2 A3 A4 |
| W2 | A5 A6 A7锛圤IDC 鑱旇皟缂撳啿锛?|
| W3 | A8 A9 A10 + 鏂囨。 / example 閰嶇疆 / 鍥炲綊 |

---

## 鏂囨。涓庨厤缃氦浠橈紙Wave 缁撴潫蹇呬氦锛?

- [ ] `config/` 澧炲姞 `outbound-webhooks.json.example`銆乣oidc.json.example`  
- [ ] `docs/` 鐭枃锛歐ebhook 楠岀銆丱IDC 瀵规帴姝ラ锛堜竴绉?IdP锛夈€佸璁″鍑?API  
- [ ] 鏇存柊 [PRODUCT_GAP_ANALYSIS.md](./PRODUCT_GAP_ANALYSIS.md) 涓?G3/G1/G4 鐘舵€? 
- [ ] CHANGELOG 璁颁竴鏉′紒涓氬噯鍏ラ瑙?

---

## 鍙樻洿璁板綍

| 鏃ユ湡 | 璇存槑 |
|------|------|
| 2026-07-17 | 鍒濈锛歐ave A 鎷嗕负 A1鈥揂10 鍙墽琛?backlog锛岄敋瀹氱幇鏈夐€氱煡/瀹℃壒/瀹¤浠ｇ爜 |
