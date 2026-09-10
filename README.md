# Infinite Field / WebGPU Mandelbrot Explorer

外部依存のない単体 HTML ビューアです。ネットワークに画像や座標を送りません。

## 起動

WebGPU 対応ブラウザで `index.html` を開いてください。直接開いて動かない場合は、このフォルダで次を実行します。

```sh
python -m http.server 8000 --bind 127.0.0.1
```

ブラウザで `http://localhost:8000/` を開きます。Windows で `python` がない場合は `py` を使ってください。ハードウェアアクセラレーションを有効にしてください。埋め込みプレビューでは WebGPU や Blob Worker が制限される場合があります。その場合は通常のブラウザタブで開いてください。

## 操作

- ホイール: ポインタ位置を中心に拡大・縮小。Shift 併用で高速。
- ドラッグ: 移動。ダブルクリック: 4 倍。タッチはピンチ対応。
- `+` / `-`: 2 倍 / 1/2 倍。`R`: 全景。`H`: パネル切替。
- `Space`: 自動ズーム。`Esc`: 停止。
- 座標パネル: 小数文字列で座標入力、正確な固定小数点座標を JSON で保存・復元。
- PNG: 表示画像を保存。

## 計算方式

カメラ座標は小数部 4096 bit の BigInt 固定小数点。基準軌道の計算は Web Worker で行い、精度はズームに応じて増やします。GPU は FP32 二本組の仮数と i32 指数を使用し、摂動式を計算します。必要に応じて軌道を再基準化します。

```text
z = Z + delta_z
c = C + delta_c
delta_z_next = 2*Z*delta_z + delta_z^2 + delta_c
```

画面全体の非線形誤差上界を見積もり、初期反復を線形近似で省略する機能を付けています。これは多項式の高次級数近似や全反復区間の BLA テーブルではなく、初期区間の一次近似です。画素すべての計算が完了すると、反復上限に達する前でも処理を終了します。

操作中は既存画像の再投影と低解像度描画、停止後は高精細描画に切り替えます。一度にキューに投げる計算は短いバッチに分割しています。

## 制限と検証状況

操作上限は 10^1000 倍ですが、全地点での正確性・描画速度を保証しません。黒い画素は「反復上限まで発散を検出しなかった」点であり、集合内部の証明ではありません。正確な区間演算や誤差保証付き描画ではありません。

JavaScript 構文、カーソル固定ズーム、JSON 位置データ復元、パレット選択、ヘルプ、モバイルパネルを確認しました。

**この作成環境のブラウザ制限により、WebGPU 本体の実行、WGSL の実機コンパイル、PNG 出力の実機動作は未確認です。**

別途、CPU 上で FP32 二本組の丸めを模擬し、各地点 48 サンプルの発散回数を BigInt 直接計算と照合しました。全景、海馬の谷、-2 の先端の 10^80 倍・10^1000 倍では全サンプルが一致しました。約 8.8e10 倍の海馬の境界では 48 点中 1 点で 50 反復の差が残りました。詳細は `numeric-validation.json` を参照してください。GPU の最適化や丸めにより結果が異なる可能性もあります。

数値テストの再実行には Node.js を使います。ビューア自体に Node.js は不要です。

```sh
node test_numeric.cjs
```

## 参考資料

- Claude Heiland-Allen, Deep zoom theory and practice (2021): https://mathr.co.uk/blog/2021-05-14_deep_zoom_theory_and_practice.html
- Claude Heiland-Allen, Deep zoom theory and practice (again) (2022): https://mathr.co.uk/blog/2022-02-21_deep_zoom_theory_and_practice_again.html
- WGSL specification: https://www.w3.org/TR/WGSL/
- WebGPU secure-context requirement: https://developer.mozilla.org/en-US/docs/Web/API/GPU
