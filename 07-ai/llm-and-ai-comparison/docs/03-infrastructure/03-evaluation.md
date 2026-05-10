# LLM Evaluation — Benchmarks, LMSYS, and Human Evaluation

> LLM evaluation is a systematic framework for measuring model quality quantitatively and qualitatively. Without proper evaluation, decisions about model selection, prompt improvement, and fine-tuning cannot be made reliably. A multi-faceted approach combining automated benchmarks, LLM-as-a-Judge, and human evaluation is required.

## What You Will Learn in This Chapter

1. **Automated Benchmark Systems and How to Read Them** — The meaning and limitations of MMLU, HumanEval, MT-Bench, and Arena Elo
2. **Implementing LLM-as-a-Judge** — Techniques for using GPT-4o as an evaluator, and bias mitigation strategies
3. **Building an Evaluation Pipeline for Production** — In-house task evaluation, A/B testing, and continuous monitoring
4. **Statistical Significance Testing** — McNemar test and confidence interval estimation using Bootstrap
5. **Domain-Specific Evaluation** — Specialized evaluation methods for medical, legal, and code generation tasks
6. **Cost Optimization** — Trade-off analysis between evaluation cost and accuracy


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Local LLM — Ollama, llama.cpp, Quantization](./02-local-llm.md)

---

## 1. Overview of Evaluation Methods

```
┌──────────────────────────────────────────────────────────┐
│           LLM Evaluation Method Classification           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Automated Benchmarks (Static)                           │
│  ├── Knowledge: MMLU, ARC, HellaSwag                    │
│  ├── Reasoning: GSM8K, MATH, BIG-Bench Hard             │
│  ├── Code: HumanEval, MBPP, SWE-bench                   │
│  ├── Multilingual: MGSM, JMMLU                          │
│  ├── Instruction Following: IFEval, MT-Bench            │
│  └── High Difficulty: GPQA, LiveBench, ARC-AGI          │
│                                                          │
│  LLM-as-a-Judge (Dynamic)                                │
│  ├── MT-Bench: GPT-4 scores multi-turn dialogue 1-10    │
│  ├── AlpacaEval: GPT-4 evaluates instruction following  │
│  │   by win rate                                         │
│  ├── In-house: Custom criteria + LLM evaluator          │
│  ├── Pairwise: Compare two outputs and pick the better  │
│  └── Multi-Judge: Consensus evaluation by multiple LLMs │
│                                                          │
│  Human Evaluation (Gold Standard)                        │
│  ├── LMSYS Chatbot Arena: Blind A/B human voting        │
│  ├── Elo Rating: Calculated from match results          │
│  ├── Expert Review: Quality evaluation by domain experts│
│  └── Crowd Evaluation: Large-scale crowd evaluation     │
│                                                          │
│  Reliability: Human > LLM-as-a-Judge > Auto Benchmark   │
│  Cost:        Human > LLM-as-a-Judge > Auto Benchmark   │
└──────────────────────────────────────────────────────────┘
```

### 1.1 Evaluation Maturity Model

A framework for incrementally building an organization's LLM evaluation system.

```python
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional

class EvalMaturityLevel(IntEnum):
    """評価成熟度レベル"""
    LEVEL_1_AD_HOC = 1        # 場当たり的な目視確認
    LEVEL_2_STRUCTURED = 2    # 構造化された評価データセット
    LEVEL_3_AUTOMATED = 3     # CI/CD 統合の自動評価
    LEVEL_4_COMPREHENSIVE = 4 # 多面的評価 + 統計検定
    LEVEL_5_CONTINUOUS = 5    # 本番環境での継続的モニタリング

@dataclass
class EvalMaturityAssessment:
    """評価成熟度アセスメント"""
    organization: str
    dimensions: dict = field(default_factory=dict)

    def assess(self) -> dict:
        """各次元の成熟度を評価"""
        criteria = {
            "eval_dataset": {
                1: "評価データなし、手動で数例確認",
                2: "50問以上の評価セットあり、カテゴリ分類済み",
                3: "200問以上、難易度・カテゴリ別に体系化",
                4: "500問以上、定期的に更新、エッジケース網羅",
                5: "本番データから自動的に評価セットを生成・更新",
            },
            "evaluation_method": {
                1: "人間が目視で「良い/悪い」を判断",
                2: "ルーブリック定義済み、LLM-as-a-Judge 導入",
                3: "Pairwise 比較 + バイアス対策実施",
                4: "Multi-Judge + 統計的有意性検定",
                5: "A/B テスト + リアルタイムユーザー評価統合",
            },
            "automation": {
                1: "手動実行のみ",
                2: "スクリプト化されているが手動トリガー",
                3: "CI/CD パイプラインに統合、PR ごとに自動評価",
                4: "回帰テスト + パフォーマンス監視ダッシュボード",
                5: "本番トラフィックの自動評価 + アラート",
            },
            "metrics": {
                1: "スコアの平均値のみ",
                2: "カテゴリ別スコア + 失敗パターン分析",
                3: "信頼区間付きスコア + コスト分析",
                4: "多軸メトリクス + ドメイン固有指標",
                5: "ビジネス KPI と評価スコアの相関分析",
            },
        }

        results = {}
        for dim, levels in criteria.items():
            current = self.dimensions.get(dim, 1)
            results[dim] = {
                "current_level": current,
                "description": levels[current],
                "next_step": levels.get(current + 1, "最高レベル達成"),
            }

        overall = sum(d["current_level"] for d in results.values()) / len(results)
        return {
            "organization": self.organization,
            "overall_maturity": round(overall, 1),
            "dimensions": results,
        }

# 使用例
assessment = EvalMaturityAssessment(
    organization="TechCorp AI Team",
    dimensions={
        "eval_dataset": 3,
        "evaluation_method": 2,
        "automation": 3,
        "metrics": 2,
    },
)
report = assessment.assess()
print(f"総合成熟度: {report['overall_maturity']}/5.0")
for dim, info in report["dimensions"].items():
    print(f"  {dim}: Lv{info['current_level']} - {info['description']}")
    print(f"    次のステップ: {info['next_step']}")
```

---

## 2. Major Benchmarks in Detail

### 2.1 MMLU (Massive Multitask Language Understanding)

```python
# MMLU の構造
mmlu_structure = {
    "総問題数": 14042,
    "科目数": 57,
    "形式": "4択問題",
    "分野": {
        "STEM": ["数学", "物理", "化学", "CS", "工学"],
        "人文": ["歴史", "哲学", "法律"],
        "社会科学": ["経済", "政治", "心理学"],
        "その他": ["臨床医学", "会計", "マーケティング"],
    },
}

# MMLU の評価例
example = {
    "question": "光の速度に最も近い値はどれか？",
    "choices": [
        "A) 3×10^6 m/s",
        "B) 3×10^8 m/s",     # 正解
        "C) 3×10^10 m/s",
        "D) 3×10^12 m/s",
    ],
    "subject": "physics",
    "answer": "B",
}
```

#### MMLU-Pro: Next-Generation Knowledge Assessment

MMLU-Pro, designed as the successor to MMLU, increases the number of answer choices to 10 and requires deeper reasoning.

```python
@dataclass
class MMLUProEvaluator:
    """MMLU-Pro 評価の実装"""
    model_name: str
    few_shot_examples: int = 5

    def evaluate_question(self, question: dict) -> dict:
        """10択問題の評価"""
        prompt = self._build_prompt(question)
        response = self._call_model(prompt)
        predicted = self._extract_answer(response)

        return {
            "question_id": question["id"],
            "subject": question["subject"],
            "predicted": predicted,
            "correct": question["answer"],
            "is_correct": predicted == question["answer"],
            "reasoning_required": question.get("requires_reasoning", False),
        }

    def _build_prompt(self, question: dict) -> str:
        """Chain-of-Thought 形式のプロンプト構築"""
        prompt = "以下の問題に対して、ステップバイステップで考えてから回答してください。\n\n"
        prompt += f"問題: {question['question']}\n\n"

        for i, choice in enumerate(question["choices"]):
            label = chr(65 + i)  # A, B, C, ... J
            prompt += f"{label}) {choice}\n"

        prompt += "\n考え方:\n"
        return prompt

    def run_benchmark(self, dataset: list[dict]) -> dict:
        """ベンチマーク全体の実行"""
        results = [self.evaluate_question(q) for q in dataset]

        # 科目別の精度計算
        by_subject = {}
        for r in results:
            subj = r["subject"]
            if subj not in by_subject:
                by_subject[subj] = {"correct": 0, "total": 0}
            by_subject[subj]["total"] += 1
            if r["is_correct"]:
                by_subject[subj]["correct"] += 1

        subject_scores = {
            subj: data["correct"] / data["total"]
            for subj, data in by_subject.items()
        }

        overall = sum(r["is_correct"] for r in results) / len(results)

        return {
            "model": self.model_name,
            "overall_accuracy": overall,
            "subject_scores": subject_scores,
            "total_questions": len(results),
            "reasoning_accuracy": self._calc_reasoning_accuracy(results),
        }

    def _calc_reasoning_accuracy(self, results: list[dict]) -> float:
        """推論問題のみの精度"""
        reasoning = [r for r in results if r["reasoning_required"]]
        if not reasoning:
            return 0.0
        return sum(r["is_correct"] for r in reasoning) / len(reasoning)
```

### 2.2 HumanEval (Code Generation)

```python
# HumanEval の評価方式: pass@k
# k個のコード生成サンプルのうち1つでもテスト通過すれば正解

def evaluate_humaneval(model, problems, n_samples=10, k=1):
    """HumanEval の pass@k 評価"""
    results = []

    for problem in problems:
        completions = [model.generate(problem["prompt"]) for _ in range(n_samples)]

        # 各生成コードをテストケースで検証
        passed = sum(1 for code in completions
                     if run_tests(code, problem["tests"]))

        # pass@k の計算 (不偏推定量)
        import math
        if passed >= k:
            pass_at_k = 1.0 - math.comb(n_samples - passed, k) / math.comb(n_samples, k)
        else:
            pass_at_k = 0.0

        results.append(pass_at_k)

    return sum(results) / len(results)
```

#### SWE-bench: Real-World Software Engineering Evaluation

SWE-bench evaluates code fixing ability using real GitHub Issues and Pull Requests.

```python
@dataclass
class SWEBenchTask:
    """SWE-bench タスクの構造"""
    instance_id: str
    repo: str              # 例: "django/django"
    base_commit: str       # 修正前のコミット
    problem_statement: str # GitHub Issue の内容
    hints_text: str        # ヒント情報
    test_patch: str        # テストパッチ
    patch: str             # 正解パッチ

class SWEBenchEvaluator:
    """SWE-bench 評価の実装"""

    def __init__(self, model_name: str, max_tokens: int = 8192):
        self.model_name = model_name
        self.max_tokens = max_tokens

    def evaluate_task(self, task: SWEBenchTask) -> dict:
        """単一タスクの評価"""
        # 1. リポジトリのコンテキストを取得
        context = self._get_repo_context(task.repo, task.base_commit)

        # 2. モデルにパッチ生成を依頼
        prompt = self._build_swe_prompt(task, context)
        generated_patch = self._call_model(prompt)

        # 3. パッチを適用してテスト実行
        test_result = self._apply_and_test(
            repo=task.repo,
            base_commit=task.base_commit,
            patch=generated_patch,
            test_patch=task.test_patch,
        )

        return {
            "instance_id": task.instance_id,
            "resolved": test_result["all_tests_passed"],
            "tests_passed": test_result["passed"],
            "tests_failed": test_result["failed"],
            "patch_size": len(generated_patch),
        }

    def run_benchmark(self, tasks: list[SWEBenchTask]) -> dict:
        """ベンチマーク全体の実行と集計"""
        results = [self.evaluate_task(t) for t in tasks]

        resolved = sum(1 for r in results if r["resolved"])
        total = len(results)

        # リポジトリ別の解決率
        by_repo = {}
        for task, result in zip(tasks, results):
            repo = task.repo
            if repo not in by_repo:
                by_repo[repo] = {"resolved": 0, "total": 0}
            by_repo[repo]["total"] += 1
            if result["resolved"]:
                by_repo[repo]["resolved"] += 1

        return {
            "model": self.model_name,
            "overall_resolve_rate": resolved / total,
            "resolved": resolved,
            "total": total,
            "by_repo": {
                repo: data["resolved"] / data["total"]
                for repo, data in by_repo.items()
            },
        }
```

### 2.3 LMSYS Chatbot Arena

```
┌──────────────────────────────────────────────────────────┐
│          How LMSYS Chatbot Arena Works                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. User enters a prompt                                 │
│     │                                                    │
│  2. Two anonymous models respond simultaneously          │
│     ┌─────────┐    ┌─────────┐                          │
│     │ Model A │    │ Model B │  ← Model names hidden    │
│     │ (anon)  │    │ (anon)  │                          │
│     └────┬────┘    └────┬────┘                          │
│          │              │                                │
│  3. User votes: "A wins / B wins / Tie"                  │
│     │                                                    │
│  4. Elo rating is updated                                │
│     ├── Higher Elo = stronger model                      │
│     └── Cumulative votes: 2M+                            │
│                                                          │
│  Advantages:                                             │
│  - Not affected by benchmark contamination               │
│  - Based on real user experience                         │
│  - Continuously updated                                  │
│                                                          │
│  Limitations:                                            │
│  - English-centric                                       │
│  - Many short dialogues                                  │
│  - Thin coverage of specialized tasks                    │
└──────────────────────────────────────────────────────────┘
```

#### Elo Rating Calculation Implementation

```python
class EloRatingSystem:
    """Chatbot Arena 式の Elo レーティングシステム"""

    def __init__(self, k_factor: float = 32.0, initial_rating: float = 1000.0):
        self.k_factor = k_factor
        self.initial_rating = initial_rating
        self.ratings: dict[str, float] = {}
        self.match_history: list[dict] = []

    def get_rating(self, model: str) -> float:
        """モデルの現在のレーティングを取得"""
        return self.ratings.get(model, self.initial_rating)

    def expected_score(self, rating_a: float, rating_b: float) -> float:
        """期待勝率の計算"""
        return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400))

    def update(self, model_a: str, model_b: str, winner: str) -> dict:
        """対戦結果に基づくレーティング更新

        Args:
            model_a: モデルA の名前
            model_b: モデルB の名前
            winner: "a", "b", or "tie"
        """
        ra = self.get_rating(model_a)
        rb = self.get_rating(model_b)

        ea = self.expected_score(ra, rb)
        eb = self.expected_score(rb, ra)

        # 実際のスコア
        if winner == "a":
            sa, sb = 1.0, 0.0
        elif winner == "b":
            sa, sb = 0.0, 1.0
        else:  # tie
            sa, sb = 0.5, 0.5

        # レーティング更新
        new_ra = ra + self.k_factor * (sa - ea)
        new_rb = rb + self.k_factor * (sb - eb)

        self.ratings[model_a] = new_ra
        self.ratings[model_b] = new_rb

        match = {
            "model_a": model_a,
            "model_b": model_b,
            "winner": winner,
            "rating_change_a": new_ra - ra,
            "rating_change_b": new_rb - rb,
        }
        self.match_history.append(match)
        return match

    def leaderboard(self) -> list[dict]:
        """レーティング順のリーダーボード"""
        sorted_models = sorted(
            self.ratings.items(), key=lambda x: x[1], reverse=True
        )
        return [
            {
                "rank": i + 1,
                "model": model,
                "rating": round(rating, 1),
                "matches": sum(
                    1 for m in self.match_history
                    if m["model_a"] == model or m["model_b"] == model
                ),
            }
            for i, (model, rating) in enumerate(sorted_models)
        ]

    def bootstrap_confidence_interval(
        self, model: str, n_bootstrap: int = 1000, confidence: float = 0.95
    ) -> tuple[float, float]:
        """Bootstrap 法によるレーティングの信頼区間"""
        import random

        model_matches = [
            m for m in self.match_history
            if m["model_a"] == model or m["model_b"] == model
        ]

        bootstrap_ratings = []
        for _ in range(n_bootstrap):
            # リサンプリング
            sample = random.choices(model_matches, k=len(model_matches))
            temp_system = EloRatingSystem(self.k_factor, self.initial_rating)
            for match in sample:
                temp_system.update(match["model_a"], match["model_b"], match["winner"])
            bootstrap_ratings.append(temp_system.get_rating(model))

        bootstrap_ratings.sort()
        alpha = (1 - confidence) / 2
        lower = bootstrap_ratings[int(n_bootstrap * alpha)]
        upper = bootstrap_ratings[int(n_bootstrap * (1 - alpha))]
        return (round(lower, 1), round(upper, 1))

# 使用例
elo = EloRatingSystem()
elo.update("GPT-4o", "Claude-3.5-Sonnet", "b")
elo.update("GPT-4o", "Gemini-1.5-Pro", "a")
elo.update("Claude-3.5-Sonnet", "Gemini-1.5-Pro", "a")

for entry in elo.leaderboard():
    print(f"#{entry['rank']} {entry['model']}: {entry['rating']} ({entry['matches']} matches)")
```

### 2.4 GPQA (Graduate-Level Google-Proof QA)

A benchmark testing graduate-level specialized knowledge. It consists of questions that are difficult to answer correctly even with search engines.

```python
gpqa_overview = {
    "名称": "GPQA (Graduate-Level Google-Proof QA)",
    "問題数": 448,
    "分野": ["物理学", "化学", "生物学"],
    "難易度": "大学院博士レベル",
    "特徴": [
        "ドメイン専門家の正答率: ~65%",
        "非専門家の正答率: ~34%",
        "Google検索を許可しても非専門家は正答困難",
    ],
    "形式": "4択問題 (MMLU と同形式)",
    "サブセット": {
        "GPQA_diamond": "最高難度 198問 (専門家間一致率が高い問題のみ)",
        "GPQA_extended": "全448問",
    },
}
```

### 2.5 IFEval (Instruction Following Evaluation)

A benchmark that rigorously evaluates instruction-following capability.

```python
@dataclass
class IFEvalTask:
    """IFEval タスクの構造"""
    prompt: str
    constraints: list[dict]  # 検証可能な制約条件

# IFEval の制約タイプ例
ifeval_constraint_types = {
    "length": {
        "description": "出力の長さ制約",
        "examples": [
            {"type": "min_words", "value": 100, "check": "単語数が100以上か"},
            {"type": "max_sentences", "value": 5, "check": "文の数が5以下か"},
            {"type": "num_paragraphs", "value": 3, "check": "段落数がちょうど3か"},
        ],
    },
    "format": {
        "description": "出力フォーマット制約",
        "examples": [
            {"type": "json_format", "check": "有効な JSON か"},
            {"type": "bullet_points", "check": "箇条書き形式か"},
            {"type": "title_case", "check": "タイトルケースか"},
        ],
    },
    "content": {
        "description": "内容に関する制約",
        "examples": [
            {"type": "include_keyword", "value": "AI", "check": "キーワードを含むか"},
            {"type": "exclude_word", "value": "however", "check": "特定の単語を含まないか"},
            {"type": "language", "value": "Japanese", "check": "指定言語で書かれているか"},
        ],
    },
}

class IFEvalEvaluator:
    """IFEval 自動評価器"""

    def check_constraint(self, output: str, constraint: dict) -> bool:
        """制約条件のチェック"""
        ctype = constraint["type"]

        if ctype == "min_words":
            return len(output.split()) >= constraint["value"]
        elif ctype == "max_sentences":
            sentences = [s.strip() for s in output.split(".") if s.strip()]
            return len(sentences) <= constraint["value"]
        elif ctype == "num_paragraphs":
            paragraphs = [p.strip() for p in output.split("\n\n") if p.strip()]
            return len(paragraphs) == constraint["value"]
        elif ctype == "json_format":
            try:
                import json
                json.loads(output)
                return True
            except json.JSONDecodeError:
                return False
        elif ctype == "include_keyword":
            return constraint["value"].lower() in output.lower()
        elif ctype == "exclude_word":
            return constraint["value"].lower() not in output.lower()
        else:
            return True  # 未知の制約はパス

    def evaluate(self, tasks: list[IFEvalTask], model_outputs: list[str]) -> dict:
        """IFEval 全体の評価"""
        prompt_level_pass = 0
        instruction_level_pass = 0
        total_instructions = 0

        for task, output in zip(tasks, model_outputs):
            all_passed = True
            for constraint in task.constraints:
                total_instructions += 1
                passed = self.check_constraint(output, constraint)
                if passed:
                    instruction_level_pass += 1
                else:
                    all_passed = False

            if all_passed:
                prompt_level_pass += 1

        return {
            "prompt_level_accuracy": prompt_level_pass / len(tasks),
            "instruction_level_accuracy": instruction_level_pass / total_instructions,
            "total_prompts": len(tasks),
            "total_instructions": total_instructions,
        }
```

---

## 3. Implementing LLM-as-a-Judge

### 3.1 Basic LLM Evaluation

```python
from openai import OpenAI
import json

client = OpenAI()

def llm_judge(question: str, answer: str, criteria: str) -> dict:
    """LLM を評価者として使用"""
    prompt = f"""
以下の質問に対する回答を評価してください。

<question>
{question}
</question>

<answer>
{answer}
</answer>

<evaluation_criteria>
{criteria}
</evaluation_criteria>

以下の形式で評価を出力してください:
- スコア: 1-5 の整数 (5が最高)
- 理由: 評価の根拠を2-3文で

JSON形式で出力:
{{"score": <int>, "reason": "<string>"}}
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,  # 再現性のため
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)

# 使用例
result = llm_judge(
    question="Pythonのデコレータを説明してください",
    answer="デコレータは関数を修飾する構文糖です...",
    criteria="""
    1. 技術的正確性 (誤りがないか)
    2. 分かりやすさ (初学者が理解できるか)
    3. 具体例の有無 (コード例が含まれているか)
    4. 完全性 (重要な概念が網羅されているか)
    """,
)
print(f"スコア: {result['score']}/5")
print(f"理由: {result['reason']}")
```

### 3.2 Pairwise Comparison

```python
def pairwise_judge(question: str, answer_a: str, answer_b: str) -> dict:
    """2つの回答を比較評価 (バイアス軽減版)"""
    # 順序バイアス軽減: A/B の順番を入れ替えて2回評価
    results = []

    for swap in [False, True]:
        first = answer_b if swap else answer_a
        second = answer_a if swap else answer_b

        prompt = f"""
以下の質問に対する2つの回答を比較し、どちらが優れているか判定してください。

質問: {question}

回答1:
{first}

回答2:
{second}

以下の基準で評価:
- 正確性、有用性、明確性、完全性

判定: "回答1が優れている"、"回答2が優れている"、"同等" のいずれかを選び、
理由を述べてください。

JSON: {{"winner": "1" | "2" | "tie", "reason": "<string>"}}
"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)

        # 入れ替えた場合は結果を反転
        if swap:
            if result["winner"] == "1":
                result["winner"] = "2"
            elif result["winner"] == "2":
                result["winner"] = "1"

        results.append(result)

    # 2回の結果が一致するか確認
    if results[0]["winner"] == results[1]["winner"]:
        return {"winner": results[0]["winner"], "confidence": "high",
                "reason": results[0]["reason"]}
    else:
        return {"winner": "tie", "confidence": "low",
                "reason": "順序入替で結果が変わったため判定困難"}
```

### 3.3 Multi-Judge Consensus Evaluation

Multiple LLMs are used as evaluators, and a final verdict is reached by consensus.

```python
from collections import Counter
from typing import Callable

class MultiJudgeEvaluator:
    """複数 LLM による合議制評価"""

    def __init__(self, judges: list[dict]):
        """
        Args:
            judges: [{"name": "gpt-4o", "weight": 1.0, "call_fn": callable}, ...]
        """
        self.judges = judges

    def evaluate(self, question: str, answer: str, criteria: str) -> dict:
        """複数評価者による評価"""
        evaluations = []

        for judge in self.judges:
            try:
                result = judge"call_fn"
                evaluations.append({
                    "judge": judge["name"],
                    "score": result["score"],
                    "reason": result["reason"],
                    "weight": judge["weight"],
                })
            except Exception as e:
                evaluations.append({
                    "judge": judge["name"],
                    "score": None,
                    "reason": f"Error: {str(e)}",
                    "weight": 0,
                })

        # 有効な評価のみで集計
        valid = [e for e in evaluations if e["score"] is not None]
        if not valid:
            return {"error": "全評価者がエラーを返した"}

        # 加重平均スコア
        weighted_sum = sum(e["score"] * e["weight"] for e in valid)
        weight_total = sum(e["weight"] for e in valid)
        avg_score = weighted_sum / weight_total

        # 評価者間の一致度 (Krippendorff's alpha の簡易版)
        scores = [e["score"] for e in valid]
        agreement = self._calc_agreement(scores)

        return {
            "final_score": round(avg_score, 2),
            "agreement": round(agreement, 3),
            "individual_scores": {e["judge"]: e["score"] for e in valid},
            "confidence": "high" if agreement > 0.7 else "medium" if agreement > 0.4 else "low",
            "reasons": {e["judge"]: e["reason"] for e in valid},
        }

    def _calc_agreement(self, scores: list[int]) -> float:
        """評価者間一致度の計算 (簡易版)"""
        if len(scores) < 2:
            return 1.0
        # スコア範囲に対する標準偏差の比率で一致度を近似
        import statistics
        if len(set(scores)) == 1:
            return 1.0
        std = statistics.stdev(scores)
        max_std = 2.0  # 1-5スケールの最大標準偏差
        return max(0, 1 - std / max_std)

    def pairwise_multi_judge(
        self, question: str, answer_a: str, answer_b: str
    ) -> dict:
        """複数評価者による Pairwise 比較"""
        votes = {"a": 0, "b": 0, "tie": 0}

        for judge in self.judges:
            result = pairwise_judge(question, answer_a, answer_b)
            winner = result["winner"]
            if winner == "1":
                votes["a"] += judge["weight"]
            elif winner == "2":
                votes["b"] += judge["weight"]
            else:
                votes["tie"] += judge["weight"]

        total = sum(votes.values())
        if votes["a"] / total > 0.5:
            final_winner = "a"
        elif votes["b"] / total > 0.5:
            final_winner = "b"
        else:
            final_winner = "tie"

        return {
            "winner": final_winner,
            "vote_distribution": {k: round(v / total, 2) for k, v in votes.items()},
            "num_judges": len(self.judges),
        }
```

### 3.4 Best Practices for Rubric Definition

```python
class RubricBuilder:
    """評価ルーブリックの体系的な構築"""

    @staticmethod
    def create_rubric(task_type: str) -> dict:
        """タスクタイプに応じたルーブリック生成"""
        rubrics = {
            "summarization": {
                "dimensions": {
                    "faithfulness": {
                        "weight": 0.35,
                        "description": "原文に忠実か",
                        "scale": {
                            5: "原文の全ての主要事実を正確に反映",
                            4: "主要事実は正確だが、一部のニュアンスが欠落",
                            3: "概ね正確だが、軽微な事実誤認が1箇所",
                            2: "複数の事実が不正確または歪曲されている",
                            1: "原文の内容と大きく乖離",
                        },
                    },
                    "coverage": {
                        "weight": 0.25,
                        "description": "重要な情報を網羅しているか",
                        "scale": {
                            5: "全ての重要ポイントをカバー",
                            4: "ほぼ全ての重要ポイントをカバー",
                            3: "主要ポイントの半分以上をカバー",
                            2: "重要なポイントの多くが欠落",
                            1: "ほとんどの重要ポイントが欠落",
                        },
                    },
                    "conciseness": {
                        "weight": 0.20,
                        "description": "簡潔にまとまっているか",
                        "scale": {
                            5: "無駄なく最適な長さ",
                            4: "わずかな冗長性はあるが簡潔",
                            3: "やや冗長だが許容範囲",
                            2: "不必要な情報が多い",
                            1: "非常に冗長で主旨が不明瞭",
                        },
                    },
                    "coherence": {
                        "weight": 0.20,
                        "description": "論理的に一貫しているか",
                        "scale": {
                            5: "完全に論理的で読みやすい",
                            4: "概ね論理的だが接続が弱い箇所がある",
                            3: "部分的に論理の飛躍がある",
                            2: "構成が不明瞭",
                            1: "支離滅裂",
                        },
                    },
                },
            },
            "code_generation": {
                "dimensions": {
                    "correctness": {
                        "weight": 0.40,
                        "description": "コードが正しく動作するか",
                        "scale": {
                            5: "全てのテストケースをパスし、エッジケースも処理",
                            4: "主要なテストケースをパス",
                            3: "基本ケースは動作するがエッジケースで失敗",
                            2: "部分的にしか動作しない",
                            1: "全く動作しない、構文エラーあり",
                        },
                    },
                    "efficiency": {
                        "weight": 0.20,
                        "description": "計算効率が適切か",
                        "scale": {
                            5: "最適なアルゴリズムと時間・空間計算量",
                            4: "効率的だがわずかな改善の余地あり",
                            3: "動作するが非効率な部分がある",
                            2: "明らかに非効率",
                            1: "実用に耐えない計算量",
                        },
                    },
                    "readability": {
                        "weight": 0.20,
                        "description": "コードが読みやすいか",
                        "scale": {
                            5: "明確な命名、適切なコメント、良い構造",
                            4: "概ね読みやすい",
                            3: "読めるが改善の余地がある",
                            2: "読みにくい部分が多い",
                            1: "ほぼ理解不能",
                        },
                    },
                    "best_practices": {
                        "weight": 0.20,
                        "description": "言語のベストプラクティスに従っているか",
                        "scale": {
                            5: "イディオマティックで型安全、エラーハンドリング完備",
                            4: "概ねベストプラクティスに沿っている",
                            3: "基本的な慣例は守られている",
                            2: "アンチパターンが含まれる",
                            1: "ベストプラクティスを無視",
                        },
                    },
                },
            },
        }
        return rubrics.get(task_type, {})

    @staticmethod
    def score_with_rubric(rubric: dict, dimension_scores: dict[str, int]) -> float:
        """ルーブリックに基づく加重スコア計算"""
        total = 0.0
        for dim_name, dim_info in rubric["dimensions"].items():
            score = dimension_scores.get(dim_name, 3)
            total += score * dim_info["weight"]
        return round(total, 2)
```

---

## 4. Building an Evaluation Pipeline

### 4.1 Creating an In-House Task Evaluation Dataset

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class EvalCase:
    """評価ケース"""
    id: str
    category: str
    input_text: str
    reference_answer: Optional[str]  # 正解 (あれば)
    evaluation_criteria: str
    difficulty: str  # easy / medium / hard
    tags: list[str] = None  # メタデータタグ
    expected_constraints: dict = None  # 期待される制約条件

# 評価データセットの例
eval_dataset = [
    EvalCase(
        id="sum-001",
        category="summarization",
        input_text="[長い技術文書]",
        reference_answer="[理想的な要約]",
        evaluation_criteria="正確性、網羅性、簡潔性",
        difficulty="medium",
        tags=["technical", "japanese"],
    ),
    EvalCase(
        id="code-001",
        category="code_generation",
        input_text="二分探索を実装してください",
        reference_answer="def binary_search(arr, target): ...",
        evaluation_criteria="正確性、効率性、可読性",
        difficulty="easy",
        tags=["python", "algorithm"],
    ),
    # 50-100ケース推奨
]
```

### 4.2 Automated Evaluation Pipeline

```python
import asyncio
from datetime import datetime

async def run_evaluation(
    models: list[str],
    eval_dataset: list[EvalCase],
    judge_model: str = "gpt-4o",
) -> dict:
    """複数モデルの一括評価"""
    results = {}

    for model in models:
        model_results = []

        for case in eval_dataset:
            # モデルの回答を生成
            answer = await generate(model, case.input_text)

            # LLM-as-a-Judge で評価
            evaluation = await llm_judge(
                question=case.input_text,
                answer=answer,
                criteria=case.evaluation_criteria,
            )

            model_results.append({
                "case_id": case.id,
                "category": case.category,
                "score": evaluation["score"],
                "reason": evaluation["reason"],
            })

        # カテゴリ別集計
        results[model] = {
            "overall": sum(r["score"] for r in model_results) / len(model_results),
            "by_category": aggregate_by_category(model_results),
            "details": model_results,
        }

    return results

def print_leaderboard(results: dict):
    """評価結果のリーダーボード表示"""
    sorted_models = sorted(results.items(), key=lambda x: x[1]["overall"], reverse=True)

    print(f"{'モデル':30s} {'総合':>6s} {'要約':>6s} {'コード':>6s} {'QA':>6s}")
    print("-" * 60)
    for model, data in sorted_models:
        cats = data["by_category"]
        print(f"{model:30s} "
              f"{data['overall']:>6.2f} "
              f"{cats.get('summarization', 0):>6.2f} "
              f"{cats.get('code_generation', 0):>6.2f} "
              f"{cats.get('qa', 0):>6.2f}")
```

### 4.3 RAGAS (RAG Evaluation)

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,       # 回答がコンテキストに忠実か
    answer_relevancy,   # 回答が質問に関連しているか
    context_precision,  # 検索結果に正解が含まれるか
    context_recall,     # 必要な情報が検索できたか
)

# 評価データの準備
eval_data = {
    "question": ["RAGとは何ですか？", ...],
    "answer": ["RAGは検索拡張生成の略で...", ...],
    "contexts": [["RAGはRetrieval-Augmented..."], ...],
    "ground_truth": ["RAGは外部知識ベースから...", ...],
}

results = evaluate(
    dataset=eval_data,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
)

print(results)
# {faithfulness: 0.85, answer_relevancy: 0.92, context_precision: 0.78, ...}
```

### 4.4 CI/CD-Integrated Evaluation Pipeline

```python
import subprocess
import json
from pathlib import Path
from datetime import datetime

class CIEvalPipeline:
    """CI/CD に統合する評価パイプライン"""

    def __init__(
        self,
        eval_dataset_path: str,
        baseline_path: str,
        output_dir: str = "./eval_results",
    ):
        self.eval_dataset = self._load_dataset(eval_dataset_path)
        self.baseline = self._load_baseline(baseline_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _load_dataset(self, path: str) -> list[EvalCase]:
        """評価データセットの読み込み"""
        with open(path) as f:
            data = json.load(f)
        return [EvalCase(**item) for item in data]

    def _load_baseline(self, path: str) -> dict:
        """ベースラインスコアの読み込み"""
        with open(path) as f:
            return json.load(f)

    def run_regression_test(self, model: str, prompt_template: str) -> dict:
        """回帰テストの実行"""
        results = []

        for case in self.eval_dataset:
            prompt = prompt_template.format(input=case.input_text)
            answer = self._call_model(model, prompt)
            score = self._evaluate(case, answer)
            results.append({
                "case_id": case.id,
                "category": case.category,
                "score": score,
            })

        # ベースラインとの比較
        current_scores = self._aggregate(results)
        regression_report = self._check_regression(current_scores)

        # 結果の保存
        report = {
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "current_scores": current_scores,
            "baseline_scores": self.baseline,
            "regression_detected": regression_report["has_regression"],
            "details": regression_report,
        }

        report_path = self.output_dir / f"eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return report

    def _check_regression(self, current: dict) -> dict:
        """回帰の検出"""
        regressions = []
        threshold = 0.05  # 5% 以上の低下で回帰とみなす

        for category, score in current.items():
            baseline_score = self.baseline.get(category, 0)
            if baseline_score > 0:
                drop = (baseline_score - score) / baseline_score
                if drop > threshold:
                    regressions.append({
                        "category": category,
                        "baseline": baseline_score,
                        "current": score,
                        "drop_pct": round(drop * 100, 1),
                    })

        return {
            "has_regression": len(regressions) > 0,
            "regressions": regressions,
            "summary": f"{len(regressions)} カテゴリで回帰検出" if regressions else "回帰なし",
        }

    def generate_github_comment(self, report: dict) -> str:
        """GitHub PR コメント用のレポート生成"""
        lines = ["## LLM 評価レポート\n"]

        if report["regression_detected"]:
            lines.append("### :warning: 回帰が検出されました\n")
            for reg in report["details"]["regressions"]:
                lines.append(
                    f"- **{reg['category']}**: {reg['baseline']:.2f} -> "
                    f"{reg['current']:.2f} ({reg['drop_pct']}% 低下)"
                )
        else:
            lines.append("### 全カテゴリでベースライン以上のスコア\n")

        lines.append("\n### スコア詳細\n")
        lines.append("| カテゴリ | ベースライン | 今回 | 差分 |")
        lines.append("|---------|------------|------|------|")
        for cat, score in report["current_scores"].items():
            baseline = report["baseline_scores"].get(cat, 0)
            diff = score - baseline
            sign = "+" if diff >= 0 else ""
            lines.append(f"| {cat} | {baseline:.2f} | {score:.2f} | {sign}{diff:.2f} |")

        return "\n".join(lines)
```

---

## 5. Statistical Significance Testing

### 5.1 McNemar Test

Tests whether the performance difference between two models is statistically significant.

```python
import numpy as np
from scipy import stats

class McNemarTest:
    """McNemar 検定による有意差検定"""

    @staticmethod
    def test(model_a_correct: list[bool], model_b_correct: list[bool]) -> dict:
        """
        McNemar 検定の実行

        Args:
            model_a_correct: モデルA の各問題の正誤 (True/False)
            model_b_correct: モデルB の各問題の正誤 (True/False)

        Returns:
            検定結果
        """
        assert len(model_a_correct) == len(model_b_correct)
        n = len(model_a_correct)

        # 分割表の作成
        # b: A正解 & B不正解, c: A不正解 & B正解
        b = sum(1 for a, bv in zip(model_a_correct, model_b_correct) if a and not bv)
        c = sum(1 for a, bv in zip(model_a_correct, model_b_correct) if not a and bv)

        # McNemar 検定統計量 (連続性補正あり)
        if b + c == 0:
            return {
                "statistic": 0,
                "p_value": 1.0,
                "significant": False,
                "interpretation": "両モデルの性能に差がない",
            }

        chi2 = (abs(b - c) - 1) ** 2 / (b + c)
        p_value = 1 - stats.chi2.cdf(chi2, df=1)

        # 効果量 (オッズ比)
        odds_ratio = b / c if c > 0 else float("inf")

        return {
            "statistic": round(chi2, 4),
            "p_value": round(p_value, 6),
            "significant": p_value < 0.05,
            "b_count": b,
            "c_count": c,
            "odds_ratio": round(odds_ratio, 3),
            "interpretation": (
                f"モデルA がモデルB より有意に優れている (p={p_value:.4f})"
                if p_value < 0.05 and b > c
                else f"モデルB がモデルA より有意に優れている (p={p_value:.4f})"
                if p_value < 0.05 and c > b
                else f"有意差なし (p={p_value:.4f})"
            ),
            "sample_size": n,
        }

# 使用例
test = McNemarTest()
np.random.seed(42)
a_correct = [True] * 80 + [False] * 20  # モデルA: 80%正解
b_correct = [True] * 70 + [False] * 30  # モデルB: 70%正解
np.random.shuffle(a_correct)
np.random.shuffle(b_correct)

result = test.test(a_correct, b_correct)
print(f"p値: {result['p_value']}")
print(f"有意差: {'あり' if result['significant'] else 'なし'}")
print(f"解釈: {result['interpretation']}")
```

### 5.2 Confidence Intervals via Bootstrap

```python
class BootstrapEvaluation:
    """Bootstrap 法による評価スコアの信頼区間推定"""

    @staticmethod
    def confidence_interval(
        scores: list[float],
        n_bootstrap: int = 10000,
        confidence: float = 0.95,
        metric_fn=None,
    ) -> dict:
        """
        Bootstrap 信頼区間の計算

        Args:
            scores: 評価スコアのリスト
            n_bootstrap: リサンプリング回数
            confidence: 信頼水準
            metric_fn: 集計関数 (デフォルト: 平均)
        """
        import random

        if metric_fn is None:
            metric_fn = lambda x: sum(x) / len(x)

        original_metric = metric_fn(scores)

        # Bootstrap リサンプリング
        bootstrap_metrics = []
        for _ in range(n_bootstrap):
            sample = random.choices(scores, k=len(scores))
            bootstrap_metrics.append(metric_fn(sample))

        bootstrap_metrics.sort()

        # 信頼区間
        alpha = (1 - confidence) / 2
        lower_idx = int(n_bootstrap * alpha)
        upper_idx = int(n_bootstrap * (1 - alpha))

        lower = bootstrap_metrics[lower_idx]
        upper = bootstrap_metrics[upper_idx]

        # 標準誤差
        std_error = np.std(bootstrap_metrics)

        return {
            "point_estimate": round(original_metric, 4),
            "ci_lower": round(lower, 4),
            "ci_upper": round(upper, 4),
            "confidence_level": confidence,
            "std_error": round(std_error, 4),
            "n_bootstrap": n_bootstrap,
            "sample_size": len(scores),
        }

    @staticmethod
    def compare_models(
        scores_a: list[float],
        scores_b: list[float],
        n_bootstrap: int = 10000,
    ) -> dict:
        """2モデルの差の信頼区間"""
        import random

        diffs = []
        for _ in range(n_bootstrap):
            sample_a = random.choices(scores_a, k=len(scores_a))
            sample_b = random.choices(scores_b, k=len(scores_b))
            mean_a = sum(sample_a) / len(sample_a)
            mean_b = sum(sample_b) / len(sample_b)
            diffs.append(mean_a - mean_b)

        diffs.sort()
        lower = diffs[int(n_bootstrap * 0.025)]
        upper = diffs[int(n_bootstrap * 0.975)]

        # 差が0を含まなければ有意差あり
        significant = not (lower <= 0 <= upper)

        return {
            "mean_diff": round(np.mean(diffs), 4),
            "ci_lower": round(lower, 4),
            "ci_upper": round(upper, 4),
            "significant": significant,
            "interpretation": (
                f"モデルA がモデルB より有意に優れている (差: {np.mean(diffs):.3f})"
                if significant and np.mean(diffs) > 0
                else f"モデルB がモデルA より有意に優れている (差: {abs(np.mean(diffs)):.3f})"
                if significant
                else "有意差なし"
            ),
        }

# 使用例
bootstrap = BootstrapEvaluation()

model_a_scores = [4.2, 3.8, 4.5, 3.9, 4.1, 4.3, 3.7, 4.0, 4.4, 3.6]
model_b_scores = [3.5, 3.2, 3.8, 3.4, 3.6, 3.3, 3.1, 3.7, 3.9, 3.0]

ci_a = bootstrap.confidence_interval(model_a_scores)
print(f"モデルA: {ci_a['point_estimate']} [{ci_a['ci_lower']}, {ci_a['ci_upper']}]")

comparison = bootstrap.compare_models(model_a_scores, model_b_scores)
print(f"差: {comparison['mean_diff']} [{comparison['ci_lower']}, {comparison['ci_upper']}]")
print(f"有意差: {'あり' if comparison['significant'] else 'なし'}")
```

---

## 6. Evaluation Biases and Countermeasures

```
┌──────────────────────────────────────────────────────────┐
│          Known Biases in LLM-as-a-Judge                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Position Bias                                        │
│     → Tendency to favor the answer presented first      │
│     Countermeasure: Evaluate twice by swapping A/B order,│
│     then take the majority vote                          │
│                                                          │
│  2. Verbosity Bias                                       │
│     → Tendency to judge longer answers as "better"      │
│     Countermeasure: Explicitly include "conciseness" in  │
│     the evaluation criteria                              │
│                                                          │
│  3. Self-Enhancement Bias                                │
│     → GPT-4 tends to favor GPT-4 outputs               │
│     Countermeasure: Use a different model (Claude) as    │
│     the evaluator                                        │
│                                                          │
│  4. Capability Bias                                      │
│     → Specialized domains beyond the evaluator's ability │
│     Countermeasure: Supplement with human evaluation by  │
│     domain experts                                       │
│                                                          │
│  5. Style Bias                                           │
│     → Tendency to over-prefer Markdown or bullet points  │
│     Countermeasure: Explicit instruction to evaluate     │
│     content only                                         │
│                                                          │
│  6. Sycophancy Bias                                      │
│     → Tendency to agree with the user's opinions        │
│     Countermeasure: Use a neutral evaluation prompt that  │
│     contains no opinions                                 │
└──────────────────────────────────────────────────────────┘
```

### 6.1 Bias Detection and Quantification Framework

```python
class BiasDetector:
    """LLM-as-a-Judge のバイアスを検出・定量化"""

    def __init__(self, judge_fn):
        self.judge_fn = judge_fn

    def detect_position_bias(
        self, question: str, answer_a: str, answer_b: str, n_trials: int = 20
    ) -> dict:
        """順序バイアスの検出"""
        ab_wins = {"a": 0, "b": 0, "tie": 0}
        ba_wins = {"a": 0, "b": 0, "tie": 0}

        for _ in range(n_trials):
            # A が先の場合
            result_ab = self.judge_fn(question, answer_a, answer_b)
            winner_ab = result_ab.get("winner", "tie")
            if winner_ab == "1":
                ab_wins["a"] += 1
            elif winner_ab == "2":
                ab_wins["b"] += 1
            else:
                ab_wins["tie"] += 1

            # B が先の場合
            result_ba = self.judge_fn(question, answer_b, answer_a)
            winner_ba = result_ba.get("winner", "tie")
            if winner_ba == "1":
                ba_wins["b"] += 1  # B が先で 1 が勝ち = B の勝ち
            elif winner_ba == "2":
                ba_wins["a"] += 1
            else:
                ba_wins["tie"] += 1

        # 一貫性の計算
        total = n_trials * 2
        a_total = ab_wins["a"] + ba_wins["a"]
        b_total = ab_wins["b"] + ba_wins["b"]
        first_position_wins = ab_wins["a"] + ba_wins["b"]  # 先の回答が勝つ回数

        position_bias_rate = first_position_wins / total

        return {
            "position_bias_rate": round(position_bias_rate, 3),
            "has_position_bias": abs(position_bias_rate - 0.5) > 0.15,
            "first_position_advantage": round(position_bias_rate - 0.5, 3),
            "consistency": round(1 - abs(a_total - b_total) / total, 3),
            "details": {"ab_order": ab_wins, "ba_order": ba_wins},
        }

    def detect_verbosity_bias(
        self, question: str, concise_answer: str, verbose_answer: str
    ) -> dict:
        """冗長性バイアスの検出"""
        # 同じ情報量で長さだけ異なる回答を比較
        result_cv = self.judge_fn(question, concise_answer, verbose_answer)
        result_vc = self.judge_fn(question, verbose_answer, concise_answer)

        prefers_verbose = 0
        if result_cv.get("winner") == "2":
            prefers_verbose += 1
        if result_vc.get("winner") == "1":
            prefers_verbose += 1

        return {
            "verbosity_bias_detected": prefers_verbose >= 2,
            "verbose_preference_rate": prefers_verbose / 2,
            "concise_len": len(concise_answer),
            "verbose_len": len(verbose_answer),
            "length_ratio": round(len(verbose_answer) / max(len(concise_answer), 1), 2),
        }
```

---

## 7. Domain-Specific Evaluation

### 7.1 Medical AI Evaluation

```python
class MedicalAIEvaluator:
    """医療 AI の専門評価"""

    def __init__(self):
        self.safety_criteria = {
            "hallucination_check": {
                "weight": 0.30,
                "description": "医学的に存在しない情報の捏造がないか",
            },
            "dosage_accuracy": {
                "weight": 0.25,
                "description": "薬用量の情報が正確か",
            },
            "contraindication_check": {
                "weight": 0.20,
                "description": "禁忌事項が適切に言及されているか",
            },
            "evidence_level": {
                "weight": 0.15,
                "description": "エビデンスレベルが明示されているか",
            },
            "disclaimer": {
                "weight": 0.10,
                "description": "医師への相談を促す免責事項があるか",
            },
        }

    def evaluate_medical_response(self, question: str, response: str) -> dict:
        """医療応答の評価"""
        scores = {}

        # 1. ハルシネーションチェック
        scores["hallucination_check"] = self._check_hallucination(response)

        # 2. 薬用量の正確性チェック
        scores["dosage_accuracy"] = self._check_dosage(response)

        # 3. 禁忌チェック
        scores["contraindication_check"] = self._check_contraindication(question, response)

        # 4. エビデンスレベル
        scores["evidence_level"] = self._check_evidence(response)

        # 5. 免責事項
        scores["disclaimer"] = self._check_disclaimer(response)

        # 加重スコア
        total = sum(
            scores[k] * self.safety_criteria[k]["weight"]
            for k in scores
        )

        # 安全性判定
        is_safe = all(
            scores[k] >= 3
            for k in ["hallucination_check", "dosage_accuracy"]
        )

        return {
            "total_score": round(total, 2),
            "dimension_scores": scores,
            "is_safe": is_safe,
            "safety_concerns": [
                k for k, v in scores.items()
                if v < 3 and self.safety_criteria[k]["weight"] >= 0.2
            ],
        }

    def _check_disclaimer(self, response: str) -> int:
        """免責事項の確認"""
        disclaimer_keywords = [
            "医師に相談", "専門家に相談", "医療機関",
            "自己判断", "あくまで参考", "正確な診断",
        ]
        found = sum(1 for kw in disclaimer_keywords if kw in response)
        if found >= 2:
            return 5
        elif found == 1:
            return 3
        else:
            return 1
```

### 7.2 Legal AI Evaluation

```python
class LegalAIEvaluator:
    """法律 AI の専門評価"""

    def evaluate_legal_response(self, question: str, response: str, jurisdiction: str = "日本") -> dict:
        """法律応答の評価"""
        criteria = {
            "legal_accuracy": {
                "weight": 0.30,
                "check": self._check_legal_accuracy,
                "description": "法令・判例の引用が正確か",
            },
            "jurisdiction_awareness": {
                "weight": 0.20,
                "check": self._check_jurisdiction,
                "description": "管轄法域が明示されているか",
            },
            "recency": {
                "weight": 0.15,
                "check": self._check_recency,
                "description": "最新の法改正を反映しているか",
            },
            "nuance": {
                "weight": 0.15,
                "check": self._check_nuance,
                "description": "法的なニュアンスが適切か (断定的すぎないか)",
            },
            "actionability": {
                "weight": 0.10,
                "check": self._check_actionability,
                "description": "実務的に役立つ情報が含まれているか",
            },
            "disclaimer": {
                "weight": 0.10,
                "check": self._check_legal_disclaimer,
                "description": "弁護士への相談を促す文言があるか",
            },
        }

        scores = {}
        for name, spec in criteria.items():
            scores[name] = spec"check"

        total = sum(
            scores[k] * criteria[k]["weight"]
            for k in scores
        )

        return {
            "total_score": round(total, 2),
            "dimension_scores": scores,
            "risk_level": "high" if total < 2.5 else "medium" if total < 3.5 else "low",
            "missing_elements": [
                k for k, v in scores.items() if v < 3
            ],
        }

    def _check_jurisdiction(self, response: str, jurisdiction: str) -> int:
        """管轄法域の明示チェック"""
        if jurisdiction in response:
            return 5
        jurisdiction_terms = ["日本法", "民法", "刑法", "会社法", "労働基準法"]
        found = sum(1 for t in jurisdiction_terms if t in response)
        return min(5, found + 1)
```

### 7.3 Multi-Dimensional Code Generation Evaluation

```python
import subprocess
import tempfile
import time
from pathlib import Path

class CodeEvaluator:
    """コード生成の多面的評価"""

    def evaluate(self, generated_code: str, test_cases: list[dict], language: str = "python") -> dict:
        """コードの総合評価"""
        results = {
            "functional": self._test_functionality(generated_code, test_cases, language),
            "style": self._check_style(generated_code, language),
            "complexity": self._measure_complexity(generated_code),
            "security": self._check_security(generated_code, language),
            "performance": self._benchmark_performance(generated_code, test_cases, language),
        }

        # 総合スコア
        weights = {
            "functional": 0.40,
            "style": 0.15,
            "complexity": 0.15,
            "security": 0.15,
            "performance": 0.15,
        }

        total = sum(
            results[k]["score"] * weights[k]
            for k in weights
        )

        return {
            "total_score": round(total, 2),
            "details": results,
            "pass": results["functional"]["all_passed"],
        }

    def _test_functionality(self, code: str, test_cases: list[dict], language: str) -> dict:
        """テストケースによる機能テスト"""
        passed = 0
        failed = 0
        errors = []

        for tc in test_cases:
            try:
                with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                    f.write(code + "\n\n" + tc["test_code"])
                    f.flush()

                    result = subprocess.run(
                        ["python", f.name],
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )

                    if result.returncode == 0:
                        passed += 1
                    else:
                        failed += 1
                        errors.append({
                            "test": tc["name"],
                            "error": result.stderr[:200],
                        })
            except subprocess.TimeoutExpired:
                failed += 1
                errors.append({"test": tc["name"], "error": "Timeout"})
            except Exception as e:
                failed += 1
                errors.append({"test": tc["name"], "error": str(e)})

        total = passed + failed
        score = (passed / total * 5) if total > 0 else 0

        return {
            "score": round(score, 2),
            "passed": passed,
            "failed": failed,
            "all_passed": failed == 0,
            "errors": errors,
        }

    def _measure_complexity(self, code: str) -> dict:
        """循環的複雑度の測定"""
        # 簡易的な複雑度計算
        complexity_keywords = ["if", "elif", "else", "for", "while", "except", "and", "or"]
        lines = code.split("\n")
        complexity = 1  # 基本パス

        for line in lines:
            stripped = line.strip()
            for kw in complexity_keywords:
                if stripped.startswith(kw + " ") or stripped.startswith(kw + ":"):
                    complexity += 1

        # スコア (低複雑度ほど高スコア)
        if complexity <= 5:
            score = 5
        elif complexity <= 10:
            score = 4
        elif complexity <= 20:
            score = 3
        elif complexity <= 30:
            score = 2
        else:
            score = 1

        return {
            "score": score,
            "cyclomatic_complexity": complexity,
            "lines_of_code": len([l for l in lines if l.strip() and not l.strip().startswith("#")]),
        }
```

---

## 8. Cost Optimization

### 8.1 Evaluation Cost Analysis Framework

```python
@dataclass
class EvalCostConfig:
    """評価コストの設定"""
    input_price_per_1k: float   # 入力トークン単価 ($/1K tokens)
    output_price_per_1k: float  # 出力トークン単価 ($/1K tokens)
    avg_input_tokens: int       # 平均入力トークン数
    avg_output_tokens: int      # 平均出力トークン数

class EvalCostOptimizer:
    """評価コストの最適化"""

    # 主要モデルのコスト設定
    MODEL_COSTS = {
        "gpt-4o": EvalCostConfig(2.50, 10.00, 1500, 300),
        "gpt-4o-mini": EvalCostConfig(0.15, 0.60, 1500, 300),
        "claude-3.5-sonnet": EvalCostConfig(3.00, 15.00, 1500, 300),
        "claude-3-haiku": EvalCostConfig(0.25, 1.25, 1500, 300),
        "gemini-1.5-flash": EvalCostConfig(0.075, 0.30, 1500, 300),
    }

    def estimate_cost(
        self,
        judge_model: str,
        num_eval_cases: int,
        num_candidate_models: int,
        num_judge_calls_per_case: int = 2,  # 順序入替で2回
    ) -> dict:
        """評価コストの見積もり"""
        config = self.MODEL_COSTS.get(judge_model)
        if not config:
            return {"error": f"Unknown model: {judge_model}"}

        total_calls = num_eval_cases * num_candidate_models * num_judge_calls_per_case

        input_cost = (config.avg_input_tokens / 1000) * config.input_price_per_1k * total_calls
        output_cost = (config.avg_output_tokens / 1000) * config.output_price_per_1k * total_calls
        total_cost = input_cost + output_cost

        return {
            "judge_model": judge_model,
            "total_api_calls": total_calls,
            "input_cost_usd": round(input_cost, 2),
            "output_cost_usd": round(output_cost, 2),
            "total_cost_usd": round(total_cost, 2),
            "cost_per_eval_case": round(total_cost / num_eval_cases, 4),
        }

    def compare_strategies(self, num_eval_cases: int, num_models: int) -> list[dict]:
        """評価戦略のコスト比較"""
        strategies = []

        for model_name, config in self.MODEL_COSTS.items():
            est = self.estimate_cost(model_name, num_eval_cases, num_models)
            strategies.append({
                "strategy": f"LLM-as-a-Judge ({model_name})",
                "cost": est["total_cost_usd"],
                "quality": self._quality_estimate(model_name),
            })

        # 人間評価のコスト見積もり
        human_cost = num_eval_cases * num_models * 0.50  # $0.50/ケース
        strategies.append({
            "strategy": "Human Evaluation (crowdsourcing)",
            "cost": round(human_cost, 2),
            "quality": "highest",
        })

        # コスト順にソート
        strategies.sort(key=lambda x: x["cost"])
        return strategies

    def recommend_strategy(self, budget_usd: float, num_eval_cases: int, num_models: int) -> dict:
        """予算に応じた最適戦略の推薦"""
        strategies = self.compare_strategies(num_eval_cases, num_models)
        affordable = [s for s in strategies if s["cost"] <= budget_usd]

        if not affordable:
            # 予算内の最小モデルでケース数を削減
            cheapest = strategies[0]
            max_cases = int(budget_usd / (cheapest["cost"] / num_eval_cases))
            return {
                "recommendation": f"Budget insufficient: reduce to {max_cases} cases with {cheapest['strategy']}",
                "strategy": cheapest,
                "adjusted_cases": max_cases,
            }

        # 予算内で最高品質の戦略を選択
        best = max(affordable, key=lambda x: self._quality_score(x["quality"]))
        return {
            "recommendation": f"{best['strategy']} (${best['cost']})",
            "strategy": best,
            "remaining_budget": round(budget_usd - best["cost"], 2),
        }

    def _quality_estimate(self, model: str) -> str:
        """モデルの評価品質推定"""
        quality_map = {
            "gpt-4o": "high",
            "claude-3.5-sonnet": "high",
            "gpt-4o-mini": "medium",
            "claude-3-haiku": "medium",
            "gemini-1.5-flash": "medium",
        }
        return quality_map.get(model, "unknown")

    def _quality_score(self, quality: str) -> int:
        """品質のスコア化"""
        return {"highest": 5, "high": 4, "medium": 3, "low": 2, "unknown": 1}.get(quality, 0)

# 使用例
optimizer = EvalCostOptimizer()

# 100ケース、3モデルの評価コスト見積もり
for model in ["gpt-4o", "gpt-4o-mini", "gemini-1.5-flash"]:
    est = optimizer.estimate_cost(model, num_eval_cases=100, num_candidate_models=3)
    print(f"{model}: ${est['total_cost_usd']}")

# 予算$10で最適戦略
rec = optimizer.recommend_strategy(budget_usd=10.0, num_eval_cases=100, num_models=3)
print(f"推奨: {rec['recommendation']}")
```

---

## 9. Comparison Tables

### 9.1 Evaluation Method Comparison

| Method | Cost | Speed | Reliability | Scalability | Use Case |
|--------|------|-------|-------------|-------------|----------|
| Automated Benchmark | Low | Fast | Medium | High | Initial model screening |
| LLM-as-a-Judge | Medium | Medium | Medium–High | High | Routine quality checks |
| Multi-Judge | Medium–High | Medium | High | High | High-confidence evaluation |
| Human Evaluation (general) | High | Slow | High | Low | Final quality verification |
| Expert Evaluation | Highest | Slowest | Highest | Lowest | Domain-specific tasks |
| A/B Test | Medium | Slow | Highest | Medium | Production comparison |

### 9.2 Automated Evaluation Tool Comparison

| Tool | Primary Target | Features | Pricing |
|------|----------------|----------|---------|
| RAGAS | RAG pipeline | Faithfulness, Relevancy | OSS |
| DeepEval | LLM general | 14+ metrics | OSS |
| LangSmith | LLM apps | Tracing + evaluation | Paid |
| Braintrust | LLM general | CI/CD integration | Paid |
| HumanLoop | LLM general | Human evaluation integration | Paid |
| Promptfoo | Prompt evaluation | CLI tool, OSS | OSS |
| Inspect AI | LLM general | Developed by UK AISI, extensible | OSS |

### 9.3 Benchmark Comparison

| Benchmark | Questions | Format | Evaluation Target | Contamination Risk | Update Frequency |
|-----------|-----------|--------|-------------------|--------------------|-----------------|
| MMLU | 14,042 | 4-choice | General knowledge | High | None |
| MMLU-Pro | 12,032 | 10-choice | Knowledge + Reasoning | Medium | None |
| GPQA | 448 | 4-choice | Graduate level | Low | None |
| HumanEval | 164 | Code | Code generation | High | None |
| SWE-bench | 2,294 | Patch | Software development | Low | Periodic |
| IFEval | 541 | Free-form | Instruction following | Low | None |
| LiveBench | Variable | Mixed | General | Lowest | Monthly |
| MT-Bench | 80 | Dialogue | Dialogue quality | Medium | None |
| Arena Elo | — | Dialogue | General (human) | None | Daily |

---

## 10. Anti-Patterns

### Anti-Pattern 1: Judging by Benchmark Score Alone

```
# BAD: "This model scored 88 on MMLU so it's the best"
→ MMLU is a multiple-choice knowledge test and weakly
  correlates with summarization, dialogue, or code quality

→ Some models are suspected of benchmark contamination
  (benchmark questions leaking into training data)

# GOOD: Measure performance on your own task evaluation dataset
1. Create an evaluation set of 100 in-house task questions
2. Run 3–5 candidate models
3. LLM-as-a-Judge + human sampling evaluation
4. Analyze failure patterns, not just scores
```

### Anti-Pattern 2: Subjective Evaluation Without Criteria

```python
# BAD: "I kind of feel like this one is better"
subjective_result = "Model A is better"  # no basis

# GOOD: Define clear evaluation criteria (rubric)
rubric = {
    "Accuracy": {
        5: "No factual errors whatsoever",
        4: "One minor inaccuracy",
        3: "Partially inaccurate but the main point is correct",
        2: "Multiple factual errors",
        1: "Fundamentally wrong",
    },
    "Usefulness": {
        5: "Fully answers the question and adds extra insights",
        4: "Sufficiently answers the question",
        3: "Partially answers the question",
        2: "Only addresses part of the question",
        1: "Does not answer the question",
    },
}
```

### Anti-Pattern 3: Comparing Performance Without Statistical Testing

```python
# BAD: "Model A scored 82% and Model B scored 80%, so A is better"
# → A 2% difference may not be statistically significant

# GOOD: Verify with McNemar test + Bootstrap confidence intervals
from scipy import stats

# McNemar test
mcnemar = McNemarTest()
result = mcnemar.test(model_a_correct, model_b_correct)
print(f"p-value: {result['p_value']}")

if not result["significant"]:
    print("No significant difference → both models are equivalent")
    print("Decide based on other factors (cost, latency)")
```

### Anti-Pattern 4: Never Updating the Evaluation Dataset

```
# BAD: Using the same evaluation dataset indefinitely
→ Models may overfit to the evaluation set
→ New use cases are not covered
→ Growing divergence from production data

# GOOD: Regular evaluation dataset refresh cycle
1. Monthly: Add failure cases detected in production
2. Quarterly: Review the validity of the entire evaluation set
3. Semi-annually: Add new use cases and categories
4. Annually: Full review of the evaluation set
5. Continuously: Monitor for benchmark contamination
```

### Anti-Pattern 5: Relying on a Single Evaluator

```python
# BAD: Using only GPT-4o as the evaluator
judge_result = llm_judge(question, answer, criteria)
# → Self-Enhancement Bias overvalues GPT-4 outputs

# GOOD: Multi-Judge + human sampling
multi_judge = MultiJudgeEvaluator([
    {"name": "gpt-4o", "weight": 1.0, "call_fn": gpt4_judge},
    {"name": "claude-3.5-sonnet", "weight": 1.0, "call_fn": claude_judge},
    {"name": "gemini-1.5-pro", "weight": 0.8, "call_fn": gemini_judge},
])

result = multi_judge.evaluate(question, answer, criteria)
print(f"Consensus score: {result['final_score']}")
print(f"Inter-rater agreement: {result['agreement']}")

# Additionally, have humans verify 10% of evaluations
if result["confidence"] == "low":
    print("Route to human review")
```

---

## 11. Practical Use Cases

### Use Case 1: Evaluating a Customer Support Chatbot

```python
class CustomerSupportEvaluator:
    """カスタマーサポート AI の評価フレームワーク"""

    def __init__(self):
        self.criteria = {
            "resolution": {
                "weight": 0.30,
                "description": "顧客の問題を解決できたか",
            },
            "accuracy": {
                "weight": 0.25,
                "description": "提供した情報が正確か",
            },
            "tone": {
                "weight": 0.15,
                "description": "適切なトーン (丁寧、共感的) か",
            },
            "efficiency": {
                "weight": 0.15,
                "description": "必要最小限のやり取りで解決したか",
            },
            "escalation": {
                "weight": 0.15,
                "description": "適切にエスカレーションできたか",
            },
        }

    def evaluate_conversation(self, conversation: list[dict]) -> dict:
        """会話全体の評価"""
        # 会話をテキストに変換
        conv_text = "\n".join(
            f"{msg['role']}: {msg['content']}"
            for msg in conversation
        )

        # LLM-as-a-Judge で各基準を評価
        scores = {}
        for criterion, spec in self.criteria.items():
            result = llm_judge(
                question=f"以下のカスタマーサポート会話を '{criterion}' の観点で評価してください",
                answer=conv_text,
                criteria=spec["description"],
            )
            scores[criterion] = result["score"]

        total = sum(scores[k] * self.criteria[k]["weight"] for k in scores)

        # CSAT 予測 (1-5 スケール)
        csat_prediction = total

        return {
            "total_score": round(total, 2),
            "dimension_scores": scores,
            "predicted_csat": round(csat_prediction, 1),
            "needs_review": total < 3.0,
            "escalation_appropriate": scores.get("escalation", 5) >= 3,
        }

    def run_ab_test(
        self,
        conversations_a: list[list[dict]],
        conversations_b: list[list[dict]],
    ) -> dict:
        """A/B テスト (モデルAとモデルBの比較)"""
        scores_a = [self.evaluate_conversation(c)["total_score"] for c in conversations_a]
        scores_b = [self.evaluate_conversation(c)["total_score"] for c in conversations_b]

        # Bootstrap 比較
        bootstrap = BootstrapEvaluation()
        comparison = bootstrap.compare_models(scores_a, scores_b)

        return {
            "model_a_mean": round(sum(scores_a) / len(scores_a), 3),
            "model_b_mean": round(sum(scores_b) / len(scores_b), 3),
            "difference": comparison["mean_diff"],
            "significant": comparison["significant"],
            "confidence_interval": f"[{comparison['ci_lower']}, {comparison['ci_upper']}]",
            "recommendation": comparison["interpretation"],
        }
```

### Use Case 2: Prompt Regression Testing

```python
class PromptRegressionTester:
    """プロンプト変更時の回帰テスト"""

    def __init__(self, eval_dataset: list[EvalCase], baseline_results: dict):
        self.eval_dataset = eval_dataset
        self.baseline = baseline_results

    def test_prompt_change(
        self,
        model: str,
        old_prompt_template: str,
        new_prompt_template: str,
    ) -> dict:
        """プロンプト変更の影響を評価"""
        old_scores = []
        new_scores = []
        regressions = []
        improvements = []

        for case in self.eval_dataset:
            old_prompt = old_prompt_template.format(input=case.input_text)
            new_prompt = new_prompt_template.format(input=case.input_text)

            old_answer = self._call_model(model, old_prompt)
            new_answer = self._call_model(model, new_prompt)

            old_eval = llm_judge(case.input_text, old_answer, case.evaluation_criteria)
            new_eval = llm_judge(case.input_text, new_answer, case.evaluation_criteria)

            old_scores.append(old_eval["score"])
            new_scores.append(new_eval["score"])

            diff = new_eval["score"] - old_eval["score"]
            if diff < -1:
                regressions.append({
                    "case_id": case.id,
                    "old_score": old_eval["score"],
                    "new_score": new_eval["score"],
                    "category": case.category,
                })
            elif diff > 1:
                improvements.append({
                    "case_id": case.id,
                    "old_score": old_eval["score"],
                    "new_score": new_eval["score"],
                    "category": case.category,
                })

        # 統計検定
        bootstrap = BootstrapEvaluation()
        comparison = bootstrap.compare_models(new_scores, old_scores)

        return {
            "old_mean": round(sum(old_scores) / len(old_scores), 3),
            "new_mean": round(sum(new_scores) / len(new_scores), 3),
            "improvement": comparison["mean_diff"],
            "significant": comparison["significant"],
            "regressions": regressions,
            "improvements": improvements,
            "regression_rate": round(len(regressions) / len(self.eval_dataset) * 100, 1),
            "safe_to_deploy": len(regressions) == 0 or comparison["mean_diff"] > 0,
        }
```

---

## 12. Building an Evaluation Dashboard

```python
from datetime import datetime, timedelta
import json
from pathlib import Path

class EvalDashboard:
    """評価結果のダッシュボード管理"""

    def __init__(self, storage_dir: str = "./eval_dashboard_data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def record_evaluation(self, model: str, eval_result: dict) -> None:
        """評価結果の記録"""
        record = {
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "overall_score": eval_result.get("overall"),
            "by_category": eval_result.get("by_category", {}),
            "num_cases": eval_result.get("num_cases", 0),
        }

        # 日次ファイルに追記
        date_str = datetime.now().strftime("%Y-%m-%d")
        file_path = self.storage_dir / f"eval_{date_str}.jsonl"
        with open(file_path, "a") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    def get_trend(self, model: str, days: int = 30) -> dict:
        """モデルのスコアトレンドを取得"""
        records = []
        for i in range(days):
            date = datetime.now() - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")
            file_path = self.storage_dir / f"eval_{date_str}.jsonl"

            if file_path.exists():
                with open(file_path) as f:
                    for line in f:
                        record = json.loads(line)
                        if record["model"] == model:
                            records.append(record)

        if not records:
            return {"model": model, "trend": "no_data"}

        scores = [r["overall_score"] for r in records if r["overall_score"]]
        if len(scores) < 2:
            return {"model": model, "trend": "insufficient_data", "scores": scores}

        # トレンド計算 (線形回帰の傾き)
        x = list(range(len(scores)))
        mean_x = sum(x) / len(x)
        mean_y = sum(scores) / len(scores)

        numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, scores))
        denominator = sum((xi - mean_x) ** 2 for xi in x)

        slope = numerator / denominator if denominator != 0 else 0

        return {
            "model": model,
            "trend": "improving" if slope > 0.01 else "declining" if slope < -0.01 else "stable",
            "slope": round(slope, 4),
            "latest_score": scores[-1],
            "avg_score": round(sum(scores) / len(scores), 3),
            "min_score": min(scores),
            "max_score": max(scores),
            "num_evaluations": len(scores),
        }

    def generate_report(self, models: list[str]) -> str:
        """週次レポートの生成"""
        lines = [
            "# LLM Evaluation Weekly Report",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "",
            "## Trend by Model",
            "",
            "| Model | Latest Score | Avg Score | Trend | Evaluations |",
            "|-------|-------------|-----------|-------|-------------|",
        ]

        for model in models:
            trend = self.get_trend(model, days=7)
            if trend["trend"] == "no_data":
                continue

            trend_symbol = {
                "improving": "Rising",
                "declining": "Declining",
                "stable": "Stable",
            }.get(trend["trend"], "Unknown")

            lines.append(
                f"| {model} | {trend.get('latest_score', 'N/A')} | "
                f"{trend.get('avg_score', 'N/A')} | {trend_symbol} | "
                f"{trend.get('num_evaluations', 0)} |"
            )

        return "\n".join(lines)
```

---

## 13. FAQ

### Q1: How many cases does an evaluation dataset need?

A minimum of 50 cases, with 100–200 recommended. To detect statistically significant differences, 30 or more cases per category is desirable. When using the McNemar test to verify significance, an adequate sample size is needed to achieve p < 0.05. A practical approach is to start small and expand gradually.

### Q2: Which model should I use for LLM-as-a-Judge?

GPT-4o is most widely used and shows high agreement with human evaluation. However, due to Self-Enhancement Bias, it is preferable to use a different provider for the evaluator than the model being evaluated — for example, use Claude when evaluating OpenAI models. Adopting a Multi-Judge consensus approach can further reduce bias.

### Q3: How do I automate continuous model evaluation?

Integrate an evaluation step into the CI/CD pipeline. Use LangSmith or Braintrust to automatically run evaluations on every prompt change. Set a deployment condition where scores must not fall below past evaluation baselines, functioning as a "regression test." Update Elo ratings weekly or monthly and use them to guide model-switching decisions.

### Q4: How do I detect benchmark contamination?

Benchmark contamination occurs when benchmark questions are included in a model's training data, causing scores to be artificially inflated. Detect and address it using the following methods:

1. **Paraphrase test**: Rephrase the question and check if the score drops significantly
2. **n-gram overlap analysis**: Measure n-gram overlap between training data and benchmarks
3. **Dynamic benchmarks**: Use benchmarks like LiveBench that generate new questions every month
4. **Canary strings**: Embed specific strings in training data and check if the model outputs them

### Q5: How do I evaluate effectively on a limited budget?

A staged approach is recommended:

1. **Stage 1 ($0)**: Screen with open-source benchmarks (MMLU, HumanEval)
2. **Stage 2 ($5–10)**: LLM-as-a-Judge with GPT-4o-mini or Gemini Flash (100 cases)
3. **Stage 3 ($20–50)**: Multi-Judge with GPT-4o + human sampling (10%)
4. **Stage 4 ($100+)**: Expert evaluation + A/B testing

### Q6: How should multilingual evaluation be handled?

The following approaches are effective for evaluating languages other than English, especially Japanese:

1. **Language-specific benchmarks**: Use JMMLU (Japanese MMLU), JGLUE, MGSM (multilingual math)
2. **Translation-based evaluation**: Use high-quality translated English benchmarks (be mindful of cultural bias)
3. **Native evaluation**: Human evaluation by native speakers of the target language
4. **Cross-lingual evaluation**: Evaluate with different input and output languages (to verify translation quality)

### Q7: How do I ensure reproducibility of evaluations?

Since LLM outputs are probabilistic, the following measures are necessary:

1. **Set temperature=0**: Set the evaluator LLM's temperature to 0
2. **Seed parameter**: Fix the seed parameter in the OpenAI API
3. **Multiple runs**: Run the same evaluation 3–5 times and use the median
4. **Version control**: Manage evaluation datasets, prompts, and model versions with Git
5. **Save results**: Persist all evaluation results in JSONL format

---

## Summary

| Item | Recommendation |
|------|----------------|
| Initial model screening | MMLU / HumanEval / Arena Elo |
| Routine quality checks | LLM-as-a-Judge (GPT-4o) |
| High-confidence evaluation | Multi-Judge consensus |
| Final quality verification | Human evaluation (experts) |
| RAG evaluation | RAGAS framework |
| Bias mitigation | Order swapping + multiple evaluators + bias detection |
| Significance testing | McNemar test + Bootstrap confidence intervals |
| Evaluation dataset size | 100–200 cases (30+ per category) |
| Continuous monitoring | CI/CD integration + weekly reports + dashboard |
| Cost optimization | Staged evaluation + mini model utilization |

---

## Further Reading

- [../01-models/04-model-comparison.md](../01-models/04-model-comparison.md) — Model selection based on evaluation results
- [../02-applications/00-prompt-engineering.md](../02-applications/00-prompt-engineering.md) — Evaluation of prompt improvements
- [../04-ethics/00-ai-safety.md](../04-ethics/00-ai-safety.md) — Safety evaluation

---

## References

1. Chiang et al., "Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference," arXiv:2403.04132, 2024
2. Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena," NeurIPS 2023
3. RAGAS, "RAG Assessment," https://docs.ragas.io/
4. Hendrycks et al., "Measuring Massive Multitask Language Understanding," ICLR 2021
5. Chen et al., "Evaluating Large Language Models Trained on Code (HumanEval)," arXiv:2107.03374, 2021
6. Wang et al., "MMLU-Pro: A More Robust and Challenging Multi-Task Language Understanding Benchmark," arXiv:2406.01574, 2024
7. Rein et al., "GPQA: A Graduate-Level Google-Proof Q&A Benchmark," arXiv:2311.12022, 2023
8. Jimenez et al., "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?," arXiv:2310.06770, 2023
9. Zhou et al., "Instruction-Following Evaluation for Large Language Models," arXiv:2311.07911, 2023
10. White et al., "LiveBench: A Challenging, Contamination-Free LLM Benchmark," arXiv:2406.19314, 2024
