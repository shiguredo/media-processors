# macOS Safari で同一カメラデバイスを複数ブラウザから同時利用すると映像がチラつく

- Created: 2026-09-10
- Completed: {YYYY-MM-DD}
- Branch: feature/fix-safari-camera-flicker-multiple-browsers
- Polished: {YYYY-MM-DD}
- Reporter: @torikizi

## 目的

macOS の Safari で同一のカメラデバイスを複数のブラウザから同時に利用して配信すると、映像がチラつくという報告がある。この事象について確認できている再現条件と非再現条件を記録し、Media Processors 側で対応すべき条件が揃った時点で着手できる状態にしておく。

## 現状

### 事象

macOS の Safari で同一のカメラデバイスを複数のブラウザから同時に利用して配信すると、映像がチラつく。

### 再現が確認できている条件

- macOS Ventura 13.3 以降の Safari で再現する
- 同一のカメラデバイスを同タイミングで使用した場合に再現する
- USB カメラでも再現する

### 再現が確認できていない条件

- Monterey の MacBook Air では再現しない
- macOS の Chrome では再現しない

### 未確認事項

- Media Processors の映像処理（Safari で動作するのは仮想背景 / 背景ぼかし）を適用したトラックで再現するのか、適用していないトラックでも再現するのか
- 複数ブラウザのうちチラつくのはどのブラウザの映像か
- Safari のバージョンやカメラ機種による再現性の差

## pending にした理由

再現条件が「macOS Ventura 13.3 以降の Safari」かつ「同一カメラデバイスの同タイミングでの利用」に限定されており、この利用方法は開発者以外にはほとんど想定されない。また、Safari とカメラデバイスの排他制御に起因するものか、Media Processors の映像処理が関与しているのかが切り分けられておらず、着手できる修正方針が立っていない。

以下のいずれかを満たした時点で reopened にし、対応を検討する:

- Safari 以外の環境でも再現する
- 同一カメラデバイスを同タイミングで利用していない場合にもチラつく

再開時は、まず Media Processors の映像処理を適用していないトラックで再現するかを確認し、Media Processors が関与していないことが確定した場合はその根拠を記録して closed にする。

## 完了条件

- 再開条件を満たしたうえで原因を切り分け、Media Processors の映像処理が関与している場合は修正によりチラつきが再現しなくなること
- Media Processors が関与していないと確認できた場合は、確認方法と結果を本 issue に記録して closed にすること
