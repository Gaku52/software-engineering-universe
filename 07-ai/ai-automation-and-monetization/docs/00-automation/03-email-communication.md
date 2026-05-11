# Email/Communication Automation — Auto-Reply, Summarization, Classification

> A practical guide to integrating AI into email and business communication, covering the design and implementation of auto-replies, summary generation, and priority classification.

---

## What You Will Learn

1. **Email AI Classification System** — Design and implementation of automatic category classification and priority determination for incoming emails
2. **AI Auto-Reply Engine** — Reply draft generation based on contextual understanding with tone control
3. **Communication Summarization** — Automatic summarization of long email threads, meeting notes, and chat logs
4. **Multi-Channel Integration** — Unified communication management across Slack, Teams, chat, and more
5. **Operational Design and KPIs** — Accuracy monitoring, cost management, and phased automation in practice
6. **Security and Compliance** — PII protection, GDPR/APPI compliance, and audit logs


## Prerequisites

The following knowledge will help you understand this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Document Processing — OCR, PDF Analysis, Contract Analysis](./02-document-processing.md)

---

## 1. Email AI Processing Architecture

### 1.1 Overview

```
┌──────────────────────────────────────────────────────────┐
│           Email AI Processing Pipeline                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Receive      Analyze        Decide        Action        │
│  ┌─────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │IMAP │─▶│Classify  │─▶│Routing   │─▶│Auto Reply│    │
│  │/API │  │Sentiment │  │Priority  │  │Forward   │    │
│  │     │  │Intent    │  │Assign    │  │Create Task│    │
│  └─────┘  └──────────┘  └──────────┘  └──────────┘    │
│      │         │              │              │          │
│      ▼         ▼              ▼              ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Dashboard & Logs                    │    │
│  │  Metrics | Accuracy | Cost | Response Time      │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Email Processing Lifecycle

```
Receive → Preprocess → AI Analysis → Decision → Action → Learning

  ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐
  │ 1 │──▶│ 2 │──▶│ 3 │──▶│ 4 │──▶│ 5 │──▶│ 6 │
  └───┘   └───┘   └───┘   └───┘   └───┘   └───┘
  Receive  HTML   Classify Urgent? Reply  Feed-
  Parse    →Text  Sentiment Spam?  Forward back
           Header Intent   VIP?   Task   Accuracy
                                         Improve
```

### 1.3 Technology Stack Selection Guide

```
┌──────────────────────────────────────────────────────────────┐
│          Email Automation Technology Stack Comparison         │
├──────────────┬────────────────────────────────────────────────┤
│ Component    │ Options and Recommendations                    │
├──────────────┼────────────────────────────────────────────────┤
│ Email Receive │ Gmail API (recommended) / Microsoft Graph / IMAP │
│ AI Processing │ Claude API (recommended) / GPT-4 / Gemini     │
│ Queuing      │ Redis + BullMQ (recommended) / SQS / RabbitMQ │
│ Data Storage │ PostgreSQL (recommended) / Supabase / DynamoDB │
│ Workflow     │ n8n (recommended) / Zapier / Temporal          │
│ Frontend     │ Next.js (recommended) / React / Vue            │
│ Monitoring   │ Grafana + Prometheus / Datadog / New Relic     │
│ Notification │ Slack Webhook / Discord / LINE Notify          │
└──────────────┴────────────────────────────────────────────────┘

Selection criteria:
  ● Individual/Small: Gmail API + Claude API + Supabase + n8n
  ● Mid-size team: Microsoft Graph + Claude API + PostgreSQL + Temporal
  ● Enterprise: On-prem MTA + Self-hosted LLM + Kubernetes
```

### 1.4 Detailed Data Flow Design

```python
# Detailed data flow definition for the email pipeline
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
from enum import Enum


class ProcessingStage(Enum):
    """Processing stage definitions"""
    RECEIVED = "received"
    PREPROCESSED = "preprocessed"
    CLASSIFIED = "classified"
    ROUTED = "routed"
    ACTION_TAKEN = "action_taken"
    FEEDBACK_COLLECTED = "feedback_collected"


@dataclass
class EmailMessage:
    """Unified data model for email messages"""
    message_id: str
    thread_id: str
    sender: str
    sender_name: str
    recipients: list[str]
    cc: list[str] = field(default_factory=list)
    subject: str = ""
    body_text: str = ""
    body_html: str = ""
    attachments: list[dict] = field(default_factory=list)
    headers: dict = field(default_factory=dict)
    received_at: datetime = field(default_factory=datetime.now)
    labels: list[str] = field(default_factory=list)

    # AI processing results
    stage: ProcessingStage = ProcessingStage.RECEIVED
    classification: Optional[dict] = None
    sentiment: Optional[str] = None
    priority: Optional[str] = None
    suggested_reply: Optional[str] = None
    action_taken: Optional[str] = None
    processing_time_ms: int = 0
    ai_cost_usd: float = 0.0

    def to_ai_context(self) -> str:
        """Convert to context string for AI processing"""
        return (
            f"From: {self.sender_name} <{self.sender}>\n"
            f"To: {', '.join(self.recipients)}\n"
            f"CC: {', '.join(self.cc)}\n"
            f"Subject: {self.subject}\n"
            f"Date: {self.received_at.isoformat()}\n"
            f"---\n"
            f"{self.body_text}"
        )

    def estimated_tokens(self) -> int:
        """Rough token estimate (Japanese: ~1.5 tokens per character)"""
        text_length = len(self.body_text)
        return int(text_length * 1.5)


@dataclass
class ProcessingResult:
    """Pipeline processing result"""
    message_id: str
    success: bool
    stage: ProcessingStage
    classification: Optional[dict] = None
    reply_draft: Optional[str] = None
    action: Optional[str] = None
    error: Optional[str] = None
    processing_time_ms: int = 0
    tokens_used: int = 0
    cost_usd: float = 0.0
    confidence: float = 0.0
```

---

## 2. Email Classification Engine

### 2.1 Classification System Implementation

```python
import anthropic
from dataclasses import dataclass
from enum import Enum

class EmailCategory(Enum):
    BILLING = "billing"
    TECHNICAL = "technical"
    SALES = "sales"
    PARTNERSHIP = "partnership"
    SPAM = "spam"
    PERSONAL = "personal"
    NEWSLETTER = "newsletter"
    SUPPORT = "support"
    COMPLAINT = "complaint"
    FEEDBACK = "feedback"
    INTERNAL = "internal"

class Priority(Enum):
    URGENT = "urgent"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

@dataclass
class EmailAnalysis:
    category: EmailCategory
    priority: Priority
    sentiment: str  # positive/neutral/negative
    intent: str
    summary: str
    suggested_action: str
    confidence: float
    language: str = "ja"
    topics: list[str] = None
    entities: list[dict] = None

class EmailClassifier:
    """AI email classification engine"""

    CLASSIFICATION_PROMPT = """
Analyze the following email and return the results in JSON format.

Analysis fields:
- category: billing / technical / sales / partnership / spam / personal / newsletter / support / complaint / feedback / internal
- priority: urgent / high / medium / low
- sentiment: positive / neutral / negative
- intent: sender's intent in one sentence
- summary: summary in 50 characters or less
- suggested_action: recommended action
- confidence: confidence score from 0.0 to 1.0
- language: language code of the email (ja / en / zh, etc.)
- topics: list of related topics (up to 3)
- entities: extracted entities (names, company names, amounts, dates, etc.)

Criteria:
- urgent: requires immediate response (incident report, billing trouble, security incident, etc.)
- high: should be handled today (important customer, deadline item, first response to complaint)
- medium: respond within 2-3 days (general inquiry, feature request)
- low: no response needed or whenever convenient (newsletter, advertisement, FYI)

Email:
From: {sender}
Subject: {subject}
Date: {date}
Body:
{body}
"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.vip_list = set()
        self.rules = []
        self.classification_cache = {}
        self.stats = {
            "total_classified": 0,
            "cache_hits": 0,
            "rule_based": 0,
            "ai_classified": 0,
        }

    def add_vip(self, email: str):
        """Add to VIP list"""
        self.vip_list.add(email.lower())

    def add_rule(self, condition: callable, result: EmailAnalysis):
        """Add custom rule"""
        self.rules.append({"condition": condition, "result": result})

    def classify(self, email: dict) -> EmailAnalysis:
        """Classify email"""
        self.stats["total_classified"] += 1

        # Rule-based preprocessing
        if self._is_obvious_spam(email):
            self.stats["rule_based"] += 1
            return EmailAnalysis(
                category=EmailCategory.SPAM,
                priority=Priority.LOW,
                sentiment="neutral",
                intent="Spam",
                summary="Spam email",
                suggested_action="Auto-delete",
                confidence=0.99
            )

        # Custom rule check
        for rule in self.rules:
            if rule"condition":
                self.stats["rule_based"] += 1
                return rule["result"]

        # Newsletter auto-detection
        if self._is_newsletter(email):
            self.stats["rule_based"] += 1
            return EmailAnalysis(
                category=EmailCategory.NEWSLETTER,
                priority=Priority.LOW,
                sentiment="neutral",
                intent="Information delivery",
                summary=f"Newsletter: {email['subject'][:30]}",
                suggested_action="Mark as read and archive",
                confidence=0.95
            )

        # AI analysis
        self.stats["ai_classified"] += 1
        prompt = self.CLASSIFICATION_PROMPT.format(**email)
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}]
        )

        result = self._parse_response(response.content[0].text)

        # VIP adjustment
        if email["sender"].lower() in self.vip_list:
            if result.priority != Priority.URGENT:
                result.priority = Priority.HIGH

        return result

    def classify_batch(self, emails: list[dict]) -> list[EmailAnalysis]:
        """Batch classification (cost-efficient)"""
        results = []
        ai_batch = []

        # Process rule-based items first
        for email in emails:
            if self._is_obvious_spam(email):
                results.append((email["message_id"], EmailAnalysis(
                    category=EmailCategory.SPAM,
                    priority=Priority.LOW,
                    sentiment="neutral",
                    intent="Spam",
                    summary="Spam email",
                    suggested_action="Auto-delete",
                    confidence=0.99
                )))
            elif self._is_newsletter(email):
                results.append((email["message_id"], EmailAnalysis(
                    category=EmailCategory.NEWSLETTER,
                    priority=Priority.LOW,
                    sentiment="neutral",
                    intent="Information delivery",
                    summary=f"Newsletter: {email['subject'][:30]}",
                    suggested_action="Archive",
                    confidence=0.95
                )))
            else:
                ai_batch.append(email)

        # Batch process those requiring AI classification
        if ai_batch:
            batch_prompt = self._build_batch_prompt(ai_batch)
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                messages=[{"role": "user", "content": batch_prompt}]
            )
            batch_results = self._parse_batch_response(
                response.content[0].text, ai_batch
            )
            results.extend(batch_results)

        return results

    def _build_batch_prompt(self, emails: list[dict]) -> str:
        """Generate prompt for batch classification"""
        email_texts = []
        for i, email in enumerate(emails):
            email_texts.append(
                f"--- Email {i+1} (ID: {email['message_id']}) ---\n"
                f"From: {email['sender']}\n"
                f"Subject: {email['subject']}\n"
                f"Body: {email['body'][:500]}\n"
            )

        return (
            "Please classify each of the following emails.\n"
            "Return category, priority, sentiment, and summary for each email "
            "as a JSON array.\n\n"
            + "\n".join(email_texts)
        )

    def _is_obvious_spam(self, email: dict) -> bool:
        """Rule-based spam detection"""
        spam_keywords = [
            "winner", "free gift", "click now",
            "unsubscribe", "opt-out", "dating",
            "make money", "side income monthly", "limited offer"
        ]
        subject_body = f"{email['subject']} {email['body']}".lower()
        match_count = sum(1 for kw in spam_keywords if kw in subject_body)
        return match_count >= 2

    def _is_newsletter(self, email: dict) -> bool:
        """Newsletter detection"""
        newsletter_indicators = [
            "list-unsubscribe" in str(email.get("headers", {})).lower(),
            "noreply" in email["sender"].lower(),
            "newsletter" in email["sender"].lower(),
            "mail.substack.com" in email["sender"].lower(),
            "delivery" in email.get("subject", "").lower(),
        ]
        return sum(newsletter_indicators) >= 2

    def _parse_response(self, text: str) -> EmailAnalysis:
        """Parse response"""
        import json
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            data = json.loads(text[start:end])
            return EmailAnalysis(
                category=EmailCategory(data["category"]),
                priority=Priority(data["priority"]),
                sentiment=data["sentiment"],
                intent=data["intent"],
                summary=data["summary"],
                suggested_action=data["suggested_action"],
                confidence=data.get("confidence", 0.8),
                language=data.get("language", "ja"),
                topics=data.get("topics", []),
                entities=data.get("entities", [])
            )
        except Exception:
            return EmailAnalysis(
                category=EmailCategory.PERSONAL,
                priority=Priority.MEDIUM,
                sentiment="neutral",
                intent="Unable to classify",
                summary="AI classification failed",
                suggested_action="Manual review",
                confidence=0.0
            )

    def _parse_batch_response(self, text, emails):
        """Parse batch response"""
        import json
        results = []
        try:
            start = text.index("[")
            end = text.rindex("]") + 1
            data_list = json.loads(text[start:end])
            for i, data in enumerate(data_list):
                msg_id = emails[i]["message_id"]
                analysis = EmailAnalysis(
                    category=EmailCategory(data.get("category", "personal")),
                    priority=Priority(data.get("priority", "medium")),
                    sentiment=data.get("sentiment", "neutral"),
                    intent=data.get("intent", ""),
                    summary=data.get("summary", ""),
                    suggested_action=data.get("suggested_action", "Manual review"),
                    confidence=data.get("confidence", 0.7)
                )
                results.append((msg_id, analysis))
        except Exception:
            for email in emails:
                results.append((email["message_id"], EmailAnalysis(
                    category=EmailCategory.PERSONAL,
                    priority=Priority.MEDIUM,
                    sentiment="neutral",
                    intent="Batch classification failed",
                    summary="Manual review required",
                    suggested_action="Manual review",
                    confidence=0.0
                )))
        return results

    def get_stats(self) -> dict:
        """Get classification statistics"""
        total = self.stats["total_classified"]
        if total == 0:
            return self.stats
        return {
            **self.stats,
            "rule_based_pct": round(
                self.stats["rule_based"] / total * 100, 1
            ),
            "ai_classified_pct": round(
                self.stats["ai_classified"] / total * 100, 1
            ),
        }
```

### 2.2 Classification Accuracy Comparison

| Method | Accuracy | Speed | Cost/1000 emails | Use case |
|---------|------|------|-------------|---------|
| Keyword matching | 60-70% | Instant | $0 | Simple filter |
| Rule-based | 75-85% | Instant | $0 | Fixed patterns |
| Traditional ML (SVM/NB) | 85-90% | Fast | ~$0.01 | High-volume processing |
| GPT-3.5-turbo | 90-93% | Medium | ~$0.50 | Cost-focused |
| GPT-4 / Claude | 95-98% | Slow | ~$5.00 | Accuracy-focused |
| Hybrid | 96-99% | Medium | ~$1.00 | Optimal balance |

### 2.3 Hybrid Classification Strategy Details

```python
class HybridClassificationStrategy:
    """Hybrid classification strategy combining rule-based + ML + LLM"""

    def __init__(self, classifier: EmailClassifier):
        self.classifier = classifier
        self.ml_model = None  # Pre-trained model (scikit-learn, etc.)
        self.confidence_threshold = 0.85

    def classify(self, email: dict) -> EmailAnalysis:
        """3-stage fallback classification"""

        # Stage 1: Rule-based (zero cost, instant)
        rule_result = self._rule_based_classify(email)
        if rule_result and rule_result.confidence >= 0.95:
            rule_result.suggested_action += " [Rule-based]"
            return rule_result

        # Stage 2: ML model (minimal cost, fast)
        if self.ml_model:
            ml_result = self._ml_classify(email)
            if ml_result and ml_result.confidence >= self.confidence_threshold:
                ml_result.suggested_action += " [ML]"
                return ml_result

        # Stage 3: LLM (higher cost, high accuracy)
        llm_result = self.classifier.classify(email)
        llm_result.suggested_action += " [LLM]"
        return llm_result

    def _rule_based_classify(self, email: dict) -> EmailAnalysis | None:
        """Rule-based classification"""
        subject = email.get("subject", "").lower()
        sender = email.get("sender", "").lower()
        body = email.get("body", "").lower()

        # Billing-related
        billing_keywords = ["billing", "invoice", "payment", "fee", "plan change"]
        if any(kw in subject or kw in body[:200] for kw in billing_keywords):
            return EmailAnalysis(
                category=EmailCategory.BILLING,
                priority=Priority.HIGH,
                sentiment="neutral",
                intent="Billing-related inquiry",
                summary=f"Billing: {email['subject'][:30]}",
                suggested_action="Forward to billing team",
                confidence=0.92
            )

        # Incident report
        incident_keywords = [
            "outage", "down", "error", "not working",
            "broken", "bug", "500 error", "timeout"
        ]
        if any(kw in subject or kw in body[:300] for kw in incident_keywords):
            return EmailAnalysis(
                category=EmailCategory.TECHNICAL,
                priority=Priority.URGENT,
                sentiment="negative",
                intent="Incident or bug report",
                summary=f"Incident report: {email['subject'][:30]}",
                suggested_action="Immediate escalation to engineering team",
                confidence=0.90
            )

        # Cancellation/withdrawal
        churn_keywords = ["cancel", "unsubscribe", "quit", "terminate", "withdraw"]
        if any(kw in subject or kw in body[:300] for kw in churn_keywords):
            return EmailAnalysis(
                category=EmailCategory.SUPPORT,
                priority=Priority.HIGH,
                sentiment="negative",
                intent="Cancellation/withdrawal request",
                summary=f"Cancellation request: {email['subject'][:30]}",
                suggested_action="Forward to customer success (retention response)",
                confidence=0.93
            )

        return None

    def _ml_classify(self, email: dict) -> EmailAnalysis | None:
        """Classification using pre-trained ML model"""
        if not self.ml_model:
            return None

        features = self._extract_features(email)
        prediction = self.ml_model.predict([features])
        confidence = max(self.ml_model.predict_proba([features])[0])

        if confidence < self.confidence_threshold:
            return None

        category_map = {
            0: EmailCategory.BILLING,
            1: EmailCategory.TECHNICAL,
            2: EmailCategory.SALES,
            3: EmailCategory.SUPPORT,
            4: EmailCategory.SPAM,
            5: EmailCategory.NEWSLETTER,
            6: EmailCategory.PERSONAL,
        }

        return EmailAnalysis(
            category=category_map.get(prediction[0], EmailCategory.PERSONAL),
            priority=Priority.MEDIUM,
            sentiment="neutral",
            intent="ML classification result",
            summary=email["subject"][:50],
            suggested_action="Auto-classified",
            confidence=float(confidence)
        )

    def _extract_features(self, email: dict) -> list:
        """Extract features from email"""
        subject = email.get("subject", "")
        body = email.get("body", "")
        return [
            len(subject),
            len(body),
            body.count("?"),
            body.count("!"),
            1 if "noreply" in email.get("sender", "") else 0,
            len(email.get("cc", [])),
            len(email.get("attachments", [])),
        ]
```

### 2.4 Detailed Category Definitions

```python
# Detailed definitions and automatic action mappings for each category
CATEGORY_CONFIG = {
    "billing": {
        "display_name": "Billing & Payment",
        "description": "Emails related to fees, invoices, plan changes, and refunds",
        "auto_actions": [
            "Notify billing team's Slack channel",
            "Create inquiry ticket in CRM",
            "Auto-fetch and attach customer contract information",
        ],
        "sla_hours": 4,
        "escalation_after_hours": 8,
        "template_replies": {
            "price_inquiry": "Thank you for your inquiry about pricing...",
            "refund_request": "We have received your refund request...",
            "plan_change": "Here is the information on plan change procedures...",
        },
        "keywords_ja": ["請求", "料金", "支払い", "返金", "プラン", "契約"],
        "keywords_en": ["billing", "invoice", "payment", "refund", "plan"],
    },
    "technical": {
        "display_name": "Technical Support",
        "description": "Bug reports, feature usage questions, and API-related technical inquiries",
        "auto_actions": [
            "Add to technical support queue",
            "Auto-search related FAQ/documentation",
            "Cross-reference with error logs (last 24 hours)",
        ],
        "sla_hours": 8,
        "escalation_after_hours": 24,
        "template_replies": {
            "bug_report": "Thank you for reporting this bug...",
            "how_to": "Here is an explanation of the feature you asked about...",
            "api_question": "Here is the answer regarding the API specification...",
        },
        "keywords_ja": ["エラー", "バグ", "動かない", "使い方", "API"],
        "keywords_en": ["error", "bug", "not working", "how to", "API"],
    },
    "sales": {
        "display_name": "Sales",
        "description": "New inquiries, demo requests, and quote requests",
        "auto_actions": [
            "Register lead in CRM",
            "Notify sales team via Slack",
            "Auto-research company information",
        ],
        "sla_hours": 2,
        "escalation_after_hours": 4,
        "template_replies": {
            "demo_request": "Thank you for requesting a demo...",
            "pricing_inquiry": "Here is our response regarding pricing...",
            "trial_request": "Here is information about our trial...",
        },
        "keywords_ja": ["導入", "検討", "デモ", "見積", "価格"],
        "keywords_en": ["demo", "pricing", "trial", "enterprise", "quote"],
    },
    "complaint": {
        "display_name": "Complaints",
        "description": "Emails containing dissatisfaction, complaints, or strong improvement requests",
        "auto_actions": [
            "Immediately notify manager",
            "Auto-retrieve past interaction history",
            "Register escalation in complaint management system",
        ],
        "sla_hours": 1,
        "escalation_after_hours": 2,
        "template_replies": {
            "service_complaint": "We sincerely apologize for the inconvenience caused...",
            "quality_issue": "We take your feedback on quality very seriously...",
        },
        "keywords_ja": ["不満", "ひどい", "最悪", "怒り", "訴える", "消費者庁"],
        "keywords_en": ["terrible", "worst", "unacceptable", "lawsuit"],
    },
}
```

---

## 3. AI Auto-Reply Engine

### 3.1 Reply Generation System

```python
class AutoReplyEngine:
    """AI auto-reply engine"""

    REPLY_PROMPT = """
You are a customer support representative for {company_name}.
Please create a reply draft for the following email.

Tone: {tone}
Language: English
Signature: {signature}

Rules:
- Be polite but concise
- Provide specific solutions
- Be honest about unknowns and state that you will follow up
- Do not include personal information
- Suggest one clear action per email
- Address the customer by name (if known)

Original email:
From: {sender_name} <{sender_email}>
Subject: {subject}
Body:
{body}

Previous exchanges (if any):
{thread_history}

Knowledge base reference (if any):
{knowledge_context}
"""

    def __init__(self, api_key: str, company_name: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.company_name = company_name
        self.templates = {}
        self.knowledge_base = None
        self.tone_configs = {
            "professional": {
                "description": "Standard polite business tone",
                "examples": ["Thank you for reaching out", "Please do not hesitate to let us know"],
                "avoid": ["Sure thing", "OK", "Yep"],
            },
            "friendly": {
                "description": "Approachable and warm tone",
                "examples": ["Thanks so much!", "Feel free to reach out anytime"],
                "avoid": ["Dear Sir/Madam", "Yours faithfully", "To Whom It May Concern"],
            },
            "formal": {
                "description": "Very formal tone (official apologies, etc.)",
                "examples": ["We sincerely apologize", "We deeply regret"],
                "avoid": ["Sorry about that", "My bad"],
            },
            "empathetic": {
                "description": "Empathetic tone (complaint handling, etc.)",
                "examples": [
                    "We apologize for the inconvenience",
                    "We fully understand your frustration"
                ],
                "avoid": ["However", "But"],
            },
        }

    def generate_reply(self, email: dict,
                       tone: str = "professional",
                       thread_history: str = "",
                       knowledge_context: str = "") -> dict:
        """Generate reply draft"""
        signature = self._get_signature(email.get("assigned_to"))

        prompt = self.REPLY_PROMPT.format(
            company_name=self.company_name,
            tone=self._get_tone_instruction(tone),
            signature=signature,
            sender_name=email.get("sender_name", ""),
            sender_email=email["sender"],
            subject=email["subject"],
            body=email["body"],
            thread_history=thread_history or "None",
            knowledge_context=knowledge_context or "None"
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        reply_text = response.content[0].text
        confidence = self._assess_confidence(reply_text, email)

        return {
            "subject": f"Re: {email['subject']}",
            "body": reply_text,
            "status": self._determine_status(confidence, email),
            "confidence": confidence,
            "tone": tone,
            "tokens_used": (
                response.usage.input_tokens + response.usage.output_tokens
            ),
            "model": "claude-sonnet-4-20250514",
        }

    def generate_multiple_drafts(
        self, email: dict, tones: list[str] = None
    ) -> list[dict]:
        """Generate drafts for multiple tones simultaneously"""
        if tones is None:
            tones = ["professional", "friendly"]

        drafts = []
        for tone in tones:
            draft = self.generate_reply(email, tone=tone)
            draft["tone_label"] = self.tone_configs[tone]["description"]
            drafts.append(draft)

        return drafts

    def _get_tone_instruction(self, tone: str) -> str:
        """Generate detailed tone instructions"""
        config = self.tone_configs.get(tone, self.tone_configs["professional"])
        return (
            f"{config['description']}\n"
            f"Example phrases: {', '.join(config['examples'])}\n"
            f"Phrases to avoid: {', '.join(config['avoid'])}"
        )

    def _assess_confidence(self, reply: str, email: dict) -> float:
        """Assess reply confidence score"""
        score = 0.8

        # Length check
        if len(reply) < 50:
            score -= 0.2  # Too short
        elif len(reply) > 2000:
            score -= 0.1  # Too long

        # Uncertainty expressions
        uncertain_phrases = ["confirm", "look into", "unable to", "unclear"]
        uncertainty_count = sum(
            1 for phrase in uncertain_phrases if phrase in reply
        )
        score -= uncertainty_count * 0.05

        # Human review recommended for urgent cases
        if email.get("priority") == "urgent":
            score -= 0.15

        # Handle complaints with extra care
        if email.get("category") == "complaint":
            score -= 0.2

        # Be careful when amounts are mentioned
        import re
        if re.search(r'[¥$€]\d+|円|ドル', reply):
            score -= 0.1

        return max(0.0, min(1.0, score))

    def _determine_status(self, confidence: float, email: dict) -> str:
        """Determine status based on confidence score"""
        category = email.get("category", "")
        priority = email.get("priority", "medium")

        # High-risk categories always require draft review
        if category in ["complaint", "billing"]:
            return "draft_review_required"

        # Urgent cases require human review
        if priority == "urgent":
            return "draft_review_required"

        # Confidence-based decision
        if confidence >= 0.9:
            return "ready_to_send"
        elif confidence >= 0.7:
            return "draft"
        else:
            return "needs_human_review"

    def _get_signature(self, assigned_to: str = None) -> str:
        return f"""
--
{self.company_name} Customer Support
{assigned_to or "Support Team"}
"""
```

### 3.2 Tone Control Matrix

```
Tone control parameters:

  Formality
  High ┤ ● Official apology  ● Contract-related  ● Legal matters
       │
  Med  ┤ ● General support   ● Business proposal ● New customer
       │
  Low  ┤ ● Internal comms    ● Casual inquiry    ● Existing customer FU
       └──┬────────────┬────────────┬──────────┬──
         Calm        Neutral     Friendly   Enthusiastic
                  Emotional tone

  Recommended tone by category:
  ┌───────────────┬──────────────┬────────────────┐
  │ Category      │ Recommended  │ Notes          │
  ├───────────────┼──────────────┼────────────────┤
  │ Complaint     │ formal +     │ Start with     │
  │               │ empathetic   │ apology first  │
  │               │              │ No excuses     │
  ├───────────────┼──────────────┼────────────────┤
  │ Tech support  │ professional │ Explain jargon │
  │               │              │ Clear steps    │
  ├───────────────┼──────────────┼────────────────┤
  │ Sales inquiry │ friendly +   │ No hard sell   │
  │               │ professional │ Show next step │
  ├───────────────┼──────────────┼────────────────┤
  │ Churn prevent │ empathetic + │ Don't over-    │
  │               │ professional │ retain; offer  │
  │               │              │ alternatives   │
  └───────────────┴──────────────┴────────────────┘
```

### 3.3 Improving Reply Quality with Knowledge Base Integration

```python
class KnowledgeAugmentedReplyEngine:
    """Reply engine with knowledge base integration (RAG approach)"""

    def __init__(self, reply_engine: AutoReplyEngine, vector_store):
        self.reply_engine = reply_engine
        self.vector_store = vector_store  # Pinecone, Qdrant, pgvector, etc.

    def generate_reply_with_knowledge(
        self, email: dict, top_k: int = 5
    ) -> dict:
        """Generate reply referencing knowledge base"""

        # 1. Search for relevant knowledge
        query = f"{email['subject']} {email['body'][:300]}"
        relevant_docs = self.vector_store.similarity_search(
            query=query,
            top_k=top_k,
            filter={"type": {"$in": ["faq", "doc", "past_reply"]}}
        )

        # 2. Build context
        knowledge_context = self._build_context(relevant_docs)

        # 3. Retrieve similar past responses
        past_replies = self._find_similar_past_replies(email)

        # 4. Generate reply with knowledge
        reply = self.reply_engine.generate_reply(
            email=email,
            knowledge_context=knowledge_context,
            thread_history=past_replies
        )

        # 5. Attach source references
        reply["references"] = [
            {
                "title": doc.metadata.get("title", ""),
                "url": doc.metadata.get("url", ""),
                "relevance_score": doc.metadata.get("score", 0),
            }
            for doc in relevant_docs
        ]

        return reply

    def _build_context(self, docs: list) -> str:
        """Build context string from search results"""
        context_parts = []
        for i, doc in enumerate(docs, 1):
            context_parts.append(
                f"[Reference {i}] {doc.metadata.get('title', 'Untitled')}\n"
                f"{doc.page_content[:500]}\n"
            )
        return "\n---\n".join(context_parts)

    def _find_similar_past_replies(self, email: dict) -> str:
        """Search for similar past email responses"""
        results = self.vector_store.similarity_search(
            query=email["body"][:200],
            top_k=3,
            filter={"type": "past_reply", "rating": {"$gte": 4}}
        )
        if not results:
            return "No similar past responses found"

        past = []
        for r in results:
            past.append(
                f"[Past response example]\n"
                f"Original email: {r.metadata.get('original_subject', '')}\n"
                f"Reply: {r.page_content[:300]}..."
            )
        return "\n\n".join(past)

    def feedback_loop(self, reply_id: str, rating: int, comment: str = ""):
        """Record reply quality feedback and use for learning"""
        self.vector_store.update_metadata(
            id=reply_id,
            metadata={
                "rating": rating,
                "feedback_comment": comment,
                "feedback_at": datetime.now().isoformat(),
            }
        )

        # Add highly-rated replies to the knowledge base
        if rating >= 4:
            reply_data = self.vector_store.get(reply_id)
            self.vector_store.upsert(
                id=f"past_reply_{reply_id}",
                content=reply_data["content"],
                metadata={
                    "type": "past_reply",
                    "rating": rating,
                    "category": reply_data.get("category", ""),
                    "original_subject": reply_data.get("subject", ""),
                }
            )
```

---

## 4. Email Thread Summarization

### 4.1 Thread Summarization Engine

```python
class ThreadSummarizer:
    """Email thread summarization engine"""

    SUMMARY_PROMPT = """
Analyze the following email thread and create a structured summary.

Output format:
1. Overview (2-3 sentences)
2. Participants and roles
3. Timeline of events
4. Current status
5. Unresolved issues
6. Required actions

Thread:
{thread}
"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def summarize_thread(self, messages: list[dict]) -> dict:
        """Summarize the entire thread"""
        thread_text = self._format_thread(messages)

        # Process long threads in chunks
        if len(thread_text) > 10000:
            return self._summarize_long_thread(messages)

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": self.SUMMARY_PROMPT.format(thread=thread_text)
            }]
        )
        return {
            "summary": response.content[0].text,
            "message_count": len(messages),
            "participants": list({m["sender"] for m in messages}),
            "date_range": {
                "start": messages[0]["date"],
                "end": messages[-1]["date"],
            },
        }

    def _summarize_long_thread(self, messages: list[dict]) -> dict:
        """Hierarchical summarization for long threads"""
        # Phase 1: Summarize each email individually
        individual_summaries = []
        for msg in messages:
            summary = self._summarize_single(msg)
            individual_summaries.append(summary)

        # Phase 2: Consolidate individual summaries
        combined = "\n".join(
            f"[{s['date']}] {s['from']}: {s['summary']}"
            for s in individual_summaries
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": f"Please integrate the following email summaries into a final consolidated summary:\n{combined}"
            }]
        )
        return {
            "summary": response.content[0].text,
            "method": "hierarchical",
            "message_count": len(messages),
        }

    def _summarize_single(self, msg: dict) -> dict:
        """Summarize an individual email"""
        response = self.client.messages.create(
            model="claude-haiku-4-20250514",  # Haiku is sufficient for individual summaries
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": (
                    f"Please summarize the following email in 1-2 sentences:\n"
                    f"From: {msg['sender']}\n"
                    f"Date: {msg['date']}\n"
                    f"Body: {msg['body'][:1000]}"
                )
            }]
        )
        return {
            "from": msg["sender"],
            "date": msg["date"],
            "summary": response.content[0].text,
        }

    def _format_thread(self, messages: list[dict]) -> str:
        """Format thread as text"""
        parts = []
        for msg in messages:
            parts.append(
                f"---\nFrom: {msg['sender']}\n"
                f"Date: {msg['date']}\n"
                f"Subject: {msg['subject']}\n\n"
                f"{msg['body']}\n"
            )
        return "\n".join(parts)

    def generate_action_items(self, thread_summary: str) -> list[dict]:
        """Extract action items from summary"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": (
                    "Extract action items from the following email thread summary and "
                    "return them as a JSON array.\n"
                    "Each item: {\"task\": \"task description\", \"assignee\": \"person\", "
                    "\"deadline\": \"deadline\", \"priority\": \"high/medium/low\"}\n\n"
                    f"Summary:\n{thread_summary}"
                )
            }]
        )
        import json
        try:
            text = response.content[0].text
            start = text.index("[")
            end = text.rindex("]") + 1
            return json.loads(text[start:end])
        except Exception:
            return []
```

### 4.2 Meeting Notes Summarization

```python
class MeetingSummarizer:
    """AI summarization for meeting notes"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def summarize_meeting(self, transcript: str,
                          meeting_type: str = "general") -> dict:
        """Create structured summary from meeting notes"""
        type_instructions = {
            "general": "Create a summary for a general meeting",
            "standup": "Extract key points from daily standup",
            "sprint_review": "Organize sprint review outcomes and issues",
            "retrospective": "Organize Keep/Problem/Try from retrospective",
            "sales": "Clarify sales meeting progress and next actions",
            "one_on_one": "Organize 1-on-1 discussion content and follow-up items",
        }

        instruction = type_instructions.get(meeting_type, type_instructions["general"])

        prompt = f"""
Analyze the following meeting transcript and summarize in JSON format.
Meeting type: {meeting_type}
Instructions: {instruction}

Output format:
{{
  "title": "Meeting title",
  "type": "{meeting_type}",
  "date": "Date",
  "participants": ["List of participants"],
  "duration": "Duration",
  "summary": "3-line summary",
  "key_points": ["Key discussion points"],
  "decisions": ["Decisions made"],
  "action_items": [
    {{"task": "Task description", "assignee": "Assignee", "deadline": "Deadline"}}
  ],
  "open_issues": ["Unresolved issues"],
  "risks": ["Risks or concerns"],
  "next_meeting": "Next meeting schedule"
}}

Meeting transcript:
{transcript}
"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )
        return self._parse_json(response.content[0].text)

    def summarize_from_audio(self, audio_path: str) -> dict:
        """Pipeline to generate meeting summary from audio file"""
        # Step 1: Audio to text conversion (Whisper, etc.)
        transcript = self._transcribe_audio(audio_path)

        # Step 2: Speaker diarization
        diarized = self._diarize_transcript(transcript)

        # Step 3: AI summarization
        return self.summarize_meeting(diarized)

    def _transcribe_audio(self, audio_path: str) -> str:
        """Transcribe audio file"""
        import openai
        client = openai.OpenAI()
        with open(audio_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="ja",
                response_format="verbose_json",
            )
        return transcript.text

    def _diarize_transcript(self, transcript: str) -> str:
        """Speaker diarization (simplified implementation)"""
        # In practice, use pyannote-audio, etc.
        return transcript

    def _parse_json(self, text: str) -> dict:
        """JSON parsing with error tolerance"""
        import json
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except Exception:
            return {"raw_summary": text, "parse_error": True}
```

### 4.3 Slack Message Summarization

```python
class SlackSummarizer:
    """Summarization engine for Slack channels/threads"""

    def __init__(self, api_key: str, slack_token: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.slack_token = slack_token

    def summarize_channel(
        self, channel_id: str, hours: int = 24
    ) -> dict:
        """Summarize the last N hours of a channel"""
        import requests
        from datetime import datetime, timedelta

        oldest = (datetime.now() - timedelta(hours=hours)).timestamp()

        response = requests.get(
            "https://slack.com/api/conversations.history",
            headers={"Authorization": f"Bearer {self.slack_token}"},
            params={
                "channel": channel_id,
                "oldest": str(oldest),
                "limit": 200,
            }
        )
        messages = response.json().get("messages", [])

        if not messages:
            return {"summary": "No messages during this period"}

        # Format messages
        formatted = []
        for msg in reversed(messages):  # Chronological order
            user = msg.get("user", "unknown")
            text = msg.get("text", "")
            ts = datetime.fromtimestamp(
                float(msg["ts"])
            ).strftime("%H:%M")
            formatted.append(f"[{ts}] {user}: {text}")

        thread_text = "\n".join(formatted)

        # AI summarization
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": (
                    f"Please summarize the following Slack channel messages.\n"
                    f"Period: Last {hours} hours\n"
                    f"Output: Overview, key discussions, decisions, action items\n\n"
                    f"Messages:\n{thread_text}"
                )
            }]
        )

        return {
            "summary": response.content[0].text,
            "channel_id": channel_id,
            "period_hours": hours,
            "message_count": len(messages),
            "unique_participants": len({m.get("user") for m in messages}),
        }

    def daily_digest(self, channel_ids: list[str]) -> str:
        """Generate daily digest for multiple channels"""
        digests = []
        for ch_id in channel_ids:
            summary = self.summarize_channel(ch_id, hours=24)
            digests.append(summary)

        # Consolidated digest for all channels
        combined = "\n\n".join(
            f"## #{d.get('channel_name', d['channel_id'])}\n"
            f"Messages: {d['message_count']}\n"
            f"{d['summary']}"
            for d in digests
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": (
                    "Please integrate the following summaries from each channel into "
                    "a daily digest for the entire team.\n"
                    "Organize by importance, with urgent items at the top.\n\n"
                    f"{combined}"
                )
            }]
        )

        return response.content[0].text
```

---

## 5. Integrated Workflow

### 5.1 Fully Automated Flow

```
Fully automated email workflow:

  Receive ──▶ Classify ──▶ Route
                 │
    ┌────────────┼──────────┬──────────────┐
    ▼            ▼          ▼              ▼
 [Spam]     [Support]   [Sales]       [Other]
    │            │          │              │
 Auto-delete  ┌──┴──┐   CRM register   Hold in Inbox
              │     │
           [Auto]  [Manual]
              │     │
           Draft   Notify
           generate agent
              │
           Confidence
           check
            │    │
          ≥0.8  <0.8
            │    │
          Auto  Human
          send  review
```

### 5.2 Gmail API Integration Implementation

```python
import base64
from email.mime.text import MIMEText
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


class GmailIntegration:
    """Integration class for Gmail API"""

    def __init__(self, credentials_path: str):
        self.creds = Credentials.from_authorized_user_file(
            credentials_path,
            scopes=[
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.send",
                "https://www.googleapis.com/auth/gmail.modify",
            ]
        )
        self.service = build("gmail", "v1", credentials=self.creds)

    def fetch_unread(self, max_results: int = 50) -> list[dict]:
        """Fetch unread emails"""
        results = self.service.users().messages().list(
            userId="me",
            q="is:unread",
            maxResults=max_results
        ).execute()

        messages = results.get("messages", [])
        emails = []

        for msg_ref in messages:
            msg = self.service.users().messages().get(
                userId="me",
                id=msg_ref["id"],
                format="full"
            ).execute()

            email_data = self._parse_message(msg)
            emails.append(email_data)

        return emails

    def _parse_message(self, msg: dict) -> dict:
        """Parse Gmail message"""
        headers = {
            h["name"].lower(): h["value"]
            for h in msg["payload"]["headers"]
        }

        body = ""
        if "parts" in msg["payload"]:
            for part in msg["payload"]["parts"]:
                if part["mimeType"] == "text/plain":
                    data = part["body"].get("data", "")
                    body = base64.urlsafe_b64decode(data).decode("utf-8")
                    break
        elif "body" in msg["payload"]:
            data = msg["payload"]["body"].get("data", "")
            if data:
                body = base64.urlsafe_b64decode(data).decode("utf-8")

        return {
            "message_id": msg["id"],
            "thread_id": msg["threadId"],
            "sender": headers.get("from", ""),
            "sender_name": self._extract_name(headers.get("from", "")),
            "recipients": headers.get("to", "").split(","),
            "subject": headers.get("subject", ""),
            "date": headers.get("date", ""),
            "body": body,
            "labels": msg.get("labelIds", []),
            "headers": headers,
        }

    def _extract_name(self, from_header: str) -> str:
        """Extract name from From header"""
        if "<" in from_header:
            return from_header.split("<")[0].strip().strip('"')
        return from_header

    def send_reply(self, original_msg_id: str,
                   thread_id: str,
                   to: str,
                   subject: str,
                   body: str) -> dict:
        """Send reply email"""
        message = MIMEText(body, "plain", "utf-8")
        message["to"] = to
        message["subject"] = subject
        message["In-Reply-To"] = original_msg_id
        message["References"] = original_msg_id

        raw = base64.urlsafe_b64encode(
            message.as_bytes()
        ).decode("utf-8")

        result = self.service.users().messages().send(
            userId="me",
            body={
                "raw": raw,
                "threadId": thread_id,
            }
        ).execute()

        return result

    def add_label(self, message_id: str, label_name: str):
        """Add label to email"""
        # Get label ID (existing or create new)
        label_id = self._get_or_create_label(label_name)

        self.service.users().messages().modify(
            userId="me",
            id=message_id,
            body={
                "addLabelIds": [label_id],
            }
        ).execute()

    def _get_or_create_label(self, label_name: str) -> str:
        """Get or create label"""
        labels = self.service.users().labels().list(
            userId="me"
        ).execute()

        for label in labels.get("labels", []):
            if label["name"] == label_name:
                return label["id"]

        # Create new label
        new_label = self.service.users().labels().create(
            userId="me",
            body={
                "name": label_name,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show",
            }
        ).execute()

        return new_label["id"]

    def mark_as_read(self, message_id: str):
        """Mark as read"""
        self.service.users().messages().modify(
            userId="me",
            id=message_id,
            body={"removeLabelIds": ["UNREAD"]}
        ).execute()
```

### 5.3 n8n Workflow Definition

```json
{
  "name": "AI Email Automation Pipeline",
  "nodes": [
    {
      "name": "Gmail Trigger",
      "type": "n8n-nodes-base.gmailTrigger",
      "parameters": {
        "pollTimes": { "item": [{ "mode": "everyMinute", "minute": 5 }] },
        "filters": { "readStatus": "unread" }
      },
      "position": [100, 300]
    },
    {
      "name": "Extract Email Data",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            { "name": "sender", "value": "={{ $json.from }}" },
            { "name": "subject", "value": "={{ $json.subject }}" },
            { "name": "body", "value": "={{ $json.textPlain }}" }
          ]
        }
      },
      "position": [300, 300]
    },
    {
      "name": "AI Classification",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://api.anthropic.com/v1/messages",
        "headers": {
          "x-api-key": "={{ $credentials.anthropicApiKey }}",
          "content-type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        "body": "={{ JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 512, messages: [{ role: 'user', content: 'Classify this email: ' + $json.body }] }) }}"
      },
      "position": [500, 300]
    },
    {
      "name": "Route by Category",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": [
          { "value": "spam", "output": 0 },
          { "value": "support", "output": 1 },
          { "value": "sales", "output": 2 },
          { "value": "billing", "output": 3 }
        ]
      },
      "position": [700, 300]
    },
    {
      "name": "Slack Notification",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#support-alerts",
        "text": "New email: {{ $json.subject }} from {{ $json.sender }}"
      },
      "position": [900, 200]
    },
    {
      "name": "CRM Update",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://api.hubspot.com/crm/v3/objects/contacts",
        "body": "={{ JSON.stringify({ properties: { email: $json.sender } }) }}"
      },
      "position": [900, 400]
    }
  ]
}
```

### 5.4 Microsoft Graph API Integration

```python
import msal
import requests


class OutlookIntegration:
    """Outlook integration with Microsoft Graph API"""

    GRAPH_API_URL = "https://graph.microsoft.com/v1.0"

    def __init__(self, client_id: str, client_secret: str, tenant_id: str):
        self.app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )
        self._token = None

    def _get_token(self) -> str:
        """Get access token"""
        if self._token:
            return self._token

        result = self.app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        self._token = result["access_token"]
        return self._token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
        }

    def fetch_messages(self, user_id: str,
                       folder: str = "inbox",
                       unread_only: bool = True,
                       top: int = 50) -> list[dict]:
        """Fetch messages"""
        params = {
            "$top": top,
            "$orderby": "receivedDateTime desc",
            "$select": "id,subject,from,toRecipients,body,receivedDateTime,isRead",
        }
        if unread_only:
            params["$filter"] = "isRead eq false"

        response = requests.get(
            f"{self.GRAPH_API_URL}/users/{user_id}/mailFolders/{folder}/messages",
            headers=self._headers(),
            params=params,
        )
        response.raise_for_status()

        messages = response.json().get("value", [])
        return [self._normalize_message(msg) for msg in messages]

    def _normalize_message(self, msg: dict) -> dict:
        """Convert Graph API response to common format"""
        sender = msg.get("from", {}).get("emailAddress", {})
        return {
            "message_id": msg["id"],
            "sender": sender.get("address", ""),
            "sender_name": sender.get("name", ""),
            "subject": msg.get("subject", ""),
            "body": msg.get("body", {}).get("content", ""),
            "date": msg.get("receivedDateTime", ""),
            "is_read": msg.get("isRead", False),
            "recipients": [
                r["emailAddress"]["address"]
                for r in msg.get("toRecipients", [])
            ],
        }

    def send_reply(self, user_id: str, message_id: str,
                   reply_body: str) -> dict:
        """Send reply"""
        response = requests.post(
            f"{self.GRAPH_API_URL}/users/{user_id}/messages/{message_id}/reply",
            headers=self._headers(),
            json={
                "message": {
                    "body": {
                        "contentType": "Text",
                        "content": reply_body,
                    }
                }
            }
        )
        response.raise_for_status()
        return {"status": "sent", "message_id": message_id}

    def create_category(self, user_id: str, display_name: str,
                        color: str = "preset0") -> dict:
        """Create category"""
        response = requests.post(
            f"{self.GRAPH_API_URL}/users/{user_id}/outlook/masterCategories",
            headers=self._headers(),
            json={
                "displayName": display_name,
                "color": color,
            }
        )
        return response.json()
```

---

## 6. Security and Compliance

### 6.1 PII (Personal Information) Masking

```python
import re
from typing import Tuple


class PIIMasker:
    """Automatic masking of personal information"""

    PATTERNS = {
        "email": {
            "pattern": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            "replacement": "[EMAIL_MASKED]",
            "description": "Email address",
        },
        "phone_jp": {
            "pattern": r'0\d{1,4}-?\d{1,4}-?\d{4}',
            "replacement": "[PHONE_MASKED]",
            "description": "Japanese phone number",
        },
        "credit_card": {
            "pattern": r'\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}',
            "replacement": "[CARD_MASKED]",
            "description": "Credit card number",
        },
        "my_number": {
            "pattern": r'\d{4}\s?\d{4}\s?\d{4}',
            "replacement": "[MYNUMBER_MASKED]",
            "description": "My Number (Japanese national ID)",
        },
        "postal_code": {
            "pattern": r'〒?\d{3}-?\d{4}',
            "replacement": "[POSTAL_MASKED]",
            "description": "Postal code",
        },
        "ip_address": {
            "pattern": r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',
            "replacement": "[IP_MASKED]",
            "description": "IP address",
        },
        "bank_account": {
            "pattern": r'[普通|当座]\s?\d{7,8}',
            "replacement": "[ACCOUNT_MASKED]",
            "description": "Bank account number",
        },
    }

    def mask(self, text: str,
             categories: list[str] = None) -> Tuple[str, list[dict]]:
        """Mask PII in text"""
        masked_text = text
        detections = []

        patterns_to_check = (
            {k: v for k, v in self.PATTERNS.items() if k in categories}
            if categories
            else self.PATTERNS
        )

        for pii_type, config in patterns_to_check.items():
            matches = list(re.finditer(config["pattern"], masked_text))
            for match in matches:
                detections.append({
                    "type": pii_type,
                    "description": config["description"],
                    "position": match.span(),
                    "original_length": len(match.group()),
                })
            masked_text = re.sub(
                config["pattern"],
                config["replacement"],
                masked_text
            )

        return masked_text, detections

    def unmask(self, masked_text: str,
               original_text: str,
               detections: list[dict]) -> str:
        """Unmask (use only after permission check)"""
        result = masked_text
        for det in reversed(detections):
            start, end = det["position"]
            original_value = original_text[start:end]
            result = result.replace(
                self.PATTERNS[det["type"]]["replacement"],
                original_value,
                1
            )
        return result


# Usage example
masker = PIIMasker()
text = "Sending invoice to Taro Yamada (taro@example.com). Phone: 090-1234-5678"
masked, detections = masker.mask(text)
# → "Sending invoice to Taro Yamada ([EMAIL_MASKED]). Phone: [PHONE_MASKED]"
```

### 6.2 Audit Log Design

```python
from datetime import datetime
from enum import Enum
import json
import hashlib


class AuditAction(Enum):
    EMAIL_RECEIVED = "email_received"
    EMAIL_CLASSIFIED = "email_classified"
    REPLY_GENERATED = "reply_generated"
    REPLY_SENT = "reply_sent"
    REPLY_EDITED = "reply_edited"
    ESCALATED = "escalated"
    PII_DETECTED = "pii_detected"
    PII_MASKED = "pii_masked"
    DATA_EXPORTED = "data_exported"
    SETTINGS_CHANGED = "settings_changed"


class AuditLogger:
    """Audit logger for email automation"""

    def __init__(self, db_client):
        self.db = db_client

    def log(self, action: AuditAction, details: dict,
            user_id: str = "system",
            email_id: str = None) -> str:
        """Record audit log"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action.value,
            "user_id": user_id,
            "email_id": email_id,
            "details": details,
            "checksum": self._compute_checksum(details),
        }

        # Save to DB
        result = self.db.table("audit_logs").insert(log_entry).execute()
        return result.data[0]["id"]

    def _compute_checksum(self, details: dict) -> str:
        """Checksum for tamper detection"""
        content = json.dumps(details, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def query_logs(self, filters: dict = None,
                   start_date: str = None,
                   end_date: str = None,
                   limit: int = 100) -> list[dict]:
        """Search audit logs"""
        query = self.db.table("audit_logs").select("*")

        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)
        if start_date:
            query = query.gte("timestamp", start_date)
        if end_date:
            query = query.lte("timestamp", end_date)

        query = query.order("timestamp", desc=True).limit(limit)
        return query.execute().data

    def generate_compliance_report(
        self, start_date: str, end_date: str
    ) -> dict:
        """Generate compliance report"""
        logs = self.query_logs(
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )

        report = {
            "period": {"start": start_date, "end": end_date},
            "total_emails_processed": sum(
                1 for l in logs if l["action"] == "email_received"
            ),
            "auto_replies_sent": sum(
                1 for l in logs if l["action"] == "reply_sent"
            ),
            "human_escalations": sum(
                1 for l in logs if l["action"] == "escalated"
            ),
            "pii_detections": sum(
                1 for l in logs if l["action"] == "pii_detected"
            ),
            "data_exports": sum(
                1 for l in logs if l["action"] == "data_exported"
            ),
            "settings_changes": [
                l for l in logs if l["action"] == "settings_changed"
            ],
        }

        total = report["total_emails_processed"]
        if total > 0:
            report["auto_reply_rate"] = round(
                report["auto_replies_sent"] / total * 100, 1
            )
            report["escalation_rate"] = round(
                report["human_escalations"] / total * 100, 1
            )

        return report
```

### 6.3 GDPR/APPI Compliance Checklist

```
Data protection measures for email automation:

  ■ Data Collection and Use
  ┌──────────────────────────────────────────────────┐
  │ □ Clearly state in privacy policy that email     │
  │   content is sent to AI APIs                     │
  │ □ Clarify legal basis for data processing        │
  │   (consent / legitimate interest / contract)     │
  │ □ List specific purposes of use                  │
  │   (classification, reply generation, summary,    │
  │   quality improvement)                           │
  │ □ Disclose third-party recipients (AI API        │
  │   providers)                                     │
  └──────────────────────────────────────────────────┘

  ■ Data Retention and Deletion
  ┌──────────────────────────────────────────────────┐
  │ □ Define email body retention period             │
  │   (recommended: within 90 days)                  │
  │ □ Confirm AI API provider data retention policy  │
  │   (Anthropic: does not use input data for        │
  │   training)                                      │
  │ □ Set up automatic deletion schedule             │
  │ □ Procedure for responding to user deletion      │
  │   requests                                       │
  │ □ Procedure for deleting backup data             │
  └──────────────────────────────────────────────────┘

  ■ Security Measures
  ┌──────────────────────────────────────────────────┐
  │ □ Encrypted communication (TLS 1.3)              │
  │ □ Encryption of data at rest (AES-256)           │
  │ □ PII masking applied                            │
  │ □ Access control (RBAC) implemented              │
  │ □ Audit log recording and retention              │
  │ □ Incident response procedure established        │
  │ □ Regular security audits conducted              │
  └──────────────────────────────────────────────────┘

  ■ User Rights Protection
  ┌──────────────────────────────────────────────────┐
  │ □ Right of access: Respond to disclosure requests│
  │ □ Right to rectification: Procedure for          │
  │   correcting incorrect data                      │
  │ □ Right to erasure: Handle data deletion         │
  │   requests (right to be forgotten)               │
  │ □ Right to object: Procedure for objecting to    │
  │   AI automated processing                        │
  │ □ Data portability: Data export functionality    │
  │ □ Opt-out: Option to refuse AI processing        │
  └──────────────────────────────────────────────────┘
```

---

## 7. Operational Monitoring and KPIs

### 7.1 KPI Dashboard Design

```python
class EmailAutomationDashboard:
    """KPI dashboard for email automation"""

    def __init__(self, db_client):
        self.db = db_client

    def get_daily_metrics(self, date: str) -> dict:
        """Retrieve daily metrics"""
        return {
            "date": date,
            "volume": {
                "total_received": self._count_emails(date, "received"),
                "auto_classified": self._count_emails(date, "classified"),
                "auto_replied": self._count_emails(date, "auto_replied"),
                "human_handled": self._count_emails(date, "human_handled"),
                "escalated": self._count_emails(date, "escalated"),
            },
            "quality": {
                "classification_accuracy": self._calc_accuracy(date),
                "reply_approval_rate": self._calc_approval_rate(date),
                "false_positive_rate": self._calc_false_positive(date),
                "customer_satisfaction": self._calc_csat(date),
            },
            "performance": {
                "avg_classification_time_ms": self._avg_time(date, "classify"),
                "avg_reply_generation_time_ms": self._avg_time(date, "reply"),
                "avg_first_response_time_min": self._avg_response_time(date),
                "p95_response_time_min": self._p95_response_time(date),
            },
            "cost": {
                "total_api_cost_usd": self._total_api_cost(date),
                "cost_per_email_usd": self._cost_per_email(date),
                "tokens_used": self._total_tokens(date),
                "estimated_monthly_cost": self._total_api_cost(date) * 30,
            },
        }

    def _count_emails(self, date: str, status: str) -> int:
        """Count emails by status"""
        result = self.db.table("email_logs") \
            .select("id", count="exact") \
            .eq("date", date) \
            .eq("status", status) \
            .execute()
        return result.count or 0

    def _calc_accuracy(self, date: str) -> float:
        """Calculate classification accuracy (based on human feedback)"""
        result = self.db.table("classification_feedback") \
            .select("correct") \
            .eq("date", date) \
            .execute()

        if not result.data:
            return 0.0

        correct = sum(1 for r in result.data if r["correct"])
        return round(correct / len(result.data) * 100, 1)

    def _calc_approval_rate(self, date: str) -> float:
        """AI reply approval rate (percentage of drafts sent without edits)"""
        result = self.db.table("reply_logs") \
            .select("status, edited") \
            .eq("date", date) \
            .execute()

        if not result.data:
            return 0.0

        approved = sum(
            1 for r in result.data
            if r["status"] == "sent" and not r["edited"]
        )
        return round(approved / len(result.data) * 100, 1)

    def _calc_false_positive(self, date: str) -> float:
        """False positive rate (percentage of emails incorrectly auto-replied)"""
        result = self.db.table("reply_logs") \
            .select("feedback_score") \
            .eq("date", date) \
            .eq("auto_sent", True) \
            .execute()

        if not result.data:
            return 0.0

        false_positives = sum(
            1 for r in result.data
            if r.get("feedback_score", 5) <= 2
        )
        return round(false_positives / len(result.data) * 100, 1)

    def _category_breakdown(self, date: str) -> dict:
        """Category breakdown"""
        result = self.db.table("email_logs") \
            .select("category, priority") \
            .eq("date", date) \
            .execute()

        breakdown = {}
        for r in (result.data or []):
            cat = r["category"]
            if cat not in breakdown:
                breakdown[cat] = {"count": 0, "priority_dist": {}}
            breakdown[cat]["count"] += 1
            pri = r.get("priority", "medium")
            breakdown[cat]["priority_dist"][pri] = \
                breakdown[cat]["priority_dist"].get(pri, 0) + 1

        return breakdown

    # Other methods omitted (DB aggregation for each metric)
    def _avg_time(self, date, op): return 0
    def _avg_response_time(self, date): return 0
    def _p95_response_time(self, date): return 0
    def _total_api_cost(self, date): return 0.0
    def _cost_per_email(self, date): return 0.0
    def _total_tokens(self, date): return 0
    def _calc_csat(self, date): return 0.0


    def generate_weekly_report(self, start_date: str,
                               end_date: str) -> str:
        """Generate weekly report"""
        # Aggregate daily metrics
        daily_metrics = []
        from datetime import datetime, timedelta
        current = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)

        while current <= end:
            metrics = self.get_daily_metrics(current.date().isoformat())
            daily_metrics.append(metrics)
            current += timedelta(days=1)

        # Calculate summary
        total_received = sum(
            m["volume"]["total_received"] for m in daily_metrics
        )
        total_auto_replied = sum(
            m["volume"]["auto_replied"] for m in daily_metrics
        )
        avg_accuracy = sum(
            m["quality"]["classification_accuracy"] for m in daily_metrics
        ) / len(daily_metrics) if daily_metrics else 0

        total_cost = sum(
            m["cost"]["total_api_cost_usd"] for m in daily_metrics
        )

        report = f"""
## Email Automation Weekly Report
Period: {start_date} to {end_date}

### Volume
- Total received: {total_received} emails
- Auto-replied: {total_auto_replied} emails ({total_auto_replied/max(total_received,1)*100:.1f}%)

### Quality
- Classification accuracy: {avg_accuracy:.1f}%

### Cost
- Total API cost: ${total_cost:.2f}
- Per email: ${total_cost/max(total_received,1):.4f}
"""
        return report
```

### 7.2 Alert Configuration

```python
class AlertManager:
    """Alert management for email automation"""

    def __init__(self, slack_webhook_url: str):
        self.webhook_url = slack_webhook_url
        self.alert_rules = [
            {
                "name": "Classification accuracy drop",
                "condition": lambda m: m["quality"]["classification_accuracy"] < 90,
                "severity": "warning",
                "message": "Classification accuracy has fallen below 90%: {value}%",
            },
            {
                "name": "Response time exceeded",
                "condition": lambda m: m["performance"]["avg_first_response_time_min"] > 30,
                "severity": "warning",
                "message": "Average response time exceeds 30 minutes: {value} min",
            },
            {
                "name": "API cost spike",
                "condition": lambda m: m["cost"]["total_api_cost_usd"] > 50,
                "severity": "critical",
                "message": "Daily API cost exceeds $50: ${value}",
            },
            {
                "name": "Escalation surge",
                "condition": lambda m: (
                    m["volume"]["escalated"] / max(m["volume"]["total_received"], 1) > 0.3
                ),
                "severity": "warning",
                "message": "Escalation rate exceeds 30%: {value}%",
            },
            {
                "name": "False positive rate increase",
                "condition": lambda m: m["quality"]["false_positive_rate"] > 5,
                "severity": "critical",
                "message": "False positive rate exceeds 5%: {value}%. Please pause auto-send.",
            },
        ]

    def check_and_alert(self, metrics: dict):
        """Check metrics and send alerts"""
        import requests

        for rule in self.alert_rules:
            try:
                if rule"condition":
                    self._send_alert(rule, metrics)
            except Exception as e:
                print(f"Alert check failed for {rule['name']}: {e}")

    def _send_alert(self, rule: dict, metrics: dict):
        """Send alert to Slack"""
        import requests

        severity_emoji = {
            "info": ":information_source:",
            "warning": ":warning:",
            "critical": ":rotating_light:",
        }

        emoji = severity_emoji.get(rule["severity"], ":bell:")

        payload = {
            "text": (
                f"{emoji} *Email Automation Alert: {rule['name']}*\n"
                f"Severity: {rule['severity']}\n"
                f"{rule['message']}\n"
                f"Date: {metrics.get('date', 'N/A')}"
            )
        }

        requests.post(self.webhook_url, json=payload)
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Unconditional Auto-Send

```python
# BAD: Automatically send AI-generated text as-is
def handle_email(email):
    reply = ai.generate_reply(email)
    send_email(reply)  # Sending directly to customer — dangerous!

# GOOD: Phased automation based on confidence score
def handle_email(email):
    analysis = classifier.classify(email)
    reply = ai.generate_reply(email)

    if analysis.category == EmailCategory.SPAM:
        archive(email)  # Auto-archive spam
    elif reply["confidence"] >= 0.9 and analysis.priority == Priority.LOW:
        send_email(reply)  # Auto-send only for low priority + high confidence
    elif reply["confidence"] >= 0.7:
        save_as_draft(reply)  # Save as draft, one-click send
        notify_agent(email)
    else:
        escalate_to_human(email)  # Escalate to human
```

### Anti-Pattern 2: Context-Ignoring Replies

```python
# BAD: Reply based on individual email only
def generate_reply(email):
    return ai.reply(email["body"])  # Ignores past exchanges

# GOOD: Consider the full thread context
def generate_reply(email):
    thread = fetch_thread(email["thread_id"])
    customer_history = fetch_customer_history(email["sender"])

    context = {
        "thread": thread,
        "customer_tier": customer_history.tier,
        "past_issues": customer_history.recent_issues,
        "sentiment_trend": analyze_sentiment_trend(thread)
    }

    return ai.reply_with_context(email, context)
```

### Anti-Pattern 3: Missing Error Handling

```python
# BAD: Email processing stops on API failure
def process_email(email):
    result = ai.classify(email)  # Everything stops if API is down
    reply = ai.generate_reply(email)
    send_email(reply)

# GOOD: Implement fallbacks and retries
def process_email(email):
    try:
        result = ai.classify(email)
    except APIError as e:
        # Fallback: rule-based classification
        result = rule_based_classify(email)
        log_error("AI classification failed, using rule-based", e)

    try:
        reply = ai.generate_reply(email)
    except APIError as e:
        # Fallback: template reply
        reply = template_reply(result.category, email)
        log_error("AI reply generation failed, using template", e)

    # Add to retry queue
    if result.confidence < 0.5:
        retry_queue.add(email, retry_after_minutes=30)
        return

    send_with_retry(reply, max_retries=3, backoff_seconds=5)
```

### Anti-Pattern 4: Using the Same AI Model for Everything

```python
# BAD: Use expensive model for all emails
def classify_all(emails):
    for email in emails:
        # $0.01 per email × 10,000 emails/day = $100/day
        result = claude_opus.classify(email)

# GOOD: Select model based on task complexity
def classify_all(emails):
    for email in emails:
        # Stage 1: Rule-based (cost $0)
        if is_obvious_category(email):
            yield rule_based_result(email)
            continue

        # Stage 2: Lightweight model (cost $0.001)
        haiku_result = claude_haiku.classify(email)
        if haiku_result.confidence >= 0.90:
            yield haiku_result
            continue

        # Stage 3: High-accuracy model (cost $0.01) — only when needed
        yield claude_sonnet.classify(email)
```

### Anti-Pattern 5: Insufficient Logging and Auditing

```python
# BAD: No records of AI processing
def auto_reply(email):
    reply = ai.generate(email)
    send(reply)  # Cannot verify what was sent afterward

# GOOD: Record all processing in auditable form
def auto_reply(email):
    # Record input
    audit.log(AuditAction.EMAIL_RECEIVED, {
        "message_id": email["id"],
        "sender": email["sender"],
        "subject": email["subject"],
    })

    # PII detection and masking
    masked_body, pii_detections = masker.mask(email["body"])
    if pii_detections:
        audit.log(AuditAction.PII_DETECTED, {
            "types": [d["type"] for d in pii_detections],
            "count": len(pii_detections),
        })

    # AI processing
    reply = ai.generate(masked_body)
    audit.log(AuditAction.REPLY_GENERATED, {
        "confidence": reply["confidence"],
        "model": reply["model"],
        "tokens": reply["tokens_used"],
    })

    # Send
    if reply["confidence"] >= 0.9:
        send(reply)
        audit.log(AuditAction.REPLY_SENT, {
            "auto": True,
            "reply_length": len(reply["body"]),
        })
    else:
        save_draft(reply)
        audit.log(AuditAction.REPLY_GENERATED, {
            "status": "draft",
            "reason": "low_confidence",
        })
```

---

## 9. Phased Implementation Roadmap

### 9.1 4-Phase Implementation Plan

```
Phase 1 (Week 1-2): Observation Mode
┌──────────────────────────────────────────┐
│ ● Set up email receive hooks             │
│ ● Run AI classification but log only    │
│ ● No changes to actual processing        │
│   (shadow mode)                          │
│ ● Obtain baseline classification         │
│   accuracy benchmark                     │
│ Success criteria: classification         │
│ accuracy ≥ 85%                           │
└──────────────────────────────────────────┘
          │
          ▼
Phase 2 (Week 3-4): Assist Mode
┌──────────────────────────────────────────┐
│ ● Apply classification results as labels │
│ ● Generate and suggest reply drafts     │
│ ● Auto-generate thread summaries        │
│ ● Human approves all sends              │
│ Success criteria: draft approval rate   │
│ ≥ 70%                                   │
└──────────────────────────────────────────┘
          │
          ▼
Phase 3 (Week 5-8): Semi-Automatic Mode
┌──────────────────────────────────────────┐
│ ● Auto-process low-risk emails           │
│   (newsletters, FAQ)                    │
│ ● One-click send for high-confidence    │
│   drafts                                │
│ ● Apply auto-escalation rules           │
│ Success criteria: auto-processing       │
│ rate ≥ 40%                              │
└──────────────────────────────────────────┘
          │
          ▼
Phase 4 (Week 9+): Fully Automatic Mode
┌──────────────────────────────────────────┐
│ ● Auto-send replies with confidence ≥90%│
│ ● Auto-escalation via anomaly detection │
│ ● Continuous improvement via feedback   │
│   loop                                  │
│ ● Monthly review to adjust accuracy     │
│   and policies                          │
│ Success criteria: auto-processing rate  │
│ ≥ 60%, CSAT maintained                 │
└──────────────────────────────────────────┘
```

### 9.2 Detailed Checklist for Each Phase

```python
deployment_checklist = {
    "phase_1_observe": {
        "duration": "2 weeks",
        "tasks": [
            "Set up API connection with email provider",
            "Build AI classification pipeline (log-only mode)",
            "Build dashboard to compare classification results with human judgment",
            "Measure baseline accuracy (evaluate with at least 200 emails)",
            "Verify PII masking operation",
            "Test error handling and retry mechanisms",
        ],
        "exit_criteria": [
            "Classification accuracy ≥ 85% (compared to human judgment)",
            "Confirm stable system operation (error rate < 1%)",
            "No PII detection misses (verified with test data)",
        ],
    },
    "phase_2_assist": {
        "duration": "2 weeks",
        "tasks": [
            "Implement automatic label assignment from classification results",
            "Enable reply draft generation feature",
            "Build draft approval UI",
            "Implement feedback collection feature",
            "Conduct team training",
            "Initial knowledge base construction",
        ],
        "exit_criteria": [
            "Draft approval rate ≥ 70%",
            "Average response time per agent reduced by ≥ 30%",
            "≥ 80% favorable responses in team satisfaction survey",
        ],
    },
    "phase_3_semi_auto": {
        "duration": "4 weeks",
        "tasks": [
            "Set auto-processing rules for low-risk categories",
            "Tune confidence threshold for auto-send",
            "Optimize escalation flow",
            "Cost optimization (model selection, caching)",
            "Customer notification settings (AI response transparency)",
            "Start weekly review meetings",
        ],
        "exit_criteria": [
            "Auto-processing rate ≥ 40%",
            "False positive rate (erroneous sends) ≤ 2%",
            "Customer satisfaction maintained or improved",
            "Monthly API cost within budget",
        ],
    },
    "phase_4_full_auto": {
        "duration": "Ongoing",
        "tasks": [
            "Enable auto-send for high-confidence replies",
            "Automate feedback loop",
            "Monthly accuracy review and threshold adjustment",
            "Detect new patterns and add response rules",
            "Regular compliance audits",
            "Document and drill incident response procedures",
        ],
        "exit_criteria": [
            "Auto-processing rate ≥ 60%",
            "Classification accuracy maintained at ≥ 95%",
            "Customer satisfaction (CSAT) maintained",
            "Operational workload reduced by ≥ 50%",
        ],
    },
}
```

---

## 10. FAQ

### Q1: Will customer satisfaction decrease with auto-replies?

**A:** With proper implementation, it can actually improve. Research shows: (1) response time shortened from 10 minutes to 30 seconds improves customer satisfaction by 15%, (2) 24-hour support becomes possible, (3) consistency of responses is maintained. However, conditions include: not hiding the fact that "AI is handling this," and promptly escalating complex cases to humans. Phased introduction (starting with classification → summarization → drafts → auto-reply) to verify quality as you proceed is important.

### Q2: What about privacy and security measures?

**A:** Three layers of measures are recommended: (1) Data masking — automatically mask PII (personal information) before sending to email API, (2) API selection — use APIs that do not retain data (Anthropic API, etc.), (3) On-premises — consider self-hosted LLMs (Llama, etc.) for high-confidentiality industries. Also verify GDPR and APPI (Japan's Personal Information Protection Act) requirements. In medical, financial, and legal sectors, prior consultation with regulators may be required.

### Q3: How do I integrate with existing email systems?

**A:** There are three approaches: (1) Direct IMAP/SMTP — most flexible but high implementation cost, (2) Gmail API / Microsoft Graph API — optimal for Google/Microsoft environments, (3) Via Zapier/n8n — easiest, can be up and running the same day. The recommendation is to start with (3) and migrate to (2) as you scale.

### Q4: How can I reduce AI model costs?

**A:** There are 5 main optimization strategies: (1) Hybrid classification — filter emails processable by rules before AI calls (30-50% reduction possible for spam, newsletters, etc.). (2) Model selection — use Haiku (low cost) for classification and Sonnet (high quality) for reply generation. (3) Caching — cache answers for similar inquiries to prevent regeneration of identical responses. (4) Batch processing — classify multiple emails in a single API call. (5) Prompt optimization — minimize input token count (use only the first 500 characters of email body, etc.).

### Q5: How do I handle multi-language emails?

**A:** Claude/GPT-4 supports over 100 languages, so multi-language email classification and reply generation is available as a standard feature. Key implementation points: (1) First detect the email language and process separately from classification prompts. (2) Instruct to generate replies in the same language as the original email. (3) Prepare internal templates in major languages (Japanese, English, Chinese, etc.) in advance. (4) When translation is needed, consider combining with the DeepL API (especially for formal documents).

### Q6: How do I measure the effectiveness of automation?

**A:** Compare metrics before and after implementation. Key KPIs: (1) Mean time to first response (MTTR) — benchmark of 10 min before implementation → 30 sec after, (2) Cost per email — calculated as labor cost + API cost, (3) Customer satisfaction (CSAT) — maintain or improve after implementation, (4) Emails handled per agent — expect 2-3x improvement in processing capacity, (5) Escalation rate — the lower the better as evidence of successful automation. ROI calculation: "Labor cost savings - API cost - Development cost."

### Q7: How do I overcome team resistance?

**A:** Phased introduction and visualizing benefits are key: (1) Initially position AI as an assistant (draft generation) that respects human judgment. (2) Explain it as "automating routine tasks so you can focus on higher-value work" rather than "taking away jobs." (3) Create success stories with a pilot team, then roll out to other teams. (4) Actively collect feedback and incorporate into improvements. (5) Share concrete numbers showing improved response quality (response speed, CSAT, etc.).

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| Classification | Hybrid of rule-based + AI is optimal |
| Auto-reply | Switch between auto/draft/human based on confidence score |
| Summarization | Hierarchical summarization for long threads (individual → consolidated) |
| Multi-channel | Unified management integrating Slack/Teams/email |
| Security | PII masking + no-data-retention API + encryption + audit logs |
| Deployment order | 4 phases: observe → assist → semi-auto → fully automated |
| Cost optimization | Hybrid classification + model selection + caching |
| KPIs | Response time, resolution rate, customer satisfaction, cost/email, false positive rate |

---

## Next Guides to Read

- [../01-business/02-content-creation.md](../01-business/02-content-creation.md) — Content creation automation
- [../02-monetization/01-cost-management.md](../02-monetization/01-cost-management.md) — API cost optimization
- [00-automation-overview.md](./00-automation-overview.md) — Overview of AI automation
- [02-document-processing.md](./02-document-processing.md) — Document processing automation

---

## References

1. **Gmail API Documentation** — https://developers.google.com/gmail/api — Official guide for Gmail integration
2. **Microsoft Graph API** — https://learn.microsoft.com/graph — Outlook/Teams integration
3. **"AI-Powered Customer Service" — Harvard Business Review (2024)** — Research on measuring the effectiveness of AI customer service
4. **Anthropic API Documentation** — https://docs.anthropic.com — Claude API best practices
5. **n8n Documentation** — https://docs.n8n.io — Workflow automation platform
6. **"Customer Service AI Best Practices" — Zendesk (2025)** — Guidelines for introducing AI customer service
7. **GDPR and AI Processing** — https://gdpr.eu/artificial-intelligence — EU AI regulation and data protection relationship
8. **Personal Information Protection Commission** — https://www.ppc.go.jp — Japan's APPI (Personal Information Protection Act) guidelines
