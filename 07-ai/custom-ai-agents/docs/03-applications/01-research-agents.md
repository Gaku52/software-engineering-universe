# Research Agents

> Information gathering, analysis, and summarization — design and implementation of agents that autonomously collect data from multiple sources and generate structured research reports.

## What You Will Learn

1. Information gathering pipeline and multi-stage filtering design for research agents
2. Implementation patterns for web search, document parsing, and data integration
3. Mechanisms for validation and citation management to produce reliable research output
4. Research agent implementations for specific domains
5. Techniques for summarizing and integrating large volumes of information


## Prerequisites

The following knowledge will help you get more out of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Coding Agents](./00-coding-agents.md)

---

## 1. Overview of Research Agents

```
Research Agent Pipeline

[Goal Setting]
    |
    v
[Query Generation] -- Decompose goal into multiple search queries
    |
    v
[Information Gathering] -- Web search, DB search, document reading
    |            +-- Search engines
    |            +-- Academic paper DBs (Semantic Scholar, etc.)
    |            +-- Internal documents
    |            +-- APIs / Databases
    v
[Filtering] -- Evaluate relevance and reliability
    |
    v
[Analysis & Integration] -- Structuring information, resolving contradictions
    |
    v
[Report Generation] -- Structured output with citations
    |
    v
[Quality Check] -- Fact verification, bias check
```

### 1.1 Research Depth Levels

```
Research Depth Spectrum

Level 1: Quick Survey (1-2 minutes)
  - 1-2 searches
  - Top result snippets only
  - Use case: fact checking, definition lookup

Level 2: Standard Survey (5-10 minutes)
  - 3-5 searches
  - Detailed reading of 2-3 pages
  - 1 cross-check
  - Use case: general research, briefings

Level 3: Deep Dive (15-30 minutes)
  - 5-10 searches
  - Detailed reading of 5+ pages
  - Academic paper research
  - Multiple cross-checks
  - Use case: decision support, detailed reports

Level 4: Comprehensive Survey (1-2 hours)
  - Multi-stage research cycles
  - Detailed reading of 10+ pages
  - Close reading of academic papers
  - Quantitative data analysis
  - Expert opinion research
  - Use case: strategy reports, market research
```

---

## 2. Basic Research Agent

### 2.1 Complete Implementation

```python
# Research agent implementation
import anthropic
import json
from dataclasses import dataclass, field

@dataclass
class Source:
    title: str
    url: str
    snippet: str
    reliability: float = 0.5  # 0-1

@dataclass
class ResearchResult:
    topic: str
    summary: str
    key_findings: list[str]
    sources: list[Source]
    confidence: float  # 0-1

class ResearchAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.tools = [
            {
                "name": "web_search",
                "description": "Web検索を実行して結果を返す",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "num_results": {
                            "type": "integer", "default": 10
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "read_webpage",
                "description": "指定URLのWebページ内容を取得する",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"}
                    },
                    "required": ["url"]
                }
            },
            {
                "name": "search_papers",
                "description": "学術論文を検索する（Semantic Scholar）",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "year_from": {"type": "integer"}
                    },
                    "required": ["query"]
                }
            }
        ]

    def research(self, topic: str, depth: str = "standard") -> str:
        """Execute research on a topic"""
        system_prompt = f"""あなたは優秀なリサーチアナリストです。
以下のルールに従ってリサーチを実施してください:

1. まずトピックを分解し、3-5個の検索クエリを生成
2. 各クエリで検索を実行し、関連性の高い結果を収集
3. 重要なページは詳細に読み込む
4. 複数情報源を照合し、矛盾がないか確認
5. 構造化されたレポートにまとめる

リサーチ深度: {depth}
- light: 概要レベル（検索1-2回）
- standard: 標準（検索3-5回、2-3ページ詳細読み込み）
- deep: 深掘り（検索5-10回、5+ページ詳細読み込み）

出力形式: Markdown形式のレポート（引用付き）
"""
        messages = [
            {"role": "user", "content": f"リサーチトピック: {topic}"}
        ]

        for _ in range(20):
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system_prompt,
                tools=self.tools,
                messages=messages
            )

            if response.stop_reason == "end_turn":
                return response.content[0].text

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self._execute_tool(
                        block.name, block.input
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })

            messages.append({
                "role": "assistant",
                "content": response.content
            })
            messages.append({"role": "user", "content": tool_results})

        return "Research could not be completed"

    def _execute_tool(self, name: str, args: dict) -> str:
        if name == "web_search":
            return self._web_search(
                args["query"], args.get("num_results", 10)
            )
        elif name == "read_webpage":
            return self._read_webpage(args["url"])
        elif name == "search_papers":
            return self._search_papers(
                args["query"], args.get("year_from")
            )
        return "Unknown tool"

    def _web_search(self, query: str, num_results: int) -> str:
        # In practice, use SerpAPI, Google Custom Search, etc.
        pass

    def _read_webpage(self, url: str) -> str:
        import requests
        from bs4 import BeautifulSoup
        try:
            resp = requests.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            text = soup.get_text(separator="\n", strip=True)
            return text[:5000]
        except Exception as e:
            return f"ページ読み込みエラー: {e}"

    def _search_papers(self, query: str,
                       year_from: int = None) -> str:
        import requests
        params = {"query": query, "limit": 5}
        if year_from:
            params["year"] = f"{year_from}-"
        resp = requests.get(
            "https://api.semanticscholar.org/graph/v1/paper/search",
            params=params
        )
        return json.dumps(
            resp.json().get("data", [])[:5], ensure_ascii=False
        )
```

### 2.2 Multi-Stage Research

```python
# Multi-stage pipeline for deep research
class DeepResearchAgent:
    def research(self, topic: str) -> str:
        # Phase 1: Broad and shallow survey
        overview = self._broad_search(topic)

        # Phase 2: Identify key themes
        key_themes = self._identify_themes(overview)

        # Phase 3: Deep dive into each theme
        detailed_findings = {}
        for theme in key_themes:
            detailed_findings[theme] = self._deep_dive(theme)

        # Phase 4: Generate integrated report
        report = self._synthesize(topic, detailed_findings)

        # Phase 5: Fact checking
        verified_report = self._fact_check(report)

        return verified_report
```

### 2.3 Research with Structured Output

```python
from pydantic import BaseModel, Field

class ResearchFinding(BaseModel):
    """Individual research finding"""
    claim: str = Field(description="主張・事実")
    evidence: str = Field(description="根拠")
    source_url: str = Field(description="情報源URL")
    confidence: float = Field(
        description="信頼度 0.0-1.0", ge=0, le=1
    )

class ResearchReport(BaseModel):
    """Structured research report"""
    title: str
    executive_summary: str = Field(description="要約（300字以内）")
    key_findings: list[ResearchFinding]
    analysis: str = Field(description="分析と考察")
    limitations: list[str] = Field(description="調査の限界")
    recommendations: list[str] = Field(description="推奨事項")

class StructuredResearchAgent:
    """Research agent that returns structured output"""

    def __init__(self):
        self.client = anthropic.Anthropic()
        self.base_agent = ResearchAgent()

    async def research_structured(
        self,
        topic: str,
        depth: str = "standard"
    ) -> ResearchReport:
        """Generate a structured research report"""
        # Phase 1: Run standard research
        raw_report = self.base_agent.research(topic, depth)

        # Phase 2: Convert to structured JSON
        structured = await self._structurize(raw_report)

        return structured

    async def _structurize(self, raw_report: str) -> ResearchReport:
        """Convert raw report to structured format"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"""以下のリサーチレポートを構造化された
JSON形式に変換してください。

レポート:
{raw_report}

以下のJSON形式で出力してください:
{{
  "title": "...",
  "executive_summary": "...",
  "key_findings": [
    {{
      "claim": "...",
      "evidence": "...",
      "source_url": "...",
      "confidence": 0.0-1.0
    }}
  ],
  "analysis": "...",
  "limitations": ["..."],
  "recommendations": ["..."]
}}"""
            }]
        )

        data = json.loads(response.content[0].text)
        return ResearchReport(**data)
```

---

## 3. Evaluating Information Reliability

### 3.1 Reliability Pyramid

```
Source Reliability Pyramid

         /\
        /  \     Primary sources (papers, official data)
       /    \    Reliability: Highest
      /------\
     /        \   Secondary sources (news articles, specialized media)
    /          \  Reliability: High
   /------------\
  /              \ Tertiary sources (blogs, social media, Wikipedia)
 /                \ Reliability: Medium-Low
/------------------\
```

### 3.2 Reliability Scoring Implementation

```python
# Source reliability scoring
class SourceReliabilityScorer:
    DOMAIN_SCORES = {
        "arxiv.org": 0.9,
        "nature.com": 0.95,
        "science.org": 0.95,
        "acm.org": 0.9,
        "ieee.org": 0.9,
        "github.com": 0.7,
        "stackoverflow.com": 0.7,
        "docs.anthropic.com": 0.85,
        "openai.com": 0.85,
        "wikipedia.org": 0.6,
        "medium.com": 0.4,
        "reddit.com": 0.3,
        "twitter.com": 0.2,
    }

    # Default scores by domain category
    CATEGORY_SCORES = {
        ".gov": 0.85,     # Government agencies
        ".edu": 0.8,      # Educational institutions
        ".org": 0.6,      # Non-profit organizations
        ".ac.jp": 0.8,    # Japanese universities
        ".go.jp": 0.85,   # Japanese government agencies
    }

    def score(self, url: str, content: str) -> float:
        """Score the reliability of a source"""
        from urllib.parse import urlparse
        domain = urlparse(url).netloc

        # Domain-based score
        domain_score = self._get_domain_score(domain)

        # Presence of citations
        has_citations = any(
            marker in content
            for marker in ["[1]", "参考文献", "References", "doi:"]
        )
        citation_bonus = 0.1 if has_citations else 0

        # Recency of date
        recency_bonus = self._check_recency(content)

        # Content quality indicators
        quality_bonus = self._assess_content_quality(content)

        return min(
            1.0,
            domain_score + citation_bonus + recency_bonus + quality_bonus
        )

    def _get_domain_score(self, domain: str) -> float:
        """Get score from domain"""
        # Exact match
        if domain in self.DOMAIN_SCORES:
            return self.DOMAIN_SCORES[domain]

        # Subdomain check
        for known_domain, score in self.DOMAIN_SCORES.items():
            if domain.endswith(f".{known_domain}"):
                return score

        # Category check
        for suffix, score in self.CATEGORY_SCORES.items():
            if domain.endswith(suffix):
                return score

        return 0.5  # Default

    def _check_recency(self, content: str) -> float:
        """Evaluate recency of content"""
        import re
        from datetime import datetime

        # Detect year patterns
        years = re.findall(r'20[12]\d', content)
        if years:
            latest_year = max(int(y) for y in years)
            current_year = datetime.now().year
            diff = current_year - latest_year
            if diff == 0:
                return 0.1
            elif diff <= 1:
                return 0.05
            elif diff <= 3:
                return 0.0
            else:
                return -0.05  # Penalty for old information
        return 0.0

    def _assess_content_quality(self, content: str) -> float:
        """Evaluate qualitative indicators of content"""
        bonus = 0.0

        # Density of data and numbers
        import re
        numbers = re.findall(r'\d+\.?\d*%|\$[\d,]+|\d{4}年', content)
        if len(numbers) > 5:
            bonus += 0.05

        # Structured content
        if content.count('\n') > 20:
            bonus += 0.02

        # Length (longer articles tend to be more reliable)
        if len(content) > 3000:
            bonus += 0.03

        return min(bonus, 0.1)
```

### 3.3 Cross-Check Implementation

```python
class CrossChecker:
    """Performs cross-checking across multiple sources"""

    def __init__(self, llm_client):
        self.client = llm_client

    async def cross_check(
        self,
        claim: str,
        sources: list[dict]
    ) -> dict:
        """Cross-check a claim against multiple sources"""
        supporting = []
        contradicting = []
        neutral = []

        for source in sources:
            alignment = await self._check_alignment(
                claim, source["content"]
            )
            if alignment["supports"]:
                supporting.append(source)
            elif alignment["contradicts"]:
                contradicting.append(source)
            else:
                neutral.append(source)

        # Calculate confidence
        total_weight = sum(
            s.get("reliability", 0.5)
            for s in supporting + contradicting
        )
        support_weight = sum(
            s.get("reliability", 0.5) for s in supporting
        )

        confidence = support_weight / total_weight if total_weight > 0 else 0.5

        return {
            "claim": claim,
            "confidence": confidence,
            "supporting_sources": len(supporting),
            "contradicting_sources": len(contradicting),
            "neutral_sources": len(neutral),
            "verdict": self._determine_verdict(confidence),
            "details": {
                "supporting": [s["url"] for s in supporting],
                "contradicting": [s["url"] for s in contradicting],
            }
        }

    def _determine_verdict(self, confidence: float) -> str:
        if confidence >= 0.8:
            return "highly_supported"
        elif confidence >= 0.6:
            return "moderately_supported"
        elif confidence >= 0.4:
            return "inconclusive"
        else:
            return "likely_inaccurate"

    async def _check_alignment(
        self, claim: str, content: str
    ) -> dict:
        """Determine whether content supports the claim"""
        response = self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": f"""以下の主張と文書の関係を判定してください。

主張: {claim}
文書: {content[:2000]}

JSON形式で回答:
{{"supports": true/false, "contradicts": true/false, "reason": "..."}}"""
            }]
        )
        return json.loads(response.content[0].text)
```

---

## 4. Domain-Specific Research Agents

### 4.1 Market Research Agent

```python
class MarketResearchAgent(ResearchAgent):
    """Research agent specialized in market research"""

    def __init__(self):
        super().__init__()
        # Add market research-specific tools
        self.tools.extend([
            {
                "name": "search_industry_report",
                "description": "業界レポートを検索する",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "industry": {"type": "string"},
                        "aspect": {
                            "type": "string",
                            "enum": [
                                "market_size", "competitors",
                                "trends", "regulations"
                            ]
                        }
                    },
                    "required": ["industry"]
                }
            },
            {
                "name": "get_company_info",
                "description": "企業情報を取得する",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "company_name": {"type": "string"},
                        "info_type": {
                            "type": "string",
                            "enum": [
                                "overview", "financials",
                                "products", "news"
                            ]
                        }
                    },
                    "required": ["company_name"]
                }
            }
        ])

    def market_analysis(
        self,
        industry: str,
        region: str = "global"
    ) -> str:
        """Conduct a comprehensive market analysis"""
        return self.research(
            topic=f"""
{industry} の市場分析（地域: {region}）

以下の観点で調査してください:
1. 市場規模と成長率（過去5年 + 将来予測）
2. 主要プレイヤーと市場シェア
3. トレンドと新技術
4. 規制環境
5. 参入障壁と機会
6. SWOT分析

数値データは必ず出典を明記してください。
""",
            depth="deep"
        )

    def competitive_analysis(
        self,
        target_company: str,
        competitors: list[str]
    ) -> str:
        """Conduct competitive analysis"""
        competitor_list = ", ".join(competitors)
        return self.research(
            topic=f"""
{target_company} の競合分析

比較対象: {competitor_list}

以下の観点で比較分析してください:
1. 製品/サービスラインナップ
2. 価格戦略
3. ターゲット顧客
4. 技術的優位性
5. 市場ポジション
6. 最近の動向（直近1年）

比較表形式でまとめてください。
""",
            depth="deep"
        )
```

### 4.2 Academic Research Agent

```python
class AcademicResearchAgent(ResearchAgent):
    """Agent specialized in academic paper research"""

    def literature_review(
        self,
        topic: str,
        year_range: tuple[int, int] = (2020, 2025)
    ) -> str:
        """Conduct a literature review"""
        return self.research(
            topic=f"""
学術文献レビュー: {topic}
期間: {year_range[0]}-{year_range[1]}

以下の構成でレビューを作成してください:

1. 概要
   - 研究分野の背景
   - 主要な研究課題

2. 方法論の分類
   - 主なアプローチの分類と比較
   - 各アプローチの利点と限界

3. 主要な研究成果
   - 代表的な論文の詳細レビュー
   - 実験結果の比較

4. 研究のギャップ
   - 未解決の問題
   - 今後の研究方向

5. 結論
   - 現状のまとめ
   - 推奨される研究方向

各引用は必ず [著者名, 年] 形式で記載してください。
Semantic Scholar での論文検索を活用してください。
""",
            depth="deep"
        )

    def find_related_work(
        self,
        paper_title: str,
        paper_abstract: str
    ) -> str:
        """Research related work"""
        return self.research(
            topic=f"""
以下の論文の関連研究を調査してください。

タイトル: {paper_title}
アブストラクト: {paper_abstract}

調査項目:
1. 先行研究（この論文が引用すべきもの）
2. 後続研究（この論文を発展させたもの）
3. 競合研究（同様の課題に異なるアプローチで取り組んだもの）
4. 応用研究（この論文の手法を応用したもの）

各論文について以下を記載:
- タイトル、著者、年
- 関連の種類と理由
- 主要な貢献
""",
            depth="deep"
        )
```

### 4.3 Technology Research Agent

```python
class TechResearchAgent(ResearchAgent):
    """Agent specialized in technology research"""

    def technology_comparison(
        self,
        technologies: list[str],
        criteria: list[str]
    ) -> str:
        """Technology comparison research"""
        tech_list = ", ".join(technologies)
        criteria_list = ", ".join(criteria)

        return self.research(
            topic=f"""
技術比較調査: {tech_list}

評価軸: {criteria_list}

以下の構成でレポートを作成してください:

1. 各技術の概要（200字程度ずつ）
2. 比較表（全評価軸 x 全技術）
3. ユースケース別の推奨
4. 移行コストと学習曲線
5. コミュニティの活発さとエコシステム
6. 将来性の評価
7. 総合評価と推奨

GitHubスター数、NPMダウンロード数などの
定量データも含めてください。
""",
            depth="deep"
        )

    def security_audit_research(
        self,
        technology: str,
        version: str
    ) -> str:
        """Research security vulnerabilities"""
        return self.research(
            topic=f"""
{technology} v{version} のセキュリティ脆弱性調査

調査項目:
1. 既知のCVE（過去2年間）
2. セキュリティアドバイザリ
3. 推奨されるセキュリティ設定
4. よくある誤設定
5. 依存関係の脆弱性
6. セキュリティベストプラクティス

NVD、GitHub Security Advisory等を
情報源として使用してください。
""",
            depth="deep"
        )
```

---

## 5. Research Pattern Comparison

### 5.1 Research Strategy Comparison

| Strategy | Depth | Time | Cost | Use Case |
|----------|-------|------|------|----------|
| Broad-shallow search | Low | Short | Low | Overview |
| Deep-dive search | High | Long | Medium | Specific topic research |
| Multi-stage research | High | Longest | High | Comprehensive reports |
| Comparative research | Medium | Medium | Medium | Comparing options |
| Trend analysis | Medium | Medium-Long | Medium | Tracking changes over time |
| Literature review | Highest | Longest | Highest | Academic research |

### 5.2 Output Format Comparison

| Format | Use Case | Length | Contents |
|--------|----------|--------|----------|
| Summary | Quick information sharing | 100-300 words | 3-5 key points |
| Briefing | Decision support | 500-1000 words | Key points + rationale + recommendations |
| Report | Detailed analysis | 2000-5000 words | All sections + citations |
| Data sheet | Quantitative comparison | Tabular | Numbers + comparison tables |
| White paper | Deep insights | 5000-15000 words | Analysis + charts + citations |

### 5.3 Source Comparison

| Source | Reliability | Recency | Access | Use Case |
|--------|-------------|---------|--------|----------|
| Academic papers | Highest | Medium | Semantic Scholar | Foundational research |
| Official documentation | High | High | Direct access | Technical research |
| News media | Medium-High | Highest | Web search | Trends |
| Industry reports | High | Medium | Paid/Web | Market research |
| Blogs/Social media | Low-Medium | High | Web search | Practical knowledge |
| Government statistics | Highest | Low-Medium | Public data | Quantitative analysis |

---

## 6. Citation Management

### 6.1 Citation Management System

```python
# Citation management system
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Citation:
    id: int
    title: str
    url: str
    author: str = ""
    date: str = ""
    accessed: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )

class CitationManager:
    def __init__(self):
        self.citations: list[Citation] = []
        self._counter = 0

    def add(self, title: str, url: str, **kwargs) -> str:
        """Add a citation and return the reference number"""
        self._counter += 1
        citation = Citation(
            id=self._counter, title=title, url=url, **kwargs
        )
        self.citations.append(citation)
        return f"[{self._counter}]"

    def format_references(self) -> str:
        """Generate a references section"""
        lines = ["## References\n"]
        for c in self.citations:
            line = f"[{c.id}] {c.title}"
            if c.author:
                line += f" - {c.author}"
            if c.date:
                line += f" ({c.date})"
            line += f"\n    {c.url}"
            lines.append(line)
        return "\n".join(lines)

    def get_citation(self, citation_id: int) -> Citation | None:
        """Retrieve a citation by ID"""
        for c in self.citations:
            if c.id == citation_id:
                return c
        return None

    def verify_all_cited(self, report: str) -> list[int]:
        """Detect sources not cited in the report"""
        import re
        cited_ids = set(
            int(m) for m in re.findall(r'\[(\d+)\]', report)
        )
        all_ids = set(c.id for c in self.citations)
        uncited = all_ids - cited_ids
        return sorted(uncited)

    def export_bibtex(self) -> str:
        """Export in BibTeX format"""
        entries = []
        for c in self.citations:
            entry = f"""@misc{{ref{c.id},
  title = {{{c.title}}},
  author = {{{c.author or 'Unknown'}}},
  year = {{{c.date[:4] if c.date else 'n.d.'}}},
  url = {{{c.url}}},
  note = {{Accessed: {c.accessed}}}
}}"""
            entries.append(entry)
        return "\n\n".join(entries)
```

---

## 7. Parallel Research

### 7.1 Architecture

```
Parallel Research Architecture

                    [Topic Decomposition]
                    /     |     \
                   v      v      v
            [Subtopic 1] [Subtopic 2] [Subtopic 3]
                   |      |      |
                   v      v      v
            [Search+Read] [Search+Read] [Search+Read]
                   \      |      /
                    v     v     v
                    [Result Integration]
                       |
                       v
                    [Report Generation]
```

### 7.2 Async Parallel Research Implementation

```python
# Async parallel research
import asyncio

class ParallelResearchAgent:
    def __init__(self, max_concurrent: int = 5):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.client = anthropic.AsyncAnthropic()

    async def research_parallel(
        self,
        topic: str,
        sub_topics: list[str]
    ) -> str:
        """Research subtopics in parallel"""
        tasks = [
            self._research_with_limit(sub)
            for sub in sub_topics
        ]
        results = await asyncio.gather(*tasks)

        # Integrate results
        combined = "\n\n".join(
            f"## {topic}\n{result}"
            for topic, result in zip(sub_topics, results)
        )

        return await self._synthesize_report(topic, combined)

    async def _research_with_limit(self, subtopic: str) -> str:
        """Research with concurrency limit"""
        async with self.semaphore:
            return await self._research_subtopic(subtopic)

    async def _research_subtopic(self, subtopic: str) -> str:
        """Research an individual subtopic"""
        search_results = await self._async_search(subtopic)
        relevant_pages = await self._filter_and_read(search_results)
        return await self._summarize(subtopic, relevant_pages)

    async def _synthesize_report(
        self,
        topic: str,
        combined_findings: str
    ) -> str:
        """Synthesize all subtopic results into an integrated report"""
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"""以下のサブトピック調査結果を統合して、
包括的なレポートを作成してください。

メイントピック: {topic}

調査結果:
{combined_findings}

レポート要件:
1. エグゼクティブサマリー（300字以内）
2. 主要な発見事項（箇条書き）
3. 詳細分析（サブトピック間の関連性も含む）
4. 矛盾する情報があれば指摘
5. 結論と推奨事項
6. 参考文献リスト
"""
            }]
        )
        return response.content[0].text
```

---

## 8. Summarization Techniques for Large Volumes of Information

### 8.1 Map-Reduce Summarization Pattern

```python
class MapReduceSummarizer:
    """Map-Reduce summarization for large volumes of text"""

    def __init__(self, llm_client, chunk_size: int = 3000):
        self.client = llm_client
        self.chunk_size = chunk_size

    async def summarize(
        self,
        documents: list[str],
        final_prompt: str
    ) -> str:
        """Summarize large document sets using Map-Reduce pattern"""

        # Map: Summarize each document individually
        chunk_summaries = []
        for doc in documents:
            chunks = self._split_into_chunks(doc)
            for chunk in chunks:
                summary = await self._summarize_chunk(chunk)
                chunk_summaries.append(summary)

        # Reduce: Integrate chunk summaries
        while len(chunk_summaries) > 1:
            # Merge 3-5 at a time
            batches = [
                chunk_summaries[i:i+4]
                for i in range(0, len(chunk_summaries), 4)
            ]
            chunk_summaries = [
                await self._merge_summaries(batch)
                for batch in batches
            ]

        # Final: Generate final summary
        final = await self._finalize(
            chunk_summaries[0], final_prompt
        )
        return final

    def _split_into_chunks(self, text: str) -> list[str]:
        """Split text into chunks"""
        words = text.split()
        chunks = []
        current = []
        current_len = 0

        for word in words:
            current.append(word)
            current_len += len(word) + 1
            if current_len >= self.chunk_size:
                chunks.append(" ".join(current))
                current = []
                current_len = 0

        if current:
            chunks.append(" ".join(current))

        return chunks

    async def _summarize_chunk(self, chunk: str) -> str:
        """Summarize an individual chunk"""
        response = await self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"以下のテキストを200字以内で要約:\n\n{chunk}"
            }]
        )
        return response.content[0].text

    async def _merge_summaries(self, summaries: list[str]) -> str:
        """Merge multiple summaries"""
        combined = "\n---\n".join(summaries)
        response = await self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"以下の要約を統合して1つにまとめ:\n\n{combined}"
            }]
        )
        return response.content[0].text
```

### 8.2 Refine Summarization Pattern

```python
class RefineSummarizer:
    """Pattern that iteratively improves summaries"""

    async def summarize(
        self,
        documents: list[str],
        topic: str
    ) -> str:
        """Iteratively improve summaries using Refine pattern"""
        current_summary = ""

        for i, doc in enumerate(documents):
            if i == 0:
                # Create initial summary from the first document
                current_summary = await self._initial_summary(
                    doc, topic
                )
            else:
                # Improve summary with information from new document
                current_summary = await self._refine_summary(
                    current_summary, doc, topic
                )

        return current_summary

    async def _initial_summary(
        self, doc: str, topic: str
    ) -> str:
        """Create initial summary"""
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""トピック「{topic}」について、
以下の文書から重要な情報を要約してください。

文書:
{doc[:3000]}

要約を構造化して出力してください。"""
            }]
        )
        return response.content[0].text

    async def _refine_summary(
        self,
        current: str,
        new_doc: str,
        topic: str
    ) -> str:
        """Improve summary with new information"""
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""以下の既存の要約を、新しい文書の情報で
改善・拡充してください。

トピック: {topic}

既存の要約:
{current}

新しい文書:
{new_doc[:3000]}

改善された要約を出力してください。
矛盾する情報があれば指摘してください。"""
            }]
        )
        return response.content[0].text
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Blindly Trusting Search Results

```python
# BAD: Use the first search result as-is
results = search("AI market size")
return results[0]["snippet"]  # May be outdated or inaccurate

# GOOD: Cross-check with multiple sources
results = search("AI market size 2025")
page1 = read(results[0]["url"])
page2 = read(results[1]["url"])
page3 = read(results[2]["url"])
# Only accept information that is consistent across all 3 sources
```

### Anti-Pattern 2: Biased Search

```python
# BAD: Only look for information that supports a conclusion
search("AI agents problems")  # Only negative information

# GOOD: Balanced research
search("AI agents benefits advantages")
search("AI agents challenges limitations")
search("AI agents case studies success")
search("AI agents failures lessons")
```

### Anti-Pattern 3: Research Without Citations

```
# BAD: State facts without sources
"The AI agent market is expected to reach $100 billion in 2025."

# GOOD: Always include citations
"The AI agent market is expected to reach $100 billion in 2025 [1]."
[1] Gartner, "AI Agent Market Forecast", 2024
```

### Anti-Pattern 4: Using Outdated Information Without Verification

```
# BAD: Use information without checking its date
"ChatGPT has 100 million monthly active users"  # May be 2023 data

# GOOD: Specify the date and verify recency
"As of January 2025, ChatGPT's monthly active users are reported to be
approximately 300 million [1]. Note that this figure may change rapidly."
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following functionality.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be conscious of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Verify config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user permissions, review settings |
| Data inconsistency | Concurrency conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Use log output or a debugger to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator to log function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O waits**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool status

| Problem Type | Diagnostic Tool | Solution |
|--------------|----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin interfaces, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. How frequent are deployments?               │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily/multiple times → Go to 3            │
│                                                 │
│  3. How much team independence is needed?       │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A fast approach in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and challenges"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 10. FAQ

### Q1: How can I improve the accuracy of a research agent?

- **Diversify queries**: Search the same topic from different angles
- **Diversify sources**: Combine web, papers, official documentation, etc.
- **Cross-check**: Verify important facts with 3 or more sources
- **Prioritize recency**: Prefer more recently dated information
- **Structured output**: Use structured formats like JSON for consistency

### Q2: How do I prevent hallucination (making things up)?

- **Require citations**: Associate every fact with a source URL
- **Quote original text from search results**: Quote the original rather than paraphrasing
- **Allow "not found"**: Report honestly when information is not available
- **Handle numbers carefully**: Always verify statistical data against the original source
- **Express confidence levels**: Annotate uncertain information with a confidence score

### Q3: How do I summarize large volumes of information?

The Map-Reduce pattern is effective:
1. **Map**: Summarize each page individually (200-300 words)
2. **Reduce**: Integrate individual summaries to generate a final summary
3. **Refine**: Improve the final summary against the objective

This allows processing large amounts of information within the context window limit.

### Q4: How should real-time data be handled?

- **Record timestamps**: Record retrieval date/time for all data
- **Freshness warnings**: Annotate older data with "information from N days ago"
- **Set update frequency**: Schedule periodic re-runs of research
- **Caching strategy**: Cache slowly-changing information; always fetch rapidly-changing information

### Q5: What are tips for cost optimization?

- **Set appropriate depth**: Not every research task needs to be "deep"
- **Use the right model**: Use Haiku for summarization, Sonnet/Opus for analysis
- **Leverage caching**: Cache results for the same search queries
- **Control parallelism**: Limit concurrent executions to manage API costs
- **Progressive deep-diving**: Start with a shallow survey and only deep-dive where needed

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory but from actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|---------|
| Pipeline | Query generation -> Collection -> Filtering -> Analysis -> Report |
| Reliability | Source scoring + cross-checking |
| Citation management | Associate every fact with a source |
| Parallelization | Parallel research per subtopic |
| Summarization techniques | Map-Reduce / Refine patterns |
| Quality assurance | Multi-source verification, bias elimination |
| Specialized domains | Market research, academic research, technology research |
| Core principle | "Accuracy" > "Comprehensiveness" > "Speed" |

## Next Guides to Read

- [02-customer-support.md](./02-customer-support.md) -- Customer support agents
- [03-data-agents.md](./03-data-agents.md) -- Data analysis agents
- [../01-patterns/01-multi-agent.md](../01-patterns/01-multi-agent.md) -- Collaborative research with multi-agents

## References

1. Nakano, R. et al., "WebGPT: Browser-assisted question-answering with human feedback" (2022) -- https://arxiv.org/abs/2112.09332
2. Trivedi, H. et al., "Interleaving Retrieval with Chain-of-Thought Reasoning for Knowledge-Intensive Multi-Step Questions" (2023) -- https://arxiv.org/abs/2212.10509
3. Semantic Scholar API -- https://api.semanticscholar.org/
4. Shuster, K. et al., "Retrieval Augmentation Reduces Hallucination in Conversation" (2021) -- https://arxiv.org/abs/2104.07567
5. Lewis, P. et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (2020) -- https://arxiv.org/abs/2005.11401
