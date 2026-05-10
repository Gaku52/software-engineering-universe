# Customer Support Agent

> Chatbots, FAQs, and escalation — designing a support agent that automatically classifies customer inquiries, generates appropriate responses, and hands off to human operators when needed.

## What You Will Learn

1. Support agent workflow design (classification, response, escalation)
2. Implementation patterns for RAG-based knowledge retrieval and response generation
3. Handoff design for collaboration with human operators
4. Building multi-channel support and a unified customer experience
5. Improving customer satisfaction through sentiment analysis and tone adjustment
6. Evaluation metrics and continuous improvement cycles for support agents


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Research Agents](./01-research-agents.md)

---

## 1. Overview of the Support Agent

```
Customer Support Agent Flow

[Customer Inquiry]
       |
       v
[Intent Classification] ──→ Spam/Fraud ──→ [Block]
       |
       ├── FAQ-answerable ──→ [Knowledge Search] ──→ [Response Generation] ──→ [Customer]
       |
       ├── Technical issue ──→ [Troubleshoot] ──→ [Resolved?]
       |                                          ├── YES → [Customer]
       |                                          └── NO  → [Escalation]
       |
       ├── Account operation ──→ [Identity Verification] ──→ [Execute Operation] ──→ [Customer]
       |
       └── Complex/Emotional ──→ [Human Operator] (Immediate escalation)
```

### 1.1 Support Agent Maturity Model

It is recommended to incrementally increase the maturity level of customer support agents. Rather than implementing all features at once, a phased approach ensures reliable value delivery.

```
Maturity Levels

Level 1: FAQ Response ─────────────────────────────────────────
  - Keyword matching
  - Fixed template responses
  - Resolution rate: 15-25%

Level 2: RAG Response ─────────────────────────────────────────
  - Vector search-based knowledge retrieval
  - Natural response generation with LLM
  - Confidence-based escalation
  - Resolution rate: 40-55%

Level 3: Context Integration ────────────────────────────────
  - CRM/order system integration
  - Responses that consider customer history
  - Multi-turn conversation management
  - Resolution rate: 55-70%

Level 4: Action Execution ─────────────────────────────────
  - Refund processing and account changes
  - Identity verification flow
  - Transactional operations
  - Resolution rate: 65-80%

Level 5: Proactive ─────────────────────────────────
  - Problem signal detection
  - Anticipatory support
  - Personalized suggestions
  - Resolution rate: 75-90%
```

### 1.2 Architecture Overview

```python
"""
Customer Support Agent Architecture Overview
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import time


class SupportTier(Enum):
    """Support tier"""
    SELF_SERVICE = "self_service"   # Self-service (FAQ, help center)
    AI_AGENT = "ai_agent"           # AI agent handling
    HUMAN_L1 = "human_l1"           # Human operator (general)
    HUMAN_L2 = "human_l2"           # Human operator (specialist)
    HUMAN_L3 = "human_l3"           # Engineer/Manager


class ChannelType(Enum):
    """Supported channels"""
    WEB_CHAT = "web_chat"
    EMAIL = "email"
    LINE = "line"
    SLACK = "slack"
    PHONE = "phone"
    IN_APP = "in_app"


@dataclass
class SupportTicket:
    """Support ticket"""
    ticket_id: str
    customer_id: str
    channel: ChannelType
    subject: str
    messages: list = field(default_factory=list)
    intent: Optional[str] = None
    sentiment: Optional[str] = None
    urgency: str = "medium"
    current_tier: SupportTier = SupportTier.AI_AGENT
    assigned_to: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    resolved_at: Optional[float] = None
    resolution_summary: Optional[str] = None
    csat_score: Optional[int] = None
    tags: list = field(default_factory=list)

    @property
    def is_resolved(self) -> bool:
        return self.resolved_at is not None

    @property
    def response_time_seconds(self) -> Optional[float]:
        if len(self.messages) >= 2:
            return self.messages[1]["timestamp"] - self.messages[0]["timestamp"]
        return None

    @property
    def handle_time_seconds(self) -> Optional[float]:
        if self.resolved_at:
            return self.resolved_at - self.created_at
        return None


@dataclass
class CustomerProfile:
    """Customer profile"""
    customer_id: str
    name: str
    email: str
    plan: str = "free"
    tier: str = "standard"          # standard / premium / enterprise
    language: str = "ja"
    timezone: str = "Asia/Tokyo"
    tenure_months: int = 0
    lifetime_value: float = 0.0
    recent_tickets: list = field(default_factory=list)
    satisfaction_history: list = field(default_factory=list)
    preferred_channel: ChannelType = ChannelType.WEB_CHAT
    notes: str = ""

    @property
    def average_csat(self) -> Optional[float]:
        if not self.satisfaction_history:
            return None
        return sum(self.satisfaction_history) / len(self.satisfaction_history)

    @property
    def is_at_risk(self) -> bool:
        """Simple churn risk assessment"""
        if self.average_csat and self.average_csat < 3.0:
            return True
        recent_negative = sum(
            1 for s in self.satisfaction_history[-5:]
            if s <= 2
        )
        return recent_negative >= 2
```

---

## 2. Basic Support Agent

### 2.1 Intent Classification

```python
# Intent classification for inquiries
import anthropic
import json
from typing import Optional


class IntentClassifier:
    """Class for classifying the intent of inquiries"""

    INTENTS = {
        "billing": "Billing and payment related",
        "technical": "Technical issues and bug reports",
        "account": "Account management (changes, cancellations, etc.)",
        "product": "Questions about the product",
        "complaint": "Complaints and grievances",
        "shipping": "Shipping and logistics related",
        "refund": "Returns and refunds",
        "feature_request": "Feature requests",
        "general": "Other general inquiries"
    }

    # Sub-intent definitions
    SUB_INTENTS = {
        "billing": [
            "invoice_question",      # Invoice question
            "payment_failure",       # Payment failure
            "double_charge",         # Double charge
            "plan_change",           # Plan change
            "discount_inquiry",      # Discount/coupon inquiry
        ],
        "technical": [
            "bug_report",            # Bug report
            "performance_issue",     # Performance issue
            "integration_error",     # Integration error
            "how_to",               # How-to question
            "data_loss",            # Data loss
        ],
        "account": [
            "password_reset",        # Password reset
            "account_locked",        # Account locked
            "profile_update",        # Profile update
            "cancellation",          # Cancellation
            "data_export",           # Data export
        ],
    }

    def __init__(self):
        self.client = anthropic.Anthropic()

    def classify(self, message: str, conversation_history: Optional[list] = None) -> dict:
        """Classify the inquiry"""

        # Include conversation history as context if available
        history_context = ""
        if conversation_history:
            recent = conversation_history[-3:]  # Last 3 messages
            history_context = "\n".join([
                f"{'Customer' if m['role'] == 'user' else 'Support'}: {m['content']}"
                for m in recent
            ])
            history_context = f"\nPrevious conversation:\n{history_context}\n"

        response = self.client.messages.create(
            model="claude-haiku-4-20250514",  # Fast and low cost
            max_tokens=512,
            messages=[{"role": "user", "content": f"""
Please classify the following customer message.
{history_context}
Message: {message}

Main categories: {list(self.INTENTS.keys())}
Sub-categories (if applicable): {json.dumps(self.SUB_INTENTS, ensure_ascii=False)}

Output in JSON format:
{{
  "intent": "main category name",
  "sub_intent": "sub-category name or null",
  "confidence": 0.0-1.0,
  "sentiment": "positive/neutral/negative/angry",
  "urgency": "low/medium/high/critical",
  "language": "detected language code",
  "key_entities": ["list of related entities"],
  "requires_auth": true/false
}}
"""}]
        )
        result = json.loads(response.content[0].text)

        # Two-stage classification for low confidence
        if result.get("confidence", 0) < 0.6:
            result = self._reclassify_with_context(message, result)

        return result

    def _reclassify_with_context(self, message: str, initial_result: dict) -> dict:
        """Re-classify with Sonnet model when confidence is low"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{"role": "user", "content": f"""
The confidence for the classification of the following customer message was low. Please re-analyze.

Message: {message}
Initial classification result: {json.dumps(initial_result, ensure_ascii=False)}

Output in more accurate JSON format:
{{
  "intent": "main category name",
  "sub_intent": "sub-category name or null",
  "confidence": 0.0-1.0,
  "sentiment": "positive/neutral/negative/angry",
  "urgency": "low/medium/high/critical",
  "language": "detected language code",
  "key_entities": ["list of related entities"],
  "requires_auth": true/false,
  "reclassified": true,
  "reclassification_reason": "reason for reclassification"
}}
"""}]
        )
        return json.loads(response.content[0].text)


# Usage example
classifier = IntentClassifier()
result = classifier.classify("I was charged twice last month! Please check immediately")
# {
#   "intent": "billing",
#   "sub_intent": "double_charge",
#   "confidence": 0.95,
#   "sentiment": "negative",
#   "urgency": "high",
#   "language": "en",
#   "key_entities": ["last month's billing", "double charge"],
#   "requires_auth": true
# }
```

### 2.2 RAG-Based Response Generation

```python
# Response generation from knowledge base
import hashlib
from datetime import datetime


class SupportKnowledgeBase:
    """Knowledge base search and response generation for support"""

    def __init__(self, vector_store, cache=None):
        self.vector_store = vector_store
        self.client = anthropic.Anthropic()
        self.cache = cache or {}

    def answer(self, question: str, customer_context: dict = None) -> dict:
        """Generate a response to a question"""

        # 0. Cache check (fast response for identical questions)
        cache_key = self._cache_key(question)
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            if time.time() - cached["cached_at"] < 3600:  # Valid for 1 hour
                return {**cached["result"], "from_cache": True}

        # 1. Search for relevant knowledge
        relevant_docs = self.vector_store.search(question, top_k=5)

        # 2. Filter documents by relevance
        filtered_docs = self._filter_relevant_docs(relevant_docs, question)

        # 3. Build context
        context = "\n\n".join([
            f"--- Document: {doc['title']} (Updated: {doc.get('updated_at', 'unknown')}) ---\n{doc['content']}"
            for doc in filtered_docs
        ])

        customer_info = ""
        if customer_context:
            customer_info = f"""
Customer information:
- Customer ID: {customer_context.get('customer_id', 'unknown')}
- Plan: {customer_context.get('plan', 'unknown')}
- Tenure: {customer_context.get('tenure', 'unknown')}
- Past inquiries: {customer_context.get('history_summary', 'none')}
- Features in use: {customer_context.get('features', 'unknown')}
"""

        # 4. Generate response
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Please answer the customer's question based on the following information.

{customer_info}

Knowledge base:
{context}

Customer's question: {question}

Rules:
- If the information is not in the knowledge base, respond with "I will look into that"
- Never speculate or make assumptions
- Use polite and concise language
- When specific steps are involved, present them as a numbered list
- Record the name of the source document used in the response
- Tailor the response to the customer's plan and usage situation

Output in JSON format:
{{
  "answer": "response text",
  "used_sources": ["names of documents used"],
  "answer_type": "direct_answer / guidance / partial / no_info",
  "follow_up_questions": ["questions the customer is likely to ask next"]
}}
"""}]
        )

        parsed = json.loads(response.content[0].text)
        answer_text = parsed["answer"]
        answer_type = parsed.get("answer_type", "direct_answer")

        # 5. Confidence evaluation
        confidence = self._calculate_confidence(
            filtered_docs, question, answer_type
        )

        result = {
            "answer": answer_text,
            "confidence": confidence,
            "sources": parsed.get("used_sources", []),
            "answer_type": answer_type,
            "follow_up_questions": parsed.get("follow_up_questions", []),
            "should_escalate": confidence < 0.5 or answer_type == "no_info",
            "from_cache": False,
        }

        # 6. Save to cache
        if confidence > 0.8:
            self.cache[cache_key] = {
                "result": result,
                "cached_at": time.time(),
            }

        return result

    def _filter_relevant_docs(self, docs: list, question: str) -> list:
        """Filter out low-relevance documents"""
        filtered = []
        for doc in docs:
            similarity = doc.get("similarity", 0)
            if similarity > 0.7:  # Similarity threshold
                filtered.append(doc)
        return filtered if filtered else docs[:3]

    def _calculate_confidence(
        self, docs: list, question: str, answer_type: str
    ) -> float:
        """Calculate response confidence"""
        if answer_type == "no_info":
            return 0.1
        if answer_type == "partial":
            return 0.4

        # Average similarity score of documents
        if docs:
            avg_similarity = sum(
                d.get("similarity", 0.5) for d in docs
            ) / len(docs)
        else:
            avg_similarity = 0.2

        # Adjustment for document freshness
        freshness_bonus = 0
        for doc in docs:
            updated = doc.get("updated_at")
            if updated:
                days_old = (datetime.now() - datetime.fromisoformat(updated)).days
                if days_old < 30:
                    freshness_bonus += 0.05
                elif days_old > 365:
                    freshness_bonus -= 0.05

        return min(max(avg_similarity + freshness_bonus, 0.0), 1.0)

    def _cache_key(self, question: str) -> str:
        normalized = question.strip().lower()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
```

### 2.3 Complete Support Agent

```python
# Complete customer support agent
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class CustomerSupportAgent:
    """Complete customer support agent"""

    def __init__(self, knowledge_base, crm_system, action_executor=None):
        self.classifier = IntentClassifier()
        self.kb = knowledge_base
        self.crm = crm_system
        self.action_executor = action_executor
        self.client = anthropic.Anthropic()
        self.escalation_threshold = 0.5
        self.conversation_manager = ConversationManager()
        self.tone_adjuster = ToneAdjuster()
        self.metrics = SupportMetrics()

    def handle_inquiry(self, customer_id: str, message: str,
                       channel: str = "web_chat") -> dict:
        """Process an inquiry"""
        start_time = time.time()

        # 1. Retrieve customer information
        customer = self.crm.get_customer(customer_id)
        logger.info(f"Handling inquiry from {customer_id} via {channel}")

        # 2. Conversation session management
        session = self.conversation_manager.get_or_create_session(customer_id)
        self.conversation_manager.add_message(customer_id, "user", message)

        # 3. Intent classification (including conversation history)
        intent = self.classifier.classify(
            message,
            conversation_history=session.get("messages", [])
        )
        session["intent_history"].append(intent)

        # 4. Immediate escalation check
        if self._needs_immediate_escalation(intent, customer):
            result = self._escalate(
                customer_id, message, intent, "Automatic escalation"
            )
            self.metrics.record(customer_id, intent, result, time.time() - start_time)
            return result

        # 5. Identity verification if required
        if intent.get("requires_auth") and not session.get("authenticated"):
            return self._request_authentication(customer_id, intent)

        # 6. Processing based on intent
        handler = self._get_handler(intent["intent"])
        response = handler(customer, message, intent)

        # 7. Tone adjustment
        adjusted_answer = self.tone_adjuster.adjust(
            response["answer"],
            intent.get("sentiment", "neutral"),
            customer
        )
        response["answer"] = adjusted_answer

        # 8. Confidence check
        if response["confidence"] < self.escalation_threshold:
            result = self._escalate(
                customer_id, message, intent, "Low confidence"
            )
            self.metrics.record(customer_id, intent, result, time.time() - start_time)
            return result

        # 9. Suggest follow-up questions
        follow_ups = response.get("follow_up_questions", [])

        # 10. Save conversation history
        self.conversation_manager.add_message(
            customer_id, "assistant", response["answer"]
        )
        self.crm.log_interaction(customer_id, message, response["answer"])

        result = {
            "response": response["answer"],
            "intent": intent,
            "escalated": False,
            "confidence": response["confidence"],
            "sources": response.get("sources", []),
            "follow_up_questions": follow_ups,
            "processing_time": time.time() - start_time,
        }

        self.metrics.record(customer_id, intent, result, time.time() - start_time)
        return result

    def _get_handler(self, intent_type: str):
        """Return the handler corresponding to the intent"""
        handlers = {
            "billing": self._handle_billing,
            "technical": self._handle_technical,
            "account": self._handle_account,
            "shipping": self._handle_shipping,
            "refund": self._handle_refund,
            "feature_request": self._handle_feature_request,
        }
        return handlers.get(intent_type, self._handle_general)

    def _handle_billing(self, customer: dict, message: str,
                        intent: dict) -> dict:
        """Handle billing-related inquiries"""
        # Retrieve billing history
        billing_history = self.crm.get_billing_history(
            customer["customer_id"], limit=6
        )

        # Respond using knowledge base + billing data
        enhanced_context = {
            **customer,
            "billing_history": billing_history,
            "history_summary": f"Last 6 billing records: {json.dumps(billing_history, ensure_ascii=False)}"
        }

        response = self.kb.answer(message, enhanced_context)

        # Flag for automatic refund review in case of double charge
        if intent.get("sub_intent") == "double_charge":
            response["action_suggested"] = "refund_review"
            response["answer"] += "\n\nWe are reviewing the billing details. If a duplicate charge is confirmed, a refund will be processed automatically."

        return response

    def _handle_technical(self, customer: dict, message: str,
                          intent: dict) -> dict:
        """Handle technical inquiries"""
        # Check status page
        system_status = self._check_system_status()

        if system_status.get("has_incident"):
            incident = system_status["current_incident"]
            return {
                "answer": f"We are currently experiencing an incident with {incident['service']}."
                          f"\n\nStatus: {incident['status']}"
                          f"\nImpact: {incident['impact']}"
                          f"\nEstimated recovery: {incident['eta']}"
                          f"\n\nPlease check the status page (https://status.example.com) for the latest updates.",
                "confidence": 0.95,
                "sources": ["system_status_page"],
            }

        # Search troubleshooting guide
        response = self.kb.answer(message, customer)

        # Force escalation in case of data loss
        if intent.get("sub_intent") == "data_loss":
            response["confidence"] = 0.0  # Force escalation
            response["urgency_override"] = "critical"

        return response

    def _handle_account(self, customer: dict, message: str,
                        intent: dict) -> dict:
        """Handle account-related inquiries"""
        sub_intent = intent.get("sub_intent")

        if sub_intent == "password_reset":
            # Automatically send password reset email
            if self.action_executor:
                self.action_executor.send_password_reset(customer["email"])
            return {
                "answer": f"A password reset email has been sent to {self._mask_email(customer['email'])}."
                          "\n\nIf you don't receive the email, please check your spam folder."
                          "\nIf it doesn't arrive within 10 minutes, please let us know.",
                "confidence": 0.95,
                "sources": ["account_management"],
            }

        if sub_intent == "cancellation":
            # Cancellation is handled by humans (retention opportunity)
            return {
                "answer": "I understand you have a question about cancellation."
                          "\nA representative will provide the best options for you, so please wait a moment.",
                "confidence": 0.3,  # Intentionally low to trigger escalation
                "sources": [],
            }

        return self.kb.answer(message, customer)

    def _handle_shipping(self, customer: dict, message: str,
                         intent: dict) -> dict:
        """Handle shipping-related inquiries"""
        # Retrieve order and shipping information
        orders = self.crm.get_recent_orders(customer["customer_id"])
        if orders:
            latest_order = orders[0]
            tracking_info = self.crm.get_tracking_info(latest_order["order_id"])
            enhanced_context = {
                **customer,
                "order_info": latest_order,
                "tracking_info": tracking_info,
            }
            return self.kb.answer(message, enhanced_context)
        return self.kb.answer(message, customer)

    def _handle_refund(self, customer: dict, message: str,
                       intent: dict) -> dict:
        """Handle return and refund inquiries"""
        response = self.kb.answer(message, customer)
        # Include refund policy
        response["answer"] += "\n\n[Refund Policy]\n- Within 30 days of purchase: Full refund\n- 30-60 days: 50% refund\n- After 60 days: No refund"
        return response

    def _handle_feature_request(self, customer: dict, message: str,
                                intent: dict) -> dict:
        """Handle feature requests"""
        # Log the feature request for the product team
        self.crm.log_feature_request(
            customer_id=customer["customer_id"],
            request=message,
            plan=customer.get("plan", "free"),
        )
        return {
            "answer": "Thank you for your valuable feedback."
                      "\nWe will share it with the product team."
                      "\n\nYou can check for future updates on the release notes page.",
            "confidence": 0.9,
            "sources": [],
        }

    def _handle_general(self, customer: dict, message: str,
                        intent: dict) -> dict:
        """Handle general inquiries"""
        return self.kb.answer(message, customer)

    def _needs_immediate_escalation(self, intent: dict,
                                    customer: dict) -> bool:
        """Determine if immediate escalation is needed"""
        # Strong negative emotion
        if intent.get("sentiment") == "angry":
            return True
        if intent["sentiment"] == "negative" and intent["urgency"] in ("high", "critical"):
            return True
        # VIP customer
        if customer.get("tier") == "enterprise":
            return True
        # Complaint
        if intent["intent"] == "complaint":
            return True
        # Data loss
        if intent.get("sub_intent") == "data_loss":
            return True
        # Critical urgency
        if intent.get("urgency") == "critical":
            return True
        return False

    def _escalate(self, customer_id: str, message: str,
                  intent: dict, reason: str) -> dict:
        """Escalate to a human operator"""
        # Generate conversation summary
        session = self.conversation_manager.get_or_create_session(customer_id)
        summary = self.conversation_manager.get_context_summary(customer_id)

        # Select appropriate team
        team = self._select_escalation_team(intent)

        ticket = self.crm.create_escalation_ticket(
            customer_id=customer_id,
            message=message,
            intent=intent,
            reason=reason,
            priority="high" if intent.get("urgency") in ("high", "critical") else "normal",
            team=team,
            conversation_summary=summary,
        )

        # Escalation notification
        logger.warning(
            f"Escalation: customer={customer_id}, reason={reason}, "
            f"team={team}, ticket={ticket['id']}"
        )

        return {
            "response": "We are connecting you to a representative. Please wait a moment."
                        f"\n\nTicket number: {ticket['id']}"
                        "\nPlease provide this ticket number if you are in a hurry.",
            "intent": intent,
            "escalated": True,
            "ticket_id": ticket["id"],
            "escalation_team": team,
            "escalation_reason": reason,
        }

    def _select_escalation_team(self, intent: dict) -> str:
        """Select the escalation destination team based on intent"""
        team_map = {
            "billing": "billing_team",
            "technical": "tech_support",
            "account": "account_team",
            "complaint": "customer_success",
            "refund": "billing_team",
            "shipping": "logistics_team",
        }
        return team_map.get(intent["intent"], "general_support")

    def _request_authentication(self, customer_id: str,
                                intent: dict) -> dict:
        """Request identity verification"""
        return {
            "response": "For security purposes, we need to verify your identity."
                        "\n\nA verification code has been sent to your registered email address."
                        "\nPlease enter the 6-digit verification code.",
            "intent": intent,
            "escalated": False,
            "requires_auth": True,
            "auth_method": "email_otp",
        }

    def _check_system_status(self) -> dict:
        """Check system status"""
        # In practice, call the status page API
        return {"has_incident": False}

    def _mask_email(self, email: str) -> str:
        """Mask email address"""
        parts = email.split("@")
        if len(parts) == 2:
            name = parts[0]
            masked = name[0] + "***" + name[-1] if len(name) > 2 else "***"
            return f"{masked}@{parts[1]}"
        return "***"
```

---

## 3. Escalation Design

### 3.1 Escalation Decision Matrix

```
Escalation Decision Matrix

                    Sentiment: Positive/Neutral    Sentiment: Negative      Sentiment: Angry
                    +----------------------+----------------------+----------------------+
  Confidence: High  | Auto response        | Auto response +      | Auto response +      |
  (>0.8)           |                      | caution on tone      | present escalation   |
                    |                      |                      | options              |
                    +----------------------+----------------------+----------------------+
  Confidence: Med   | Auto response +      | Escalation           | Immediate escalation |
  (0.5-)           | with confirmation    |                      | (high priority)      |
                    +----------------------+----------------------+----------------------+
  Confidence: Low   | Escalation           | Immediate escalation | Immediate escalation |
  (<0.5)           |                      | (high priority)      | (top priority)       |
                    +----------------------+----------------------+----------------------+
```

### 3.2 Graduated Escalation Engine

```python
class EscalationEngine:
    """Graduated escalation management"""

    def __init__(self, notification_service, queue_manager):
        self.notification = notification_service
        self.queue = queue_manager
        self.rules = self._load_escalation_rules()

    def evaluate(self, ticket: SupportTicket, customer: CustomerProfile,
                 agent_response: dict) -> dict:
        """Evaluate the need and method for escalation"""
        score = self._calculate_escalation_score(
            ticket, customer, agent_response
        )

        if score < 30:
            return {"action": "auto_respond", "tier": SupportTier.AI_AGENT}
        elif score < 50:
            return {
                "action": "auto_respond_with_review",
                "tier": SupportTier.AI_AGENT,
                "review_required": True,
            }
        elif score < 70:
            return {
                "action": "escalate_l1",
                "tier": SupportTier.HUMAN_L1,
                "priority": "normal",
            }
        elif score < 90:
            return {
                "action": "escalate_l2",
                "tier": SupportTier.HUMAN_L2,
                "priority": "high",
            }
        else:
            return {
                "action": "escalate_l3",
                "tier": SupportTier.HUMAN_L3,
                "priority": "critical",
            }

    def _calculate_escalation_score(
        self, ticket: SupportTicket, customer: CustomerProfile,
        agent_response: dict
    ) -> int:
        """Calculate escalation score (0-100)"""
        score = 0

        # Score based on confidence
        confidence = agent_response.get("confidence", 0.5)
        score += int((1 - confidence) * 30)

        # Sentiment score
        sentiment_scores = {
            "positive": 0, "neutral": 5,
            "negative": 20, "angry": 40,
        }
        score += sentiment_scores.get(ticket.sentiment, 10)

        # Urgency score
        urgency_scores = {
            "low": 0, "medium": 5,
            "high": 15, "critical": 30,
        }
        score += urgency_scores.get(ticket.urgency, 5)

        # Customer tier score
        tier_scores = {
            "standard": 0, "premium": 10, "enterprise": 25,
        }
        score += tier_scores.get(customer.tier, 0)

        # Churn risk
        if customer.is_at_risk:
            score += 15

        # Repeated inquiries (3 or more times for the same issue)
        repeat_count = self._count_repeat_inquiries(
            customer.customer_id, ticket.intent
        )
        if repeat_count >= 3:
            score += 20

        return min(score, 100)

    def _count_repeat_inquiries(self, customer_id: str,
                                intent: str) -> int:
        """Count recent inquiries with the same intent"""
        recent = self.queue.get_recent_tickets(
            customer_id, days=7
        )
        return sum(1 for t in recent if t.intent == intent)

    def execute_escalation(self, ticket: SupportTicket,
                           decision: dict) -> dict:
        """Execute escalation"""
        tier = decision["tier"]
        priority = decision.get("priority", "normal")

        # Update ticket
        ticket.current_tier = tier

        # Add to queue
        queue_position = self.queue.enqueue(ticket, priority)

        # Send notifications
        if priority in ("high", "critical"):
            self.notification.send_urgent_alert(
                team=self._get_team_for_tier(tier),
                ticket=ticket,
                priority=priority,
            )

        # Notify customer of wait time
        estimated_wait = self.queue.estimate_wait_time(tier, priority)

        return {
            "ticket_id": ticket.ticket_id,
            "tier": tier.value,
            "priority": priority,
            "queue_position": queue_position,
            "estimated_wait_minutes": estimated_wait,
        }

    def _get_team_for_tier(self, tier: SupportTier) -> str:
        team_map = {
            SupportTier.HUMAN_L1: "general_support",
            SupportTier.HUMAN_L2: "specialist_support",
            SupportTier.HUMAN_L3: "engineering_escalation",
        }
        return team_map.get(tier, "general_support")
```

### 3.3 Smooth Handoff

```python
class HandoffManager:
    """Smooth handoff from AI agent to human operator"""

    def __init__(self, llm_client):
        self.client = llm_client

    def prepare_handoff_package(self, ticket: SupportTicket,
                                session: dict,
                                customer: CustomerProfile) -> dict:
        """Prepare a handoff package for the human operator"""

        # Generate conversation summary
        conversation_summary = self._summarize_conversation(
            session["messages"]
        )

        # Previously attempted solutions
        attempted_solutions = self._extract_attempted_solutions(
            session["messages"]
        )

        # Recommended actions
        recommended_actions = self._suggest_actions(
            ticket, customer, conversation_summary
        )

        return {
            "ticket_id": ticket.ticket_id,
            "customer": {
                "id": customer.customer_id,
                "name": customer.name,
                "plan": customer.plan,
                "tier": customer.tier,
                "tenure_months": customer.tenure_months,
                "lifetime_value": customer.lifetime_value,
                "avg_csat": customer.average_csat,
                "at_risk": customer.is_at_risk,
            },
            "issue": {
                "intent": ticket.intent,
                "sentiment": ticket.sentiment,
                "urgency": ticket.urgency,
                "summary": conversation_summary,
            },
            "context": {
                "attempted_solutions": attempted_solutions,
                "recommended_actions": recommended_actions,
                "related_incidents": self._find_related_incidents(ticket),
            },
            "conversation_history": session["messages"],
            "handoff_time": datetime.now().isoformat(),
        }

    def _summarize_conversation(self, messages: list) -> str:
        """Summarize the conversation"""
        conversation_text = "\n".join([
            f"{'Customer' if m['role'] == 'user' else 'AI'}: {m['content']}"
            for m in messages
        ])

        response = self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": f"""
Please summarize the following support conversation in 3 sentences or fewer.
Include the nature of the issue, the customer's emotion, and any attempted solutions.

Conversation:
{conversation_text}

Summary:
"""}]
        )
        return response.content[0].text

    def _extract_attempted_solutions(self, messages: list) -> list:
        """Extract previously attempted solutions"""
        solutions = []
        for msg in messages:
            if msg["role"] == "assistant":
                # Extract responses containing numbered lists or solution keywords
                if any(kw in msg["content"] for kw in
                       ["please try", "steps", "method", "following"]):
                    solutions.append({
                        "suggestion": msg["content"][:200],
                        "timestamp": msg.get("timestamp"),
                    })
        return solutions

    def _suggest_actions(self, ticket: SupportTicket,
                         customer: CustomerProfile,
                         summary: str) -> list:
        """Generate recommended actions for the operator"""
        actions = []

        if customer.is_at_risk:
            actions.append({
                "action": "retention_offer",
                "description": "Churn risk detected. Consider offering a retention offer.",
                "priority": "high",
            })

        if ticket.urgency in ("high", "critical"):
            actions.append({
                "action": "priority_handling",
                "description": "High urgency. Prioritized handling is recommended.",
                "priority": "high",
            })

        if customer.tier == "enterprise":
            actions.append({
                "action": "account_manager_notify",
                "description": "Enterprise customer. Notify the account manager.",
                "priority": "medium",
            })

        return actions

    def _find_related_incidents(self, ticket: SupportTicket) -> list:
        """Search for related incidents"""
        # In practice, search the incident management system
        return []
```

---

## 4. Conversation Management

### 4.1 Multi-Turn Conversation Manager

```python
# Multi-turn conversation management
class ConversationManager:
    """Session management for multi-turn conversations"""

    def __init__(self, max_session_age: int = 3600,
                 max_messages: int = 50):
        self.sessions = {}
        self.max_session_age = max_session_age
        self.max_messages = max_messages

    def get_or_create_session(self, customer_id: str) -> dict:
        if customer_id in self.sessions:
            session = self.sessions[customer_id]
            # Check session expiry
            if time.time() - session["last_activity"] > self.max_session_age:
                # Archive expired session and create a new one
                self._archive_session(customer_id, session)
                return self._create_session(customer_id)
            session["last_activity"] = time.time()
            return session
        return self._create_session(customer_id)

    def _create_session(self, customer_id: str) -> dict:
        session = {
            "session_id": f"sess_{customer_id}_{int(time.time())}",
            "messages": [],
            "intent_history": [],
            "created_at": time.time(),
            "last_activity": time.time(),
            "resolved": False,
            "authenticated": False,
            "context_variables": {},   # Custom variables
            "interaction_count": 0,
        }
        self.sessions[customer_id] = session
        return session

    def add_message(self, customer_id: str, role: str, content: str):
        session = self.get_or_create_session(customer_id)
        session["messages"].append({
            "role": role,
            "content": content,
            "timestamp": time.time()
        })
        session["interaction_count"] += 1

        # Compress if message count exceeds the limit
        if len(session["messages"]) > self.max_messages:
            self._compress_session(customer_id)

    def get_context_summary(self, customer_id: str) -> str:
        """Generate a summary of the conversation (for compressing long conversations)"""
        session = self.sessions.get(customer_id)
        if not session or len(session["messages"]) < 6:
            return ""

        # Summarize older messages
        old_messages = session["messages"][:-5]
        conversation_text = "\n".join([
            f"{'Customer' if m['role'] == 'user' else 'Support'}: {m['content']}"
            for m in old_messages
        ])

        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": f"""
Please briefly summarize the following conversation:
{conversation_text}
"""}]
        )
        return f"Summary of conversation so far: {response.content[0].text}"

    def _compress_session(self, customer_id: str):
        """Replace older messages with a summary"""
        session = self.sessions[customer_id]
        summary = self.get_context_summary(customer_id)

        # Replace old messages with summary and retain last 5 messages
        session["messages"] = [
            {"role": "system", "content": summary, "timestamp": time.time()}
        ] + session["messages"][-5:]

    def _archive_session(self, customer_id: str, session: dict):
        """Archive the session"""
        logger.info(
            f"Archiving session {session['session_id']} "
            f"({session['interaction_count']} interactions)"
        )

    def get_session_metrics(self, customer_id: str) -> dict:
        """Return session statistics"""
        session = self.sessions.get(customer_id)
        if not session:
            return {}

        messages = session["messages"]
        user_msgs = [m for m in messages if m["role"] == "user"]
        assistant_msgs = [m for m in messages if m["role"] == "assistant"]

        return {
            "session_id": session["session_id"],
            "total_messages": len(messages),
            "user_messages": len(user_msgs),
            "assistant_messages": len(assistant_msgs),
            "duration_seconds": time.time() - session["created_at"],
            "resolved": session["resolved"],
        }
```

### 4.2 Context Variable Management

```python
class ContextVariableManager:
    """Manage information collected during a conversation"""

    REQUIRED_VARIABLES = {
        "billing": ["order_id", "amount", "date"],
        "technical": ["error_message", "browser", "os"],
        "account": ["email", "auth_verified"],
        "shipping": ["order_id", "tracking_number"],
    }

    def __init__(self, llm_client):
        self.client = llm_client

    def extract_variables(self, message: str, intent: str,
                          existing_vars: dict) -> dict:
        """Extract context variables from a message"""
        required = self.REQUIRED_VARIABLES.get(intent, [])
        missing = [v for v in required if v not in existing_vars]

        if not missing:
            return existing_vars

        response = self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=256,
            messages=[{"role": "user", "content": f"""
Please extract information from the following message.

Message: {message}
Information to extract: {missing}
Existing information: {json.dumps(existing_vars, ensure_ascii=False)}

Output the extraction result in JSON format (null if not found):
"""}]
        )
        extracted = json.loads(response.content[0].text)
        return {**existing_vars, **{k: v for k, v in extracted.items() if v}}

    def get_missing_info_prompt(self, intent: str,
                                existing_vars: dict) -> Optional[str]:
        """Generate a prompt to ask for missing information"""
        required = self.REQUIRED_VARIABLES.get(intent, [])
        missing = [v for v in required if v not in existing_vars]

        if not missing:
            return None

        prompts = {
            "order_id": "Could you please provide your order number?",
            "amount": "Could you tell me the amount in question?",
            "date": "Approximately when did this occur?",
            "error_message": "Please let us know the error message that is displayed.",
            "browser": "What browser are you using (Chrome, Safari, etc.)?",
            "os": "What operating system are you using (Windows, Mac, etc.)?",
            "email": "Could you provide your registered email address?",
            "tracking_number": "Please let us know your tracking number if you have one.",
        }

        questions = [prompts.get(m, f"Could you provide {m}?") for m in missing[:2]]
        return "\n".join(questions)
```

---

## 5. Comparison Tables

### 5.1 Support Channel Comparison

| Channel | Response Speed | Cost/Case | Customer Satisfaction | Availability | Complex Issues | Setup Difficulty |
|---------|---------------|-----------|----------------------|--------------|----------------|-----------------|
| AI Chat | Instant | $0.01-0.10 | Medium-High | 24/7 | Low-Medium | Medium |
| Human Chat | 1-5 min | $5-15 | High | Business hours | High | Low |
| Email | Hours-1 day | $3-8 | Medium | 24/7 intake | Medium-High | Low |
| Phone | Wait time | $10-25 | Highest | Business hours | Highest | Low |
| FAQ/Self-service | Instant | $0.001 | Low-Medium | 24/7 | Low | Medium |
| LINE/SNS | Minutes-hours | $2-10 | Medium-High | Business hours+ | Medium | Medium |
| In-app | Instant-minutes | $0.05-0.50 | High | 24/7 | Medium | High |

### 5.2 Automation Level Comparison

| Level | Description | Resolution Rate | Use Case | Implementation Cost | ROI Payback |
|-------|-------------|----------------|---------|---------------------|-------------|
| L0 Rules | if-else fixed responses | 20-30% | Common questions | Low | 1-2 months |
| L1 Search | FAQ search + templates | 40-50% | With knowledge base | Medium | 2-4 months |
| L2 RAG | Document search + LLM generation | 50-65% | Rich documentation | Medium-High | 3-6 months |
| L3 Agent | Autonomous problem solving | 60-75% | With tool integration | High | 4-8 months |
| L4 Full Autonomy | Including account operations | 70-85% | With CRM/DB integration | Highest | 6-12 months |

### 5.3 LLM Model Selection Guide

| Use Case | Recommended Model | Latency | Cost | Reason |
|----------|------------------|---------|------|--------|
| Intent classification | Haiku | ~200ms | Lowest | Fast classification, low cost |
| Response generation (general) | Sonnet | ~1s | Medium | Well-balanced quality |
| Complex problem solving | Opus | ~3s | High | High-accuracy reasoning |
| Sentiment analysis | Haiku | ~200ms | Lowest | Fast with sufficient accuracy |
| Conversation summarization | Haiku | ~300ms | Lowest | Cost-efficient |
| Tone adjustment | Sonnet | ~800ms | Medium | Nuance reproduction |
| Knowledge creation | Opus | ~5s | High | High-quality document generation |

### 5.4 Support Tools and Platforms Comparison

| Tool | AI Support | Multi-Channel | Customizability | Price Range | Features |
|------|------------|--------------|-----------------|-------------|---------|
| Zendesk | Answer Bot | All channels | Medium | $49-215/agent | Industry standard, rich integrations |
| Intercom | Fin AI | Chat-centric | High | $74-??/agent | Conversational UX, product tours |
| Freshdesk | Freddy AI | All channels | Medium | $0-95/agent | Cost-effective, free plan available |
| Custom Build | Full control | Free | Highest | Dev cost | Complete flexibility |
| Helpscout | AI Drafts | Email-centric | Low | $20-65/user | Simple, email-focused |

---

## 6. Tone and Language Design

### 6.1 Tone Adjustment Engine

```python
# Response tone adjustment
class ToneAdjuster:
    """Tone adjustment based on customer emotion"""

    TONE_GUIDELINES = {
        "positive": {
            "description": "Bright and positive language. Celebrate the customer's good experience.",
            "opening": "Thank you!",
            "closing": "If there is anything else we can help you with, please don't hesitate to let us know.",
            "emoji_ok": True,
        },
        "neutral": {
            "description": "Polite and professional. Fact-based response.",
            "opening": "Thank you for your inquiry.",
            "closing": "If you have any questions, please feel free to contact us.",
            "emoji_ok": False,
        },
        "negative": {
            "description": "Show empathy. Start with 'We sincerely apologize for the inconvenience.' Present solution after apology.",
            "opening": "We sincerely apologize for the inconvenience this has caused.",
            "closing": "We will work to ensure this does not happen again.",
            "emoji_ok": False,
        },
        "angry": {
            "description": "Maximum empathy. Do not invalidate the emotion. Immediately present specific resolution steps. Also offer escalation option.",
            "opening": "We sincerely apologize for the trouble caused. We fully understand how you feel.",
            "closing": "We will handle this promptly. If you are not satisfied, we can also connect you to a manager.",
            "emoji_ok": False,
        }
    }

    # Prohibited phrases list
    BANNED_PHRASES = [
        "That cannot be done",
        "That's impossible",
        "That shouldn't be the case",
        "Perhaps you are mistaken",
        "As we explained before",
        "It's in the manual",
        "That is not our responsibility",
    ]

    # Replacement map
    PHRASE_REPLACEMENTS = {
        "cannot be done": "is currently difficult to accommodate. As an alternative,",
        "don't know": "will verify. Could I have a moment please?",
        "that is by design": "currently operates that way by design. We will share your feedback with the development team.",
    }

    def __init__(self):
        self.client = anthropic.Anthropic()

    def adjust(self, answer: str, sentiment: str,
               customer: dict = None) -> str:
        """Adjust the tone of a response"""

        # 1. Check for prohibited phrases
        answer = self._replace_banned_phrases(answer)

        # 2. Adjustment based on customer tier
        formality_level = "formal"
        if customer and customer.get("tier") == "enterprise":
            formality_level = "very_formal"

        guidelines = self.TONE_GUIDELINES.get(
            sentiment, self.TONE_GUIDELINES["neutral"]
        )

        response = self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Please rewrite the following response with consideration for the customer's emotion.

Tone guidelines: {guidelines['description']}
Opening greeting: {guidelines['opening']}
Closing words: {guidelines['closing']}
Formality level: {formality_level}

Original response: {answer}

Rules:
- Do not change the accuracy of the information
- Add an appropriate greeting at the beginning
- Add closing words at the end
- Never use these phrases: {self.BANNED_PHRASES}

Rewritten:
"""}]
        )
        return response.content[0].text

    def _replace_banned_phrases(self, text: str) -> str:
        """Replace prohibited phrases"""
        for banned in self.BANNED_PHRASES:
            if banned in text:
                replacement = self.PHRASE_REPLACEMENTS.get(banned, "")
                if replacement:
                    text = text.replace(banned, replacement)
        return text
```

### 6.2 Multi-Language Support

```python
class MultiLanguageSupport:
    """Multi-language support"""

    SUPPORTED_LANGUAGES = {
        "ja": {"name": "Japanese", "formality": "keigo"},
        "en": {"name": "English", "formality": "professional"},
        "zh": {"name": "Chinese", "formality": "formal"},
        "ko": {"name": "Korean", "formality": "jondaenmal"},
        "es": {"name": "Spanish", "formality": "usted"},
    }

    def __init__(self):
        self.client = anthropic.Anthropic()

    def detect_and_respond(self, message: str, answer: str,
                           preferred_language: str = None) -> dict:
        """Detect the message language and respond in the appropriate language"""

        # Language detection
        detected_lang = self._detect_language(message)

        # Use preferred language if set
        target_lang = preferred_language or detected_lang

        if target_lang not in self.SUPPORTED_LANGUAGES:
            target_lang = "en"  # Fallback

        # Translate if the answer is not in the target language
        if not self._is_language(answer, target_lang):
            lang_config = self.SUPPORTED_LANGUAGES[target_lang]
            answer = self._translate_with_tone(
                answer, target_lang, lang_config["formality"]
            )

        return {
            "answer": answer,
            "detected_language": detected_lang,
            "response_language": target_lang,
        }

    def _detect_language(self, text: str) -> str:
        """Detect the language of the text"""
        response = self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=10,
            messages=[{"role": "user", "content": f"Detect the language of this text and reply with only the ISO 639-1 code: {text[:200]}"}]
        )
        return response.content[0].text.strip().lower()

    def _is_language(self, text: str, lang: str) -> bool:
        """Determine whether the text is in the specified language"""
        detected = self._detect_language(text)
        return detected == lang

    def _translate_with_tone(self, text: str, target_lang: str,
                             formality: str) -> str:
        """Translate while maintaining tone"""
        lang_name = self.SUPPORTED_LANGUAGES[target_lang]["name"]
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Please translate the following customer support response into {lang_name}.
Formality level: {formality}
Please maintain an appropriate customer support tone.

Original: {text}

Translation:
"""}]
        )
        return response.content[0].text
```

---

## 7. Metrics and Evaluation

### 7.1 Support Metrics

```python
class SupportMetrics:
    """Metrics collection and analysis for the support agent"""

    def __init__(self, storage=None):
        self.storage = storage or {}
        self.metrics_buffer = []

    def record(self, customer_id: str, intent: dict,
               result: dict, processing_time: float):
        """Record metrics"""
        metric = {
            "timestamp": time.time(),
            "customer_id": customer_id,
            "intent": intent.get("intent"),
            "sub_intent": intent.get("sub_intent"),
            "sentiment": intent.get("sentiment"),
            "urgency": intent.get("urgency"),
            "escalated": result.get("escalated", False),
            "confidence": result.get("confidence", 0),
            "processing_time_ms": processing_time * 1000,
            "channel": result.get("channel", "web_chat"),
        }
        self.metrics_buffer.append(metric)

        # Flush when buffer exceeds 100 entries
        if len(self.metrics_buffer) >= 100:
            self._flush_metrics()

    def calculate_kpis(self, period_days: int = 30) -> dict:
        """Calculate KPIs"""
        cutoff = time.time() - (period_days * 86400)
        recent = [m for m in self.metrics_buffer if m["timestamp"] > cutoff]

        if not recent:
            return {"error": "No data available"}

        total = len(recent)
        escalated = sum(1 for m in recent if m["escalated"])
        auto_resolved = total - escalated

        # Intent distribution
        intent_dist = {}
        for m in recent:
            intent = m["intent"]
            if intent not in intent_dist:
                intent_dist[intent] = 0
            intent_dist[intent] += 1

        # Average processing time
        avg_processing_time = sum(
            m["processing_time_ms"] for m in recent
        ) / total

        # Confidence distribution
        high_confidence = sum(1 for m in recent if m["confidence"] > 0.8)
        medium_confidence = sum(1 for m in recent if 0.5 <= m["confidence"] <= 0.8)
        low_confidence = sum(1 for m in recent if m["confidence"] < 0.5)

        return {
            "period_days": period_days,
            "total_inquiries": total,
            "auto_resolution_rate": auto_resolved / total * 100,
            "escalation_rate": escalated / total * 100,
            "avg_processing_time_ms": avg_processing_time,
            "intent_distribution": intent_dist,
            "confidence_distribution": {
                "high": high_confidence,
                "medium": medium_confidence,
                "low": low_confidence,
            },
            "sentiment_breakdown": self._count_by_field(recent, "sentiment"),
            "urgency_breakdown": self._count_by_field(recent, "urgency"),
        }

    def generate_improvement_report(self) -> dict:
        """Generate an improvement report"""
        kpis = self.calculate_kpis()
        if "error" in kpis:
            return kpis

        recommendations = []

        # When auto-resolution rate is low
        if kpis["auto_resolution_rate"] < 60:
            recommendations.append({
                "area": "auto_resolution",
                "current": f"{kpis['auto_resolution_rate']:.1f}%",
                "target": "60-80%",
                "suggestion": "Expanding the knowledge base and improving intent classification accuracy is recommended. "
                             "Analyze escalation reasons and add knowledge for frequent patterns.",
            })

        # When there are many low confidence responses
        total = kpis["total_inquiries"]
        low_conf_rate = kpis["confidence_distribution"]["low"] / total * 100
        if low_conf_rate > 30:
            recommendations.append({
                "area": "knowledge_coverage",
                "current": f"Low confidence {low_conf_rate:.1f}%",
                "target": "Low confidence < 20%",
                "suggestion": "Insufficient knowledge base coverage. "
                             "Analyze low-confidence inquiries to identify and add missing documents.",
            })

        # When processing time is long
        if kpis["avg_processing_time_ms"] > 5000:
            recommendations.append({
                "area": "response_time",
                "current": f"{kpis['avg_processing_time_ms']:.0f}ms",
                "target": "< 3000ms",
                "suggestion": "Response time improvement is needed. "
                             "Consider leveraging caching, model optimization, and vector search tuning.",
            })

        return {
            "kpis": kpis,
            "recommendations": recommendations,
            "generated_at": datetime.now().isoformat(),
        }

    def _count_by_field(self, records: list, field: str) -> dict:
        counts = {}
        for r in records:
            val = r.get(field, "unknown")
            counts[val] = counts.get(val, 0) + 1
        return counts

    def _flush_metrics(self):
        """Persist metrics to storage"""
        if self.storage is not None:
            # In practice, send to a database or metrics service
            pass
```

### 7.2 CSAT (Customer Satisfaction) Collection

```python
class CSATCollector:
    """Customer satisfaction collection and analysis"""

    def __init__(self, crm):
        self.crm = crm
        self.client = anthropic.Anthropic()

    def generate_survey_prompt(self, ticket: SupportTicket) -> str:
        """Generate a CSAT survey after ticket resolution"""
        return (
            "Thank you for contacting us.\n\n"
            "Please share your feedback about our support.\n\n"
            "1. Very dissatisfied\n"
            "2. Dissatisfied\n"
            "3. Neutral\n"
            "4. Satisfied\n"
            "5. Very satisfied\n\n"
            "Please respond with a number.\n"
            "We also welcome any comments for improvement."
        )

    def process_csat_response(self, ticket_id: str,
                              response_text: str) -> dict:
        """Process a CSAT response"""
        # Extract score
        score = self._extract_score(response_text)
        comment = self._extract_comment(response_text)

        # Sentiment analysis (if there is a comment)
        sentiment = None
        if comment:
            sentiment = self._analyze_sentiment(comment)

        result = {
            "ticket_id": ticket_id,
            "score": score,
            "comment": comment,
            "sentiment": sentiment,
            "collected_at": datetime.now().isoformat(),
        }

        # Alert for low scores
        if score and score <= 2:
            self._trigger_low_csat_alert(ticket_id, result)

        return result

    def _extract_score(self, text: str) -> Optional[int]:
        """Extract a score from text"""
        for char in text:
            if char.isdigit() and 1 <= int(char) <= 5:
                return int(char)
        return None

    def _extract_comment(self, text: str) -> str:
        """Extract the comment portion from text"""
        # Treat non-numeric parts as the comment
        comment = "".join(c for c in text if not c.isdigit()).strip()
        return comment if len(comment) > 5 else ""

    def _analyze_sentiment(self, comment: str) -> str:
        """Analyze the sentiment of a comment"""
        response = self.client.messages.create(
            model="claude-haiku-4-20250514",
            max_tokens=20,
            messages=[{"role": "user", "content": f"Classify sentiment as positive/neutral/negative: {comment}"}]
        )
        return response.content[0].text.strip().lower()

    def _trigger_low_csat_alert(self, ticket_id: str, result: dict):
        """Fire an alert for a low CSAT score"""
        logger.warning(
            f"Low CSAT alert: ticket={ticket_id}, "
            f"score={result['score']}, comment={result.get('comment', 'N/A')}"
        )
```

---

## 8. Multi-Channel Integration

### 8.1 Channel Adapters

```python
from abc import ABC, abstractmethod


class ChannelAdapter(ABC):
    """Base class for channel adapters"""

    @abstractmethod
    def receive_message(self, raw_payload: dict) -> dict:
        """Convert channel-specific payload to unified format"""
        pass

    @abstractmethod
    def send_response(self, customer_id: str, message: str,
                      metadata: dict = None) -> bool:
        """Send unified-format response in channel-specific format"""
        pass

    @abstractmethod
    def format_rich_content(self, content: dict) -> dict:
        """Convert rich content (buttons, carousels, etc.) to channel format"""
        pass


class WebChatAdapter(ChannelAdapter):
    """Web chat adapter"""

    def receive_message(self, raw_payload: dict) -> dict:
        return {
            "customer_id": raw_payload["user_id"],
            "message": raw_payload["text"],
            "channel": "web_chat",
            "metadata": {
                "page_url": raw_payload.get("current_page"),
                "session_id": raw_payload.get("session_id"),
                "user_agent": raw_payload.get("user_agent"),
            },
        }

    def send_response(self, customer_id: str, message: str,
                      metadata: dict = None) -> bool:
        # Real-time delivery via WebSocket
        return self._send_via_websocket(customer_id, {
            "type": "message",
            "text": message,
            "metadata": metadata,
        })

    def format_rich_content(self, content: dict) -> dict:
        """Rich content for web chat"""
        if content["type"] == "buttons":
            return {
                "type": "button_group",
                "buttons": [
                    {"label": b["label"], "value": b["value"],
                     "style": b.get("style", "default")}
                    for b in content["buttons"]
                ],
            }
        elif content["type"] == "carousel":
            return {
                "type": "carousel",
                "items": content["items"],
            }
        return {"type": "text", "text": str(content)}

    def _send_via_websocket(self, customer_id: str,
                            payload: dict) -> bool:
        # WebSocket send implementation
        return True


class LINEAdapter(ChannelAdapter):
    """LINE adapter"""

    def __init__(self, channel_access_token: str):
        self.token = channel_access_token
        self.api_base = "https://api.line.me/v2/bot"

    def receive_message(self, raw_payload: dict) -> dict:
        event = raw_payload["events"][0]
        return {
            "customer_id": event["source"]["userId"],
            "message": event["message"]["text"],
            "channel": "line",
            "metadata": {
                "reply_token": event["replyToken"],
                "message_type": event["message"]["type"],
            },
        }

    def send_response(self, customer_id: str, message: str,
                      metadata: dict = None) -> bool:
        import requests
        reply_token = metadata.get("reply_token") if metadata else None

        if reply_token:
            # Use Reply API (free)
            url = f"{self.api_base}/message/reply"
            payload = {
                "replyToken": reply_token,
                "messages": [{"type": "text", "text": message}],
            }
        else:
            # Use Push API (paid)
            url = f"{self.api_base}/message/push"
            payload = {
                "to": customer_id,
                "messages": [{"type": "text", "text": message}],
            }

        resp = requests.post(url, json=payload, headers={
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        })
        return resp.status_code == 200

    def format_rich_content(self, content: dict) -> dict:
        """Convert to LINE Flex Message format"""
        if content["type"] == "buttons":
            return {
                "type": "flex",
                "altText": "Options",
                "contents": {
                    "type": "bubble",
                    "body": {
                        "type": "box",
                        "layout": "vertical",
                        "contents": [
                            {
                                "type": "button",
                                "action": {
                                    "type": "message",
                                    "label": b["label"],
                                    "text": b["value"],
                                },
                                "style": "primary" if b.get("style") == "primary" else "secondary",
                            }
                            for b in content["buttons"]
                        ],
                    },
                },
            }
        return {"type": "text", "text": str(content)}


class EmailAdapter(ChannelAdapter):
    """Email adapter"""

    def __init__(self, smtp_config: dict):
        self.smtp_config = smtp_config

    def receive_message(self, raw_payload: dict) -> dict:
        return {
            "customer_id": raw_payload["from_email"],
            "message": raw_payload["body_text"],
            "channel": "email",
            "metadata": {
                "subject": raw_payload["subject"],
                "message_id": raw_payload["message_id"],
                "in_reply_to": raw_payload.get("in_reply_to"),
                "cc": raw_payload.get("cc", []),
                "attachments": raw_payload.get("attachments", []),
            },
        }

    def send_response(self, customer_id: str, message: str,
                      metadata: dict = None) -> bool:
        import smtplib
        from email.mime.text import MIMEText

        msg = MIMEText(message, "plain", "utf-8")
        msg["Subject"] = f"Re: {metadata.get('subject', 'Your Inquiry')}"
        msg["From"] = self.smtp_config["from_email"]
        msg["To"] = customer_id
        if metadata and metadata.get("message_id"):
            msg["In-Reply-To"] = metadata["message_id"]

        try:
            with smtplib.SMTP(self.smtp_config["host"],
                              self.smtp_config["port"]) as server:
                server.starttls()
                server.login(
                    self.smtp_config["username"],
                    self.smtp_config["password"],
                )
                server.send_message(msg)
            return True
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False

    def format_rich_content(self, content: dict) -> dict:
        """Convert to HTML format for email"""
        if content["type"] == "buttons":
            html_buttons = "".join([
                f'<a href="{b["value"]}" style="display:inline-block;padding:10px 20px;'
                f'background:#007bff;color:white;text-decoration:none;border-radius:4px;'
                f'margin:5px;">{b["label"]}</a>'
                for b in content["buttons"]
            ])
            return {"type": "html", "content": html_buttons}
        return {"type": "text", "text": str(content)}


class ChannelRouter:
    """Channel router: unified message routing"""

    def __init__(self, support_agent: CustomerSupportAgent):
        self.agent = support_agent
        self.adapters: dict[str, ChannelAdapter] = {}

    def register_adapter(self, channel: str, adapter: ChannelAdapter):
        """Register a channel adapter"""
        self.adapters[channel] = adapter

    def route_message(self, channel: str, raw_payload: dict) -> dict:
        """Route and process a message"""
        adapter = self.adapters.get(channel)
        if not adapter:
            raise ValueError(f"Unknown channel: {channel}")

        # 1. Convert channel-specific format to unified format
        unified = adapter.receive_message(raw_payload)

        # 2. Process with the support agent
        result = self.agent.handle_inquiry(
            customer_id=unified["customer_id"],
            message=unified["message"],
            channel=channel,
        )

        # 3. Send response in channel-specific format
        adapter.send_response(
            customer_id=unified["customer_id"],
            message=result["response"],
            metadata=unified.get("metadata"),
        )

        return result
```

---

## 9. Proactive Support

### 9.1 Problem Signal Detection

```python
class ProactiveSupportEngine:
    """Proactive support: anticipatory response before problems occur"""

    def __init__(self, analytics_db, notification_service, llm_client):
        self.analytics = analytics_db
        self.notification = notification_service
        self.client = llm_client

    def detect_at_risk_customers(self) -> list:
        """Detect customers at risk of churn"""
        indicators = [
            self._check_usage_decline(),
            self._check_repeated_errors(),
            self._check_support_frequency(),
            self._check_payment_issues(),
        ]

        at_risk = set()
        for indicator_results in indicators:
            for customer_id, risk_score in indicator_results:
                if risk_score > 0.7:
                    at_risk.add(customer_id)

        return list(at_risk)

    def _check_usage_decline(self) -> list:
        """Detect decline in usage"""
        # Compare last 30 days vs. previous 30 days
        results = self.analytics.query("""
            SELECT customer_id,
                   current_usage / NULLIF(previous_usage, 0) as usage_ratio
            FROM (
                SELECT customer_id,
                       SUM(CASE WHEN date >= CURRENT_DATE - 30
                           THEN usage_count ELSE 0 END) as current_usage,
                       SUM(CASE WHEN date >= CURRENT_DATE - 60
                           AND date < CURRENT_DATE - 30
                           THEN usage_count ELSE 0 END) as previous_usage
                FROM usage_logs
                GROUP BY customer_id
            ) sub
            WHERE current_usage / NULLIF(previous_usage, 0) < 0.5
        """)
        return [(r["customer_id"], 1 - r["usage_ratio"]) for r in results]

    def _check_repeated_errors(self) -> list:
        """Detect repeated errors"""
        results = self.analytics.query("""
            SELECT customer_id, COUNT(*) as error_count
            FROM error_logs
            WHERE timestamp >= CURRENT_DATE - 7
            GROUP BY customer_id
            HAVING COUNT(*) >= 5
        """)
        return [
            (r["customer_id"], min(r["error_count"] / 20, 1.0))
            for r in results
        ]

    def _check_support_frequency(self) -> list:
        """Detect a sudden increase in support inquiry frequency"""
        results = self.analytics.query("""
            SELECT customer_id, COUNT(*) as ticket_count
            FROM support_tickets
            WHERE created_at >= CURRENT_DATE - 14
            GROUP BY customer_id
            HAVING COUNT(*) >= 3
        """)
        return [
            (r["customer_id"], min(r["ticket_count"] / 10, 1.0))
            for r in results
        ]

    def _check_payment_issues(self) -> list:
        """Detect payment issues"""
        results = self.analytics.query("""
            SELECT customer_id, COUNT(*) as failure_count
            FROM payment_events
            WHERE status = 'failed'
            AND timestamp >= CURRENT_DATE - 30
            GROUP BY customer_id
            HAVING COUNT(*) >= 1
        """)
        return [
            (r["customer_id"], min(r["failure_count"] / 3, 1.0))
            for r in results
        ]

    def generate_proactive_message(self, customer_id: str,
                                   risk_indicators: list) -> str:
        """Generate a proactive message"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": f"""
Please generate a proactive support message for a customer based on the following risk indicators.

Customer ID: {customer_id}
Risk indicators: {json.dumps(risk_indicators, ensure_ascii=False)}

Rules:
- Not pushy
- Suggest specific assistance
- Show understanding of the customer's situation
- Keep it short and concise (under 200 characters)

Message:
"""}]
        )
        return response.content[0].text
```

### 9.2 Automated Follow-Up

```python
class AutoFollowUpManager:
    """Automated follow-up management"""

    FOLLOW_UP_RULES = {
        "after_resolution": {
            "delay_hours": 24,
            "message_template": "Regarding your recent inquiry ({subject}), has the issue been resolved?",
        },
        "after_escalation": {
            "delay_hours": 4,
            "message_template": "Here is an update on escalation ticket ({ticket_id}). Current status: {status}.",
        },
        "after_feature_request": {
            "delay_days": 30,
            "message_template": "We have an update from the development team regarding your recent feature request ({feature}).",
        },
        "payment_retry": {
            "delay_hours": 2,
            "message_template": "We encountered an issue processing your payment. Please verify your payment method.",
        },
    }

    def __init__(self, scheduler, channel_router: ChannelRouter):
        self.scheduler = scheduler
        self.router = channel_router

    def schedule_follow_up(self, ticket: SupportTicket,
                           follow_up_type: str,
                           custom_params: dict = None):
        """Schedule a follow-up"""
        rule = self.FOLLOW_UP_RULES.get(follow_up_type)
        if not rule:
            return

        params = custom_params or {}
        message = rule["message_template"].format(
            subject=ticket.subject,
            ticket_id=ticket.ticket_id,
            **params,
        )

        delay_seconds = rule.get("delay_hours", 0) * 3600
        delay_seconds += rule.get("delay_days", 0) * 86400

        self.scheduler.schedule(
            delay_seconds=delay_seconds,
            callback=self._send_follow_up,
            args=(ticket.customer_id, message, ticket.ticket_id),
        )

    def _send_follow_up(self, customer_id: str, message: str,
                        ticket_id: str):
        """Send a follow-up"""
        # Only send if the ticket is still unresolved
        # In practice, check ticket status
        logger.info(
            f"Sending follow-up to {customer_id} for ticket {ticket_id}"
        )
```

---

## 10. Knowledge Base Management

### 10.1 Automated Knowledge Generation

```python
class KnowledgeBaseManager:
    """Automated generation, update, and quality management of the knowledge base"""

    def __init__(self, vector_store, llm_client):
        self.vector_store = vector_store
        self.client = llm_client

    def generate_from_resolved_tickets(self, tickets: list) -> list:
        """Automatically generate knowledge articles from resolved tickets"""
        new_articles = []

        # Cluster similar tickets
        clusters = self._cluster_similar_tickets(tickets)

        for cluster in clusters:
            if len(cluster) < 3:  # Less than 3 tickets is too specific
                continue

            # Generate representative questions and answers
            article = self._generate_article(cluster)
            if article:
                new_articles.append(article)

        return new_articles

    def _cluster_similar_tickets(self, tickets: list) -> list:
        """Cluster similar tickets"""
        # Simple implementation: group by intent + sub-intent
        clusters = {}
        for ticket in tickets:
            key = f"{ticket.get('intent', 'general')}_{ticket.get('sub_intent', 'none')}"
            if key not in clusters:
                clusters[key] = []
            clusters[key].append(ticket)
        return list(clusters.values())

    def _generate_article(self, cluster: list) -> Optional[dict]:
        """Generate a knowledge article from a ticket cluster"""
        # Collect representative questions and answers
        examples = []
        for ticket in cluster[:5]:
            examples.append({
                "question": ticket.get("initial_message", ""),
                "resolution": ticket.get("resolution_summary", ""),
            })

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": f"""
Please generate a knowledge base article from the following resolved support tickets.

Ticket examples:
{json.dumps(examples, ensure_ascii=False, indent=2)}

Output in JSON format:
{{
  "title": "Article title",
  "category": "Category",
  "question": "In FAQ format",
  "answer": "Answer (numbered list if steps are involved)",
  "keywords": ["search keywords"],
  "related_articles": ["keywords for related articles"]
}}
"""}]
        )

        try:
            article = json.loads(response.content[0].text)
            article["source_ticket_count"] = len(cluster)
            article["generated_at"] = datetime.now().isoformat()
            return article
        except json.JSONDecodeError:
            return None

    def audit_knowledge_base(self) -> dict:
        """Quality audit of the knowledge base"""
        all_articles = self.vector_store.get_all_articles()

        stale_articles = []
        duplicate_candidates = []
        low_usage = []

        for article in all_articles:
            # Detect stale articles
            updated = article.get("updated_at")
            if updated:
                age_days = (datetime.now() - datetime.fromisoformat(updated)).days
                if age_days > 180:
                    stale_articles.append({
                        "id": article["id"],
                        "title": article["title"],
                        "age_days": age_days,
                    })

            # Low-usage articles
            usage = article.get("usage_count", 0)
            if usage < 5:
                low_usage.append({
                    "id": article["id"],
                    "title": article["title"],
                    "usage_count": usage,
                })

        return {
            "total_articles": len(all_articles),
            "stale_articles": stale_articles,
            "low_usage_articles": low_usage,
            "audit_date": datetime.now().isoformat(),
        }
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: One-Size-Fits-All Template Responses

```
# BAD: Same template for all inquiries
"Thank you for your inquiry. We will confirm with the relevant department
 and respond within 3 business days."

# GOOD: Personalized response tailored to the inquiry content
"Thank you for reporting the duplicate charge.
 Upon review, we found that the charge of $39.80 on February 15th was duplicated.
 We will process a refund today. The refund will be reflected on your card within 5 business days."
```

### Anti-Pattern 2: Delayed Escalation

```python
# BAD: Insisting on self-resolution and keeping the customer waiting
for attempt in range(10):  # 10 attempts...
    answer = generate_answer(question)
    if answer.confidence > 0.3:  # Low threshold
        return answer

# GOOD: Early escalation
answer = generate_answer(question)
if answer.confidence < 0.7 or customer.is_frustrated():
    return escalate_to_human(question)  # Quickly hand off to a human
```

### Anti-Pattern 3: Ignoring Context

```python
# BAD: Starting every inquiry from scratch
def handle_message(customer_id, message):
    # Doesn't look at past conversations
    return generate_answer(message)

# GOOD: Maintaining conversation context
def handle_message(customer_id, message):
    session = conversation_manager.get_session(customer_id)
    context = session.get("messages", [])
    variables = session.get("context_variables", {})
    return generate_answer(message, context=context, variables=variables)
```

### Anti-Pattern 4: Ignoring Emotion

```python
# BAD: Treating all inquiries mechanically regardless of emotion
def respond(message, intent):
    answer = knowledge_base.search(message)
    return answer  # Same tone regardless of emotion

# GOOD: Adjust tone based on emotion
def respond(message, intent):
    answer = knowledge_base.search(message)
    sentiment = intent.get("sentiment", "neutral")
    if sentiment in ("negative", "angry"):
        answer = tone_adjuster.add_empathy(answer, sentiment)
    return answer
```

### Anti-Pattern 5: Leaving Hallucinations Unchecked

```python
# BAD: Returning LLM responses as-is
def answer_question(question):
    response = llm.generate(question)
    return response  # Confidently answers even with information not in the knowledge base

# GOOD: Only use information from the knowledge base; escalate when unknown
def answer_question(question):
    docs = knowledge_base.search(question, top_k=5)
    if not docs or max(d["similarity"] for d in docs) < 0.7:
        return {"answer": "I will look into that", "should_escalate": True}
    response = llm.generate(question, context=docs)
    return {"answer": response, "grounded": True}
```

### Anti-Pattern 6: Careless Handling of Personal Information

```python
# BAD: Passing personal information directly to the LLM
def handle_billing(customer):
    prompt = f"Customer {customer['name']}, card number {customer['card_number']}..."
    return llm.generate(prompt)

# GOOD: Mask personal information before passing to the LLM
def handle_billing(customer):
    masked = {
        "name": mask_name(customer["name"]),
        "card": f"****{customer['card_number'][-4:]}",
        "plan": customer["plan"],  # Non-sensitive information is passed as-is
    }
    prompt = f"Customer plan: {masked['plan']}, card ending: {masked['card']}..."
    return llm.generate(prompt)
```

---

## 12. Implementation Checklist

### Must (Required)

- [ ] Intent classification implementation (with confidence)
- [ ] RAG-based knowledge search and response generation
- [ ] Confidence-based escalation decision
- [ ] Handoff mechanism to human operators
- [ ] Personal information masking
- [ ] Source (evidence) attribution for responses
- [ ] Basic KPI measurement (auto-resolution rate, processing time)
- [ ] Prohibited phrase filtering

### Should (Recommended)

- [ ] Multi-turn conversation management
- [ ] Tone adjustment based on customer emotion
- [ ] CSAT (customer satisfaction) collection mechanism
- [ ] Multi-channel support (Web + LINE, etc.)
- [ ] Conversation context compression (for long conversations)
- [ ] Knowledge base quality auditing
- [ ] Two-stage intent classification (re-classification for low confidence)
- [ ] Identity verification flow

### Nice to Have

- [ ] Proactive support (churn signal detection)
- [ ] Automated knowledge generation from resolved tickets
- [ ] Automated follow-up
- [ ] Multi-language support
- [ ] Continuous response quality improvement through A/B testing
- [ ] Real-time monitoring dashboard
- [ ] VoC (Voice of Customer) analysis

---

## 13. FAQ

### Q1: How do you measure the effectiveness of a support agent?

Key KPIs:
- **Auto-resolution rate**: Percentage resolved without human intervention (target: 60-80%)
- **First Contact Resolution (FCR)**: Percentage of issues resolved with the first response
- **CSAT**: Customer satisfaction score (1-5)
- **Average Handle Time (AHT)**: Time from inquiry to resolution
- **Escalation rate**: Percentage handed off to humans
- **Cost per ticket**: Handling cost per ticket

Secondary metrics:
- **Repeat inquiry rate**: Percentage of re-inquiries for the same issue
- **Knowledge hit rate**: Percentage of inquiries answered from the knowledge base
- **Churn rate**: Cancellation rate after support
- **NPS (Net Promoter Score)**: Recommendation score

### Q2: How do you handle multiple languages?

Two approaches:
1. **Detect → Translate → Process → Translate**: Detect the input language, process internally in a single language, and translate the response back to the original language
2. **Native multi-language**: Use the LLM's multilingual capability to process and respond in the input language

For Claude, the latter is recommended. It can respond to English input directly in English. However, if the knowledge base is only in Japanese, search accuracy for queries in other languages may drop. In that case, a hybrid approach of translating the question to Japanese first, then searching, and translating the response back to the original language is effective.

### Q3: How should personal information be handled?

- **Masking**: Mask credit card numbers, passwords, etc. before passing to the LLM
- **Log management**: Exclude personal information when saving conversation logs (use PII detection tools)
- **Data retention period**: Set retention periods in compliance with GDPR/personal information protection laws
- **Verify LLM provider policy**: Confirm that data is not used for model training
- **Encryption**: Thoroughly encrypt data at rest and in transit
- **Access control**: Manage log access with the principle of least privilege

### Q4: How frequently should the knowledge base be maintained?

Recommended cycle:
- **Daily**: Automated generation of candidate articles from resolved tickets
- **Weekly**: Review of low-confidence responses and knowledge additions
- **Monthly**: Review, update, and archive of low-usage articles
- **Quarterly**: Overall quality audit and structural review

Since the freshness of the knowledge base directly impacts response quality, it is important to incorporate a regular update process within the team.

### Q5: What if the human operator for escalation is unavailable?

Solutions:
1. **Asynchronous handling**: Escalate asynchronously via email or ticket system, handled during business hours
2. **Wait time notification**: Inform the customer of the estimated wait time and suggest a callback reservation
3. **Partial response**: AI provides a partial response to the extent possible, with the rest handled by a human
4. **On-call system**: Place on-call operators for high-priority inquiries

```python
def handle_after_hours_escalation(ticket, customer):
    """After-hours escalation handling"""
    if ticket.urgency == "critical" and customer.tier == "enterprise":
        # Critical issues for enterprise customers go to on-call
        return notify_on_call_team(ticket)

    # Normally create a ticket for next business day handling
    ticket_id = create_async_ticket(ticket)
    return {
        "response": f"We apologize, but we are currently outside business hours."
                    f"\n\nTicket number: {ticket_id}"
                    f"\nA representative will contact you on the next business day ({next_business_day()})."
                    f"\n\nIf urgent, you can also use the Help Center (https://help.example.com).",
        "escalated": True,
        "async": True,
    }
```

### Q6: Should you avoid letting customers know they are talking to a bot?

Being an AI should be **disclosed clearly**. Reasons:
1. **Transparency**: Customers have the right to know they are talking to an AI
2. **Expectation management**: Understanding they are not talking to a human reduces frustration with limitations
3. **Regulations**: AI disclosure is a legal requirement in some regions

Recommended approach:
```
Example initial message:
"Hello! I am [Name], an AI assistant.
I will review your inquiry and assist you.
If needed, I can also connect you to a human operator."
```

### Q7: How much data is needed to launch a support agent?

Minimum data required:
- **FAQ/knowledge articles**: 50-100 or more
- **Past interaction history**: 500-1000 cases (for tuning intent classification)
- **Product documentation**: General documentation for major features

Phased approach:
1. Start with the top 20 FAQs
2. Accumulate data over a 2-4 week pilot operation
3. Analyze escalation reasons to expand the knowledge base
4. Expand coverage by 10-20% monthly

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Content |
|------|---------|
| Core flow | Intent classification → Knowledge search → Response generation → Escalation |
| Intent classification | Classify with fast model (Haiku), also determine emotion and urgency |
| Response generation | RAG-based, use only information from the knowledge base |
| Escalation | Decision based on confidence x emotion x customer tier matrix |
| Tone | Adjust language based on customer emotion |
| Multi-channel | Unified routing with adapter pattern |
| Proactive | Problem signal detection, churn risk analysis, automated follow-up |
| Knowledge management | Automated generation from resolved tickets, quality auditing |
| KPIs | Auto-resolution rate, CSAT, average handle time, cost per ticket |

## Next Guides to Read

- [03-data-agents.md](./03-data-agents.md) -- Data analysis agents
- [../01-patterns/02-workflow-agents.md](../01-patterns/02-workflow-agents.md) -- Workflow design in detail
- [../04-production/00-deployment.md](../04-production/00-deployment.md) -- Deploying support agents

## References

1. Anthropic, "Customer service agent cookbook" -- https://docs.anthropic.com/en/docs/about-claude/use-case-guides/customer-service
2. Zendesk, "AI in Customer Service" -- https://www.zendesk.com/blog/ai-customer-service/
3. Intercom, "AI-First Customer Service" -- https://www.intercom.com/ai-bot
4. Gartner, "Predicts: Customer Service and Support" -- https://www.gartner.com/en/customer-service-support
5. McKinsey, "The next frontier of customer engagement: AI-enabled customer service" -- https://www.mckinsey.com/capabilities/operations/our-insights
