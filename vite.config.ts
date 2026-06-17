import { defineConfig } from "vite-plus";

// lint / fmt の設定を vite-plus の設定ファイルに統一する
export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: false,
    },
    plugins: ["typescript", "oxc", "unicorn", "import", "promise", "vitest"],
    categories: {
      // 明らかに間違っているコード
      correctness: "error",
      // パフォーマンスに影響するコード
      perf: "error",
      // 疑わしいコード
      suspicious: "error",
      // 厳格なルール
      pedantic: "error",
      // 制限ルールは個別に設定
      restriction: "off",
      // スタイルルール
      style: "error",
    },
    rules: {
      // ===== eslint: 無効化ルール =====
      // 日本語コメントが先頭小文字として誤検知されるため無効化
      "capitalized-comments": "off",
      // SDK として named export が必須のため無効化
      "import/no-named-export": "off",
      // named export を宣言と同時に行うスタイルのため無効化
      "import/group-exports": "off",
      // 三項演算子は可読性を損なわない範囲で使用するため無効化
      "no-ternary": "off",
      // タイムアウト値、解像度、ポート番号等のリテラル値が多いため無効化
      "no-magic-numbers": "off",
      // e, i, v 等の短い変数名はコールバック引数として一般的なため無効化
      "id-length": "off",
      // コード内のインラインコメントは補足説明として有用なため無効化
      "no-inline-comments": "off",
      // 関数宣言と関数式の両方を用途に応じて使い分けるため無効化
      "func-style": "off",
      // import の並び順は論理的なグルーピングを優先するため無効化
      "sort-imports": "off",
      // オブジェクトキーの並び順は論理的な順序を優先するため無効化
      "sort-keys": "off",
      // ループ内の continue は早期スキップとして可読性を高めるため無効化
      "no-continue": "off",
      // let 宣言後に条件分岐で代入するパターンは一般的なため無効化
      "init-declarations": "off",
      // コールバック内で親スコープの変数名を再利用するパターンは一般的なため無効化
      "no-shadow": "off",
      // TODO/XXX コメントは開発中の課題管理に必要なため無効化
      "no-warning-comments": "off",
      // 分割代入の強制は配列やオブジェクトの一部取得時に可読性を下げるため無効化
      "prefer-destructuring": "off",
      // 関連するクラス (エラークラス等) を 1 ファイルにまとめるパターンのため無効化
      "max-classes-per-file": "off",
      // SDK のメインファイルは必然的に大きいため無効化
      "max-lines": "off",
      // WebRTC のシグナリング処理やイベントハンドリングは本質的に長いため無効化
      "max-lines-per-function": "off",
      // シグナリングメッセージ生成等で引数が多い関数があるため無効化
      "max-params": "off",
      // 外部 API のコンストラクタ名が小文字の場合があるため無効化
      "new-cap": "off",
      // eslint core の require-await は typescript/require-await と重複するため無効化
      "require-await": "off",
      // WebRTC API では on* プロパティによるイベントハンドラ設定が標準的なため無効化
      "unicorn/prefer-add-event-listener": "off",
      // ブラウザ SDK では window を使用して実行環境を明示するため無効化
      "unicorn/prefer-global-this": "off",
      // オプションオブジェクトのデフォルト値はリテラルで指定するのが実用的なため無効化
      "unicorn/no-object-as-default-parameter": "off",
      // テスト用のヘルパー関数等を内部スコープに配置するパターンのため無効化
      "unicorn/consistent-function-scoping": "off",
      // 小さい配列では Set 化は過剰なため無効化
      "unicorn/prefer-set-has": "off",
      // 宣言と同時に export するスタイルのため無効化
      "import/exports-last": "off",
      // named export を使用するスタイルのため無効化
      "import/prefer-default-export": "off",
      // vite.config.ts 等の設定ファイルで anonymous default export を使用するため無効化
      "import/no-anonymous-default-export": "off",
      // 型定義ファイル (vite-env.d.ts) が誤検知されるため無効化
      "import/unambiguous": "off",
      // イベントハンドラやコールバックメソッドは this を使わないことがあるため無効化
      "class-methods-use-this": "off",
      // type import と value import を分離するパターンのため無効化
      "no-duplicate-imports": "off",
      // 順次処理が必要なケースでループ内 await を使用するため無効化
      "no-await-in-loop": "off",
      // Promise executor での早期 return を使用するため無効化
      "no-promise-executor-return": "off",
      // 既存コードの大規模リファクタは別タスクとするため無効化
      complexity: "off",
      // 既存コードの大規模リファクタは別タスクとするため無効化
      "max-statements": "off",
      // Promise の明示的無視に void 演算子を使用するため無効化
      "no-void": "off",
      // コンストラクタパラメータプロパティは TypeScript の標準機能のため無効化
      "typescript/parameter-properties": "off",

      // __SORA_JS_SDK_VERSION__ はビルド時に define で注入するグローバル定数
      "no-underscore-dangle": ["error", { allow: ["__SORA_JS_SDK_VERSION__"] }],

      // ===== eslint: 危険なコードの禁止 =====
      // console.log の使用を禁止
      "no-console": "error",
      // debugger 文の使用を禁止
      "no-debugger": "error",
      // alert/confirm/prompt の使用を禁止
      "no-alert": "error",
      // eval() の使用を禁止
      "no-eval": "error",
      // new Function() の使用を禁止
      "no-new-func": "error",
      // javascript: URL の使用を禁止
      "no-script-url": "error",
      // with 文の使用を禁止
      "no-with": "error",

      // ===== eslint: 比較と変数 =====
      // 厳密等価演算子 (===, !==) を強制
      eqeqeq: "error",
      // var の使用を禁止 (let/const を使用)
      "no-var": "error",
      // if/else/for/while で波括弧を強制
      curly: "error",
      // for-in ループで hasOwnProperty チェックを強制
      "guard-for-in": "error",

      // ===== eslint: 非推奨機能の禁止 =====
      // arguments.caller/callee の使用を禁止
      "no-caller": "error",
      // ネイティブオブジェクトの拡張を禁止
      "no-extend-native": "error",
      // 不要な bind() の使用を禁止
      "no-extra-bind": "error",
      // __iterator__ プロパティの使用を禁止
      "no-iterator": "error",
      // ラベル付き文の使用を禁止
      "no-labels": "error",
      // 不要なブロックの使用を禁止
      "no-lone-blocks": "error",
      // 複数行文字列 (バックスラッシュ) の使用を禁止
      "no-multi-str": "error",
      // プリミティブラッパーの new を禁止
      "no-new-wrappers": "error",
      // __proto__ プロパティの使用を禁止
      "no-proto": "error",

      // ===== eslint: コード品質 =====
      // return 文での代入を禁止
      "no-return-assign": "error",
      // 自己比較を禁止
      "no-self-compare": "error",
      // カンマ演算子の使用を禁止
      "no-sequences": "error",
      // リテラル値の throw を禁止 (Error オブジェクトを使用)
      "no-throw-literal": "error",
      // 未使用の式を禁止
      "no-unused-expressions": "error",
      // 不要な call()/apply() を禁止
      "no-useless-call": "error",
      // 不要な文字列連結を禁止
      "no-useless-concat": "error",

      // ===== eslint: モダン構文の推奨 =====
      // Math.pow() より ** 演算子を推奨
      "prefer-exponentiation-operator": "error",
      // Object.assign() よりスプレッド構文を推奨
      "prefer-object-spread": "error",
      // arguments より rest パラメータを推奨
      "prefer-rest-params": "error",
      // apply() よりスプレッド構文を推奨
      "prefer-spread": "error",
      // 文字列連結よりテンプレートリテラルを推奨
      "prefer-template": "error",
      // parseInt() で基数を明示
      radix: "error",
      // Symbol に説明を必須
      "symbol-description": "error",

      // ===== eslint: パフォーマンスと正確性 =====
      // 配列メソッドのコールバックで return を強制
      "array-callback-return": "error",
      // コンストラクタでの return を禁止
      "no-constructor-return": "error",
      // Object.prototype メソッドの直接呼び出しを禁止
      "no-prototype-builtins": "error",
      // var のブロックスコープ外使用を禁止
      "block-scoped-var": "error",
      // new の結果を使用しない場合を禁止
      "no-new": "error",
      // 不要なコンストラクタを禁止
      "no-useless-constructor": "error",

      // ===== eslint: スタイル =====
      // switch の default を最後に配置
      "default-case-last": "error",
      // デフォルト引数を最後に配置
      "default-param-last": "error",
      // getter/setter をグループ化
      "grouped-accessor-pairs": "error",
      // 不要な計算プロパティを禁止
      "no-useless-computed-key": "error",
      // Object.hasOwn() を推奨
      "prefer-object-has-own": "error",
      // parseInt より数値リテラルを推奨
      "prefer-numeric-literals": "error",
      // アロー関数の本体スタイルを統一
      "arrow-body-style": "error",
      // Yoda 条件を禁止 (if (5 === x) → if (x === 5))
      yoda: "error",
      // 不要な else を禁止
      "no-else-return": "error",
      // 否定条件を回避
      "no-negated-condition": "error",
      // new Object() を禁止
      "no-object-constructor": "error",
      // 不要な return を禁止
      "no-useless-return": "error",
      // 引数の再代入を禁止
      "no-param-reassign": "error",

      // ===== typescript: 非同期処理 =====
      // 非 Promise の await を禁止
      "typescript/await-thenable": "error",
      // 配列の delete を禁止 (splice を使用)
      "typescript/no-array-delete": "error",
      // toString() が意味のある値を返さないオブジェクトを検出
      "typescript/no-base-to-string": "error",
      // 紛らわしい void 式を禁止
      "typescript/no-confusing-void-expression": "error",
      // 自身の非推奨メソッドを内部で参照するケースがあるため無効化
      "typescript/no-deprecated": "off",
      // 重複する型構成要素を禁止
      "typescript/no-duplicate-type-constituents": "error",
      // 未処理の Promise を禁止
      "typescript/no-floating-promises": "error",
      // 配列への for-in を禁止
      "typescript/no-for-in-array": "error",
      // 暗黙の eval を禁止
      "typescript/no-implied-eval": "error",
      // 無意味な void 演算子を禁止
      "typescript/no-meaningless-void-operator": "error",
      // Promise の誤用を禁止
      "typescript/no-misused-promises": "error",
      // 不適切なスプレッドを禁止
      "typescript/no-misused-spread": "error",
      // 異なる型の enum 混在を禁止
      "typescript/no-mixed-enums": "error",
      // 冗長な型構成要素を禁止
      "typescript/no-redundant-type-constituents": "error",

      // ===== typescript: 不要なコードの検出 =====
      // 不要な boolean リテラル比較を禁止
      "typescript/no-unnecessary-boolean-literal-compare": "error",
      // 不要なテンプレート式を禁止
      "typescript/no-unnecessary-template-expression": "error",
      // 不要な型引数を禁止
      "typescript/no-unnecessary-type-arguments": "error",
      // 不要な型アサーションを禁止
      "typescript/no-unnecessary-type-assertion": "error",

      // ===== typescript: 型安全性 =====
      // any 型の引数を禁止
      "typescript/no-unsafe-argument": "error",
      // any 型の代入を禁止
      "typescript/no-unsafe-assignment": "error",
      // any 型の呼び出しを禁止
      "typescript/no-unsafe-call": "error",
      // 安全でない enum 比較を禁止
      "typescript/no-unsafe-enum-comparison": "error",
      // any 型のメンバーアクセスを禁止
      "typescript/no-unsafe-member-access": "error",
      // any 型の return を禁止
      "typescript/no-unsafe-return": "error",
      // WebRTC API の型システムの制約上、型アサーションが必要な場面が多いため無効化
      "typescript/no-unsafe-type-assertion": "off",
      // 安全でない単項マイナスを禁止
      "typescript/no-unsafe-unary-minus": "error",

      // ===== typescript: モダン構文の推奨 =====
      // オプショナルチェーンを推奨
      "typescript/prefer-optional-chain": "error",
      // 非 null アサーションのスタイル統一
      "typescript/non-nullable-type-assertion-style": "error",
      // Error オブジェクトのみを throw
      "typescript/only-throw-error": "error",
      // indexOf より includes を推奨
      "typescript/prefer-includes": "error",
      // || より ?? を推奨
      "typescript/prefer-nullish-coalescing": "error",
      // Promise.reject で Error オブジェクトを使用
      "typescript/prefer-promise-reject-errors": "error",
      // reduce の型パラメータを推奨
      "typescript/prefer-reduce-type-parameter": "error",
      // this 型の return を推奨
      "typescript/prefer-return-this-type": "error",
      // Promise を返す関数は async に
      "typescript/promise-function-async": "error",
      // getter/setter の型を一致させる
      "typescript/related-getter-setter-pairs": "error",
      // sort() で比較関数を必須
      "typescript/require-array-sort-compare": "error",
      // async 関数で await を必須
      "typescript/require-await": "error",
      // + 演算子のオペランドを制限
      "typescript/restrict-plus-operands": "error",
      // テンプレート式のオペランドを制限
      "typescript/restrict-template-expressions": "error",
      // async 関数で return await を強制
      "typescript/return-await": "error",
      // nullable チェックの既存パターンが多く大規模リファクタが必要なため無効化
      "typescript/strict-boolean-expressions": "off",
      // switch 文で全ケースを網羅
      "typescript/switch-exhaustiveness-check": "error",
      // メソッドの this バインドを強制
      "typescript/unbound-method": "error",
      // catch コールバックで unknown 型を使用
      "typescript/use-unknown-in-catch-callback-variable": "error",

      // ===== typescript: enum =====
      // enum の重複値を禁止
      "typescript/no-duplicate-enum-values": "error",
      // any 型の明示的使用を禁止
      "typescript/no-explicit-any": "error",

      // ===== typescript: null/undefined =====
      // 余分な非 null アサーションを禁止
      "typescript/no-extra-non-null-assertion": "error",
      // オプショナルチェーン後の非 null アサーションを禁止
      "typescript/no-non-null-asserted-optional-chain": "error",
      // 非 null アサーションを禁止
      "typescript/no-non-null-assertion": "error",

      // ===== typescript: その他 =====
      // this のエイリアスを禁止
      "typescript/no-this-alias": "error",
      // as const を推奨
      "typescript/prefer-as-const": "error",
      // for-of を推奨
      "typescript/prefer-for-of": "error",
      // 関数型を推奨
      "typescript/prefer-function-type": "error",
      // enum メンバーにリテラル値を推奨
      "typescript/prefer-literal-enum-member": "error",

      // ===== typescript: スタイル =====
      // Record 型を推奨
      "typescript/consistent-indexed-object-style": ["error", "record"],
      // interface を推奨
      "typescript/consistent-type-definitions": ["error", "interface"],
      // import type を強制
      "typescript/consistent-type-imports": "error",
      // 配列型のスタイル (シンプルな型は T[], 複雑な型は Array<T>)
      "typescript/array-type": [
        "error",
        {
          default: "array-simple",
        },
      ],
      // ts-expect-error ディレクティブに説明を必須
      "typescript/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
        },
      ],
      // tslint コメントを禁止
      "typescript/ban-tslint-comment": "error",
      // 関数の戻り値型を明示
      "typescript/explicit-function-return-type": "error",
      // 紛らわしい非 null アサーションを禁止
      "typescript/no-confusing-non-null-assertion": "error",
      // シグナリングメッセージの動的プロパティ管理に必要なため無効化
      "typescript/no-dynamic-delete": "off",
      // 空のオブジェクト型を禁止
      "typescript/no-empty-object-type": "error",
      // 不要なクラスを禁止
      "typescript/no-extraneous-class": "error",
      // import type の副作用を禁止
      "typescript/no-import-type-side-effects": "error",
      // 推論可能な型の明示を禁止
      "typescript/no-inferrable-types": "error",
      // 無効な void 型を禁止
      "typescript/no-invalid-void-type": "error",
      // namespace を禁止
      "typescript/no-namespace": "error",
      // require() を禁止
      "typescript/no-require-imports": "error",
      // 不要な空 export を禁止
      "typescript/no-useless-empty-export": "error",
      // ラッパーオブジェクト型を禁止
      "typescript/no-wrapper-object-types": "error",
      // 安全でない宣言マージを禁止
      "typescript/no-unsafe-declaration-merging": "error",
      // 安全でない Function 型を禁止
      "typescript/no-unsafe-function-type": "error",
      // enum 初期化子を推奨
      "typescript/prefer-enum-initializers": "error",
      // namespace キーワードを推奨
      "typescript/prefer-namespace-keyword": "error",
      // トリプルスラッシュ参照を禁止
      "typescript/triple-slash-reference": "error",
      // オーバーロードシグネチャを隣接配置
      "typescript/adjacent-overload-signatures": "error",
      // ジェネリクスコンストラクタのスタイル統一
      "typescript/consistent-generic-constructors": "error",
      // 不要な型制約を禁止
      "typescript/no-unnecessary-type-constraint": "error",

      // ===== oxc: バグ検出 =====
      // Math.PI などの近似定数を検出
      "oxc/approx-constant": "error",
      // arguments への配列メソッド適用を禁止
      "oxc/bad-array-method-on-arguments": "error",
      // 誤ったビット演算を検出
      "oxc/bad-bitwise-operator": "error",
      // charAt() の誤った比較を検出
      "oxc/bad-char-at-comparison": "error",
      // 誤った比較シーケンスを検出
      "oxc/bad-comparison-sequence": "error",
      // Math.min/max の誤用を検出
      "oxc/bad-min-max-func": "error",
      // オブジェクトリテラルの誤った比較を検出
      "oxc/bad-object-literal-comparison": "error",
      // replaceAll の誤った引数を検出
      "oxc/bad-replace-all-arg": "error",
      // 定数比較の矛盾を検出
      "oxc/const-comparisons": "error",
      // 二重比較を検出
      "oxc/double-comparisons": "error",
      // 消去演算 (x * 0) を検出
      "oxc/erasing-op": "error",
      // 誤ったリファクタリングによる代入を検出
      "oxc/misrefactored-assign-op": "error",
      // throw の欠落を検出
      "oxc/missing-throw": "error",
      // ループ内スプレッドの蓄積を禁止
      "oxc/no-accumulating-spread": "error",
      // 範囲外の数値引数を検出
      "oxc/number-arg-out-of-range": "error",
      // 再帰でのみ使用される引数を検出
      "oxc/only-used-in-recursion": "error",
      // 未呼び出しの配列コールバックを検出
      "oxc/uninvoked-array-callback": "error",
      // Map のスプレッドを禁止 (パフォーマンス)
      "oxc/no-map-spread": "error",

      // ===== unicorn: エラー処理 =====
      // catch の error 変数名を統一
      "unicorn/catch-error-name": "error",
      // 空配列スプレッドの一貫性
      "unicorn/consistent-empty-array-spread": "error",
      // 存在チェックのインデックス一貫性
      "unicorn/consistent-existence-index-check": "error",
      // Date クローンの一貫性
      "unicorn/consistent-date-clone": "error",
      // Error メッセージを必須
      "unicorn/error-message": "error",

      // ===== unicorn: コードスタイル =====
      // エスケープシーケンスの大文字化
      "unicorn/escape-case": "error",
      // 明示的な length チェック
      "unicorn/explicit-length-check": "error",
      // ビルトインの new 使用を統一
      "unicorn/new-for-builtins": "error",

      // ===== unicorn: 禁止パターン =====
      // eslint-disable の乱用を禁止
      "unicorn/no-abusive-eslint-disable": "error",
      // アクセサの再帰を禁止
      "unicorn/no-accessor-recursion": "error",
      // 配列コールバック参照を禁止
      "unicorn/no-array-callback-reference": "error",
      // forEach を禁止 (for-of を使用)
      "unicorn/no-array-for-each": "error",
      // 配列メソッドの this 引数を禁止
      "unicorn/no-array-method-this-argument": "error",
      // reduce を禁止 (可読性のため)
      "unicorn/no-array-reduce": "error",
      // await 式のメンバーアクセスを禁止
      "unicorn/no-await-expression-member": "error",
      // Promise メソッド内の await を禁止
      "unicorn/no-await-in-promise-methods": "error",
      // 空ファイルを禁止
      "unicorn/no-empty-file": "error",
      // 16 進エスケープを禁止
      "unicorn/no-hex-escape": "error",
      // 即座の変更を禁止
      "unicorn/no-immediate-mutation": "error",
      // Array の instanceof を禁止
      "unicorn/no-instanceof-array": "error",
      // ビルトインの instanceof を禁止
      "unicorn/no-instanceof-builtins": "error",
      // 無効な fetch オプションを禁止
      "unicorn/no-invalid-fetch-options": "error",
      // slice の終端に length を禁止
      "unicorn/no-length-as-slice-end": "error",
      // 孤立した if を禁止
      "unicorn/no-lonely-if": "error",
      // マジックナンバーの flat 深度を禁止
      "unicorn/no-magic-array-flat-depth": "error",
      // 等価チェックでの否定を禁止
      "unicorn/no-negation-in-equality-check": "error",
      // ネストした三項演算子を禁止
      "unicorn/no-nested-ternary": "error",
      // new Array() を禁止
      "unicorn/no-new-array": "error",
      // new Buffer() を禁止
      "unicorn/no-new-buffer": "error",
      // null を許可 (undefined との使い分けが必要なため)
      "unicorn/no-null": "off",
      // 単一 Promise の Promise メソッドを禁止
      "unicorn/no-single-promise-in-promise-methods": "error",
      // static のみのクラスを禁止
      "unicorn/no-static-only-class": "error",
      // thenable オブジェクトを禁止
      "unicorn/no-thenable": "error",
      // this の代入を禁止
      "unicorn/no-this-assignment": "error",
      // typeof undefined を禁止
      "unicorn/no-typeof-undefined": "error",
      // 不要な await を禁止
      "unicorn/no-unnecessary-await": "error",
      // 不要な slice 終端を禁止
      "unicorn/no-unnecessary-slice-end": "error",
      // 読みづらい配列分割代入を禁止
      "unicorn/no-unreadable-array-destructuring": "error",
      // 読みづらい IIFE を禁止
      "unicorn/no-unreadable-iife": "error",
      // 不要なスプレッドフォールバックを禁止
      "unicorn/no-useless-fallback-in-spread": "error",
      // 不要な length チェックを禁止
      "unicorn/no-useless-length-check": "error",
      // 不要な Promise.resolve/reject を禁止
      "unicorn/no-useless-promise-resolve-reject": "error",
      // 不要なスプレッドを禁止
      "unicorn/no-useless-spread": "error",
      // 不要な switch case を禁止
      "unicorn/no-useless-switch-case": "error",
      // 不要な undefined を禁止
      "unicorn/no-useless-undefined": "error",
      // 不要な小数部を禁止 (1.0 → 1)
      "unicorn/no-zero-fractions": "error",

      // ===== unicorn: 数値リテラル =====
      // 数値リテラルの大文字小文字を統一
      "unicorn/number-literal-case": "error",
      // 数値区切りのスタイルを統一
      "unicorn/numeric-separators-style": "error",

      // ===== unicorn: モダン API の推奨 =====
      // find を推奨
      "unicorn/prefer-array-find": "error",
      // flatMap を推奨
      "unicorn/prefer-array-flat-map": "error",
      // flat を推奨
      "unicorn/prefer-array-flat": "error",
      // indexOf を推奨
      "unicorn/prefer-array-index-of": "error",
      // some を推奨
      "unicorn/prefer-array-some": "error",
      // at() を推奨
      "unicorn/prefer-at": "error",
      // codePointAt を推奨
      "unicorn/prefer-code-point": "error",
      // Date.now() を推奨
      "unicorn/prefer-date-now": "error",
      // デフォルトパラメータを推奨
      "unicorn/prefer-default-parameters": "error",
      // 論理演算子を三項演算子より推奨
      "unicorn/prefer-logical-operator-over-ternary": "error",
      // Math.min/max を推奨
      "unicorn/prefer-math-min-max": "error",
      // Math.trunc を推奨
      "unicorn/prefer-math-trunc": "error",
      // モダンな Math API を推奨
      "unicorn/prefer-modern-math-apis": "error",
      // ネイティブ型変換関数を推奨
      "unicorn/prefer-native-coercion-functions": "error",
      // 負のインデックスを推奨
      "unicorn/prefer-negative-index": "error",
      // Number プロパティを推奨
      "unicorn/prefer-number-properties": "error",
      // Object.fromEntries を推奨
      "unicorn/prefer-object-from-entries": "error",
      // オプショナル catch バインディングを推奨
      "unicorn/prefer-optional-catch-binding": "error",
      // プロトタイプメソッドを推奨
      "unicorn/prefer-prototype-methods": "error",
      // Reflect.apply を推奨
      "unicorn/prefer-reflect-apply": "error",
      // RegExp.test を推奨
      "unicorn/prefer-regexp-test": "error",
      // Set.size を推奨
      "unicorn/prefer-set-size": "error",
      // スプレッド構文を推奨
      "unicorn/prefer-spread": "error",
      // String.raw を推奨
      "unicorn/prefer-string-raw": "error",
      // replaceAll を推奨
      "unicorn/prefer-string-replace-all": "error",
      // slice を推奨
      "unicorn/prefer-string-slice": "error",
      // startsWith/endsWith を推奨
      "unicorn/prefer-string-starts-ends-with": "error",
      // trimStart/trimEnd を推奨
      "unicorn/prefer-string-trim-start-end": "error",
      // structuredClone を推奨
      "unicorn/prefer-structured-clone": "error",
      // トップレベル await を推奨
      "unicorn/prefer-top-level-await": "error",
      // TypeError を推奨
      "unicorn/prefer-type-error": "error",

      // ===== unicorn: 必須引数 =====
      // join の区切り文字を必須
      "unicorn/require-array-join-separator": "error",
      // モジュール属性を必須
      "unicorn/require-module-attributes": "error",
      // toFixed の桁数を必須
      "unicorn/require-number-to-fixed-digits-argument": "error",

      // ===== unicorn: スタイル =====
      // switch case の波括弧を統一
      "unicorn/switch-case-braces": "error",
      // テキストエンコーディング識別子の大文字小文字を統一
      "unicorn/text-encoding-identifier-case": "error",
      // new Error() を強制
      "unicorn/throw-new-error": "error",
      // assert の一貫性
      "unicorn/consistent-assert": "error",
      // クラスフィールドを推奨
      "unicorn/prefer-class-fields": "error",

      // ===== import: 正確性 =====
      // default import の存在確認
      "import/default": "error",
      // export の整合性確認
      "import/export": "error",
      // import を先頭に配置
      "import/first": "error",
      // named import の存在確認
      "import/named": "error",
      // namespace の存在確認
      "import/namespace": "error",

      // ===== import: 禁止パターン =====
      // 絶対パスの import を禁止
      "import/no-absolute-path": "error",
      // AMD を禁止
      "import/no-amd": "error",
      // CommonJS を禁止
      "import/no-commonjs": "error",
      // 循環依存を禁止
      "import/no-cycle": "error",
      // 重複 import を禁止
      "import/no-duplicates": "error",
      // 空の名前付きブロックを禁止
      "import/no-empty-named-blocks": "error",
      // ミュータブルな export を禁止
      "import/no-mutable-exports": "error",
      // default と同名の named export を禁止
      "import/no-named-as-default": "error",
      // default のメンバーアクセスを禁止
      "import/no-named-as-default-member": "error",
      // named として default を import することを禁止
      "import/no-named-default": "error",
      // 自己 import を禁止
      "import/no-self-import": "error",
      // webpack ローダー構文を禁止
      "import/no-webpack-loader-syntax": "error",

      // ===== promise: 必須パターン =====
      // .then() チェーン内で必ずしも return が不要なパターンがあるため無効化
      "promise/always-return": "off",
      // new Promise を許可 (ストリーム処理等で必要)
      "promise/avoid-new": "off",
      // catch または return を強制
      "promise/catch-or-return": "error",

      // ===== promise: 禁止パターン =====
      // Promise 内のコールバックを禁止
      "promise/no-callback-in-promise": "error",
      // 複数回の resolve/reject を禁止
      "promise/no-multiple-resolved": "error",
      // Promise のネストを禁止
      "promise/no-nesting": "error",
      // Promise の静的メソッドへの new を禁止
      "promise/no-new-statics": "error",
      // コールバック内の Promise を禁止
      "promise/no-promise-in-callback": "error",
      // finally での return を禁止
      "promise/no-return-in-finally": "error",
      // 不要な Promise ラップを禁止
      "promise/no-return-wrap": "error",
      // パラメータ名を統一
      "promise/param-names": "error",

      // ===== promise: モダン構文の推奨 =====
      // 既存の .then() パターンやコールバックパターンを維持するため無効化
      "promise/prefer-await-to-callbacks": "off",
      // 既存の .then() チェーンを維持するため無効化
      "promise/prefer-await-to-then": "off",
      // catch メソッドを推奨
      "promise/prefer-catch": "error",
      // 有効なパラメータを強制
      "promise/valid-params": "error",

      // ===== vitest: テストの品質 =====
      // TODO コメントの警告
      "vitest/warn-todo": "error",
      // vi/vitest の一貫した使用
      "vitest/consistent-vitest-vi": "error",
      // each/for の一貫性
      "vitest/consistent-each-for": "error",
      // ホイスト API をファイル先頭に配置
      "vitest/hoisted-apis-on-top": "error",
      // 不要な async expect 関数を禁止
      "vitest/no-unneeded-async-expect-function": "error",
      // 呼び出し回数の検証を推奨
      "vitest/prefer-called-times": "error",
      // toHaveBeenCalledOnce を推奨
      "vitest/prefer-called-once": "error",
      // spy を推奨
      "vitest/prefer-spy-on": "error",
      // テストファイル名の一貫性
      "vitest/consistent-test-filename": "error",
      // require-hook はトップレベルの副作用に反応するため、ベースでは無効化して
      // テストファイル override でのみ有効にする (sora-devtools と同様)
      "vitest/require-hook": "off",
      // ===== vitest: oxlintrc から除外したルール (vite-plus 非対応) =====
      // 以下は .oxlintrc.jsonc にあったが vite-plus が認識しないため統合時に削除した:
      // vitest/prefer-to-have-been-called, vitest/prefer-to-have-been-called-times,
      // vitest/prefer-describe-function-title, vitest/prefer-called-with

      // ===== vitest: プロジェクトに不適なルール (sora-devtools と同様) =====
      // globals 経由の vitest API を利用する
      "vitest/no-importing-vitest-globals": "off",
      "vitest/prefer-importing-vitest-globals": "off",
      // top-level describe の強制は不要
      "vitest/require-top-level-describe": "off",
      // Chai API の assert を利用し expect() を呼ばないテストがあるため無効化
      "vitest/prefer-expect-assertions": "off",
      // expect-expect と同様に Chai API の assert を利用するテストがあるため無効化
      "vitest/expect-expect": "off",
      // prefer-strict-boolean-matchers (toBe(true)/toBe(false)) と競合するため無効化
      "vitest/prefer-to-be-falsy": "off",
      "vitest/prefer-to-be-truthy": "off",

      // ===== typescript: 採用しない pedantic 系ルール (sora-devtools と同様) =====
      // WebRTC API の MediaTrackConstraints など外部 API の型と相性が悪く全面採用が困難なため無効化する
      "typescript/prefer-readonly-parameter-types": "off",
      // イベントハンドラに async 関数を渡すパターンが一般的なため無効化する
      "typescript/strict-void-return": "off",
    },
    overrides: [
      {
        // テストファイルは型安全性を緩和
        files: ["**/*.test.ts", "**/*.prop.ts"],
        rules: {
          "typescript/no-explicit-any": "off",
          "typescript/no-non-null-assertion": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
          "typescript/no-unsafe-type-assertion": "off",
          // require-hook はテストの setup/teardown 規律なのでテストファイルでのみ有効にする
          // (sora-devtools と同様)
          "vitest/require-hook": "error",
        },
      },
      {
        // e2e テストはブラウザ操作のためルールを緩和
        files: ["e2e-tests/**"],
        rules: {
          // テストのデバッグ出力に console.log を使用
          "no-console": "off",
          // Node.js モジュール (node:crypto 等) を使用
          "import/no-nodejs-modules": "off",
          // ファイル名はスネークケースを使用
          "unicorn/filename-case": "off",
          // イベントハンドラに async コールバックを使用
          "typescript/no-misused-promises": "off",
          // コールバック関数の戻り値型は推論に任せる
          "typescript/explicit-function-return-type": "off",
          // テスト内の非 null アサーションは許容
          "typescript/no-non-null-assertion": "off",
          // e2e テストでは any 型の使用を許容
          "typescript/no-explicit-any": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
          // e2e テストの async コールバックは await なしでも許容
          "typescript/require-await": "off",
          // e2e の main.ts 等はトップレベル初期化が必要なため無効化
          "vitest/require-hook": "off",
        },
      },
      {
        // 設定ファイルは Node.js 環境で動作
        files: ["*.config.ts", "playwright.config.ts"],
        rules: {
          // Node.js モジュール (node:path 等) を使用
          "import/no-nodejs-modules": "off",
          // 設定ファイルの関数は戻り値型を推論に任せる
          "typescript/explicit-function-return-type": "off",
        },
      },
      {
        // 型定義ファイルはグローバル型宣言のため副作用 import を許容する
        files: ["**/*.d.ts"],
        rules: {
          "import/no-unassigned-import": "off",
        },
      },
      {
        // JavaScript ファイルは補助的なものなので緩和する
        files: ["**/*.js"],
        rules: {
          "unicorn/filename-case": "off",
          "typescript/no-explicit-any": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
        },
      },
      {
        // examples はライブラリではなく動作確認用の緩いコードのため制限を緩和する
        files: ["examples/**/*.ts"],
        rules: {
          "no-alert": "off",
          "no-console": "off",
          "no-magic-numbers": "off",
          "no-shadow": "off",
          "no-void": "off",
          "id-length": "off",
          "func-style": "off",
          "init-declarations": "off",
          "prefer-destructuring": "off",
          "require-await": "off",
          "import/no-named-export": "off",
          "promise/always-return": "off",
          "promise/no-nesting": "off",
          "promise/prefer-await-to-then": "off",
          "typescript/explicit-function-return-type": "off",
          "typescript/no-explicit-any": "off",
          "typescript/no-misused-promises": "off",
          "typescript/no-non-null-assertion": "off",
          "typescript/no-unnecessary-boolean-literal-compare": "off",
          "typescript/no-unnecessary-type-assertion": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
          "typescript/no-unsafe-type-assertion": "off",
          "typescript/no-useless-default-assignment": "off",
          "typescript/prefer-nullish-coalescing": "off",
          "typescript/require-await": "off",
          "typescript/strict-boolean-expressions": "off",
          "unicorn/consistent-function-scoping": "off",
          "unicorn/no-array-for-each": "off",
          "unicorn/numeric-separators-style": "off",
          "unicorn/prefer-global-this": "off",
          "unicorn/prefer-query-selector": "off",
          "vitest/require-hook": "off",
        },
      },
      {
        // 既存のパッケージ src はベースルールより緩やかな実装になっているため緩和する
        files: ["packages/*/src/**/*.ts"],
        rules: {
          "no-await-in-loop": "off",
          "no-console": "off",
          "no-duplicate-imports": "off",
          "no-negated-condition": "off",
          "no-shadow": "off",
          "no-void": "off",
          "class-methods-use-this": "off",
          complexity: "off",
          "max-classes-per-file": "off",
          "max-lines": "off",
          "max-lines-per-function": "off",
          "max-params": "off",
          "init-declarations": "off",
          "id-length": "off",
          "no-magic-numbers": "off",
          "no-warning-comments": "off",
          "func-style": "off",
          "import/group-exports": "off",
          "import/namespace": "off",
          "import/no-anonymous-default-export": "off",
          "import/no-named-export": "off",
          "import/no-namespace": "off",
          "import/prefer-default-export": "off",
          "import/unambiguous": "off",
          "promise/no-nesting": "off",
          "promise/prefer-await-to-callbacks": "off",
          "promise/prefer-await-to-then": "off",
          "typescript/ban-ts-comment": "off",
          "typescript/explicit-function-return-type": "off",
          "typescript/no-non-null-assertion": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
          "typescript/no-unsafe-type-assertion": "off",
          "typescript/no-useless-constructor": "off",
          "typescript/require-await": "off",
          "typescript/strict-boolean-expressions": "off",
          "typescript/use-unknown-in-catch-callback-variable": "off",
          "unicorn/consistent-function-scoping": "off",
          "unicorn/filename-case": "off",
          "unicorn/no-array-for-each": "off",
          "unicorn/no-await-expression-member": "off",
          "unicorn/no-negated-condition": "off",
          "unicorn/number-literal-case": "off",
          "unicorn/prefer-global-this": "off",
          "unicorn/prefer-ternary": "off",
          "unicorn/prefer-top-level-await": "off",
        },
      },
    ],
    ignorePatterns: ["dist/**", "node_modules/**"],
  },
  fmt: {
    ignorePatterns: ["dist/**"],
  },
});
