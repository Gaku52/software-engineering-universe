# SSO and Enterprise Authentication

> In B2B SaaS, SSO (Single Sign-On) support is a mandatory requirement for enterprise contracts. This chapter covers the full picture of enterprise authentication: SAML 2.0, OIDC-based SSO, directory integration (SCIM), and per-tenant authentication configuration. More than 80% of enterprise customers require SSO, and lacking SSO support effectively means being excluded from the enterprise market.

## What You Will Learn

- [ ] Understand the concept of SSO and the difference between SAML and OIDC
- [ ] Grasp the SAML 2.0 authentication flow
- [ ] Implement OIDC-based SSO
- [ ] Learn how to design and implement per-tenant SSO configuration
- [ ] Implement directory integration via SCIM
- [ ] Understand authentication security requirements for enterprise use
- [ ] Implement Just-in-Time provisioning

## Prerequisites

- Fundamentals of the HTTP protocol
- Basic concepts of OAuth 2.0 / OpenID Connect
- Basics of TypeScript / Node.js
- Fundamentals of multi-tenant architecture

## Related Guides


---

## 1. SSO Basics

```
SSO (Single Sign-On):

  A mechanism that allows users to access multiple applications with a single login

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  User: Logs into Okta (just once)                       │
  │                                                         │
  │  → Access Slack → Automatically logged in               │
  │  → Access Jira → Automatically logged in                │
  │  → Access your app → Automatically logged in            │
  │                                                         │
  │  Identity Provider (IdP):                               │
  │    → Okta, Azure AD, Google Workspace                   │
  │    → Centralized management of user authentication      │
  │                                                         │
  │  Service Provider (SP):                                 │
  │    → Your app (the SSO-accepting side)                  │
  │    → Trusts the IdP's authentication result             │
  │                                                         │
  └─────────────────────────────────────────────────────────┘

Benefits of SSO:
  For the organization:
    → Centralized user management (control all app permissions in one place)
    → Immediate access revocation on employee departure (disable in IdP → blocks all apps)
    → Compliance support (centralized audit logs)
    → Reduced IT costs (fewer password reset requests)

  For users:
    → Fewer passwords to remember (one password for all apps)
    → Simplified login process
    → Relief from password fatigue

  For security:
    → Centralized MFA enforcement (MFA at IdP → applied to all apps)
    → Reduced risk of password leakage
    → Stronger phishing protection
    → Consistent security policy application
```

### 1.1 Comparing SSO Protocols

```
SSO Protocols:

  ┌────────────┬──────────────────┬──────────────────┬──────────────────┐
  │ Item       │ SAML 2.0          │ OIDC              │ LDAP             │
  ├────────────┼──────────────────┼──────────────────┼──────────────────┤
  │ Data format│ XML               │ JSON              │ Binary (ASN.1)   │
  │ Token      │ Assertion         │ ID Token (JWT)    │ Session          │
  │ Signing    │ XML Signature     │ JWS (JWT)         │ SASL/TLS         │
  │ Target     │ Enterprise        │ Consumer + Enterprise│ Internal network│
  │ Year       │ 2005              │ 2014              │ 1993             │
  │ Complexity │ High              │ Moderate          │ High             │
  │ Browser    │ Redirect/POST     │ Redirect          │ Not needed (TCP) │
  │ Mobile     │ △ (XML parse heavy)│ ◎ (JSON, light)  │ × (internal only)│
  │ IdP ex.    │ Okta, Azure AD,   │ Okta, Azure AD,   │ Active Directory │
  │            │ OneLogin          │ Auth0, Google     │ OpenLDAP         │
  │ Adoption   │ De facto standard │ Growing           │ Legacy           │
  │            │ in enterprise     │                   │ (shrinking)      │
  └────────────┴──────────────────┴──────────────────┴──────────────────┘

  Selection guidelines:
    Choose SAML 2.0 when:
      → Large enterprise's existing IdP supports SAML only
      → Legacy integration with Okta, OneLogin, etc.
      → Security requirements mandate XML Signature

    Choose OIDC when:
      → Modern IdP (Azure AD, Google Workspace)
      → Mobile app support is needed
      → Want to minimize development cost
      → JSON-based and easier to work with

    Support both (recommended):
      → Flexibly accommodate enterprise customer requirements
      → Design an abstraction layer to handle both SAML and OIDC uniformly
```

---

## 2. SAML 2.0

### 2.1 SAML 2.0 Authentication Flow

```
SAML 2.0 Authentication Flow (SP-Initiated):

  User        SP (your app)       IdP (Okta, etc.)
    │            │                │
    │ Access     │                │
    │───────────>│                │
    │            │ Detects unauthenticated
    │            │                │
    │ ① SAMLRequest               │
    │ (redirect)                  │
    │<───────────│                │
    │────────────────────────────>│
    │            │                │
    │            │  ② Login page  │
    │            │                │
    │<───────────────────────────│
    │ Enter credentials           │
    │────────────────────────────>│
    │            │                │
    │ ③ SAMLResponse              │
    │ (signed assertion)          │
    │<───────────────────────────│
    │────────────>│               │
    │            │ ④ Verify signature
    │            │ Create session  │
    │ ⑤ Login    │               │
    │   complete  │               │
    │<───────────│               │

IdP-Initiated SSO:
  User selects an app from the IdP dashboard and accesses it directly

  User        IdP (Okta, etc.)    SP (your app)
    │            │                │
    │            │                │
    │ Log in to Okta               │
    │───────────>│                │
    │            │                │
    │ Select app │                │
    │───────────>│                │
    │            │ Generate       │
    │            │ SAMLResponse   │
    │<───────────│                │
    │ POST /saml/callback          │
    │────────────────────────────>│
    │            │                │ Verify signature
    │            │                │ Create session
    │ Login complete               │
    │<───────────────────────────│

SAML components:
  → Assertion: XML containing user information (signed)
     → Authentication Statement: When and how the user was authenticated
     → Attribute Statement: User attributes (email, name, groups)
     → Authorization Decision Statement: Authorization decision (rarely used)
  → Metadata: Configuration information for SP/IdP (endpoints, certificates)
  → Binding: Communication method (HTTP-Redirect, HTTP-POST, SOAP)
  → Profile: Use case definitions (Web Browser SSO Profile, etc.)
```

### 2.2 SAML 2.0 Implementation

```typescript
// SAML 2.0 implementation (samlify library)
// npm install samlify @authenio/samlify-node-xmllint

import * as samlify from 'samlify';
import * as validator from '@authenio/samlify-node-xmllint';
import fs from 'fs';

// Enable XML signature validation (required in production)
samlify.setSchemaValidator(validator);

// SP (your app) configuration
const sp = samlify.ServiceProvider({
  entityID: 'https://myapp.com/saml/metadata',
  assertionConsumerService: [{
    Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
    Location: 'https://myapp.com/api/auth/saml/callback',
  }],
  singleLogoutService: [{
    Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
    Location: 'https://myapp.com/api/auth/saml/logout',
  }],
  nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
  signingCert: fs.readFileSync('./certs/sp-cert.pem', 'utf8'),
  privateKey: fs.readFileSync('./certs/sp-key.pem', 'utf8'),
  // Signing algorithm (SHA-256 recommended, SHA-1 deprecated)
  requestSignatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  // Require signed assertions (optional, for high-security environments)
  wantAssertionsSigned: true,
});

// IdP configuration (auto-configured from Okta Metadata)
async function createIdPFromMetadata(metadataUrl: string) {
  const response = await fetch(metadataUrl);
  const metadata = await response.text();

  return samlify.IdentityProvider({
    metadata,
    // Verify signature within the Assertion
    wantMessageSigned: true,
  });
}

// IdP configuration (manual)
function createIdPManually(config: {
  entityId: string;
  ssoUrl: string;
  certificate: string;
}) {
  return samlify.IdentityProvider({
    entityID: config.entityId,
    singleSignOnService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: config.ssoUrl,
    }],
    signingCert: config.certificate,
    wantMessageSigned: true,
  });
}

// SP Metadata endpoint (provided to the IdP)
app.get('/api/auth/saml/metadata', (req, res) => {
  res.type('application/xml');
  res.send(sp.getMetadata());
});

// Start SAML login (SP-Initiated)
app.get('/api/auth/saml/login', async (req, res) => {
  const { orgId } = req.query;

  // Retrieve tenant's SSO configuration
  const org = await prisma.organization.findUnique({
    where: { id: orgId as string },
  });

  if (!org?.ssoEnabled || org.ssoProvider !== 'saml') {
    return res.status(400).json({ error: 'SAML SSO not configured' });
  }

  // Configure tenant-specific IdP
  const idp = org.ssoMetadataUrl
    ? await createIdPFromMetadata(org.ssoMetadataUrl)
    : createIdPManually({
        entityId: org.ssoEntityId!,
        ssoUrl: org.ssoSignOnUrl!,
        certificate: org.ssoCertificate!,
      });

  // Store redirect destination in RelayState
  const relayState = JSON.stringify({
    orgId: org.id,
    redirectTo: req.query.redirectTo || '/dashboard',
  });

  const { context } = sp.createLoginRequest(idp, 'redirect');

  // Add RelayState as a query parameter
  const redirectUrl = new URL(context);
  redirectUrl.searchParams.set('RelayState', relayState);

  res.redirect(redirectUrl.toString());
});

// SAML callback (receive and verify Assertion)
app.post('/api/auth/saml/callback', async (req, res) => {
  try {
    // Get tenant information from RelayState
    const relayState = JSON.parse(req.body.RelayState || '{}');
    const { orgId, redirectTo } = relayState;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return res.redirect('/login?error=org_not_found');
    }

    // Configure tenant-specific IdP
    const idp = org.ssoMetadataUrl
      ? await createIdPFromMetadata(org.ssoMetadataUrl)
      : createIdPManually({
          entityId: org.ssoEntityId!,
          ssoUrl: org.ssoSignOnUrl!,
          certificate: org.ssoCertificate!,
        });

    // Verify SAML Response
    const { extract } = await sp.parseLoginResponse(idp, 'post', {
      body: req.body,
    });

    // Extract user information
    const email = extract.nameID;
    const attributes = extract.attributes || {};
    const sessionIndex = extract.sessionIndex?.sessionIndex;

    // Verify that the email domain matches the organization's domain
    const emailDomain = email.split('@')[1];
    if (org.domain && emailDomain !== org.domain) {
      await logSecurityEvent({
        type: 'saml_domain_mismatch',
        orgId: org.id,
        email,
        expectedDomain: org.domain,
        severity: 'high',
      });
      return res.redirect('/login?error=domain_mismatch');
    }

    // JIT (Just-in-Time) provisioning
    const user = await findOrCreateSAMLUser({
      email,
      name: formatUserName(attributes),
      orgId: org.id,
      samlNameId: extract.nameID,
      samlSessionIndex: sessionIndex,
      groups: attributes.groups || attributes.memberOf || [],
      attributes,
    });

    // Create session
    const { sessionId } = await sessionManager.create(
      { userId: user.id, role: user.role },
      req
    );

    setSessionCookie(res, sessionId);

    // Audit log
    await logAuthEvent({
      type: 'saml_login',
      userId: user.id,
      orgId: org.id,
      idpEntityId: org.ssoEntityId,
      ip: getClientIP(req),
    });

    res.redirect(redirectTo || '/dashboard');
  } catch (error) {
    console.error('SAML validation failed:', error);

    await logSecurityEvent({
      type: 'saml_validation_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      severity: 'high',
    });

    res.redirect('/login?error=saml_failed');
  }
});

// Format user name (attribute names differ by IdP)
function formatUserName(attributes: Record<string, unknown>): string {
  // Okta
  if (attributes.firstName && attributes.lastName) {
    return `${attributes.firstName} ${attributes.lastName}`;
  }
  // Azure AD
  if (attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname']) {
    const given = attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'];
    const surname = attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'];
    return `${given} ${surname}`;
  }
  // Google Workspace
  if (attributes.displayName) {
    return attributes.displayName as string;
  }
  // Fallback
  return attributes.name as string || 'Unknown User';
}
```

### 2.3 SAML Certificate Management

```
SAML Certificate Lifecycle:

  ┌─────────────────────────────────────────────────────────┐
  │              Importance of Certificate Management        │
  │                                                         │
  │  SAML uses X.509 certificates for XML signatures        │
  │  Expired certificate = SSO down = all users can't login │
  │                                                         │
  │  Types of certificates:                                 │
  │  1. IdP signing certificate: IdP signs SAMLResponse     │
  │     → SP verifies signature using IdP's public key      │
  │     → Download from IdP's admin console                 │
  │                                                         │
  │  2. SP signing certificate: SP signs SAMLRequest        │
  │     → IdP verifies request using SP's public key        │
  │     → Generate locally and register with the IdP        │
  │                                                         │
  │  3. SP encryption certificate: IdP encrypts Assertion   │
  │     → SP decrypts using private key                     │
  │     → Used only in high-security environments           │
  │                                                         │
  │  Certificate rotation:                                  │
  │  1. Generate a new certificate                          │
  │  2. Include both old and new certificates in Metadata   │
  │  3. Register the new Metadata with the IdP              │
  │  4. Remove the old certificate                          │
  │  ⚠️ Zero-downtime rotation is required                  │
  └─────────────────────────────────────────────────────────┘
```

```typescript
// SP certificate generation and management
import { execSync } from 'child_process';
import crypto from 'crypto';

class SAMLCertificateManager {
  // Generate a self-signed certificate (for SP)
  static generateSPCertificate(options: {
    commonName: string;
    organization: string;
    validityDays: number;
    outputDir: string;
  }): { certPath: string; keyPath: string } {
    const { commonName, organization, validityDays, outputDir } = options;

    const keyPath = `${outputDir}/sp-key.pem`;
    const certPath = `${outputDir}/sp-cert.pem`;

    // Generate RSA 2048-bit private key
    execSync(`openssl genrsa -out ${keyPath} 2048`);

    // Generate self-signed certificate
    execSync(
      `openssl req -new -x509 -key ${keyPath} -out ${certPath} ` +
      `-days ${validityDays} ` +
      `-subj "/CN=${commonName}/O=${organization}"`
    );

    return { certPath, keyPath };
  }

  // Check certificate expiry
  static async checkCertificateExpiry(certPem: string): Promise<{
    expiresAt: Date;
    daysUntilExpiry: number;
    isExpired: boolean;
    isExpiringSoon: boolean; // within 30 days
  }> {
    const cert = new crypto.X509Certificate(certPem);
    const expiresAt = new Date(cert.validTo);
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      expiresAt,
      daysUntilExpiry,
      isExpired: daysUntilExpiry < 0,
      isExpiringSoon: daysUntilExpiry < 30,
    };
  }

  // Periodic certificate check (run via cron)
  static async checkAllOrganizationCertificates(): Promise<void> {
    const orgs = await prisma.organization.findMany({
      where: { ssoEnabled: true, ssoProvider: 'saml' },
    });

    for (const org of orgs) {
      if (!org.ssoCertificate) continue;

      const status = await SAMLCertificateManager.checkCertificateExpiry(
        org.ssoCertificate
      );

      if (status.isExpired) {
        // Expired → urgent notification to admins
        await notifyOrgAdmins(org.id, {
          type: 'certificate_expired',
          message: 'The SSO certificate has expired. SSO is not functioning.',
          severity: 'critical',
        });
      } else if (status.isExpiringSoon) {
        // Expiring soon → warning to admins
        await notifyOrgAdmins(org.id, {
          type: 'certificate_expiring_soon',
          message: `The SSO certificate will expire in ${status.daysUntilExpiry} days.`,
          severity: 'warning',
        });
      }
    }
  }
}
```

---

## 3. OIDC-Based SSO

```
OIDC SSO Flow:

  OIDC is a lighter, more modern SSO protocol than SAML
  JSON-based, uses JWT, supports mobile

  User        SP (your app)       IdP (Azure AD, etc.)
    │            │                │
    │ Access     │                │
    │───────────>│                │
    │            │ Detects unauthenticated
    │            │                │
    │ ① Authorization Request     │
    │ (PKCE + state + nonce)      │
    │<───────────│                │
    │────────────────────────────>│
    │            │                │
    │            │  ② Login page  │
    │<───────────────────────────│
    │ Enter credentials           │
    │────────────────────────────>│
    │            │                │
    │ ③ Authorization Code        │
    │<───────────────────────────│
    │────────────>│               │
    │            │                │
    │            │ ④ Token Request│
    │            │ (code + PKCE)  │
    │            │ ──────────────>│
    │            │                │
    │            │ ⑤ ID Token +   │
    │            │ Access Token   │
    │            │ <──────────────│
    │            │                │
    │            │ ⑥ Verify ID Token
    │            │ Create session  │
    │ ⑦ Login    │               │
    │   complete  │               │
    │<───────────│               │

  Differences from SAML:
    → ID Token is JWT (JSON), so it's lightweight
    → Security enhanced with PKCE
    → Additional info retrieved from UserInfo endpoint
    → Session can be extended with refresh tokens
```

```typescript
// OIDC-based SSO implementation
import { Issuer, Client, generators, TokenSet } from 'openid-client';

class OIDCSSOManager {
  private clients: Map<string, Client> = new Map();

  // Get tenant-specific OIDC client
  async getClient(org: Organization): Promise<Client> {
    const cacheKey = org.id;

    // Check cache
    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!;
    }

    // Auto-retrieve provider info via OIDC Discovery
    const issuer = await Issuer.discover(org.ssoIssuer!);

    const client = new issuer.Client({
      client_id: org.ssoClientId!,
      client_secret: decrypt(org.ssoClientSecret!),
      redirect_uris: [`https://myapp.com/api/auth/oidc/${org.id}/callback`],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    });

    this.clients.set(cacheKey, client);
    return client;
  }

  // Initiate SSO login
  async initiateLogin(
    orgId: string,
    redirectTo: string
  ): Promise<{ url: string; state: string; nonce: string; codeVerifier: string }> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org?.ssoEnabled || org.ssoProvider !== 'oidc') {
      throw new Error('OIDC SSO not configured');
    }

    const client = await this.getClient(org);

    // PKCE
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // state (CSRF protection)
    const state = generators.state();

    // nonce (replay attack protection)
    const nonce = generators.nonce();

    const url = client.authorizationUrl({
      scope: 'openid email profile groups',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // Login hint (specify domain to skip IdP login screen)
      login_hint: `@${org.domain}`,
    });

    // Save state, nonce, codeVerifier in Redis (valid for 5 minutes)
    await redis.setex(
      `oidc_state:${state}`,
      300,
      JSON.stringify({ orgId, nonce, codeVerifier, redirectTo })
    );

    return { url, state, nonce, codeVerifier };
  }

  // Handle callback
  async handleCallback(
    orgId: string,
    params: Record<string, string>,
    req: Request
  ): Promise<{ user: User; sessionId: string }> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) throw new Error('Organization not found');

    const client = await this.getClient(org);

    // Verify state
    const stateData = await redis.get(`oidc_state:${params.state}`);
    if (!stateData) throw new Error('Invalid or expired state');

    const { nonce, codeVerifier, redirectTo } = JSON.parse(stateData);

    // Mark state as used (prevent replay attacks)
    await redis.del(`oidc_state:${params.state}`);

    // Exchange Authorization Code for Token
    const tokenSet: TokenSet = await client.callback(
      `https://myapp.com/api/auth/oidc/${orgId}/callback`,
      params,
      {
        state: params.state,
        nonce,
        code_verifier: codeVerifier,
      }
    );

    // ID Token validation is done automatically by openid-client
    // → signature, issuer, audience, nonce, expiry verification
    const claims = tokenSet.claims();

    // Verify email
    if (!claims.email_verified) {
      throw new Error('Email not verified at IdP');
    }

    // Verify domain
    const emailDomain = (claims.email as string).split('@')[1];
    if (org.domain && emailDomain !== org.domain) {
      throw new Error('Email domain mismatch');
    }

    // Get additional info from UserInfo endpoint (groups, etc.)
    let userInfo = claims;
    try {
      const additionalInfo = await client.userinfo(tokenSet.access_token!);
      userInfo = { ...claims, ...additionalInfo };
    } catch {
      // Use only claims if UserInfo is unavailable
    }

    // JIT provisioning
    const user = await findOrCreateOIDCUser({
      email: claims.email as string,
      name: claims.name as string,
      sub: claims.sub,
      orgId: org.id,
      groups: (userInfo as any).groups || [],
      picture: claims.picture as string,
    });

    // Create session
    const { sessionId } = await sessionManager.create(
      { userId: user.id, role: user.role },
      req
    );

    // Audit log
    await logAuthEvent({
      type: 'oidc_sso_login',
      userId: user.id,
      orgId: org.id,
      issuer: org.ssoIssuer,
      ip: getClientIP(req),
    });

    return { user, sessionId };
  }
}
```

---

## 4. Per-Tenant SSO Configuration

```
Multi-tenant SSO:

  Tenant A: SAML SSO with Okta
  Tenant B: OIDC SSO with Azure AD
  Tenant C: OIDC SSO with Google Workspace
  Tenant D: No SSO (email + password)

  Login flow:

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  ① User enters email address                            │
  │     alice@company-a.com                                 │
  │                                                         │
  │  ② Identify organization by domain                      │
  │     company-a.com → Tenant A                            │
  │                                                         │
  │  ③ Check tenant's SSO configuration                     │
  │     Tenant A: ssoEnabled=true, ssoProvider="saml"       │
  │                                                         │
  │  ④ If SSO is configured                                 │
  │     → Redirect to IdP (Okta login screen)               │
  │                                                         │
  │  ⑤ If SSO is not configured                             │
  │     → Show password input screen                        │
  │                                                         │
  │  ⑥ If SSO is enforced (enforceSSO=true)                 │
  │     → Reject password login                             │
  │     → "This organization requires SSO login"            │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 4.1 Data Model

```typescript
// Data model for per-tenant SSO configuration
// schema.prisma

// model Organization {
//   id               String   @id @default(cuid())
//   name             String
//   slug             String   @unique          // URL slug
//   domain           String?  @unique          // "company-a.com"
//   domains          String[] @default([])     // Multiple domain support
//
//   // SSO configuration
//   ssoEnabled       Boolean  @default(false)
//   ssoProvider      String?                   // "saml" | "oidc"
//   enforceSSO       Boolean  @default(false)  // Enforce SSO
//
//   // SAML configuration
//   ssoEntityId      String?                   // IdP Entity ID
//   ssoSignOnUrl     String?                   // IdP SSO URL
//   ssoLogoutUrl     String?                   // IdP SLO URL
//   ssoCertificate   String?  @db.Text         // IdP signing certificate (PEM)
//   ssoMetadataUrl   String?                   // IdP Metadata URL (for auto-update)
//   ssoMetadataXml   String?  @db.Text         // IdP Metadata XML
//
//   // OIDC configuration
//   ssoClientId      String?
//   ssoClientSecret  String?                   // Stored encrypted
//   ssoIssuer        String?                   // OIDC issuer URL
//
//   // Security settings
//   mfaRequired      Boolean  @default(false)  // Enforce MFA
//   sessionMaxAge    Int?                      // Max session duration (seconds)
//   ipAllowlist      String[] @default([])     // IP allowlist
//
//   // SCIM configuration
//   scimEnabled      Boolean  @default(false)
//   scimToken        String?                   // SCIM API token (hashed)
//   scimTokenSalt    String?
//
//   // Relations
//   members          OrganizationMember[]
//   ssoConnections   SSOConnection[]
//   auditLogs        AuditLog[]
//
//   createdAt        DateTime @default(now())
//   updatedAt        DateTime @updatedAt
// }
//
// model SSOConnection {
//   id               String   @id @default(cuid())
//   orgId            String
//   org              Organization @relation(fields: [orgId], references: [id])
//   provider         String   // "saml" | "oidc"
//   name             String   // "Okta Production", "Azure AD", etc.
//   isActive         Boolean  @default(true)
//   isPrimary        Boolean  @default(false)  // Main SSO connection
//   config           Json     // Provider-specific configuration
//   lastTestedAt     DateTime?
//   lastUsedAt       DateTime?
//   createdAt        DateTime @default(now())
//   updatedAt        DateTime @updatedAt
//
//   @@unique([orgId, isPrimary])  // Only one primary per organization
// }
```

### 4.2 Login Flow Implementation

```typescript
// Identify organization by email domain
async function getOrgByEmailDomain(email: string): Promise<Organization | null> {
  const domain = email.split('@')[1].toLowerCase();

  // Exact match search
  let org = await prisma.organization.findUnique({
    where: { domain },
  });

  if (org) return org;

  // Multiple domain support (search in domains array)
  org = await prisma.organization.findFirst({
    where: { domains: { has: domain } },
  });

  return org;
}

// Start login (determine SSO from email address)
app.post('/api/auth/login/check', async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const org = await getOrgByEmailDomain(email);

  if (org?.ssoEnabled) {
    // Redirect to SSO
    return res.json({
      method: 'sso',
      provider: org.ssoProvider,
      orgId: org.id,
      orgName: org.name,
      redirectUrl: `/api/auth/sso/${org.id}/login`,
    });
  }

  if (org?.enforceSSO) {
    // SSO enforced but not configured → error
    return res.status(403).json({
      error: 'SSO is required for this organization but not configured',
      contactAdmin: true,
    });
  }

  // Password login
  return res.json({
    method: 'password',
    // Show hint if SSO is available
    ssoAvailable: org?.ssoEnabled || false,
  });
});

// Unified SSO login entry point
app.get('/api/auth/sso/:orgId/login', async (req, res) => {
  const { orgId } = req.params;
  const { redirectTo } = req.query;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org?.ssoEnabled) {
    return res.redirect('/login?error=sso_not_configured');
  }

  switch (org.ssoProvider) {
    case 'saml': {
      // Route to SAML login flow
      const idp = await getSAMLIdP(org);
      const { context } = sp.createLoginRequest(idp, 'redirect');
      const url = new URL(context);
      url.searchParams.set('RelayState', JSON.stringify({
        orgId: org.id,
        redirectTo: redirectTo || '/dashboard',
      }));
      return res.redirect(url.toString());
    }

    case 'oidc': {
      // Route to OIDC login flow
      const oidcManager = new OIDCSSOManager();
      const { url } = await oidcManager.initiateLogin(
        orgId,
        (redirectTo as string) || '/dashboard'
      );
      return res.redirect(url);
    }

    default:
      return res.redirect('/login?error=unknown_sso_provider');
  }
});
```

### 4.3 SSO Admin Panel (for Organization Administrators)

```typescript
// SSO configuration API (for organization administrators)

// Get SSO configuration
app.get('/api/admin/sso/config', requireOrgAdmin, async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.orgId },
    select: {
      ssoEnabled: true,
      ssoProvider: true,
      enforceSSO: true,
      ssoEntityId: true,
      ssoSignOnUrl: true,
      ssoMetadataUrl: true,
      ssoClientId: true,
      ssoIssuer: true,
      // Do not return sensitive data
      // ssoCertificate, ssoClientSecret are excluded
    },
  });

  // SP Metadata URL (information to configure in IdP)
  const spInfo = {
    entityId: 'https://myapp.com/saml/metadata',
    acsUrl: `https://myapp.com/api/auth/saml/${req.orgId}/callback`,
    metadataUrl: 'https://myapp.com/api/auth/saml/metadata',
    sloUrl: `https://myapp.com/api/auth/saml/${req.orgId}/logout`,
    // For OIDC
    redirectUri: `https://myapp.com/api/auth/oidc/${req.orgId}/callback`,
  };

  res.json({ config: org, spInfo });
});

// Configure SAML SSO
app.put('/api/admin/sso/saml', requireOrgAdmin, async (req, res) => {
  const { metadataUrl, metadataXml, entityId, signOnUrl, certificate } = req.body;

  // Auto-fetch from Metadata URL
  let resolvedConfig: any = {};

  if (metadataUrl) {
    try {
      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.text();
      resolvedConfig = parseSAMLMetadata(metadata);
      resolvedConfig.ssoMetadataUrl = metadataUrl;
      resolvedConfig.ssoMetadataXml = metadata;
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to fetch SAML metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else if (metadataXml) {
    resolvedConfig = parseSAMLMetadata(metadataXml);
    resolvedConfig.ssoMetadataXml = metadataXml;
  } else {
    // Manual configuration
    if (!entityId || !signOnUrl || !certificate) {
      return res.status(400).json({
        error: 'entityId, signOnUrl, certificate are required for manual configuration',
      });
    }

    // Validate certificate format
    if (!isValidX509Certificate(certificate)) {
      return res.status(400).json({ error: 'Invalid X.509 certificate' });
    }

    resolvedConfig = {
      ssoEntityId: entityId,
      ssoSignOnUrl: signOnUrl,
      ssoCertificate: certificate,
    };
  }

  // Save configuration
  await prisma.organization.update({
    where: { id: req.orgId },
    data: {
      ssoEnabled: true,
      ssoProvider: 'saml',
      ...resolvedConfig,
    },
  });

  // Audit log
  await logAdminEvent({
    type: 'sso_saml_configured',
    orgId: req.orgId,
    adminId: req.userId,
  });

  res.json({ success: true, message: 'SAML SSO configured' });
});

// Test SSO connection
app.post('/api/admin/sso/test', requireOrgAdmin, async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.orgId },
  });

  if (!org?.ssoEnabled) {
    return res.status(400).json({ error: 'SSO not configured' });
  }

  try {
    switch (org.ssoProvider) {
      case 'saml': {
        // Test fetching SAML Metadata
        if (org.ssoMetadataUrl) {
          const metadataRes = await fetch(org.ssoMetadataUrl, { signal: AbortSignal.timeout(10000) });
          if (!metadataRes.ok) throw new Error(`Metadata fetch failed: ${metadataRes.status}`);
        }

        // Check certificate expiry
        if (org.ssoCertificate) {
          const certStatus = await SAMLCertificateManager.checkCertificateExpiry(org.ssoCertificate);
          if (certStatus.isExpired) {
            return res.json({
              success: false,
              error: 'IdP certificate has expired',
              details: certStatus,
            });
          }
        }

        return res.json({ success: true, provider: 'saml' });
      }

      case 'oidc': {
        // Test fetching OIDC Discovery
        const discoveryUrl = `${org.ssoIssuer}/.well-known/openid-configuration`;
        const discoveryRes = await fetch(discoveryUrl, { signal: AbortSignal.timeout(10000) });
        if (!discoveryRes.ok) throw new Error(`Discovery fetch failed: ${discoveryRes.status}`);

        const discovery = await discoveryRes.json();

        return res.json({
          success: true,
          provider: 'oidc',
          issuer: discovery.issuer,
          endpoints: {
            authorization: discovery.authorization_endpoint,
            token: discovery.token_endpoint,
            userinfo: discovery.userinfo_endpoint,
          },
        });
      }
    }
  } catch (error) {
    return res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
});

// Enable/disable SSO
app.put('/api/admin/sso/toggle', requireOrgAdmin, async (req, res) => {
  const { enabled, enforceSSO } = req.body;

  // Confirmation when disabling SSO
  if (!enabled) {
    const activeUsers = await prisma.organizationMember.count({
      where: { orgId: req.orgId },
    });

    // Send password reset to users who only log in via SSO
    if (activeUsers > 0) {
      const ssoOnlyUsers = await prisma.user.findMany({
        where: {
          memberships: { some: { orgId: req.orgId } },
          passwordHash: null, // No password set (SSO-only login)
        },
      });

      if (ssoOnlyUsers.length > 0) {
        return res.status(400).json({
          error: 'Cannot disable SSO',
          reason: `${ssoOnlyUsers.length} users have no password set`,
          suggestion: 'Send password reset emails before disabling SSO',
          affectedUsers: ssoOnlyUsers.map((u) => u.email),
        });
      }
    }
  }

  await prisma.organization.update({
    where: { id: req.orgId },
    data: {
      ssoEnabled: enabled,
      enforceSSO: enforceSSO ?? false,
    },
  });

  await logAdminEvent({
    type: enabled ? 'sso_enabled' : 'sso_disabled',
    orgId: req.orgId,
    adminId: req.userId,
    enforceSSO,
  });

  res.json({ success: true });
});
```

---

## 5. JIT (Just-in-Time) Provisioning

```
JIT Provisioning:

  A mechanism to automatically create user accounts on SSO login

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  Traditional approach:                                  │
  │  1. Admin manually creates user                         │
  │  2. Send invitation email to user                       │
  │  3. User activates account                              │
  │  → Admin overhead + user waiting time                   │
  │                                                         │
  │  JIT Provisioning:                                      │
  │  1. User logs in via IdP                                │
  │  2. Auto-create user if not found at SSO callback       │
  │  3. Auto-assign role from IdP attributes (groups, etc.) │
  │  → Zero admin effort + instant access                   │
  │                                                         │
  │  Caveats:                                               │
  │  → Unexpected users may be created (domain validation required)
  │  → Role/permission auto-mapping rules design is critical │
  │  → Cleanup of unused accounts is necessary              │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

```typescript
// JIT provisioning implementation

interface SSOUserData {
  email: string;
  name: string;
  orgId: string;
  samlNameId?: string;
  samlSessionIndex?: string;
  sub?: string;           // OIDC subject
  groups?: string[];      // IdP groups
  picture?: string;
  attributes?: Record<string, unknown>;
}

async function findOrCreateSSOUser(data: SSOUserData): Promise<User> {
  // 1. Search for existing user
  let user = await prisma.user.findFirst({
    where: {
      email: data.email.toLowerCase(),
      memberships: { some: { orgId: data.orgId } },
    },
    include: { memberships: true },
  });

  if (user) {
    // 2a. Update existing user's information
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        picture: data.picture,
        samlNameId: data.samlNameId,
        oidcSub: data.sub,
        lastLoginAt: new Date(),
        // Group-based role update
        memberships: {
          update: {
            where: {
              userId_orgId: { userId: user.id, orgId: data.orgId },
            },
            data: {
              role: mapGroupsToRole(data.groups || [], data.orgId),
            },
          },
        },
      },
      include: { memberships: true },
    });

    return user;
  }

  // 2b. Auto-create new user (JIT provisioning)
  const org = await prisma.organization.findUnique({
    where: { id: data.orgId },
  });

  if (!org) throw new Error('Organization not found');

  // Check if JIT provisioning is enabled
  if (!org.jitProvisioningEnabled) {
    throw new Error('Just-in-Time provisioning is not enabled for this organization');
  }

  // Domain validation
  const emailDomain = data.email.split('@')[1].toLowerCase();
  const allowedDomains = [org.domain, ...org.domains].filter(Boolean);
  if (!allowedDomains.includes(emailDomain)) {
    throw new Error(`Email domain ${emailDomain} is not allowed for this organization`);
  }

  // Map groups to role
  const role = mapGroupsToRole(data.groups || [], data.orgId);

  // Create user
  user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      picture: data.picture,
      samlNameId: data.samlNameId,
      oidcSub: data.sub,
      emailVerified: true,  // Already verified by IdP
      lastLoginAt: new Date(),
      memberships: {
        create: {
          orgId: data.orgId,
          role,
          joinedVia: 'sso_jit',
        },
      },
    },
    include: { memberships: true },
  });

  // Audit log
  await logAuthEvent({
    type: 'jit_user_created',
    userId: user.id,
    orgId: data.orgId,
    email: data.email,
    role,
    groups: data.groups,
  });

  // Notify organization admins
  await notifyOrgAdmins(data.orgId, {
    type: 'new_user_via_jit',
    message: `${data.email} was automatically created via SSO`,
    userId: user.id,
  });

  return user;
}

// Mapping groups to roles
function mapGroupsToRole(groups: string[], orgId: string): string {
  // Get organization-specific mapping rules
  // Example: Okta group "MyApp-Admins" → admin role
  const mappingRules = [
    { pattern: /admin/i, role: 'admin' },
    { pattern: /manager/i, role: 'manager' },
    { pattern: /editor/i, role: 'editor' },
    { pattern: /viewer/i, role: 'viewer' },
  ];

  for (const rule of mappingRules) {
    if (groups.some((g) => rule.pattern.test(g))) {
      return rule.role;
    }
  }

  return 'member'; // Default role
}
```

---

## 6. SCIM (Directory Integration)

```
SCIM (System for Cross-domain Identity Management):

  Synchronize the IdP's user directory with your app:
  → Automatic user creation (provisioning)
  → Automatic user deactivation (deprovisioning)
  → Group membership synchronization
  → Attribute change synchronization (name change, department change, etc.)

  Differences from JIT provisioning:

  ┌──────────────────┬──────────────────────┬──────────────────────┐
  │ Item             │ JIT Provisioning      │ SCIM                 │
  ├──────────────────┼──────────────────────┼──────────────────────┤
  │ Timing           │ At login             │ At IdP change        │
  │ Direction        │ IdP → SP (at login)  │ IdP → SP (ongoing)   │
  │ User creation    │ ✓                    │ ✓                    │
  │ User deactivation│ ✗ (only detectable   │ ✓ (immediate)        │
  │                  │   if user logs in)   │                      │
  │ Attribute update │ △ (login only)        │ ✓ (immediate)        │
  │ Group sync       │ △ (login only)        │ ✓ (immediate)        │
  │ Implementation   │ Low                  │ High                 │
  │ cost             │                      │                      │
  │ Recommended for  │ Startups             │ Enterprise           │
  └──────────────────┴──────────────────────┴──────────────────────┘

  SCIM API endpoints (RFC 7644):

    GET    /scim/v2/Users           — List users
    POST   /scim/v2/Users           — Create user
    GET    /scim/v2/Users/:id       — Get user
    PUT    /scim/v2/Users/:id       — Update user (all attributes)
    PATCH  /scim/v2/Users/:id       — Partial user update
    DELETE /scim/v2/Users/:id       — Delete user

    GET    /scim/v2/Groups          — List groups
    POST   /scim/v2/Groups          — Create group
    GET    /scim/v2/Groups/:id      — Get group
    PUT    /scim/v2/Groups/:id      — Update group
    PATCH  /scim/v2/Groups/:id      — Partial group update
    DELETE /scim/v2/Groups/:id      — Delete group

    GET    /scim/v2/ServiceProviderConfig — SP capability info
    GET    /scim/v2/Schemas         — Schema definitions
    GET    /scim/v2/ResourceTypes   — Resource types
```

```typescript
// SCIM endpoint implementation

import express from 'express';

const scimRouter = express.Router();

// SCIM authentication middleware
async function scimAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Authentication required',
      status: '401',
    });
  }

  const token = authHeader.replace('Bearer ', '');

  // Identify organization from token
  const org = await findOrgByScimToken(token);
  if (!org) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid SCIM token',
      status: '401',
    });
  }

  (req as any).orgId = org.id;
  next();
}

scimRouter.use(scimAuth);

// Convert to SCIM user
function toScimUser(user: User & { memberships: OrganizationMember[] }): any {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user.id,
    externalId: user.externalId,
    userName: user.email,
    name: {
      givenName: user.name?.split(' ')[0] || '',
      familyName: user.name?.split(' ').slice(1).join(' ') || '',
      formatted: user.name || '',
    },
    emails: [{
      value: user.email,
      type: 'work',
      primary: true,
    }],
    active: user.active,
    groups: user.memberships.map((m) => ({
      value: m.teamId,
      display: m.teamName,
    })),
    meta: {
      resourceType: 'User',
      created: user.createdAt.toISOString(),
      lastModified: user.updatedAt.toISOString(),
      location: `https://myapp.com/scim/v2/Users/${user.id}`,
    },
  };
}

// List users
scimRouter.get('/Users', async (req, res) => {
  const orgId = (req as any).orgId;
  const startIndex = parseInt(req.query.startIndex as string) || 1;
  const count = Math.min(parseInt(req.query.count as string) || 100, 200);

  // Parse filter (e.g., filter=userName eq "alice@example.com")
  const filter = req.query.filter as string;
  let where: any = {
    memberships: { some: { orgId } },
  };

  if (filter) {
    const match = filter.match(/userName eq "(.+)"/);
    if (match) {
      where.email = match[1];
    }
  }

  const [users, totalResults] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { memberships: { where: { orgId } } },
      skip: startIndex - 1,
      take: count,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults,
    startIndex,
    itemsPerPage: count,
    Resources: users.map(toScimUser),
  });
});

// Create user
scimRouter.post('/Users', async (req, res) => {
  const orgId = (req as any).orgId;
  const scimUser = req.body;

  // Check for existing user
  const existingUser = await prisma.user.findFirst({
    where: {
      email: scimUser.userName || scimUser.emails?.[0]?.value,
      memberships: { some: { orgId } },
    },
  });

  if (existingUser) {
    return res.status(409).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'User already exists',
      status: '409',
      scimType: 'uniqueness',
    });
  }

  const user = await prisma.user.create({
    data: {
      externalId: scimUser.externalId,
      email: (scimUser.userName || scimUser.emails?.[0]?.value).toLowerCase(),
      name: scimUser.name?.formatted ||
        `${scimUser.name?.givenName || ''} ${scimUser.name?.familyName || ''}`.trim(),
      active: scimUser.active ?? true,
      emailVerified: true,
      memberships: {
        create: {
          orgId,
          role: 'member',
          joinedVia: 'scim',
        },
      },
    },
    include: { memberships: { where: { orgId } } },
  });

  await logAuditEvent({
    type: 'scim_user_created',
    orgId,
    userId: user.id,
    email: user.email,
  });

  res.status(201).json(toScimUser(user));
});

// Get user
scimRouter.get('/Users/:id', async (req, res) => {
  const orgId = (req as any).orgId;

  const user = await prisma.user.findFirst({
    where: {
      id: req.params.id,
      memberships: { some: { orgId } },
    },
    include: { memberships: { where: { orgId } } },
  });

  if (!user) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'User not found',
      status: '404',
    });
  }

  res.json(toScimUser(user));
});

// Partial user update (PATCH)
scimRouter.patch('/Users/:id', async (req, res) => {
  const orgId = (req as any).orgId;
  const operations = req.body.Operations || [];

  const user = await prisma.user.findFirst({
    where: {
      id: req.params.id,
      memberships: { some: { orgId } },
    },
  });

  if (!user) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'User not found',
      status: '404',
    });
  }

  const updateData: any = {};

  for (const op of operations) {
    switch (op.op.toLowerCase()) {
      case 'replace': {
        if (op.path === 'active') {
          updateData.active = op.value;

          if (op.value === false) {
            // Deactivate user (deprovisioning)
            updateData.deactivatedAt = new Date();

            // Invalidate all sessions
            await sessionManager.destroyAllForUser(user.id);

            // Revoke all Remember Me tokens
            await rememberMeManager.revokeAllForUser(user.id);

            await logAuditEvent({
              type: 'scim_user_deactivated',
              orgId,
              userId: user.id,
              email: user.email,
            });
          } else {
            // Reactivate user
            updateData.deactivatedAt = null;

            await logAuditEvent({
              type: 'scim_user_reactivated',
              orgId,
              userId: user.id,
              email: user.email,
            });
          }
        }

        if (op.path === 'userName') {
          updateData.email = op.value.toLowerCase();
        }

        if (op.path === 'name.givenName' || op.path === 'name.familyName') {
          // Rebuild full name for name updates
          const currentName = user.name?.split(' ') || ['', ''];
          if (op.path === 'name.givenName') currentName[0] = op.value;
          if (op.path === 'name.familyName') currentName[1] = op.value;
          updateData.name = currentName.join(' ').trim();
        }
        break;
      }

      case 'add': {
        // Add to group, etc.
        break;
      }

      case 'remove': {
        // Remove from group, etc.
        break;
      }
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    include: { memberships: { where: { orgId } } },
  });

  res.json(toScimUser(updatedUser));
});

// Delete user (full delete or deactivation)
scimRouter.delete('/Users/:id', async (req, res) => {
  const orgId = (req as any).orgId;

  const user = await prisma.user.findFirst({
    where: {
      id: req.params.id,
      memberships: { some: { orgId } },
    },
  });

  if (!user) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'User not found',
      status: '404',
    });
  }

  // Soft delete (recommended: deactivate rather than fully delete)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      active: false,
      deactivatedAt: new Date(),
    },
  });

  // Invalidate all sessions
  await sessionManager.destroyAllForUser(user.id);

  await logAuditEvent({
    type: 'scim_user_deleted',
    orgId,
    userId: user.id,
    email: user.email,
  });

  res.status(204).send();
});

// ServiceProviderConfig (SCIM server capability info)
scimRouter.get('/ServiceProviderConfig', (req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://myapp.com/docs/scim',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{
      type: 'oauthbearertoken',
      name: 'OAuth Bearer Token',
      description: 'Authentication scheme using the OAuth Bearer Token Standard',
    }],
  });
});

// Mount the router
app.use('/scim/v2', scimRouter);
```

---

## 7. Enterprise Authentication Security Requirements

```
B2B SaaS Authentication Checklist:

  SSO:
  ✓ SAML 2.0 support (SP-Initiated + IdP-Initiated)
  ✓ OIDC support (Authorization Code Flow + PKCE)
  ✓ Per-tenant SSO configuration
  ✓ SSO enforcement option (disable password)
  ✓ Auto-fetch of IdP Metadata (by URL)
  ✓ Certificate rotation (zero downtime)
  ✓ SSO connection test feature

  Directory:
  ✓ SCIM provisioning
  ✓ Auto-deactivation of departed employees (deprovisioning)
  ✓ Group/role synchronization
  ✓ JIT provisioning

  Security:
  ✓ Organization-level MFA enforcement
  ✓ Session expiry configurable per organization
  ✓ IP allowlist
  ✓ Audit logs (login/logout/permission changes)
  ✓ API key management
  ✓ Customizable password policies

  Compliance:
  ✓ SOC 2 Type II
  ✓ GDPR compliance (data deletion requests)
  ✓ HIPAA compliance (for healthcare)
  ✓ Data residency selection (region specification)
  ✓ Data encryption (at rest / in transit)
  ✓ Retention period policies
```

### 7.1 Organization-Level MFA Enforcement

```typescript
// Organization-level MFA enforcement
app.use('/api', async (req, res, next) => {
  const session = await getSession(req);
  if (!session) return next();

  // Get organization's security settings
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.userId },
    include: { org: true },
  });

  if (!membership) return next();

  const org = membership.org;

  // 1. MFA enforcement check
  if (org.mfaRequired) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user?.mfaEnabled) {
      return res.status(403).json({
        error: 'MFA required',
        code: 'MFA_SETUP_REQUIRED',
        message: 'Your organization requires MFA. Please set up MFA to continue.',
        setupUrl: '/settings/security/mfa',
      });
    }
  }

  // 2. IP allowlist check
  if (org.ipAllowlist.length > 0) {
    const clientIP = getClientIP(req);
    const isAllowed = org.ipAllowlist.some((allowed: string) => {
      if (allowed.includes('/')) {
        // CIDR notation
        return isIPInCIDR(clientIP, allowed);
      }
      return clientIP === allowed;
    });

    if (!isAllowed) {
      await logSecurityEvent({
        type: 'ip_blocked',
        userId: session.userId,
        orgId: org.id,
        ip: clientIP,
        allowedIPs: org.ipAllowlist,
      });

      return res.status(403).json({
        error: 'Access denied',
        code: 'IP_NOT_ALLOWED',
        message: 'Your IP address is not in the organization allowlist.',
      });
    }
  }

  // 3. Session max age check
  if (org.sessionMaxAge) {
    const sessionAge = Date.now() - session.createdAt;
    if (sessionAge > org.sessionMaxAge * 1000) {
      await sessionManager.destroy(req.cookies['__Host-session_id']);
      return res.status(401).json({
        error: 'Session expired',
        code: 'SESSION_EXPIRED_BY_ORG_POLICY',
        message: 'Your session has expired per organization policy.',
      });
    }
  }

  next();
});
```

### 7.2 Audit Logs

```typescript
// Enterprise audit logs

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  orgId: string;
  actorId: string;         // Operator (user or system)
  actorType: 'user' | 'admin' | 'system' | 'scim' | 'api';
  action: string;          // 'login', 'logout', 'create_user', etc.
  resource: string;        // 'session', 'user', 'team', etc.
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorReason?: string;
}

class AuditLogger {
  // Record audit log entry
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    await prisma.auditLog.create({
      data: {
        ...entry,
        details: entry.details as any,
        timestamp: new Date(),
      },
    });

    // Real-time notification (for security events)
    if (this.isSecurityEvent(entry.action)) {
      await this.notifySecurityTeam(entry);
    }
  }

  // Search audit logs (for admin panel)
  async search(orgId: string, filters: {
    startDate?: Date;
    endDate?: Date;
    actorId?: string;
    action?: string;
    resource?: string;
    success?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<{ entries: AuditLogEntry[]; nextCursor?: string }> {
    const where: any = { orgId };

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.success !== undefined) where.success = filters.success;

    const limit = Math.min(filters.limit || 50, 200);

    if (filters.cursor) {
      where.id = { lt: filters.cursor };
    }

    const entries = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
    });

    const hasMore = entries.length > limit;
    if (hasMore) entries.pop();

    return {
      entries: entries as AuditLogEntry[],
      nextCursor: hasMore ? entries[entries.length - 1].id : undefined,
    };
  }

  // Export audit logs (CSV)
  async exportCSV(orgId: string, startDate: Date, endDate: Date): Promise<string> {
    const entries = await prisma.auditLog.findMany({
      where: {
        orgId,
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    const header = 'Timestamp,Actor,Action,Resource,IP Address,Success,Details\n';
    const rows = entries.map((e) =>
      `${e.timestamp.toISOString()},${e.actorId},${e.action},${e.resource},${e.ipAddress},${e.success},"${JSON.stringify(e.details).replace(/"/g, '""')}"`
    ).join('\n');

    return header + rows;
  }

  private isSecurityEvent(action: string): boolean {
    return [
      'login_failed',
      'mfa_failed',
      'ip_blocked',
      'session_hijack_detected',
      'scim_user_deactivated',
      'sso_config_changed',
      'admin_role_granted',
    ].includes(action);
  }

  private async notifySecurityTeam(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    // Notify via Slack / PagerDuty / email, etc.
    // Based on organization's security notification settings
  }
}

// Audit log API
app.get('/api/admin/audit-logs', requireOrgAdmin, async (req, res) => {
  const auditLogger = new AuditLogger();
  const result = await auditLogger.search(req.orgId, {
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    actorId: req.query.actorId as string,
    action: req.query.action as string,
    limit: parseInt(req.query.limit as string) || 50,
    cursor: req.query.cursor as string,
  });

  res.json(result);
});
```

---

## 8. Authentication SaaS Options

```
Comparison of Authentication SaaS:

  ┌────────────┬──────┬──────┬────────────────┬──────────────────────┐
  │ Service    │ SSO  │ SCIM │ Pricing        │ Features             │
  ├────────────┼──────┼──────┼────────────────┼──────────────────────┤
  │ Auth0      │ ✓    │ ✓    │ High ($23k+/yr)│ Most feature-rich    │
  │ WorkOS     │ ✓    │ ✓    │ Mid ($49/conn/mo)│ Enterprise SSO focused│
  │ Clerk      │ ✓    │ △    │ Mid ($0.02/MAU) │ React UI components  │
  │ Kinde      │ ✓    │ △    │ Low ($0/~)     │ New, great DX        │
  │ Keycloak   │ ✓    │ ✓    │ Free (self-host)│ Self-hosted          │
  │ Stytch     │ ✓    │ ✓    │ Mid            │ Strong B2B auth      │
  │ FusionAuth │ ✓    │ ✓    │ Mid (self-host) │ Flexible customization│
  └────────────┴──────┴──────┴────────────────┴──────────────────────┘

  Selection guide:

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  Startups (up to Series A):                             │
  │    → Auth.js (free) for email/password + social login   │
  │    → Add WorkOS when SSO becomes needed                 │
  │    → Reason: Minimize upfront cost, scale as needed     │
  │                                                         │
  │  Growth stage (Series B+):                              │
  │    → Full-stack auth with Clerk or Auth0                │
  │    → WorkOS or Auth0 if SCIM support is needed          │
  │    → Reason: Focus development resources on the product │
  │                                                         │
  │  Enterprise:                                            │
  │    → Auth0 (full-stack) or WorkOS (SSO/SCIM focused)   │
  │    → Self-hosting requirements → Keycloak or FusionAuth │
  │    → Reason: Compliance, SLA, support                   │
  │                                                         │
  │  Self-hosting requirements:                             │
  │    → Keycloak (Java) or Authentik (Python)              │
  │    → Reason: Data sovereignty, regulatory requirements  │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

```typescript
// SSO implementation using WorkOS (minimal code)
// npm install @workos-inc/node

import WorkOS from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

// Start SSO login
app.get('/api/auth/sso/login', async (req, res) => {
  const { email } = req.query;

  // WorkOS automatically identifies the organization from the domain
  const authorizationUrl = workos.sso.getAuthorizationURL({
    clientId: process.env.WORKOS_CLIENT_ID!,
    // Domain-based or connection ID-based
    domain: email ? (email as string).split('@')[1] : undefined,
    connection: req.query.connectionId as string,
    redirectUri: 'https://myapp.com/api/auth/sso/callback',
    state: JSON.stringify({
      redirectTo: req.query.redirectTo || '/dashboard',
    }),
  });

  res.redirect(authorizationUrl);
});

// SSO callback
app.get('/api/auth/sso/callback', async (req, res) => {
  const { code, state } = req.query;
  const { redirectTo } = JSON.parse(state as string);

  try {
    // WorkOS handles profile retrieval and validation in one step
    const { profile } = await workos.sso.getProfileAndToken({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code: code as string,
    });

    // profile: { id, email, first_name, last_name, organization_id, ... }

    const user = await findOrCreateUser({
      email: profile.email,
      name: `${profile.first_name} ${profile.last_name}`,
      externalId: profile.id,
      orgExternalId: profile.organization_id,
    });

    const { sessionId } = await sessionManager.create(
      { userId: user.id, role: user.role },
      req as any
    );

    setSessionCookie(res, sessionId);
    res.redirect(redirectTo || '/dashboard');
  } catch (error) {
    console.error('WorkOS SSO error:', error);
    res.redirect('/login?error=sso_failed');
  }
});

// WorkOS SCIM directory sync (Webhook)
app.post('/api/webhooks/workos', async (req, res) => {
  const payload = workos.webhooks.constructEvent({
    payload: req.body,
    sigHeader: req.headers['workos-signature'] as string,
    secret: process.env.WORKOS_WEBHOOK_SECRET!,
  });

  switch (payload.event) {
    case 'dsync.user.created': {
      const { data } = payload;
      await prisma.user.create({
        data: {
          email: data.emails[0].value,
          name: `${data.first_name} ${data.last_name}`,
          externalId: data.id,
          active: data.state === 'active',
          emailVerified: true,
        },
      });
      break;
    }

    case 'dsync.user.deleted':
    case 'dsync.user.deactivated': {
      const { data } = payload;
      await prisma.user.update({
        where: { externalId: data.id },
        data: { active: false, deactivatedAt: new Date() },
      });
      await sessionManager.destroyAllForUser(data.id);
      break;
    }

    case 'dsync.group.user_added':
    case 'dsync.group.user_removed': {
      // Update group membership
      break;
    }
  }

  res.json({ received: true });
});
```

---

## 9. Anti-Patterns

```
Enterprise Authentication Anti-Patterns:

  ❌ Anti-pattern 1: Adding SSO as an afterthought
     → Implement authentication without considering multi-tenancy
     → Major refactoring required when adding SSO later
     ○ Correct approach: Plan for per-tenant authentication from the initial design

  ❌ Anti-pattern 2: Skipping SAML signature verification
     → Disable signature verification during development → shipped to production as-is
     → Enables IdP impersonation attacks
     ○ Correct approach: Always verify XML signatures, enable them in tests too

  ❌ Anti-pattern 3: Storing SCIM tokens in plaintext
     → Save SCIM Bearer tokens to the DB in plaintext
     → Directory integration can be exploited if DB is leaked
     ○ Correct approach: Hash tokens before storing

  ❌ Anti-pattern 4: Allowing password reset for SSO users
     → Password reset is possible in organizations with enforced SSO
     → Security hole that allows bypassing SSO
     ○ Correct approach: Disable password-related features when SSO is enforced

  ❌ Anti-pattern 5: Leaving departed users' sessions active
     → SCIM deactivates the user but sessions remain valid
     → Departed user can still access the system
     ○ Correct approach: Immediately destroy all sessions upon deactivation
```

---

## 10. Edge Cases

```
SSO Edge Cases:

  ① Fallback on IdP failure:
     → IdP goes down → SSO login unavailable
     → Mitigation: "Break glass" account for emergency access
     → Allow backup password only for organization administrators
     → Auto-detect and alert on IdP failure

  ② Verification errors during certificate rotation:
     → IdP switches to new certificate → validation with old certificate fails
     → Mitigation: Periodically fetch Metadata URL to auto-update certificates
     → Grace period where both old and new certificates are trusted

  ③ Domain ownership transfer:
     → Corporate acquisition changes ownership of example.com
     → Previous organization's users may authenticate via new organization's SSO
     → Mitigation: Periodic domain ownership verification (DNS TXT record)

  ④ Users belonging to multiple organizations:
     → alice@consultant.com belongs to multiple customer organizations
     → Which organization's SSO should be used for login?
     → Mitigation: Show organization selection screen, or use different URLs per organization

  ⑤ Lockout due to SSO misconfiguration:
     → Organization admin saves incorrect SSO settings
     → All users are unable to log in
     → Mitigation: Require test connection before saving SSO settings
     → Super admin account as a backdoor
     → Immediate SSO configuration rollback feature

  ⑥ SAML Response replay attacks:
     → Attacker reuses a previous SAMLResponse
     → Mitigation: Verify InResponseTo, check Assertion expiry
     → Record used AssertionIDs (replay prevention)
```

```typescript
// Break glass (emergency access) implementation
app.post('/api/auth/break-glass', async (req, res) => {
  const { email, password, breakGlassCode } = req.body;

  // Verify break glass code (distributed to org admins in advance)
  const org = await getOrgByEmailDomain(email);
  if (!org) {
    return res.status(400).json({ error: 'Organization not found' });
  }

  const isValidCode = await verifyBreakGlassCode(org.id, breakGlassCode);
  if (!isValidCode) {
    await logSecurityEvent({
      type: 'break_glass_failed',
      email,
      orgId: org.id,
      ip: getClientIP(req),
      severity: 'critical',
    });
    return res.status(403).json({ error: 'Invalid break glass code' });
  }

  // Normal authentication (SSO bypass)
  const user = await authenticateWithPassword(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create session (short expiry)
  const { sessionId } = await sessionManager.create(
    { userId: user.id, role: user.role },
    req
  );

  // Urgent notification to all admins
  await notifyAllAdmins({
    type: 'break_glass_used',
    email,
    orgId: org.id,
    ip: getClientIP(req),
    severity: 'critical',
    message: `Emergency access used by ${email}. SSO may be down.`,
  });

  await logAuditEvent({
    type: 'break_glass_login',
    orgId: org.id,
    userId: user.id,
    ip: getClientIP(req),
  });

  setSessionCookie(res, sessionId);
  res.json({ success: true, warning: 'Emergency access logged and monitored' });
});
```

---

## 11. Exercises

### Exercise 1 (Basic): Implementing Per-Tenant SSO Determination

```
Task:
  Implement the following:
  1. A function that identifies an organization from an email address domain
  2. An API that determines the authentication method based on the organization's SSO settings
  3. Logic to reject password login when SSO is enforced

Verification points:
  - Does the domain search handle uppercase/lowercase correctly?
  - Is password login permitted for organizations without SSO configured?
  - Is password login properly rejected when SSO is enforced?
```

### Exercise 2 (Intermediate): Implementing SAML SSO

```
Task:
  Use the samlify library to implement the following:
  1. SP Metadata generation and distribution endpoint
  2. SP-Initiated SSO login flow
  3. SAML Assertion verification and user creation (JIT provisioning)
  4. Per-tenant IdP configuration management

Verification points:
  - Is XML signature verification enabled?
  - Is NameID and domain matching being checked?
  - Are groups being mapped to roles during JIT provisioning?
  - Are audit logs being recorded?
```

### Exercise 3 (Advanced): Implementing SCIM Provisioning

```
Task:
  Implement RFC 7644-compliant SCIM endpoints:
  1. Bearer token authentication
  2. CRUD endpoints (Users)
  3. User deactivation via PATCH operation (deprovisioning)
  4. Destroy all sessions on deactivation
  5. Filter support (userName eq "...")

Verification points:
  - Are SCIM tokens hashed before being stored?
  - Are all sessions destroyed on deprovisioning?
  - Do SCIM responses conform to the RFC 7644 schema?
  - Are error responses in SCIM standard format?
```
