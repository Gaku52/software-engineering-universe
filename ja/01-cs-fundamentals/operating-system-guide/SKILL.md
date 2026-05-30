# オペレーティングシステムガイド

オペレーティングシステムの仕組みを体系的に学ぶ包括的ガイド。プロセス管理、メモリ管理、ファイルシステム、I/O、セキュリティ、仮想化まで、OSの全レイヤーを理解する。

## Skill概要

| 項目 | 内容 |
|------|------|
| カテゴリ | OS・システム |
| 難易度 | 中級〜上級 |
| 前提知識 | computer-science-fundamentals（特にハードウェア基礎） |
| 推定学習時間 | 60〜80時間 |
| ガイド数 | 20ファイル |

## 学習目標

- [ ] OSの役割と基本構造を説明できる
- [ ] プロセスとスレッドの管理方式を理解する
- [ ] 仮想メモリとページングの仕組みを説明できる
- [ ] ファイルシステムの内部構造を理解する
- [ ] I/Oとデバイスドライバの基本を知る
- [ ] OSレベルのセキュリティ機構を理解する
- [ ] 仮想化とコンテナの違いを説明できる

## ディレクトリ構成

```
docs/
├── 00-introduction/          # OS入門
│   ├── 00-what-is-os.md         # OSとは何か
│   └── 01-os-history.md         # OSの歴史と進化
├── 01-process-management/    # プロセス管理
│   ├── 00-processes.md          # プロセスの概念
│   ├── 01-threads.md            # スレッドと並行性
│   ├── 02-scheduling.md         # CPUスケジューリング
│   └── 03-ipc.md               # プロセス間通信
├── 02-memory-management/     # メモリ管理
│   ├── 00-virtual-memory.md     # 仮想メモリ
│   ├── 01-paging.md             # ページングとセグメンテーション
│   └── 02-memory-allocation.md  # メモリ割り当て戦略
├── 03-file-systems/          # ファイルシステム
│   ├── 00-fs-basics.md          # ファイルシステムの基礎
│   ├── 01-fs-implementations.md # 主要FS実装（ext4, NTFS, APFS）
│   └── 02-io-scheduling.md     # I/Oスケジューリング
├── 04-io-and-devices/        # I/Oとデバイス
│   ├── 00-device-drivers.md     # デバイスドライバ
│   └── 01-interrupts-dma.md    # 割り込みとDMA
├── 05-security/              # OSセキュリティ
│   ├── 00-access-control.md     # アクセス制御
│   └── 01-sandboxing.md        # サンドボックスと隔離
├── 06-virtualization/        # 仮想化
│   ├── 00-vm-basics.md          # 仮想マシンの基礎
│   └── 01-containers.md        # コンテナ技術
└── 07-modern-os/             # 現代のOS
    ├── 00-mobile-os.md          # モバイルOS
    └── 01-cloud-os.md           # クラウドとリアルタイムOS
```

## 前提Skill

## 次のステップ

## 参考文献
1. Silberschatz, A. et al. "Operating System Concepts." 10th Ed, Wiley, 2018.
2. Tanenbaum, A. "Modern Operating Systems." 4th Ed, Pearson, 2014.
3. Love, R. "Linux Kernel Development." 3rd Ed, Addison-Wesley, 2010.
