# Caller-name lookup feasibility (Phase 6A)

## Decision

**No provider is confirmed for Phase 6B.** The additional research found official reverse-name products, but neither Sync.me nor IPQualityScore (IPQS) explicitly confirms caller-name coverage for Nigerian `+234` numbers and permission to distribute a user-run open-source CLI adapter. Keep DialScope offline; do not add a provider integration on the current evidence.

## Providers reviewed

| Provider | Reverse caller-name API? | Explicit +234 support? | Access and cost | Decision |
| --- | --- | --- | --- | --- |
| [Twilio Lookup v2](https://www.twilio.com/docs/lookup/v2-api) | Yes. Request `fields=caller_name`; the response has `callerName` with `callerName`, `callerType`, and `errorCode`. | **No.** Twilio documents Caller Name as supported only for US carrier numbers; international Lookup/validation support does not extend CNAM coverage. | A Twilio account and API credentials are needed. Basic formatting/validation is free; data packages are paid. The [pricing page](https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup) describes pay-as-you-go pricing and free account signup, but does not list a Nigeria caller-name price because the feature is US-only. No caller-name trial entitlement is documented there. | Not suitable for +234. |
| [Vonage Number Insight](https://developer.vonage.com/en/number-insight/guides/cnam) | Yes. `cnam=true` requests a reverse lookup; fields include `caller_name`, `caller_type`, `first_name`, and `last_name`. | **No.** Vonage explicitly says CNAM is only provided for US numbers. For non-US numbers the CNAM fields are omitted. | Requires a Vonage API key and secret. The API reference says CNAM has an additional charge for US numbers; non-US numbers are not charged for CNAM. No Nigeria-specific caller-name trial is documented. | Not suitable for +234. |
| [Braidis Data API](https://docs.braidisdata.com/api/overview) | The official overview documents a `/caller-id` endpoint for number-to-name lookup. | **Not established.** The published docs reviewed do not state country coverage, including Nigeria. General endpoint availability does not prove +234 caller-name coverage. | The docs mention API-key authentication and a credit cost, but publicly verifiable Nigeria pricing, trial restrictions, and terms authorizing this CLI/open-source adapter were not established. | Not suitable without explicit Nigeria coverage and terms confirmation. |
| [Truecaller developer SDK](https://docs.truecaller.com/truecaller-sdk) | The published SDK documentation describes a user-consented verification/login flow that returns a profile after the user approves. It is not documented as a caller-supplied-number reverse lookup endpoint for this CLI. | No official API documentation found that explicitly confirms reverse lookup for Nigerian numbers. | SDK app registration and platform-specific app metadata are required. The published SDK FAQ describes that SDK as free; that is not evidence of access to a caller-name lookup API. The [API License Addendum](https://www.truecaller.com/api-license-addendum) limits API use and restricts redistribution of API data. | Not a supported fit; no suitable documented +234 API established. |

## Additional providers investigated (2026-10-14)

| Provider | Name data vs. spam | Nigeria caller-name coverage | Integration and response | Access, pricing, terms | Decision |
| --- | --- | --- | --- | --- | --- |
| [Sync.me Caller ID MCP](https://github.com/syncmeltd/syncme-plugins) | The official offer describes caller ID lookup with spam/fraud and business signals; its pricing page says caller names are included “when available.” The official terms describe Caller ID as associating a name with a number via incoming calls or numeric search. This is more than spam scoring, but public MCP material does not specify whether each result name is a person's name, business name, or community label. | **Unclear.** The pricing page markets broad/global phone intelligence, but does not explicitly state that caller-name results are supported for Nigerian `+234` numbers. Global number lookup or spam coverage is not proof of name coverage. | The official plugin's [`.mcp.json`](https://github.com/syncmeltd/syncme-plugins/blob/main/.mcp.json) points to `https://mcp.sync.me/mcp` over HTTP MCP. The plugin lists `check-phone` and `check-credits`; it describes a verdict/summary but does not publish a formal tool input/output schema or exact no-name response. No public REST API contract or Node MCP client is documented. DialScope has no MCP client dependency today. | The official plugin says OAuth authentication via Sync.me login and one credit per successful lookup. The [MCP pricing page](https://mcp.sync.me/pricing) lists $100 for 4,000 lookups (credits do not expire), with larger/custom options, including $500 for 20,000 lookups; no trial is stated. The repo's [MIT license](https://github.com/syncmeltd/syncme-plugins/blob/main/LICENSE) covers plugin code only. Sync.me's [consumer terms](https://sync.me/terms/) grant personal, non-commercial use and restrict copying/distribution and access to service materials; a separate API/MCP business agreement authorizing a BYOK open-source CLI was not found. | Candidate for a vendor enquiry only. Do not purchase or integrate until +234 name coverage, schema, trial/account conditions, and CLI/open-source rights are confirmed in writing. |
| [IPQualityScore Phone Validation API](https://www.ipqualityscore.com/documentation/phone-number-validation-api/overview) | Yes. Official docs describe reverse lookup returning an owner's personal first/last name or a company name, alongside separate reputation/spam fields. Names are provider-associated data, not proof of verified ownership. | **Unclear and likely limited.** IPQS says number validation supports 150+ countries / worldwide. For reverse-name data it separately says excellent coverage in the US/Canada and limited international support, naming Europe and Asia. It does not say Africa or Nigeria is supported for names. A global `NG` validation country code or global carrier lookup does not establish +234 name coverage. | A documented REST JSON endpoint is `GET https://www.ipqualityscore.com/api/json/phone/{API_KEY}/{PHONE}`; the key can also be sent in the documented `IPQS-KEY` header. No IPQS MCP integration was found. Response includes `success`, `message`, `request_id`, and `name` (string; `N/A` when unknown, potentially multiple names comma-separated). A distinct `identity_data` object is an enterprise/add-on feature; its unavailable fields may be `null` or empty arrays. The API's invalid-number example has `success:false` and `name:"N/A"`; a name of `N/A` alone means unavailable, not a provider failure. | Register at [IPQS Phone Validation account signup](https://www.ipqualityscore.com/create-account/phone-validation); the page advertises free signup/no credit card and 1,000 free credits monthly. API keys are managed in the dashboard. Terms say each lookup consumes a credit and allow limits on trials/features. Marketing describes phone checks averaging $0.0005/user, but this is not a published caller-name-specific price or confirmation that the name field is included in free credits. The [Terms of Service §16](https://www.ipqualityscore.com/terms-of-service) prohibit republishing data/responses/access and offering a substantially similar API client to third parties without written approval; it is unclear whether a local BYOK CLI adapter is allowed. The terms define the client as an entity, so individual/hobby account eligibility also needs clarification. | Strongest REST/API candidate, but not confirmed for +234 or open-source BYOK use. Ask IPQS before using account credits or implementing. |

### Questions for official support

No support request was sent. These are ready to submit through each official contact page.

**Sync.me:** [Contact Us](https://sync.me/contactus/) (the terms also list `support@sync.me`).

> I maintain DialScope, an open-source TypeScript CLI that currently works offline. Does the paid Sync.me Caller ID MCP support reverse lookup of Nigerian +234 numbers and return personal caller names, business names, or both? Please confirm country-specific name coverage and limitations separately from spam/global lookup coverage; provide the supported MCP tool schema and exact no-name/error responses; explain account registration, OAuth requirements for a standalone CLI, trial credits and prices; and confirm which API/MCP terms govern a BYOK CLI and whether we may distribute its adapter source under an open-source license. Please clarify whether users may display returned names locally and whether retention is restricted.

**IPQualityScore:** [Contact Us](https://www.ipqualityscore.com/contact-us) (`support@ipqualityscore.com` is also published on official support material).

> I maintain DialScope, an open-source TypeScript CLI. Does the Phone Number Validation API's `name` reverse-lookup field return personal or business names for Nigerian +234 numbers? Please state country-specific name coverage/match limitations separately from validation/carrier coverage. Is `name` included in the free 1,000 monthly credits, or does it require a plan/add-on, and what is its price? Please confirm the exact response when no +234 name is available. May individual users run an open-source local CLI adapter with their own API keys without hosting, reselling, or retaining IPQS data, given Terms §16's API-client restriction? Are individual developers eligible under the client/account terms?

### Account and credential handling

- **Sync.me:** Registration/access for the published MCP path is through the official plugin's OAuth sign-in with a Sync.me account; paid lookup credits are offered at [mcp.sync.me/pricing](https://mcp.sync.me/pricing). Do not buy credits until the vendor confirms +234 caller-name access and the applicable CLI terms. The OAuth path is not an environment API key documented for DialScope.
- **IPQS:** Create an account at [IPQS Phone Validation signup](https://www.ipqualityscore.com/create-account/phone-validation), then manage an API key in the dashboard as documented in [API key authentication](https://www.ipqualityscore.com/documentation/about-ipqs-apis/submitting-data-to-ipqs-apis). Do not assume the free credits include reverse-name data. If a later approved test is authorized, supply the key locally as `IPQS_API_KEY` in the current PowerShell session, read it through a secure local prompt or secret manager, and clear it when done; do not paste it into chat or commit it. No credential-dependent test has been run.

## Terms and open-source distribution

Twilio's [terms](https://www.twilio.com/en-us/legal/tos/tos-apr-2026) permit its services to be made available to end users as part of software applications, subject to its terms, product documentation, and account responsibilities. This supports the general shape of a user-run CLI integration, but does not establish a right to redistribute caller-name data. The terms do not expressly address publishing a provider adapter under an open-source license. Since Twilio caller-name coverage is US-only, this is not a basis for integrating it for this project's Nigerian use case.

Vonage's API documentation establishes an API and account-authenticated request, but the sources reviewed do not expressly establish that returned CNAM data can be redistributed or authorize a public open-source integration for this use. Its US-only coverage independently rules it out for this phase.

Truecaller's API License Addendum says API content may not be further distributed except under a separate binding written agreement with sufficiently restrictive terms. Its publicly documented SDK is a user-consent verification flow, not the reverse-lookup API needed here. No public terms found establish an open-source CLI distribution right for the requested lookup.

These are product feasibility findings, not legal advice. Any future vendor proposal needs a current written answer on permitted end-user CLI use, returned-data display/retention, and open-source distribution of the adapter.

## Phase 6B gate

Do not begin provider implementation until an official provider source confirms all of the following for Nigerian `+234` numbers:

1. Reverse lookup of a supplied phone number can return a caller name (not only validation, carrier metadata, user login, or user-consented verification).
2. Nigeria is explicitly in the feature's coverage.
3. Developer onboarding, credentials, account approval, pricing, and trial limits are documented.
4. The response schema and no-result/provider-error behavior are documented.
5. Contract terms permit users to call the service from this CLI and permit publishing the integration code under DialScope's MIT license.

Recommended next step: submit the two enquiries above, prioritizing IPQS because it publishes a direct REST reverse-name response schema; Sync.me is a secondary candidate because its public interface is MCP and its tool schema is not published. If either vendor confirms coverage and terms, create an account only after reviewing its answer and then run one lookup using your own number or a consenting tester's number supplied locally. A single hit establishes only that the particular query returned a name, not broad Nigerian coverage.

If those conditions are later met, Phase 6B should keep lookup opt-in via `--caller-name`, use user-supplied local credentials, preserve the current offline path and unchanged JSON output when the flag is absent, and label output **provider-reported caller name**, not verified ownership. The planned explicit statuses remain `found`, `not_found`, `unsupported_country`, `missing_credentials`, and `provider_failure`. These are not implemented behavior.

## Official sources

- [Twilio Lookup v2 API documentation](https://www.twilio.com/docs/lookup/v2-api)
- [Twilio Lookup pricing](https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup)
- [Twilio Terms of Service](https://www.twilio.com/en-us/legal/tos/tos-apr-2026)
- [Vonage CNAM guide](https://developer.vonage.com/en/number-insight/guides/cnam)
- [Vonage Number Insight API reference](https://developer.vonage.com/en/api/number-insight)
- [Truecaller SDK documentation](https://docs.truecaller.com/truecaller-sdk)
- [Truecaller SDK FAQ](https://docs.truecaller.com/truecaller-sdk/faqs/general)
- [Truecaller API License Addendum](https://www.truecaller.com/api-license-addendum)
- [Sync.me official plugins repository and MCP integration](https://github.com/syncmeltd/syncme-plugins)
- [Sync.me MCP pricing](https://mcp.sync.me/pricing)
- [Sync.me Terms of Use](https://sync.me/terms/)
- [Sync.me Contact Us](https://sync.me/contactus/)
- [IPQS Phone Validation API overview](https://www.ipqualityscore.com/documentation/phone-number-validation-api/overview)
- [IPQS Phone Validation API response parameters](https://www.ipqualityscore.com/documentation/phone-number-validation-api/response-parameters)
- [IPQS API authentication](https://www.ipqualityscore.com/documentation/about-ipqs-apis/submitting-data-to-ipqs-apis)
- [IPQS account signup](https://www.ipqualityscore.com/create-account/phone-validation)
- [IPQS Terms of Service](https://www.ipqualityscore.com/terms-of-service)
- [IPQS Contact Us](https://www.ipqualityscore.com/contact-us)
